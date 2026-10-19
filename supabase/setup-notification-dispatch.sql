-- Hosted Supabase only, after the notification migration and Edge function deploy.
-- Configure Vault entries circle_notification_dispatch_url and
-- circle_notification_dispatch_secret first. Never commit their values.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table if not exists private.notification_dispatch_wakeup (
 singleton boolean primary key default true check(singleton),
 requested_at timestamptz not null default '-infinity'
);
alter table private.notification_dispatch_wakeup enable row level security;
revoke all on private.notification_dispatch_wakeup from public,anon,authenticated;
insert into private.notification_dispatch_wakeup(singleton) values(true) on conflict do nothing;

create or replace function private.wake_notification_dispatch() returns trigger
language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text;
begin
 -- Debounce the wakeup when an event fans out to matching professionals.
 update private.notification_dispatch_wakeup set requested_at=clock_timestamp()
 where singleton and requested_at<clock_timestamp()-interval '2 seconds';
 if not found then return new; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='circle_notification_dispatch_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='circle_notification_dispatch_secret';
 if endpoint is not null and secret is not null then
  perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-circle-dispatch',secret),body:='{}'::jsonb,timeout_milliseconds:=15000);
 end if;
 return new;
exception when others then
 -- Delivery failures must never block a booking/payment/message transaction.
 return new;
end; $$;
revoke all on function private.wake_notification_dispatch() from public,anon,authenticated;
drop trigger if exists circle_notification_wakeup on public.app_notifications;
create trigger circle_notification_wakeup after insert on public.app_notifications for each row execute function private.wake_notification_dispatch();

-- Recovery/retention and upcoming-job reminders, including when no new rows arrive.
do $$ declare old_job bigint; begin
 for old_job in select jobid from cron.job where jobname='circle-notification-dispatch' loop perform cron.unschedule(old_job); end loop;
end $$;
select cron.schedule('circle-notification-dispatch','* * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='circle_notification_dispatch_url'),
  headers:=jsonb_build_object('Content-Type','application/json','x-circle-dispatch',(select decrypted_secret from vault.decrypted_secrets where name='circle_notification_dispatch_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=15000
 );
$job$);
commit;
