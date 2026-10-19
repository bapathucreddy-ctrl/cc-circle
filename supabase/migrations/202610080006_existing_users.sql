-- Users may have signed in before the profile-provisioning trigger was deployed.
insert into public.profiles(id)
select id from auth.users
on conflict(id) do nothing;
