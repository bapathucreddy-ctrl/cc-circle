# One-time registration and public professional names

After phone OTP or Google sign-in, both app builds check `my_registration` before showing their normal screens.

- Phone sign-in: enter a full name and contact email. The already verified sign-in phone is reused.
- Google sign-in: confirm the full name, retain the Google email and add a mobile number verified with a `phone_change` OTP.
- Professional registration adds **Professional display / pen name**. Use a different creative/studio/pen name or only the first name. Customers do not get a display-name field.
- Successful completion writes `registration_completed_at`. Later sign-ins skip the form. Existing incomplete accounts complete it once. A completed customer account later using the professional app only needs the extra public-name step.

Contact email supplied by a phone user is collected as account information; it is not marked as a verified email or used to introduce email/password sign-in. Google email comes from server-side Supabase Auth rather than a submitted replacement. Phone completion requires a nonempty Auth phone and `phone_confirmed_at`; typing a phone number alone is insufficient.

Migration `202610160002_registration_and_private_names.sql` adds owner-only profile fields for full name, contact email, completion timestamp and the chosen professional name. `profiles.display_name` remains an internal mirror of the customer's full name for existing booking/participant functions; the customer UI now labels this **Full name**. Profile writes go through validated RPCs, and clients cannot directly set the completion marker or full-name column.

The public professional profile continues to use `professionals.display_name`, populated from the chosen public name. Registration and profile publishing reject public names containing the complete private name when the private name has multiple words. Names and whitespace are normalized; a first name is allowed. Publishing synchronizes the private saved alias, and new professional onboarding starts with that alias instead of copying the account full name.

Discovery, event applications, profile headers, participant tracking and message labels already read the professional public field. Personal account name/email rows remain restricted to their owner. The migration only shortens legacy public names where the saved private full name identifies a match; it does not guess whether unrelated existing studio names are legal names. Existing professionals should complete the new registration step and confirm their alias. Deliberately published contact information in bios, source watermarks or third-party video branding remains a separate disclosure route; this field separation is not a guarantee of anonymity.

## Reviewed-booking reminder

The bottom customer activity card prioritizes active bookings. A completed booking is shown only if its review is known to be missing. Submitting a review immediately marks that booking reviewed in the current session and refreshes the saved review state. If the review lookup fails, the card may continue showing an active booking, but never treats that failure as an empty review list and resurrects a completed-service reminder. Normal booking history and submitted reviews are retained.

## Validation

All 28 tests pass (15 mobile, 13 backend), TypeScript passes and both apps export Android/iOS/web. Backend coverage includes missing/invalid contact information, unverified phones, canonical Google email, persisted completion, forbidden direct profile updates, private full-name isolation, public-name validation, first-name aliases and participant labels. Activity regression tests cover dismissal and failed lookups while preserving live tracking.

Isolated Chrome fixtures passed phone registration, Google phone-change OTP, professional pen-name registration, no customer display-name field, skipping registration after reload, and review-card dismissal after submission and reload with a failed review lookup. No real OTP messages, account mutations, bookings or payments were made by those fixtures. Live SMS/Google account verification and device checks remain.
