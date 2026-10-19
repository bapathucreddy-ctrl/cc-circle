-- The owner requested removal of the earlier, incompatible prototype objects.
-- Fresh projects skip this cleanup. Refuse to remove a different/new app schema.
do $$
declare item record;
begin
  if exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='services' and column_name='owner_id') then
    if exists(select 1 from public.profiles) or exists(select 1 from public.services)
      or exists(select 1 from public.bookings) or exists(select 1 from public.messages)
      or exists(select 1 from public.saved_services) or exists(select 1 from public.booking_events) then
      raise exception 'The prototype now contains records. Review those records before replacing it.';
    end if;
    for item in select p.oid::regprocedure::text as signature from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('session_active','account_verified','update_profile',
        'account_role','complete_account','booking_member','request_booking','change_booking')
      and p.prokind='f'
    loop
      if to_regprocedure(item.signature::text) is not null then
        execute format('drop function %s cascade',item.signature);
      end if;
    end loop;
    drop view if exists public.booking_details;
    drop table public.booking_events,public.saved_services,public.messages,
      public.bookings,public.services,public.profiles cascade;
  elsif to_regclass('public.services') is not null then
    raise exception 'A different or newer services schema already exists. Do not replace it with this initial deployment.';
  end if;
end;
$$;
