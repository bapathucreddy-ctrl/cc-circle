-- Booking availability must not depend on GPS permission or freshness.
create or replace function public.discover_live_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer,location_updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,(p.available_now and not private.professional_busy(p.id,now(),now()+interval '15 minutes')),coalesce(l.longitude,p.longitude)::numeric,coalesce(l.latitude,p.latitude)::numeric,p.portfolio_urls,d.km,q.total_paise,l.updated_at
  from public.professionals p left join private.professional_live_locations l on l.professional_id=p.id and l.updated_at>now()-interval '90 seconds' and p.available_now and not private.professional_busy(p.id,now(),now()+interval '15 minutes')
 cross join lateral (
    select 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(coalesce(l.latitude,p.latitude)::double precision-p_latitude)/2),2) +
      cos(radians(p_latitude))*cos(radians(coalesce(l.latitude,p.latitude)::double precision))*power(sin(radians(coalesce(l.longitude,p.longitude)::double precision-p_longitude)/2),2)
    )))) as km
  ) d join lateral (select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
  cross join lateral private.booking_pricing(s.net) q
  where auth.uid() is not null and p.is_published and p.category=p_category and (not p_available_now or (p.available_now and not private.professional_busy(p.id,now(),now()+interval '15 minutes')))
    and p_latitude between -90 and 90 and p_longitude between -180 and 180
    and d.km <= least(greatest(p_radius_km,1),50)
    and (p_query='' or position(lower(left(p_query,100)) in lower(p.display_name||' '||array_to_string(p.specialties,' ')))>0)
  order by d.km,p.id limit 100;
$$;

revoke all on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) from public,anon;
grant execute on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) to authenticated;
notify pgrst, 'reload schema';
