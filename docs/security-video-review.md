# Security review against the supplied video

Reviewed 16 October 2026. Reference: the user's `sec video.mp4` (59.7 seconds), including all 20 on-screen checks. This is a source review with targeted tests, not a penetration-test certification. The video is reference material; changes were based on the app's actual architecture.

## Changes made

- Added offline Privacy Policy, Terms and Conditions and Cookie Policy screens to both apps, reachable before sign-in and from both profiles. Operator: **CC Creative Labs**; support/privacy contact: **support@cclabs.space**. The notices describe current location visibility, private/public names, service OTPs, fixed versus hourly wedding payment, chat deletion, provider processing and actual local storage.
- Replaced wildcard function CORS with exact `ALLOWED_WEB_ORIGINS`, retaining native/server requests without an Origin header. Unknown browser origins fail before the handler. Responses are `no-store`, `nosniff` and vary by Origin; credentialed wildcard responses are prohibited.
- Bound JSON and webhook bodies while streaming, including requests with no or dishonest Content-Length, before accumulating an unbounded body. JSON must be an object. Existing 8 KiB API / 64 KiB webhook limits are retained in bytes.
- Added server-side upload header checks for supported photo/video containers, in addition to private storage, owner paths, MIME allowlisting and a 25 MiB cap. Mismatched uploads are deleted before portfolio registration. This is format validation, not malware scanning or full media decoding.
- Added independent database-backed throttling to portfolio endpoints (60 operations per user per minute). The existing payment limit remains separate and unchanged. Migration 202610160009_portfolio_limits is deployed; all 23 migrations pass hosted read-only verification. Provider quotas and upload-storage monitoring are still needed.
- Patched the `xcode` build-tool dependency to `uuid` 11.1.1 with a scoped override. Its CommonJS v4 API still works. The audit fell from 25 findings (17 high, 8 moderate) to 17 high, 0 moderate. Remaining findings trace to `braces` <=3.0.3 and `node-forge` <=1.4.0; those are still the latest published versions at this check. No forced Expo/native SDK downgrade was applied.
- Added a static-host `_headers` file with nosniff, referrer, frame, permission and HTTPS transport policies. The production host must support/apply it; Metro and arbitrary static servers do not automatically enforce it.

All nine Edge functions were redeployed with the shared HTTP controls. Live read-only checks confirmed unlisted Origin ->403, allowed localhost preflight ->204 with the exact Origin, and unauthenticated portfolio ->401. No real payments, SMS, account changes or attacker traffic were used.

## All 20 video checks

| # | Video check | App evidence / remaining work |
| --- | --- | --- |
| 1 | SQL injection | Supabase query parameters and PostgreSQL function arguments are used rather than concatenated user SQL. Existing database tests exercise hostile access and invalid booking transitions. This does not replace a live SQL-injection assessment. |
| 2 | Cross-site scripting | User text is rendered through React Native/React text; no user HTML injection/eval path was found. OAuth callback HTML escapes its message and has a restrictive CSP. Uploaded executable content is not supported. Production web CSP still needs testing with maps/checkout before enforcement. |
| 3 | CSRF | APIs require explicit Bearer tokens rather than ambient session cookies. Google uses PKCE; portfolio callbacks use hashed, expiring, single-use state. CORS is now exact. A future cookie/BFF architecture must add its own CSRF controls. |
| 4 | File uploads | Added actual signature/container checks; existing MIME, byte-size and ownership controls remain. Malware scanning, full decoding and orphan-file cleanup remain production work. |
| 5 | Object-level authorization | Booking participants, private details, portfolio owners and event selections are checked by RPC/RLS or server-side identity; IDs alone do not authorise access. Existing database tests cover other-user denials. |
| 6 | Rate limits | Payment operations use a database limit; portfolio now has its own durable counter. Search has per-worker burst limits. Durable cross-worker search quotas, signup bot protection and abuse monitoring remain to be configured. |
| 7 | JWT secrets | Service/JWT signing keys are not shipped in client source/config. `getUser(token)` validates function callers; the app rejects service-role/secret client keys. Hosted JWT key rotation/settings were not independently audited. |
| 8 | Server API secrets | Cashfree, Places, social OAuth and token encryption keys stay in Supabase secrets. Public Mapbox and Supabase publishable keys are intentionally client-visible. APK preparation copies only an explicit public-variable allowlist. |
| 9 | Password hashing | This app has phone OTP / Google sign-in, not its own password database. Supabase/Google manage identity credentials. No custom plaintext-password store was introduced. |
| 10 | MFA | **Still required for production administration and sensitive account recovery.** Phone OTP is a first factor, not an independent second factor. This change does not claim to implement enrolled TOTP/AAL2 or enforce it across every RPC/RLS policy. A complete MFA rollout needs enrollment, recovery and server enforcement together. |
| 11 | CORS | Fixed and deployed: exact origins; rejected origins cannot execute handlers; native calls remain supported. Configure hosted/LAN origins explicitly. CORS is not a replacement for authentication. |
| 12 | Tokens in localStorage | Already absent: web auth uses per-tab sessionStorage, native auth uses SecureStore. Appearance alone uses localStorage. sessionStorage remains JavaScript-readable; an HttpOnly web-session design needs a server/BFF and a separate migration. |
| 13 | Server permissions | Authenticated functions resolve the caller from Supabase, worker endpoints require a server secret, booking/payment state transitions are server-owned. A client role/display toggle is not authority. |
| 14 | RLS | Public/private booking/account tables have RLS/grants exercised by database tests. Social tokens and professional private details have separate access. Hosted configuration drift and Storage policies still require periodic audit. |
| 15 | Webhook signatures | Cashfree verifies HMAC over timestamp + the exact bounded raw body before parsing, reconfirms the payment with the provider and uses idempotent DB confirmation. Worker and webhook credentials stay server-side. |
| 16 | SSRF | Search/media API calls use fixed provider hosts and encoded identifiers; no generic server-side user-URL scraper/proxy was added. The browser/native media player loading a media URL is separate from server SSRF. |
| 17 | Source maps | Release Android bundles are embedded Hermes bytecode; verification rejects packaged `.map` files. Web exports use the default non-sourcemap export; do not publish internal `.local-build`/source directories. |
| 18 | Default credentials | Independent random release signing credentials were generated and kept outside downloads/source control. Sandbox phone OTPs and provider settings need explicit production review; no production credential rotation was performed. |
| 19 | Sensitive logs | No token/card/account logging was found in maintained mobile/function source. Client errors are generic rather than provider payloads. Hosting/provider log retention and access remain operational responsibilities. |
| 20 | Dependencies | Scoped uuid patch applied and checked. **17 high advisories remain** through the current build-tool tree; monitor upstream braces/node-forge fixes. Audit counts are not 17 independently demonstrated exploitable app vulnerabilities. |

## Browser-origin setup

Set `ALLOWED_WEB_ORIGINS` in Supabase secrets to a comma-separated list of exact URLs, with no trailing slash (for example `https://app.your-domain.example`). Include each customer/professional origin separately. The default permits localhost/127.0.0.1/0.0.0.0 on ports 8081/8082 only. For LAN browser development, add the actual `http://<LAN-IP>:<port>` explicitly. This does not affect installed native APK calls, which do not send Origin. Do not use `*` or `null`.

## Policy maintenance and production work

`mobile/src/legal.ts` is the source for in-app notices. Matching readable copies are in `docs/legal/`. Update both when processing changes; do not add an optional-cookie consent switch that leaves tracking enabled. The app currently has no first-party advertising/marketing analytics integration. Third-party map/media/payment processing is disclosed separately.

Before public launch, confirm the operator's legal/address details and privacy/grievance process, review applicable notice/retention/consent obligations with the final product, provide an audited account-deletion workflow, finalise the cancellation/refund rules and test device/provider behavior. The notices deliberately do not promise nonexistent automatic deletion, zero cookies, complete portfolio anonymity or a refund deadline. Keep the existing payment sandbox setting.

References: [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/), [Supabase MFA architecture](https://supabase.com/docs/guides/auth/auth-mfa/totp), [MeitY DPDP Rules publication](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025). These sources inform review; this implementation is not a claim of legal compliance or a complete security audit.

Validation: TypeScript passes; 37 mobile tests and 18 database tests pass. Both production web previews opened/closed all three policies at phone width with no overflow or runtime exceptions. The new limit test verifies cross-user isolation, permission denial, expiry reset and independence from payments.
