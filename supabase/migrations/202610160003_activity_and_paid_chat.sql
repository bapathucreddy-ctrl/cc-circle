-- A single authoritative query prevents completed/reviewed reminders reappearing.
create function public.booking_activity() returns setof public.bookings
language sql stable security definer set search_path='' as $$
  select b.* from public.bookings b where b.client_id=auth.uid() and (
    b.status in ('requested','accepted','en_route','arrived') or
    (b.status='completed' and not exists(select 1 from public.booking_reviews r where r.booking_id=b.id))
  ) order by case b.status when 'en_route' then 0 when 'arrived' then 0 when 'accepted' then 1 when 'requested' then 2 else 3 end,
    case when b.status<>'completed' then b.starts_at end asc,
    case when b.status='completed' then b.created_at end desc,b.id limit 1;
$$;
revoke all on function public.booking_activity() from public,anon;
grant execute on function public.booking_activity() to authenticated;

create function private.booking_chat_open(p_booking_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.bookings b where b.id=p_booking_id and auth.uid() in (b.client_id,b.professional_id)
    and b.paid_at is not null and b.status in ('accepted','en_route','arrived') and b.service_ended_at is null);
$$;
revoke all on function private.booking_chat_open(uuid) from public,anon;
grant execute on function private.booking_chat_open(uuid) to authenticated;
drop policy view_messages on public.messages;
drop policy send_messages on public.messages;
create policy view_messages on public.messages for select to authenticated using(private.booking_chat_open(booking_id));
create policy send_messages on public.messages for insert to authenticated
  with check(sender_id=auth.uid() and private.booking_chat_open(booking_id));

-- Serialize message inserts with service completion so concurrent sends cannot
-- recreate a conversation after completion's cleanup commits.
create function private.guard_booking_message() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.bookings where id=new.booking_id and auth.uid() in (client_id,professional_id)
    and paid_at is not null and status in ('accepted','en_route','arrived') and service_ended_at is null for share;
  if not found or new.sender_id<>auth.uid() then raise exception 'Messaging requires a paid, active booking' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function private.guard_booking_message() from public,anon,authenticated;
create trigger guard_booking_message before insert on public.messages for each row execute function private.guard_booking_message();

create function private.clear_closed_booking_chat() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('completed','cancelled','declined') or new.service_ended_at is not null then
    delete from public.messages where booking_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_closed_booking_chat() from public,anon,authenticated;
create trigger clear_closed_booking_chat after update of status,service_ended_at on public.bookings
  for each row execute function private.clear_closed_booking_chat();
-- Apply the same end-of-session policy to existing closed bookings.
delete from public.messages m using public.bookings b where b.id=m.booking_id
  and (b.status in ('completed','cancelled','declined') or b.service_ended_at is not null);
