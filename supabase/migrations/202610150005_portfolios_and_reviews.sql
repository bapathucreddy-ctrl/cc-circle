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
