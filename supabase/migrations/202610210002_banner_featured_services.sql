-- Curated service cards can span multiple professions for a single campaign.
alter table public.home_campaigns add column featured_service_keys text[]
 check(featured_service_keys is null or cardinality(featured_service_keys)<=8);
create function private.validate_campaign_picks() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.featured_service_keys is not null and (
  array_position(new.featured_service_keys,null) is not null or
  cardinality(new.featured_service_keys)<>(select count(distinct key) from unnest(new.featured_service_keys) as picked(key)) or
  exists(select 1 from unnest(new.featured_service_keys) as picked(key) where not exists(select 1 from public.service_types s where s.key=picked.key))
 ) then raise exception 'Choose up to eight distinct available services for Festive picks';end if;
 return new;
end;$$;
revoke all on function private.validate_campaign_picks() from public,anon,authenticated;
create trigger validate_campaign_picks before insert or update on public.home_campaigns
 for each row execute function private.validate_campaign_picks();
notify pgrst,'reload schema';
