# Circle standalone Android apps

Built 17 October 2026. Install over the matching existing app without uninstalling; package IDs and original signing keys are retained. Both launcher names are **Circle**, with the original logo. Expo Go, Metro and a computer connection are not required.

| App | Version / Android code | APK |
| --- | --- | --- |
| Customer | 0.1.5 / 6 | [Circle-Customer.apk](Circle-Customer.apk) |
| Professional | 0.1.10 / 11 | [Circle-Professional.apk](Circle-Professional.apk) |

The original animated splash is restored; the extra native static logo is removed. Both apps include a private notification inbox, unread count and preferences. Booking, journey, service, payment/refund/payout, paid-active chat, event, review and portfolio updates are generated on the server. **Closed-app push still needs Firebase configuration and a rebuild.** [Setup and coverage](../../docs/notifications-and-circle.md). Instagram client credentials are configured in Supabase; the professional still needs to authorize their tester account.

Approved all-craft close-up navigation, background GPS and optional Google Maps handoff are retained. Professional-only background location permission remains; both apps now have notification/boot permissions from the notification SDK. Sharing still requires consent/online status and OS access. A powered-off phone cannot send GPS. Payments remain Cashfree sandbox.

87 mobile tests, TypeScript and 21 database tests pass. Both web exports and isolated browser inbox/splash checks pass with mocked accounts. Both APKs have verified final Hermes bytecode, native/embedded identity, Circle label, ten transparent native launch images, notification module, Mapbox/Cashfree/TaskManager, all 8craft rider PNGs, original certificates and ZIP / 18 ARM64 ELF16KB compatibility. **Physical-device testing of these builds, closed-app push and Meta interactive authorization remain pending.** No real booking/payment/OTP action was automated.

| APK | Bytes | SHA-256 |
| --- | ---: | --- |
| Customer | 105785829 | 30ad173122bff34581413a5110c98ffca29c588579410eead9e552330fbbf7f2 |
| Professional | 105785221 | c3ef4924a06dee1a34a88a0a1392dcbedd6eb1929aab026895fe16f83b8784dd |
