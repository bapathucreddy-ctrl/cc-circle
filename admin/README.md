# Circle banner studio

Local web admin for finished customer-banner artwork. Run `npm ci`, `npm run build`, then `npm start` in this folder. Open **http://localhost:8090**. Build reads only the public Supabase URL and client key from `mobile/.env`; no server credential enters the browser bundle.

Use Google or an email sign-in link. First sign-in can register an account; email ownership must be verified. An account also needs an explicit entry in the server-owned banner-admin allowlist. Signing out here uses local scope and does not sign out the customer or professional app.

Upload a JPEG, PNG or WebP with its text already included, choose the header colour, destination service, schedule and priority, then publish. Recommended artwork: 1536 × 1024; maximum 8 MiB. The full image is displayed without app-added captions or overlays. Highest active priority wins; most recently updated breaks a tie. Customers refresh within 30 seconds while the app is open, and when returning to it. Pausing the winner reveals the next active campaign, including bundled fallback campaigns.

Apply `supabase/migrations/202610210001_banner_admin.sql` before running the updated customer client. An operator can approve an email using the service-role-only `grant_banner_admin` RPC. Never ship a service-role key to this panel. Configure the panel's exact origin in Supabase Auth's redirect allowlist when hosting elsewhere, and adjust the static server CSP if using a custom Supabase domain. The supplied development server binds only to this computer.

`home-banners` is a public marketing-artwork bucket. Professional profile/work media stays private. New image versions use new object names rather than overwriting cached files. Draft images are also publicly accessible to anyone with their URL; do not upload confidential artwork. Published campaign objects cannot be deleted through the panel's storage permissions.

Customer APK 0.1.14 and later includes configurable multi-profession Festive picks. In the banner editor, select the professions to display and one service per profession. Unchecked professions do not appear; no selected professions hides the cards. Apply `202610210002_banner_featured_services.sql` after the first banner migration.

The standalone Android app is **Circle Admin**, package `com.cccircle.admin`, version 0.1.0. It packages the same studio UI and uses Android's image picker, so it does not require a running localhost server or storage/camera permissions. Google sign-in opens the system browser and returns via `cccircle-admin://auth/callback` using PKCE. Add that exact redirect to Supabase Auth. Only the temporary PKCE verifier persists across an app restart; admin login tokens remain in the WebView session. Server-side verified-email admin permissions apply to the APK as well.

To build Android: run `npm run build`, set your Android SDK path and `CCIRCLE_SIGNING_FILE`, `CCIRCLE_SIGNING_ALIAS`, and `CCIRCLE_SIGNING_PASSWORD` in the build environment, then run `gradlew.bat :app:assembleRelease` from `admin/android`. Keep the signing key for subsequent updates. It is separate from the existing Customer and Professional keys. `npm test` verifies callback validation and session-storage boundaries.
