# Circle launch and notifications

The customer and professional apps are named **Circle**. The existing logo, Android/iOS package identifiers, signing keys, schemes, authentication storage and OAuth callback URLs stay compatible with installed apps. CC Creative Labs remains the legal operator.

The original animated logo trace, wordmark and tagline now run on Android/iOS as well as web. The operating system still requires a native launch surface; it uses a transparent placeholder and matching background instead of a second static logo. Native launch hands off as soon as the first view is ready, independently of network/session restoration. Reduced motion uses a brief static version of the original design; interrupted animations have a deadline.

## Notification coverage

Both apps have a monochrome bell next to the theme button, unread count, inbox, mark-read controls and push/message/event settings. Opening a notification rechecks the signed-in recipient and app variant before opening its booking or event. Portfolio results open the professional account.

Server events cover:

- Booking requested/sent, accepted, declined and cancelled.
- Professional starts journey and arrives.
- Payment confirmed, refund requested/processing/confirmed/failed, earnings transfer paid/failed. Professional alerts never contain customer charge amounts.
- Start-service verification, completion request/end-code prompt and completed service. Codes are never included in notifications.
- New paid-active booking messages. No message contents are copied to alerts; closing chat deletes associated alerts and queued deliveries.
- Nearby matching event opportunities (published matching craft, nearby approximate service areas, up to 100 professionals per role), event applications and selected applicants.
- New reviews and portfolio import completion/failure.
- Accepted appointments within the next hour, once per booking and participant.

Notifications are generated transactionally from database changes, rather than trusting a phone to notify another user. Participants cannot insert forged notifications or access device tokens/delivery queues. The inbox is retained for 30 days. Push requires explicit consent, uses a private per-installation token, bounded delivery batches, leases, retry/backoff, invalid-token removal and account-change cleanup. Delivery is at-least-once; the notification ID also supplies the Android tray tag to replace retries. Read, expired, deleted and muted entries are suppressed before delivery. A generic OS alert already delivered may remain in the notification tray after a conversation closes; opening it cannot recover deleted messages.

Migrations `202610170001_notifications.sql` and `202610170002_notification_delivery_guard.sql` add the inbox, privacy rules, event triggers and private delivery outbox. `setup-notification-dispatch.sql` installs hosted-only `pg_net` wakeups and a minute-by-minute retry/retention/reminder schedule. Its authentication header is read from Supabase Vault, never embedded in committed SQL. A failed immediate wakeup does not fail the booking transaction; the schedule retries. Restore this setup separately when provisioning another project.

## Finish Android push setup

The inbox and server event handling work now. **Closed-app push is awaiting Firebase configuration**, as confirmed by the owner. This implementation uses native FCM tokens and the FCM HTTP v1 API directly; it does not require Expo Push Service or an EAS project.

1. In Firebase Console, create/select a project. Add two Android apps with the existing package IDs: `com.cccircle.customer` and `com.cccircle.professional`.
2. Download each app's `google-services.json`. Keep them separately under ignored local paths, such as `.local-tools/firebase/customer/google-services.json` and `.local-tools/firebase/professional/google-services.json`.
3. In `mobile/.env`, set `GOOGLE_SERVICES_CUSTOMER_JSON` and `GOOGLE_SERVICES_PROFESSIONAL_JSON` to the respective file paths. `GOOGLE_SERVICES_JSON` is an optional single-variant fallback. Paths must resolve from the project being prebuilt; use absolute paths for local isolated builds. Never use the private service-account JSON here.
4. Enable Firebase Cloud Messaging API (HTTP v1). Create a dedicated service account with only the required FCM sending permission in this project. Generate/download its private JSON key. Store its compact JSON in **Supabase secrets** as `FCM_SERVICE_ACCOUNT_JSON`, using a local ignored environment file or the dashboard. Do not put it in mobile configuration, source control or chat. The private key remains on the server.
5. Rebuild both Android apps with their correct Firebase configuration. Install the signed updates over the existing apps; open Notifications → Enable phone notifications. Explicit user permission registers each installation.
6. Verify a real booking request, acceptance, arrival and permitted chat on two devices, including a locked recipient phone. Check the OS tray, notification tap, unread/read state, muted alerts, sign-out and a closed conversation. Do not submit a real payment or service verification simply to test notification wiring.

`NOTIFICATION_DISPATCH_SECRET` must match the Supabase Vault entry `circle_notification_dispatch_secret`. The Vault URL entry `circle_notification_dispatch_url` points to `/functions/v1/notification-dispatch`. Both were configured in this workspace's hosted project. Calling the worker without its private header returns 401. Without FCM configuration it still queues appointment reminders and retains the inbox, returning `awaiting_firebase_configuration` rather than claiming a push was delivered.

iPhone remote push still needs Apple/APNs signing and a separate delivery implementation/configuration; it is not represented as working. Browser notifications currently use the in-app inbox, not browser background push.

Official references: [Expo notifications API](https://docs.expo.dev/versions/latest/sdk/notifications/), [FCM HTTP v1 authorization](https://firebase.google.com/docs/cloud-messaging/auth-server), [Firebase Android setup](https://firebase.google.com/docs/android/setup), [Supabase database webhooks](https://supabase.com/docs/guides/database/webhooks).

## Instagram test connection

`INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET` were already populated in local `supabase/.env`; their values were preserved and uploaded to Supabase secrets. The app continues using the official Instagram Login portfolio import flow. Keep the app in development/test mode until ready and use an accepted tester with a Business/Creator Instagram account. The exact redirect is `https://jssxdolqlnharkxatvqe.supabase.co/functions/v1/portfolio-callback`. The professional connects from their portfolio and approves the requested access. Saving client credentials does not prove that Meta authorization or media import has succeeded; this requires that interactive account connection. See [social portfolios](social-portfolios.md).
