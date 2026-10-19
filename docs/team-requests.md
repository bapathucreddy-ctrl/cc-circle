# Event team requests

Customers open **Request**, or **For the whole team** on Home.

1. Enter an event name/project title and requirements.
2. Select a profession from the dropdown, change its count with minus/plus and add it to the list. Repeat for other professions. Existing list entries can be adjusted or removed; each profession allows 1–20 people.
3. Choose a venue using the shared Mapbox search/GPS picker or map pin and confirm the exact pin. There is no free-text city/location field. Search uses permanent geocoding because the venue is stored; the existing Mapbox entitlement requirement still applies.
4. Select a future event date with the calendar and choose a start time. There is no budget field.
5. Post the event, then open **My events → Review professional applications**.

For example: **Wedding celebration**, 2 photographers, 2 makeup artists and 1 hair stylist creates one event with five places across three professions.

Published professionals see matching future posts in the professional app's **Events** tab. They select an active service, review its duration and their net earnings, optionally add a message and raise a request. Applying does not reserve their schedule. An unselected application can be withdrawn and resubmitted to change the service or its price.

Customers see all applications to their own event, including public professional name, category, biography, city, offered service/duration, general charge including platform fees, and message. **View work & full profile** opens the existing in-app portfolio/profile. **Accept professional → Confirm professional** creates one accepted booking; no charge is made by selection itself. Each selected booking is paid individually before travel/service and uses the existing tracking, start/end OTP and review flow.

## Server rules

Migration `202610160001_team_requests.sql` adds three private RLS-enabled tables (`team_events`, `team_roles`, `team_applications`) and authenticated RPCs. There are no client table grants. Legacy `project_briefs` are retained in the database but are no longer posted/read by these app screens.

- Event creation is idempotent by customer/request UUID, requires a saved customer profile name, validates coordinates/time/role counts and limits new posts to 20 per customer per day.
- Only published professionals in a requested category can apply, using one of their own active services. One application per event/professional prevents duplicate places.
- Only the event customer can read all applicants or accept one. Professionals receive their own net quote and application status; competing applicants and customer totals are excluded from their event DTO.
- An event row lock serializes applying, accepting and withdrawing. Acceptance rechecks current role headcount and current service name, duration, price, publication/category and availability. Normal booking logic locks the professional and prevents conflicting bookings/blocked dates.
- An application UUID is reused as the booking request UUID, so acceptance retries return the same booking. Accepted applicants cannot withdraw outside the booking workflow.
- Cancellation/decline frees that booking's place. Completed and active bookings continue to count as selected. A cancelled application remains attached to its historical booking; choose another pending applicant to refill the place.
- Posting or applying never charges or reserves a professional. Customer acceptance reserves the booking; the existing prepayment rules and payout-after-verified-completion rules apply.

The event venue is visible to matching published professionals. No sign-in contact details or original/legal professional names are added to applicant responses. Full marketplace search, event editing/closing, push notifications and batch checkout are not added by this change. Each offer is for its stated service duration, rather than an assumed full event day.

## Validation

14 mobile tests and 12 backend tests pass, including role matching, duplicate posting/applying/acceptance, ownership checks, hidden professional customer-total fields, changed quotes, precise headcounts, cancellation freeing a place and changed availability. TypeScript and customer/professional Android/iOS/web exports pass.

Isolated Chrome fixtures exercised posting the five-person wedding, selecting a calendar date, choosing GPS location, raising a professional application, reviewing the general charge, confirming the applicant and seeing acceptance in the professional app. No real backend writes or payments were used; external Mapbox requests were intercepted. Real multi-account hosting, Mapbox search, native calendar dialogs and physical-device navigation still need device validation. The migration was applied to CC Circle and hosted read-only schema/access verification passed.

Screenshot gallery: `previews/team-requests/index.html` (demo data).

## Neutral icon accents

Existing profession and scooter icons now use sibling `*-neutral.png` assets with vivid blue accents changed to white. Source artwork and photographs remain intact; dark outlines and the requested red destination marker are retained. Regenerate with `scripts/build-neutral-icons.ps1` on Windows. `craftImages` and `mapArtwork` point to the new assets.
