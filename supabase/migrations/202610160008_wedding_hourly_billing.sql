-- Wedding totals are finalized only after customer end-OTP verification.
alter table private.team_events add column billing_mode text not null default 'fixed' check(billing_mode in ('fixed','hourly')),
 add column planned_hours integer not null default 8 check(planned_hours between 1 and 24);
alter table public.bookings add column billing_mode text not null default 'fixed' check(billing_mode in ('fixed','hourly')),
 add column hourly_net_paise integer check(hourly_net_paise between 10000 and 100000000 and hourly_net_paise%100=0),
 add column hourly_rate_paise integer,add column billable_hours integer check(billable_hours>=1),
 add column billing_finalised_at timestamptz;
alter table public.bookings add constraint hourly_booking_rates check(billing_mode='fixed' or (hourly_net_paise is not null and hourly_rate_paise is not null and hourly_rate_paise>=hourly_net_paise));

create function private.service_billable_hours(p_start timestamptz,p_end timestamptz) returns integer
language plpgsql immutable strict set search_path='' as $$
begin
 if p_end<p_start then raise exception 'Service end cannot precede its start';end if;
 return greatest(1,ceil(extract(epoch from (p_end-p_start))/3600)::integer);
end;$$;
revoke all on function private.service_billable_hours(timestamptz,timestamptz) from public,anon,authenticated;

create function private.hourly_booking_price(p_net integer,p_rate integer,p_hours integer)
returns table(service_amount_paise integer,buyer_fee_paise integer,talent_fee_paise integer,talent_payout_paise integer,total_paise integer)
language plpgsql immutable set search_path='' as $$
declare subtotal bigint:=p_rate::bigint*p_hours; net bigint:=p_net::bigint*p_hours; fee bigint;
begin
 if p_hours<1 or p_net<10000 or p_rate<p_net then raise exception 'Invalid hourly bill';end if;
 fee:=least(29900,greatest(4900,round(subtotal::numeric/100*.03)::bigint*100));
 if subtotal+fee>2147483647 or net>2147483647 then raise exception 'Hourly invoice exceeds the supported payment limit';end if;
 return query select subtotal::integer,fee::integer,(subtotal-net)::integer,net::integer,(subtotal+fee)::integer;
end;
$$;
revoke all on function private.hourly_booking_price(integer,integer,integer) from public,anon,authenticated;

alter function public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid) set schema private;
alter function private.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid) rename to create_fixed_team_request;
revoke all on function private.create_fixed_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid) from public,anon,authenticated;
create function public.create_team_request(p_title text,p_requirements text,p_starts_at timestamptz,p_venue text,p_longitude double precision,p_latitude double precision,p_roles jsonb,p_request_id uuid,p_billing_mode text default 'fixed',p_planned_hours integer default 8)
returns uuid language plpgsql security definer set search_path='' as $$
declare event_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to post a team request';end if;
 if p_billing_mode is null or p_billing_mode not in ('fixed','hourly') or p_planned_hours is null or p_planned_hours not between 1 and 24 then raise exception 'Choose valid event billing and planned hours';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select id into event_id from private.team_events where client_id=auth.uid() and request_id=p_request_id;
 if found then return event_id;end if;
 event_id:=private.create_fixed_team_request(p_title,p_requirements,p_starts_at,p_venue,p_longitude,p_latitude,p_roles,p_request_id);
 update private.team_events set billing_mode=p_billing_mode,planned_hours=p_planned_hours where id=event_id;
 return event_id;
end;
$$;
revoke all on function public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid,text,integer) from public,anon;
grant execute on function public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid,text,integer) to authenticated;

create or replace function public.team_requests() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(event order by created_at desc),'[]'::jsonb) from (
    select e.created_at,jsonb_build_object('id',e.id,'title',e.title,'requirements',e.requirements,
      'billing_mode',e.billing_mode,'planned_hours',e.planned_hours,'starts_at',e.starts_at,'venue',e.venue,'is_owner',e.client_id=auth.uid(),
      'roles',(select jsonb_agg(jsonb_build_object('category',r.category,'quantity',r.quantity,
        'selected',private.team_selected(e.id,r.category)) order by r.category) from private.team_roles r where r.event_id=e.id),
      'my_application',(select jsonb_build_object('id',a.id,'service_name',a.service_name,'net_paise',a.net_paise,
        'booking_id',a.booking_id,'booking_status',b.status) from private.team_applications a
        left join public.bookings b on b.id=a.booking_id where a.event_id=e.id and a.professional_id=auth.uid())) as event
    from private.team_events e where e.client_id=auth.uid() or (e.starts_at>now() and exists(
      select 1 from public.professionals p join private.team_roles r on r.category=p.category
      where p.id=auth.uid() and p.is_published and r.event_id=e.id))
    order by e.created_at desc limit 100
  ) events;
$$;

drop function public.apply_team_request(uuid,uuid,text);
create function public.apply_team_request(p_event_id uuid,p_service_id uuid,p_message text default '',p_hourly_net_paise integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare e private.team_events; p public.professionals; s public.services; a private.team_applications; fees record; needed integer; quote_net integer; quote_minutes integer;
begin
  select * into e from private.team_events where id=p_event_id for update;
  if not found or e.client_id=auth.uid() or e.starts_at<=now() then raise exception 'This team request is unavailable'; end if;
  select * into p from public.professionals where id=auth.uid() and is_published;
  if not found then raise exception 'Publish your professional profile before applying'; end if;
  select quantity into needed from private.team_roles where event_id=e.id and category=p.category;
  if not found then raise exception 'This event does not need your profession'; end if;
  select * into a from private.team_applications where event_id=e.id and professional_id=p.id;
  if found then return a.id; end if;
  if private.team_selected(e.id,p.category)>=needed then raise exception 'This profession is already filled'; end if;
  select * into s from public.services where id=p_service_id and professional_id=p.id and active for share;
  if not found then raise exception 'Choose one of your active services'; end if;
  quote_net:=case when e.billing_mode='hourly' then p_hourly_net_paise else s.amount_paise end;
  quote_minutes:=case when e.billing_mode='hourly' then e.planned_hours*60 else s.duration_minutes end;
  if quote_net is null or quote_net not between 10000 and 100000000 or quote_net%100<>0 then raise exception 'Enter a whole-rupee hourly net rate from 100 to 1000000';end if;
  if private.professional_busy(p.id,e.starts_at,e.starts_at+make_interval(mins=>quote_minutes)) then raise exception 'You are unavailable at this event time'; end if;
  select * into fees from private.booking_pricing(quote_net);
  insert into private.team_applications(event_id,professional_id,category,service_id,service_name,duration_minutes,net_paise,total_paise,message)
    values(e.id,p.id,p.category,s.id,s.name,quote_minutes,quote_net,case when e.billing_mode='hourly' then fees.service_amount_paise else fees.total_paise end,trim(coalesce(p_message,''))) returning id into a.id;
  return a.id;
end;
$$;
revoke all on function public.apply_team_request(uuid,uuid,text,integer) from public,anon;
grant execute on function public.apply_team_request(uuid,uuid,text,integer) to authenticated;

create or replace function public.team_applicants(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not exists(select 1 from private.team_events where id=p_event_id and client_id=auth.uid()) then raise exception 'Customer event not found'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'professional_id',a.professional_id,
    'professional_name',p.display_name,'category',a.category,'bio',p.bio,'city',p.city,
    'service_name',a.service_name,'duration_minutes',a.duration_minutes,'total_paise',a.total_paise,
    'message',a.message,'booking_id',a.booking_id,'booking_status',b.status) order by a.created_at),'[]'::jsonb)
    from private.team_applications a join public.professionals p on p.id=a.professional_id
    left join public.bookings b on b.id=a.booking_id where a.event_id=p_event_id);
end;
$$;

create or replace function public.accept_team_applicant(p_application_id uuid,p_expected_total_paise integer)
returns public.bookings language plpgsql security definer set search_path='' as $$
declare e private.team_events; a private.team_applications; b public.bookings; s public.services; needed integer; fees record;
begin
  select e1.* into e from private.team_events e1 join private.team_applications a1 on a1.event_id=e1.id
    where a1.id=p_application_id and e1.client_id=auth.uid() for update of e1;
  if not found then raise exception 'Customer application not found'; end if;
  select * into a from private.team_applications where id=p_application_id for update;
  if a.booking_id is not null then select * into b from public.bookings where id=a.booking_id; return b; end if;
  if e.starts_at<=now() then raise exception 'This event has already started'; end if;
  select quantity into needed from private.team_roles where event_id=e.id and category=a.category;
  if private.team_selected(e.id,a.category)>=needed then raise exception 'The requested headcount is already filled'; end if;
  select * into s from public.services where id=a.service_id and active for share;
  if not found or (e.billing_mode='fixed' and (s.amount_paise<>a.net_paise or s.duration_minutes<>a.duration_minutes)) or s.name<>a.service_name then
    raise exception 'This service has changed. Ask the professional for a new application'; end if;
  perform 1 from public.professionals where id=a.professional_id and is_published and category=a.category for update;
  if not found then raise exception 'Professional is no longer available for this role'; end if;
  if p_expected_total_paise is null or p_expected_total_paise<>a.total_paise then raise exception 'Review the latest application price before accepting'; end if;
  if e.billing_mode='hourly' and private.professional_busy(a.professional_id,e.starts_at,e.starts_at+make_interval(mins=>a.duration_minutes)) then raise exception 'This professional is unavailable for the planned event hours';end if;
  select * into fees from private.booking_pricing(s.amount_paise);
  b:=public.request_booking(a.service_id,e.starts_at,e.venue,e.longitude,e.latitude,
    left(e.title||E'\n'||e.requirements,2000),a.id,case when e.billing_mode='hourly' then fees.total_paise else a.total_paise end);
  if e.billing_mode='hourly' then
    select * into fees from private.hourly_booking_price(a.net_paise,a.total_paise,1);
    update public.bookings set billing_mode='hourly',hourly_net_paise=a.net_paise,hourly_rate_paise=a.total_paise,
      ends_at=starts_at+make_interval(mins=>a.duration_minutes),amount_paise=fees.total_paise,
      service_amount_paise=fees.service_amount_paise,buyer_fee_paise=fees.buyer_fee_paise,
      talent_fee_paise=fees.talent_fee_paise,talent_payout_paise=fees.talent_payout_paise where id=b.id;
  end if;
  update public.bookings set status='accepted' where id=b.id returning * into b;
  update private.team_applications set booking_id=b.id where id=a.id;
  return b;
end;
$$;

create or replace function private.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status=p_status then return b; end if;
  perform 1 from public.professionals where id=b.professional_id for update;
  if p_status='en_route' and exists(select 1 from public.bookings other
    where other.professional_id=b.professional_id and other.id<>b.id
      and other.status in ('en_route','arrived')) then
    raise exception 'Finish your current active job before starting another journey';
  end if;
  if p_status='cancelled' then
    if b.status not in ('requested','accepted') then raise exception 'This booking cannot be cancelled'; end if;
  elsif b.professional_id<>auth.uid() then raise exception 'Only the professional can update this status';
  elsif not ((b.status='requested' and p_status in ('accepted','declined')) or
    (b.status='accepted' and p_status='en_route') or
    (b.status='en_route' and p_status='arrived') or
    (b.status='arrived' and p_status='completed')) then raise exception 'Invalid booking transition'; end if;
  if p_status in ('en_route','arrived','completed') and b.paid_at is null and b.billing_mode<>'hourly' then
    raise exception 'Verified payment is required before the journey and service';
  end if;
  if p_status='accepted' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then raise exception 'This time has been marked unavailable'; end if;
  if p_status='completed' and b.billing_mode='hourly' and b.billing_finalised_at is null then raise exception 'Verify the end OTP to finalize the hourly invoice';end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  if p_status='cancelled' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status='refund_requested' where booking_id=b.id;
  end if;
  if p_status in ('completed','cancelled','declined') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;

create or replace function public.service_otp(p_booking_id uuid,p_phase text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings; o private.service_otps;
begin
  select * into b from public.bookings where id=p_booking_id and client_id=auth.uid() for update;
  if not found then raise exception 'Customer booking not found'; end if;
  if b.status<>'arrived' or (b.paid_at is null and b.billing_mode<>'hourly') or
    not ((p_phase='start' and b.service_started_at is null) or
      (p_phase='end' and b.service_started_at is not null and b.completion_requested_at is not null)) then
    raise exception 'This service code is not available yet';
  end if;
  select * into o from private.service_otps where booking_id=b.id and phase=p_phase;
  if not found or o.expires_at<=now() then
    -- gen_random_uuid uses PostgreSQL's cryptographic random source.
    insert into private.service_otps(booking_id,phase,code,expires_at)
    values(b.id,p_phase,lpad((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 1000000)::text,6,'0'),now()+interval '10 minutes')
    on conflict(booking_id,phase) do update set code=excluded.code,expires_at=excluded.expires_at,attempts=0
    returning * into o;
  end if;
  return jsonb_build_object('code',case when o.attempts<5 then o.code else null end,
    'expires_at',o.expires_at,'locked',o.attempts>=5);
end;
$$;
revoke all on function public.service_otp(uuid,text) from public,anon;
grant execute on function public.service_otp(uuid,text) to authenticated;

create or replace function public.service_action(p_booking_id uuid,p_action text,p_code text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings; o private.service_otps; v_phase text; hours integer; fees record;
begin
  select * into b from public.bookings where id=p_booking_id and professional_id=auth.uid() for update;
  if not found then raise exception 'Professional booking not found'; end if;
  if b.status<>'arrived' or (b.paid_at is null and b.billing_mode<>'hourly') then raise exception 'A paid, arrived booking is required'; end if;
  if p_action='request_completion' then
    if b.service_started_at is null then raise exception 'Verify the start OTP first'; end if;
    update public.bookings set completion_requested_at=coalesce(completion_requested_at,now()) where id=b.id;
    return jsonb_build_object('ok',true);
  end if;
  v_phase:=case p_action when 'start' then 'start' when 'end' then 'end' else null end;
  if v_phase is null then raise exception 'Invalid service action'; end if;
  if (v_phase='start' and b.service_started_at is not null) or
    (v_phase='end' and (b.service_started_at is null or b.completion_requested_at is null)) then
    raise exception 'Invalid service stage';
  end if;
  select * into o from private.service_otps where booking_id=b.id and service_otps.phase=v_phase for update;
  if not found or o.expires_at<=now() then return jsonb_build_object('ok',false,'message','Code expired or unavailable. Ask the customer to refresh their code.'); end if;
  if o.attempts>=5 then return jsonb_build_object('ok',false,'message','Too many attempts. Wait until the code expires, then ask the customer for a new code.'); end if;
  -- Return failures, rather than raising: failed-attempt counters must commit.
  if p_code is null or p_code !~ '^[0-9]{6}$' or p_code<>o.code then
    update private.service_otps set attempts=attempts+1 where booking_id=b.id and service_otps.phase=v_phase;
    return jsonb_build_object('ok',false,'message','Incorrect OTP. Check the six digits with the customer.');
  end if;
  delete from private.service_otps where booking_id=b.id and service_otps.phase=v_phase;
  if v_phase='start' then
    update public.bookings set service_started_at=now() where id=b.id;
    delete from public.booking_locations where booking_id=b.id;
  else
    if b.billing_mode='hourly' then
      hours:=private.service_billable_hours(b.service_started_at,now());
      select * into fees from private.hourly_booking_price(b.hourly_net_paise,b.hourly_rate_paise,hours);
      update public.bookings set service_ended_at=now(),billable_hours=hours,billing_finalised_at=now(),
        amount_paise=fees.total_paise,service_amount_paise=fees.service_amount_paise,buyer_fee_paise=fees.buyer_fee_paise,
        talent_fee_paise=fees.talent_fee_paise,talent_payout_paise=fees.talent_payout_paise where id=b.id;
    else update public.bookings set service_ended_at=now() where id=b.id;end if;
    perform private.transition_booking(b.id,'completed');
    delete from private.service_otps where booking_id=b.id;
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.service_action(uuid,text,text) from public,anon;
grant execute on function public.service_action(uuid,text,text) to authenticated;


create or replace function public.booking_activity() returns setof public.bookings
language sql stable security definer set search_path='' as $$
  select b.* from public.bookings b where b.client_id=auth.uid() and (
    b.status in ('requested','accepted','en_route','arrived') or
    (b.status='completed' and ((b.billing_mode='hourly' and b.paid_at is null) or not exists(select 1 from public.booking_reviews r where r.booking_id=b.id)))
  ) order by case b.status when 'en_route' then 0 when 'arrived' then 0 when 'accepted' then 1 when 'requested' then 2 else 3 end,
    case when b.status<>'completed' then b.starts_at end asc,
    case when b.status='completed' then b.created_at end desc,b.id limit 1;
$$;
revoke all on function public.booking_activity() from public,anon;
grant execute on function public.booking_activity() to authenticated;


create function private.guard_hourly_payment_order() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=new.booking_id for update;
 if b.billing_mode='hourly' and (b.status<>'completed' or b.billing_finalised_at is null or new.amount_paise<>b.amount_paise) then raise exception 'Hourly payments require the completed final invoice';end if;
 return new;
end;$$;
revoke all on function private.guard_hourly_payment_order() from public,anon,authenticated;
create trigger guard_hourly_payment_order before insert or update of amount_paise on public.payment_orders for each row execute function private.guard_hourly_payment_order();
create function private.guard_hourly_invoice() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.billing_mode='hourly' and old.billing_finalised_at is not null and
 (new.billing_mode,new.hourly_net_paise,new.hourly_rate_paise,new.billable_hours,new.billing_finalised_at,new.service_started_at,new.service_ended_at,new.amount_paise,new.service_amount_paise,new.buyer_fee_paise,new.talent_fee_paise,new.talent_payout_paise)
 is distinct from (old.billing_mode,old.hourly_net_paise,old.hourly_rate_paise,old.billable_hours,old.billing_finalised_at,old.service_started_at,old.service_ended_at,old.amount_paise,old.service_amount_paise,old.buyer_fee_paise,old.talent_fee_paise,old.talent_payout_paise) then raise exception 'The final hourly invoice cannot be changed';end if;
 return new;
end;$$;
revoke all on function private.guard_hourly_invoice() from public,anon,authenticated;
create trigger guard_hourly_invoice before update on public.bookings for each row execute function private.guard_hourly_invoice();
create function private.guard_hourly_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.bookings where id=new.booking_id and billing_mode='hourly' and paid_at is null) then raise exception 'Settle your final invoice before reviewing';end if;
 return new;
end;$$;
revoke all on function private.guard_hourly_review() from public,anon,authenticated;
create trigger guard_hourly_review before insert on public.booking_reviews for each row execute function private.guard_hourly_review();
notify pgrst,'reload schema';
