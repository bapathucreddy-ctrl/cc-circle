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
