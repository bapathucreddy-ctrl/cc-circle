-- Durable participant notifications. No GPS fixes, message text, OTPs or legal names.
create table public.app_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 app_variant text not null check(app_variant in ('customer','professional')),
 kind text not null,
 title text not null,
 body text not null,
 booking_id uuid references public.bookings on delete cascade,
 event_id uuid references private.team_events on delete cascade,
 message_id uuid references public.messages on delete cascade,
 dedupe_key text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(user_id,app_variant,dedupe_key)
);
create index app_notifications_inbox on public.app_notifications(user_id,app_variant,created_at desc);
alter table public.app_notifications enable row level security;
create policy own_notifications on public.app_notifications for select to authenticated using(user_id=auth.uid());
revoke all on public.app_notifications from public,anon,authenticated;
grant select on public.app_notifications to authenticated;
grant all on public.app_notifications to service_role;
alter publication supabase_realtime add table public.app_notifications;

create table private.notification_preferences (
 user_id uuid not null references public.profiles on delete cascade,
 app_variant text not null check(app_variant in ('customer','professional')),
 push_enabled boolean not null default false,
 messages_enabled boolean not null default true,
 events_enabled boolean not null default true,
 primary key(user_id,app_variant)
);
create table private.notification_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 app_variant text not null check(app_variant in ('customer','professional')),
 installation_id uuid not null,
 token text not null unique check(length(token) between 20 and 4096),
 updated_at timestamptz not null default now(),
 unique(installation_id,app_variant)
);
create table private.notification_deliveries (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.app_notifications on delete cascade,
 device_id uuid not null references private.notification_devices on delete cascade,
 attempts integer not null default 0,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 unique(notification_id,device_id)
);
alter table private.notification_preferences enable row level security;
alter table private.notification_devices enable row level security;
alter table private.notification_deliveries enable row level security;
revoke all on private.notification_preferences,private.notification_devices,private.notification_deliveries from public,anon,authenticated;

create function public.notification_settings(p_variant text, p_settings jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or p_variant not in ('customer','professional') then raise exception 'Sign in to manage notifications'; end if;
 insert into private.notification_preferences(user_id,app_variant) values(auth.uid(),p_variant) on conflict do nothing;
 if p_settings is not null then
  update private.notification_preferences set
   push_enabled=coalesce((p_settings->>'push_enabled')::boolean,push_enabled),
   messages_enabled=coalesce((p_settings->>'messages_enabled')::boolean,messages_enabled),
   events_enabled=coalesce((p_settings->>'events_enabled')::boolean,events_enabled)
  where user_id=auth.uid() and app_variant=p_variant;
 end if;
 select jsonb_build_object('push_enabled',push_enabled,'messages_enabled',messages_enabled,'events_enabled',events_enabled)
 into result from private.notification_preferences where user_id=auth.uid() and app_variant=p_variant;
 return result;
end; $$;

create function public.register_notification_device(p_variant text,p_installation_id uuid,p_token text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_variant not in ('customer','professional') or p_installation_id is null then raise exception 'Sign in to enable notifications'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from private.notification_devices where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id and token=p_token) then
  update private.notification_devices set updated_at=now() where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id;
  return;
 end if;
 -- Reassignment destroys queued deliveries for the previous account/token.
 delete from private.notification_devices where token=p_token or (installation_id=p_installation_id and app_variant=p_variant);
 delete from private.notification_devices where user_id=auth.uid() and updated_at<now()-interval '60 days';
 if (select count(*) from private.notification_devices where user_id=auth.uid())>=12 then raise exception 'Too many notification devices'; end if;
 insert into private.notification_devices(user_id,app_variant,installation_id,token) values(auth.uid(),p_variant,p_installation_id,p_token);
end; $$;
create function public.unregister_notification_device(p_installation_id uuid,p_variant text) returns void
language sql security definer set search_path='' as $$
 delete from private.notification_devices where user_id=auth.uid() and installation_id=p_installation_id and app_variant=p_variant;
$$;
create function public.read_notifications(p_variant text,p_id uuid default null) returns void
language sql security definer set search_path='' as $$
 update public.app_notifications set read_at=now() where user_id=auth.uid() and app_variant=p_variant and read_at is null and (p_id is null or id=p_id);
$$;
revoke all on function public.notification_settings(text,jsonb), public.register_notification_device(text,uuid,text),public.unregister_notification_device(uuid,text),public.read_notifications(text,uuid) from public,anon;
grant execute on function public.notification_settings(text,jsonb), public.register_notification_device(text,uuid,text),public.unregister_notification_device(uuid,text),public.read_notifications(text,uuid) to authenticated;

create function private.notify_circle(p_user uuid,p_variant text,p_kind text,p_title text,p_body text,p_key text,p_booking uuid default null,p_event uuid default null,p_message uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare notification uuid;
begin
 insert into public.app_notifications(user_id,app_variant,kind,title,body,dedupe_key,booking_id,event_id,message_id)
 values(p_user,p_variant,p_kind,p_title,p_body,p_key,p_booking,p_event,p_message)
 on conflict(user_id,app_variant,dedupe_key) do nothing returning id into notification;
 if notification is null then return; end if;
 insert into private.notification_deliveries(notification_id,device_id)
 select notification,d.id from private.notification_devices d
 left join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
 where d.user_id=p_user and d.app_variant=p_variant and d.updated_at>now()-interval '60 days'
 and coalesce(p.push_enabled,false) and (p_kind<>'message' or coalesce(p.messages_enabled,true))
 and (p_kind not like 'event%' or coalesce(p.events_enabled,true));
end; $$;

create function private.booking_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; variant text; label text;
begin
 if tg_op='INSERT' then
  perform private.notify_circle(new.professional_id,'professional','booking','New booking request','Open Circle to review the request.','request:'||new.id,new.id);
  perform private.notify_circle(new.client_id,'customer','booking','Booking request sent','We will notify you when the professional responds.','request:'||new.id,new.id);
 end if;
 if tg_op='INSERT' or new.status is distinct from old.status then
  label:=case new.status when 'accepted' then 'Booking accepted' when 'en_route' then 'Your professional is on the way' when 'arrived' then 'Your professional has arrived' when 'completed' then 'Service completed' when 'declined' then 'Booking declined' when 'cancelled' then 'Booking cancelled' else null end;
  if label is not null then
   perform private.notify_circle(new.client_id,'customer','booking',label,case when new.status='arrived' then 'Open your booking for the start-service code.' when new.status='completed' and new.paid_at is null then 'Open your booking to check the final bill and payment.' when new.status='completed' then 'Share a rating and review for your professional.' else 'Open your booking for the latest details.' end,'status:'||new.id||':'||new.status,new.id);
   if new.status in ('accepted','cancelled','declined','completed') then
    perform private.notify_circle(new.professional_id,'professional','booking',label,'Open your job for the latest details.','status:'||new.id||':'||new.status,new.id);
   end if;
  end if;
 end if;
 if tg_op='UPDATE' then
  if old.paid_at is null and new.paid_at is not null then
   perform private.notify_circle(new.client_id,'customer','payment','Payment confirmed','Your payment has been confirmed. Open your booking.','payment:'||new.id,new.id);
   perform private.notify_circle(new.professional_id,'professional','payment','Booking payment confirmed','Open your job for the next step and your earnings.','payment:'||new.id,new.id);
  end if;
  if old.service_started_at is null and new.service_started_at is not null then
   perform private.notify_circle(new.client_id,'customer','service','Service started','The start-service code has been verified.','start:'||new.id,new.id);
   perform private.notify_circle(new.professional_id,'professional','service','Service started','The start-service code has been verified.','start:'||new.id,new.id);
  end if;
  if old.completion_requested_at is null and new.completion_requested_at is not null then
   perform private.notify_circle(new.client_id,'customer','service','Confirm service completion','Open your booking for the end-service code. Share it only when the service is finished.','end-request:'||new.id,new.id);
  end if;
 end if;
 return new;
end; $$;
create trigger circle_booking_notification after insert or update on public.bookings for each row execute function private.booking_notification();

create function private.message_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=new.booking_id;
 if b.paid_at is not null and b.service_ended_at is null and b.status in ('accepted','en_route','arrived') then
  perform private.notify_circle(case when new.sender_id=b.client_id then b.professional_id else b.client_id end,
   case when new.sender_id=b.client_id then 'professional' else 'customer' end,'message','New booking message','Open your active booking to read the message.','message:'||new.id,b.id,null,new.id);
 end if;
 return new;
end; $$;
create trigger circle_message_notification after insert on public.messages for each row execute function private.message_notification();

create function private.event_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare e private.team_events; person record;
begin
 if tg_table_name='team_roles' then
  select * into e from private.team_events where id=new.event_id;
  for person in select p.id from public.professionals p where p.category=new.category and p.is_published and p.id<>e.client_id
   and abs(p.latitude-e.latitude)<0.45 and abs(p.longitude-e.longitude)<0.45 order by p.id limit 100 loop
   perform private.notify_circle(person.id,'professional','event','New event opportunity','A nearby event is looking for your craft. Open Events to review it.','event:'||e.id,null,e.id);
  end loop;
 elsif tg_op='INSERT' then
  select * into e from private.team_events where id=new.event_id;
  perform private.notify_circle(e.client_id,'customer','event','New event application','A professional has applied. Review their portfolio and service rates.','application:'||new.id,null,e.id);
 elsif tg_op='UPDATE' and old.booking_id is null and new.booking_id is not null then
  perform private.notify_circle(new.professional_id,'professional','event','You have been selected','Open your booking to review the event job.','selected:'||new.id,new.booking_id,new.event_id);
 end if;
 return new;
end; $$;
create trigger circle_event_role after insert on private.team_roles for each row execute function private.event_notification();
create trigger circle_event_application after insert or update on private.team_applications for each row execute function private.event_notification();

create function private.review_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=new.booking_id;
 perform private.notify_circle(b.professional_id,'professional','review','New rating and review','A customer has reviewed your completed service.','review:'||new.booking_id,b.id);
 return new;
end; $$;
create trigger circle_review after insert on public.booking_reviews for each row execute function private.review_notification();

create function private.finance_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.bookings; variant text; recipient uuid; label text;
begin
 if tg_op='UPDATE' and old.status=new.status then return new; end if;
 select * into b from public.bookings where id=new.booking_id;
 if tg_table_name='refund_requests' then
  recipient:=b.client_id; variant:='customer';
  label:=case new.status when 'pending' then 'Refund requested' when 'processing' then 'Refund processing' when 'refunded' then 'Refund confirmed' when 'failed' then 'Refund needs attention' else null end;
 else
  recipient:=b.professional_id; variant:='professional';
  label:=case new.status when 'paid' then 'Earnings transfer confirmed' when 'failed' then 'Earnings transfer needs attention' else null end;
 end if;
 if label is not null then perform private.notify_circle(recipient,variant,'payment',label,'Open your booking for the latest payment status.',tg_table_name||':'||new.booking_id||':'||new.status,b.id); end if;
 return new;
end; $$;
create trigger circle_refund after insert or update on public.refund_requests for each row execute function private.finance_notification();
create trigger circle_payout after insert or update on public.payout_jobs for each row execute function private.finance_notification();

create function private.portfolio_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('complete','failed') and old.status is distinct from new.status then
  perform private.notify_circle(new.professional_id,'professional','portfolio',case when new.status='complete' then 'Portfolio import complete' else 'Portfolio connection needs attention' end,'Open your professional portfolio to review the result.','portfolio:'||new.id||':'||new.status);
 end if;
 return new;
end; $$;
create trigger circle_portfolio after update on public.portfolio_imports for each row execute function private.portfolio_notification();

-- Invoked by the server scheduler, never by a customer/professional client.
create function public.queue_booking_reminders() returns void
language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 delete from public.app_notifications where created_at<now()-interval '30 days';
 for b in select * from public.bookings where status='accepted' and starts_at>now() and starts_at<=now()+interval '1 hour' loop
  perform private.notify_circle(b.client_id,'customer','reminder','Your booking starts soon','Your scheduled service starts within an hour. Open your booking to review the details.','reminder:'||b.id,b.id);
  perform private.notify_circle(b.professional_id,'professional','reminder','Your job starts soon','Your scheduled job starts within an hour. Open the job to prepare.','reminder:'||b.id,b.id);
 end loop;
end; $$;

-- Only the authenticated server worker can claim delivery work. Leases survive restarts.
create function public.claim_notification_deliveries() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 delete from public.app_notifications where created_at<now()-interval '30 days';
 update private.notification_deliveries j set state='failed'
 where j.state in ('pending','sending') and (j.attempts>=5 or not exists(
  select 1 from public.app_notifications n join private.notification_devices d on d.id=j.device_id
  left join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
  where n.id=j.notification_id and n.user_id=d.user_id and n.app_variant=d.app_variant
  and n.created_at>now()-interval '1 day' and n.read_at is null and coalesce(p.push_enabled,false)
  and (n.kind<>'message' or coalesce(p.messages_enabled,true)) and (n.kind not like 'event%' or coalesce(p.events_enabled,true))));
 with picked as (
  select id from private.notification_deliveries where (state='pending' and next_attempt_at<=now()) or (state='sending' and lease_until<now())
  order by next_attempt_at for update skip locked limit 50
 ), claimed as (
  update private.notification_deliveries j set state='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes'
  from picked where j.id=picked.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'attempt',j.attempts,'token',d.token,'notification_id',n.id,'variant',n.app_variant,'title',n.title)),'[]'::jsonb)
 into result from claimed j join private.notification_devices d on d.id=j.device_id join public.app_notifications n on n.id=j.notification_id;
 return result;
end; $$;
create function public.finish_notification_delivery(p_id uuid,p_attempt integer,p_result text) returns void
language plpgsql security definer set search_path='' as $$
declare device uuid;
begin
 if p_result not in ('sent','retry','invalid','failed') then raise exception 'Invalid delivery result'; end if;
 update private.notification_deliveries set state=case when p_result='sent' then 'sent' when p_result='retry' and attempts<5 then 'pending' else 'failed' end,
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),lease_until=null
 where id=p_id and attempts=p_attempt and state='sending' returning device_id into device;
 if p_result='invalid' and device is not null then delete from private.notification_devices where id=device; end if;
end; $$;
revoke all on function private.notify_circle(uuid,text,text,text,text,text,uuid,uuid,uuid),private.booking_notification(),private.message_notification(),private.event_notification(),private.review_notification(),private.finance_notification(),private.portfolio_notification() from public,anon,authenticated;
revoke all on function public.claim_notification_deliveries(),public.finish_notification_delivery(uuid,integer,text),public.queue_booking_reminders() from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries(),public.finish_notification_delivery(uuid,integer,text),public.queue_booking_reminders() to service_role;
notify pgrst,'reload schema';
