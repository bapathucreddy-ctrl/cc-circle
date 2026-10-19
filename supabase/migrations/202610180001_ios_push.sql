-- Existing Android clients continue using the unchanged three-argument RPC.
alter table private.notification_devices add column provider text not null default 'fcm' check(provider in ('fcm','apns'));
alter table private.notification_devices add column apns_environment text;
alter table private.notification_devices add constraint notification_device_environment check((provider='fcm' and apns_environment is null) or (provider='apns' and apns_environment in ('sandbox','production') and apns_environment is not null));
create function public.register_ios_notification_device(p_variant text,p_installation_id uuid,p_token text,p_environment text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_environment is null or p_environment not in ('sandbox','production') or p_token is null or length(p_token) not between 32 and 512 or p_token !~ '^[a-fA-F0-9]+$' or length(p_token)%2<>0 then raise exception 'Invalid Apple notification device'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 -- A changed APNs environment invalidates queued/claimed snapshots for this install.
 delete from private.notification_devices where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id and (provider<>'apns' or apns_environment is distinct from p_environment);
 perform public.register_notification_device(p_variant,p_installation_id,lower(p_token));
 update private.notification_devices set provider='apns',apns_environment=p_environment where user_id=auth.uid() and app_variant=p_variant and installation_id=p_installation_id;
end; $$;
revoke all on function public.register_ios_notification_device(text,uuid,text,text) from public,anon;
grant execute on function public.register_ios_notification_device(text,uuid,text,text) to authenticated;
create function public.claim_notification_deliveries_for_providers(p_providers text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 delete from public.app_notifications where created_at<now()-interval '30 days';
 update private.notification_deliveries j set state='failed'
 where j.state in ('pending','sending') and (j.attempts>=5 or not exists(
  select 1 from public.app_notifications n join private.notification_devices d on d.id=j.device_id
  left join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
  where n.id=j.notification_id and n.user_id=d.user_id and n.app_variant=d.app_variant
  and n.created_at>now()-interval '1 day' and n.read_at is null and coalesce(p.push_enabled,false)
  and (n.kind<>'message' or coalesce(p.messages_enabled,true)) and (n.kind not like 'event%' or coalesce(p.events_enabled,true))));
 with picked as (
  select j.id from private.notification_deliveries j join private.notification_devices d on d.id=j.device_id where d.provider=any(p_providers) and ((j.state='pending' and j.next_attempt_at<=now()) or (j.state='sending' and j.lease_until<now()))
  order by j.next_attempt_at for update of j skip locked limit 50
 ), claimed as (
  update private.notification_deliveries j set state='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes'
  from picked where j.id=picked.id returning j.*
 ) select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'attempt',j.attempts,'token',d.token,'notification_id',n.id,'variant',n.app_variant,'title',n.title,'provider',d.provider,'environment',d.apns_environment)),'[]'::jsonb)
 into result from claimed j join private.notification_devices d on d.id=j.device_id join public.app_notifications n on n.id=j.notification_id;
 return result;
end; $$;
revoke all on function public.claim_notification_deliveries_for_providers(text[]) from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries_for_providers(text[]) to service_role;
-- Legacy workers continue claiming Android devices only.
create or replace function public.claim_notification_deliveries() returns jsonb language sql security definer set search_path='' as $$select public.claim_notification_deliveries_for_providers(array['fcm'])$$;
notify pgrst,'reload schema';
