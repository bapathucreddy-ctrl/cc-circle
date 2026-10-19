-- Delete the owner's event post/applications while keeping every financial booking.
create function public.delete_team_request(p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to delete an event'; end if;
  -- All apply/accept operations lock this row too, serialising selection/deletion.
  perform 1 from private.team_events where id=p_event_id and client_id=auth.uid() for update;
  if not found then raise exception 'Your event was not found'; end if;
  -- Roles/applications cascade; public.bookings are referenced parents and remain.
  delete from private.team_events where id=p_event_id and client_id=auth.uid();
end;
$$;
revoke all on function public.delete_team_request(uuid) from public,anon;
grant execute on function public.delete_team_request(uuid) to authenticated;
notify pgrst, 'reload schema';
