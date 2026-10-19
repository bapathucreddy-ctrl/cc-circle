# Booking activity and chat

Migration `202610160003_activity_and_paid_chat` is deployed on CC Circle. Apply incremental migrations to an existing project; the complete initial deployment bundle is only for fresh projects.

`booking_activity()` returns the customer's highest-priority active booking, otherwise a completed booking without a submitted review. The exclusion uses `booking_reviews` directly on the server. A successful review also hides that reminder immediately in the current app session; later reloads use the saved database review. Other completed, unreviewed bookings may still prompt for their own review. Booking history is retained.

Both participants can read/send chat only when `paid_at` is set, the status is accepted/en_route/arrived and `service_ended_at` is empty. Payment is verified by the existing backend payment flow. The Messages tab, message button, history and composer are hidden before payment and after closure. Booking updates and foreground refresh close an already-open conversation and clear its draft/subscription.

Verified end OTP, cancellation or decline deletes the booking's messages through a database trigger. The migration also deletes messages for already-closed bookings. Row security and an insert trigger enforce the same lifecycle even for an old app. Message insertion locks the booking against concurrent completion so a late send cannot recreate a closed conversation. This closes the booking chat session, not the account login; booking records and reviews remain.

Appearance sections were removed from both profiles. Existing header sun/moon controls still change mode.

Validation: 33 automated tests pass, including participant access before/after payment, outsiders, cleanup on all closure paths, actual end-OTP completion and server activity exclusion after review. TypeScript and customer/professional Android/iOS/web JavaScript exports pass. Hosted read-only deployment verification passes. Isolated browser fixtures verified reminder removal after review/reload, both profiles without Appearance, unpaid chat hidden, paid chat available and an open conversation closing after completion. Browser requests used mocked data and made no real booking/payment changes. Native device and real payment behavior still need device validation.
