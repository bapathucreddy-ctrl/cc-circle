-- Only disclose names for a booking that belongs to the caller. Private profiles
-- remain private; no phone numbers, email addresses or other profile rows leak.
create function public.booking_participants(p_booking_id uuid)
returns table(client_name text, professional_name text, category public.talent_category)
language sql stable security definer set search_path = '' as $$
  select nullif(trim(c.display_name),''), p.display_name, p.category
  from public.bookings b
  join public.profiles c on c.id=b.client_id
  join public.professionals p on p.id=b.professional_id
  where b.id=p_booking_id and auth.uid() in (b.client_id,b.professional_id);
$$;
revoke all on function public.booking_participants(uuid) from public,anon;
grant execute on function public.booking_participants(uuid) to authenticated;

-- Payment is collected after acceptance and before travel/service. Keep the
-- professional lock, lifecycle checks, cancellation refunds and location cleanup.
create or replace function public.transition_booking(p_booking_id uuid, p_status public.booking_status)
returns public.bookings language plpgsql security definer set search_path = '' as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id=p_booking_id and (client_id=auth.uid() or professional_id=auth.uid()) for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.status=p_status then return b; end if;
  perform 1 from public.professionals where id=b.professional_id for update;
  if p_status='en_route' and exists(select 1 from public.bookings other
    where other.professional_id=b.professional_id and other.id<>b.id
      and other.status in ('en_route','arrived')) then
    raise exception 'Finish your current active job before starting another journey';
  end if;
  if p_status='cancelled' then
    if b.status not in ('requested','accepted') then raise exception 'This booking cannot be cancelled'; end if;
  elsif b.professional_id<>auth.uid() then raise exception 'Only the professional can update this status';
  elsif not ((b.status='requested' and p_status in ('accepted','declined')) or
    (b.status='accepted' and p_status='en_route') or
    (b.status='en_route' and p_status='arrived') or
    (b.status='arrived' and p_status='completed')) then raise exception 'Invalid booking transition'; end if;
  if p_status in ('en_route','arrived','completed') and b.paid_at is null then
    raise exception 'Verified payment is required before the journey and service';
  end if;
  if p_status='accepted' and exists(select 1 from public.availability_blocks where professional_id=b.professional_id and tstzrange(starts_at,ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')) then raise exception 'This time has been marked unavailable'; end if;
  update public.bookings set status=p_status where id=b.id returning * into b;
  if p_status='cancelled' and b.paid_at is not null then
    insert into public.refund_requests(booking_id,order_id) select b.id,order_id from public.payment_orders where booking_id=b.id on conflict do nothing;
    update public.payment_orders set status='refund_requested' where booking_id=b.id;
  end if;
  if p_status in ('completed','cancelled','declined') then delete from public.booking_locations where booking_id=b.id; end if;
  return b;
end;
$$;
