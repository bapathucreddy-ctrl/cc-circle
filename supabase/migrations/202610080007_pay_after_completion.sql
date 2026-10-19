-- The client pays after completion; starting a journey no longer needs payment.
create or replace function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status=p_status then return b; end if;
  if p_status='cancelled' then
    if b.status not in ('requested','accepted') then raise exception 'This booking cannot be cancelled'; end if;
  elsif b.professional_id<>auth.uid() then raise exception 'Only the professional can update this status';
  elsif not ((b.status='requested' and p_status in ('accepted','declined')) or
    (b.status='accepted' and p_status='en_route') or
    (b.status='en_route' and p_status='arrived') or
    (b.status='arrived' and p_status='completed')) then raise exception 'Invalid booking transition'; end if;
  if p_status='accepted' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then raise exception 'This time has been marked unavailable'; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  -- Preserve refund handling for payment orders created before this change.
  if p_status='cancelled' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status='refund_requested' where booking_id=b.id;
  end if;
  if p_status in ('completed','cancelled','declined') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;

-- Queue exactly once whether verified payment or completion happens last.
create or replace function private.queue_payout() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='completed' and new.paid_at is not null
    and (old.status<>'completed' or old.paid_at is null) then
    insert into public.payout_jobs(booking_id,professional_id,amount_paise,transfer_id)
    values(new.id,new.professional_id,new.talent_payout_paise,'CC'||replace(new.id::text,'-','')) on conflict do nothing;
  end if;
  return new;
end;
$$;
