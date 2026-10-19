-- Apply to a new Supabase project. Currency amounts are integer paise.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set search_path = public, extensions;
create schema if not exists private;

create type public.talent_category as enum ('Makeup','Actor','Photographer','Editor','Dancer');
create type public.booking_status as enum ('requested','accepted','en_route','arrived','completed','declined','cancelled');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '' check (length(display_name) <= 120),
  created_at timestamptz not null default now()
);
create table public.professionals (
  id uuid primary key references public.profiles on delete cascade,
  display_name text not null check (length(display_name) between 2 and 120),
  category public.talent_category not null,
  city text not null check (length(city) between 2 and 120),
  bio text not null check (length(bio) between 20 and 1000),
  specialties text[] not null default '{}',
  longitude numeric(7,3) not null check (longitude between -180 and 180),
  latitude numeric(6,3) not null check (latitude between -90 and 90),
  available_now boolean not null default false,
  is_published boolean not null default false,
  verified_at timestamptz,
  portfolio_urls text[] not null default '{}',
  public_specs jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (cardinality(portfolio_urls) <= 20),
  check (cardinality(specialties) <= 30)
);
create table public.professional_private_details (
  professional_id uuid primary key references public.professionals on delete cascade,
  details jsonb not null default '{}',
  portfolio_consent_at timestamptz,
  updated_at timestamptz not null default now(),
  check (octet_length(details::text) <= 65536)
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals on delete cascade,
  name text not null check (length(name) between 2 and 120),
  description text not null default '' check (length(description) <= 1000),
  amount_paise integer not null check (amount_paise between 10000 and 100000000 and amount_paise%100=0),
  duration_minutes integer not null check (duration_minutes between 15 and 1440),
  active boolean not null default true
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles,
  professional_id uuid not null references public.professionals,
  service_id uuid not null references public.services,
  request_id uuid not null,
  service_name text not null,
  amount_paise integer not null check (amount_paise > 0),
  service_amount_paise integer not null check (service_amount_paise > 0),
  buyer_fee_paise integer not null check (buyer_fee_paise between 4900 and 29900),
  talent_fee_paise integer not null check (talent_fee_paise >= 0),
  talent_payout_paise integer not null check (talent_payout_paise > 0),
  status public.booking_status not null default 'requested',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text not null check (length(venue) between 5 and 500),
  venue_longitude double precision not null check (venue_longitude between -180 and 180),
  venue_latitude double precision not null check (venue_latitude between -90 and 90),
  notes text not null default '' check (length(notes) <= 2000),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, request_id),
  check (client_id <> professional_id),
  check (ends_at > starts_at),
  check (amount_paise=service_amount_paise+buyer_fee_paise),
  check (talent_payout_paise=service_amount_paise-talent_fee_paise),
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('accepted','en_route','arrived'))
);
create index bookings_client on public.bookings(client_id, created_at desc);
create index bookings_professional on public.bookings(professional_id, starts_at);
create index services_professional on public.services(professional_id);
create index professionals_category on public.professionals(category) where is_published;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings on delete cascade,
  sender_id uuid not null references public.profiles,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index messages_booking on public.messages(booking_id, created_at);
create table public.booking_locations (
  booking_id uuid primary key references public.bookings on delete cascade,
  longitude double precision not null check (longitude between -180 and 180),
  latitude double precision not null check (latitude between -90 and 90),
  heading double precision check (heading between 0 and 360),
  updated_at timestamptz not null default now()
);
create table public.saved_professionals (
  user_id uuid not null references public.profiles on delete cascade,
  professional_id uuid not null references public.professionals on delete cascade,
  primary key(user_id, professional_id)
);
create table public.project_briefs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles on delete cascade,
  category public.talent_category not null,
  title text not null check (length(title) between 3 and 120),
  brief text not null check (length(brief) between 20 and 2000),
  budget_paise integer not null check (budget_paise between 10000 and 100000000),
  starts_at timestamptz not null,
  city text not null check (length(city) between 2 and 120),
  created_at timestamptz not null default now()
);
create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
create index availability_professional on public.availability_blocks(professional_id, starts_at);
create table public.payment_orders (
  booking_id uuid primary key references public.bookings,
  order_id text not null unique,
  amount_paise integer not null check (amount_paise > 0),
  environment text not null check (environment in ('sandbox','production')),
  payment_id text unique,
  status text not null default 'created' check (status in ('created','paid','refund_requested','refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.refund_requests (
  booking_id uuid primary key references public.bookings,
  order_id text not null references public.payment_orders(order_id),
  status text not null default 'pending' check (status in ('pending','processing','refunded','failed')),
  created_at timestamptz not null default now()
);
alter table public.refund_requests add column next_attempt_at timestamptz not null default now();

create function private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values(new.id); return new; end;
$$;
create trigger create_profile after insert on auth.users for each row execute function private.create_profile();
create function private.is_booking_participant(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.bookings where id=p_id and (client_id=auth.uid() or professional_id=auth.uid()));
$$;

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_private_details enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.booking_locations enable row level security;
alter table public.saved_professionals enable row level security;
alter table public.project_briefs enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.payment_orders enable row level security;
alter table public.refund_requests enable row level security;

create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy edit_profile on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy public_professionals on public.professionals for select to authenticated using(is_published or id=auth.uid());
create policy insert_professional on public.professionals for insert to authenticated with check(id=auth.uid() and verified_at is null);
create policy edit_professional on public.professionals for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy private_details on public.professional_private_details for all to authenticated using(professional_id=auth.uid()) with check(professional_id=auth.uid());
create policy view_services on public.services for select to authenticated using(professional_id=auth.uid() or (active and exists(select 1 from public.professionals p where p.id=professional_id and p.is_published)));
create policy create_service on public.services for insert to authenticated with check(professional_id=auth.uid());
create policy edit_service on public.services for update to authenticated using(professional_id=auth.uid()) with check(professional_id=auth.uid());
create policy view_bookings on public.bookings for select to authenticated using(client_id=auth.uid() or professional_id=auth.uid());
create policy view_messages on public.messages for select to authenticated using(private.is_booking_participant(booking_id));
create policy send_messages on public.messages for insert to authenticated with check(sender_id=auth.uid() and private.is_booking_participant(booking_id) and exists(select 1 from public.bookings b where b.id=booking_id and b.status not in ('cancelled','declined')));
create policy view_locations on public.booking_locations for select to authenticated using(private.is_booking_participant(booking_id) and exists(select 1 from public.bookings b where b.id=booking_id and b.status in ('en_route','arrived')));
create policy own_saves on public.saved_professionals for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy read_briefs on public.project_briefs for select to authenticated using(client_id=auth.uid() or exists(select 1 from public.professionals p where p.id=auth.uid() and p.is_published and p.category=project_briefs.category));
create policy create_brief on public.project_briefs for insert to authenticated with check(client_id=auth.uid() and starts_at>now());
create policy own_blocks on public.availability_blocks for all to authenticated using(professional_id=auth.uid()) with check(professional_id=auth.uid());
create policy own_payment on public.payment_orders for select to authenticated using(private.is_booking_participant(booking_id));
create policy own_refund on public.refund_requests for select to authenticated using(private.is_booking_participant(booking_id));

-- Explicit privileges: users cannot set verification, prices, payment status or tracking timestamps on bookings.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.professionals, public.professional_private_details, public.services, public.bookings, public.messages, public.booking_locations, public.saved_professionals, public.project_briefs, public.availability_blocks, public.payment_orders, public.refund_requests to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert(id, display_name, category, city, bio, specialties, longitude, latitude, available_now, is_published, portfolio_urls, public_specs) on public.professionals to authenticated;
grant update(display_name, category, city, bio, specialties, longitude, latitude, available_now, is_published, portfolio_urls, public_specs) on public.professionals to authenticated;
grant insert, update, delete on public.professional_private_details, public.saved_professionals, public.availability_blocks to authenticated;
grant insert, update on public.services to authenticated;
grant insert(booking_id, sender_id, body) on public.messages to authenticated;
grant insert(client_id, category, title, brief, budget_paise, starts_at, city) on public.project_briefs to authenticated;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on function private.is_booking_participant(uuid) to authenticated;
grant all on all tables in schema public to service_role;

create function private.booking_pricing(p_net_paise integer)
returns table(service_amount_paise integer,buyer_fee_paise integer,talent_fee_paise integer,talent_payout_paise integer,total_paise integer)
language sql immutable security invoker set search_path = '' as $$
  select gross,fee,gross-p_net_paise,p_net_paise,gross+fee from (
    select gross,least(29900,greatest(4900,round(gross::numeric/100*0.03)::integer*100)) as fee from (
      select round(p_net_paise::numeric/100/0.92)::integer*100 as gross
    ) g
  ) f;
$$;
revoke all on function private.booking_pricing(integer) from public,anon;
grant execute on function private.booking_pricing(integer) to authenticated;

create function public.discover_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer)
language sql stable security invoker set search_path = '' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,p.available_now,p.longitude,p.latitude,p.portfolio_urls,d.km,q.total_paise
  from public.professionals p cross join lateral (
    select 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(p.latitude::double precision-p_latitude)/2),2) +
      cos(radians(p_latitude))*cos(radians(p.latitude::double precision))*power(sin(radians(p.longitude::double precision-p_longitude)/2),2)
    )))) as km
  ) d join lateral (select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
  cross join lateral private.booking_pricing(s.net) q
  where p.is_published and p.category=p_category and (not p_available_now or p.available_now)
    and p_latitude between -90 and 90 and p_longitude between -180 and 180
    and d.km <= least(greatest(p_radius_km,1),50)
    and (p_query='' or position(lower(left(p_query,100)) in lower(p.display_name||' '||array_to_string(p.specialties,' ')))>0)
  order by d.km,p.id limit 100;
$$;

create function public.request_booking(p_service_id uuid, p_starts_at timestamptz, p_venue text, p_longitude double precision,
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
  select * into fees from private.booking_pricing(s.amount_paise);
  if p_expected_total_paise is null or p_expected_total_paise<>fees.total_paise then raise exception 'The booking price has changed. Reopen the service to review the latest price.'; end if;
  insert into public.bookings(client_id,professional_id,service_id,request_id,service_name,amount_paise,
    service_amount_paise,buyer_fee_paise,talent_fee_paise,talent_payout_paise,starts_at,ends_at,venue,venue_longitude,venue_latitude,notes)
    values(auth.uid(),p.id,s.id,p_request_id,s.name,fees.total_paise,fees.service_amount_paise,fees.buyer_fee_paise,fees.talent_fee_paise,fees.talent_payout_paise,
      p_starts_at,finish,trim(p_venue),p_longitude,p_latitude,trim(p_notes)) returning * into b;
  return b;
end;
$$;

create function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status=p_status then return b; end if;
  if p_status='cancelled' then
    if b.status not in ('requested','accepted') then raise exception 'This booking cannot be cancelled'; end if;
  elsif b.professional_id<>auth.uid() then raise exception 'Only the professional can update this status';
  elsif not ((b.status='requested' and p_status in ('accepted','declined')) or
    (b.status='accepted' and p_status='en_route' and b.paid_at is not null) or
    (b.status='en_route' and p_status='arrived') or
    (b.status='arrived' and p_status='completed')) then raise exception 'Invalid booking transition'; end if;
  if p_status='accepted' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then raise exception 'This time has been marked unavailable'; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  if p_status='cancelled' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status='refund_requested' where booking_id=b.id;
  end if;
  if p_status in ('completed','cancelled','declined') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;

create function public.share_booking_location(p_booking_id uuid,p_longitude double precision,p_latitude double precision,p_heading double precision default null)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and professional_id=auth.uid() and status in ('en_route','arrived') for share;
  if not found then raise exception 'Location sharing requires an active journey'; end if;
  insert into public.booking_locations(booking_id,longitude,latitude,heading) values(p_booking_id,p_longitude,p_latitude,p_heading)
  on conflict(booking_id) do update set longitude=excluded.longitude,latitude=excluded.latitude,heading=excluded.heading,updated_at=now();
end;
$$;

-- Only trusted payment functions call this after checking the Cashfree API.
create function public.confirm_payment(p_order_id text,p_payment_id text,p_amount_paise integer)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.payment_orders; b public.bookings;
begin
  select * into o from public.payment_orders where order_id=p_order_id;
  if not found then raise exception 'Unknown payment order'; end if;
  select * into b from public.bookings where id=o.booking_id for update;
  select * into o from public.payment_orders where order_id=p_order_id for update;
  if o.amount_paise<>p_amount_paise or b.amount_paise<>p_amount_paise then raise exception 'Payment amount mismatch'; end if;
  if o.paid_at is not null then return; end if;
  update public.payment_orders set payment_id=p_payment_id,paid_at=now(),status=case when b.status in ('cancelled','declined') then 'refund_requested' else 'paid' end where order_id=p_order_id;
  update public.bookings set paid_at=now() where id=b.id;
  if b.status in ('cancelled','declined') then insert into public.refund_requests(booking_id,order_id) values(b.id,p_order_id) on conflict do nothing; end if;
end;
$$;
revoke all on function public.confirm_payment(text,text,integer) from public,anon,authenticated;
grant execute on function public.confirm_payment(text,text,integer) to service_role;
revoke all on function public.discover_professionals(public.talent_category,double precision,double precision,text,double precision,boolean),
  public.request_booking(uuid,timestamptz,text,double precision,double precision,text,uuid,integer),
  public.transition_booking(uuid,public.booking_status),
  public.share_booking_location(uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.discover_professionals(public.talent_category,double precision,double precision,text,double precision,boolean),
  public.request_booking(uuid,timestamptz,text,double precision,double precision,text,uuid,integer),
  public.transition_booking(uuid,public.booking_status),
  public.share_booking_location(uuid,double precision,double precision,double precision) to authenticated;

alter publication supabase_realtime add table public.bookings,public.messages,public.booking_locations;
