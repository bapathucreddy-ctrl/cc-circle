-- Save onboarding, consent and the first service in one transaction.
revoke insert, update on public.professionals from authenticated;
revoke insert, update, delete on public.professional_private_details from authenticated;
grant update(available_now) on public.professionals to authenticated;

create function public.save_professional_profile(p_profile jsonb,p_private jsonb,p_service jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare category public.talent_category; link text; s_id uuid; profile_specs jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to save your profile'; end if;
  if jsonb_typeof(p_profile)<>'object' or jsonb_typeof(p_private)<>'object' or jsonb_typeof(p_service)<>'object' then raise exception 'Invalid profile'; end if;
  category := (p_profile->>'category')::public.talent_category;
  if jsonb_typeof(p_profile->'portfolio_urls')<>'array' or jsonb_array_length(p_profile->'portfolio_urls')=0 then raise exception 'Add a work portfolio'; end if;
  for link in select jsonb_array_elements_text(p_profile->'portfolio_urls') loop
    if link !~ '^https://[^[:space:]]+$' or length(link)>2000 then raise exception 'Use HTTPS work links'; end if;
  end loop;
  profile_specs := coalesce(p_profile->'public_specs','{}'::jsonb);
  if octet_length(profile_specs::text)>65536 then raise exception 'Profile specifications are too large'; end if;
  -- Casting answers are owner-only. Public actor discovery uses selected specialties.
  if category='Actor' then p_private:=profile_specs||p_private; profile_specs:='{}'; end if;
  insert into public.professionals(id,display_name,category,city,bio,specialties,longitude,latitude,portfolio_urls,public_specs,is_published)
  values(auth.uid(),trim(p_profile->>'display_name'),category,trim(p_profile->>'city'),trim(p_profile->>'bio'),
    array(select jsonb_array_elements_text(p_profile->'specialties')),(p_profile->>'longitude')::numeric,(p_profile->>'latitude')::numeric,
    array(select jsonb_array_elements_text(p_profile->'portfolio_urls')),profile_specs,true)
  on conflict(id) do update set display_name=excluded.display_name,category=excluded.category,city=excluded.city,bio=excluded.bio,
    specialties=excluded.specialties,longitude=excluded.longitude,latitude=excluded.latitude,portfolio_urls=excluded.portfolio_urls,public_specs=excluded.public_specs,is_published=true;
  insert into public.professional_private_details(professional_id,details,portfolio_consent_at)
  values(auth.uid(),p_private,now()) on conflict(professional_id) do update set details=excluded.details,portfolio_consent_at=now(),updated_at=now();
  if p_service->>'id' is not null then
    s_id := (p_service->>'id')::uuid;
    if not exists(select 1 from public.services where id=s_id and professional_id=auth.uid()) then raise exception 'Service not found'; end if;
    update public.services set name=trim(p_service->>'name'),amount_paise=(p_service->>'amount_paise')::integer,
      duration_minutes=(p_service->>'duration_minutes')::integer where id=s_id;
  else
    insert into public.services(professional_id,name,amount_paise,duration_minutes)
    values(auth.uid(),trim(p_service->>'name'),(p_service->>'amount_paise')::integer,(p_service->>'duration_minutes')::integer);
  end if;
  delete from public.professional_drafts where professional_id=auth.uid();
end;
$$;
revoke all on function public.save_professional_profile(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_professional_profile(jsonb,jsonb,jsonb) to authenticated;
