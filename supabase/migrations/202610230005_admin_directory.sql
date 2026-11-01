create function public.admin_user_directory(p_search text default '',p_kind text default 'all',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 if p_search is null or length(p_search)>120 or p_kind is null or p_kind not in ('all','customers','talent') or p_offset is null or p_offset<0 then raise exception 'Invalid user filter';end if;
 with directory as (
  select a.id,coalesce(nullif(a.full_name,''),nullif(a.display_name,''),'Circle user') as name,
   coalesce(to_jsonb(u)->>'email',a.contact_email,'') as email,a.created_at,
   (a.professional_display_name is not null or p.id is not null) as talent,
   coalesce(p.display_name,a.professional_display_name,'') as username,
   (select storage_path from public.professional_photos where professional_id=a.id) as avatar_path
  from public.profiles a join auth.users u on u.id=a.id left join public.professionals p on p.id=a.id
 ), filtered as (
  select * from directory where (p_kind='all' or (p_kind='talent' and talent) or (p_kind='customers' and not talent))
   and (name ilike '%'||trim(p_search)||'%' or email ilike '%'||trim(p_search)||'%' or username ilike '%'||trim(p_search)||'%')
 ) select jsonb_build_object('total',(select count(*) from filtered),'users',coalesce((select jsonb_agg(to_jsonb(t)) from (select * from filtered order by created_at desc,id limit 50 offset p_offset)t),'[]'::jsonb)) into result;
 return result;
end;$$;
create function public.admin_current_admins() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin_access_owner() then raise exception 'Only the Circle owner can view admin access' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('email',b.email,'name',coalesce(nullif(a.full_name,''),b.email),'owner',b.email='chetan.reddy@cclabs.space','created_at',b.created_at) order by b.created_at) from private.banner_admins b left join auth.users u on lower(to_jsonb(u)->>'email')=b.email left join public.profiles a on a.id=u.id),'[]'::jsonb);
end;$$;
revoke all on function public.admin_user_directory(text,text,integer),public.admin_current_admins() from public,anon;
grant execute on function public.admin_user_directory(text,text,integer),public.admin_current_admins() to authenticated;

create function public.admin_talent_directory(p_search text default '',p_status text default 'all',p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501';end if;
 if p_search is null or length(p_search)>120 or p_status is null or p_status not in ('all','pending','approved','rejected') or p_offset is null or p_offset<0 then raise exception 'Invalid talent filter';end if;
 with talent as (
  select a.id,coalesce(p.display_name,a.professional_display_name) as display_name,a.full_name as original_name,p.category,p.city,a.created_at,coalesce(p.is_published,false) as is_published,coalesce(r.status,'pending') as review_status,r.reviewed_at,
   (select storage_path from public.professional_photos where professional_id=a.id) as avatar_path,
   (select min(amount_paise) from public.services where professional_id=a.id and active) as starting_price
  from public.profiles a left join public.professionals p on p.id=a.id left join private.professional_reviews r on r.professional_id=a.id
  where (p.id is not null or a.professional_display_name is not null) and (a.full_name ilike '%'||trim(p_search)||'%' or coalesce(p.display_name,a.professional_display_name) ilike '%'||trim(p_search)||'%' or p.city ilike '%'||trim(p_search)||'%')
 ), filtered as (select * from talent where p_status='all' or review_status=p_status)
 select jsonb_build_object('total',(select count(*) from filtered),'approved',(select count(*) from talent where review_status='approved'),'pending',(select count(*) from talent where review_status='pending'),
 'profiles',coalesce((select jsonb_agg(to_jsonb(t)) from (select * from filtered order by created_at desc,id limit 50 offset p_offset)t),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.admin_talent_directory(text,text,integer) from public,anon;
grant execute on function public.admin_talent_directory(text,text,integer) to authenticated;
