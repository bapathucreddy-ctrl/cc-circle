-- available_now remains the professional's online preference. Effective availability
-- is computed from bookings/blocks under security definer, because customers
-- must not read another customer's private booking to discover a busy provider.
create function private.professional_busy(p_id uuid,p_start timestamptz,p_end timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.availability_blocks a where a.professional_id=p_id
    and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_start,p_end,'[)'))
  or exists(select 1 from public.bookings b where b.professional_id=p_id
    and b.status in ('requested','accepted','en_route','arrived') and (
      tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_start,p_end,'[)')
      or (p_start<now()+interval '15 minutes' and (
        b.status in ('en_route','arrived') or (b.status='accepted' and b.starts_at<=now())
      ))
    ));
$$;
revoke all on function private.professional_busy(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function private.professional_busy(uuid,timestamptz,timestamptz) to authenticated;

create function public.professional_availability(p_professional_id uuid,p_duration_minutes integer default 15)
returns table(available_now boolean,is_online boolean,is_busy boolean)
language sql stable security invoker set search_path = '' as $$
  select p.is_published and p.available_now and not b.busy,p.available_now,b.busy
  from public.professionals p cross join lateral (
    select private.professional_busy(p.id,now(),now()+make_interval(mins=>least(1440,greatest(15,p_duration_minutes)))) as busy
  ) b where p.id=p_professional_id;
$$;
revoke all on function public.professional_availability(uuid,integer) from public,anon;
grant execute on function public.professional_availability(uuid,integer) to authenticated;

create or replace function public.discover_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer)
language sql stable security invoker set search_path = '' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,(p.available_now and not private.professional_busy(p.id,now(),now()+interval '15 minutes')),p.longitude,p.latitude,p.portfolio_urls,d.km,q.total_paise
  from public.professionals p cross join lateral (
    select 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(p.latitude::double precision-p_latitude)/2),2) +
      cos(radians(p_latitude))*cos(radians(p.latitude::double precision))*power(sin(radians(p.longitude::double precision-p_longitude)/2),2)
    )))) as km
  ) d join lateral (select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
  cross join lateral private.booking_pricing(s.net) q
  where p.is_published and p.category=p_category and (not p_available_now or (p.available_now and not private.professional_busy(p.id,now(),now()+interval '15 minutes')))
    and p_latitude between -90 and 90 and p_longitude between -180 and 180
    and d.km <= least(greatest(p_radius_km,1),50)
    and (p_query='' or position(lower(left(p_query,100)) in lower(p.display_name||' '||array_to_string(p.specialties,' ')))>0)
  order by d.km,p.id limit 100;
$$;

create or replace function public.request_booking(p_service_id uuid, p_starts_at timestamptz, p_venue text, p_longitude double precision,
  p_latitude double precision, p_notes text, p_request_id uuid,p_expected_total_paise integer)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare s public.services; p public.professionals; b public.bookings; finish timestamptz; fees record;
begin
  if auth.uid() is null then raise exception 'Sign in to request a booking'; end if;
  select * into b from public.bookings where client_id=auth.uid() and request_id=p_request_id;
  if found then return b; end if;
  select * into s from public.services where id=p_service_id and active for share;
  if not found then raise exception 'Service is unavailable'; end if;
  select * into p from public.professionals where id=s.professional_id and is_published for update;
  if not found or p.id=auth.uid() then raise exception 'Professional is unavailable'; end if;
  -- Recheck idempotency after taking the professional lock.
  select * into b from public.bookings where client_id=auth.uid() and request_id=p_request_id;
  if found then return b; end if;
  if p_starts_at < now()-interval '2 minutes' or p_starts_at > now()+interval '1 year' then raise exception 'Choose a valid booking time'; end if;
  if p_starts_at < now()+interval '15 minutes' and not p.available_now then raise exception 'This professional requires a scheduled booking'; end if;
  if (select count(*) from public.bookings where client_id=auth.uid() and status='requested')>=10 then raise exception 'You have too many pending requests'; end if;
  finish := p_starts_at + make_interval(mins=>s.duration_minutes);
  if exists(select 1 from public.availability_blocks where professional_id=p.id and tstzrange(starts_at,ends_at,'[)') && tstzrange(p_starts_at,finish,'[)')) then raise exception 'This time is unavailable'; end if;
  if exists(select 1 from public.bookings where professional_id=p.id and status in ('requested','accepted','en_route','arrived') and tstzrange(starts_at,ends_at,'[)') && tstzrange(p_starts_at,finish,'[)')) then raise exception 'This professional already has a booking at that time'; end if;
  if private.professional_busy(p.id,p_starts_at,finish) then raise exception 'This professional is busy or unavailable for that time. Choose another time or professional.'; end if;
  select * into fees from private.booking_pricing(s.amount_paise);
  if p_expected_total_paise is null or p_expected_total_paise<>fees.total_paise then raise exception 'The booking price has changed. Reopen the service to review the latest price.'; end if;
  insert into public.bookings(client_id,professional_id,service_id,request_id,service_name,amount_paise,
    service_amount_paise,buyer_fee_paise,talent_fee_paise,talent_payout_paise,starts_at,ends_at,venue,venue_longitude,venue_latitude,notes)
    values(auth.uid(),p.id,s.id,p_request_id,s.name,fees.total_paise,fees.service_amount_paise,fees.buyer_fee_paise,fees.talent_fee_paise,fees.talent_payout_paise,
      p_starts_at,finish,trim(p_venue),p_longitude,p_latitude,trim(p_notes)) returning * into b;
  return b;
end;
$$;
