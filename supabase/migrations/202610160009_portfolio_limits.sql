-- Portfolio browsing/uploads must not consume the stricter payment counter.
create table private.portfolio_rate_limits (
  user_id uuid primary key references auth.users on delete cascade,
  window_start timestamptz not null,
  attempts integer not null
);
alter table private.portfolio_rate_limits enable row level security;
revoke all on private.portfolio_rate_limits from public,anon,authenticated;

create function public.claim_portfolio_operation(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare attempts integer;
begin
  insert into private.portfolio_rate_limits values(p_user_id,now(),1)
  on conflict(user_id) do update set
    attempts=case when portfolio_rate_limits.window_start < now()-interval '1 minute' then 1 else portfolio_rate_limits.attempts+1 end,
    window_start=case when portfolio_rate_limits.window_start < now()-interval '1 minute' then now() else portfolio_rate_limits.window_start end
  returning portfolio_rate_limits.attempts into attempts;
  return attempts <= 60;
end;
$$;
revoke all on function public.claim_portfolio_operation(uuid) from public,anon,authenticated;
grant execute on function public.claim_portfolio_operation(uuid) to service_role;
notify pgrst, 'reload schema';
