-- Recheck ownership/consent after claiming, before contacting the push provider.
-- Devices can sign out, switch accounts or mute alerts while a batch is in flight.
create function public.notification_delivery_current(p_id uuid,p_attempt integer) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from private.notification_deliveries j
  join private.notification_devices d on d.id=j.device_id
  join public.app_notifications n on n.id=j.notification_id
  join private.notification_preferences p on p.user_id=d.user_id and p.app_variant=d.app_variant
  left join public.bookings b on b.id=n.booking_id
  where j.id=p_id and j.attempts=p_attempt and j.state='sending' and j.lease_until>now()
  and n.user_id=d.user_id and n.app_variant=d.app_variant and n.read_at is null
  and n.created_at>now()-interval '1 day' and p.push_enabled
  and (n.kind<>'message' or p.messages_enabled) and (n.kind not like 'event%' or p.events_enabled)
  and (n.dedupe_key not like 'request:%' or b.status='requested')
  and (n.dedupe_key not like 'status:%' or n.dedupe_key='status:'||b.id||':'||b.status)
  and (n.kind<>'reminder' or (b.status='accepted' and b.starts_at>now()))
  and (n.kind<>'service' or b.service_ended_at is null)
 );
$$;
revoke all on function public.notification_delivery_current(uuid,integer) from public,anon,authenticated;
grant execute on function public.notification_delivery_current(uuid,integer) to service_role;
notify pgrst,'reload schema';
