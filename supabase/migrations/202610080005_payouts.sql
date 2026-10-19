create table public.payout_accounts (
  professional_id uuid primary key references public.professionals,
  beneficiary_id text not null unique,
  environment text not null check (environment in ('sandbox','production')),
  created_at timestamptz not null default now()
);
create table public.payout_jobs (
  booking_id uuid primary key references public.bookings,
  professional_id uuid not null references public.professionals,
  amount_paise integer not null check(amount_paise>0),
  transfer_id text not null unique,
  beneficiary_id text,
  status text not null default 'pending' check(status in ('pending','processing','paid','failed')),
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
alter table public.payout_jobs enable row level security;
create policy own_payout_account on public.payout_accounts for select to authenticated using(professional_id=auth.uid());
create policy own_payout_jobs on public.payout_jobs for select to authenticated using(professional_id=auth.uid());
revoke all on public.payout_accounts,public.payout_jobs from anon,authenticated;
grant select on public.payout_accounts,public.payout_jobs to authenticated;
grant all on public.payout_accounts,public.payout_jobs to service_role;

create function private.queue_payout() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='completed' and new.paid_at is not null and old.status<>'completed' then
    insert into public.payout_jobs(booking_id,professional_id,amount_paise,transfer_id)
    values(new.id,new.professional_id,new.talent_payout_paise,'CC'||replace(new.id::text,'-','')) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.queue_payout() from public,anon,authenticated;
create trigger queue_payout after update on public.bookings for each row execute function private.queue_payout();
