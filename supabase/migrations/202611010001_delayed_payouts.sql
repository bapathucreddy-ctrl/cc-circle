-- New payouts mature 24 hours after BOTH verified payment and completion.
alter table public.payout_jobs add column available_at timestamptz;
update public.payout_jobs j set available_at=case
 when j.status='pending' and j.beneficiary_id is null then
 greatest(j.created_at,b.paid_at,b.service_ended_at)+interval '24 hours'
 else j.created_at end from public.bookings b where b.id=j.booking_id;
alter table public.payout_jobs alter column available_at set default (now()+interval '24 hours');
alter table public.payout_jobs alter column available_at set not null;
update public.payout_jobs set next_attempt_at=greatest(next_attempt_at,available_at)
 where status='pending' and beneficiary_id is null;
create index payout_jobs_due on public.payout_jobs(next_attempt_at,available_at) where status in ('pending','processing');

create or replace function private.queue_payout() returns trigger language plpgsql security definer set search_path='' as $$
declare due timestamptz;
begin
 if new.status='completed' and new.paid_at is not null
 and (old.status<>'completed' or old.paid_at is null) then
  due:=greatest(now(),new.paid_at,new.service_ended_at)+interval '24 hours';
  insert into public.payout_jobs(booking_id,professional_id,amount_paise,transfer_id,available_at,next_attempt_at)
  values(new.id,new.professional_id,new.talent_payout_paise,'CC'||replace(new.id::text,'-',''),due,due) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.queue_payout() from public,anon,authenticated;

-- Only masked details are stored. Full bank credentials remain with Cashfree.
alter table public.payout_accounts add column account_last4 text check(account_last4 ~ '^[0-9]{4}$'),
 add column bank_ifsc text check(bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
 add column updated_at timestamptz not null default now();

create function public.save_payout_beneficiary(p_professional_id uuid,p_expected_id text,p_beneficiary_id text,p_environment text,p_last4 text,p_ifsc text)
returns void language plpgsql security definer set search_path='' as $$
declare current_id text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text,31));
 select beneficiary_id into current_id from public.payout_accounts where professional_id=p_professional_id for update;
 if current_id is distinct from p_expected_id then raise exception 'Bank account changed. Refresh before trying again.';end if;
 insert into public.payout_accounts(professional_id,beneficiary_id,environment,account_last4,bank_ifsc)
 values(p_professional_id,p_beneficiary_id,p_environment,p_last4,p_ifsc)
 on conflict(professional_id) do update set beneficiary_id=excluded.beneficiary_id,environment=excluded.environment,
 account_last4=excluded.account_last4,bank_ifsc=excluded.bank_ifsc,updated_at=now();
end $$;
revoke all on function public.save_payout_beneficiary(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.save_payout_beneficiary(uuid,text,text,text,text,text) to service_role;

-- pg_cron calls this server-only dispatcher; credentials stay in encrypted Vault.
create function private.dispatch_cashfree_payouts() returns void language plpgsql security definer set search_path='' as $$
declare worker_secret text;
begin
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='artist_house_payout_worker_secret';
 if worker_secret is null or length(worker_secret)<32 then raise exception 'Payout worker authentication is not configured';end if;
 perform net.http_post(url:='https://jssxdolqlnharkxatvqe.supabase.co/functions/v1/cashfree-payouts',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||worker_secret),body:='{}'::jsonb);
end $$;
revoke all on function private.dispatch_cashfree_payouts() from public,anon,authenticated;
