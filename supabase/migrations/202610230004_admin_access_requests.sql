create table private.admin_access_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 requested_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references auth.users(id) on delete set null
);
alter table private.admin_access_requests enable row level security;
revoke all on private.admin_access_requests from public,anon,authenticated;
grant all on private.admin_access_requests to service_role;
create function public.is_admin_access_owner() returns boolean language sql stable security definer set search_path='' as $$
 select public.is_banner_admin() and exists(select 1 from auth.users u where u.id=private.current_user_id() and lower(to_jsonb(u)->>'email')='chetan.reddy@cclabs.space' and to_jsonb(u)->>'email_confirmed_at' is not null);
$$;
create function public.request_admin_access() returns text language plpgsql security definer set search_path='' as $$
declare who uuid:=private.current_user_id();mail text;confirmed text;state text;
begin
 select lower(to_jsonb(u)->>'email'),to_jsonb(u)->>'email_confirmed_at' into mail,confirmed from auth.users u where id=who;
 if who is null or mail is null or confirmed is null then raise exception 'Sign in with a verified email first';end if;
 if public.is_banner_admin() then return 'approved';end if;
 insert into private.admin_access_requests(user_id,email) values(who,mail) on conflict(user_id) do nothing;
 select status into state from private.admin_access_requests where user_id=who;
 return state;
end;$$;
create function public.admin_access_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin_access_owner() then raise exception 'Only the Circle owner can review admin access' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.requested_at desc) from private.admin_access_requests r),'[]'::jsonb);
end;$$;
create function public.review_admin_access(p_user_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare r private.admin_access_requests;mail text;confirmed text;
begin
 if not public.is_admin_access_owner() then raise exception 'Only the Circle owner can approve admin access' using errcode='42501';end if;
 if p_approve is null then raise exception 'Choose approve or reject';end if;
 select * into r from private.admin_access_requests where user_id=p_user_id for update;
 if not found or r.status<>'pending' then raise exception 'This request is no longer pending. Refresh the list.';end if;
 select lower(to_jsonb(u)->>'email'),to_jsonb(u)->>'email_confirmed_at' into mail,confirmed from auth.users u where id=p_user_id;
 if mail is distinct from r.email or confirmed is null then raise exception 'The account email has changed or is not verified';end if;
 if p_approve then insert into private.banner_admins(email) values(mail) on conflict(email) do nothing;end if;
 update private.admin_access_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewed_at=clock_timestamp(),reviewed_by=private.current_user_id() where user_id=p_user_id;
end;$$;
revoke all on function public.is_admin_access_owner(),public.request_admin_access(),public.admin_access_requests(),public.review_admin_access(uuid,boolean) from public,anon;
grant execute on function public.is_admin_access_owner(),public.request_admin_access(),public.admin_access_requests(),public.review_admin_access(uuid,boolean) to authenticated;

create or replace function public.admin_list_professionals(p_offset integer default 0,p_status text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_status is null or p_status not in ('all','pending','approved','rejected') then raise exception 'Invalid filter';end if;
 return jsonb_build_object('total',(select count(*) from public.profiles a left join public.professionals p on p.id=a.id left join private.professional_reviews r on r.professional_id=a.id where (p.id is not null or a.professional_display_name is not null) and (p_status='all' or coalesce(r.status,'pending')=p_status)),
 'profiles',coalesce((select jsonb_agg(to_jsonb(t)) from (
 select a.id,coalesce(p.display_name,a.professional_display_name) as display_name,a.full_name as original_name,p.category,p.city,a.created_at,coalesce(p.is_published,false) as is_published,coalesce(r.status,'pending') as review_status,r.reviewed_at,
 (select storage_path from public.professional_photos where professional_id=a.id) as avatar_path,
 (select min(amount_paise) from public.services where professional_id=a.id and active) as starting_price
 from public.profiles a left join public.professionals p on p.id=a.id left join private.professional_reviews r on r.professional_id=a.id
 where (p.id is not null or a.professional_display_name is not null) and (p_status='all' or coalesce(r.status,'pending')=p_status)
 order by a.created_at desc,a.id limit 50 offset p_offset
 ) t),'[]'::jsonb));
end;$$;

-- Expose connected-account status only, never Instagram identifiers or credentials.
create or replace function public.admin_professional_profile(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select jsonb_build_object('id',p.id,'original_name',(select full_name from public.profiles where id=p.id),'display_name',p.display_name,'category',p.category,'city',p.city,'bio',p.bio,'specialties',p.specialties,'public_specs',p.public_specs,'is_published',p.is_published,'available_now',p.available_now,'verified_at',p.verified_at,
 'review_status',coalesce(r.status,'pending'),'reviewed_at',r.reviewed_at,'note',coalesce(r.note,''),
 'instagram_connected',exists(select 1 from public.portfolio_connections c where c.professional_id=p.id and c.provider='instagram' and c.expires_at>now()),
 'avatar_path',(select storage_path from public.professional_photos where professional_id=p.id),
 'services',coalesce((select jsonb_agg(jsonb_build_object('name',s.name,'description',s.description,'amount_paise',s.amount_paise,'active',s.active) order by s.name) from public.services s where s.professional_id=p.id),'[]'::jsonb),
 'media',coalesce((select jsonb_agg(to_jsonb(m)) from (select id,kind,storage_path,position from public.portfolio_media where professional_id=p.id and provider='upload' and kind='image' order by position,updated_at desc limit 10) m),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(v)) from (select rating,comment,created_at from public.booking_reviews where professional_id=p.id order by created_at desc limit 20) v),'[]'::jsonb)) into result
 from public.professionals p left join private.professional_reviews r on r.professional_id=p.id where p.id=p_id;
 if result is null then
  select jsonb_build_object('id',id,'display_name',professional_display_name,'original_name',full_name,'category','Profile incomplete','city','','bio','This professional has signed up but has not completed their professional details.','specialties','[]'::jsonb,'public_specs','{}'::jsonb,'review_status','pending','reviewed_at',null,'note','','incomplete',true,'services','[]'::jsonb,'media','[]'::jsonb,'reviews','[]'::jsonb)
  into result from public.profiles where id=p_id and professional_display_name is not null;
 end if;
 if result is null then raise exception 'Professional not found'; end if;
 return result;
end;$$;

