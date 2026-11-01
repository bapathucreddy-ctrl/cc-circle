-- Public marketing images only; private professional portfolios are unaffected.
create table public.service_artwork (
 service_key text primary key references public.service_types(key),
 image_path text not null unique check(image_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$'),
 image_width integer not null check(image_width between 320 and 2048),
 image_height integer not null check(image_height between 320 and 2048),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.service_artwork enable row level security;
revoke all on public.service_artwork from public,anon,authenticated;
grant select(service_key,image_path,image_width,image_height,updated_at) on public.service_artwork to anon,authenticated;
grant insert,update,delete on public.service_artwork to authenticated;
grant all on public.service_artwork to service_role;
create policy service_artwork_read on public.service_artwork for select to anon,authenticated using(true);
create policy service_artwork_insert on public.service_artwork for insert to authenticated with check(public.is_banner_admin());
create policy service_artwork_update on public.service_artwork for update to authenticated using(public.is_banner_admin()) with check(public.is_banner_admin());
create policy service_artwork_reset on public.service_artwork for delete to authenticated using(public.is_banner_admin());
create function private.validate_service_artwork() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from storage.objects where bucket_id='service-artwork' and name=new.image_path) then
  raise exception 'Upload the service photo before publishing';
 end if;
 if (tg_op='INSERT' or new.image_path is distinct from old.image_path) and split_part(new.image_path,'/',1) is distinct from auth.uid()::text then
  raise exception 'Choose your newly uploaded service photo';
 end if;
 new.updated_at:=clock_timestamp();new.updated_by:=auth.uid();return new;
end;$$;
revoke all on function private.validate_service_artwork() from public,anon,authenticated;
create trigger validate_service_artwork before insert or update on public.service_artwork for each row execute function private.validate_service_artwork();
do $storage$ begin
if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('service-artwork','service-artwork',true,5242880,array['image/jpeg']);
create policy service_artwork_upload on storage.objects for insert to authenticated with check(
 bucket_id='service-artwork' and public.is_banner_admin() and split_part(name,'/',1)=auth.uid()::text
 and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.jpg$');
create policy service_artwork_objects on storage.objects for select to authenticated using(bucket_id='service-artwork' and public.is_banner_admin());
create policy service_artwork_cleanup on storage.objects for delete to authenticated using(
 bucket_id='service-artwork' and public.is_banner_admin() and split_part(name,'/',1)=auth.uid()::text
 and not exists(select 1 from public.service_artwork a where a.image_path=name));
end if;
end $storage$;
notify pgrst,'reload schema';
