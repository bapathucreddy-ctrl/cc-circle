-- Rename public catalog labels; stable keys preserve existing services and bookings.
grant update(label) on public.service_types to authenticated;
create policy service_name_admin_update on public.service_types for update to authenticated using(public.is_banner_admin()) with check(public.is_banner_admin());
alter table public.service_types add constraint service_label_length check(length(trim(label)) between 2 and 80);
create unique index service_type_label_unique on public.service_types(category,lower(trim(label)));
grant select(key,label) on public.service_types to anon;
create policy public_service_names on public.service_types for select to anon,authenticated using(true);
notify pgrst,'reload schema';
