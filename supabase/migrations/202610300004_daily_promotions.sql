-- Optional customer marketing; transactional notifications retain their existing rules.
alter table private.notification_preferences add column promotions_enabled boolean not null default false;
create table private.promotion_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 daily_count integer not null default 3 check(daily_count between 1 and 3),
 updated_at timestamptz not null default now()
);
insert into private.promotion_settings(id) values(true);
create table private.promotion_templates (
 slot integer primary key check(slot between 1 and 5),
 body text not null check(length(trim(body)) between 1 and 160)
);
create table private.promotion_schedule (
 user_id uuid not null references public.profiles on delete cascade,
 local_day date not null, slot integer not null check(slot between 1 and 3),
 template_slot integer not null references private.promotion_templates(slot),
 scheduled_at timestamptz not null, notified_at timestamptz,
 primary key(user_id,local_day,slot),unique(user_id,local_day,template_slot)
);
create index promotion_due on private.promotion_schedule(local_day,scheduled_at) where notified_at is null;
alter table private.promotion_settings enable row level security;
alter table private.promotion_templates enable row level security;
alter table private.promotion_schedule enable row level security;
revoke all on private.promotion_settings,private.promotion_templates,private.promotion_schedule from public,anon,authenticated;
create function public.admin_promotion_settings() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_banner_admin() then raise exception 'Admin access required';end if;
 return (select jsonb_build_object('enabled',s.enabled,'daily_count',s.daily_count,'updated_at',s.updated_at,
 'messages',(select coalesce(jsonb_agg(jsonb_build_object('slot',t.slot,'body',t.body) order by t.slot),'[]'::jsonb) from private.promotion_templates t)) from private.promotion_settings s where id);
end;$$;
create function public.save_promotion_settings(p_messages text[],p_enabled boolean,p_daily_count integer,p_expected_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_banner_admin() then raise exception 'Admin access required';end if;
 if cardinality(p_messages) is distinct from 5 or p_enabled is null or p_daily_count is null or p_daily_count not between 1 and 3 or
 exists(select 1 from unnest(p_messages) m where m is null or length(trim(m)) not between 1 and 160) or
 (select count(distinct lower(trim(m))) from unnest(p_messages) m)<>5 then raise exception 'Add five different messages of 1–160 characters and choose 1–3 daily sends';end if;
 perform 1 from private.promotion_settings where id for update;
 if p_expected_at is null or not exists(select 1 from private.promotion_settings where id and updated_at=p_expected_at) then raise exception 'Another admin changed promotions. Refresh and try again';end if;
 insert into private.promotion_templates(slot,body) select i,trim(p_messages[i]) from generate_series(1,5) i on conflict(slot) do update set body=excluded.body;
 update private.promotion_settings set enabled=p_enabled,daily_count=p_daily_count,updated_at=clock_timestamp() where id;
 return public.admin_promotion_settings();
end;$$;
revoke all on function public.admin_promotion_settings(),public.save_promotion_settings(text[],boolean,integer,timestamptz) from public,anon;
grant execute on function public.admin_promotion_settings(),public.save_promotion_settings(text[],boolean,integer,timestamptz) to authenticated;

create or replace function public.notification_settings(p_variant text,p_settings jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or p_variant not in ('customer','professional') then raise exception 'Sign in to manage notifications';end if;
 insert into private.notification_preferences(user_id,app_variant) values(auth.uid(),p_variant) on conflict do nothing;
 if p_settings is not null then update private.notification_preferences set
 push_enabled=coalesce((p_settings->>'push_enabled')::boolean,push_enabled),
 messages_enabled=coalesce((p_settings->>'messages_enabled')::boolean,messages_enabled),
 events_enabled=coalesce((p_settings->>'events_enabled')::boolean,events_enabled),
 promotions_enabled=case when p_variant='customer' then coalesce((p_settings->>'promotions_enabled')::boolean,promotions_enabled) else false end
 where user_id=auth.uid() and app_variant=p_variant;end if;
 select jsonb_build_object('push_enabled',push_enabled,'messages_enabled',messages_enabled,'events_enabled',events_enabled,'promotions_enabled',promotions_enabled)
 into result from private.notification_preferences where user_id=auth.uid() and app_variant=p_variant;return result;
end;$$;

create function public.queue_daily_promotions(p_now timestamptz default now()) returns integer language plpgsql security definer set search_path='' as $$
declare settings private.promotion_settings;u record;due record;choices integer[];day date;window_start timestamptz;slot integer;queued integer:=0;
begin
 perform pg_advisory_xact_lock(830103004);
 select * into settings from private.promotion_settings where id;
 if not settings.enabled or (select count(*) from private.promotion_templates)<>5 then return 0;end if;
 day:=(p_now at time zone 'Asia/Kolkata')::date;
 delete from private.promotion_schedule where local_day<day-35;
 -- Plan each account/day once. New installs never catch up expired windows.
 for u in select p.user_id from private.notification_preferences p where p.app_variant='customer' and p.push_enabled and p.promotions_enabled
 and exists(select 1 from private.notification_devices d where d.user_id=p.user_id and d.app_variant='customer' and d.updated_at>p_now-interval '60 days')
 and not exists(select 1 from private.promotion_schedule s where s.user_id=p.user_id and s.local_day=day) limit 500 loop
  select array_agg(t.slot) into choices from (select t.slot from private.promotion_templates t order by random() limit 3) t;
  for slot in 1..3 loop
   window_start:=(day::timestamp+make_interval(hours=>case slot when 1 then 10 when 2 then 14 else 18 end)) at time zone 'Asia/Kolkata';
   insert into private.promotion_schedule(user_id,local_day,slot,template_slot,scheduled_at)
    values(u.user_id,day,slot,choices[slot],window_start+random()*interval '2 hours') on conflict do nothing;
  end loop;
 end loop;
 for due in select s.*,t.body from private.promotion_schedule s join private.promotion_templates t on t.slot=s.template_slot
 join private.notification_preferences p on p.user_id=s.user_id and p.app_variant='customer'
 where s.local_day=day and s.slot<=settings.daily_count and s.notified_at is null and s.scheduled_at<=p_now and s.scheduled_at>p_now-interval '45 minutes'
 and p.push_enabled and p.promotions_enabled
 and exists(select 1 from private.notification_devices d where d.user_id=s.user_id and d.app_variant='customer' and d.updated_at>p_now-interval '60 days')
 order by s.scheduled_at limit 500 loop
  perform private.notify_circle(due.user_id,'customer','promotion','Artist House',due.body,'promotion:'||day::text||':'||due.slot::text);
  update private.promotion_schedule s set notified_at=p_now where s.user_id=due.user_id and s.local_day=due.local_day and s.slot=due.slot;
  queued:=queued+1;
 end loop;
 return queued;
end;$$;
revoke all on function public.queue_daily_promotions(timestamptz) from public,anon,authenticated;
grant execute on function public.queue_daily_promotions(timestamptz) to service_role;

-- Old, paused, edited-away or opted-out marketing is suppressed even after claim.
create function private.promotion_delivery_allowed(p_note public.app_notifications) returns boolean language sql stable security definer set search_path='' as $$
 select p_note.kind<>'promotion' or (
 p_note.app_variant='customer' and p_note.created_at>now()-interval '45 minutes'
 and exists(select 1 from private.notification_preferences p where p.user_id=p_note.user_id and p.app_variant='customer' and p.promotions_enabled)
 and exists(select 1 from private.promotion_settings s join private.promotion_schedule d on d.user_id=p_note.user_id
 and p_note.dedupe_key='promotion:'||d.local_day::text||':'||d.slot::text
 join private.promotion_templates t on t.slot=d.template_slot where s.id and s.enabled and d.slot<=s.daily_count and t.body=p_note.body)
 );
$$;
revoke all on function private.promotion_delivery_allowed(public.app_notifications) from public,anon,authenticated;

create or replace function public.notification_delivery_current(p_id uuid,p_attempt integer) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.notification_deliveries j
 join private.notification_devices d on d.id=j.device_id join public.app_notifications n on n.id=j.notification_id
 join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant left join public.bookings b on b.id=n.booking_id
 where j.id=p_id and j.attempts=p_attempt and j.state='sending' and j.lease_until>now()
 and n.user_id=d.user_id and n.app_variant=d.app_variant and n.read_at is null and n.created_at>now()-interval '1 day' and p.push_enabled
 and (n.kind<>'message' or p.messages_enabled) and (n.kind not like 'event%' or p.events_enabled)
 and (n.dedupe_key not like 'request:%' or b.status='requested')
 and (n.dedupe_key not like 'status:%' or n.dedupe_key='status:'||b.id||':'||b.status)
 and (n.kind<>'reminder' or (b.status='accepted' and b.starts_at>now())) and (n.kind<>'service' or b.service_ended_at is null)
 and private.promotion_delivery_allowed(n));
$$;

create or replace function public.claim_notification_deliveries_for_providers(p_providers text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 delete from public.app_notifications where created_at<now()-interval '30 days';
 update private.notification_deliveries j set state='failed' where j.state in ('pending','sending') and (j.attempts>=5 or not exists(
 select 1 from public.app_notifications n join private.notification_devices d on d.id=j.device_id
 left join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
 where n.id=j.notification_id and n.user_id=d.user_id and n.app_variant=d.app_variant and n.created_at>now()-interval '1 day'
 and n.read_at is null and coalesce(p.push_enabled,false) and (n.kind<>'message' or coalesce(p.messages_enabled,true))
 and (n.kind not like 'event%' or coalesce(p.events_enabled,true)) and private.promotion_delivery_allowed(n)));
 with picked as (select j.id from private.notification_deliveries j join private.notification_devices d on d.id=j.device_id join public.app_notifications n on n.id=j.notification_id
 where d.provider=any(p_providers) and ((j.state='pending' and j.next_attempt_at<=now()) or (j.state='sending' and j.lease_until<now()))
 order by (n.kind='promotion'),j.next_attempt_at for update of j skip locked limit 50), claimed as (
 update private.notification_deliveries j set state='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes' from picked where j.id=picked.id returning j.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'attempt',j.attempts,'token',d.token,'notification_id',n.id,'variant',n.app_variant,'title',n.title,
 'promotion_body',case when n.kind='promotion' then n.body else null end,'provider',d.provider,'environment',d.apns_environment)),'[]'::jsonb)
 into result from claimed j join private.notification_devices d on d.id=j.device_id join public.app_notifications n on n.id=j.notification_id;return result;
end;$$;
notify pgrst,'reload schema';
