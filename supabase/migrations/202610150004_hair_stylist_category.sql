-- Separate migration so enum expansion can commit before any future data writes.
alter type public.talent_category add value if not exists 'HairStylist';
