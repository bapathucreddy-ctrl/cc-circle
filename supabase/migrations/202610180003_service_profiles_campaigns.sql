create table public.service_types (
 key text primary key, category public.talent_category not null, label text not null
);
alter table public.service_types enable row level security;
revoke all on public.service_types from public,anon,authenticated;
grant select on public.service_types to authenticated;
grant all on public.service_types to service_role;
create policy view_service_types on public.service_types for select to authenticated using(private.current_user_id() is not null);

alter table public.services add column service_key text references public.service_types(key);
create index services_type_active on public.services(service_key,professional_id) where active;
create function private.assign_service_type() returns trigger language plpgsql security definer set search_path='' as $$
declare craft public.talent_category;
begin
 select category into craft from public.professionals where id=new.professional_id;
 if new.service_key is null then
   select key into new.service_key from public.service_types where category=craft and lower(label)=lower(trim(new.name));
 elsif not exists(select 1 from public.service_types where key=new.service_key and category=craft) then
   raise exception 'Choose a service for your professional category';
 end if;
 return new;
end;$$;
revoke all on function private.assign_service_type() from public,anon,authenticated;
create trigger assign_service_type before insert or update of service_key,name,professional_id on public.services for each row execute function private.assign_service_type();

create table public.professional_photos (
 professional_id uuid primary key references public.profiles on delete cascade,
 storage_path text not null check(storage_path like professional_id::text||'/approved-%'),
 updated_at timestamptz not null default now()
);
alter table public.professional_photos enable row level security;
revoke all on public.professional_photos from public,anon,authenticated;
grant all on public.professional_photos to service_role;

create table public.home_campaigns (
 id text primary key, title text not null, subtitle text not null, category public.talent_category not null,
 service_key text references public.service_types, starts_at timestamptz not null, ends_at timestamptz not null,
 priority integer not null default 0, enabled boolean not null default true,
 check(ends_at>starts_at), check(length(title)<=100 and length(subtitle)<=200)
);
alter table public.home_campaigns enable row level security;
revoke all on public.home_campaigns from public,anon,authenticated;
grant select on public.home_campaigns to authenticated;
grant all on public.home_campaigns to service_role;
create policy active_home_campaigns on public.home_campaigns for select to authenticated
 using(private.current_user_id() is not null and enabled and starts_at<=now() and ends_at>now());

insert into public.service_types(key,category,label) values
('bridal-makeup','Makeup','Bridal makeup'),
('party-makeup','Makeup','Party makeup'),
('wedding-makeup','Makeup','Wedding guest makeup'),
('groom-makeup','Makeup','Bridegroom makeup'),
('general-makeup','Makeup','General makeup'),
('festive-makeup','Makeup','Festive makeup'),
('wedding-photography','Photographer','Wedding photography'),
('prewedding-photography','Photographer','Pre-wedding shoot'),
('event-photography','Photographer','Event photography'),
('portrait-photography','Photographer','Portrait session'),
('product-photography','Photographer','Product photography'),
('photo-editing','Editor','Photo editing'),
('video-editing','Editor','Video editing'),
('reel-editing','Editor','Reel editing'),
('wedding-film-editing','Editor','Wedding film editing'),
('bridal-hair','HairStylist','Bridal hair styling'),
('party-hair','HairStylist','Party hair styling'),
('haircut','HairStylist','Haircut'),
('general-hair','HairStylist','Hair styling'),
('groom-styling','HairStylist','Groom styling'),
('event-reels','ContentCreator','Event reel shoot'),
('brand-content','ContentCreator','Brand content'),
('social-content','ContentCreator','Social media content'),
('product-reels','ContentCreator','Product reel shoot');
update public.services set service_key=null;

-- Campaign windows are marketing schedules, not a recurring lunar calendar.
-- 2026 Dussehra / Diwali dates checked against India Post's official calendar.
insert into public.home_campaigns(id,title,subtitle,category,service_key,starts_at,ends_at,priority) values
('garba-2026','Get Garba-ready','Festive makeup for your next night out.','Makeup','festive-makeup','2026-10-11 00:00:00+05:30','2026-10-21 00:00:00+05:30',100),
('diwali-2026','Your Diwali glow','Find a makeup artist for the celebrations.','Makeup','festive-makeup','2026-11-01 00:00:00+05:30','2026-11-10 00:00:00+05:30',100),
('christmas-2026','Make the gathering memorable','Book a photographer for your celebrations.','Photographer','event-photography','2026-12-15 00:00:00+05:30','2026-12-27 00:00:00+05:30',90),
('newyear-2027','New year. Your best look.','Explore party makeup sessions.','Makeup','party-makeup','2026-12-27 00:00:00+05:30','2027-01-03 00:00:00+05:30',100),
('wedding-makeup','Your wedding, your look','Explore bridal makeup sessions.','Makeup','bridal-makeup','2026-01-01','2100-01-01',20),
('wedding-photography','Keep every wedding moment','Find your wedding photographer.','Photographer','wedding-photography','2026-01-01','2100-01-01',19),
('birthday-reels','A celebration worth sharing','Book a creator for your event reels.','ContentCreator','event-reels','2026-01-01','2100-01-01',18);

-- Distribution covers all reviews, not just the twenty displayed comments.
create or replace function public.professional_reviews(p_professional_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'count',(select count(*) from public.booking_reviews where professional_id=p.id),
 'average',(select round(avg(rating),1) from public.booking_reviews where professional_id=p.id),
 'distribution',(select jsonb_object_agg(stars,(select count(*) from public.booking_reviews r where r.professional_id=p.id and r.rating=stars)) from generate_series(1,5) stars),
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('rating',r.rating,'comment',r.comment,'created_at',r.created_at) order by r.created_at desc) from (select rating,comment,created_at from public.booking_reviews where professional_id=p.id order by created_at desc limit 20) r),'[]'::jsonb)
 ) from public.professionals p where private.current_user_id() is not null and p.id=p_professional_id and (p.is_published or p.id=private.current_user_id());
$$;

-- A craft change must not advertise stale services from the previous craft.
create function private.reset_services_for_craft() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.category is distinct from old.category then update public.services set active=false,service_key=null where professional_id=new.id;end if;
 return new;
end;$$;
revoke all on function private.reset_services_for_craft() from public,anon,authenticated;
create trigger reset_services_for_craft after update of category on public.professionals for each row execute function private.reset_services_for_craft();
