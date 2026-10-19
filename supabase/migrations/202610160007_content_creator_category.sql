-- Commit the enum expansion before creating any ContentCreator profiles or bookings.
alter type public.talent_category add value if not exists 'ContentCreator';
