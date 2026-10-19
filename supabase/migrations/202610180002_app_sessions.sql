create table private.active_app_sessions (
 user_id uuid not null references public.profiles on delete cascade,
 app_variant text not null check(app_variant in ('customer','professional')),
 session_id uuid not null,
 session_created_at timestamptz not null,
 primary key(user_id,app_variant)
);
create table private.replaced_app_sessions (
 session_id uuid primary key,
 user_id uuid not null references public.profiles on delete cascade,
 replaced_at timestamptz not null default now()
);
alter table private.active_app_sessions enable row level security;
alter table private.replaced_app_sessions enable row level security;
revoke all on private.active_app_sessions,private.replaced_app_sessions from public,anon,authenticated;

create function private.request_session_id() returns uuid language sql stable set search_path='' as $$
 select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id','')::uuid;
$$;
create function private.current_user_id() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if exists(select 1 from private.replaced_app_sessions where session_id=private.request_session_id() and user_id=auth.uid()) then
  raise exception using errcode='28000',message='This session was replaced. Sign in again.';
 end if;
 return auth.uid();
end; $$;
revoke all on function private.request_session_id(),private.current_user_id() from public;
grant execute on function private.current_user_id() to anon,authenticated;

create function public.activate_app_session(p_variant text) returns boolean language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); sid uuid:=private.request_session_id(); created timestamptz; previous private.active_app_sessions;
begin
 if who is null or sid is null or p_variant is null or p_variant not in ('customer','professional') then raise exception 'Sign in again to secure this device';end if;
 select created_at into created from auth.sessions where id=sid and user_id=who;
 if created is null then return false;end if;
 perform 1 from public.profiles where id=who for update;
 if exists(select 1 from private.replaced_app_sessions where session_id=sid and user_id=who) then return false;end if;
 select * into previous from private.active_app_sessions where user_id=who and app_variant=p_variant;
 if previous.session_id=sid then return true;end if;
 -- An older restored session cannot take the account back from a newer login.
 if previous.session_id is not null and (previous.session_created_at>created or (previous.session_created_at=created and previous.session_id>sid)) then
  insert into private.replaced_app_sessions(session_id,user_id) values(sid,who) on conflict do nothing;
  return false;
 end if;
 if previous.session_id is not null then
  insert into private.replaced_app_sessions(session_id,user_id) values(previous.session_id,who) on conflict do nothing;
 end if;
 insert into private.active_app_sessions(user_id,app_variant,session_id,session_created_at) values(who,p_variant,sid,created)
 on conflict(user_id,app_variant) do update set session_id=excluded.session_id,session_created_at=excluded.session_created_at;
 -- Device registrations will be re-established by this app after activation.
 delete from private.notification_devices where user_id=who and app_variant=p_variant;
 if p_variant='professional' and previous.session_id is not null then
  delete from private.professional_live_locations where professional_id=who;
 end if;
 return true;
end; $$;

create function public.app_session_is_current(p_variant text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.active_app_sessions where user_id=auth.uid() and app_variant=p_variant and session_id=private.request_session_id())
 and not exists(select 1 from private.replaced_app_sessions where user_id=auth.uid() and session_id=private.request_session_id());
$$;
create function public.app_session_allowed(p_user_id uuid,p_session_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.replaced_app_sessions where user_id=p_user_id and session_id=p_session_id);
$$;
create function public.release_app_session(p_variant text) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();sid uuid:=private.request_session_id();
begin
 if who is null or sid is null then return;end if;
 perform 1 from public.profiles where id=who for update;
 if exists(select 1 from private.active_app_sessions where user_id=who and app_variant=p_variant and session_id=sid) then
  delete from private.active_app_sessions where user_id=who and app_variant=p_variant and session_id=sid;
  insert into private.replaced_app_sessions(session_id,user_id) values(sid,who) on conflict do nothing;
  delete from private.notification_devices where user_id=who and app_variant=p_variant;
 end if;
end; $$;
revoke all on function public.activate_app_session(text),public.app_session_is_current(text),public.release_app_session(text),public.app_session_allowed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.activate_app_session(text),public.app_session_is_current(text),public.release_app_session(text) to authenticated;
grant execute on function public.app_session_allowed(uuid,uuid) to service_role;

-- Existing RLS and authenticated RPCs reject replaced JWTs before token expiry.
-- Auth-owned routines are deliberately untouched. Session-control RPCs use the
-- original identity so a replaced client can detect replacement and sign out.
do $guards$
declare item record;definition text;qual text;checked text;command text;
begin
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.prokind='f' and p.prosrc like '%auth.uid()%'
 and p.proname not in ('current_user_id','activate_app_session','app_session_is_current','release_app_session','app_session_allowed') loop
  definition:=replace(pg_get_functiondef(item.oid),'auth.uid()','private.current_user_id()');
  execute definition;
 end loop;
 for item in select pol.*,c.relname,n.nspname from pg_policy pol join pg_class c on c.oid=pol.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' loop
  qual:=pg_get_expr(item.polqual,item.polrelid);checked:=pg_get_expr(item.polwithcheck,item.polrelid);
  if position('auth.uid()' in coalesce(qual,'')||coalesce(checked,''))>0 then
   command:=format('alter policy %I on %I.%I',item.polname,item.nspname,item.relname);
   if qual is not null then command:=command||' using ('||replace(qual,'auth.uid()','private.current_user_id()')||')';end if;
   if checked is not null then command:=command||' with check ('||replace(checked,'auth.uid()','private.current_user_id()')||')';end if;
   execute command;
  end if;
 end loop;
end; $guards$;
notify pgrst,'reload schema';
