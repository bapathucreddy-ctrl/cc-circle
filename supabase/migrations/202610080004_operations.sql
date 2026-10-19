create function public.record_refund_status(p_booking_id uuid,p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('processing','refunded','failed') then raise exception 'Invalid refund status'; end if;
  perform 1 from public.refund_requests where booking_id=p_booking_id for update;
  if not found then raise exception 'Refund request not found'; end if;
  if exists(select 1 from public.refund_requests where booking_id=p_booking_id and status='refunded') then return; end if;
  update public.refund_requests set status=p_status where booking_id=p_booking_id;
  if p_status='refunded' then update public.payment_orders set status='refunded' where booking_id=p_booking_id; end if;
end;
$$;
revoke all on function public.record_refund_status(uuid,text) from public,anon,authenticated;
grant execute on function public.record_refund_status(uuid,text) to service_role;

create table public.professional_drafts (
  professional_id uuid primary key references public.profiles on delete cascade,
  draft jsonb not null default '{}',
  check (jsonb_typeof(draft)='object' and octet_length(draft::text)<=131072)
);
alter table public.professional_drafts enable row level security;
create policy own_draft on public.professional_drafts for all to authenticated
  using(professional_id=auth.uid()) with check(professional_id=auth.uid());
revoke all on public.professional_drafts from anon,authenticated;
grant select,insert,update,delete on public.professional_drafts to authenticated;
grant all on public.professional_drafts to service_role;
