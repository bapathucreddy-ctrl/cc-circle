-- Expose connected-account status only, never Instagram identifiers or credentials.
create or replace function public.admin_professional_profile(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_banner_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
 select jsonb_build_object('id',p.id,'display_name',p.display_name,'category',p.category,'city',p.city,'bio',p.bio,'specialties',p.specialties,'public_specs',p.public_specs,'is_published',p.is_published,'available_now',p.available_now,'verified_at',p.verified_at,
 'review_status',coalesce(r.status,'pending'),'reviewed_at',r.reviewed_at,'note',coalesce(r.note,''),
 'instagram_connected',exists(select 1 from public.portfolio_connections c where c.professional_id=p.id and c.provider='instagram' and c.expires_at>now()),
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

