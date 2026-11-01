-- Return only whether the current verified account has a password, never its hash.
create function public.my_password_setup_status() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare who uuid:=private.current_user_id(); result boolean;
begin
 if who is null then raise exception 'Sign in first' using errcode='42501';end if;
 select coalesce(nullif(to_jsonb(u)->>'encrypted_password',''),'')<>'' into result
 from auth.users u where u.id=who and to_jsonb(u)->>'email_confirmed_at' is not null;
 if result is null then raise exception 'Verify your email first' using errcode='42501';end if;
 return result;
end;$$;
revoke all on function public.my_password_setup_status() from public,anon;
grant execute on function public.my_password_setup_status() to authenticated;
