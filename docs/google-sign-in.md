# Google and mobile sign-in

Both Customer and Professional apps offer mobile OTP and **Continue with Google**. There is no email/password login. Google uses the system browser on native and a same-tab redirect on web. The apps keep separate sessions and callback schemes.

## Hosted configuration

1. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), configure Branding, Audience and the consent screen. Add test users if the app is in testing mode.
2. Create an OAuth client with application type **Web application**. Supabase handles the provider exchange for both web and native apps, so no Google client secret belongs in the mobile bundle.
3. Add JavaScript origins for browser development: `http://localhost:8081`, `http://127.0.0.1:8081`, `http://localhost:8082`, `http://127.0.0.1:8082`. Add the actual HTTPS production origins before deployment.
4. Add the Google client's authorized redirect URI: `https://jssxdolqlnharkxatvqe.supabase.co/auth/v1/callback`.
5. In [Supabase Google provider settings](https://supabase.com/dashboard/project/jssxdolqlnharkxatvqe/auth/providers), enable Google and save its client ID and client secret. Request only Google identity/profile/email access.
6. In Supabase **Authentication → URL Configuration → Redirect URLs**, allow each app callback:

   - `http://localhost:8081/auth/callback`
   - `http://127.0.0.1:8081/auth/callback`
   - `http://localhost:8082/auth/callback`
   - `http://127.0.0.1:8082/auth/callback`
   - `cccircle://auth/callback`
   - `cccircle-pro://auth/callback`

Add exact production web callbacks as well. The Google Console redirect URI is the **Supabase** URL; these app callbacks are configured in **Supabase**. Local Supabase redirect URLs are present in `supabase/config.toml`; enabling Google on a separate local backend also requires configuring its own Google provider credentials.

On 15 October 2026, after the user configured both platforms, the public hosted Auth settings reported Google and phone enabled. The hosted Google authorization endpoint returned HTTP 302 to `accounts.google.com`. This establishes provider activation and authorization routing, not completion of a real Google account sign-in.

## Implementation

`mobile/src/lib/googleAuth.ts` uses Supabase's authorization/token endpoints with S256 PKCE. Expo Crypto generates a secure random verifier and SHA-256 challenge on both platforms; it uses the asynchronous random API to avoid the development-only weak fallback of the synchronous random API. The verifier is scoped to the app and backend and stored in tab session storage on web or SecureStore on native. Code exchanges validate the callback, expire pending attempts after 15 minutes, deduplicate browser/deep-link callbacks and remove used verifiers. Supabase establishes and validates the resulting session; passwords and provider secrets are never collected by the app. Callback codes are removed from browser history.

Customer callback: `cccircle://auth/callback`. Professional callback: `cccircle-pro://auth/callback`. Rebuild native apps after adding `expo-web-browser`; the old APK does not establish native Google browser-session support. Browser OAuth requires HTTPS or localhost; plain HTTP LAN access can still use mobile OTP.

Google does not supply a verified mobile number. A signed-in Google customer can add one in Circle, or when paying for an accepted booking before the service. The app uses `updateUser({ phone })` followed by `verifyOtp({ type: 'phone_change' })`, preserving the signed-in identity. Cashfree remains disabled until that number is verified. Existing accounts are not silently merged when a phone number is already associated with a different user.

## Validation

Automated tests cover S256 challenge verification, callback deduplication, both native schemes, cancellation, expired/foreign callbacks and provider/network errors. Isolated browser checks cover both apps, mobile OTP, Google callback/token exchange, denied consent, all four color/design combinations, and adding a verified mobile number to a Google account. Browser token/user responses are intercepted fixtures, so no real Google accounts, SMS, bookings or payments are created. Real Google consent and physical-device browser return still need a user/device check.

References: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Expo browser authentication](https://docs.expo.dev/versions/latest/sdk/webbrowser/).
