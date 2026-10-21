-- Run separately in SQL Editor after manual-deployment.sql succeeds.
-- Read-only: this verifies deployment; it does not apply or repair migrations.
begin read only;
do $verification$
declare
  expected_table text;
  expected_version text;
begin

  if to_regprocedure('public.claim_notification_deliveries()') is not null and (
    has_function_privilege('authenticated','public.claim_notification_deliveries()','EXECUTE') or
    has_function_privilege('authenticated','public.finish_notification_delivery(uuid,integer,text)','EXECUTE') or
    has_function_privilege('authenticated','public.notification_delivery_current(uuid,integer)','EXECUTE') or
    has_table_privilege('authenticated','private.notification_devices','SELECT')
  ) then raise exception 'Deployment incomplete: notification delivery access is exposed.'; end if;
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'Deployment incomplete: migration history is missing.';
  end if;
  foreach expected_version in array array[
    '202610080000','202610080001','202610080002','202610080003',
    '202610080004','202610080005','202610080006','202610080007','202610150001','202610150002','202610150003','202610150004','202610150005','202610150006','202610160001','202610160002','202610160003','202610160004','202610160005','202610160006','202610160007','202610160008','202610160009','202610160010','202610170001','202610170002','202610180001','202610180002','202610180003','202610180004','202610210001','202610210002'
  ] loop
    if not exists(select 1 from supabase_migrations.schema_migrations where version=expected_version) then
      raise exception 'Deployment incomplete: migration % is missing.', expected_version;
    end if;
  end loop;
  if to_regclass('private.banner_admins') is null or
    has_table_privilege('authenticated','private.banner_admins','SELECT') or
    has_function_privilege('authenticated','public.grant_banner_admin(text)','EXECUTE') or
    has_function_privilege('anon','public.is_banner_admin()','EXECUTE') then
    raise exception 'Deployment incomplete: banner-admin access protection is missing.';
  end if;
  if has_table_privilege('authenticated','private.professional_usernames','SELECT')
    or has_function_privilege('authenticated','private.professional_username(uuid)','EXECUTE')
    or has_function_privilege('anon','public.professional_review_page(uuid,integer,integer)','EXECUTE')
    or exists(select 1 from public.professionals p left join private.professional_usernames u on u.user_id=p.id where u.username is null or p.display_name<>u.username) then
    raise exception 'Deployment incomplete: public username or review privacy protection is missing.';
  end if;
  if to_regprocedure('public.activate_app_session(text)') is null
    or to_regprocedure('public.app_session_allowed(uuid,uuid)') is null then
    raise exception 'Deployment incomplete: per-app session controls are missing.';
  end if;
  if has_function_privilege('authenticated','public.app_session_allowed(uuid,uuid)','EXECUTE')
    or has_table_privilege('authenticated','private.active_app_sessions','SELECT')
    or has_table_privilege('authenticated','private.replaced_app_sessions','SELECT') then
    raise exception 'Deployment incomplete: session-control access is exposed.';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f' and p.prosrc like '%auth.uid()%'
    -- Banner admins use a separate verified-email session; the trigger only records its actor.
    and p.proname not in ('current_user_id','activate_app_session','app_session_is_current','release_app_session','app_session_allowed','is_banner_admin','validate_home_banner')) then
    raise exception 'Deployment incomplete: a user function bypasses session replacement checks.';
  end if;
  if to_regprocedure('public.register_ios_notification_device(text,uuid,text,text)') is null
    or to_regprocedure('public.claim_notification_deliveries_for_providers(text[])') is null then
    raise exception 'Deployment incomplete: iOS notification delivery is missing.';
  end if;
  if has_function_privilege('authenticated','public.claim_notification_deliveries_for_providers(text[])','EXECUTE') then
    raise exception 'Deployment incomplete: iOS notification delivery access is exposed.';
  end if;
  if not exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='talent_category' and e.enumlabel='ContentCreator') then
    raise exception 'Deployment incomplete: content creator category is missing.';
  end if;
  if has_function_privilege('authenticated','private.service_billable_hours(timestamptz,timestamptz)','EXECUTE')
    or has_function_privilege('anon','public.create_team_request(text,text,timestamptz,text,double precision,double precision,jsonb,uuid,text,integer)','EXECUTE')
    or not exists(select 1 from pg_trigger where tgrelid='public.payment_orders'::regclass and tgname='guard_hourly_payment_order' and not tgisinternal)
    or not exists(select 1 from pg_trigger where tgrelid='public.bookings'::regclass and tgname='guard_hourly_invoice' and not tgisinternal) then
    raise exception 'Deployment incomplete: hourly invoice protection is missing.';
  end if;
  if has_table_privilege('authenticated','private.professional_live_locations','SELECT')
    or has_function_privilege('anon','public.publish_professional_location(double precision,double precision)','EXECUTE')
    or not has_function_privilege('authenticated','public.discover_live_professionals(public.talent_category,double precision,double precision,text,double precision,boolean)','EXECUTE') then
    raise exception 'Deployment incomplete: live professional location protection is missing.';
  end if;
  if has_function_privilege('authenticated','private.transition_booking(uuid,public.booking_status)','EXECUTE')
    or has_table_privilege('authenticated','private.service_otps','SELECT') then
    raise exception 'Deployment incomplete: service verification internals are exposed.';
  end if;
  if not has_function_privilege('authenticated','public.service_otp(uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.service_action(uuid,text,text)','EXECUTE') then
    raise exception 'Deployment incomplete: service verification RPC access is missing.';
  end if;
  if has_table_privilege('authenticated','private.team_events','SELECT')
    or has_table_privilege('authenticated','private.team_roles','SELECT')
    or has_table_privilege('authenticated','private.team_applications','SELECT')
    or has_function_privilege('anon','public.accept_team_applicant(uuid,integer)','EXECUTE') then
    raise exception 'Deployment incomplete: team request internals are exposed.';
  end if;
  if has_column_privilege('authenticated','public.profiles','registration_completed_at','UPDATE')
    or has_column_privilege('authenticated','public.profiles','full_name','UPDATE')
    or has_function_privilege('anon','public.complete_registration(text,text,text,boolean)','EXECUTE') then
    raise exception 'Deployment incomplete: private registration updates are exposed.';
  end if;
  if not has_function_privilege('authenticated','public.booking_activity()','EXECUTE')
    or has_function_privilege('anon','public.booking_activity()','EXECUTE')
    or not exists(select 1 from pg_trigger where tgrelid='public.messages'::regclass and tgname='guard_booking_message' and not tgisinternal)
    or not exists(select 1 from pg_trigger where tgrelid='public.bookings'::regclass and tgname='clear_closed_booking_chat' and not tgisinternal) then
    raise exception 'Deployment incomplete: booking reminder or paid chat protection is missing.';
  end if;
  foreach expected_table in array array[
    'public.profiles','public.professionals','public.professional_private_details',
    'public.services','public.bookings','public.messages','public.booking_locations',
    'public.saved_professionals','public.project_briefs','public.availability_blocks',
    'public.payment_orders','public.refund_requests','public.professional_drafts',
    'public.payout_accounts','public.payout_jobs','private.payment_rate_limits',
    'public.booking_reviews','public.portfolio_media','public.portfolio_connections','public.portfolio_imports','private.service_otps',
    'private.team_events','private.team_roles','private.team_applications','public.app_notifications','private.notification_preferences','private.notification_devices','private.notification_deliveries'
  ] loop
    if not exists(select 1 from pg_class where oid=to_regclass(expected_table) and relkind='r' and relrowsecurity) then
      raise exception 'Deployment incomplete: table % is missing or row security is disabled.', expected_table;
    end if;
  end loop;
  if exists(select 1 from auth.users u where not exists(select 1 from public.profiles p where p.id=u.id)) then
    raise exception 'Deployment incomplete: an Auth user has no app profile.';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='services' and column_name='owner_id')
    or to_regclass('public.booking_details') is not null
    or to_regclass('public.saved_services') is not null
    or to_regclass('public.booking_events') is not null then
    raise exception 'Deployment incomplete: old prototype objects remain.';
  end if;
  if (select count(*) from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename in ('bookings','messages','booking_locations')) <> 3 then
    raise exception 'Deployment incomplete: booking realtime publication is missing tables.';
  end if;
end;
$verification$;
select 'Circle database verification complete' as result;
commit;
