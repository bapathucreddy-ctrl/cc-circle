-- Account identity stays in the owner-only profile, separate from public talent names.
alter table public.profiles add column full_name text not null default '' check(length(full_name)<=120),
  add column contact_email text check(length(contact_email)<=254),
  add column registration_completed_at timestamptz,
  add column professional_display_name text check(length(professional_display_name) between 2 and 80);
update public.profiles set full_name=display_name;
-- Shorten legacy public names only where the stored private name identifies them.
update public.professionals p set display_name=case
  when length(split_part(regexp_replace(trim(c.full_name),'\s+',' ','g'),' ',1))>=2 then split_part(regexp_replace(trim(c.full_name),'\s+',' ','g'),' ',1)
  else split_part(regexp_replace(trim(c.full_name),'\s+',' ','g'),' ',1)||' Creative' end
from public.profiles c where c.id=p.id and trim(c.full_name) ~ '[[:space:]]'
  and position(lower(regexp_replace(trim(c.full_name),'\s+',' ','g')) in lower(regexp_replace(trim(p.display_name),'\s+',' ','g')))>0;

create function public.my_registration() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.profiles; u auth.users;
begin
  if auth.uid() is null then raise exception 'Sign in to complete your profile'; end if;
  select * into p from public.profiles where id=auth.uid();
  select * into u from auth.users where id=auth.uid();
  return jsonb_build_object('full_name',coalesce(nullif(p.full_name,''),nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),''),'email',coalesce(nullif(u.email,''),p.contact_email,''),
    'email_from_sign_in',nullif(u.email,'') is not null,
    'phone_verified',nullif(u.phone,'') is not null and u.phone_confirmed_at is not null,
    'completed_at',p.registration_completed_at,'professional_name',coalesce(p.professional_display_name,''));
end;
$$;

create function public.complete_registration(p_full_name text,p_email text,p_professional_name text default null,p_professional boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; account_name text:=regexp_replace(trim(p_full_name),'\s+',' ','g');
  public_name text:=regexp_replace(trim(p_professional_name),'\s+',' ','g'); email_value text;
begin
  if auth.uid() is null then raise exception 'Sign in to complete your profile'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  select * into u from auth.users where id=auth.uid();
  if nullif(u.phone,'') is null or u.phone_confirmed_at is null then raise exception 'Verify your mobile number first'; end if;
  if account_name is null or length(account_name) not between 2 and 120 or account_name ~* '(https?://|www\.|@)' then raise exception 'Enter your full name (2-120 characters)'; end if;
  email_value:=lower(trim(coalesce(nullif(u.email,''),p_email)));
  if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
  if p_professional and (public_name is null or length(public_name) not between 2 and 80 or public_name ~* '(https?://|www\.|@)') then
    raise exception 'Choose a public display or pen name (2-80 characters), without handles or links'; end if;
  if public_name is not null and (length(public_name) not between 2 and 80 or public_name ~* '(https?://|www\.|@)') then
    raise exception 'Choose a valid public display or pen name'; end if;
  if public_name is null then select professional_display_name into public_name from public.profiles where id=auth.uid(); end if;
  if account_name ~ '[[:space:]]' and position(lower(account_name) in lower(public_name))>0 then raise exception 'Use a pen name or first name instead of your full name for your public professional name'; end if;
  update public.profiles set full_name=account_name,display_name=account_name,contact_email=email_value,
    professional_display_name=public_name,registration_completed_at=coalesce(registration_completed_at,now()) where id=auth.uid();
  if public_name is not null then update public.professionals set display_name=public_name where id=auth.uid(); end if;
  return public.my_registration();
end;
$$;

create function public.save_customer_full_name(p_name text) returns void language plpgsql security definer set search_path='' as $$
declare value text:=regexp_replace(trim(p_name),'\s+',' ','g'); public_name text;
begin
  if auth.uid() is null then raise exception 'Sign in to update your name'; end if;
  if value is null or length(value) not between 2 and 120 or value ~* '(https?://|www\.|@)' then raise exception 'Enter your full name (2-120 characters)'; end if;
  select professional_display_name into public_name from public.profiles where id=auth.uid() for update;
  if value ~ '[[:space:]]' and position(lower(value) in lower(public_name))>0 then raise exception 'Choose a different public professional name before saving this full name'; end if;
  update public.profiles set full_name=value,display_name=value where id=auth.uid();
end;
$$;
revoke update(display_name) on public.profiles from authenticated;

-- All customer-facing professional surfaces already read professionals.display_name.
-- Keep publishing from copying the private full name into that public field.
create or replace function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare professional_name text:=regexp_replace(trim(p_profile->>'display_name'),'\s+',' ','g'); account_name text;
begin
  if auth.uid() is null then raise exception 'Sign in to save your profile'; end if;
  if professional_name is null or length(professional_name) not between 2 and 80 or professional_name ~* '(https?://|www\.|@)' then
    raise exception 'Choose a professional name of 2-80 characters, without handles or links'; end if;
  select full_name into account_name from public.profiles where id=auth.uid() for update;
  if account_name ~ '[[:space:]]' and position(lower(account_name) in lower(professional_name))>0 then
    raise exception 'Use a pen name or first name instead of your full name for your public professional name'; end if;
  perform private.save_professional_profile(jsonb_set(p_profile,'{display_name}',to_jsonb(professional_name)),p_private,p_service);
  update public.profiles set professional_display_name=professional_name where id=auth.uid();
end;
$$;

revoke all on function public.my_registration(),public.complete_registration(text,text,text,boolean),public.save_customer_full_name(text) from public,anon;
grant execute on function public.my_registration(),public.complete_registration(text,text,text,boolean),public.save_customer_full_name(text) to authenticated;
