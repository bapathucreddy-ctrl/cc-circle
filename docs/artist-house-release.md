# Artist House 0.2.0 — 30 October 2026

Artist House replaces the public Circle name and logo. The monochrome A/door mark follows the supplied reference. Package IDs, OAuth callbacks, signing keys, existing notification installation IDs and session storage keys remain unchanged, so these APKs update the matching installed apps.

| App | Android code | APK |
| --- | --- | --- |
| Customer | 19 | [ArtistHouse-Customer-0.2.0.apk](../artifacts/android/ArtistHouse-Customer-0.2.0.apk) |
| Professional | 22 | [ArtistHouse-Professional-0.2.0.apk](../artifacts/android/ArtistHouse-Professional-0.2.0.apk) |
| Admin | 8 | [ArtistHouse-Admin-0.2.0.apk](../artifacts/android/ArtistHouse-Admin-0.2.0.apk) |

Customer discovery uses horizontally snapping professional cards above the map. Swiping focuses the associated pin; selecting a pin scrolls its card into view. Result order remains stable during polling. Compare and View & book remain available. Existing booking/navigation sheets retain their layout.

In Admin, open **Banners → Daily customer notifications**, enter five distinct messages of up to 160 characters, choose 1–3 daily sends (default 3), enable promotions, then save. The feature is initially paused with no sample messages. Existing service-photo, service-name and per-banner picks-heading editors are included.

Customers separately enable **Notifications → Phone notifications** and **Picks & inspiration**. Promotions are off by default; booking alerts are unaffected by this preference. Only customer-app devices with current tokens are eligible.

The existing server worker runs each minute. Each customer/day receives a randomized plan for three different template slots in 10 AM–12 PM, 2–4 PM and 6–8 PM **Asia/Kolkata**. The admin's daily cap is enforced. Missed windows older than 45 minutes are skipped, rather than replayed together. Keys prevent repeated scheduling and enqueueing. Delivery rechecks user consent, account/device ownership, master pause and current template content. Transactional alerts take queue priority. OS/network/provider restrictions can reduce actual delivery.

Promotion bodies are displayed in push previews. Booking/message previews remain generic. No private message contents, addresses or service OTPs are added to push payloads. Promotions use a separate Android notification channel.

Backend migration: `202610300004_daily_promotions.sql`. Worker: `notification-dispatch`; the existing private dispatch header, Vault entries and minute cron are reused. Deploy schema before worker. Do not add credentials to client code.

Checks: 161 mobile tests, TypeScript, 5 admin tests, focused backend permission/scheduling tests, source/bundle identity, original certificates, 16 KB APK alignment, native map modules and enabled Android push configuration. Physical-device runtime/receipt remains unverified. No promotional messages were sent during setup.

Public landing-page branding was updated on the existing https://circle.cclabs.space domain. The legal operator and copyright remain CC Creative Labs / The Vivaha Stories.
