-- CC Circle production data model. Run with Supabase CLI after creating a project.
create extension if not exists pgcrypto;

create function public.is_circle_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((auth.jwt()->'app_metadata'->>'cc_circle_role')='admin',false);
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 2 and 120),
  mode text not null default 'buyer' check (mode in ('buyer','talent')),
  city text not null default '',
  created_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  active boolean not null default true,
  sort_order int not null default 0
);
create table public.talent_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id),
  bio text not null default '' check(length(bio)<=2000),
  city text not null default '',
  languages text[] not null default '{}',
  availability text not null default '',
  verification_status text not null default 'unverified' check(verification_status in ('unverified','pending','approved','rejected')),
  updated_at timestamptz not null default now()
);
create index talent_category_city on public.talent_profiles(category_id,city);
create table public.portfolio_links (
  id uuid primary key default gen_random_uuid(),
  talent_id uuid not null references public.talent_profiles(user_id) on delete cascade,
  url text not null check(url ~* '^https://[^[:space:]]+$'),
  platform text not null default 'website',
  created_at timestamptz not null default now(),
  unique(talent_id,url)
);
create table public.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  talent_id uuid not null references public.talent_profiles(user_id) on delete cascade,
  proof_link_id uuid not null references public.portfolio_links(id),
  challenge_code text not null,
  evidence_object_key text,
  consent_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected','more_info')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references public.profiles(id),
  reason text
);
create table public.shortlists (
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  talent_id uuid not null references public.talent_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(buyer_id,talent_id)
);
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  talent_id uuid not null references public.talent_profiles(user_id),
  message text not null check(length(message) between 2 and 5000),
  status text not null default 'pending' check(status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);
create index inquiries_buyer on public.inquiries(buyer_id,created_at desc);
create index inquiries_talent on public.inquiries(talent_id,created_at desc);
create table public.project_briefs (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id),
  title text not null check(length(title) between 2 and 160),
  description text not null check(length(description) between 2 and 10000),
  city text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.review_audit (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.verification_submissions(id),
  reviewer_id uuid not null references public.profiles(id),
  decision text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.talent_profiles enable row level security;
alter table public.portfolio_links enable row level security;
alter table public.verification_submissions enable row level security;
alter table public.shortlists enable row level security;
alter table public.inquiries enable row level security;
alter table public.project_briefs enable row level security;
alter table public.review_audit enable row level security;

create policy profiles_read on public.profiles for select using(true);
create policy profiles_insert on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy categories_read on public.categories for select using(active or public.is_circle_admin());
create policy talent_read on public.talent_profiles for select using(true);
create policy talent_insert on public.talent_profiles for insert to authenticated with check(user_id=auth.uid() and verification_status='unverified');
create policy talent_update on public.talent_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy portfolio_read on public.portfolio_links for select using(true);
create policy portfolio_insert on public.portfolio_links for insert to authenticated with check(talent_id=auth.uid());
create policy portfolio_update on public.portfolio_links for update to authenticated using(talent_id=auth.uid()) with check(talent_id=auth.uid());
create policy portfolio_delete on public.portfolio_links for delete to authenticated using(talent_id=auth.uid());
create policy verification_read on public.verification_submissions for select to authenticated using(talent_id=auth.uid() or public.is_circle_admin());
create policy verification_insert on public.verification_submissions for insert to authenticated with check(talent_id=auth.uid() and status='pending' and reviewer_id is null and reason is null and exists(select 1 from public.portfolio_links l where l.id=proof_link_id and l.talent_id=auth.uid()));
create policy shortlist_own on public.shortlists for all to authenticated using(buyer_id=auth.uid()) with check(buyer_id=auth.uid());
create policy inquiry_read on public.inquiries for select to authenticated using(buyer_id=auth.uid() or talent_id=auth.uid());
create policy inquiry_insert on public.inquiries for insert to authenticated with check(buyer_id=auth.uid() and talent_id<>auth.uid() and status='pending');
create policy inquiry_update on public.inquiries for update to authenticated using(talent_id=auth.uid()) with check(talent_id=auth.uid());
create policy brief_read on public.project_briefs for select using(published or buyer_id=auth.uid() or public.is_circle_admin());
create policy brief_insert on public.project_briefs for insert to authenticated with check(buyer_id=auth.uid());
create policy brief_update on public.project_briefs for update to authenticated using(buyer_id=auth.uid()) with check(buyer_id=auth.uid());
create policy audit_admin_read on public.review_audit for select to authenticated using(public.is_circle_admin());

-- RLS alone does not protect a sensitive column on an owner update. Limit client UPDATE grants.
revoke update on public.talent_profiles from authenticated;
grant update(category_id,bio,city,languages,availability,updated_at) on public.talent_profiles to authenticated;
revoke update on public.inquiries from authenticated;
grant update(status) on public.inquiries to authenticated;
-- In production, set verification_status and write review_audit only through a privileged server function.

insert into public.categories(name,sort_order) values
('Acting',1),('Direction',2),('Camera',3),('Lighting',4),('Art & sets',5),('Costume',6),('Makeup',7),('Stunts',8),
('Editing',9),('Sound',10),('Music',11),('Voice',12),('VFX',13),('Animation',14),('Color',15),('Subtitles',16),
('Production',17),('Writing',18),('Casting',19),('Locations',20),('Photography',21),('Choreography',22),('Publicity',23),('Props',24);
