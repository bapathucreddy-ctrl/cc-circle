-- Private registered bases, first-name identity, and admin-approved event bookings.
create table public.professional_home_locations (
 professional_id uuid primary key references public.profiles on delete cascade,
 address text not null check(length(trim(address)) between 10 and 500),
 longitude double precision not null check(longitude between -180 and 180),
 latitude double precision not null check(latitude between -90 and 90),
 updated_at timestamptz not null default now()
);
alter table public.professional_home_locations enable row level security;
revoke all on public.professional_home_locations from public,anon,authenticated;
grant select on public.professional_home_locations to authenticated;
grant all on public.professional_home_locations to service_role;
create policy private_home on public.professional_home_locations for select to authenticated using(professional_id=private.current_user_id() or public.is_banner_admin());

create function private.valid_identity_name(value text) returns boolean language sql immutable set search_path='' as $$
 select value is not null and length(trim(value)) between 2 and 120
 and value ~ '^[[:alpha:]][[:alpha:][:space:].''’-]*$'
 and value !~* '(^|[[:space:]])(makeup|photographer|photography|editor|editing|studio|salon|artist|stylist|bridal|wedding|official|booking|best|brand|company|production|creative|dancer|actor|media|agency|services?|offers?)([[:space:]]|$)';
$$;
revoke all on function private.valid_identity_name(text) from public,anon,authenticated;
-- Retain the private helper signature for older callers, but stop generating aliases.
create or replace function private.professional_username(p_user_id uuid) returns text language sql stable security definer set search_path='' as $$
 select case when private.valid_identity_name(full_name) then split_part(trim(full_name),' ',1) else 'Professional' end from public.profiles where id=p_user_id;
$$;
create or replace function private.enforce_professional_username() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='professionals' then new.display_name:=private.professional_username(new.id);
 elsif new.professional_display_name is not null then new.professional_display_name:=case when private.valid_identity_name(new.full_name) then split_part(trim(new.full_name),' ',1) else 'Professional' end;end if;
 return new;
end;$$;
create function private.validate_identity_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.professional_display_name is not null and not private.valid_identity_name(new.full_name) then raise exception 'Enter your real full name without profession, business names or promotional text';end if;
 return new;
end;$$;
revoke all on function private.validate_identity_update() from public,anon,authenticated;
create trigger validate_identity_update before update of full_name on public.profiles for each row execute function private.validate_identity_update();
update public.professionals set display_name=display_name;
update public.profiles set professional_display_name=private.professional_username(id) where professional_display_name is not null;

create or replace function public.complete_registration(p_full_name text,p_email text,p_professional_name text default null,p_professional boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=private.current_user_id();u auth.users;account_name text:=regexp_replace(trim(p_full_name),'\s+',' ','g');public_name text;email_value text;
begin
 if who is null then raise exception 'Sign in to complete your profile';end if;
 perform 1 from public.profiles where id=who for update;
 select * into u from auth.users where id=who;
 if nullif(u.phone,'') is null or u.phone_confirmed_at is null then raise exception 'Verify your mobile number first';end if;
 if account_name is null or length(account_name) not between 2 and 120 or account_name ~* '(https?://|www\.|@)' then raise exception 'Enter your full name';end if;
 select professional_display_name into public_name from public.profiles where id=who;
 if p_professional or public_name is not null then
  if not private.valid_identity_name(account_name) then raise exception 'Enter your real full name without profession, business names or promotional text';end if;
  public_name:=split_part(account_name,' ',1);
 end if;
 email_value:=lower(trim(coalesce(nullif(u.email,''),p_email)));
 if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address';end if;
 update public.profiles set full_name=account_name,display_name=account_name,contact_email=email_value,professional_display_name=public_name,registration_completed_at=coalesce(registration_completed_at,now()) where id=who;
 if public_name is not null then update public.professionals set display_name=public_name where id=who;end if;
 return public.my_registration();
end;$$;

create function private.require_software(specs jsonb,key text,allowed text[]) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(specs->key) is distinct from 'array' then raise exception 'Choose at least one relevant editing software';end if;
 if jsonb_array_length(specs->key)=0 or exists(select 1 from jsonb_array_elements_text(specs->key) t(value) where not(value=any(allowed))) then raise exception 'Choose valid editing software';end if;
end;$$;
revoke all on function private.require_software(jsonb,text,text[]) from public,anon,authenticated;
create or replace function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=private.current_user_id();account_name text;home jsonb:=p_private->'home_location';specs jsonb:=p_profile->'public_specs';craft text:=p_profile->>'category';field text; lon double precision;lat double precision;
begin
 if who is null then raise exception 'Sign in to save your profile';end if;
 select p.full_name into account_name from public.profiles p where id=who for update;
 account_name:=coalesce(nullif(trim(p_private->>'identity_full_name'),''),account_name);
 if not private.valid_identity_name(account_name) then raise exception 'Enter your real full name without profession, business names or promotional text';end if;
 update public.profiles set full_name=account_name,display_name=account_name where id=who;
 if home is null or jsonb_typeof(home)<>'object' or length(trim(coalesce(home->>'address',''))) not between 10 and 500 then raise exception 'Provide your registered home address and confirm its map pin';end if;
 lon:=(home->>'longitude')::double precision;lat:=(home->>'latitude')::double precision;
 if lon is null or lat is null or not(lon between -180 and 180 and lat between -90 and 90) then raise exception 'Confirm your registered home map pin';end if;
 if craft='Photographer' then
  foreach field in array array['lenses','lighting-kit','backup-camera','backup-memory','equipment-pricing'] loop
   if jsonb_typeof(specs->field) is distinct from 'string' or length(trim(coalesce(specs->>field,''))) not between 2 and 1000 then raise exception 'Complete equipment details: %',field;end if;
  end loop;
 end if;
 if craft='Photographer' or (craft='Editor' and exists(select 1 from jsonb_array_elements_text(coalesce(specs->'editing-services','[]')) t(value) where value='Photo Editing')) then
  perform private.require_software(specs,'photo-software',array['Adobe Lightroom','Capture One','Adobe Photoshop']);end if;
 if craft='ContentCreator' or (craft='Editor' and exists(select 1 from jsonb_array_elements_text(coalesce(specs->'editing-services','[]')) t(value) where value='Video Editing')) then
  perform private.require_software(specs,'video-software',array['Final Cut Pro (FCP)','DaVinci Resolve','Adobe After Effects','Adobe Premiere Pro']);end if;
 if craft='Editor' and (jsonb_typeof(specs->'editing-services') is distinct from 'array' or jsonb_array_length(specs->'editing-services')=0 or exists(select 1 from jsonb_array_elements_text(specs->'editing-services') t(value) where value not in ('Photo Editing','Video Editing'))) then raise exception 'Choose photo and/or video editing services';end if;
 insert into public.professional_home_locations(professional_id,address,longitude,latitude) values(who,trim(home->>'address'),lon,lat)
 on conflict(professional_id) do update set address=excluded.address,longitude=excluded.longitude,latitude=excluded.latitude,updated_at=now();
 -- Never copy the exact private address/coordinates to the publicly readable profile.
 p_profile:=p_profile||jsonb_build_object('display_name',split_part(trim(account_name),' ',1),'longitude',round(lon::numeric,2),'latitude',round(lat::numeric,2));
 perform private.save_professional_profile(p_profile,p_private-'home_location'-'identity_full_name',p_service);
 update public.profiles set professional_display_name=split_part(trim(account_name),' ',1) where id=who;
end;$$;
-- Profile writes go through the validated RPC, including clients that bypass the form.
revoke insert,update on public.professionals from authenticated;
revoke insert(id,display_name,category,city,bio,specialties,longitude,latitude,available_now,is_published,portfolio_urls,public_specs),update(display_name,category,city,bio,specialties,longitude,latitude,available_now,is_published,portfolio_urls,public_specs) on public.professionals from authenticated;
grant update(available_now) on public.professionals to authenticated;

drop function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean);
create function public.discover_live_professionals(p_category public.talent_category,p_longitude double precision,p_latitude double precision,p_query text default '',p_radius_km double precision default 10,p_available_now boolean default false)
returns table(id uuid,display_name text,category public.talent_category,city text,bio text,specialties text[],available_now boolean,longitude numeric,latitude numeric,portfolio_urls text[],distance_km double precision,booking_price_paise integer,location_updated_at timestamptz,location_accuracy_meters double precision,availability_status text)
language sql stable security definer set search_path='' as $$
 select p.id,p.display_name,p.category,p.city,p.bio,p.specialties,a.online,
 case when a.online and l.professional_id is not null then l.longitude::numeric else round(h.longitude::numeric,2) end,
 case when a.online and l.professional_id is not null then l.latitude::numeric else round(h.latitude::numeric,2) end,
 p.portfolio_urls,d.km,q.total_paise,case when a.online then l.updated_at end,case when a.online then l.accuracy_meters end,case when a.online then 'online' when p.available_now then 'busy' else 'offline' end
 from public.professionals p left join public.professional_home_locations h on h.professional_id=p.id
 cross join lateral(select p.available_now and not private.professional_busy(p.id,now(),now()+interval '15 minutes') as online) a
 left join private.professional_live_locations l on l.professional_id=p.id and l.updated_at>now()-interval '90 seconds' and a.online
 cross join lateral(select case when l.professional_id is not null then l.longitude else round(h.longitude::numeric,2)::double precision end as lon,case when l.professional_id is not null then l.latitude else round(h.latitude::numeric,2)::double precision end as lat) pos
 cross join lateral(select 6371*2*asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(pos.lat-p_latitude)/2),2)+cos(radians(p_latitude))*cos(radians(pos.lat))*power(sin(radians(pos.lon-p_longitude)/2),2))))) as km) d
 join lateral(select min(s.amount_paise) as net from public.services s where s.professional_id=p.id and s.active) s on s.net is not null
 cross join lateral private.booking_pricing(s.net) q
 where private.current_user_id() is not null and p.is_published and p.category=p_category and pos.lon is not null and pos.lat is not null
 and p_latitude between -90 and 90 and p_longitude between -180 and 180 and d.km<=least(greatest(p_radius_km,1),10)
 and (p_query='' or position(lower(left(p_query,100)) in lower(p.display_name||' '||array_to_string(p.specialties,' ')))>0)
 order by a.online desc,d.km,p.id limit 100;
$$;
revoke all on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) from public,anon;
grant execute on function public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean) to authenticated;

alter table private.team_applications add column review_status text not null default 'pending' check(review_status in ('pending','approved','rejected')),
 add column reviewed_by uuid references public.profiles,add column reviewed_at timestamptz,add column review_note text not null default '' check(length(review_note)<=1000);
update private.team_applications set review_status='approved' where booking_id is not null;
create table private.team_declines(event_id uuid references private.team_events on delete cascade,professional_id uuid references public.professionals,created_at timestamptz not null default now(),primary key(event_id,professional_id));
revoke all on private.team_declines from public,anon,authenticated;
create function public.reject_team_request(p_event_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from private.team_events e join private.team_roles r on r.event_id=e.id join public.professionals p on p.category=r.category and p.id=private.current_user_id() and p.is_published where e.id=p_event_id and e.starts_at>now() for update of e;
 if not found then raise exception 'Matching event not found';end if;
 if exists(select 1 from private.team_applications where event_id=p_event_id and professional_id=private.current_user_id()) then raise exception 'Withdraw your existing response first';end if;
 insert into private.team_declines values(p_event_id,private.current_user_id(),now()) on conflict do nothing;
end;$$;
-- Keep the participant-scoped existing data, enriching it without exposing other quotes.
alter function public.team_requests() set schema private;
revoke all on function private.team_requests() from public,anon,authenticated;
create function public.team_requests() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(e||jsonb_build_object('declined',exists(select 1 from private.team_declines d where d.event_id=(e->>'id')::uuid and d.professional_id=private.current_user_id()),
 'my_application',case when e->'my_application'<>'null'::jsonb then e->'my_application'||jsonb_build_object('review_status',(select review_status from private.team_applications where id=(e->'my_application'->>'id')::uuid)) else 'null'::jsonb end)),'[]'::jsonb)
 from jsonb_array_elements(private.team_requests()) e;
$$;
alter function public.team_applicants(uuid) set schema private;
revoke all on function private.team_applicants(uuid) from public,anon,authenticated;
create function public.team_applicants(p_event_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(e||jsonb_build_object('review_status',(select review_status from private.team_applications where id=(e->>'id')::uuid))),'[]'::jsonb) from jsonb_array_elements(private.team_applicants(p_event_id)) e;
$$;
create or replace function public.accept_team_applicant(p_application_id uuid,p_expected_total_paise integer) returns public.bookings language plpgsql security definer set search_path='' as $$
declare b public.bookings;
begin
 if not exists(select 1 from private.team_applications a join private.team_events e on e.id=a.event_id where a.id=p_application_id and e.client_id=private.current_user_id()) then raise exception 'Customer application not found';end if;
 select b1.* into b from private.team_applications a join private.team_events e on e.id=a.event_id join public.bookings b1 on b1.id=a.booking_id where a.id=p_application_id and e.client_id=private.current_user_id() and a.review_status='approved';
 if not found then raise exception 'Awaiting final admin approval. A professional response does not confirm the booking.';end if;
 return b;
end;$$;
create function public.admin_bulk_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from(select e.*,
 (select jsonb_agg(to_jsonb(r)) from private.team_roles r where r.event_id=e.id) as roles,
 (select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('first_name',p.display_name,'full_name',u.full_name)),'[]'::jsonb) from private.team_applications a join public.professionals p on p.id=a.professional_id join public.profiles u on u.id=p.id where a.event_id=e.id) as responses,
 (select coalesce(jsonb_agg(jsonb_build_object('professional_id',d.professional_id,'full_name',u.full_name,'status','declined')),'[]'::jsonb) from private.team_declines d join public.profiles u on u.id=d.professional_id where d.event_id=e.id) as declines
 from private.team_events e order by e.created_at desc limit 100)t);
end;$$;
create function public.review_bulk_response(p_application_id uuid,p_approve boolean,p_note text default '',p_expected_total_paise integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare a private.team_applications;e private.team_events;s public.services;fees record;b uuid;needed integer;
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 if p_approve is null or p_note is null or length(p_note)>1000 then raise exception 'Invalid review';end if;
 select e1.* into e from private.team_events e1 join private.team_applications a1 on a1.event_id=e1.id where a1.id=p_application_id for update of e1;
 if not found then raise exception 'Event response not found';end if;
 select * into a from private.team_applications where id=p_application_id for update;
 if p_expected_total_paise is not null and p_expected_total_paise<>a.total_paise then raise exception 'Review the latest application price';end if;
 if a.review_status='approved' then return a.booking_id;end if;
 if a.review_status<>'pending' then raise exception 'This response has already been reviewed';end if;
 if not p_approve then update private.team_applications set review_status='rejected',reviewed_by=private.current_user_id(),reviewed_at=now(),review_note=trim(p_note) where id=a.id;return null;end if;
 if e.starts_at<=now() then raise exception 'This event has already started';end if;
 perform 1 from public.professionals where id=a.professional_id and is_published and category=a.category for update;
 if not found then raise exception 'Professional is no longer available';end if;
 select quantity into needed from private.team_roles where event_id=e.id and category=a.category;
 if private.team_selected(e.id,a.category)>=needed then raise exception 'Requested headcount is filled';end if;
 select * into s from public.services where id=a.service_id and active for share;
 if not found or s.name<>a.service_name or (e.billing_mode='fixed' and (s.amount_paise<>a.net_paise or s.duration_minutes<>a.duration_minutes)) then raise exception 'This service has changed. Ask for a new professional response';end if;
 if private.professional_busy(a.professional_id,e.starts_at,e.starts_at+make_interval(mins=>a.duration_minutes)) or exists(select 1 from public.bookings where professional_id=a.professional_id and status in ('requested','accepted','en_route','arrived') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(e.starts_at,e.starts_at+make_interval(mins=>a.duration_minutes),'[)')) then raise exception 'This time is unavailable';end if;
 if e.billing_mode='hourly' then select * into fees from private.hourly_booking_price(a.net_paise,a.total_paise,1);else select * into fees from private.booking_pricing(a.net_paise);if fees.total_paise<>a.total_paise then raise exception 'Review a new quote before approving';end if;end if;
 insert into public.bookings(client_id,professional_id,service_id,request_id,service_name,status,starts_at,ends_at,venue,venue_longitude,venue_latitude,notes,amount_paise,service_amount_paise,buyer_fee_paise,talent_fee_paise,talent_payout_paise,billing_mode,hourly_net_paise,hourly_rate_paise)
 values(e.client_id,a.professional_id,a.service_id,a.id,a.service_name,'accepted',e.starts_at,e.starts_at+make_interval(mins=>a.duration_minutes),e.venue,e.longitude,e.latitude,left(e.title||E'\n'||e.requirements,2000),fees.total_paise,fees.service_amount_paise,fees.buyer_fee_paise,fees.talent_fee_paise,fees.talent_payout_paise,e.billing_mode,case when e.billing_mode='hourly' then a.net_paise end,case when e.billing_mode='hourly' then a.total_paise end) returning id into b;
 update private.team_applications set review_status='approved',reviewed_by=private.current_user_id(),reviewed_at=now(),review_note=trim(p_note),booking_id=b where id=a.id;
 return b;
end;$$;
revoke all on function public.reject_team_request(uuid),public.admin_bulk_requests(),public.review_bulk_response(uuid,boolean,text,integer),public.team_requests(),public.team_applicants(uuid) from public,anon;
grant execute on function public.reject_team_request(uuid),public.admin_bulk_requests(),public.review_bulk_response(uuid,boolean,text,integer),public.team_requests(),public.team_applicants(uuid) to authenticated;

-- A photo is private to its owner/admin until individual-portrait review completes.
alter table public.professional_photos add column review_status text not null default 'pending' check(review_status in ('pending','approved','rejected'));
create function private.review_avatar_with_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.professional_photos set review_status=new.status where professional_id=new.professional_id;
 return new;
end;$$;
revoke all on function private.review_avatar_with_profile() from public,anon,authenticated;
create trigger review_avatar_with_profile after insert or update on private.professional_reviews for each row execute function private.review_avatar_with_profile();
-- New avatar bytes invalidate any previous profile badge until an admin reviews again.
create function private.reset_avatar_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.storage_path is distinct from old.storage_path then
  new.review_status:='pending';delete from private.professional_reviews where professional_id=new.professional_id;
  update public.professionals set verified_at=null where id=new.professional_id;
 end if;
 return new;
end;$$;
revoke all on function private.reset_avatar_review() from public,anon,authenticated;
create trigger reset_avatar_review before insert or update of storage_path on public.professional_photos for each row execute function private.reset_avatar_review();
notify pgrst,'reload schema';
alter function public.review_professional(uuid,text,text,timestamptz) set schema private;
revoke all on function private.review_professional(uuid,text,text,timestamptz) from public,anon,authenticated;
create function public.review_professional(p_id uuid,p_status text,p_note text default '',p_expected_reviewed_at timestamptz default null,p_expected_avatar_path text default null) returns void language plpgsql security definer set search_path='' as $$
declare path text;account_name text;
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 select storage_path into path from public.professional_photos where professional_id=p_id for update;
 if path is distinct from p_expected_avatar_path then raise exception 'Profile photo changed. Refresh before reviewing';end if;
 select full_name into account_name from public.profiles where id=p_id;
 if p_status='approved' and (path is null or not private.valid_identity_name(account_name)) then raise exception 'A valid real name and individual profile photo are required';end if;
 perform private.review_professional(p_id,p_status,p_note,p_expected_reviewed_at);
end;$$;
revoke all on function public.review_professional(uuid,text,text,timestamptz,text) from public,anon;
grant execute on function public.review_professional(uuid,text,text,timestamptz,text) to authenticated;
notify pgrst,'reload schema';
-- Enforce the registered-base requirement when going online, including direct API calls.
create function private.require_registered_base_online() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.available_now and not old.available_now and not exists(select 1 from public.professional_home_locations where professional_id=new.id) then raise exception 'Complete your registered home address in professional details before going online';end if;
 return new;
end;$$;
revoke all on function private.require_registered_base_online() from public,anon,authenticated;
create trigger require_registered_base_online before update of available_now on public.professionals for each row execute function private.require_registered_base_online();
-- Later service edits cannot add photo/video work without its relevant software.
create function private.require_service_software() returns trigger language plpgsql security definer set search_path='' as $$
declare craft public.talent_category;specs jsonb;
begin
 if not new.active then return new;end if;
 select category,public_specs into craft,specs from public.professionals where id=new.professional_id;
 if craft='Editor' then
  if new.service_key='photo-editing' then perform private.require_software(specs,'photo-software',array['Adobe Lightroom','Capture One','Adobe Photoshop']);
  else perform private.require_software(specs,'video-software',array['Final Cut Pro (FCP)','DaVinci Resolve','Adobe After Effects','Adobe Premiere Pro']);end if;
 end if;
 return new;
end;$$;
revoke all on function private.require_service_software() from public,anon,authenticated;
create trigger require_service_software before insert or update of name,service_key,active on public.services for each row execute function private.require_service_software();
-- Existing explicitly reviewed photos retain their reviewed state.
update public.professional_photos p set review_status=r.status from private.professional_reviews r where r.professional_id=p.professional_id;

alter function public.admin_professional_profile(uuid) set schema private;
revoke all on function private.admin_professional_profile(uuid) from public,anon,authenticated;
create function public.admin_professional_profile(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare details jsonb;
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 details:=private.admin_professional_profile(p_id);
 return details||jsonb_build_object('home_address',(select address from public.professional_home_locations where professional_id=p_id),'photo_review_status',(select review_status from public.professional_photos where professional_id=p_id));
end;$$;
revoke all on function public.admin_professional_profile(uuid) from public,anon;
grant execute on function public.admin_professional_profile(uuid) to authenticated;
notify pgrst,'reload schema';
-- New and post-session-guard administrative routines must also reject replaced JWTs.
do $session_guards$
declare item record;
begin
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.prokind='f' and p.prosrc like '%auth.uid()%'
 and p.proname not in ('current_user_id','activate_app_session','app_session_is_current','release_app_session','app_session_allowed','is_banner_admin','validate_home_banner') loop
  execute replace(pg_get_functiondef(item.oid),'auth.uid()','private.current_user_id()');
 end loop;
end;$session_guards$;
notify pgrst,'reload schema';
