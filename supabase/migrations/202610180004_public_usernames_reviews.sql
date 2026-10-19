-- Public professional names are generated aliases, independent of private identity.
create table private.professional_usernames (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z]+[0-9]{6}$')
);
alter table private.professional_usernames enable row level security;
revoke all on private.professional_usernames from public,anon,authenticated;

create function private.professional_username(p_user_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare value text;words text[]:=array['innermost','quietpixel','softorbit','silverfern','brightmuse','gentlewave','ambercloud','velvetleaf','hiddenbloom','littlecomet','wildpetal','calmpanda','dreamyotter','mistycedar','lunarfinch','cozycanvas'];
begin
 perform 1 from public.profiles where id=p_user_id for update;
 select username into value from private.professional_usernames where user_id=p_user_id;
 if value is not null then return value;end if;
 loop
  value:=words[1+floor(random()*array_length(words,1))::integer]||lpad(floor(random()*1000000)::integer::text,6,'0');
  begin
   insert into private.professional_usernames(user_id,username) values(p_user_id,value);
   return value;
  exception when unique_violation then
   select username into value from private.professional_usernames where user_id=p_user_id;
   if value is not null then return value;end if;
  end;
 end loop;
end; $$;
revoke all on function private.professional_username(uuid) from public,anon,authenticated;

create function private.enforce_professional_username() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='professionals' then new.display_name:=private.professional_username(new.id);
 elsif new.professional_display_name is not null then new.professional_display_name:=private.professional_username(new.id);
 end if;
 return new;
end; $$;
revoke all on function private.enforce_professional_username() from public,anon,authenticated;
create trigger enforce_professional_username before insert or update of display_name on public.professionals
for each row execute function private.enforce_professional_username();
create trigger enforce_registered_username before update of professional_display_name on public.profiles
for each row execute function private.enforce_professional_username();

update public.professionals set display_name=display_name;
update public.profiles set professional_display_name=private.professional_username(id)
where professional_display_name is not null or exists(select 1 from public.professionals p where p.id=profiles.id);

create or replace function public.complete_registration(p_full_name text,p_email text,p_professional_name text default null,p_professional boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=private.current_user_id();u auth.users;account_name text:=regexp_replace(trim(p_full_name),'\s+',' ','g');public_name text;email_value text;
begin
 if who is null then raise exception 'Sign in to complete your profile';end if;
 perform 1 from public.profiles where id=who for update;
 select * into u from auth.users where id=who;
 if nullif(u.phone,'') is null or u.phone_confirmed_at is null then raise exception 'Verify your mobile number first';end if;
 if account_name is null or length(account_name) not between 2 and 120 or account_name ~* '(https?://|www\.|@)' then raise exception 'Enter your full name (2-120 characters)';end if;
 email_value:=lower(trim(coalesce(nullif(u.email,''),p_email)));
 if email_value is null or length(email_value)>254 or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address';end if;
 select professional_display_name into public_name from public.profiles where id=who;
 if p_professional or public_name is not null then public_name:=private.professional_username(who);end if;
 update public.profiles set full_name=account_name,display_name=account_name,contact_email=email_value,
 professional_display_name=public_name,registration_completed_at=coalesce(registration_completed_at,now()) where id=who;
 if public_name is not null then update public.professionals set display_name=public_name where id=who;end if;
 return public.my_registration();
end; $$;

create or replace function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=private.current_user_id();public_name text;
begin
 if who is null then raise exception 'Sign in to save your profile';end if;
 public_name:=private.professional_username(who);
 perform private.save_professional_profile(jsonb_set(p_profile,'{display_name}',to_jsonb(public_name)),p_private,p_service);
 update public.profiles set professional_display_name=public_name where id=who;
end; $$;

-- The full review page is separate from the two-comment profile preview.
create function public.professional_review_page(p_professional_id uuid,p_offset integer default 0,p_limit integer default 20)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_agg(jsonb_build_object('rating',r.rating,'comment',r.comment,'created_at',r.created_at) order by r.created_at desc,r.booking_id desc)
 from (select r.booking_id,r.rating,r.comment,r.created_at from public.booking_reviews r
 join public.professionals p on p.id=r.professional_id
 where r.professional_id=p_professional_id and private.current_user_id() is not null and (p.is_published or p.id=private.current_user_id())
 order by r.created_at desc,r.booking_id desc limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(0,coalesce(p_offset,0))) r),'[]'::jsonb);
$$;
revoke all on function public.professional_review_page(uuid,integer,integer) from public,anon;
grant execute on function public.professional_review_page(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
