-- Keep arrived jobs busy until the customer confirms both service boundaries.
alter table public.bookings add column service_started_at timestamptz,
  add column completion_requested_at timestamptz,
  add column service_ended_at timestamptz;

create table private.service_otps (
  booking_id uuid not null references public.bookings on delete cascade,
  phase text not null check (phase in ('start','end')),
  code text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  primary key(booking_id,phase)
);
alter table private.service_otps enable row level security;
revoke all on private.service_otps from public,anon,authenticated;

-- Preserve cancellation/refund and payment logic, but remove direct completion.
alter function public.transition_booking(uuid,public.booking_status) set schema private;
revoke all on function private.transition_booking(uuid,public.booking_status) from public,anon,authenticated;
create function public.transition_booking(p_booking_id uuid,p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path='' as $$
begin
  if p_status='completed' then raise exception 'Complete service using the customer end OTP'; end if;
  return private.transition_booking(p_booking_id,p_status);
end;
$$;
revoke all on function public.transition_booking(uuid,public.booking_status) from public,anon;
grant execute on function public.transition_booking(uuid,public.booking_status) to authenticated;

-- Only the customer can retrieve a code. Nothing is sent through chat or booking rows.
create function public.service_otp(p_booking_id uuid,p_phase text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings; o private.service_otps;
begin
  select * into b from public.bookings where id=p_booking_id and client_id=auth.uid() for update;
  if not found then raise exception 'Customer booking not found'; end if;
  if b.status<>'arrived' or b.paid_at is null or
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

create function public.service_action(p_booking_id uuid,p_action text,p_code text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.bookings; o private.service_otps; v_phase text;
begin
  select * into b from public.bookings where id=p_booking_id and professional_id=auth.uid() for update;
  if not found then raise exception 'Professional booking not found'; end if;
  if b.status<>'arrived' or b.paid_at is null then raise exception 'A paid, arrived booking is required'; end if;
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
    update public.bookings set service_ended_at=now() where id=b.id;
    perform private.transition_booking(b.id,'completed');
    delete from private.service_otps where booking_id=b.id;
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.service_action(uuid,text,text) from public,anon;
grant execute on function public.service_action(uuid,text,text) to authenticated;

create or replace function public.share_booking_location(p_booking_id uuid,p_longitude double precision,p_latitude double precision,p_heading double precision default null)
returns void language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and professional_id=auth.uid()
    and status in ('en_route','arrived') and service_started_at is null for share;
  if not found then raise exception 'Location sharing requires an active journey'; end if;
  insert into public.booking_locations(booking_id,longitude,latitude,heading) values(p_booking_id,p_longitude,p_latitude,p_heading)
  on conflict(booking_id) do update set longitude=excluded.longitude,latitude=excluded.latitude,heading=excluded.heading,updated_at=now();
end;
$$;
