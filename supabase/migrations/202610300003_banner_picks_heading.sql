alter table public.home_campaigns add column featured_heading text not null default 'Festive picks'
 check(length(trim(featured_heading)) between 1 and 60);
notify pgrst,'reload schema';
