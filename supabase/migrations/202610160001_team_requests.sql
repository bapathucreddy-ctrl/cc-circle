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
