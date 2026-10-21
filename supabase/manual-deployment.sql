-- CC Circle initial deployment: run this complete file in Supabase SQL Editor.
-- Removes the identified empty old prototype objects and creates the app schema.
-- Auth users, Storage objects and Supabase system schemas are retained.
-- If any statement fails, the transaction rolls back, including prototype removal.
begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text
);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080000') then
      raise exception 'Migration 202610080000 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- The owner requested removal of the earlier, incompatible prototype objects.
-- Fresh projects skip this cleanup. Refuse to remove a different/new app schema.
do $$
declare item record;
begin
  if exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='services' and column_name='owner_id') then
    if exists(select 1 from public.profiles) or exists(select 1 from public.services)
      or exists(select 1 from public.bookings) or exists(select 1 from public.messages)
      or exists(select 1 from public.saved_services) or exists(select 1 from public.booking_events) then
      raise exception 'The prototype now contains records. Review those records before replacing it.';
    end if;
    for item in select p.oid::regprocedure::text as signature from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('session_active','account_verified','update_profile',
        'account_role','complete_account','booking_member','request_booking','change_booking')
      and p.prokind='f'
    loop
      if to_regprocedure(item.signature::text) is not null then
        execute format('drop function %s cascade',item.signature);
      end if;
    end loop;
    drop view if exists public.booking_details;
    drop table public.booking_events,public.saved_services,public.messages,
      public.bookings,public.services,public.profiles cascade;
  elsif to_regclass('public.services') is not null then
    raise exception 'A different or newer services schema already exists. Do not replace it with this initial deployment.';
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610080000','replace_prototype',array['-- The owner requested removal of the earlier, incompatible prototype objects.
-- Fresh projects skip this cleanup. Refuse to remove a different/new app schema.
do $$
declare item record;
begin
  if exists(select 1 from information_schema.columns where table_schema=''public''
    and table_name=''services'' and column_name=''owner_id'') then
    if exists(select 1 from public.profiles) or exists(select 1 from public.services)
      or exists(select 1 from public.bookings) or exists(select 1 from public.messages)
      or exists(select 1 from public.saved_services) or exists(select 1 from public.booking_events) then
      raise exception ''The prototype now contains records. Review those records before replacing it.'';
    end if;
    for item in select p.oid::regprocedure::text as signature from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname=''public''
      and p.proname in (''session_active'',''account_verified'',''update_profile'',
        ''account_role'',''complete_account'',''booking_member'',''request_booking'',''change_booking'')
      and p.prokind=''f''
    loop
      if to_regprocedure(item.signature::text) is not null then
        execute format(''drop function %s cascade'',item.signature);
      end if;
    end loop;
    drop view if exists public.booking_details;
    drop table public.booking_events,public.saved_services,public.messages,
      public.bookings,public.services,public.profiles cascade;
  elsif to_regclass(''public.services'') is not null then
    raise exception ''A different or newer services schema already exists. Do not replace it with this initial deployment.'';
  end if;
end;
$$;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080001') then
      raise exception 'Migration 202610080001 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
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

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610080001','marketplace',array['-- Apply to a new Supabase project. Currency amounts are integer paise.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set search_path = public, extensions;
create schema if not exists private;

create type public.talent_category as enum (''Makeup'',''Actor'',''Photographer'',''Editor'',''Dancer'');
create type public.booking_status as enum (''requested'',''accepted'',''en_route'',''arrived'',''completed'',''declined'',''cancelled'');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '''' check (length(display_name) <= 120),
  created_at timestamptz not null default now()
);
create table public.professionals (
  id uuid primary key references public.profiles on delete cascade,
  display_name text not null check (length(display_name) between 2 and 120),
  category public.talent_category not null,
  city text not null check (length(city) between 2 and 120),
  bio text not null check (length(bio) between 20 and 1000),
  specialties text[] not null default ''{}'',
  longitude numeric(7,3) not null check (longitude between -180 and 180),
  latitude numeric(6,3) not null check (latitude between -90 and 90),
  available_now boolean not null default false,
  is_published boolean not null default false,
  verified_at timestamptz,
  portfolio_urls text[] not null default ''{}'',
  public_specs jsonb not null default ''{}'',
  created_at timestamptz not null default now(),
  check (cardinality(portfolio_urls) <= 20),
  check (cardinality(specialties) <= 30)
);
create table public.professional_private_details (
  professional_id uuid primary key references public.professionals on delete cascade,
  details jsonb not null default ''{}'',
  portfolio_consent_at timestamptz,
  updated_at timestamptz not null default now(),
  check (octet_length(details::text) <= 65536)
);
create table public.services (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals on delete cascade,
  name text not null check (length(name) between 2 and 120),
  description text not null default '''' check (length(description) <= 1000),
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
  status public.booking_status not null default ''requested'',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text not null check (length(venue) between 5 and 500),
  venue_longitude double precision not null check (venue_longitude between -180 and 180),
  venue_latitude double precision not null check (venue_latitude between -90 and 90),
  notes text not null default '''' check (length(notes) <= 2000),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, request_id),
  check (client_id <> professional_id),
  check (ends_at > starts_at),
  check (amount_paise=service_amount_paise+buyer_fee_paise),
  check (talent_payout_paise=service_amount_paise-talent_fee_paise),
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, ''[)'') with &&
  ) where (status in (''accepted'',''en_route'',''arrived''))
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
  environment text not null check (environment in (''sandbox'',''production'')),
  payment_id text unique,
  status text not null default ''created'' check (status in (''created'',''paid'',''refund_requested'',''refunded'')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.refund_requests (
  booking_id uuid primary key references public.bookings,
  order_id text not null references public.payment_orders(order_id),
  status text not null default ''pending'' check (status in (''pending'',''processing'',''refunded'',''failed'')),
  created_at timestamptz not null default now()
);
alter table public.refund_requests add column next_attempt_at timestamptz not null default now();

create function private.create_profile() returns trigger language plpgsql security definer set search_path = '''' as $$
begin insert into public.profiles(id) values(new.id); return new; end;
$$;
create trigger create_profile after insert on auth.users for each row execute function private.create_profile();
create function private.is_booking_participant(p_id uuid) returns boolean language sql stable security definer set search_path = '''' as $$
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
create policy send_messages on public.messages for insert to authenticated with check(sender_id=auth.uid() and private.is_booking_participant(booking_id) and exists(select 1 from public.bookings b where b.id=booking_id and b.status not in (''cancelled'',''declined'')));
create policy view_locations on public.booking_locations for select to authenticated using(private.is_booking_participant(booking_id) and exists(select 1 from public.bookings b where b.id=booking_id and b.status in (''en_route'',''arrived'')));
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
language sql immutable security invoker set search_path = '''' as $$
  select gross,fee,gross-p_net_paise,p_net_paise,gross+fee from (
    select gross,least(29900,greatest(4900,round(gross::numeric/100*0.03)::integer*100)) as fee from (
      select round(p_net_paise::numeric/100/0.92)::integer*100 as gross
    ) g
  ) f;
$$;
revoke all on function private.booking_pricing(integer) from public,anon;
grant execute on function private.booking_pricing(integer) to authenticated;

create function public.discover_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '''', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer)
language sql stable security invoker set search_path = '''' as $$
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
    and (p_query='''' or position(lower(left(p_query,100)) in lower(p.display_name||'' ''||array_to_string(p.specialties,'' '')))>0)
  order by d.km,p.id limit 100;
$$;

create function public.request_booking(p_service_id uuid, p_starts_at timestamptz, p_venue text, p_longitude double precision,
  p_latitude double precision, p_notes text, p_request_id uuid,p_expected_total_paise integer)
returns public.bookings language plpgsql security definer set search_path = '''' as $$
declare s public.services; p public.professionals; b public.bookings; finish timestamptz; fees record;
begin
  if auth.uid() is null then raise exception ''Sign in to request a booking''; end if;
  select * into b from public.bookings where client_id=auth.uid() and request_id=p_request_id;
  if found then return b; end if;
  select * into s from public.services where id=p_service_id and active for share;
  if not found then raise exception ''Service is unavailable''; end if;
  select * into p from public.professionals where id=s.professional_id and is_published for update;
  if not found or p.id=auth.uid() then raise exception ''Professional is unavailable''; end if;
  -- Recheck idempotency after taking the professional lock.
  select * into b from public.bookings where client_id=auth.uid() and request_id=p_request_id;
  if found then return b; end if;
  if p_starts_at < now()-interval ''2 minutes'' or p_starts_at > now()+interval ''1 year'' then raise exception ''Choose a valid booking time''; end if;
  if p_starts_at < now()+interval ''15 minutes'' and not p.available_now then raise exception ''This professional requires a scheduled booking''; end if;
  if (select count(*) from public.bookings where client_id=auth.uid() and status=''requested'')>=10 then raise exception ''You have too many pending requests''; end if;
  finish := p_starts_at + make_interval(mins=>s.duration_minutes);
  if exists(select 1 from public.availability_blocks where professional_id=p.id and tstzrange(starts_at,ends_at,''[)'') && tstzrange(p_starts_at,finish,''[)'')) then raise exception ''This time is unavailable''; end if;
  if exists(select 1 from public.bookings where professional_id=p.id and status in (''requested'',''accepted'',''en_route'',''arrived'') and tstzrange(starts_at,ends_at,''[)'') && tstzrange(p_starts_at,finish,''[)'')) then raise exception ''This professional already has a booking at that time''; end if;
  select * into fees from private.booking_pricing(s.amount_paise);
  if p_expected_total_paise is null or p_expected_total_paise<>fees.total_paise then raise exception ''The booking price has changed. Reopen the service to review the latest price.''; end if;
  insert into public.bookings(client_id,professional_id,service_id,request_id,service_name,amount_paise,
    service_amount_paise,buyer_fee_paise,talent_fee_paise,talent_payout_paise,starts_at,ends_at,venue,venue_longitude,venue_latitude,notes)
    values(auth.uid(),p.id,s.id,p_request_id,s.name,fees.total_paise,fees.service_amount_paise,fees.buyer_fee_paise,fees.talent_fee_paise,fees.talent_payout_paise,
      p_starts_at,finish,trim(p_venue),p_longitude,p_latitude,trim(p_notes)) returning * into b;
  return b;
end;
$$;

create function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '''' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception ''Booking not found''; end if;
  if b.status=p_status then return b; end if;
  if p_status=''cancelled'' then
    if b.status not in (''requested'',''accepted'') then raise exception ''This booking cannot be cancelled''; end if;
  elsif b.professional_id<>auth.uid() then raise exception ''Only the professional can update this status'';
  elsif not ((b.status=''requested'' and p_status in (''accepted'',''declined'')) or
    (b.status=''accepted'' and p_status=''en_route'' and b.paid_at is not null) or
    (b.status=''en_route'' and p_status=''arrived'') or
    (b.status=''arrived'' and p_status=''completed'')) then raise exception ''Invalid booking transition''; end if;
  if p_status=''accepted'' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,''[)'') && tstzrange(b.starts_at,b.ends_at,''[)'')) then raise exception ''This time has been marked unavailable''; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  if p_status=''cancelled'' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status=''refund_requested'' where booking_id=b.id;
  end if;
  if p_status in (''completed'',''cancelled'',''declined'') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;

create function public.share_booking_location(p_booking_id uuid,p_longitude double precision,p_latitude double precision,p_heading double precision default null)
returns void language plpgsql security definer set search_path = '''' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and professional_id=auth.uid() and status in (''en_route'',''arrived'') for share;
  if not found then raise exception ''Location sharing requires an active journey''; end if;
  insert into public.booking_locations(booking_id,longitude,latitude,heading) values(p_booking_id,p_longitude,p_latitude,p_heading)
  on conflict(booking_id) do update set longitude=excluded.longitude,latitude=excluded.latitude,heading=excluded.heading,updated_at=now();
end;
$$;

-- Only trusted payment functions call this after checking the Cashfree API.
create function public.confirm_payment(p_order_id text,p_payment_id text,p_amount_paise integer)
returns void language plpgsql security definer set search_path = '''' as $$
declare o public.payment_orders; b public.bookings;
begin
  select * into o from public.payment_orders where order_id=p_order_id;
  if not found then raise exception ''Unknown payment order''; end if;
  select * into b from public.bookings where id=o.booking_id for update;
  select * into o from public.payment_orders where order_id=p_order_id for update;
  if o.amount_paise<>p_amount_paise or b.amount_paise<>p_amount_paise then raise exception ''Payment amount mismatch''; end if;
  if o.paid_at is not null then return; end if;
  update public.payment_orders set payment_id=p_payment_id,paid_at=now(),status=case when b.status in (''cancelled'',''declined'') then ''refund_requested'' else ''paid'' end where order_id=p_order_id;
  update public.bookings set paid_at=now() where id=b.id;
  if b.status in (''cancelled'',''declined'') then insert into public.refund_requests(booking_id,order_id) values(b.id,p_order_id) on conflict do nothing; end if;
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
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080002') then
      raise exception 'Migration 202610080002 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Save onboarding, consent and the first service in one transaction.
revoke insert, update on public.professionals from authenticated;
revoke insert, update, delete on public.professional_private_details from authenticated;
grant update(available_now) on public.professionals to authenticated;

create function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare category public.talent_category; link text; s_id uuid; profile_specs jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to save your profile'; end if;
  if jsonb_typeof(p_profile)<>'object' or jsonb_typeof(p_private)<>'object' or jsonb_typeof(p_service)<>'object' then raise exception 'Invalid profile'; end if;
  category := (p_profile->>'category')::public.talent_category;
  if jsonb_typeof(p_profile->'portfolio_urls')<>'array' or jsonb_array_length(p_profile->'portfolio_urls')=0 then raise exception 'Add a work portfolio'; end if;
  for link in select jsonb_array_elements_text(p_profile->'portfolio_urls') loop
    if link !~ '^https://[^[:space:]]+$' or length(link)>2000 then raise exception 'Use HTTPS work links'; end if;
  end loop;
  profile_specs := coalesce(p_profile->'public_specs','{}'::jsonb);
  if octet_length(profile_specs::text)>65536 then raise exception 'Profile specifications are too large'; end if;
  -- Casting answers are owner-only. Public actor discovery uses selected specialties.
  if category='Actor' then p_private:=profile_specs||p_private; profile_specs:='{}'; end if;
  insert into public.professionals(id,display_name,category,city,bio,specialties,longitude,latitude,portfolio_urls,public_specs,is_published)
  values(auth.uid(),trim(p_profile->>'display_name'),category,trim(p_profile->>'city'),trim(p_profile->>'bio'),
    array(select jsonb_array_elements_text(p_profile->'specialties')),(p_profile->>'longitude')::numeric,(p_profile->>'latitude')::numeric,
    array(select jsonb_array_elements_text(p_profile->'portfolio_urls')),profile_specs,true)
  on conflict(id) do update set display_name=excluded.display_name,category=excluded.category,city=excluded.city,bio=excluded.bio,
    specialties=excluded.specialties,longitude=excluded.longitude,latitude=excluded.latitude,portfolio_urls=excluded.portfolio_urls,public_specs=excluded.public_specs,is_published=true;
  insert into public.professional_private_details(professional_id,details,portfolio_consent_at)
  values(auth.uid(),p_private,now()) on conflict(professional_id) do update set details=excluded.details,portfolio_consent_at=now(),updated_at=now();
  if p_service->>'id' is not null then
    s_id := (p_service->>'id')::uuid;
    if not exists(select 1 from public.services where id=s_id and professional_id=auth.uid()) then raise exception 'Service not found'; end if;
    update public.services set name=trim(p_service->>'name'),amount_paise=(p_service->>'amount_paise')::integer,
      duration_minutes=(p_service->>'duration_minutes')::integer where id=s_id;
  else
    insert into public.services(professional_id,name,amount_paise,duration_minutes)
    values(auth.uid(),trim(p_service->>'name'),(p_service->>'amount_paise')::integer,(p_service->>'duration_minutes')::integer);
  end if;
  delete from public.professional_drafts where professional_id=auth.uid();
end;
$$;
revoke all on function public.save_professional_profile(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_professional_profile(jsonb,jsonb,jsonb) to authenticated;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610080002','profile',array['-- Save onboarding, consent and the first service in one transaction.
revoke insert, update on public.professionals from authenticated;
revoke insert, update, delete on public.professional_private_details from authenticated;
grant update(available_now) on public.professionals to authenticated;

create function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path = '''' as $$
declare category public.talent_category; link text; s_id uuid; profile_specs jsonb;
begin
  if auth.uid() is null then raise exception ''Sign in to save your profile''; end if;
  if jsonb_typeof(p_profile)<>''object'' or jsonb_typeof(p_private)<>''object'' or jsonb_typeof(p_service)<>''object'' then raise exception ''Invalid profile''; end if;
  category := (p_profile->>''category'')::public.talent_category;
  if jsonb_typeof(p_profile->''portfolio_urls'')<>''array'' or jsonb_array_length(p_profile->''portfolio_urls'')=0 then raise exception ''Add a work portfolio''; end if;
  for link in select jsonb_array_elements_text(p_profile->''portfolio_urls'') loop
    if link !~ ''^https://[^[:space:]]+$'' or length(link)>2000 then raise exception ''Use HTTPS work links''; end if;
  end loop;
  profile_specs := coalesce(p_profile->''public_specs'',''{}''::jsonb);
  if octet_length(profile_specs::text)>65536 then raise exception ''Profile specifications are too large''; end if;
  -- Casting answers are owner-only. Public actor discovery uses selected specialties.
  if category=''Actor'' then p_private:=profile_specs||p_private; profile_specs:=''{}''; end if;
  insert into public.professionals(id,display_name,category,city,bio,specialties,longitude,latitude,portfolio_urls,public_specs,is_published)
  values(auth.uid(),trim(p_profile->>''display_name''),category,trim(p_profile->>''city''),trim(p_profile->>''bio''),
    array(select jsonb_array_elements_text(p_profile->''specialties'')),(p_profile->>''longitude'')::numeric,(p_profile->>''latitude'')::numeric,
    array(select jsonb_array_elements_text(p_profile->''portfolio_urls'')),profile_specs,true)
  on conflict(id) do update set display_name=excluded.display_name,category=excluded.category,city=excluded.city,bio=excluded.bio,
    specialties=excluded.specialties,longitude=excluded.longitude,latitude=excluded.latitude,portfolio_urls=excluded.portfolio_urls,public_specs=excluded.public_specs,is_published=true;
  insert into public.professional_private_details(professional_id,details,portfolio_consent_at)
  values(auth.uid(),p_private,now()) on conflict(professional_id) do update set details=excluded.details,portfolio_consent_at=now(),updated_at=now();
  if p_service->>''id'' is not null then
    s_id := (p_service->>''id'')::uuid;
    if not exists(select 1 from public.services where id=s_id and professional_id=auth.uid()) then raise exception ''Service not found''; end if;
    update public.services set name=trim(p_service->>''name''),amount_paise=(p_service->>''amount_paise'')::integer,
      duration_minutes=(p_service->>''duration_minutes'')::integer where id=s_id;
  else
    insert into public.services(professional_id,name,amount_paise,duration_minutes)
    values(auth.uid(),trim(p_service->>''name''),(p_service->>''amount_paise'')::integer,(p_service->>''duration_minutes'')::integer);
  end if;
  delete from public.professional_drafts where professional_id=auth.uid();
end;
$$;
revoke all on function public.save_professional_profile(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_professional_profile(jsonb,jsonb,jsonb) to authenticated;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080003') then
      raise exception 'Migration 202610080003 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
create table private.payment_rate_limits (
  user_id uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  attempts integer not null
);
alter table private.payment_rate_limits enable row level security;
revoke all on private.payment_rate_limits from public,anon,authenticated;

create function public.claim_payment_operation(p_user_id uuid) returns boolean language plpgsql security definer set search_path = '' as $$
declare attempts integer;
begin
  insert into private.payment_rate_limits values(p_user_id,now(),1)
  on conflict(user_id) do update set
    attempts=case when payment_rate_limits.window_start < now()-interval '1 minute' then 1 else payment_rate_limits.attempts+1 end,
    window_start=case when payment_rate_limits.window_start < now()-interval '1 minute' then now() else payment_rate_limits.window_start end
  returning payment_rate_limits.attempts into attempts;
  return attempts <= 10;
end;
$$;
revoke all on function public.claim_payment_operation(uuid) from public,anon,authenticated;
grant execute on function public.claim_payment_operation(uuid) to service_role;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610080003','payment_limits',array['create table private.payment_rate_limits (
  user_id uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  attempts integer not null
);
alter table private.payment_rate_limits enable row level security;
revoke all on private.payment_rate_limits from public,anon,authenticated;

create function public.claim_payment_operation(p_user_id uuid) returns boolean language plpgsql security definer set search_path = '''' as $$
declare attempts integer;
begin
  insert into private.payment_rate_limits values(p_user_id,now(),1)
  on conflict(user_id) do update set
    attempts=case when payment_rate_limits.window_start < now()-interval ''1 minute'' then 1 else payment_rate_limits.attempts+1 end,
    window_start=case when payment_rate_limits.window_start < now()-interval ''1 minute'' then now() else payment_rate_limits.window_start end
  returning payment_rate_limits.attempts into attempts;
  return attempts <= 10;
end;
$$;
revoke all on function public.claim_payment_operation(uuid) from public,anon,authenticated;
grant execute on function public.claim_payment_operation(uuid) to service_role;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080004') then
      raise exception 'Migration 202610080004 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
create function public.record_refund_status(p_booking_id uuid,p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('processing','refunded','failed') then raise exception 'Invalid refund status'; end if;
  perform 1 from public.refund_requests where booking_id=p_booking_id for update;
  if not found then raise exception 'Refund request not found'; end if;
  if exists(select 1 from public.refund_requests where booking_id=p_booking_id and status='refunded') then return; end if;
  update public.refund_requests set status=p_status where booking_id=p_booking_id;
  if p_status='refunded' then update public.payment_orders set status='refunded' where booking_id=p_booking_id; end if;
end;
$$;
revoke all on function public.record_refund_status(uuid,text) from public,anon,authenticated;
grant execute on function public.record_refund_status(uuid,text) to service_role;

create table public.professional_drafts (
  professional_id uuid primary key references public.profiles on delete cascade,
  draft jsonb not null default '{}',
  check (jsonb_typeof(draft)='object' and octet_length(draft::text)<=131072)
);
alter table public.professional_drafts enable row level security;
create policy own_draft on public.professional_drafts for all to authenticated
  using(professional_id=auth.uid()) with check(professional_id=auth.uid());
revoke all on public.professional_drafts from anon,authenticated;
grant select,insert,update,delete on public.professional_drafts to authenticated;
grant all on public.professional_drafts to service_role;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610080004','operations',array['create function public.record_refund_status(p_booking_id uuid,p_status text) returns void
language plpgsql security definer set search_path = '''' as $$
begin
  if p_status not in (''processing'',''refunded'',''failed'') then raise exception ''Invalid refund status''; end if;
  perform 1 from public.refund_requests where booking_id=p_booking_id for update;
  if not found then raise exception ''Refund request not found''; end if;
  if exists(select 1 from public.refund_requests where booking_id=p_booking_id and status=''refunded'') then return; end if;
  update public.refund_requests set status=p_status where booking_id=p_booking_id;
  if p_status=''refunded'' then update public.payment_orders set status=''refunded'' where booking_id=p_booking_id; end if;
end;
$$;
revoke all on function public.record_refund_status(uuid,text) from public,anon,authenticated;
grant execute on function public.record_refund_status(uuid,text) to service_role;

create table public.professional_drafts (
  professional_id uuid primary key references public.profiles on delete cascade,
  draft jsonb not null default ''{}'',
  check (jsonb_typeof(draft)=''object'' and octet_length(draft::text)<=131072)
);
alter table public.professional_drafts enable row level security;
create policy own_draft on public.professional_drafts for all to authenticated
  using(professional_id=auth.uid()) with check(professional_id=auth.uid());
revoke all on public.professional_drafts from anon,authenticated;
grant select,insert,update,delete on public.professional_drafts to authenticated;
grant all on public.professional_drafts to service_role;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080005') then
      raise exception 'Migration 202610080005 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
create table public.payout_accounts (
  professional_id uuid primary key references public.professionals,
  beneficiary_id text not null unique,
  environment text not null check (environment in ('sandbox','production')),
  created_at timestamptz not null default now()
);
create table public.payout_jobs (
  booking_id uuid primary key references public.bookings,
  professional_id uuid not null references public.professionals,
  amount_paise integer not null check(amount_paise>0),
  transfer_id text not null unique,
  beneficiary_id text,
  status text not null default 'pending' check(status in ('pending','processing','paid','failed')),
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
alter table public.payout_jobs enable row level security;
create policy own_payout_account on public.payout_accounts for select to authenticated using(professional_id=auth.uid());
create policy own_payout_jobs on public.payout_jobs for select to authenticated using(professional_id=auth.uid());
revoke all on public.payout_accounts,public.payout_jobs from anon,authenticated;
grant select on public.payout_accounts,public.payout_jobs to authenticated;
grant all on public.payout_accounts,public.payout_jobs to service_role;

create function private.queue_payout() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='completed' and new.paid_at is not null and old.status<>'completed' then
    insert into public.payout_jobs(booking_id,professional_id,amount_paise,transfer_id)
    values(new.id,new.professional_id,new.talent_payout_paise,'CC'||replace(new.id::text,'-','')) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_payout() from public,anon,authenticated;
create trigger queue_payout after update on public.bookings for each row execute function private.queue_payout();

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610080005','payouts',array['create table public.payout_accounts (
  professional_id uuid primary key references public.professionals,
  beneficiary_id text not null unique,
  environment text not null check (environment in (''sandbox'',''production'')),
  created_at timestamptz not null default now()
);
create table public.payout_jobs (
  booking_id uuid primary key references public.bookings,
  professional_id uuid not null references public.professionals,
  amount_paise integer not null check(amount_paise>0),
  transfer_id text not null unique,
  beneficiary_id text,
  status text not null default ''pending'' check(status in (''pending'',''processing'',''paid'',''failed'')),
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
alter table public.payout_jobs enable row level security;
create policy own_payout_account on public.payout_accounts for select to authenticated using(professional_id=auth.uid());
create policy own_payout_jobs on public.payout_jobs for select to authenticated using(professional_id=auth.uid());
revoke all on public.payout_accounts,public.payout_jobs from anon,authenticated;
grant select on public.payout_accounts,public.payout_jobs to authenticated;
grant all on public.payout_accounts,public.payout_jobs to service_role;

create function private.queue_payout() returns trigger language plpgsql security definer set search_path = '''' as $$
begin
  if new.status=''completed'' and new.paid_at is not null and old.status<>''completed'' then
    insert into public.payout_jobs(booking_id,professional_id,amount_paise,transfer_id)
    values(new.id,new.professional_id,new.talent_payout_paise,''CC''||replace(new.id::text,''-'','''')) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_payout() from public,anon,authenticated;
create trigger queue_payout after update on public.bookings for each row execute function private.queue_payout();
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080006') then
      raise exception 'Migration 202610080006 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Users may have signed in before the profile-provisioning trigger was deployed.
insert into public.profiles(id)
select id from auth.users
on conflict(id) do nothing;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610080006','existing_users',array['-- Users may have signed in before the profile-provisioning trigger was deployed.
insert into public.profiles(id)
select id from auth.users
on conflict(id) do nothing;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610080007') then
      raise exception 'Migration 202610080007 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- The client pays after completion; starting a journey no longer needs payment.
create or replace function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
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
    (b.status='accepted' and p_status='en_route') or
    (b.status='en_route' and p_status='arrived') or
    (b.status='arrived' and p_status='completed')) then raise exception 'Invalid booking transition'; end if;
  if p_status='accepted' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then raise exception 'This time has been marked unavailable'; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  -- Preserve refund handling for payment orders created before this change.
  if p_status='cancelled' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status='refund_requested' where booking_id=b.id;
  end if;
  if p_status in ('completed','cancelled','declined') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;

-- Queue exactly once whether verified payment or completion happens last.
create or replace function private.queue_payout() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='completed' and new.paid_at is not null
    and (old.status<>'completed' or old.paid_at is null) then
    insert into public.payout_jobs(booking_id,professional_id,amount_paise,transfer_id)
    values(new.id,new.professional_id,new.talent_payout_paise,'CC'||replace(new.id::text,'-','')) on conflict do nothing;
  end if;
  return new;
end;
$$;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610080007','pay_after_completion',array['-- The client pays after completion; starting a journey no longer needs payment.
create or replace function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '''' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception ''Booking not found''; end if;
  if b.status=p_status then return b; end if;
  if p_status=''cancelled'' then
    if b.status not in (''requested'',''accepted'') then raise exception ''This booking cannot be cancelled''; end if;
  elsif b.professional_id<>auth.uid() then raise exception ''Only the professional can update this status'';
  elsif not ((b.status=''requested'' and p_status in (''accepted'',''declined'')) or
    (b.status=''accepted'' and p_status=''en_route'') or
    (b.status=''en_route'' and p_status=''arrived'') or
    (b.status=''arrived'' and p_status=''completed'')) then raise exception ''Invalid booking transition''; end if;
  if p_status=''accepted'' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,''[)'') && tstzrange(b.starts_at,b.ends_at,''[)'')) then raise exception ''This time has been marked unavailable''; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  -- Preserve refund handling for payment orders created before this change.
  if p_status=''cancelled'' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status=''refund_requested'' where booking_id=b.id;
  end if;
  if p_status in (''completed'',''cancelled'',''declined'') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;

-- Queue exactly once whether verified payment or completion happens last.
create or replace function private.queue_payout() returns trigger language plpgsql security definer set search_path = '''' as $$
begin
  if new.status=''completed'' and new.paid_at is not null
    and (old.status<>''completed'' or old.paid_at is null) then
    insert into public.payout_jobs(booking_id,professional_id,amount_paise,transfer_id)
    values(new.id,new.professional_id,new.talent_payout_paise,''CC''||replace(new.id::text,''-'','''')) on conflict do nothing;
  end if;
  return new;
end;
$$;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610150001') then
      raise exception 'Migration 202610150001 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
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

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610150001','live_availability',array['-- available_now remains the professional''s online preference. Effective availability
-- is computed from bookings/blocks under security definer, because customers
-- must not read another customer''s private booking to discover a busy provider.
create function private.professional_busy(p_id uuid,p_start timestamptz,p_end timestamptz)
returns boolean language sql stable security definer set search_path = '''' as $$
  select exists(select 1 from public.availability_blocks a where a.professional_id=p_id
    and tstzrange(a.starts_at,a.ends_at,''[)'') && tstzrange(p_start,p_end,''[)''))
  or exists(select 1 from public.bookings b where b.professional_id=p_id
    and b.status in (''requested'',''accepted'',''en_route'',''arrived'') and (
      tstzrange(b.starts_at,b.ends_at,''[)'') && tstzrange(p_start,p_end,''[)'')
      or (p_start<now()+interval ''15 minutes'' and (
        b.status in (''en_route'',''arrived'') or (b.status=''accepted'' and b.starts_at<=now())
      ))
    ));
$$;
revoke all on function private.professional_busy(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function private.professional_busy(uuid,timestamptz,timestamptz) to authenticated;

create function public.professional_availability(p_professional_id uuid,p_duration_minutes integer default 15)
returns table(available_now boolean,is_online boolean,is_busy boolean)
language sql stable security invoker set search_path = '''' as $$
  select p.is_published and p.available_now and not b.busy,p.available_now,b.busy
  from public.professionals p cross join lateral (
    select private.professional_busy(p.id,now(),now()+make_interval(mins=>least(1440,greatest(15,p_duration_minutes)))) as busy
  ) b where p.id=p_professional_id;
$$;
revoke all on function public.professional_availability(uuid,integer) from public,anon;
grant execute on function public.professional_availability(uuid,integer) to authenticated;

create or replace function public.discover_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '''', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer)
language sql stable security invoker set search_path = '''' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,(p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')),p.longitude,p.latitude,p.portfolio_urls,d.km,q.total_paise
  from public.professionals p cross join lateral (
    select 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(p.latitude::double precision-p_latitude)/2),2) +
      cos(radians(p_latitude))*cos(radians(p.latitude::double precision))*power(sin(radians(p.longitude::double precision-p_longitude)/2),2)
    )))) as km
  ) d join lateral (select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
  cross join lateral private.booking_pricing(s.net) q
  where p.is_published and p.category=p_category and (not p_available_now or (p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')))
    and p_latitude between -90 and 90 and p_longitude between -180 and 180
    and d.km <= least(greatest(p_radius_km,1),50)
    and (p_query='''' or position(lower(left(p_query,100)) in lower(p.display_name||'' ''||array_to_string(p.specialties,'' '')))>0)
  order by d.km,p.id limit 100;
$$;

create or replace function public.request_booking(p_service_id uuid, p_starts_at timestamptz, p_venue text, p_longitude double precision,
  p_latitude double precision, p_notes text, p_request_id uuid,p_expected_total_paise integer)
returns public.bookings language plpgsql security definer set search_path = '''' as $$
declare s public.services; p public.professionals; b public.bookings; finish timestamptz; fees record;
begin
  if auth.uid() is null then raise exception ''Sign in to request a booking''; end if;
  select * into b from public.bookings where client_id=auth.uid() and request_id=p_request_id;
  if found then return b; end if;
  select * into s from public.services where id=p_service_id and active for share;
  if not found then raise exception ''Service is unavailable''; end if;
  select * into p from public.professionals where id=s.professional_id and is_published for update;
  if not found or p.id=auth.uid() then raise exception ''Professional is unavailable''; end if;
  -- Recheck idempotency after taking the professional lock.
  select * into b from public.bookings where client_id=auth.uid() and request_id=p_request_id;
  if found then return b; end if;
  if p_starts_at < now()-interval ''2 minutes'' or p_starts_at > now()+interval ''1 year'' then raise exception ''Choose a valid booking time''; end if;
  if p_starts_at < now()+interval ''15 minutes'' and not p.available_now then raise exception ''This professional requires a scheduled booking''; end if;
  if (select count(*) from public.bookings where client_id=auth.uid() and status=''requested'')>=10 then raise exception ''You have too many pending requests''; end if;
  finish := p_starts_at + make_interval(mins=>s.duration_minutes);
  if exists(select 1 from public.availability_blocks where professional_id=p.id and tstzrange(starts_at,ends_at,''[)'') && tstzrange(p_starts_at,finish,''[)'')) then raise exception ''This time is unavailable''; end if;
  if exists(select 1 from public.bookings where professional_id=p.id and status in (''requested'',''accepted'',''en_route'',''arrived'') and tstzrange(starts_at,ends_at,''[)'') && tstzrange(p_starts_at,finish,''[)'')) then raise exception ''This professional already has a booking at that time''; end if;
  if private.professional_busy(p.id,p_starts_at,finish) then raise exception ''This professional is busy or unavailable for that time. Choose another time or professional.''; end if;
  select * into fees from private.booking_pricing(s.amount_paise);
  if p_expected_total_paise is null or p_expected_total_paise<>fees.total_paise then raise exception ''The booking price has changed. Reopen the service to review the latest price.''; end if;
  insert into public.bookings(client_id,professional_id,service_id,request_id,service_name,amount_paise,
    service_amount_paise,buyer_fee_paise,talent_fee_paise,talent_payout_paise,starts_at,ends_at,venue,venue_longitude,venue_latitude,notes)
    values(auth.uid(),p.id,s.id,p_request_id,s.name,fees.total_paise,fees.service_amount_paise,fees.buyer_fee_paise,fees.talent_fee_paise,fees.talent_payout_paise,
      p_starts_at,finish,trim(p_venue),p_longitude,p_latitude,trim(p_notes)) returning * into b;
  return b;
end;
$$;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610150002') then
      raise exception 'Migration 202610150002 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Prevent overlapping live jobs even if their originally scheduled slots differ.
create or replace function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status=p_status then return b; end if;
  -- Serialize starts across all bookings for this professional.
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
  if p_status='accepted' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then raise exception 'This time has been marked unavailable'; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  -- Preserve refund handling for payment orders created before this change.
  if p_status='cancelled' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status='refund_requested' where booking_id=b.id;
  end if;
  if p_status in ('completed','cancelled','declined') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610150002','single_active_journey',array['-- Prevent overlapping live jobs even if their originally scheduled slots differ.
create or replace function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '''' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception ''Booking not found''; end if;
  if b.status=p_status then return b; end if;
  -- Serialize starts across all bookings for this professional.
  perform 1 from public.professionals where id=b.professional_id for update;
  if p_status=''en_route'' and exists(select 1 from public.bookings other
    where other.professional_id=b.professional_id and other.id<>b.id
      and other.status in (''en_route'',''arrived'')) then
    raise exception ''Finish your current active job before starting another journey'';
  end if;
  if p_status=''cancelled'' then
    if b.status not in (''requested'',''accepted'') then raise exception ''This booking cannot be cancelled''; end if;
  elsif b.professional_id<>auth.uid() then raise exception ''Only the professional can update this status'';
  elsif not ((b.status=''requested'' and p_status in (''accepted'',''declined'')) or
    (b.status=''accepted'' and p_status=''en_route'') or
    (b.status=''en_route'' and p_status=''arrived'') or
    (b.status=''arrived'' and p_status=''completed'')) then raise exception ''Invalid booking transition''; end if;
  if p_status=''accepted'' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,''[)'') && tstzrange(b.starts_at,b.ends_at,''[)'')) then raise exception ''This time has been marked unavailable''; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  -- Preserve refund handling for payment orders created before this change.
  if p_status=''cancelled'' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status=''refund_requested'' where booking_id=b.id;
  end if;
  if p_status in (''completed'',''cancelled'',''declined'') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610150003') then
      raise exception 'Migration 202610150003 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Only disclose names for a booking that belongs to the caller. Private profiles
-- remain private; no phone numbers, email addresses or other profile rows leak.
create function public.booking_participants(p_booking_id uuid)
returns table(client_name text, professional_name text, category public.talent_category)
language sql stable security definer set search_path = '' as $$
  select nullif(trim(c.display_name),''), p.display_name, p.category
  from public.bookings b
  join public.profiles c on c.id=b.client_id
  join public.professionals p on p.id=b.professional_id
  where b.id=p_booking_id and auth.uid() in (b.client_id,b.professional_id);
$$;
revoke all on function public.booking_participants(uuid) from public,anon;
grant execute on function public.booking_participants(uuid) to authenticated;

-- Payment is collected after acceptance and before travel/service. Keep the
-- professional lock, lifecycle checks, cancellation refunds and location cleanup.
create or replace function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
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
  if p_status in ('en_route','arrived','completed') and b.paid_at is null then
    raise exception 'Verified payment is required before the journey and service';
  end if;
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

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610150003','pre_service_payment_and_participants',array['-- Only disclose names for a booking that belongs to the caller. Private profiles
-- remain private; no phone numbers, email addresses or other profile rows leak.
create function public.booking_participants(p_booking_id uuid)
returns table(client_name text, professional_name text, category public.talent_category)
language sql stable security definer set search_path = '''' as $$
  select nullif(trim(c.display_name),''''), p.display_name, p.category
  from public.bookings b
  join public.profiles c on c.id=b.client_id
  join public.professionals p on p.id=b.professional_id
  where b.id=p_booking_id and auth.uid() in (b.client_id,b.professional_id);
$$;
revoke all on function public.booking_participants(uuid) from public,anon;
grant execute on function public.booking_participants(uuid) to authenticated;

-- Payment is collected after acceptance and before travel/service. Keep the
-- professional lock, lifecycle checks, cancellation refunds and location cleanup.
create or replace function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '''' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception ''Booking not found''; end if;
  if b.status=p_status then return b; end if;
  perform 1 from public.professionals where id=b.professional_id for update;
  if p_status=''en_route'' and exists(select 1 from public.bookings other
    where other.professional_id=b.professional_id and other.id<>b.id
      and other.status in (''en_route'',''arrived'')) then
    raise exception ''Finish your current active job before starting another journey'';
  end if;
  if p_status=''cancelled'' then
    if b.status not in (''requested'',''accepted'') then raise exception ''This booking cannot be cancelled''; end if;
  elsif b.professional_id<>auth.uid() then raise exception ''Only the professional can update this status'';
  elsif not ((b.status=''requested'' and p_status in (''accepted'',''declined'')) or
    (b.status=''accepted'' and p_status=''en_route'') or
    (b.status=''en_route'' and p_status=''arrived'') or
    (b.status=''arrived'' and p_status=''completed'')) then raise exception ''Invalid booking transition''; end if;
  if p_status in (''en_route'',''arrived'',''completed'') and b.paid_at is null then
    raise exception ''Verified payment is required before the journey and service'';
  end if;
  if p_status=''accepted'' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,''[)'') && tstzrange(b.starts_at,b.ends_at,''[)'')) then raise exception ''This time has been marked unavailable''; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  if p_status=''cancelled'' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status=''refund_requested'' where booking_id=b.id;
  end if;
  if p_status in (''completed'',''cancelled'',''declined'') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610150004') then
      raise exception 'Migration 202610150004 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Separate migration so enum expansion can commit before any future data writes.
alter type public.talent_category add value if not exists 'HairStylist';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610150004','hair_stylist_category',array['-- Separate migration so enum expansion can commit before any future data writes.
alter type public.talent_category add value if not exists ''HairStylist'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610150005') then
      raise exception 'Migration 202610150005 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
create table public.portfolio_media (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check(provider in ('instagram','youtube','upload')),
  kind text not null check(kind in ('image','video','youtube')),
  media_url text, preview_url text, youtube_id text, storage_path text,
  source_id text, position integer not null default 0,
  updated_at timestamptz not null default now()
);
create index portfolio_media_owner on public.portfolio_media(professional_id,position);
alter table public.portfolio_media enable row level security;
revoke all on public.portfolio_media from anon,authenticated;
-- Source/account metadata is server-only. Customers receive a curated media DTO.
create table public.portfolio_connections (
  professional_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check(provider in ('instagram','youtube')),
  token_cipher text not null, provider_user_id text not null,
  expires_at timestamptz not null, updated_at timestamptz not null default now(),
  primary key(professional_id,provider)
);
alter table public.portfolio_connections enable row level security;
revoke all on public.portfolio_connections from anon,authenticated;
create table public.portfolio_imports (
  id uuid primary key default gen_random_uuid(), professional_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check(provider in ('instagram','youtube')), state_hash text not null unique,
  status text not null default 'pending' check(status in ('pending','processing','complete','failed')),
  message text, expires_at timestamptz not null, created_at timestamptz not null default now()
);
alter table public.portfolio_imports enable row level security;
revoke all on public.portfolio_imports from anon,authenticated;
grant all on public.portfolio_media,public.portfolio_connections,public.portfolio_imports to service_role;
create function public.portfolio_import_status(p_import_id uuid)
returns table(status text,message text) language sql stable security definer set search_path = '' as $$
  select i.status,i.message from public.portfolio_imports i where i.id=p_import_id and i.professional_id=auth.uid();
$$;
revoke all on function public.portfolio_import_status(uuid) from public,anon;
grant execute on function public.portfolio_import_status(uuid) to authenticated;

-- Serialize provider imports, preserve other sources where possible, cap at ten.
create function public.replace_portfolio_media(p_professional_id uuid,p_provider text,p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; slots integer; inserted integer := 0;
begin
  if p_provider not in ('instagram','youtube','upload') or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid portfolio import'; end if;
  perform 1 from public.profiles where id=p_professional_id for update;
  if not found then raise exception 'Profile not found'; end if;
  delete from public.portfolio_media where professional_id=p_professional_id and provider=p_provider;
  -- If another source already fills the gallery, keep its five newest samples.
  delete from public.portfolio_media where id in (select id from public.portfolio_media where professional_id=p_professional_id order by updated_at desc,id offset 5);
  select 10-count(*) into slots from public.portfolio_media where professional_id=p_professional_id;
  for item in select value from jsonb_array_elements(p_items) limit slots loop
    insert into public.portfolio_media(professional_id,provider,kind,media_url,preview_url,youtube_id,storage_path,source_id,position)
    values(p_professional_id,p_provider,item->>'kind',item->>'media_url',item->>'preview_url',item->>'youtube_id',item->>'storage_path',item->>'source_id',inserted);
    inserted := inserted+1;
  end loop;
  return inserted;
end;
$$;
revoke all on function public.replace_portfolio_media(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.replace_portfolio_media(uuid,text,jsonb) to service_role;
create unique index portfolio_upload_path on public.portfolio_media(storage_path) where storage_path is not null;
create function public.append_portfolio_upload(p_professional_id uuid,p_path text,p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.profiles where id=p_professional_id for update;
  if not found or p_kind not in ('image','video') or p_path not like p_professional_id::text||'/%' then raise exception 'Invalid upload'; end if;
  if exists(select 1 from public.portfolio_media where storage_path=p_path) then return; end if;
  if (select count(*) from public.portfolio_media where professional_id=p_professional_id)>=10 then raise exception 'Portfolio is full'; end if;
  insert into public.portfolio_media(professional_id,provider,kind,storage_path,position) values(p_professional_id,'upload',p_kind,p_path,9);
end;
$$;
revoke all on function public.append_portfolio_upload(uuid,text,text) from public,anon,authenticated;
grant execute on function public.append_portfolio_upload(uuid,text,text) to service_role;

-- Preserve the existing atomic profile/service/consent save behind a validating wrapper.
alter function public.save_professional_profile(jsonb,jsonb,jsonb) set schema private;
revoke all on function private.save_professional_profile(jsonb,jsonb,jsonb) from public,anon,authenticated;
create or replace function private.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare category public.talent_category; link text; s_id uuid; profile_specs jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to save your profile'; end if;
  if jsonb_typeof(p_profile)<>'object' or jsonb_typeof(p_private)<>'object' or jsonb_typeof(p_service)<>'object' then raise exception 'Invalid profile'; end if;
  category := (p_profile->>'category')::public.talent_category;
  if jsonb_typeof(p_profile->'portfolio_urls')<>'array' then raise exception 'Invalid portfolio'; end if;
  if jsonb_array_length(p_profile->'portfolio_urls')=0 and not exists(select 1 from public.portfolio_media where professional_id=auth.uid()) then raise exception 'Import or upload your work portfolio'; end if;
  for link in select jsonb_array_elements_text(p_profile->'portfolio_urls') loop
    if link !~ '^https://[^[:space:]]+$' or length(link)>2000 then raise exception 'Use HTTPS work links'; end if;
  end loop;
  profile_specs := coalesce(p_profile->'public_specs','{}'::jsonb);
  if octet_length(profile_specs::text)>65536 then raise exception 'Profile specifications are too large'; end if;
  -- Casting answers are owner-only. Public actor discovery uses selected specialties.
  if category='Actor' then p_private:=profile_specs||p_private; profile_specs:='{}'; end if;
  insert into public.professionals(id,display_name,category,city,bio,specialties,longitude,latitude,portfolio_urls,public_specs,is_published)
  values(auth.uid(),trim(p_profile->>'display_name'),category,trim(p_profile->>'city'),trim(p_profile->>'bio'),
    array(select jsonb_array_elements_text(p_profile->'specialties')),(p_profile->>'longitude')::numeric,(p_profile->>'latitude')::numeric,
    array(select jsonb_array_elements_text(p_profile->'portfolio_urls')),profile_specs,true)
  on conflict(id) do update set display_name=excluded.display_name,category=excluded.category,city=excluded.city,bio=excluded.bio,
    specialties=excluded.specialties,longitude=excluded.longitude,latitude=excluded.latitude,portfolio_urls=excluded.portfolio_urls,public_specs=excluded.public_specs,is_published=true;
  insert into public.professional_private_details(professional_id,details,portfolio_consent_at)
  values(auth.uid(),p_private,now()) on conflict(professional_id) do update set details=excluded.details,portfolio_consent_at=now(),updated_at=now();
  if p_service->>'id' is not null then
    s_id := (p_service->>'id')::uuid;
    if not exists(select 1 from public.services where id=s_id and professional_id=auth.uid()) then raise exception 'Service not found'; end if;
    update public.services set name=trim(p_service->>'name'),amount_paise=(p_service->>'amount_paise')::integer,
      duration_minutes=(p_service->>'duration_minutes')::integer where id=s_id;
  else
    insert into public.services(professional_id,name,amount_paise,duration_minutes)
    values(auth.uid(),trim(p_service->>'name'),(p_service->>'amount_paise')::integer,(p_service->>'duration_minutes')::integer);
  end if;
  delete from public.professional_drafts where professional_id=auth.uid();
end;
$$;

create function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare professional_name text := trim(p_profile->>'display_name');
begin
  if auth.uid() is null then raise exception 'Sign in to save your profile'; end if;
  if professional_name is null or length(professional_name) not between 2 and 80 or professional_name ~* '(https?://|www\.|@)' then
    raise exception 'Choose a professional name of 2-80 characters, without handles or links';
  end if;
  perform private.save_professional_profile(p_profile,p_private,p_service);
end;
$$;
revoke all on function public.save_professional_profile(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_professional_profile(jsonb,jsonb,jsonb) to authenticated;

create table public.booking_reviews (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  client_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professionals(id),
  rating integer not null check(rating between 1 and 5),
  comment text not null default '' check(length(comment)<=2000),
  created_at timestamptz not null default now()
);
create index booking_reviews_professional on public.booking_reviews(professional_id,created_at desc);
alter table public.booking_reviews enable row level security;
revoke all on public.booking_reviews from anon,authenticated;
grant select on public.booking_reviews to authenticated;
grant all on public.booking_reviews to service_role;
create policy participant_reviews on public.booking_reviews for select to authenticated using(auth.uid() in (client_id,professional_id));

create function public.submit_booking_review(p_booking_id uuid,p_rating integer,p_comment text default '')
returns public.booking_reviews language plpgsql security definer set search_path = '' as $$
declare b public.bookings; review public.booking_reviews;
begin
  select * into b from public.bookings where id=p_booking_id and client_id=auth.uid() for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status<>'completed' then raise exception 'Reviews are available after service completion'; end if;
  if b.client_id=b.professional_id then raise exception 'You cannot review your own service'; end if;
  if p_rating is null or p_rating not between 1 and 5 or length(coalesce(p_comment,''))>2000 then raise exception 'Choose 1-5 stars and a review of at most 2000 characters'; end if;
  -- Repeated submissions after a lost response return the original review unchanged.
  select * into review from public.booking_reviews where booking_id=b.id;
  if found then return review; end if;
  insert into public.booking_reviews(booking_id,client_id,professional_id,rating,comment)
  values(b.id,b.client_id,b.professional_id,p_rating,trim(coalesce(p_comment,''))) returning * into review;
  return review;
end;
$$;
revoke all on function public.submit_booking_review(uuid,integer,text) from public,anon;
grant execute on function public.submit_booking_review(uuid,integer,text) to authenticated;

-- Public review previews never disclose customer names, IDs or booking IDs.
create function public.professional_reviews(p_professional_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'count',(select count(*) from public.booking_reviews where professional_id=p.id),
    'average',(select round(avg(rating),1) from public.booking_reviews where professional_id=p.id),
    'reviews',coalesce((select jsonb_agg(jsonb_build_object('rating',r.rating,'comment',r.comment,'created_at',r.created_at) order by r.created_at desc)
      from (select rating,comment,created_at from public.booking_reviews where professional_id=p.id order by created_at desc limit 20) r),'[]'::jsonb)
  ) from public.professionals p where p.id=p_professional_id and (p.is_published or p.id=auth.uid());
$$;
revoke all on function public.professional_reviews(uuid) from public,anon;
grant execute on function public.professional_reviews(uuid) to authenticated;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610150005','portfolios_and_reviews',array['create table public.portfolio_media (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check(provider in (''instagram'',''youtube'',''upload'')),
  kind text not null check(kind in (''image'',''video'',''youtube'')),
  media_url text, preview_url text, youtube_id text, storage_path text,
  source_id text, position integer not null default 0,
  updated_at timestamptz not null default now()
);
create index portfolio_media_owner on public.portfolio_media(professional_id,position);
alter table public.portfolio_media enable row level security;
revoke all on public.portfolio_media from anon,authenticated;
-- Source/account metadata is server-only. Customers receive a curated media DTO.
create table public.portfolio_connections (
  professional_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check(provider in (''instagram'',''youtube'')),
  token_cipher text not null, provider_user_id text not null,
  expires_at timestamptz not null, updated_at timestamptz not null default now(),
  primary key(professional_id,provider)
);
alter table public.portfolio_connections enable row level security;
revoke all on public.portfolio_connections from anon,authenticated;
create table public.portfolio_imports (
  id uuid primary key default gen_random_uuid(), professional_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check(provider in (''instagram'',''youtube'')), state_hash text not null unique,
  status text not null default ''pending'' check(status in (''pending'',''processing'',''complete'',''failed'')),
  message text, expires_at timestamptz not null, created_at timestamptz not null default now()
);
alter table public.portfolio_imports enable row level security;
revoke all on public.portfolio_imports from anon,authenticated;
grant all on public.portfolio_media,public.portfolio_connections,public.portfolio_imports to service_role;
create function public.portfolio_import_status(p_import_id uuid)
returns table(status text,message text) language sql stable security definer set search_path = '''' as $$
  select i.status,i.message from public.portfolio_imports i where i.id=p_import_id and i.professional_id=auth.uid();
$$;
revoke all on function public.portfolio_import_status(uuid) from public,anon;
grant execute on function public.portfolio_import_status(uuid) to authenticated;

-- Serialize provider imports, preserve other sources where possible, cap at ten.
create function public.replace_portfolio_media(p_professional_id uuid,p_provider text,p_items jsonb)
returns integer language plpgsql security definer set search_path = '''' as $$
declare item jsonb; slots integer; inserted integer := 0;
begin
  if p_provider not in (''instagram'',''youtube'',''upload'') or jsonb_typeof(p_items)<>''array'' then raise exception ''Invalid portfolio import''; end if;
  perform 1 from public.profiles where id=p_professional_id for update;
  if not found then raise exception ''Profile not found''; end if;
  delete from public.portfolio_media where professional_id=p_professional_id and provider=p_provider;
  -- If another source already fills the gallery, keep its five newest samples.
  delete from public.portfolio_media where id in (select id from public.portfolio_media where professional_id=p_professional_id order by updated_at desc,id offset 5);
  select 10-count(*) into slots from public.portfolio_media where professional_id=p_professional_id;
  for item in select value from jsonb_array_elements(p_items) limit slots loop
    insert into public.portfolio_media(professional_id,provider,kind,media_url,preview_url,youtube_id,storage_path,source_id,position)
    values(p_professional_id,p_provider,item->>''kind'',item->>''media_url'',item->>''preview_url'',item->>''youtube_id'',item->>''storage_path'',item->>''source_id'',inserted);
    inserted := inserted+1;
  end loop;
  return inserted;
end;
$$;
revoke all on function public.replace_portfolio_media(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.replace_portfolio_media(uuid,text,jsonb) to service_role;
create unique index portfolio_upload_path on public.portfolio_media(storage_path) where storage_path is not null;
create function public.append_portfolio_upload(p_professional_id uuid,p_path text,p_kind text)
returns void language plpgsql security definer set search_path = '''' as $$
begin
  perform 1 from public.profiles where id=p_professional_id for update;
  if not found or p_kind not in (''image'',''video'') or p_path not like p_professional_id::text||''/%'' then raise exception ''Invalid upload''; end if;
  if exists(select 1 from public.portfolio_media where storage_path=p_path) then return; end if;
  if (select count(*) from public.portfolio_media where professional_id=p_professional_id)>=10 then raise exception ''Portfolio is full''; end if;
  insert into public.portfolio_media(professional_id,provider,kind,storage_path,position) values(p_professional_id,''upload'',p_kind,p_path,9);
end;
$$;
revoke all on function public.append_portfolio_upload(uuid,text,text) from public,anon,authenticated;
grant execute on function public.append_portfolio_upload(uuid,text,text) to service_role;

-- Preserve the existing atomic profile/service/consent save behind a validating wrapper.
alter function public.save_professional_profile(jsonb,jsonb,jsonb) set schema private;
revoke all on function private.save_professional_profile(jsonb,jsonb,jsonb) from public,anon,authenticated;
create or replace function private.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path = '''' as $$
declare category public.talent_category; link text; s_id uuid; profile_specs jsonb;
begin
  if auth.uid() is null then raise exception ''Sign in to save your profile''; end if;
  if jsonb_typeof(p_profile)<>''object'' or jsonb_typeof(p_private)<>''object'' or jsonb_typeof(p_service)<>''object'' then raise exception ''Invalid profile''; end if;
  category := (p_profile->>''category'')::public.talent_category;
  if jsonb_typeof(p_profile->''portfolio_urls'')<>''array'' then raise exception ''Invalid portfolio''; end if;
  if jsonb_array_length(p_profile->''portfolio_urls'')=0 and not exists(select 1 from public.portfolio_media where professional_id=auth.uid()) then raise exception ''Import or upload your work portfolio''; end if;
  for link in select jsonb_array_elements_text(p_profile->''portfolio_urls'') loop
    if link !~ ''^https://[^[:space:]]+$'' or length(link)>2000 then raise exception ''Use HTTPS work links''; end if;
  end loop;
  profile_specs := coalesce(p_profile->''public_specs'',''{}''::jsonb);
  if octet_length(profile_specs::text)>65536 then raise exception ''Profile specifications are too large''; end if;
  -- Casting answers are owner-only. Public actor discovery uses selected specialties.
  if category=''Actor'' then p_private:=profile_specs||p_private; profile_specs:=''{}''; end if;
  insert into public.professionals(id,display_name,category,city,bio,specialties,longitude,latitude,portfolio_urls,public_specs,is_published)
  values(auth.uid(),trim(p_profile->>''display_name''),category,trim(p_profile->>''city''),trim(p_profile->>''bio''),
    array(select jsonb_array_elements_text(p_profile->''specialties'')),(p_profile->>''longitude'')::numeric,(p_profile->>''latitude'')::numeric,
    array(select jsonb_array_elements_text(p_profile->''portfolio_urls'')),profile_specs,true)
  on conflict(id) do update set display_name=excluded.display_name,category=excluded.category,city=excluded.city,bio=excluded.bio,
    specialties=excluded.specialties,longitude=excluded.longitude,latitude=excluded.latitude,portfolio_urls=excluded.portfolio_urls,public_specs=excluded.public_specs,is_published=true;
  insert into public.professional_private_details(professional_id,details,portfolio_consent_at)
  values(auth.uid(),p_private,now()) on conflict(professional_id) do update set details=excluded.details,portfolio_consent_at=now(),updated_at=now();
  if p_service->>''id'' is not null then
    s_id := (p_service->>''id'')::uuid;
    if not exists(select 1 from public.services where id=s_id and professional_id=auth.uid()) then raise exception ''Service not found''; end if;
    update public.services set name=trim(p_service->>''name''),amount_paise=(p_service->>''amount_paise'')::integer,
      duration_minutes=(p_service->>''duration_minutes'')::integer where id=s_id;
  else
    insert into public.services(professional_id,name,amount_paise,duration_minutes)
    values(auth.uid(),trim(p_service->>''name''),(p_service->>''amount_paise'')::integer,(p_service->>''duration_minutes'')::integer);
  end if;
  delete from public.professional_drafts where professional_id=auth.uid();
end;
$$;

create function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path = '''' as $$
declare professional_name text := trim(p_profile->>''display_name'');
begin
  if auth.uid() is null then raise exception ''Sign in to save your profile''; end if;
  if professional_name is null or length(professional_name) not between 2 and 80 or professional_name ~* ''(https?://|www\.|@)'' then
    raise exception ''Choose a professional name of 2-80 characters, without handles or links'';
  end if;
  perform private.save_professional_profile(p_profile,p_private,p_service);
end;
$$;
revoke all on function public.save_professional_profile(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_professional_profile(jsonb,jsonb,jsonb) to authenticated;

create table public.booking_reviews (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  client_id uuid not null references public.profiles(id),
  professional_id uuid not null references public.professionals(id),
  rating integer not null check(rating between 1 and 5),
  comment text not null default '''' check(length(comment)<=2000),
  created_at timestamptz not null default now()
);
create index booking_reviews_professional on public.booking_reviews(professional_id,created_at desc);
alter table public.booking_reviews enable row level security;
revoke all on public.booking_reviews from anon,authenticated;
grant select on public.booking_reviews to authenticated;
grant all on public.booking_reviews to service_role;
create policy participant_reviews on public.booking_reviews for select to authenticated using(auth.uid() in (client_id,professional_id));

create function public.submit_booking_review(p_booking_id uuid,p_rating integer,p_comment text default '''')
returns public.booking_reviews language plpgsql security definer set search_path = '''' as $$
declare b public.bookings; review public.booking_reviews;
begin
  select * into b from public.bookings where id=p_booking_id and client_id=auth.uid() for update;
  if not found then raise exception ''Booking not found''; end if;
  if b.status<>''completed'' then raise exception ''Reviews are available after service completion''; end if;
  if b.client_id=b.professional_id then raise exception ''You cannot review your own service''; end if;
  if p_rating is null or p_rating not between 1 and 5 or length(coalesce(p_comment,''''))>2000 then raise exception ''Choose 1-5 stars and a review of at most 2000 characters''; end if;
  -- Repeated submissions after a lost response return the original review unchanged.
  select * into review from public.booking_reviews where booking_id=b.id;
  if found then return review; end if;
  insert into public.booking_reviews(booking_id,client_id,professional_id,rating,comment)
  values(b.id,b.client_id,b.professional_id,p_rating,trim(coalesce(p_comment,''''))) returning * into review;
  return review;
end;
$$;
revoke all on function public.submit_booking_review(uuid,integer,text) from public,anon;
grant execute on function public.submit_booking_review(uuid,integer,text) to authenticated;

-- Public review previews never disclose customer names, IDs or booking IDs.
create function public.professional_reviews(p_professional_id uuid)
returns jsonb language sql stable security definer set search_path = '''' as $$
  select jsonb_build_object(
    ''count'',(select count(*) from public.booking_reviews where professional_id=p.id),
    ''average'',(select round(avg(rating),1) from public.booking_reviews where professional_id=p.id),
    ''reviews'',coalesce((select jsonb_agg(jsonb_build_object(''rating'',r.rating,''comment'',r.comment,''created_at'',r.created_at) order by r.created_at desc)
      from (select rating,comment,created_at from public.booking_reviews where professional_id=p.id order by created_at desc limit 20) r),''[]''::jsonb)
  ) from public.professionals p where p.id=p_professional_id and (p.is_published or p.id=auth.uid());
$$;
revoke all on function public.professional_reviews(uuid) from public,anon;
grant execute on function public.professional_reviews(uuid) to authenticated;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610150006') then
      raise exception 'Migration 202610150006 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
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

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610150006','service_otps',array['-- Keep arrived jobs busy until the customer confirms both service boundaries.
alter table public.bookings add column service_started_at timestamptz,
  add column completion_requested_at timestamptz,
  add column service_ended_at timestamptz;

create table private.service_otps (
  booking_id uuid not null references public.bookings on delete cascade,
  phase text not null check (phase in (''start'',''end'')),
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
returns public.bookings language plpgsql security definer set search_path='''' as $$
begin
  if p_status=''completed'' then raise exception ''Complete service using the customer end OTP''; end if;
  return private.transition_booking(p_booking_id,p_status);
end;
$$;
revoke all on function public.transition_booking(uuid,public.booking_status) from public,anon;
grant execute on function public.transition_booking(uuid,public.booking_status) to authenticated;

-- Only the customer can retrieve a code. Nothing is sent through chat or booking rows.
create function public.service_otp(p_booking_id uuid,p_phase text)
returns jsonb language plpgsql security definer set search_path='''' as $$
declare b public.bookings; o private.service_otps;
begin
  select * into b from public.bookings where id=p_booking_id and client_id=auth.uid() for update;
  if not found then raise exception ''Customer booking not found''; end if;
  if b.status<>''arrived'' or b.paid_at is null or
    not ((p_phase=''start'' and b.service_started_at is null) or
      (p_phase=''end'' and b.service_started_at is not null and b.completion_requested_at is not null)) then
    raise exception ''This service code is not available yet'';
  end if;
  select * into o from private.service_otps where booking_id=b.id and phase=p_phase;
  if not found or o.expires_at<=now() then
    -- gen_random_uuid uses PostgreSQL''s cryptographic random source.
    insert into private.service_otps(booking_id,phase,code,expires_at)
    values(b.id,p_phase,lpad(((''x''||substr(replace(gen_random_uuid()::text,''-'',''''),1,8))::bit(32)::bigint % 1000000)::text,6,''0''),now()+interval ''10 minutes'')
    on conflict(booking_id,phase) do update set code=excluded.code,expires_at=excluded.expires_at,attempts=0
    returning * into o;
  end if;
  return jsonb_build_object(''code'',case when o.attempts<5 then o.code else null end,
    ''expires_at'',o.expires_at,''locked'',o.attempts>=5);
end;
$$;
revoke all on function public.service_otp(uuid,text) from public,anon;
grant execute on function public.service_otp(uuid,text) to authenticated;

create function public.service_action(p_booking_id uuid,p_action text,p_code text default '''')
returns jsonb language plpgsql security definer set search_path='''' as $$
declare b public.bookings; o private.service_otps; v_phase text;
begin
  select * into b from public.bookings where id=p_booking_id and professional_id=auth.uid() for update;
  if not found then raise exception ''Professional booking not found''; end if;
  if b.status<>''arrived'' or b.paid_at is null then raise exception ''A paid, arrived booking is required''; end if;
  if p_action=''request_completion'' then
    if b.service_started_at is null then raise exception ''Verify the start OTP first''; end if;
    update public.bookings set completion_requested_at=coalesce(completion_requested_at,now()) where id=b.id;
    return jsonb_build_object(''ok'',true);
  end if;
  v_phase:=case p_action when ''start'' then ''start'' when ''end'' then ''end'' else null end;
  if v_phase is null then raise exception ''Invalid service action''; end if;
  if (v_phase=''start'' and b.service_started_at is not null) or
    (v_phase=''end'' and (b.service_started_at is null or b.completion_requested_at is null)) then
    raise exception ''Invalid service stage'';
  end if;
  select * into o from private.service_otps where booking_id=b.id and service_otps.phase=v_phase for update;
  if not found or o.expires_at<=now() then return jsonb_build_object(''ok'',false,''message'',''Code expired or unavailable. Ask the customer to refresh their code.''); end if;
  if o.attempts>=5 then return jsonb_build_object(''ok'',false,''message'',''Too many attempts. Wait until the code expires, then ask the customer for a new code.''); end if;
  -- Return failures, rather than raising: failed-attempt counters must commit.
  if p_code is null or p_code !~ ''^[0-9]{6}$'' or p_code<>o.code then
    update private.service_otps set attempts=attempts+1 where booking_id=b.id and service_otps.phase=v_phase;
    return jsonb_build_object(''ok'',false,''message'',''Incorrect OTP. Check the six digits with the customer.'');
  end if;
  delete from private.service_otps where booking_id=b.id and service_otps.phase=v_phase;
  if v_phase=''start'' then
    update public.bookings set service_started_at=now() where id=b.id;
    delete from public.booking_locations where booking_id=b.id;
  else
    update public.bookings set service_ended_at=now() where id=b.id;
    perform private.transition_booking(b.id,''completed'');
    delete from private.service_otps where booking_id=b.id;
  end if;
  return jsonb_build_object(''ok'',true);
end;
$$;
revoke all on function public.service_action(uuid,text,text) from public,anon;
grant execute on function public.service_action(uuid,text,text) to authenticated;

create or replace function public.share_booking_location(p_booking_id uuid,p_longitude double precision,p_latitude double precision,p_heading double precision default null)
returns void language plpgsql security definer set search_path='''' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and professional_id=auth.uid()
    and status in (''en_route'',''arrived'') and service_started_at is null for share;
  if not found then raise exception ''Location sharing requires an active journey''; end if;
  insert into public.booking_locations(booking_id,longitude,latitude,heading) values(p_booking_id,p_longitude,p_latitude,p_heading)
  on conflict(booking_id) do update set longitude=excluded.longitude,latitude=excluded.latitude,heading=excluded.heading,updated_at=now();
end;
$$;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160001') then
      raise exception 'Migration 202610160001 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Team posts and applications are accessed only through participant-aware RPCs.
create table private.team_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles,
  request_id uuid not null,
  title text not null check(length(title) between 3 and 120),
  requirements text not null check(length(requirements) between 20 and 2000),
  starts_at timestamptz not null,
  venue text not null check(length(venue) between 3 and 500),
  longitude double precision not null check(longitude between -180 and 180),
  latitude double precision not null check(latitude between -90 and 90),
  created_at timestamptz not null default now(),
  unique(client_id,request_id)
);
create table private.team_roles (
  event_id uuid not null references private.team_events on delete cascade,
  category public.talent_category not null,
  quantity integer not null check(quantity between 1 and 20),
  primary key(event_id,category)
);
create table private.team_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references private.team_events on delete cascade,
  professional_id uuid not null references public.professionals,
  category public.talent_category not null,
  service_id uuid not null references public.services,
  service_name text not null,
  duration_minutes integer not null,
  net_paise integer not null,
  total_paise integer not null,
  message text not null default '' check(length(message)<=1000),
  booking_id uuid unique references public.bookings,
  created_at timestamptz not null default now(),
  unique(event_id,professional_id)
);
create index team_applications_event on private.team_applications(event_id,category);
alter table private.team_events enable row level security;
alter table private.team_roles enable row level security;
alter table private.team_applications enable row level security;
revoke all on private.team_events,private.team_roles,private.team_applications from public,anon,authenticated;

create function public.create_team_request(p_title text,p_requirements text,p_starts_at timestamptz,
  p_venue text,p_longitude double precision,p_latitude double precision,p_roles jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare event_id uuid; role jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to post a team request'; end if;
  -- Serialize retries and the per-customer posting limit.
  perform 1 from public.profiles where id=auth.uid() for update;
  select id into event_id from private.team_events where client_id=auth.uid() and request_id=p_request_id;
  if found then return event_id; end if;
  if nullif(trim((select display_name from public.profiles where id=auth.uid())),'') is null then
    raise exception 'Save your customer name in Circle before posting'; end if;
  if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval '1 year' then raise exception 'Choose a future event date within one year'; end if;
  if p_longitude is null or p_latitude is null or not(p_longitude between -180 and 180 and p_latitude between -90 and 90) then raise exception 'Choose an accurate event location'; end if;
  if p_roles is null or jsonb_typeof(p_roles)<>'array' then raise exception 'Add the professionals your event needs'; end if;
  if jsonb_array_length(p_roles) not between 1 and 6 then raise exception 'Choose between one and six professions'; end if;
  if (select count(*) from private.team_events where client_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Daily team request limit reached'; end if;
  insert into private.team_events(client_id,request_id,title,requirements,starts_at,venue,longitude,latitude)
    values(auth.uid(),p_request_id,trim(p_title),trim(p_requirements),p_starts_at,trim(p_venue),p_longitude,p_latitude) returning id into event_id;
  for role in select jsonb_array_elements(p_roles) loop
    if jsonb_typeof(role->'quantity')<>'number' or (role->>'quantity') !~ '^[0-9]+$' then raise exception 'Use a whole number of professionals'; end if;
    insert into private.team_roles values(event_id,(role->>'category')::public.talent_category,(role->>'quantity')::integer);
  end loop;
  return event_id;
end;
$$;

create function private.team_selected(p_event_id uuid,p_category public.talent_category)
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer from private.team_applications a join public.bookings b on b.id=a.booking_id
  where a.event_id=p_event_id and a.category=p_category and b.status not in ('cancelled','declined');
$$;
revoke all on function private.team_selected(uuid,public.talent_category) from public,anon,authenticated;

-- Customers see their posts; published professionals see only matching events.
-- Applicant identities and competing quotes are deliberately absent here.
create function public.team_requests() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(event order by created_at desc),'[]'::jsonb) from (
    select e.created_at,jsonb_build_object('id',e.id,'title',e.title,'requirements',e.requirements,
      'starts_at',e.starts_at,'venue',e.venue,'is_owner',e.client_id=auth.uid(),
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

create function public.apply_team_request(p_event_id uuid,p_service_id uuid,p_message text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare e private.team_events; p public.professionals; s public.services; a private.team_applications; fees record; needed integer;
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
  if private.professional_busy(p.id,e.starts_at,e.starts_at+make_interval(mins=>s.duration_minutes)) then raise exception 'You are unavailable at this event time'; end if;
  select * into fees from private.booking_pricing(s.amount_paise);
  insert into private.team_applications(event_id,professional_id,category,service_id,service_name,duration_minutes,net_paise,total_paise,message)
    values(e.id,p.id,p.category,s.id,s.name,s.duration_minutes,s.amount_paise,fees.total_paise,trim(coalesce(p_message,''))) returning id into a.id;
  return a.id;
end;
$$;

create function public.team_applicants(p_event_id uuid) returns jsonb
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

-- A professional's application authorizes acceptance of this particular service.
-- All writes and headcounts share the event lock; booking also locks the provider.
create function public.accept_team_applicant(p_application_id uuid,p_expected_total_paise integer)
returns public.bookings language plpgsql security definer set search_path='' as $$
declare e private.team_events; a private.team_applications; b public.bookings; s public.services; needed integer;
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
  if not found or s.amount_paise<>a.net_paise or s.duration_minutes<>a.duration_minutes or s.name<>a.service_name then
    raise exception 'This service has changed. Ask the professional for a new application'; end if;
  perform 1 from public.professionals where id=a.professional_id and is_published and category=a.category for update;
  if not found then raise exception 'Professional is no longer available for this role'; end if;
  if p_expected_total_paise is null or p_expected_total_paise<>a.total_paise then raise exception 'Review the latest application price before accepting'; end if;
  b:=public.request_booking(a.service_id,e.starts_at,e.venue,e.longitude,e.latitude,
    left(e.title||E'\n'||e.requirements,2000),a.id,a.total_paise);
  update public.bookings set status='accepted' where id=b.id returning * into b;
  update private.team_applications set booking_id=b.id where id=a.id;
  return b;
end;
$$;

-- Pending applicants can withdraw (including to reapply with updated pricing).
create function public.withdraw_team_application(p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from private.team_events where id=p_event_id for update;
  if exists(select 1 from private.team_applications where event_id=p_event_id and professional_id=auth.uid() and booking_id is not null) then
    raise exception 'Manage an accepted application from its booking'; end if;
  delete from private.team_applications where event_id=p_event_id and professional_id=auth.uid() and booking_id is null;
end;
$$;

revoke all on function public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid),
  public.team_requests(),public.apply_team_request(uuid,uuid,text),public.team_applicants(uuid),
  public.accept_team_applicant(uuid,integer),public.withdraw_team_application(uuid) from public,anon;
grant execute on function public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid),
  public.team_requests(),public.apply_team_request(uuid,uuid,text),public.team_applicants(uuid),
  public.accept_team_applicant(uuid,integer),public.withdraw_team_application(uuid) to authenticated;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160001','team_requests',array['-- Team posts and applications are accessed only through participant-aware RPCs.
create table private.team_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles,
  request_id uuid not null,
  title text not null check(length(title) between 3 and 120),
  requirements text not null check(length(requirements) between 20 and 2000),
  starts_at timestamptz not null,
  venue text not null check(length(venue) between 3 and 500),
  longitude double precision not null check(longitude between -180 and 180),
  latitude double precision not null check(latitude between -90 and 90),
  created_at timestamptz not null default now(),
  unique(client_id,request_id)
);
create table private.team_roles (
  event_id uuid not null references private.team_events on delete cascade,
  category public.talent_category not null,
  quantity integer not null check(quantity between 1 and 20),
  primary key(event_id,category)
);
create table private.team_applications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references private.team_events on delete cascade,
  professional_id uuid not null references public.professionals,
  category public.talent_category not null,
  service_id uuid not null references public.services,
  service_name text not null,
  duration_minutes integer not null,
  net_paise integer not null,
  total_paise integer not null,
  message text not null default '''' check(length(message)<=1000),
  booking_id uuid unique references public.bookings,
  created_at timestamptz not null default now(),
  unique(event_id,professional_id)
);
create index team_applications_event on private.team_applications(event_id,category);
alter table private.team_events enable row level security;
alter table private.team_roles enable row level security;
alter table private.team_applications enable row level security;
revoke all on private.team_events,private.team_roles,private.team_applications from public,anon,authenticated;

create function public.create_team_request(p_title text,p_requirements text,p_starts_at timestamptz,
  p_venue text,p_longitude double precision,p_latitude double precision,p_roles jsonb,p_request_id uuid)
returns uuid language plpgsql security definer set search_path='''' as $$
declare event_id uuid; role jsonb;
begin
  if auth.uid() is null then raise exception ''Sign in to post a team request''; end if;
  -- Serialize retries and the per-customer posting limit.
  perform 1 from public.profiles where id=auth.uid() for update;
  select id into event_id from private.team_events where client_id=auth.uid() and request_id=p_request_id;
  if found then return event_id; end if;
  if nullif(trim((select display_name from public.profiles where id=auth.uid())),'''') is null then
    raise exception ''Save your customer name in Circle before posting''; end if;
  if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval ''1 year'' then raise exception ''Choose a future event date within one year''; end if;
  if p_longitude is null or p_latitude is null or not(p_longitude between -180 and 180 and p_latitude between -90 and 90) then raise exception ''Choose an accurate event location''; end if;
  if p_roles is null or jsonb_typeof(p_roles)<>''array'' then raise exception ''Add the professionals your event needs''; end if;
  if jsonb_array_length(p_roles) not between 1 and 6 then raise exception ''Choose between one and six professions''; end if;
  if (select count(*) from private.team_events where client_id=auth.uid() and created_at>now()-interval ''1 day'')>=20 then raise exception ''Daily team request limit reached''; end if;
  insert into private.team_events(client_id,request_id,title,requirements,starts_at,venue,longitude,latitude)
    values(auth.uid(),p_request_id,trim(p_title),trim(p_requirements),p_starts_at,trim(p_venue),p_longitude,p_latitude) returning id into event_id;
  for role in select jsonb_array_elements(p_roles) loop
    if jsonb_typeof(role->''quantity'')<>''number'' or (role->>''quantity'') !~ ''^[0-9]+$'' then raise exception ''Use a whole number of professionals''; end if;
    insert into private.team_roles values(event_id,(role->>''category'')::public.talent_category,(role->>''quantity'')::integer);
  end loop;
  return event_id;
end;
$$;

create function private.team_selected(p_event_id uuid,p_category public.talent_category)
returns integer language sql stable security definer set search_path='''' as $$
  select count(*)::integer from private.team_applications a join public.bookings b on b.id=a.booking_id
  where a.event_id=p_event_id and a.category=p_category and b.status not in (''cancelled'',''declined'');
$$;
revoke all on function private.team_selected(uuid,public.talent_category) from public,anon,authenticated;

-- Customers see their posts; published professionals see only matching events.
-- Applicant identities and competing quotes are deliberately absent here.
create function public.team_requests() returns jsonb language sql stable security definer set search_path='''' as $$
  select coalesce(jsonb_agg(event order by created_at desc),''[]''::jsonb) from (
    select e.created_at,jsonb_build_object(''id'',e.id,''title'',e.title,''requirements'',e.requirements,
      ''starts_at'',e.starts_at,''venue'',e.venue,''is_owner'',e.client_id=auth.uid(),
      ''roles'',(select jsonb_agg(jsonb_build_object(''category'',r.category,''quantity'',r.quantity,
        ''selected'',private.team_selected(e.id,r.category)) order by r.category) from private.team_roles r where r.event_id=e.id),
      ''my_application'',(select jsonb_build_object(''id'',a.id,''service_name'',a.service_name,''net_paise'',a.net_paise,
        ''booking_id'',a.booking_id,''booking_status'',b.status) from private.team_applications a
        left join public.bookings b on b.id=a.booking_id where a.event_id=e.id and a.professional_id=auth.uid())) as event
    from private.team_events e where e.client_id=auth.uid() or (e.starts_at>now() and exists(
      select 1 from public.professionals p join private.team_roles r on r.category=p.category
      where p.id=auth.uid() and p.is_published and r.event_id=e.id))
    order by e.created_at desc limit 100
  ) events;
$$;

create function public.apply_team_request(p_event_id uuid,p_service_id uuid,p_message text default '''')
returns uuid language plpgsql security definer set search_path='''' as $$
declare e private.team_events; p public.professionals; s public.services; a private.team_applications; fees record; needed integer;
begin
  select * into e from private.team_events where id=p_event_id for update;
  if not found or e.client_id=auth.uid() or e.starts_at<=now() then raise exception ''This team request is unavailable''; end if;
  select * into p from public.professionals where id=auth.uid() and is_published;
  if not found then raise exception ''Publish your professional profile before applying''; end if;
  select quantity into needed from private.team_roles where event_id=e.id and category=p.category;
  if not found then raise exception ''This event does not need your profession''; end if;
  select * into a from private.team_applications where event_id=e.id and professional_id=p.id;
  if found then return a.id; end if;
  if private.team_selected(e.id,p.category)>=needed then raise exception ''This profession is already filled''; end if;
  select * into s from public.services where id=p_service_id and professional_id=p.id and active for share;
  if not found then raise exception ''Choose one of your active services''; end if;
  if private.professional_busy(p.id,e.starts_at,e.starts_at+make_interval(mins=>s.duration_minutes)) then raise exception ''You are unavailable at this event time''; end if;
  select * into fees from private.booking_pricing(s.amount_paise);
  insert into private.team_applications(event_id,professional_id,category,service_id,service_name,duration_minutes,net_paise,total_paise,message)
    values(e.id,p.id,p.category,s.id,s.name,s.duration_minutes,s.amount_paise,fees.total_paise,trim(coalesce(p_message,''''))) returning id into a.id;
  return a.id;
end;
$$;

create function public.team_applicants(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path='''' as $$
begin
  if not exists(select 1 from private.team_events where id=p_event_id and client_id=auth.uid()) then raise exception ''Customer event not found''; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(''id'',a.id,''professional_id'',a.professional_id,
    ''professional_name'',p.display_name,''category'',a.category,''bio'',p.bio,''city'',p.city,
    ''service_name'',a.service_name,''duration_minutes'',a.duration_minutes,''total_paise'',a.total_paise,
    ''message'',a.message,''booking_id'',a.booking_id,''booking_status'',b.status) order by a.created_at),''[]''::jsonb)
    from private.team_applications a join public.professionals p on p.id=a.professional_id
    left join public.bookings b on b.id=a.booking_id where a.event_id=p_event_id);
end;
$$;

-- A professional''s application authorizes acceptance of this particular service.
-- All writes and headcounts share the event lock; booking also locks the provider.
create function public.accept_team_applicant(p_application_id uuid,p_expected_total_paise integer)
returns public.bookings language plpgsql security definer set search_path='''' as $$
declare e private.team_events; a private.team_applications; b public.bookings; s public.services; needed integer;
begin
  select e1.* into e from private.team_events e1 join private.team_applications a1 on a1.event_id=e1.id
    where a1.id=p_application_id and e1.client_id=auth.uid() for update of e1;
  if not found then raise exception ''Customer application not found''; end if;
  select * into a from private.team_applications where id=p_application_id for update;
  if a.booking_id is not null then select * into b from public.bookings where id=a.booking_id; return b; end if;
  if e.starts_at<=now() then raise exception ''This event has already started''; end if;
  select quantity into needed from private.team_roles where event_id=e.id and category=a.category;
  if private.team_selected(e.id,a.category)>=needed then raise exception ''The requested headcount is already filled''; end if;
  select * into s from public.services where id=a.service_id and active for share;
  if not found or s.amount_paise<>a.net_paise or s.duration_minutes<>a.duration_minutes or s.name<>a.service_name then
    raise exception ''This service has changed. Ask the professional for a new application''; end if;
  perform 1 from public.professionals where id=a.professional_id and is_published and category=a.category for update;
  if not found then raise exception ''Professional is no longer available for this role''; end if;
  if p_expected_total_paise is null or p_expected_total_paise<>a.total_paise then raise exception ''Review the latest application price before accepting''; end if;
  b:=public.request_booking(a.service_id,e.starts_at,e.venue,e.longitude,e.latitude,
    left(e.title||E''\n''||e.requirements,2000),a.id,a.total_paise);
  update public.bookings set status=''accepted'' where id=b.id returning * into b;
  update private.team_applications set booking_id=b.id where id=a.id;
  return b;
end;
$$;

-- Pending applicants can withdraw (including to reapply with updated pricing).
create function public.withdraw_team_application(p_event_id uuid) returns void
language plpgsql security definer set search_path='''' as $$
begin
  perform 1 from private.team_events where id=p_event_id for update;
  if exists(select 1 from private.team_applications where event_id=p_event_id and professional_id=auth.uid() and booking_id is not null) then
    raise exception ''Manage an accepted application from its booking''; end if;
  delete from private.team_applications where event_id=p_event_id and professional_id=auth.uid() and booking_id is null;
end;
$$;

revoke all on function public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid),
  public.team_requests(),public.apply_team_request(uuid,uuid,text),public.team_applicants(uuid),
  public.accept_team_applicant(uuid,integer),public.withdraw_team_application(uuid) from public,anon;
grant execute on function public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid),
  public.team_requests(),public.apply_team_request(uuid,uuid,text),public.team_applicants(uuid),
  public.accept_team_applicant(uuid,integer),public.withdraw_team_application(uuid) to authenticated;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160002') then
      raise exception 'Migration 202610160002 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Account identity stays in the owner-only profile, separate from public talent names.
alter table public.profiles add column full_name text not null default '' check(length(full_name)<=120),
  add column contact_email text check(length(contact_email)<=254),
  add column registration_completed_at timestamptz,
  add column professional_display_name text check(length(professional_display_name) between 2 and 80);
update public.profiles set full_name=display_name;
-- Shorten legacy public names only where the stored private name identifies them.
update public.professionals p set display_name=case
  when length(split_part(regexp_replace(trim(c.full_name),'\s+',' ','g'),' ',1))>=2 then split_part(regexp_replace(trim(c.full_name),'\s+',' ','g'),' ',1)
  else split_part(regexp_replace(trim(c.full_name),'\s+',' ','g'),' ',1)||' Creative' end
from public.profiles c where c.id=p.id and trim(c.full_name) ~ '[[:space:]]'
  and position(lower(regexp_replace(trim(c.full_name),'\s+',' ','g')) in lower(regexp_replace(trim(p.display_name),'\s+',' ','g')))>0;

create function public.my_registration() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.profiles; u auth.users;
begin
  if auth.uid() is null then raise exception 'Sign in to complete your profile'; end if;
  select * into p from public.profiles where id=auth.uid();
  select * into u from auth.users where id=auth.uid();
  return jsonb_build_object('full_name',coalesce(nullif(p.full_name,''),nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),''),'email',coalesce(nullif(u.email,''),p.contact_email,''),
    'email_from_sign_in',nullif(u.email,'') is not null,
    'phone_verified',nullif(u.phone,'') is not null and u.phone_confirmed_at is not null,
    'completed_at',p.registration_completed_at,'professional_name',coalesce(p.professional_display_name,''));
end;
$$;

create function public.complete_registration(p_full_name text,p_email text,p_professional_name text default null,p_professional boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; account_name text:=regexp_replace(trim(p_full_name),'\s+',' ','g');
  public_name text:=regexp_replace(trim(p_professional_name),'\s+',' ','g'); email_value text;
begin
  if auth.uid() is null then raise exception 'Sign in to complete your profile'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  select * into u from auth.users where id=auth.uid();
  if nullif(u.phone,'') is null or u.phone_confirmed_at is null then raise exception 'Verify your mobile number first'; end if;
  if account_name is null or length(account_name) not between 2 and 120 or account_name ~* '(https?://|www\.|@)' then raise exception 'Enter your full name (2-120 characters)'; end if;
  email_value:=lower(trim(coalesce(nullif(u.email,''),p_email)));
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
  if p_professional and (public_name is null or length(public_name) not between 2 and 80 or public_name ~* '(https?://|www\.|@)') then
    raise exception 'Choose a public display or pen name (2-80 characters), without handles or links'; end if;
  if public_name is not null and (length(public_name) not between 2 and 80 or public_name ~* '(https?://|www\.|@)') then
    raise exception 'Choose a valid public display or pen name'; end if;
  if public_name is null then select professional_display_name into public_name from public.profiles where id=auth.uid(); end if;
  if account_name ~ '[[:space:]]' and position(lower(account_name) in lower(public_name))>0 then raise exception 'Use a pen name or first name instead of your full name for your public professional name'; end if;
  update public.profiles set full_name=account_name,display_name=account_name,contact_email=email_value,
    professional_display_name=public_name,registration_completed_at=coalesce(registration_completed_at,now()) where id=auth.uid();
  if public_name is not null then update public.professionals set display_name=public_name where id=auth.uid(); end if;
  return public.my_registration();
end;
$$;

create function public.save_customer_full_name(p_name text) returns void language plpgsql security definer set search_path='' as $$
declare value text:=regexp_replace(trim(p_name),'\s+',' ','g'); public_name text;
begin
  if auth.uid() is null then raise exception 'Sign in to update your name'; end if;
  if value is null or length(value) not between 2 and 120 or value ~* '(https?://|www\.|@)' then raise exception 'Enter your full name (2-120 characters)'; end if;
  select professional_display_name into public_name from public.profiles where id=auth.uid() for update;
  if value ~ '[[:space:]]' and position(lower(value) in lower(public_name))>0 then raise exception 'Choose a different public professional name before saving this full name'; end if;
  update public.profiles set full_name=value,display_name=value where id=auth.uid();
end;
$$;
revoke update(display_name) on public.profiles from authenticated;

-- All customer-facing professional surfaces already read professionals.display_name.
-- Keep publishing from copying the private full name into that public field.
create or replace function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare professional_name text:=regexp_replace(trim(p_profile->>'display_name'),'\s+',' ','g'); account_name text;
begin
  if auth.uid() is null then raise exception 'Sign in to save your profile'; end if;
  if professional_name is null or length(professional_name) not between 2 and 80 or professional_name ~* '(https?://|www\.|@)' then
    raise exception 'Choose a professional name of 2-80 characters, without handles or links'; end if;
  select full_name into account_name from public.profiles where id=auth.uid() for update;
  if account_name ~ '[[:space:]]' and position(lower(account_name) in lower(professional_name))>0 then
    raise exception 'Use a pen name or first name instead of your full name for your public professional name'; end if;
  perform private.save_professional_profile(jsonb_set(p_profile,'{display_name}',to_jsonb(professional_name)),p_private,p_service);
  update public.profiles set professional_display_name=professional_name where id=auth.uid();
end;
$$;

revoke all on function public.my_registration(),public.complete_registration(text,text,text,boolean),public.save_customer_full_name(text) from public,anon;
grant execute on function public.my_registration(),public.complete_registration(text,text,text,boolean),public.save_customer_full_name(text) to authenticated;

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160002','registration_and_private_names',array['-- Account identity stays in the owner-only profile, separate from public talent names.
alter table public.profiles add column full_name text not null default '''' check(length(full_name)<=120),
  add column contact_email text check(length(contact_email)<=254),
  add column registration_completed_at timestamptz,
  add column professional_display_name text check(length(professional_display_name) between 2 and 80);
update public.profiles set full_name=display_name;
-- Shorten legacy public names only where the stored private name identifies them.
update public.professionals p set display_name=case
  when length(split_part(regexp_replace(trim(c.full_name),''\s+'','' '',''g''),'' '',1))>=2 then split_part(regexp_replace(trim(c.full_name),''\s+'','' '',''g''),'' '',1)
  else split_part(regexp_replace(trim(c.full_name),''\s+'','' '',''g''),'' '',1)||'' Creative'' end
from public.profiles c where c.id=p.id and trim(c.full_name) ~ ''[[:space:]]''
  and position(lower(regexp_replace(trim(c.full_name),''\s+'','' '',''g'')) in lower(regexp_replace(trim(p.display_name),''\s+'','' '',''g'')))>0;

create function public.my_registration() returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare p public.profiles; u auth.users;
begin
  if auth.uid() is null then raise exception ''Sign in to complete your profile''; end if;
  select * into p from public.profiles where id=auth.uid();
  select * into u from auth.users where id=auth.uid();
  return jsonb_build_object(''full_name'',coalesce(nullif(p.full_name,''''),nullif(u.raw_user_meta_data->>''full_name'',''''),nullif(u.raw_user_meta_data->>''name'',''''),''''),''email'',coalesce(nullif(u.email,''''),p.contact_email,''''),
    ''email_from_sign_in'',nullif(u.email,'''') is not null,
    ''phone_verified'',nullif(u.phone,'''') is not null and u.phone_confirmed_at is not null,
    ''completed_at'',p.registration_completed_at,''professional_name'',coalesce(p.professional_display_name,''''));
end;
$$;

create function public.complete_registration(p_full_name text,p_email text,p_professional_name text default null,p_professional boolean default false)
returns jsonb language plpgsql security definer set search_path='''' as $$
declare u auth.users; account_name text:=regexp_replace(trim(p_full_name),''\s+'','' '',''g'');
  public_name text:=regexp_replace(trim(p_professional_name),''\s+'','' '',''g''); email_value text;
begin
  if auth.uid() is null then raise exception ''Sign in to complete your profile''; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  select * into u from auth.users where id=auth.uid();
  if nullif(u.phone,'''') is null or u.phone_confirmed_at is null then raise exception ''Verify your mobile number first''; end if;
  if account_name is null or length(account_name) not between 2 and 120 or account_name ~* ''(https?://|www\.|@)'' then raise exception ''Enter your full name (2-120 characters)''; end if;
  email_value:=lower(trim(coalesce(nullif(u.email,''''),p_email)));
  if email_value is null or length(email_value)>254 or email_value !~ ''^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'' then raise exception ''Enter a valid email address''; end if;
  if p_professional and (public_name is null or length(public_name) not between 2 and 80 or public_name ~* ''(https?://|www\.|@)'') then
    raise exception ''Choose a public display or pen name (2-80 characters), without handles or links''; end if;
  if public_name is not null and (length(public_name) not between 2 and 80 or public_name ~* ''(https?://|www\.|@)'') then
    raise exception ''Choose a valid public display or pen name''; end if;
  if public_name is null then select professional_display_name into public_name from public.profiles where id=auth.uid(); end if;
  if account_name ~ ''[[:space:]]'' and position(lower(account_name) in lower(public_name))>0 then raise exception ''Use a pen name or first name instead of your full name for your public professional name''; end if;
  update public.profiles set full_name=account_name,display_name=account_name,contact_email=email_value,
    professional_display_name=public_name,registration_completed_at=coalesce(registration_completed_at,now()) where id=auth.uid();
  if public_name is not null then update public.professionals set display_name=public_name where id=auth.uid(); end if;
  return public.my_registration();
end;
$$;

create function public.save_customer_full_name(p_name text) returns void language plpgsql security definer set search_path='''' as $$
declare value text:=regexp_replace(trim(p_name),''\s+'','' '',''g''); public_name text;
begin
  if auth.uid() is null then raise exception ''Sign in to update your name''; end if;
  if value is null or length(value) not between 2 and 120 or value ~* ''(https?://|www\.|@)'' then raise exception ''Enter your full name (2-120 characters)''; end if;
  select professional_display_name into public_name from public.profiles where id=auth.uid() for update;
  if value ~ ''[[:space:]]'' and position(lower(value) in lower(public_name))>0 then raise exception ''Choose a different public professional name before saving this full name''; end if;
  update public.profiles set full_name=value,display_name=value where id=auth.uid();
end;
$$;
revoke update(display_name) on public.profiles from authenticated;

-- All customer-facing professional surfaces already read professionals.display_name.
-- Keep publishing from copying the private full name into that public field.
create or replace function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path='''' as $$
declare professional_name text:=regexp_replace(trim(p_profile->>''display_name''),''\s+'','' '',''g''); account_name text;
begin
  if auth.uid() is null then raise exception ''Sign in to save your profile''; end if;
  if professional_name is null or length(professional_name) not between 2 and 80 or professional_name ~* ''(https?://|www\.|@)'' then
    raise exception ''Choose a professional name of 2-80 characters, without handles or links''; end if;
  select full_name into account_name from public.profiles where id=auth.uid() for update;
  if account_name ~ ''[[:space:]]'' and position(lower(account_name) in lower(professional_name))>0 then
    raise exception ''Use a pen name or first name instead of your full name for your public professional name''; end if;
  perform private.save_professional_profile(jsonb_set(p_profile,''{display_name}'',to_jsonb(professional_name)),p_private,p_service);
  update public.profiles set professional_display_name=professional_name where id=auth.uid();
end;
$$;

revoke all on function public.my_registration(),public.complete_registration(text,text,text,boolean),public.save_customer_full_name(text) from public,anon;
grant execute on function public.my_registration(),public.complete_registration(text,text,text,boolean),public.save_customer_full_name(text) to authenticated;
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160003') then
      raise exception 'Migration 202610160003 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- A single authoritative query prevents completed/reviewed reminders reappearing.
create function public.booking_activity() returns setof public.bookings
language sql stable security definer set search_path='' as $$
  select b.* from public.bookings b where b.client_id=auth.uid() and (
    b.status in ('requested','accepted','en_route','arrived') or
    (b.status='completed' and not exists(select 1 from public.booking_reviews r where r.booking_id=b.id))
  ) order by case b.status when 'en_route' then 0 when 'arrived' then 0 when 'accepted' then 1 when 'requested' then 2 else 3 end,
    case when b.status<>'completed' then b.starts_at end asc,
    case when b.status='completed' then b.created_at end desc,b.id limit 1;
$$;
revoke all on function public.booking_activity() from public,anon;
grant execute on function public.booking_activity() to authenticated;

create function private.booking_chat_open(p_booking_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.bookings b where b.id=p_booking_id and auth.uid() in (b.client_id,b.professional_id)
    and b.paid_at is not null and b.status in ('accepted','en_route','arrived') and b.service_ended_at is null);
$$;
revoke all on function private.booking_chat_open(uuid) from public,anon;
grant execute on function private.booking_chat_open(uuid) to authenticated;
drop policy view_messages on public.messages;
drop policy send_messages on public.messages;
create policy view_messages on public.messages for select to authenticated using(private.booking_chat_open(booking_id));
create policy send_messages on public.messages for insert to authenticated
  with check(sender_id=auth.uid() and private.booking_chat_open(booking_id));

-- Serialize message inserts with service completion so concurrent sends cannot
-- recreate a conversation after completion's cleanup commits.
create function private.guard_booking_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.bookings where id=new.booking_id and auth.uid() in (client_id,professional_id)
    and paid_at is not null and status in ('accepted','en_route','arrived') and service_ended_at is null for share;
  if not found or new.sender_id<>auth.uid() then raise exception 'Messaging requires a paid, active booking' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_message() from public,anon,authenticated;
create trigger guard_booking_message before insert on public.messages for each row execute function private.guard_booking_message();

create function private.clear_closed_booking_chat() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('completed','cancelled','declined') or new.service_ended_at is not null then
    delete from public.messages where booking_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_closed_booking_chat() from public,anon,authenticated;
create trigger clear_closed_booking_chat after update of status,service_ended_at on public.bookings
  for each row execute function private.clear_closed_booking_chat();
-- Apply the same end-of-session policy to existing closed bookings.
delete from public.messages m using public.bookings b where b.id=m.booking_id
  and (b.status in ('completed','cancelled','declined') or b.service_ended_at is not null);

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160003','activity_and_paid_chat',array['-- A single authoritative query prevents completed/reviewed reminders reappearing.
create function public.booking_activity() returns setof public.bookings
language sql stable security definer set search_path='''' as $$
  select b.* from public.bookings b where b.client_id=auth.uid() and (
    b.status in (''requested'',''accepted'',''en_route'',''arrived'') or
    (b.status=''completed'' and not exists(select 1 from public.booking_reviews r where r.booking_id=b.id))
  ) order by case b.status when ''en_route'' then 0 when ''arrived'' then 0 when ''accepted'' then 1 when ''requested'' then 2 else 3 end,
    case when b.status<>''completed'' then b.starts_at end asc,
    case when b.status=''completed'' then b.created_at end desc,b.id limit 1;
$$;
revoke all on function public.booking_activity() from public,anon;
grant execute on function public.booking_activity() to authenticated;

create function private.booking_chat_open(p_booking_id uuid) returns boolean
language sql stable security definer set search_path='''' as $$
  select exists(select 1 from public.bookings b where b.id=p_booking_id and auth.uid() in (b.client_id,b.professional_id)
    and b.paid_at is not null and b.status in (''accepted'',''en_route'',''arrived'') and b.service_ended_at is null);
$$;
revoke all on function private.booking_chat_open(uuid) from public,anon;
grant execute on function private.booking_chat_open(uuid) to authenticated;
drop policy view_messages on public.messages;
drop policy send_messages on public.messages;
create policy view_messages on public.messages for select to authenticated using(private.booking_chat_open(booking_id));
create policy send_messages on public.messages for insert to authenticated
  with check(sender_id=auth.uid() and private.booking_chat_open(booking_id));

-- Serialize message inserts with service completion so concurrent sends cannot
-- recreate a conversation after completion''s cleanup commits.
create function private.guard_booking_message() returns trigger language plpgsql security definer set search_path='''' as $$
begin
  perform 1 from public.bookings where id=new.booking_id and auth.uid() in (client_id,professional_id)
    and paid_at is not null and status in (''accepted'',''en_route'',''arrived'') and service_ended_at is null for share;
  if not found or new.sender_id<>auth.uid() then raise exception ''Messaging requires a paid, active booking'' using errcode=''42501''; end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_message() from public,anon,authenticated;
create trigger guard_booking_message before insert on public.messages for each row execute function private.guard_booking_message();

create function private.clear_closed_booking_chat() returns trigger language plpgsql security definer set search_path='''' as $$
begin
  if new.status in (''completed'',''cancelled'',''declined'') or new.service_ended_at is not null then
    delete from public.messages where booking_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_closed_booking_chat() from public,anon,authenticated;
create trigger clear_closed_booking_chat after update of status,service_ended_at on public.bookings
  for each row execute function private.clear_closed_booking_chat();
-- Apply the same end-of-session policy to existing closed bookings.
delete from public.messages m using public.bookings b where b.id=m.booking_id
  and (b.status in (''completed'',''cancelled'',''declined'') or b.service_ended_at is not null);
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160004') then
      raise exception 'Migration 202610160004 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- GPS is private; discovery exposes only fresh online, non-busy locations.
create table private.professional_live_locations (
 professional_id uuid primary key references public.professionals on delete cascade,
 longitude double precision not null check(longitude between -180 and 180),
 latitude double precision not null check(latitude between -90 and 90),
 updated_at timestamptz not null default now()
);
revoke all on private.professional_live_locations from public,anon,authenticated;
create function public.publish_professional_location(p_longitude double precision,p_latitude double precision)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.professionals where id=auth.uid() and is_published and available_now) then
  raise exception 'Go online with a published professional profile to share your location';
 end if;
 if p_longitude is null or p_latitude is null or not(p_longitude between -180 and 180 and p_latitude between -90 and 90) then raise exception 'Invalid location'; end if;
 insert into private.professional_live_locations(professional_id,longitude,latitude)
 values(auth.uid(),p_longitude,p_latitude) on conflict(professional_id)
 do update set longitude=excluded.longitude,latitude=excluded.latitude,updated_at=now();
end;
$$;
create function public.clear_professional_location() returns void language sql security definer set search_path='' as $$
 delete from private.professional_live_locations where professional_id=auth.uid();
$$;
revoke all on function public.publish_professional_location(double precision,double precision),public.clear_professional_location() from public,anon;
grant execute on function public.publish_professional_location(double precision,double precision),public.clear_professional_location() to authenticated;

create function public.discover_live_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer,location_updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,(l.professional_id is not null),coalesce(l.longitude,p.longitude)::numeric,coalesce(l.latitude,p.latitude)::numeric,p.portfolio_urls,d.km,q.total_paise,l.updated_at
  from public.professionals p left join private.professional_live_locations l on l.professional_id=p.id and l.updated_at>now()-interval '90 seconds' and p.available_now and not private.professional_busy(p.id,now(),now()+interval '15 minutes')
 cross join lateral (
    select 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(coalesce(l.latitude,p.latitude)::double precision-p_latitude)/2),2) +
      cos(radians(p_latitude))*cos(radians(coalesce(l.latitude,p.latitude)::double precision))*power(sin(radians(coalesce(l.longitude,p.longitude)::double precision-p_longitude)/2),2)
    )))) as km
  ) d join lateral (select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
  cross join lateral private.booking_pricing(s.net) q
  where auth.uid() is not null and p.is_published and p.category=p_category and (not p_available_now or l.professional_id is not null)
    and p_latitude between -90 and 90 and p_longitude between -180 and 180
    and d.km <= least(greatest(p_radius_km,1),50)
    and (p_query='' or position(lower(left(p_query,100)) in lower(p.display_name||' '||array_to_string(p.specialties,' ')))>0)
  order by d.km,p.id limit 100;
$$;

revoke all on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) from public,anon;
grant execute on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) to authenticated;
notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160004','professional_live_locations',array['-- GPS is private; discovery exposes only fresh online, non-busy locations.
create table private.professional_live_locations (
 professional_id uuid primary key references public.professionals on delete cascade,
 longitude double precision not null check(longitude between -180 and 180),
 latitude double precision not null check(latitude between -90 and 90),
 updated_at timestamptz not null default now()
);
revoke all on private.professional_live_locations from public,anon,authenticated;
create function public.publish_professional_location(p_longitude double precision,p_latitude double precision)
returns void language plpgsql security definer set search_path='''' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.professionals where id=auth.uid() and is_published and available_now) then
  raise exception ''Go online with a published professional profile to share your location'';
 end if;
 if p_longitude is null or p_latitude is null or not(p_longitude between -180 and 180 and p_latitude between -90 and 90) then raise exception ''Invalid location''; end if;
 insert into private.professional_live_locations(professional_id,longitude,latitude)
 values(auth.uid(),p_longitude,p_latitude) on conflict(professional_id)
 do update set longitude=excluded.longitude,latitude=excluded.latitude,updated_at=now();
end;
$$;
create function public.clear_professional_location() returns void language sql security definer set search_path='''' as $$
 delete from private.professional_live_locations where professional_id=auth.uid();
$$;
revoke all on function public.publish_professional_location(double precision,double precision),public.clear_professional_location() from public,anon;
grant execute on function public.publish_professional_location(double precision,double precision),public.clear_professional_location() to authenticated;

create function public.discover_live_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '''', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer,location_updated_at timestamptz)
language sql stable security definer set search_path = '''' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,(l.professional_id is not null),coalesce(l.longitude,p.longitude)::numeric,coalesce(l.latitude,p.latitude)::numeric,p.portfolio_urls,d.km,q.total_paise,l.updated_at
  from public.professionals p left join private.professional_live_locations l on l.professional_id=p.id and l.updated_at>now()-interval ''90 seconds'' and p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')
 cross join lateral (
    select 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(coalesce(l.latitude,p.latitude)::double precision-p_latitude)/2),2) +
      cos(radians(p_latitude))*cos(radians(coalesce(l.latitude,p.latitude)::double precision))*power(sin(radians(coalesce(l.longitude,p.longitude)::double precision-p_longitude)/2),2)
    )))) as km
  ) d join lateral (select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
  cross join lateral private.booking_pricing(s.net) q
  where auth.uid() is not null and p.is_published and p.category=p_category and (not p_available_now or l.professional_id is not null)
    and p_latitude between -90 and 90 and p_longitude between -180 and 180
    and d.km <= least(greatest(p_radius_km,1),50)
    and (p_query='''' or position(lower(left(p_query,100)) in lower(p.display_name||'' ''||array_to_string(p.specialties,'' '')))>0)
  order by d.km,p.id limit 100;
$$;

revoke all on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) from public,anon;
grant execute on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) to authenticated;
notify pgrst, ''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160005') then
      raise exception 'Migration 202610160005 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
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

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160005','discovery_availability_independent_gps',array['-- Booking availability must not depend on GPS permission or freshness.
create or replace function public.discover_live_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '''', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer,location_updated_at timestamptz)
language sql stable security definer set search_path = '''' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,(p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')),coalesce(l.longitude,p.longitude)::numeric,coalesce(l.latitude,p.latitude)::numeric,p.portfolio_urls,d.km,q.total_paise,l.updated_at
  from public.professionals p left join private.professional_live_locations l on l.professional_id=p.id and l.updated_at>now()-interval ''90 seconds'' and p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')
 cross join lateral (
    select 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(coalesce(l.latitude,p.latitude)::double precision-p_latitude)/2),2) +
      cos(radians(p_latitude))*cos(radians(coalesce(l.latitude,p.latitude)::double precision))*power(sin(radians(coalesce(l.longitude,p.longitude)::double precision-p_longitude)/2),2)
    )))) as km
  ) d join lateral (select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
  cross join lateral private.booking_pricing(s.net) q
  where auth.uid() is not null and p.is_published and p.category=p_category and (not p_available_now or (p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')))
    and p_latitude between -90 and 90 and p_longitude between -180 and 180
    and d.km <= least(greatest(p_radius_km,1),50)
    and (p_query='''' or position(lower(left(p_query,100)) in lower(p.display_name||'' ''||array_to_string(p.specialties,'' '')))>0)
  order by d.km,p.id limit 100;
$$;

revoke all on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) from public,anon;
grant execute on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) to authenticated;
notify pgrst, ''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160006') then
      raise exception 'Migration 202610160006 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Preserve browser-provided uncertainty instead of rejecting desktop/Wi-Fi locations.
alter table private.professional_live_locations add column accuracy_meters double precision check(accuracy_meters>=0 and accuracy_meters<=20000000);
create function public.publish_professional_location_fix(p_longitude double precision,p_latitude double precision,p_accuracy double precision default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_accuracy is not null and not(p_accuracy>=0 and p_accuracy<=20000000) then raise exception 'Invalid location accuracy';end if;
 perform public.publish_professional_location(p_longitude,p_latitude);
 update private.professional_live_locations set accuracy_meters=p_accuracy where professional_id=auth.uid();
end;
$$;
revoke all on function public.publish_professional_location_fix(double precision,double precision,double precision) from public,anon;
grant execute on function public.publish_professional_location_fix(double precision,double precision,double precision) to authenticated;
drop function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean);
create function public.discover_live_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer,location_updated_at timestamptz,location_accuracy_meters double precision)
language sql stable security definer set search_path = '' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,(p.available_now and not private.professional_busy(p.id,now(),now()+interval '15 minutes')),coalesce(l.longitude,p.longitude)::numeric,coalesce(l.latitude,p.latitude)::numeric,p.portfolio_urls,d.km,q.total_paise,l.updated_at,l.accuracy_meters
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

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160006','live_location_accuracy',array['-- Preserve browser-provided uncertainty instead of rejecting desktop/Wi-Fi locations.
alter table private.professional_live_locations add column accuracy_meters double precision check(accuracy_meters>=0 and accuracy_meters<=20000000);
create function public.publish_professional_location_fix(p_longitude double precision,p_latitude double precision,p_accuracy double precision default null)
returns void language plpgsql security definer set search_path='''' as $$
begin
 if p_accuracy is not null and not(p_accuracy>=0 and p_accuracy<=20000000) then raise exception ''Invalid location accuracy'';end if;
 perform public.publish_professional_location(p_longitude,p_latitude);
 update private.professional_live_locations set accuracy_meters=p_accuracy where professional_id=auth.uid();
end;
$$;
revoke all on function public.publish_professional_location_fix(double precision,double precision,double precision) from public,anon;
grant execute on function public.publish_professional_location_fix(double precision,double precision,double precision) to authenticated;
drop function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean);
create function public.discover_live_professionals(p_category public.talent_category, p_longitude double precision, p_latitude double precision,
  p_query text default '''', p_radius_km double precision default 15, p_available_now boolean default false)
returns table(id uuid, display_name text, category public.talent_category, city text, bio text, specialties text[],
  available_now boolean, longitude numeric, latitude numeric, portfolio_urls text[], distance_km double precision,booking_price_paise integer,location_updated_at timestamptz,location_accuracy_meters double precision)
language sql stable security definer set search_path = '''' as $$
  select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,(p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')),coalesce(l.longitude,p.longitude)::numeric,coalesce(l.latitude,p.latitude)::numeric,p.portfolio_urls,d.km,q.total_paise,l.updated_at,l.accuracy_meters
  from public.professionals p left join private.professional_live_locations l on l.professional_id=p.id and l.updated_at>now()-interval ''90 seconds'' and p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')
 cross join lateral (
    select 6371 * 2 * asin(sqrt(least(1.0, greatest(0.0,
      power(sin(radians(coalesce(l.latitude,p.latitude)::double precision-p_latitude)/2),2) +
      cos(radians(p_latitude))*cos(radians(coalesce(l.latitude,p.latitude)::double precision))*power(sin(radians(coalesce(l.longitude,p.longitude)::double precision-p_longitude)/2),2)
    )))) as km
  ) d join lateral (select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
  cross join lateral private.booking_pricing(s.net) q
  where auth.uid() is not null and p.is_published and p.category=p_category and (not p_available_now or (p.available_now and not private.professional_busy(p.id,now(),now()+interval ''15 minutes'')))
    and p_latitude between -90 and 90 and p_longitude between -180 and 180
    and d.km <= least(greatest(p_radius_km,1),50)
    and (p_query='''' or position(lower(left(p_query,100)) in lower(p.display_name||'' ''||array_to_string(p.specialties,'' '')))>0)
  order by d.km,p.id limit 100;
$$;

revoke all on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) from public,anon;
grant execute on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) to authenticated;
notify pgrst, ''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160007') then
      raise exception 'Migration 202610160007 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Commit the enum expansion before creating any ContentCreator profiles or bookings.
alter type public.talent_category add value if not exists 'ContentCreator';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160007','content_creator_category',array['-- Commit the enum expansion before creating any ContentCreator profiles or bookings.
alter type public.talent_category add value if not exists ''ContentCreator'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160008') then
      raise exception 'Migration 202610160008 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
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

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160008','wedding_hourly_billing',array['-- Wedding totals are finalized only after customer end-OTP verification.
alter table private.team_events add column billing_mode text not null default ''fixed'' check(billing_mode in (''fixed'',''hourly'')),
 add column planned_hours integer not null default 8 check(planned_hours between 1 and 24);
alter table public.bookings add column billing_mode text not null default ''fixed'' check(billing_mode in (''fixed'',''hourly'')),
 add column hourly_net_paise integer check(hourly_net_paise between 10000 and 100000000 and hourly_net_paise%100=0),
 add column hourly_rate_paise integer,add column billable_hours integer check(billable_hours>=1),
 add column billing_finalised_at timestamptz;
alter table public.bookings add constraint hourly_booking_rates check(billing_mode=''fixed'' or (hourly_net_paise is not null and hourly_rate_paise is not null and hourly_rate_paise>=hourly_net_paise));

create function private.service_billable_hours(p_start timestamptz,p_end timestamptz) returns integer
language plpgsql immutable strict set search_path='''' as $$
begin
 if p_end<p_start then raise exception ''Service end cannot precede its start'';end if;
 return greatest(1,ceil(extract(epoch from (p_end-p_start))/3600)::integer);
end;$$;
revoke all on function private.service_billable_hours(timestamptz,timestamptz) from public,anon,authenticated;

create function private.hourly_booking_price(p_net integer,p_rate integer,p_hours integer)
returns table(service_amount_paise integer,buyer_fee_paise integer,talent_fee_paise integer,talent_payout_paise integer,total_paise integer)
language plpgsql immutable set search_path='''' as $$
declare subtotal bigint:=p_rate::bigint*p_hours; net bigint:=p_net::bigint*p_hours; fee bigint;
begin
 if p_hours<1 or p_net<10000 or p_rate<p_net then raise exception ''Invalid hourly bill'';end if;
 fee:=least(29900,greatest(4900,round(subtotal::numeric/100*.03)::bigint*100));
 if subtotal+fee>2147483647 or net>2147483647 then raise exception ''Hourly invoice exceeds the supported payment limit'';end if;
 return query select subtotal::integer,fee::integer,(subtotal-net)::integer,net::integer,(subtotal+fee)::integer;
end;
$$;
revoke all on function private.hourly_booking_price(integer,integer,integer) from public,anon,authenticated;

alter function public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid) set schema private;
alter function private.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid) rename to create_fixed_team_request;
revoke all on function private.create_fixed_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid) from public,anon,authenticated;
create function public.create_team_request(p_title text,p_requirements text,p_starts_at timestamptz,p_venue text,p_longitude double precision,p_latitude double precision,p_roles jsonb,p_request_id uuid,p_billing_mode text default ''fixed'',p_planned_hours integer default 8)
returns uuid language plpgsql security definer set search_path='''' as $$
declare event_id uuid;
begin
 if auth.uid() is null then raise exception ''Sign in to post a team request'';end if;
 if p_billing_mode is null or p_billing_mode not in (''fixed'',''hourly'') or p_planned_hours is null or p_planned_hours not between 1 and 24 then raise exception ''Choose valid event billing and planned hours'';end if;
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

create or replace function public.team_requests() returns jsonb language sql stable security definer set search_path='''' as $$
  select coalesce(jsonb_agg(event order by created_at desc),''[]''::jsonb) from (
    select e.created_at,jsonb_build_object(''id'',e.id,''title'',e.title,''requirements'',e.requirements,
      ''billing_mode'',e.billing_mode,''planned_hours'',e.planned_hours,''starts_at'',e.starts_at,''venue'',e.venue,''is_owner'',e.client_id=auth.uid(),
      ''roles'',(select jsonb_agg(jsonb_build_object(''category'',r.category,''quantity'',r.quantity,
        ''selected'',private.team_selected(e.id,r.category)) order by r.category) from private.team_roles r where r.event_id=e.id),
      ''my_application'',(select jsonb_build_object(''id'',a.id,''service_name'',a.service_name,''net_paise'',a.net_paise,
        ''booking_id'',a.booking_id,''booking_status'',b.status) from private.team_applications a
        left join public.bookings b on b.id=a.booking_id where a.event_id=e.id and a.professional_id=auth.uid())) as event
    from private.team_events e where e.client_id=auth.uid() or (e.starts_at>now() and exists(
      select 1 from public.professionals p join private.team_roles r on r.category=p.category
      where p.id=auth.uid() and p.is_published and r.event_id=e.id))
    order by e.created_at desc limit 100
  ) events;
$$;

drop function public.apply_team_request(uuid,uuid,text);
create function public.apply_team_request(p_event_id uuid,p_service_id uuid,p_message text default '''',p_hourly_net_paise integer default null)
returns uuid language plpgsql security definer set search_path='''' as $$
declare e private.team_events; p public.professionals; s public.services; a private.team_applications; fees record; needed integer; quote_net integer; quote_minutes integer;
begin
  select * into e from private.team_events where id=p_event_id for update;
  if not found or e.client_id=auth.uid() or e.starts_at<=now() then raise exception ''This team request is unavailable''; end if;
  select * into p from public.professionals where id=auth.uid() and is_published;
  if not found then raise exception ''Publish your professional profile before applying''; end if;
  select quantity into needed from private.team_roles where event_id=e.id and category=p.category;
  if not found then raise exception ''This event does not need your profession''; end if;
  select * into a from private.team_applications where event_id=e.id and professional_id=p.id;
  if found then return a.id; end if;
  if private.team_selected(e.id,p.category)>=needed then raise exception ''This profession is already filled''; end if;
  select * into s from public.services where id=p_service_id and professional_id=p.id and active for share;
  if not found then raise exception ''Choose one of your active services''; end if;
  quote_net:=case when e.billing_mode=''hourly'' then p_hourly_net_paise else s.amount_paise end;
  quote_minutes:=case when e.billing_mode=''hourly'' then e.planned_hours*60 else s.duration_minutes end;
  if quote_net is null or quote_net not between 10000 and 100000000 or quote_net%100<>0 then raise exception ''Enter a whole-rupee hourly net rate from 100 to 1000000'';end if;
  if private.professional_busy(p.id,e.starts_at,e.starts_at+make_interval(mins=>quote_minutes)) then raise exception ''You are unavailable at this event time''; end if;
  select * into fees from private.booking_pricing(quote_net);
  insert into private.team_applications(event_id,professional_id,category,service_id,service_name,duration_minutes,net_paise,total_paise,message)
    values(e.id,p.id,p.category,s.id,s.name,quote_minutes,quote_net,case when e.billing_mode=''hourly'' then fees.service_amount_paise else fees.total_paise end,trim(coalesce(p_message,''''))) returning id into a.id;
  return a.id;
end;
$$;
revoke all on function public.apply_team_request(uuid,uuid,text,integer) from public,anon;
grant execute on function public.apply_team_request(uuid,uuid,text,integer) to authenticated;

create or replace function public.team_applicants(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path='''' as $$
begin
  if not exists(select 1 from private.team_events where id=p_event_id and client_id=auth.uid()) then raise exception ''Customer event not found''; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(''id'',a.id,''professional_id'',a.professional_id,
    ''professional_name'',p.display_name,''category'',a.category,''bio'',p.bio,''city'',p.city,
    ''service_name'',a.service_name,''duration_minutes'',a.duration_minutes,''total_paise'',a.total_paise,
    ''message'',a.message,''booking_id'',a.booking_id,''booking_status'',b.status) order by a.created_at),''[]''::jsonb)
    from private.team_applications a join public.professionals p on p.id=a.professional_id
    left join public.bookings b on b.id=a.booking_id where a.event_id=p_event_id);
end;
$$;

create or replace function public.accept_team_applicant(p_application_id uuid,p_expected_total_paise integer)
returns public.bookings language plpgsql security definer set search_path='''' as $$
declare e private.team_events; a private.team_applications; b public.bookings; s public.services; needed integer; fees record;
begin
  select e1.* into e from private.team_events e1 join private.team_applications a1 on a1.event_id=e1.id
    where a1.id=p_application_id and e1.client_id=auth.uid() for update of e1;
  if not found then raise exception ''Customer application not found''; end if;
  select * into a from private.team_applications where id=p_application_id for update;
  if a.booking_id is not null then select * into b from public.bookings where id=a.booking_id; return b; end if;
  if e.starts_at<=now() then raise exception ''This event has already started''; end if;
  select quantity into needed from private.team_roles where event_id=e.id and category=a.category;
  if private.team_selected(e.id,a.category)>=needed then raise exception ''The requested headcount is already filled''; end if;
  select * into s from public.services where id=a.service_id and active for share;
  if not found or (e.billing_mode=''fixed'' and (s.amount_paise<>a.net_paise or s.duration_minutes<>a.duration_minutes)) or s.name<>a.service_name then
    raise exception ''This service has changed. Ask the professional for a new application''; end if;
  perform 1 from public.professionals where id=a.professional_id and is_published and category=a.category for update;
  if not found then raise exception ''Professional is no longer available for this role''; end if;
  if p_expected_total_paise is null or p_expected_total_paise<>a.total_paise then raise exception ''Review the latest application price before accepting''; end if;
  if e.billing_mode=''hourly'' and private.professional_busy(a.professional_id,e.starts_at,e.starts_at+make_interval(mins=>a.duration_minutes)) then raise exception ''This professional is unavailable for the planned event hours'';end if;
  select * into fees from private.booking_pricing(s.amount_paise);
  b:=public.request_booking(a.service_id,e.starts_at,e.venue,e.longitude,e.latitude,
    left(e.title||E''\n''||e.requirements,2000),a.id,case when e.billing_mode=''hourly'' then fees.total_paise else a.total_paise end);
  if e.billing_mode=''hourly'' then
    select * into fees from private.hourly_booking_price(a.net_paise,a.total_paise,1);
    update public.bookings set billing_mode=''hourly'',hourly_net_paise=a.net_paise,hourly_rate_paise=a.total_paise,
      ends_at=starts_at+make_interval(mins=>a.duration_minutes),amount_paise=fees.total_paise,
      service_amount_paise=fees.service_amount_paise,buyer_fee_paise=fees.buyer_fee_paise,
      talent_fee_paise=fees.talent_fee_paise,talent_payout_paise=fees.talent_payout_paise where id=b.id;
  end if;
  update public.bookings set status=''accepted'' where id=b.id returning * into b;
  update private.team_applications set booking_id=b.id where id=a.id;
  return b;
end;
$$;

create or replace function private.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '''' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception ''Booking not found''; end if;
  if b.status=p_status then return b; end if;
  perform 1 from public.professionals where id=b.professional_id for update;
  if p_status=''en_route'' and exists(select 1 from public.bookings other
    where other.professional_id=b.professional_id and other.id<>b.id
      and other.status in (''en_route'',''arrived'')) then
    raise exception ''Finish your current active job before starting another journey'';
  end if;
  if p_status=''cancelled'' then
    if b.status not in (''requested'',''accepted'') then raise exception ''This booking cannot be cancelled''; end if;
  elsif b.professional_id<>auth.uid() then raise exception ''Only the professional can update this status'';
  elsif not ((b.status=''requested'' and p_status in (''accepted'',''declined'')) or
    (b.status=''accepted'' and p_status=''en_route'') or
    (b.status=''en_route'' and p_status=''arrived'') or
    (b.status=''arrived'' and p_status=''completed'')) then raise exception ''Invalid booking transition''; end if;
  if p_status in (''en_route'',''arrived'',''completed'') and b.paid_at is null and b.billing_mode<>''hourly'' then
    raise exception ''Verified payment is required before the journey and service'';
  end if;
  if p_status=''accepted'' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,''[)'') && tstzrange(b.starts_at,b.ends_at,''[)'')) then raise exception ''This time has been marked unavailable''; end if;
  if p_status=''completed'' and b.billing_mode=''hourly'' and b.billing_finalised_at is null then raise exception ''Verify the end OTP to finalize the hourly invoice'';end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  if p_status=''cancelled'' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status=''refund_requested'' where booking_id=b.id;
  end if;
  if p_status in (''completed'',''cancelled'',''declined'') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;

create or replace function public.service_otp(p_booking_id uuid,p_phase text)
returns jsonb language plpgsql security definer set search_path='''' as $$
declare b public.bookings; o private.service_otps;
begin
  select * into b from public.bookings where id=p_booking_id and client_id=auth.uid() for update;
  if not found then raise exception ''Customer booking not found''; end if;
  if b.status<>''arrived'' or (b.paid_at is null and b.billing_mode<>''hourly'') or
    not ((p_phase=''start'' and b.service_started_at is null) or
      (p_phase=''end'' and b.service_started_at is not null and b.completion_requested_at is not null)) then
    raise exception ''This service code is not available yet'';
  end if;
  select * into o from private.service_otps where booking_id=b.id and phase=p_phase;
  if not found or o.expires_at<=now() then
    -- gen_random_uuid uses PostgreSQL''s cryptographic random source.
    insert into private.service_otps(booking_id,phase,code,expires_at)
    values(b.id,p_phase,lpad(((''x''||substr(replace(gen_random_uuid()::text,''-'',''''),1,8))::bit(32)::bigint % 1000000)::text,6,''0''),now()+interval ''10 minutes'')
    on conflict(booking_id,phase) do update set code=excluded.code,expires_at=excluded.expires_at,attempts=0
    returning * into o;
  end if;
  return jsonb_build_object(''code'',case when o.attempts<5 then o.code else null end,
    ''expires_at'',o.expires_at,''locked'',o.attempts>=5);
end;
$$;
revoke all on function public.service_otp(uuid,text) from public,anon;
grant execute on function public.service_otp(uuid,text) to authenticated;

create or replace function public.service_action(p_booking_id uuid,p_action text,p_code text default '''')
returns jsonb language plpgsql security definer set search_path='''' as $$
declare b public.bookings; o private.service_otps; v_phase text; hours integer; fees record;
begin
  select * into b from public.bookings where id=p_booking_id and professional_id=auth.uid() for update;
  if not found then raise exception ''Professional booking not found''; end if;
  if b.status<>''arrived'' or (b.paid_at is null and b.billing_mode<>''hourly'') then raise exception ''A paid, arrived booking is required''; end if;
  if p_action=''request_completion'' then
    if b.service_started_at is null then raise exception ''Verify the start OTP first''; end if;
    update public.bookings set completion_requested_at=coalesce(completion_requested_at,now()) where id=b.id;
    return jsonb_build_object(''ok'',true);
  end if;
  v_phase:=case p_action when ''start'' then ''start'' when ''end'' then ''end'' else null end;
  if v_phase is null then raise exception ''Invalid service action''; end if;
  if (v_phase=''start'' and b.service_started_at is not null) or
    (v_phase=''end'' and (b.service_started_at is null or b.completion_requested_at is null)) then
    raise exception ''Invalid service stage'';
  end if;
  select * into o from private.service_otps where booking_id=b.id and service_otps.phase=v_phase for update;
  if not found or o.expires_at<=now() then return jsonb_build_object(''ok'',false,''message'',''Code expired or unavailable. Ask the customer to refresh their code.''); end if;
  if o.attempts>=5 then return jsonb_build_object(''ok'',false,''message'',''Too many attempts. Wait until the code expires, then ask the customer for a new code.''); end if;
  -- Return failures, rather than raising: failed-attempt counters must commit.
  if p_code is null or p_code !~ ''^[0-9]{6}$'' or p_code<>o.code then
    update private.service_otps set attempts=attempts+1 where booking_id=b.id and service_otps.phase=v_phase;
    return jsonb_build_object(''ok'',false,''message'',''Incorrect OTP. Check the six digits with the customer.'');
  end if;
  delete from private.service_otps where booking_id=b.id and service_otps.phase=v_phase;
  if v_phase=''start'' then
    update public.bookings set service_started_at=now() where id=b.id;
    delete from public.booking_locations where booking_id=b.id;
  else
    if b.billing_mode=''hourly'' then
      hours:=private.service_billable_hours(b.service_started_at,now());
      select * into fees from private.hourly_booking_price(b.hourly_net_paise,b.hourly_rate_paise,hours);
      update public.bookings set service_ended_at=now(),billable_hours=hours,billing_finalised_at=now(),
        amount_paise=fees.total_paise,service_amount_paise=fees.service_amount_paise,buyer_fee_paise=fees.buyer_fee_paise,
        talent_fee_paise=fees.talent_fee_paise,talent_payout_paise=fees.talent_payout_paise where id=b.id;
    else update public.bookings set service_ended_at=now() where id=b.id;end if;
    perform private.transition_booking(b.id,''completed'');
    delete from private.service_otps where booking_id=b.id;
  end if;
  return jsonb_build_object(''ok'',true);
end;
$$;
revoke all on function public.service_action(uuid,text,text) from public,anon;
grant execute on function public.service_action(uuid,text,text) to authenticated;


create or replace function public.booking_activity() returns setof public.bookings
language sql stable security definer set search_path='''' as $$
  select b.* from public.bookings b where b.client_id=auth.uid() and (
    b.status in (''requested'',''accepted'',''en_route'',''arrived'') or
    (b.status=''completed'' and ((b.billing_mode=''hourly'' and b.paid_at is null) or not exists(select 1 from public.booking_reviews r where r.booking_id=b.id)))
  ) order by case b.status when ''en_route'' then 0 when ''arrived'' then 0 when ''accepted'' then 1 when ''requested'' then 2 else 3 end,
    case when b.status<>''completed'' then b.starts_at end asc,
    case when b.status=''completed'' then b.created_at end desc,b.id limit 1;
$$;
revoke all on function public.booking_activity() from public,anon;
grant execute on function public.booking_activity() to authenticated;


create function private.guard_hourly_payment_order() returns trigger language plpgsql security definer set search_path='''' as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=new.booking_id for update;
 if b.billing_mode=''hourly'' and (b.status<>''completed'' or b.billing_finalised_at is null or new.amount_paise<>b.amount_paise) then raise exception ''Hourly payments require the completed final invoice'';end if;
 return new;
end;$$;
revoke all on function private.guard_hourly_payment_order() from public,anon,authenticated;
create trigger guard_hourly_payment_order before insert or update of amount_paise on public.payment_orders for each row execute function private.guard_hourly_payment_order();
create function private.guard_hourly_invoice() returns trigger language plpgsql security definer set search_path='''' as $$
begin
 if old.billing_mode=''hourly'' and old.billing_finalised_at is not null and
 (new.billing_mode,new.hourly_net_paise,new.hourly_rate_paise,new.billable_hours,new.billing_finalised_at,new.service_started_at,new.service_ended_at,new.amount_paise,new.service_amount_paise,new.buyer_fee_paise,new.talent_fee_paise,new.talent_payout_paise)
 is distinct from (old.billing_mode,old.hourly_net_paise,old.hourly_rate_paise,old.billable_hours,old.billing_finalised_at,old.service_started_at,old.service_ended_at,old.amount_paise,old.service_amount_paise,old.buyer_fee_paise,old.talent_fee_paise,old.talent_payout_paise) then raise exception ''The final hourly invoice cannot be changed'';end if;
 return new;
end;$$;
revoke all on function private.guard_hourly_invoice() from public,anon,authenticated;
create trigger guard_hourly_invoice before update on public.bookings for each row execute function private.guard_hourly_invoice();
create function private.guard_hourly_review() returns trigger language plpgsql security definer set search_path='''' as $$
begin
 if exists(select 1 from public.bookings where id=new.booking_id and billing_mode=''hourly'' and paid_at is null) then raise exception ''Settle your final invoice before reviewing'';end if;
 return new;
end;$$;
revoke all on function private.guard_hourly_review() from public,anon,authenticated;
create trigger guard_hourly_review before insert on public.booking_reviews for each row execute function private.guard_hourly_review();
notify pgrst,''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160009') then
      raise exception 'Migration 202610160009 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Portfolio browsing/uploads must not consume the stricter payment counter.
create table private.portfolio_rate_limits (
  user_id uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  attempts integer not null
);
alter table private.portfolio_rate_limits enable row level security;
revoke all on private.portfolio_rate_limits from public,anon,authenticated;

create function public.claim_portfolio_operation(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare attempts integer;
begin
  insert into private.portfolio_rate_limits values(p_user_id,now(),1)
  on conflict(user_id) do update set
    attempts=case when portfolio_rate_limits.window_start < now()-interval '1 minute' then 1 else portfolio_rate_limits.attempts+1 end,
    window_start=case when portfolio_rate_limits.window_start < now()-interval '1 minute' then now() else portfolio_rate_limits.window_start end
  returning portfolio_rate_limits.attempts into attempts;
  return attempts <= 60;
end;
$$;
revoke all on function public.claim_portfolio_operation(uuid) from public,anon,authenticated;
grant execute on function public.claim_portfolio_operation(uuid) to service_role;
notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160009','portfolio_limits',array['-- Portfolio browsing/uploads must not consume the stricter payment counter.
create table private.portfolio_rate_limits (
  user_id uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  attempts integer not null
);
alter table private.portfolio_rate_limits enable row level security;
revoke all on private.portfolio_rate_limits from public,anon,authenticated;

create function public.claim_portfolio_operation(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '''' as $$
declare attempts integer;
begin
  insert into private.portfolio_rate_limits values(p_user_id,now(),1)
  on conflict(user_id) do update set
    attempts=case when portfolio_rate_limits.window_start < now()-interval ''1 minute'' then 1 else portfolio_rate_limits.attempts+1 end,
    window_start=case when portfolio_rate_limits.window_start < now()-interval ''1 minute'' then now() else portfolio_rate_limits.window_start end
  returning portfolio_rate_limits.attempts into attempts;
  return attempts <= 60;
end;
$$;
revoke all on function public.claim_portfolio_operation(uuid) from public,anon,authenticated;
grant execute on function public.claim_portfolio_operation(uuid) to service_role;
notify pgrst, ''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610160010') then
      raise exception 'Migration 202610160010 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Delete the owner's event post/applications while keeping every financial booking.
create function public.delete_team_request(p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to delete an event'; end if;
  -- All apply/accept operations lock this row too, serialising selection/deletion.
  perform 1 from private.team_events where id=p_event_id and client_id=auth.uid() for update;
  if not found then raise exception 'Your event was not found'; end if;
  -- Roles/applications cascade; public.bookings are referenced parents and remain.
  delete from private.team_events where id=p_event_id and client_id=auth.uid();
end;
$$;
revoke all on function public.delete_team_request(uuid) from public,anon;
grant execute on function public.delete_team_request(uuid) to authenticated;
notify pgrst, 'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610160010','delete_team_events',array['-- Delete the owner''s event post/applications while keeping every financial booking.
create function public.delete_team_request(p_event_id uuid) returns void
language plpgsql security definer set search_path='''' as $$
begin
  if auth.uid() is null then raise exception ''Sign in to delete an event''; end if;
  -- All apply/accept operations lock this row too, serialising selection/deletion.
  perform 1 from private.team_events where id=p_event_id and client_id=auth.uid() for update;
  if not found then raise exception ''Your event was not found''; end if;
  -- Roles/applications cascade; public.bookings are referenced parents and remain.
  delete from private.team_events where id=p_event_id and client_id=auth.uid();
end;
$$;
revoke all on function public.delete_team_request(uuid) from public,anon;
grant execute on function public.delete_team_request(uuid) to authenticated;
notify pgrst, ''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610170001') then
      raise exception 'Migration 202610170001 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
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

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610170001','notifications',array['-- Durable participant notifications. No GPS fixes, message text, OTPs or legal names.
create table public.app_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 app_variant text not null check(app_variant in (''customer'',''professional'')),
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
 app_variant text not null check(app_variant in (''customer'',''professional'')),
 push_enabled boolean not null default false,
 messages_enabled boolean not null default true,
 events_enabled boolean not null default true,
 primary key(user_id,app_variant)
);
create table private.notification_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 app_variant text not null check(app_variant in (''customer'',''professional'')),
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
 state text not null default ''pending'' check(state in (''pending'',''sending'',''sent'',''failed'')),
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 unique(notification_id,device_id)
);
alter table private.notification_preferences enable row level security;
alter table private.notification_devices enable row level security;
alter table private.notification_deliveries enable row level security;
revoke all on private.notification_preferences,private.notification_devices,private.notification_deliveries from public,anon,authenticated;

create function public.notification_settings(p_variant text, p_settings jsonb default null) returns jsonb
language plpgsql security definer set search_path='''' as $$
declare result jsonb;
begin
 if auth.uid() is null or p_variant not in (''customer'',''professional'') then raise exception ''Sign in to manage notifications''; end if;
 insert into private.notification_preferences(user_id,app_variant) values(auth.uid(),p_variant) on conflict do nothing;
 if p_settings is not null then
  update private.notification_preferences set
   push_enabled=coalesce((p_settings->>''push_enabled'')::boolean,push_enabled),
   messages_enabled=coalesce((p_settings->>''messages_enabled'')::boolean,messages_enabled),
   events_enabled=coalesce((p_settings->>''events_enabled'')::boolean,events_enabled)
  where user_id=auth.uid() and app_variant=p_variant;
 end if;
 select jsonb_build_object(''push_enabled'',push_enabled,''messages_enabled'',messages_enabled,''events_enabled'',events_enabled)
 into result from private.notification_preferences where user_id=auth.uid() and app_variant=p_variant;
 return result;
end; $$;

create function public.register_notification_device(p_variant text,p_installation_id uuid,p_token text) returns void
language plpgsql security definer set search_path='''' as $$
begin
 if auth.uid() is null or p_variant not in (''customer'',''professional'') or p_installation_id is null then raise exception ''Sign in to enable notifications''; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from private.notification_devices where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id and token=p_token) then
  update private.notification_devices set updated_at=now() where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id;
  return;
 end if;
 -- Reassignment destroys queued deliveries for the previous account/token.
 delete from private.notification_devices where token=p_token or (installation_id=p_installation_id and app_variant=p_variant);
 delete from private.notification_devices where user_id=auth.uid() and updated_at<now()-interval ''60 days'';
 if (select count(*) from private.notification_devices where user_id=auth.uid())>=12 then raise exception ''Too many notification devices''; end if;
 insert into private.notification_devices(user_id,app_variant,installation_id,token) values(auth.uid(),p_variant,p_installation_id,p_token);
end; $$;
create function public.unregister_notification_device(p_installation_id uuid,p_variant text) returns void
language sql security definer set search_path='''' as $$
 delete from private.notification_devices where user_id=auth.uid() and installation_id=p_installation_id and app_variant=p_variant;
$$;
create function public.read_notifications(p_variant text,p_id uuid default null) returns void
language sql security definer set search_path='''' as $$
 update public.app_notifications set read_at=now() where user_id=auth.uid() and app_variant=p_variant and read_at is null and (p_id is null or id=p_id);
$$;
revoke all on function public.notification_settings(text,jsonb), public.register_notification_device(text,uuid,text),public.unregister_notification_device(uuid,text),public.read_notifications(text,uuid) from public,anon;
grant execute on function public.notification_settings(text,jsonb), public.register_notification_device(text,uuid,text),public.unregister_notification_device(uuid,text),public.read_notifications(text,uuid) to authenticated;

create function private.notify_circle(p_user uuid,p_variant text,p_kind text,p_title text,p_body text,p_key text,p_booking uuid default null,p_event uuid default null,p_message uuid default null)
returns void language plpgsql security definer set search_path='''' as $$
declare notification uuid;
begin
 insert into public.app_notifications(user_id,app_variant,kind,title,body,dedupe_key,booking_id,event_id,message_id)
 values(p_user,p_variant,p_kind,p_title,p_body,p_key,p_booking,p_event,p_message)
 on conflict(user_id,app_variant,dedupe_key) do nothing returning id into notification;
 if notification is null then return; end if;
 insert into private.notification_deliveries(notification_id,device_id)
 select notification,d.id from private.notification_devices d
 left join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
 where d.user_id=p_user and d.app_variant=p_variant and d.updated_at>now()-interval ''60 days''
 and coalesce(p.push_enabled,false) and (p_kind<>''message'' or coalesce(p.messages_enabled,true))
 and (p_kind not like ''event%'' or coalesce(p.events_enabled,true));
end; $$;

create function private.booking_notification() returns trigger language plpgsql security definer set search_path='''' as $$
declare recipient uuid; variant text; label text;
begin
 if tg_op=''INSERT'' then
  perform private.notify_circle(new.professional_id,''professional'',''booking'',''New booking request'',''Open Circle to review the request.'',''request:''||new.id,new.id);
  perform private.notify_circle(new.client_id,''customer'',''booking'',''Booking request sent'',''We will notify you when the professional responds.'',''request:''||new.id,new.id);
 end if;
 if tg_op=''INSERT'' or new.status is distinct from old.status then
  label:=case new.status when ''accepted'' then ''Booking accepted'' when ''en_route'' then ''Your professional is on the way'' when ''arrived'' then ''Your professional has arrived'' when ''completed'' then ''Service completed'' when ''declined'' then ''Booking declined'' when ''cancelled'' then ''Booking cancelled'' else null end;
  if label is not null then
   perform private.notify_circle(new.client_id,''customer'',''booking'',label,case when new.status=''arrived'' then ''Open your booking for the start-service code.'' when new.status=''completed'' and new.paid_at is null then ''Open your booking to check the final bill and payment.'' when new.status=''completed'' then ''Share a rating and review for your professional.'' else ''Open your booking for the latest details.'' end,''status:''||new.id||'':''||new.status,new.id);
   if new.status in (''accepted'',''cancelled'',''declined'',''completed'') then
    perform private.notify_circle(new.professional_id,''professional'',''booking'',label,''Open your job for the latest details.'',''status:''||new.id||'':''||new.status,new.id);
   end if;
  end if;
 end if;
 if tg_op=''UPDATE'' then
  if old.paid_at is null and new.paid_at is not null then
   perform private.notify_circle(new.client_id,''customer'',''payment'',''Payment confirmed'',''Your payment has been confirmed. Open your booking.'',''payment:''||new.id,new.id);
   perform private.notify_circle(new.professional_id,''professional'',''payment'',''Booking payment confirmed'',''Open your job for the next step and your earnings.'',''payment:''||new.id,new.id);
  end if;
  if old.service_started_at is null and new.service_started_at is not null then
   perform private.notify_circle(new.client_id,''customer'',''service'',''Service started'',''The start-service code has been verified.'',''start:''||new.id,new.id);
   perform private.notify_circle(new.professional_id,''professional'',''service'',''Service started'',''The start-service code has been verified.'',''start:''||new.id,new.id);
  end if;
  if old.completion_requested_at is null and new.completion_requested_at is not null then
   perform private.notify_circle(new.client_id,''customer'',''service'',''Confirm service completion'',''Open your booking for the end-service code. Share it only when the service is finished.'',''end-request:''||new.id,new.id);
  end if;
 end if;
 return new;
end; $$;
create trigger circle_booking_notification after insert or update on public.bookings for each row execute function private.booking_notification();

create function private.message_notification() returns trigger language plpgsql security definer set search_path='''' as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=new.booking_id;
 if b.paid_at is not null and b.service_ended_at is null and b.status in (''accepted'',''en_route'',''arrived'') then
  perform private.notify_circle(case when new.sender_id=b.client_id then b.professional_id else b.client_id end,
   case when new.sender_id=b.client_id then ''professional'' else ''customer'' end,''message'',''New booking message'',''Open your active booking to read the message.'',''message:''||new.id,b.id,null,new.id);
 end if;
 return new;
end; $$;
create trigger circle_message_notification after insert on public.messages for each row execute function private.message_notification();

create function private.event_notification() returns trigger language plpgsql security definer set search_path='''' as $$
declare e private.team_events; person record;
begin
 if tg_table_name=''team_roles'' then
  select * into e from private.team_events where id=new.event_id;
  for person in select p.id from public.professionals p where p.category=new.category and p.is_published and p.id<>e.client_id
   and abs(p.latitude-e.latitude)<0.45 and abs(p.longitude-e.longitude)<0.45 order by p.id limit 100 loop
   perform private.notify_circle(person.id,''professional'',''event'',''New event opportunity'',''A nearby event is looking for your craft. Open Events to review it.'',''event:''||e.id,null,e.id);
  end loop;
 elsif tg_op=''INSERT'' then
  select * into e from private.team_events where id=new.event_id;
  perform private.notify_circle(e.client_id,''customer'',''event'',''New event application'',''A professional has applied. Review their portfolio and service rates.'',''application:''||new.id,null,e.id);
 elsif tg_op=''UPDATE'' and old.booking_id is null and new.booking_id is not null then
  perform private.notify_circle(new.professional_id,''professional'',''event'',''You have been selected'',''Open your booking to review the event job.'',''selected:''||new.id,new.booking_id,new.event_id);
 end if;
 return new;
end; $$;
create trigger circle_event_role after insert on private.team_roles for each row execute function private.event_notification();
create trigger circle_event_application after insert or update on private.team_applications for each row execute function private.event_notification();

create function private.review_notification() returns trigger language plpgsql security definer set search_path='''' as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=new.booking_id;
 perform private.notify_circle(b.professional_id,''professional'',''review'',''New rating and review'',''A customer has reviewed your completed service.'',''review:''||new.booking_id,b.id);
 return new;
end; $$;
create trigger circle_review after insert on public.booking_reviews for each row execute function private.review_notification();

create function private.finance_notification() returns trigger language plpgsql security definer set search_path='''' as $$
declare b public.bookings; variant text; recipient uuid; label text;
begin
 if tg_op=''UPDATE'' and old.status=new.status then return new; end if;
 select * into b from public.bookings where id=new.booking_id;
 if tg_table_name=''refund_requests'' then
  recipient:=b.client_id; variant:=''customer'';
  label:=case new.status when ''pending'' then ''Refund requested'' when ''processing'' then ''Refund processing'' when ''refunded'' then ''Refund confirmed'' when ''failed'' then ''Refund needs attention'' else null end;
 else
  recipient:=b.professional_id; variant:=''professional'';
  label:=case new.status when ''paid'' then ''Earnings transfer confirmed'' when ''failed'' then ''Earnings transfer needs attention'' else null end;
 end if;
 if label is not null then perform private.notify_circle(recipient,variant,''payment'',label,''Open your booking for the latest payment status.'',tg_table_name||'':''||new.booking_id||'':''||new.status,b.id); end if;
 return new;
end; $$;
create trigger circle_refund after insert or update on public.refund_requests for each row execute function private.finance_notification();
create trigger circle_payout after insert or update on public.payout_jobs for each row execute function private.finance_notification();

create function private.portfolio_notification() returns trigger language plpgsql security definer set search_path='''' as $$
begin
 if new.status in (''complete'',''failed'') and old.status is distinct from new.status then
  perform private.notify_circle(new.professional_id,''professional'',''portfolio'',case when new.status=''complete'' then ''Portfolio import complete'' else ''Portfolio connection needs attention'' end,''Open your professional portfolio to review the result.'',''portfolio:''||new.id||'':''||new.status);
 end if;
 return new;
end; $$;
create trigger circle_portfolio after update on public.portfolio_imports for each row execute function private.portfolio_notification();

-- Invoked by the server scheduler, never by a customer/professional client.
create function public.queue_booking_reminders() returns void
language plpgsql security definer set search_path='''' as $$
declare b public.bookings;
begin
 delete from public.app_notifications where created_at<now()-interval ''30 days'';
 for b in select * from public.bookings where status=''accepted'' and starts_at>now() and starts_at<=now()+interval ''1 hour'' loop
  perform private.notify_circle(b.client_id,''customer'',''reminder'',''Your booking starts soon'',''Your scheduled service starts within an hour. Open your booking to review the details.'',''reminder:''||b.id,b.id);
  perform private.notify_circle(b.professional_id,''professional'',''reminder'',''Your job starts soon'',''Your scheduled job starts within an hour. Open the job to prepare.'',''reminder:''||b.id,b.id);
 end loop;
end; $$;

-- Only the authenticated server worker can claim delivery work. Leases survive restarts.
create function public.claim_notification_deliveries() returns jsonb
language plpgsql security definer set search_path='''' as $$
declare result jsonb;
begin
 delete from public.app_notifications where created_at<now()-interval ''30 days'';
 update private.notification_deliveries j set state=''failed''
 where j.state in (''pending'',''sending'') and (j.attempts>=5 or not exists(
  select 1 from public.app_notifications n join private.notification_devices d on d.id=j.device_id
  left join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
  where n.id=j.notification_id and n.user_id=d.user_id and n.app_variant=d.app_variant
  and n.created_at>now()-interval ''1 day'' and n.read_at is null and coalesce(p.push_enabled,false)
  and (n.kind<>''message'' or coalesce(p.messages_enabled,true)) and (n.kind not like ''event%'' or coalesce(p.events_enabled,true))));
 with picked as (
  select id from private.notification_deliveries where (state=''pending'' and next_attempt_at<=now()) or (state=''sending'' and lease_until<now())
  order by next_attempt_at for update skip locked limit 50
 ), claimed as (
  update private.notification_deliveries j set state=''sending'',attempts=attempts+1,lease_until=now()+interval ''2 minutes''
  from picked where j.id=picked.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object(''id'',j.id,''attempt'',j.attempts,''token'',d.token,''notification_id'',n.id,''variant'',n.app_variant,''title'',n.title)),''[]''::jsonb)
 into result from claimed j join private.notification_devices d on d.id=j.device_id join public.app_notifications n on n.id=j.notification_id;
 return result;
end; $$;
create function public.finish_notification_delivery(p_id uuid,p_attempt integer,p_result text) returns void
language plpgsql security definer set search_path='''' as $$
declare device uuid;
begin
 if p_result not in (''sent'',''retry'',''invalid'',''failed'') then raise exception ''Invalid delivery result''; end if;
 update private.notification_deliveries set state=case when p_result=''sent'' then ''sent'' when p_result=''retry'' and attempts<5 then ''pending'' else ''failed'' end,
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),lease_until=null
 where id=p_id and attempts=p_attempt and state=''sending'' returning device_id into device;
 if p_result=''invalid'' and device is not null then delete from private.notification_devices where id=device; end if;
end; $$;
revoke all on function private.notify_circle(uuid,text,text,text,text,text,uuid,uuid,uuid),private.booking_notification(),private.message_notification(),private.event_notification(),private.review_notification(),private.finance_notification(),private.portfolio_notification() from public,anon,authenticated;
revoke all on function public.claim_notification_deliveries(),public.finish_notification_delivery(uuid,integer,text),public.queue_booking_reminders() from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries(),public.finish_notification_delivery(uuid,integer,text),public.queue_booking_reminders() to service_role;
notify pgrst,''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610170002') then
      raise exception 'Migration 202610170002 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Recheck ownership/consent after claiming, before contacting the push provider.
-- Devices can sign out, switch accounts or mute alerts while a batch is in flight.
create function public.notification_delivery_current(p_id uuid,p_attempt integer) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from private.notification_deliveries j
  join private.notification_devices d on d.id=j.device_id
  join public.app_notifications n on n.id=j.notification_id
  join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
  left join public.bookings b on b.id=n.booking_id
  where j.id=p_id and j.attempts=p_attempt and j.state='sending' and j.lease_until>now()
  and n.user_id=d.user_id and n.app_variant=d.app_variant and n.read_at is null
  and n.created_at>now()-interval '1 day' and p.push_enabled
  and (n.kind<>'message' or p.messages_enabled) and (n.kind not like 'event%' or p.events_enabled)
  and (n.dedupe_key not like 'request:%' or b.status='requested')
  and (n.dedupe_key not like 'status:%' or n.dedupe_key='status:'||b.id||':'||b.status)
  and (n.kind<>'reminder' or (b.status='accepted' and b.starts_at>now()))
  and (n.kind<>'service' or b.service_ended_at is null)
 );
$$;
revoke all on function public.notification_delivery_current(uuid,integer) from public,anon,authenticated;
grant execute on function public.notification_delivery_current(uuid,integer) to service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610170002','notification_delivery_guard',array['-- Recheck ownership/consent after claiming, before contacting the push provider.
-- Devices can sign out, switch accounts or mute alerts while a batch is in flight.
create function public.notification_delivery_current(p_id uuid,p_attempt integer) returns boolean
language sql stable security definer set search_path='''' as $$
 select exists(
  select 1 from private.notification_deliveries j
  join private.notification_devices d on d.id=j.device_id
  join public.app_notifications n on n.id=j.notification_id
  join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
  left join public.bookings b on b.id=n.booking_id
  where j.id=p_id and j.attempts=p_attempt and j.state=''sending'' and j.lease_until>now()
  and n.user_id=d.user_id and n.app_variant=d.app_variant and n.read_at is null
  and n.created_at>now()-interval ''1 day'' and p.push_enabled
  and (n.kind<>''message'' or p.messages_enabled) and (n.kind not like ''event%'' or p.events_enabled)
  and (n.dedupe_key not like ''request:%'' or b.status=''requested'')
  and (n.dedupe_key not like ''status:%'' or n.dedupe_key=''status:''||b.id||'':''||b.status)
  and (n.kind<>''reminder'' or (b.status=''accepted'' and b.starts_at>now()))
  and (n.kind<>''service'' or b.service_ended_at is null)
 );
$$;
revoke all on function public.notification_delivery_current(uuid,integer) from public,anon,authenticated;
grant execute on function public.notification_delivery_current(uuid,integer) to service_role;
notify pgrst,''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610180001') then
      raise exception 'Migration 202610180001 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Existing Android clients continue using the unchanged three-argument RPC.
alter table private.notification_devices add column provider text not null default 'fcm' check(provider in ('fcm','apns'));
alter table private.notification_devices add column apns_environment text;
alter table private.notification_devices add constraint notification_device_environment check((provider='fcm' and apns_environment is null) or (provider='apns' and apns_environment in ('sandbox','production') and apns_environment is not null));
create function public.register_ios_notification_device(p_variant text,p_installation_id uuid,p_token text,p_environment text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_environment is null or p_environment not in ('sandbox','production') or p_token is null or length(p_token) not between 32 and 512 or p_token !~ '^[a-fA-F0-9]+$' or length(p_token)%2<>0 then raise exception 'Invalid Apple notification device'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 -- A changed APNs environment invalidates queued/claimed snapshots for this install.
 delete from private.notification_devices where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id and (provider<>'apns' or apns_environment is distinct from p_environment);
 perform public.register_notification_device(p_variant,p_installation_id,lower(p_token));
 update private.notification_devices set provider='apns',apns_environment=p_environment where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id;
end; $$;
revoke all on function public.register_ios_notification_device(text,uuid,text,text) from public,anon;
grant execute on function public.register_ios_notification_device(text,uuid,text,text) to authenticated;
create function public.claim_notification_deliveries_for_providers(p_providers text[]) returns jsonb
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
  select j.id from private.notification_deliveries j join private.notification_devices d on d.id=j.device_id where d.provider=any(p_providers) and ((j.state='pending' and j.next_attempt_at<=now()) or (j.state='sending' and j.lease_until<now()))
  order by j.next_attempt_at for update of j skip locked limit 50
 ), claimed as (
  update private.notification_deliveries j set state='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes'
  from picked where j.id=picked.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'attempt',j.attempts,'token',d.token,'notification_id',n.id,'variant',n.app_variant,'title',n.title,'provider',d.provider,'environment',d.apns_environment)),'[]'::jsonb)
 into result from claimed j join private.notification_devices d on d.id=j.device_id join public.app_notifications n on n.id=j.notification_id;
 return result;
end; $$;
revoke all on function public.claim_notification_deliveries_for_providers(text[]) from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries_for_providers(text[]) to service_role;
-- Legacy workers continue claiming Android devices only.
create or replace function public.claim_notification_deliveries() returns jsonb language sql security definer set search_path='' as $$select public.claim_notification_deliveries_for_providers(array['fcm'])$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610180001','ios_push',array['-- Existing Android clients continue using the unchanged three-argument RPC.
alter table private.notification_devices add column provider text not null default ''fcm'' check(provider in (''fcm'',''apns''));
alter table private.notification_devices add column apns_environment text;
alter table private.notification_devices add constraint notification_device_environment check((provider=''fcm'' and apns_environment is null) or (provider=''apns'' and apns_environment in (''sandbox'',''production'') and apns_environment is not null));
create function public.register_ios_notification_device(p_variant text,p_installation_id uuid,p_token text,p_environment text) returns void
language plpgsql security definer set search_path='''' as $$
begin
 if p_environment is null or p_environment not in (''sandbox'',''production'') or p_token is null or length(p_token) not between 32 and 512 or p_token !~ ''^[a-fA-F0-9]+$'' or length(p_token)%2<>0 then raise exception ''Invalid Apple notification device''; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 -- A changed APNs environment invalidates queued/claimed snapshots for this install.
 delete from private.notification_devices where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id and (provider<>''apns'' or apns_environment is distinct from p_environment);
 perform public.register_notification_device(p_variant,p_installation_id,lower(p_token));
 update private.notification_devices set provider=''apns'',apns_environment=p_environment where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id;
end; $$;
revoke all on function public.register_ios_notification_device(text,uuid,text,text) from public,anon;
grant execute on function public.register_ios_notification_device(text,uuid,text,text) to authenticated;
create function public.claim_notification_deliveries_for_providers(p_providers text[]) returns jsonb
language plpgsql security definer set search_path='''' as $$
declare result jsonb;
begin
 delete from public.app_notifications where created_at<now()-interval ''30 days'';
 update private.notification_deliveries j set state=''failed''
 where j.state in (''pending'',''sending'') and (j.attempts>=5 or not exists(
  select 1 from public.app_notifications n join private.notification_devices d on d.id=j.device_id
  left join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
  where n.id=j.notification_id and n.user_id=d.user_id and n.app_variant=d.app_variant
  and n.created_at>now()-interval ''1 day'' and n.read_at is null and coalesce(p.push_enabled,false)
  and (n.kind<>''message'' or coalesce(p.messages_enabled,true)) and (n.kind not like ''event%'' or coalesce(p.events_enabled,true))));
 with picked as (
  select j.id from private.notification_deliveries j join private.notification_devices d on d.id=j.device_id where d.provider=any(p_providers) and ((j.state=''pending'' and j.next_attempt_at<=now()) or (j.state=''sending'' and j.lease_until<now()))
  order by j.next_attempt_at for update of j skip locked limit 50
 ), claimed as (
  update private.notification_deliveries j set state=''sending'',attempts=attempts+1,lease_until=now()+interval ''2 minutes''
  from picked where j.id=picked.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object(''id'',j.id,''attempt'',j.attempts,''token'',d.token,''notification_id'',n.id,''variant'',n.app_variant,''title'',n.title,''provider'',d.provider,''environment'',d.apns_environment)),''[]''::jsonb)
 into result from claimed j join private.notification_devices d on d.id=j.device_id join public.app_notifications n on n.id=j.notification_id;
 return result;
end; $$;
revoke all on function public.claim_notification_deliveries_for_providers(text[]) from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries_for_providers(text[]) to service_role;
-- Legacy workers continue claiming Android devices only.
create or replace function public.claim_notification_deliveries() returns jsonb language sql security definer set search_path='''' as $$select public.claim_notification_deliveries_for_providers(array[''fcm''])$$;
notify pgrst,''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610180002') then
      raise exception 'Migration 202610180002 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
create table private.active_app_sessions (
 user_id uuid not null references public.profiles on delete cascade,
 app_variant text not null check(app_variant in ('customer','professional')),
 session_id uuid not null,
 session_created_at timestamptz not null,
 primary key(user_id,app_variant)
);
create table private.replaced_app_sessions (
 session_id uuid primary key,
 user_id uuid not null references public.profiles on delete cascade,
 replaced_at timestamptz not null default now()
);
alter table private.active_app_sessions enable row level security;
alter table private.replaced_app_sessions enable row level security;
revoke all on private.active_app_sessions,private.replaced_app_sessions from public,anon,authenticated;

create function private.request_session_id() returns uuid language sql stable set search_path='' as $$
 select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id','')::uuid;
$$;
create function private.current_user_id() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from private.replaced_app_sessions where session_id=private.request_session_id() and user_id=auth.uid()) then
  raise exception using errcode='28000',message='This session was replaced. Sign in again.';
 end if;
 return auth.uid();
end; $$;
revoke all on function private.request_session_id(),private.current_user_id() from public;
grant execute on function private.current_user_id() to anon,authenticated;

create function public.activate_app_session(p_variant text) returns boolean language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); sid uuid:=private.request_session_id(); created timestamptz; previous private.active_app_sessions;
begin
 if who is null or sid is null or p_variant is null or p_variant not in ('customer','professional') then raise exception 'Sign in again to secure this device';end if;
 select created_at into created from auth.sessions where id=sid and user_id=who;
 if created is null then return false;end if;
 perform 1 from public.profiles where id=who for update;
 if exists(select 1 from private.replaced_app_sessions where session_id=sid and user_id=who) then return false;end if;
 select * into previous from private.active_app_sessions where user_id=who and app_variant=p_variant;
 if previous.session_id=sid then return true;end if;
 -- An older restored session cannot take the account back from a newer login.
 if previous.session_id is not null and (previous.session_created_at>created or (previous.session_created_at=created and previous.session_id>sid)) then
  insert into private.replaced_app_sessions(session_id,user_id) values(sid,who) on conflict do nothing;
  return false;
 end if;
 if previous.session_id is not null then
  insert into private.replaced_app_sessions(session_id,user_id) values(previous.session_id,who) on conflict do nothing;
 end if;
 insert into private.active_app_sessions(user_id,app_variant,session_id,session_created_at) values(who,p_variant,sid,created)
 on conflict(user_id,app_variant) do update set session_id=excluded.session_id,session_created_at=excluded.session_created_at;
 -- Device registrations will be re-established by this app after activation.
 delete from private.notification_devices where user_id=who and app_variant=p_variant;
 if p_variant='professional' and previous.session_id is not null then
  delete from private.professional_live_locations where professional_id=who;
 end if;
 return true;
end; $$;

create function public.app_session_is_current(p_variant text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.active_app_sessions where user_id=auth.uid() and app_variant=p_variant and session_id=private.request_session_id())
 and not exists(select 1 from private.replaced_app_sessions where user_id=auth.uid() and session_id=private.request_session_id());
$$;
create function public.app_session_allowed(p_user_id uuid,p_session_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.replaced_app_sessions where user_id=p_user_id and session_id=p_session_id);
$$;
create function public.release_app_session(p_variant text) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();sid uuid:=private.request_session_id();
begin
 if who is null or sid is null then return;end if;
 perform 1 from public.profiles where id=who for update;
 if exists(select 1 from private.active_app_sessions where user_id=who and app_variant=p_variant and session_id=sid) then
  delete from private.active_app_sessions where user_id=who and app_variant=p_variant and session_id=sid;
  insert into private.replaced_app_sessions(session_id,user_id) values(sid,who) on conflict do nothing;
  delete from private.notification_devices where user_id=who and app_variant=p_variant;
 end if;
end; $$;
revoke all on function public.activate_app_session(text),public.app_session_is_current(text),public.release_app_session(text),public.app_session_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.activate_app_session(text),public.app_session_is_current(text),public.release_app_session(text) to authenticated;
grant execute on function public.app_session_allowed(uuid,uuid) to service_role;

-- Existing RLS and authenticated RPCs reject replaced JWTs before token expiry.
-- Auth-owned routines are deliberately untouched. Session-control RPCs use the
-- original identity so a replaced client can detect replacement and sign out.
do $guards$
declare item record;definition text;qual text;checked text;command text;
begin
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.prokind='f' and p.prosrc like '%auth.uid()%'
 and p.proname not in ('current_user_id','activate_app_session','app_session_is_current','release_app_session','app_session_allowed') loop
  definition:=replace(pg_get_functiondef(item.oid),'auth.uid()','private.current_user_id()');
  execute definition;
 end loop;
 for item in select pol.*,c.relname,n.nspname from pg_policy pol join pg_class c on c.oid=pol.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' loop
  qual:=pg_get_expr(item.polqual,item.polrelid);checked:=pg_get_expr(item.polwithcheck,item.polrelid);
  if position('auth.uid()' in coalesce(qual,'')||coalesce(checked,''))>0 then
   command:=format('alter policy %I on %I.%I',item.polname,item.nspname,item.relname);
   if qual is not null then command:=command||' using ('||replace(qual,'auth.uid()','private.current_user_id()')||')';end if;
   if checked is not null then command:=command||' with check ('||replace(checked,'auth.uid()','private.current_user_id()')||')';end if;
   execute command;
  end if;
 end loop;
end; $guards$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610180002','app_sessions',array['create table private.active_app_sessions (
 user_id uuid not null references public.profiles on delete cascade,
 app_variant text not null check(app_variant in (''customer'',''professional'')),
 session_id uuid not null,
 session_created_at timestamptz not null,
 primary key(user_id,app_variant)
);
create table private.replaced_app_sessions (
 session_id uuid primary key,
 user_id uuid not null references public.profiles on delete cascade,
 replaced_at timestamptz not null default now()
);
alter table private.active_app_sessions enable row level security;
alter table private.replaced_app_sessions enable row level security;
revoke all on private.active_app_sessions,private.replaced_app_sessions from public,anon,authenticated;

create function private.request_session_id() returns uuid language sql stable set search_path='''' as $$
 select nullif(nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb->>''session_id'','''')::uuid;
$$;
create function private.current_user_id() returns uuid language plpgsql stable security definer set search_path='''' as $$
begin
 if exists(select 1 from private.replaced_app_sessions where session_id=private.request_session_id() and user_id=auth.uid()) then
  raise exception using errcode=''28000'',message=''This session was replaced. Sign in again.'';
 end if;
 return auth.uid();
end; $$;
revoke all on function private.request_session_id(),private.current_user_id() from public;
grant execute on function private.current_user_id() to anon,authenticated;

create function public.activate_app_session(p_variant text) returns boolean language plpgsql security definer set search_path='''' as $$
declare who uuid:=auth.uid(); sid uuid:=private.request_session_id(); created timestamptz; previous private.active_app_sessions;
begin
 if who is null or sid is null or p_variant is null or p_variant not in (''customer'',''professional'') then raise exception ''Sign in again to secure this device'';end if;
 select created_at into created from auth.sessions where id=sid and user_id=who;
 if created is null then return false;end if;
 perform 1 from public.profiles where id=who for update;
 if exists(select 1 from private.replaced_app_sessions where session_id=sid and user_id=who) then return false;end if;
 select * into previous from private.active_app_sessions where user_id=who and app_variant=p_variant;
 if previous.session_id=sid then return true;end if;
 -- An older restored session cannot take the account back from a newer login.
 if previous.session_id is not null and (previous.session_created_at>created or (previous.session_created_at=created and previous.session_id>sid)) then
  insert into private.replaced_app_sessions(session_id,user_id) values(sid,who) on conflict do nothing;
  return false;
 end if;
 if previous.session_id is not null then
  insert into private.replaced_app_sessions(session_id,user_id) values(previous.session_id,who) on conflict do nothing;
 end if;
 insert into private.active_app_sessions(user_id,app_variant,session_id,session_created_at) values(who,p_variant,sid,created)
 on conflict(user_id,app_variant) do update set session_id=excluded.session_id,session_created_at=excluded.session_created_at;
 -- Device registrations will be re-established by this app after activation.
 delete from private.notification_devices where user_id=who and app_variant=p_variant;
 if p_variant=''professional'' and previous.session_id is not null then
  delete from private.professional_live_locations where professional_id=who;
 end if;
 return true;
end; $$;

create function public.app_session_is_current(p_variant text) returns boolean language sql stable security definer set search_path='''' as $$
 select exists(select 1 from private.active_app_sessions where user_id=auth.uid() and app_variant=p_variant and session_id=private.request_session_id())
 and not exists(select 1 from private.replaced_app_sessions where user_id=auth.uid() and session_id=private.request_session_id());
$$;
create function public.app_session_allowed(p_user_id uuid,p_session_id uuid) returns boolean language sql stable security definer set search_path='''' as $$
 select not exists(select 1 from private.replaced_app_sessions where user_id=p_user_id and session_id=p_session_id);
$$;
create function public.release_app_session(p_variant text) returns void language plpgsql security definer set search_path='''' as $$
declare who uuid:=auth.uid();sid uuid:=private.request_session_id();
begin
 if who is null or sid is null then return;end if;
 perform 1 from public.profiles where id=who for update;
 if exists(select 1 from private.active_app_sessions where user_id=who and app_variant=p_variant and session_id=sid) then
  delete from private.active_app_sessions where user_id=who and app_variant=p_variant and session_id=sid;
  insert into private.replaced_app_sessions(session_id,user_id) values(sid,who) on conflict do nothing;
  delete from private.notification_devices where user_id=who and app_variant=p_variant;
 end if;
end; $$;
revoke all on function public.activate_app_session(text),public.app_session_is_current(text),public.release_app_session(text),public.app_session_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.activate_app_session(text),public.app_session_is_current(text),public.release_app_session(text) to authenticated;
grant execute on function public.app_session_allowed(uuid,uuid) to service_role;

-- Existing RLS and authenticated RPCs reject replaced JWTs before token expiry.
-- Auth-owned routines are deliberately untouched. Session-control RPCs use the
-- original identity so a replaced client can detect replacement and sign out.
do $guards$
declare item record;definition text;qual text;checked text;command text;
begin
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in (''public'',''private'') and p.prokind=''f'' and p.prosrc like ''%auth.uid()%''
 and p.proname not in (''current_user_id'',''activate_app_session'',''app_session_is_current'',''release_app_session'',''app_session_allowed'') loop
  definition:=replace(pg_get_functiondef(item.oid),''auth.uid()'',''private.current_user_id()'');
  execute definition;
 end loop;
 for item in select pol.*,c.relname,n.nspname from pg_policy pol join pg_class c on c.oid=pol.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' loop
  qual:=pg_get_expr(item.polqual,item.polrelid);checked:=pg_get_expr(item.polwithcheck,item.polrelid);
  if position(''auth.uid()'' in coalesce(qual,'''')||coalesce(checked,''''))>0 then
   command:=format(''alter policy %I on %I.%I'',item.polname,item.nspname,item.relname);
   if qual is not null then command:=command||'' using (''||replace(qual,''auth.uid()'',''private.current_user_id()'')||'')'';end if;
   if checked is not null then command:=command||'' with check (''||replace(checked,''auth.uid()'',''private.current_user_id()'')||'')'';end if;
   execute command;
  end if;
 end loop;
end; $guards$;
notify pgrst,''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610180003') then
      raise exception 'Migration 202610180003 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
create table public.service_types (
 key text primary key, category public.talent_category not null, label text not null
);
alter table public.service_types enable row level security;
revoke all on public.service_types from public,anon,authenticated;
grant select on public.service_types to authenticated;
grant all on public.service_types to service_role;
create policy view_service_types on public.service_types for select to authenticated using(private.current_user_id() is not null);

alter table public.services add column service_key text references public.service_types(key);
create index services_type_active on public.services(service_key,professional_id) where active;
create function private.assign_service_type() returns trigger language plpgsql security definer set search_path='' as $$
declare craft public.talent_category;
begin
 select category into craft from public.professionals where id=new.professional_id;
 if new.service_key is null then
   select key into new.service_key from public.service_types where category=craft and lower(label)=lower(trim(new.name));
 elsif not exists(select 1 from public.service_types where key=new.service_key and category=craft) then
   raise exception 'Choose a service for your professional category';
 end if;
 return new;
end;$$;
revoke all on function private.assign_service_type() from public,anon,authenticated;
create trigger assign_service_type before insert or update of service_key,name,professional_id on public.services for each row execute function private.assign_service_type();

create table public.professional_photos (
 professional_id uuid primary key references public.profiles on delete cascade,
 storage_path text not null check(storage_path like professional_id::text||'/approved-%'),
 updated_at timestamptz not null default now()
);
alter table public.professional_photos enable row level security;
revoke all on public.professional_photos from public,anon,authenticated;
grant all on public.professional_photos to service_role;

create table public.home_campaigns (
 id text primary key, title text not null, subtitle text not null, category public.talent_category not null,
 service_key text references public.service_types, starts_at timestamptz not null, ends_at timestamptz not null,
 priority integer not null default 0, enabled boolean not null default true,
 check(ends_at>starts_at), check(length(title)<=100 and length(subtitle)<=200)
);
alter table public.home_campaigns enable row level security;
revoke all on public.home_campaigns from public,anon,authenticated;
grant select on public.home_campaigns to authenticated;
grant all on public.home_campaigns to service_role;
create policy active_home_campaigns on public.home_campaigns for select to authenticated
 using(private.current_user_id() is not null and enabled and starts_at<=now() and ends_at>now());

insert into public.service_types(key,category,label) values
('bridal-makeup','Makeup','Bridal makeup'),
('party-makeup','Makeup','Party makeup'),
('wedding-makeup','Makeup','Wedding guest makeup'),
('groom-makeup','Makeup','Bridegroom makeup'),
('general-makeup','Makeup','General makeup'),
('festive-makeup','Makeup','Festive makeup'),
('wedding-photography','Photographer','Wedding photography'),
('prewedding-photography','Photographer','Pre-wedding shoot'),
('event-photography','Photographer','Event photography'),
('portrait-photography','Photographer','Portrait session'),
('product-photography','Photographer','Product photography'),
('photo-editing','Editor','Photo editing'),
('video-editing','Editor','Video editing'),
('reel-editing','Editor','Reel editing'),
('wedding-film-editing','Editor','Wedding film editing'),
('bridal-hair','HairStylist','Bridal hair styling'),
('party-hair','HairStylist','Party hair styling'),
('haircut','HairStylist','Haircut'),
('general-hair','HairStylist','Hair styling'),
('groom-styling','HairStylist','Groom styling'),
('event-reels','ContentCreator','Event reel shoot'),
('brand-content','ContentCreator','Brand content'),
('social-content','ContentCreator','Social media content'),
('product-reels','ContentCreator','Product reel shoot');
update public.services set service_key=null;

-- Campaign windows are marketing schedules, not a recurring lunar calendar.
-- 2026 Dussehra / Diwali dates checked against India Post's official calendar.
insert into public.home_campaigns(id,title,subtitle,category,service_key,starts_at,ends_at,priority) values
('garba-2026','Get Garba-ready','Festive makeup for your next night out.','Makeup','festive-makeup','2026-10-11 00:00:00+05:30','2026-10-21 00:00:00+05:30',100),
('diwali-2026','Your Diwali glow','Find a makeup artist for the celebrations.','Makeup','festive-makeup','2026-11-01 00:00:00+05:30','2026-11-10 00:00:00+05:30',100),
('christmas-2026','Make the gathering memorable','Book a photographer for your celebrations.','Photographer','event-photography','2026-12-15 00:00:00+05:30','2026-12-27 00:00:00+05:30',90),
('newyear-2027','New year. Your best look.','Explore party makeup sessions.','Makeup','party-makeup','2026-12-27 00:00:00+05:30','2027-01-03 00:00:00+05:30',100),
('wedding-makeup','Your wedding, your look','Explore bridal makeup sessions.','Makeup','bridal-makeup','2026-01-01','2100-01-01',20),
('wedding-photography','Keep every wedding moment','Find your wedding photographer.','Photographer','wedding-photography','2026-01-01','2100-01-01',19),
('birthday-reels','A celebration worth sharing','Book a creator for your event reels.','ContentCreator','event-reels','2026-01-01','2100-01-01',18);

-- Distribution covers all reviews, not just the twenty displayed comments.
create or replace function public.professional_reviews(p_professional_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'count',(select count(*) from public.booking_reviews where professional_id=p.id),
 'average',(select round(avg(rating),1) from public.booking_reviews where professional_id=p.id),
 'distribution',(select jsonb_object_agg(stars,(select count(*) from public.booking_reviews r where r.professional_id=p.id and r.rating=stars)) from generate_series(1,5) stars),
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('rating',r.rating,'comment',r.comment,'created_at',r.created_at) order by r.created_at desc) from (select rating,comment,created_at from public.booking_reviews where professional_id=p.id order by created_at desc limit 20) r),'[]'::jsonb)
 ) from public.professionals p where private.current_user_id() is not null and p.id=p_professional_id and (p.is_published or p.id=private.current_user_id());
$$;

-- A craft change must not advertise stale services from the previous craft.
create function private.reset_services_for_craft() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.category is distinct from old.category then update public.services set active=false,service_key=null where professional_id=new.id;end if;
 return new;
end;$$;
revoke all on function private.reset_services_for_craft() from public,anon,authenticated;
create trigger reset_services_for_craft after update of category on public.professionals for each row execute function private.reset_services_for_craft();

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610180003','service_profiles_campaigns',array['create table public.service_types (
 key text primary key, category public.talent_category not null, label text not null
);
alter table public.service_types enable row level security;
revoke all on public.service_types from public,anon,authenticated;
grant select on public.service_types to authenticated;
grant all on public.service_types to service_role;
create policy view_service_types on public.service_types for select to authenticated using(private.current_user_id() is not null);

alter table public.services add column service_key text references public.service_types(key);
create index services_type_active on public.services(service_key,professional_id) where active;
create function private.assign_service_type() returns trigger language plpgsql security definer set search_path='''' as $$
declare craft public.talent_category;
begin
 select category into craft from public.professionals where id=new.professional_id;
 if new.service_key is null then
   select key into new.service_key from public.service_types where category=craft and lower(label)=lower(trim(new.name));
 elsif not exists(select 1 from public.service_types where key=new.service_key and category=craft) then
   raise exception ''Choose a service for your professional category'';
 end if;
 return new;
end;$$;
revoke all on function private.assign_service_type() from public,anon,authenticated;
create trigger assign_service_type before insert or update of service_key,name,professional_id on public.services for each row execute function private.assign_service_type();

create table public.professional_photos (
 professional_id uuid primary key references public.profiles on delete cascade,
 storage_path text not null check(storage_path like professional_id::text||''/approved-%''),
 updated_at timestamptz not null default now()
);
alter table public.professional_photos enable row level security;
revoke all on public.professional_photos from public,anon,authenticated;
grant all on public.professional_photos to service_role;

create table public.home_campaigns (
 id text primary key, title text not null, subtitle text not null, category public.talent_category not null,
 service_key text references public.service_types, starts_at timestamptz not null, ends_at timestamptz not null,
 priority integer not null default 0, enabled boolean not null default true,
 check(ends_at>starts_at), check(length(title)<=100 and length(subtitle)<=200)
);
alter table public.home_campaigns enable row level security;
revoke all on public.home_campaigns from public,anon,authenticated;
grant select on public.home_campaigns to authenticated;
grant all on public.home_campaigns to service_role;
create policy active_home_campaigns on public.home_campaigns for select to authenticated
 using(private.current_user_id() is not null and enabled and starts_at<=now() and ends_at>now());

insert into public.service_types(key,category,label) values
(''bridal-makeup'',''Makeup'',''Bridal makeup''),
(''party-makeup'',''Makeup'',''Party makeup''),
(''wedding-makeup'',''Makeup'',''Wedding guest makeup''),
(''groom-makeup'',''Makeup'',''Bridegroom makeup''),
(''general-makeup'',''Makeup'',''General makeup''),
(''festive-makeup'',''Makeup'',''Festive makeup''),
(''wedding-photography'',''Photographer'',''Wedding photography''),
(''prewedding-photography'',''Photographer'',''Pre-wedding shoot''),
(''event-photography'',''Photographer'',''Event photography''),
(''portrait-photography'',''Photographer'',''Portrait session''),
(''product-photography'',''Photographer'',''Product photography''),
(''photo-editing'',''Editor'',''Photo editing''),
(''video-editing'',''Editor'',''Video editing''),
(''reel-editing'',''Editor'',''Reel editing''),
(''wedding-film-editing'',''Editor'',''Wedding film editing''),
(''bridal-hair'',''HairStylist'',''Bridal hair styling''),
(''party-hair'',''HairStylist'',''Party hair styling''),
(''haircut'',''HairStylist'',''Haircut''),
(''general-hair'',''HairStylist'',''Hair styling''),
(''groom-styling'',''HairStylist'',''Groom styling''),
(''event-reels'',''ContentCreator'',''Event reel shoot''),
(''brand-content'',''ContentCreator'',''Brand content''),
(''social-content'',''ContentCreator'',''Social media content''),
(''product-reels'',''ContentCreator'',''Product reel shoot'');
update public.services set service_key=null;

-- Campaign windows are marketing schedules, not a recurring lunar calendar.
-- 2026 Dussehra / Diwali dates checked against India Post''s official calendar.
insert into public.home_campaigns(id,title,subtitle,category,service_key,starts_at,ends_at,priority) values
(''garba-2026'',''Get Garba-ready'',''Festive makeup for your next night out.'',''Makeup'',''festive-makeup'',''2026-10-11 00:00:00+05:30'',''2026-10-21 00:00:00+05:30'',100),
(''diwali-2026'',''Your Diwali glow'',''Find a makeup artist for the celebrations.'',''Makeup'',''festive-makeup'',''2026-11-01 00:00:00+05:30'',''2026-11-10 00:00:00+05:30'',100),
(''christmas-2026'',''Make the gathering memorable'',''Book a photographer for your celebrations.'',''Photographer'',''event-photography'',''2026-12-15 00:00:00+05:30'',''2026-12-27 00:00:00+05:30'',90),
(''newyear-2027'',''New year. Your best look.'',''Explore party makeup sessions.'',''Makeup'',''party-makeup'',''2026-12-27 00:00:00+05:30'',''2027-01-03 00:00:00+05:30'',100),
(''wedding-makeup'',''Your wedding, your look'',''Explore bridal makeup sessions.'',''Makeup'',''bridal-makeup'',''2026-01-01'',''2100-01-01'',20),
(''wedding-photography'',''Keep every wedding moment'',''Find your wedding photographer.'',''Photographer'',''wedding-photography'',''2026-01-01'',''2100-01-01'',19),
(''birthday-reels'',''A celebration worth sharing'',''Book a creator for your event reels.'',''ContentCreator'',''event-reels'',''2026-01-01'',''2100-01-01'',18);

-- Distribution covers all reviews, not just the twenty displayed comments.
create or replace function public.professional_reviews(p_professional_id uuid)
returns jsonb language sql stable security definer set search_path='''' as $$
 select jsonb_build_object(
 ''count'',(select count(*) from public.booking_reviews where professional_id=p.id),
 ''average'',(select round(avg(rating),1) from public.booking_reviews where professional_id=p.id),
 ''distribution'',(select jsonb_object_agg(stars,(select count(*) from public.booking_reviews r where r.professional_id=p.id and r.rating=stars)) from generate_series(1,5) stars),
 ''reviews'',coalesce((select jsonb_agg(jsonb_build_object(''rating'',r.rating,''comment'',r.comment,''created_at'',r.created_at) order by r.created_at desc) from (select rating,comment,created_at from public.booking_reviews where professional_id=p.id order by created_at desc limit 20) r),''[]''::jsonb)
 ) from public.professionals p where private.current_user_id() is not null and p.id=p_professional_id and (p.is_published or p.id=private.current_user_id());
$$;

-- A craft change must not advertise stale services from the previous craft.
create function private.reset_services_for_craft() returns trigger language plpgsql security definer set search_path='''' as $$
begin
 if new.category is distinct from old.category then update public.services set active=false,service_key=null where professional_id=new.id;end if;
 return new;
end;$$;
revoke all on function private.reset_services_for_craft() from public,anon,authenticated;
create trigger reset_services_for_craft after update of category on public.professionals for each row execute function private.reset_services_for_craft();
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610180004') then
      raise exception 'Migration 202610180004 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Public professional names are generated aliases, independent of private identity.
create table private.professional_usernames (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z]+[0-9]{6}$')
);
alter table private.professional_usernames enable row level security;
revoke all on private.professional_usernames from public,anon,authenticated;

create function private.professional_username(p_user_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare value text;words text[]:=array['innermost','quietpixel','softorbit','silverfern','brightmuse','gentlewave','ambercloud','velvetleaf','hiddenbloom','littlecomet','wildpetal','calmpanda','dreamyotter','mistycedar','lunarfinch','cozycanvas'];
begin
 perform 1 from public.profiles where id=p_user_id for update;
 select username into value from private.professional_usernames where user_id=p_user_id;
 if value is not null then return value;end if;
 loop
  value:=words[1+floor(random()*array_length(words,1))::integer]||lpad(floor(random()*1000000)::integer::text,6,'0');
  begin
   insert into private.professional_usernames(user_id,username) values(p_user_id,value);
   return value;
  exception when unique_violation then
   select username into value from private.professional_usernames where user_id=p_user_id;
   if value is not null then return value;end if;
  end;
 end loop;
end; $$;
revoke all on function private.professional_username(uuid) from public,anon,authenticated;

create function private.enforce_professional_username() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='professionals' then new.display_name:=private.professional_username(new.id);
 elsif new.professional_display_name is not null then new.professional_display_name:=private.professional_username(new.id);
 end if;
 return new;
end; $$;
revoke all on function private.enforce_professional_username() from public,anon,authenticated;
create trigger enforce_professional_username before insert or update of display_name on public.professionals
for each row execute function private.enforce_professional_username();
create trigger enforce_registered_username before update of professional_display_name on public.profiles
for each row execute function private.enforce_professional_username();

update public.professionals set display_name=display_name;
update public.profiles set professional_display_name=private.professional_username(id)
where professional_display_name is not null or exists(select 1 from public.professionals p where p.id=profiles.id);

create or replace function public.complete_registration(p_full_name text,p_email text,p_professional_name text default null,p_professional boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=private.current_user_id();u auth.users;account_name text:=regexp_replace(trim(p_full_name),'\s+',' ','g');public_name text;email_value text;
begin
 if who is null then raise exception 'Sign in to complete your profile';end if;
 perform 1 from public.profiles where id=who for update;
 select * into u from auth.users where id=who;
 if nullif(u.phone,'') is null or u.phone_confirmed_at is null then raise exception 'Verify your mobile number first';end if;
 if account_name is null or length(account_name) not between 2 and 120 or account_name ~* '(https?://|www\.|@)' then raise exception 'Enter your full name (2-120 characters)';end if;
 email_value:=lower(trim(coalesce(nullif(u.email,''),p_email)));
 if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address';end if;
 select professional_display_name into public_name from public.profiles where id=who;
 if p_professional or public_name is not null then public_name:=private.professional_username(who);end if;
 update public.profiles set full_name=account_name,display_name=account_name,contact_email=email_value,
 professional_display_name=public_name,registration_completed_at=coalesce(registration_completed_at,now()) where id=who;
 if public_name is not null then update public.professionals set display_name=public_name where id=who;end if;
 return public.my_registration();
end; $$;

create or replace function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=private.current_user_id();public_name text;
begin
 if who is null then raise exception 'Sign in to save your profile';end if;
 public_name:=private.professional_username(who);
 perform private.save_professional_profile(jsonb_set(p_profile,'{display_name}',to_jsonb(public_name)),p_private,p_service);
 update public.profiles set professional_display_name=public_name where id=who;
end; $$;

-- The full review page is separate from the two-comment profile preview.
create function public.professional_review_page(p_professional_id uuid,p_offset integer default 0,p_limit integer default 20)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_agg(jsonb_build_object('rating',r.rating,'comment',r.comment,'created_at',r.created_at) order by r.created_at desc,r.booking_id desc)
 from (select r.booking_id,r.rating,r.comment,r.created_at from public.booking_reviews r
 join public.professionals p on p.id=r.professional_id
 where r.professional_id=p_professional_id and private.current_user_id() is not null and (p.is_published or p.id=private.current_user_id())
 order by r.created_at desc,r.booking_id desc limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(0,coalesce(p_offset,0))) r),'[]'::jsonb);
$$;
revoke all on function public.professional_review_page(uuid,integer,integer) from public,anon;
grant execute on function public.professional_review_page(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610180004','public_usernames_reviews',array['-- Public professional names are generated aliases, independent of private identity.
create table private.professional_usernames (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 username text not null unique check(username ~ ''^[a-z]+[0-9]{6}$'')
);
alter table private.professional_usernames enable row level security;
revoke all on private.professional_usernames from public,anon,authenticated;

create function private.professional_username(p_user_id uuid) returns text
language plpgsql security definer set search_path='''' as $$
declare value text;words text[]:=array[''innermost'',''quietpixel'',''softorbit'',''silverfern'',''brightmuse'',''gentlewave'',''ambercloud'',''velvetleaf'',''hiddenbloom'',''littlecomet'',''wildpetal'',''calmpanda'',''dreamyotter'',''mistycedar'',''lunarfinch'',''cozycanvas''];
begin
 perform 1 from public.profiles where id=p_user_id for update;
 select username into value from private.professional_usernames where user_id=p_user_id;
 if value is not null then return value;end if;
 loop
  value:=words[1+floor(random()*array_length(words,1))::integer]||lpad(floor(random()*1000000)::integer::text,6,''0'');
  begin
   insert into private.professional_usernames(user_id,username) values(p_user_id,value);
   return value;
  exception when unique_violation then
   select username into value from private.professional_usernames where user_id=p_user_id;
   if value is not null then return value;end if;
  end;
 end loop;
end; $$;
revoke all on function private.professional_username(uuid) from public,anon,authenticated;

create function private.enforce_professional_username() returns trigger
language plpgsql security definer set search_path='''' as $$
begin
 if tg_table_name=''professionals'' then new.display_name:=private.professional_username(new.id);
 elsif new.professional_display_name is not null then new.professional_display_name:=private.professional_username(new.id);
 end if;
 return new;
end; $$;
revoke all on function private.enforce_professional_username() from public,anon,authenticated;
create trigger enforce_professional_username before insert or update of display_name on public.professionals
for each row execute function private.enforce_professional_username();
create trigger enforce_registered_username before update of professional_display_name on public.profiles
for each row execute function private.enforce_professional_username();

update public.professionals set display_name=display_name;
update public.profiles set professional_display_name=private.professional_username(id)
where professional_display_name is not null or exists(select 1 from public.professionals p where p.id=profiles.id);

create or replace function public.complete_registration(p_full_name text,p_email text,p_professional_name text default null,p_professional boolean default false)
returns jsonb language plpgsql security definer set search_path='''' as $$
declare who uuid:=private.current_user_id();u auth.users;account_name text:=regexp_replace(trim(p_full_name),''\s+'','' '',''g'');public_name text;email_value text;
begin
 if who is null then raise exception ''Sign in to complete your profile'';end if;
 perform 1 from public.profiles where id=who for update;
 select * into u from auth.users where id=who;
 if nullif(u.phone,'''') is null or u.phone_confirmed_at is null then raise exception ''Verify your mobile number first'';end if;
 if account_name is null or length(account_name) not between 2 and 120 or account_name ~* ''(https?://|www\.|@)'' then raise exception ''Enter your full name (2-120 characters)'';end if;
 email_value:=lower(trim(coalesce(nullif(u.email,''''),p_email)));
 if email_value is null or length(email_value)>254 or email_value !~ ''^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'' then raise exception ''Enter a valid email address'';end if;
 select professional_display_name into public_name from public.profiles where id=who;
 if p_professional or public_name is not null then public_name:=private.professional_username(who);end if;
 update public.profiles set full_name=account_name,display_name=account_name,contact_email=email_value,
 professional_display_name=public_name,registration_completed_at=coalesce(registration_completed_at,now()) where id=who;
 if public_name is not null then update public.professionals set display_name=public_name where id=who;end if;
 return public.my_registration();
end; $$;

create or replace function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path='''' as $$
declare who uuid:=private.current_user_id();public_name text;
begin
 if who is null then raise exception ''Sign in to save your profile'';end if;
 public_name:=private.professional_username(who);
 perform private.save_professional_profile(jsonb_set(p_profile,''{display_name}'',to_jsonb(public_name)),p_private,p_service);
 update public.profiles set professional_display_name=public_name where id=who;
end; $$;

-- The full review page is separate from the two-comment profile preview.
create function public.professional_review_page(p_professional_id uuid,p_offset integer default 0,p_limit integer default 20)
returns jsonb language sql stable security definer set search_path='''' as $$
 select coalesce((select jsonb_agg(jsonb_build_object(''rating'',r.rating,''comment'',r.comment,''created_at'',r.created_at) order by r.created_at desc,r.booking_id desc)
 from (select r.booking_id,r.rating,r.comment,r.created_at from public.booking_reviews r
 join public.professionals p on p.id=r.professional_id
 where r.professional_id=p_professional_id and private.current_user_id() is not null and (p.is_published or p.id=private.current_user_id())
 order by r.created_at desc,r.booking_id desc limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(0,coalesce(p_offset,0))) r),''[]''::jsonb);
$$;
revoke all on function public.professional_review_page(uuid,integer,integer) from public,anon;
grant execute on function public.professional_review_page(uuid,integer,integer) to authenticated;
notify pgrst,''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610210001') then
      raise exception 'Migration 202610210001 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Verified, explicitly approved emails may manage marketing artwork only.
create table private.banner_admins (
 email text primary key check(email=lower(trim(email)) and position('@' in email)>1),
 created_at timestamptz not null default now()
);
alter table private.banner_admins enable row level security;
revoke all on private.banner_admins from public,anon,authenticated;
grant all on private.banner_admins to service_role;

create function public.is_banner_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join private.banner_admins a
 on a.email=lower(to_jsonb(u)->>'email')
 where u.id=auth.uid() and to_jsonb(u)->>'email_confirmed_at' is not null);
$$;
revoke all on function public.is_banner_admin() from public,anon;
grant execute on function public.is_banner_admin() to authenticated,service_role;

create function public.grant_banner_admin(p_email text) returns void language sql security definer set search_path='' as $$
 insert into private.banner_admins(email) values(lower(trim(p_email))) on conflict(email) do nothing;
$$;
revoke all on function public.grant_banner_admin(text) from public,anon,authenticated;
grant execute on function public.grant_banner_admin(text) to service_role;

alter table public.home_campaigns
 add column image_path text,
 add column image_width integer,
 add column image_height integer,
 add column background_color text check(background_color is null or background_color ~ '^#[0-9A-Fa-f]{6}$'),
 add column updated_at timestamptz not null default now(),
 add column updated_by uuid references auth.users(id) on delete set null,
 add constraint campaign_image_shape check(image_path is null or
  (image_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'
   and image_width is not null and image_height is not null
   and image_width between 320 and 4096 and image_height between 160 and 4096
   and image_width::numeric/image_height between .5 and 4));

grant insert,update on public.home_campaigns to authenticated;
create policy banner_admin_read on public.home_campaigns for select to authenticated using(public.is_banner_admin());
create policy banner_admin_insert on public.home_campaigns for insert to authenticated
 with check(public.is_banner_admin() and (not enabled or image_path is not null));
create policy banner_admin_update on public.home_campaigns for update to authenticated
 using(public.is_banner_admin()) with check(public.is_banner_admin() and (not enabled or image_path is not null));
create policy banner_admin_service_types on public.service_types for select to authenticated using(public.is_banner_admin());

create function private.validate_home_banner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.service_key is not null and not exists(select 1 from public.service_types where key=new.service_key and category=new.category) then
  raise exception 'Choose a service in the selected profession';
 end if;
 if new.image_path is not null then
  if not exists(select 1 from storage.objects where bucket_id='home-banners' and name=new.image_path) then
   raise exception 'Upload the banner image before saving';
  end if;
 end if;
 new.updated_at:=now();new.updated_by:=auth.uid();return new;
end;$$;
revoke all on function private.validate_home_banner() from public,anon,authenticated;
create trigger validate_home_banner before insert or update on public.home_campaigns
 for each row execute function private.validate_home_banner();

-- Only marketing artwork is public. Existing private portfolio storage is untouched.
do $storage$ begin
 if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('home-banners','home-banners',true,8388608,array['image/jpeg','image/png','image/webp']);
create policy banner_admin_upload on storage.objects for insert to authenticated
 with check(bucket_id='home-banners' and public.is_banner_admin()
  and split_part(name,'/',1)=auth.uid()::text
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$');
create policy banner_admin_objects on storage.objects for select to authenticated
 using(bucket_id='home-banners' and public.is_banner_admin());
create policy banner_admin_cleanup on storage.objects for delete to authenticated
 using(bucket_id='home-banners' and public.is_banner_admin() and split_part(name,'/',1)=auth.uid()::text
  and not exists(select 1 from public.home_campaigns c where c.image_path=name));

 end if;
end $storage$;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='home_campaigns') then
  alter publication supabase_realtime add table public.home_campaigns;
 end if;
end $$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610210001','banner_admin',array['-- Verified, explicitly approved emails may manage marketing artwork only.
create table private.banner_admins (
 email text primary key check(email=lower(trim(email)) and position(''@'' in email)>1),
 created_at timestamptz not null default now()
);
alter table private.banner_admins enable row level security;
revoke all on private.banner_admins from public,anon,authenticated;
grant all on private.banner_admins to service_role;

create function public.is_banner_admin() returns boolean language sql stable security definer set search_path='''' as $$
 select exists(select 1 from auth.users u join private.banner_admins a
 on a.email=lower(to_jsonb(u)->>''email'')
 where u.id=auth.uid() and to_jsonb(u)->>''email_confirmed_at'' is not null);
$$;
revoke all on function public.is_banner_admin() from public,anon;
grant execute on function public.is_banner_admin() to authenticated,service_role;

create function public.grant_banner_admin(p_email text) returns void language sql security definer set search_path='''' as $$
 insert into private.banner_admins(email) values(lower(trim(p_email))) on conflict(email) do nothing;
$$;
revoke all on function public.grant_banner_admin(text) from public,anon,authenticated;
grant execute on function public.grant_banner_admin(text) to service_role;

alter table public.home_campaigns
 add column image_path text,
 add column image_width integer,
 add column image_height integer,
 add column background_color text check(background_color is null or background_color ~ ''^#[0-9A-Fa-f]{6}$''),
 add column updated_at timestamptz not null default now(),
 add column updated_by uuid references auth.users(id) on delete set null,
 add constraint campaign_image_shape check(image_path is null or
  (image_path ~ ''^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$''
   and image_width is not null and image_height is not null
   and image_width between 320 and 4096 and image_height between 160 and 4096
   and image_width::numeric/image_height between .5 and 4));

grant insert,update on public.home_campaigns to authenticated;
create policy banner_admin_read on public.home_campaigns for select to authenticated using(public.is_banner_admin());
create policy banner_admin_insert on public.home_campaigns for insert to authenticated
 with check(public.is_banner_admin() and (not enabled or image_path is not null));
create policy banner_admin_update on public.home_campaigns for update to authenticated
 using(public.is_banner_admin()) with check(public.is_banner_admin() and (not enabled or image_path is not null));
create policy banner_admin_service_types on public.service_types for select to authenticated using(public.is_banner_admin());

create function private.validate_home_banner() returns trigger language plpgsql security definer set search_path='''' as $$
begin
 if new.service_key is not null and not exists(select 1 from public.service_types where key=new.service_key and category=new.category) then
  raise exception ''Choose a service in the selected profession'';
 end if;
 if new.image_path is not null then
  if not exists(select 1 from storage.objects where bucket_id=''home-banners'' and name=new.image_path) then
   raise exception ''Upload the banner image before saving'';
  end if;
 end if;
 new.updated_at:=now();new.updated_by:=auth.uid();return new;
end;$$;
revoke all on function private.validate_home_banner() from public,anon,authenticated;
create trigger validate_home_banner before insert or update on public.home_campaigns
 for each row execute function private.validate_home_banner();

-- Only marketing artwork is public. Existing private portfolio storage is untouched.
do $storage$ begin
 if to_regclass(''storage.buckets'') is not null and to_regclass(''storage.objects'') is not null then
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values(''home-banners'',''home-banners'',true,8388608,array[''image/jpeg'',''image/png'',''image/webp'']);
create policy banner_admin_upload on storage.objects for insert to authenticated
 with check(bucket_id=''home-banners'' and public.is_banner_admin()
  and split_part(name,''/'',1)=auth.uid()::text
  and name ~ ''^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'');
create policy banner_admin_objects on storage.objects for select to authenticated
 using(bucket_id=''home-banners'' and public.is_banner_admin());
create policy banner_admin_cleanup on storage.objects for delete to authenticated
 using(bucket_id=''home-banners'' and public.is_banner_admin() and split_part(name,''/'',1)=auth.uid()::text
  and not exists(select 1 from public.home_campaigns c where c.image_path=name));

 end if;
end $storage$;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname=''supabase_realtime'' and schemaname=''public'' and tablename=''home_campaigns'') then
  alter publication supabase_realtime add table public.home_campaigns;
 end if;
end $$;
notify pgrst,''reload schema'';
']);
do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version='202610210002') then
      raise exception 'Migration 202610210002 is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;
-- Curated service cards can span multiple professions for a single campaign.
alter table public.home_campaigns add column featured_service_keys text[]
 check(featured_service_keys is null or cardinality(featured_service_keys)<=8);
create function private.validate_campaign_picks() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.featured_service_keys is not null and (
  array_position(new.featured_service_keys,null) is not null or
  cardinality(new.featured_service_keys)<>(select count(distinct key) from unnest(new.featured_service_keys) as picked(key)) or
  exists(select 1 from unnest(new.featured_service_keys) as picked(key) where not exists(select 1 from public.service_types s where s.key=picked.key))
 ) then raise exception 'Choose up to eight distinct available services for Festive picks';end if;
 return new;
end;$$;
revoke all on function private.validate_campaign_picks() from public,anon,authenticated;
create trigger validate_campaign_picks before insert or update on public.home_campaigns
 for each row execute function private.validate_campaign_picks();
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
    values('202610210002','banner_featured_services',array['-- Curated service cards can span multiple professions for a single campaign.
alter table public.home_campaigns add column featured_service_keys text[]
 check(featured_service_keys is null or cardinality(featured_service_keys)<=8);
create function private.validate_campaign_picks() returns trigger language plpgsql security definer set search_path='''' as $$
begin
 if new.featured_service_keys is not null and (
  array_position(new.featured_service_keys,null) is not null or
  cardinality(new.featured_service_keys)<>(select count(distinct key) from unnest(new.featured_service_keys) as picked(key)) or
  exists(select 1 from unnest(new.featured_service_keys) as picked(key) where not exists(select 1 from public.service_types s where s.key=picked.key))
 ) then raise exception ''Choose up to eight distinct available services for Festive picks'';end if;
 return new;
end;$$;
revoke all on function private.validate_campaign_picks() from public,anon,authenticated;
create trigger validate_campaign_picks before insert or update on public.home_campaigns
 for each row execute function private.validate_campaign_picks();
notify pgrst,''reload schema'';
']);
notify pgrst, 'reload schema';
commit;
select 'CC Circle database deployment complete' as result;
