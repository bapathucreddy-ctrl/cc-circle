-- The existing explicitly allowlisted Circle admins also review professional profiles.
create table private.professional_reviews (
 professional_id uuid primary key references public.professionals(id) on delete cascade,
 status text not null check(status in ('approved','rejected')),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz not null default now(),
 note text not null default '' check(length(note)<=1000)
);
create table private.professional_review_history (
 id bigint generated always as identity primary key,
 professional_id uuid not null references public.professionals(id) on delete cascade,
 status text not null check(status in ('approved','rejected')),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz not null default now(),
 note text not null default '' check(length(note)<=1000)
);
alter table private.professional_reviews enable row level security;
alter table private.professional_review_history enable row level security;
revoke all on private.professional_reviews,private.professional_review_history from public,anon,authenticated;
grant all on private.professional_reviews,private.professional_review_history to service_role;
-- Preserve legacy timestamps; the badge checks the explicit admin decision below.
create function public.professional_approval_status(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.professional_reviews where professional_id=p_id and status='approved');
$$;
revoke all on function public.professional_approval_status(uuid) from public,anon,authenticated;
grant execute on function public.professional_approval_status(uuid) to service_role;

create function public.admin_list_professionals(p_offset integer default 0,p_status text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_status is null or p_status not in ('all','pending','approved','rejected') then raise exception 'Invalid filter'; end if;
 return jsonb_build_object('total',(select count(*) from public.profiles a left join public.professionals p on p.id=a.id left join private.professional_reviews r on r.professional_id=a.id where (p.id is not null or a.professional_display_name is not null) and (p_status='all' or coalesce(r.status,'pending')=p_status)),
 'profiles',coalesce((select jsonb_agg(to_jsonb(t)) from (
 select a.id,coalesce(p.display_name,a.professional_display_name) as display_name,p.category,p.city,a.created_at,coalesce(p.is_published,false) as is_published,coalesce(r.status,'pending') as review_status,r.reviewed_at
 from public.profiles a left join public.professionals p on p.id=a.id left join private.professional_reviews r on r.professional_id=a.id
 where (p.id is not null or a.professional_display_name is not null) and (p_status='all' or coalesce(r.status,'pending')=p_status)
 order by a.created_at desc,a.id limit 50 offset p_offset
 ) t),'[]'::jsonb));
end;$$;

create function public.admin_professional_profile(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select jsonb_build_object('id',p.id,'display_name',p.display_name,'category',p.category,'city',p.city,'bio',p.bio,'specialties',p.specialties,'public_specs',p.public_specs,'is_published',p.is_published,'available_now',p.available_now,'verified_at',p.verified_at,
 'review_status',coalesce(r.status,'pending'),'reviewed_at',r.reviewed_at,'note',coalesce(r.note,''),
 'avatar_path',(select storage_path from public.professional_photos where professional_id=p.id),
 'services',coalesce((select jsonb_agg(jsonb_build_object('name',s.name,'description',s.description,'amount_paise',s.amount_paise,'active',s.active) order by s.name) from public.services s where s.professional_id=p.id),'[]'::jsonb),
 'media',coalesce((select jsonb_agg(to_jsonb(m)) from (select id,kind,storage_path,position from public.portfolio_media where professional_id=p.id and provider='upload' and kind='image' order by position,updated_at desc limit 10) m),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(v)) from (select rating,comment,created_at from public.booking_reviews where professional_id=p.id order by created_at desc limit 20) v),'[]'::jsonb)) into result
 from public.professionals p left join private.professional_reviews r on r.professional_id=p.id where p.id=p_id;
 if result is null then
  select jsonb_build_object('id',id,'display_name',professional_display_name,'category','Profile incomplete','city','','bio','This professional has signed up but has not completed their professional details.','specialties','[]'::jsonb,'public_specs','{}'::jsonb,'review_status','pending','reviewed_at',null,'note','','incomplete',true,'services','[]'::jsonb,'media','[]'::jsonb,'reviews','[]'::jsonb)
  into result from public.profiles where id=p_id and professional_display_name is not null;
 end if;
 if result is null then raise exception 'Professional not found'; end if;
 return result;
end;$$;

create function public.review_professional(p_id uuid,p_status text,p_note text default '',p_expected_reviewed_at timestamptz default null)
returns void language plpgsql security definer set search_path='' as $$
declare previous timestamptz; stamp timestamptz:=clock_timestamp();
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_status is null or p_status not in ('approved','rejected') or p_note is null or length(p_note)>1000 then raise exception 'Invalid review'; end if;
 perform 1 from public.professionals where id=p_id for update;
 if not found then raise exception 'Professional not found'; end if;
 select reviewed_at into previous from private.professional_reviews where professional_id=p_id;
 if previous is distinct from p_expected_reviewed_at then raise exception 'This profile was reviewed by another admin. Refresh and try again.'; end if;
 insert into private.professional_reviews(professional_id,status,reviewed_by,reviewed_at,note) values(p_id,p_status,auth.uid(),stamp,trim(p_note))
 on conflict(professional_id) do update set status=excluded.status,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,note=excluded.note;
 insert into private.professional_review_history(professional_id,status,reviewed_by,reviewed_at,note) values(p_id,p_status,auth.uid(),stamp,trim(p_note));
 update public.professionals set verified_at=case when p_status='approved' then stamp else null end where id=p_id;
end;$$;
revoke all on function public.admin_list_professionals(integer,text),public.admin_professional_profile(uuid),public.review_professional(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.admin_list_professionals(integer,text),public.admin_professional_profile(uuid),public.review_professional(uuid,text,text,timestamptz) to authenticated;
-- Private photos are still private; only allowlisted admins can sign review URLs.
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='bucket_id') then
  create policy admin_review_portfolio on storage.objects for select to authenticated
   using(bucket_id='portfolio-work' and public.is_banner_admin());
 end if;
end $$;
notify pgrst,'reload schema';
