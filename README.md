# CC Circle

An Expo app for iOS, Android and the web, with a Node/SQLite API. Film talent can link existing public portfolios; CC Circle discovers available image and video URLs from those pages; hiring teams can find people by craft and city, save profiles, send inquiries and publish briefs. A private reviewer queue supports manual profile and portfolio link checks.

## Run locally

Use Node 24 or newer and npm. Run these commands from this directory in two terminals:

```bash
npm install
npm install --prefix server
ADMIN_EMAIL=reviewer@example.com ADMIN_PASSWORD='replace-with-a-long-private-password' npm run dev --prefix server
```

```bash
EXPO_PUBLIC_API_URL=http://localhost:3333 npm run web
```

Open the local URL printed by Expo. Create a talent account and a hiring account in the app. Sign in with the configured reviewer account to use the private review queue. The API health endpoint is `http://localhost:3333/health`.

For a phone on the same network, replace `localhost` in `EXPO_PUBLIC_API_URL` with the computer's LAN IP, then run `npm start` and open the QR code in Expo Go. An Android emulator can use `http://10.0.2.2:3333`. The phone must reach the API at the configured address. Mobile release builds should use a public **HTTPS** API URL; Expo embeds `EXPO_PUBLIC_API_URL` in the client bundle at build time. Set `APP_ORIGINS` to the deployed web origin. Persist and back up `DATA_DIR` (default `server/data` when started from this directory).

For Expo Go on an Android phone, put `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_WIFI_IP:3333` in `.env.local` at the project root (not `server/.env`). Start the API with `npm run dev --prefix server`, then restart Expo with `npm start -- --clear --lan` and scan the QR code again. Keep both devices on the same Wi-Fi. Open `http://YOUR_COMPUTER_WIFI_IP:3333/health` in the phone's browser to check connectivity. If that fails, check that the API is running and your computer's firewall allows port 3333. Update `.env.local` if your computer's Wi-Fi IP changes. `localhost` and `127.0.0.1` on the phone refer to the phone itself.

The source also includes an isolated illustrative demo at `/demo`, accessible from the welcome screen. It uses local sample people and photos to show a populated interface. Live accounts never show those people as verified members.

## Main flows

- 24 craft categories, multi-craft profiles and specialties, work previews in discovery cards, location/date/daily-budget filters, paginated discovery and saved searches. Responsive layouts use Inter typography, warm ivory and taupe surfaces, photo profession cards, portfolio overlays, desktop navigation and mobile bottom navigation. Web cards have subtle hover and focus effects that respect reduced-motion settings.
- Email/password accounts, talent and hiring roles, profile photo upload, public link media discovery, optional owner-authorized YouTube and professional Instagram imports, link management, shortlist, project inquiries, responses, briefs and in-app notifications.
- Talent requests an ownership code, places it in a public portfolio bio, chooses its linked URL, captures a live camera photo and consents to review. A private admin compares the evidence and records an approval or rejection reason. The badge means a **manual profile and link check**, not legal identity or skill certification.
- Account deletion removes profile data, conversations and private review photos. Review evidence is available only to authenticated admins. The server reads public portfolio HTML and stores discovered media URLs, without downloading the media files. Platform access may be restricted.

## Portfolio sources

Talent can paste an HTTPS URL for Instagram, Behance, YouTube, Vimeo or a personal site. The API fetches the public HTML, follows safe redirects and extracts media and video links that the page exposes. It stores candidate URLs and displays at most ten images and ten videos in a consistent, creator-controlled order; a page with fewer items shows only those items. A blocked or JavaScript-only page may yield no media, while its profile link is still retained. The Refresh public links button rescans pasted pages. Removing a source removes its discovered media.

For owner-authorized imports, configure a Google OAuth client with the YouTube Data API and a redirect URI matching `GOOGLE_REDIRECT_URI`, and/or a Meta app with Instagram API with Instagram Login and a redirect URI matching `INSTAGRAM_REDIRECT_URI`. Set the client ID, secret and redirect URI as server environment variables (see `server/.env.example`). Instagram Login supports professional Creator and Business accounts. The buttons are disabled until their credentials are configured. OAuth tokens are used for one import and discarded, so users reconnect to update connected media. Behance is supported through public URL discovery in this MVP; there is no Behance account connection. Provider access, app permissions and review must be configured before live owner authorization can be used.

### Connect accounts from Expo Go

1. Give the API a reachable HTTPS address. Use a deployed API subdomain on your existing domain, or an HTTPS tunnel forwarding to local port 3333. For example, with an installed and authenticated ngrok CLI, run `ngrok http 3333` while the API is running. A website domain by itself does not host this API. Confirm `https://YOUR_API_HOST/health` opens on the phone.
2. In Google Cloud, enable YouTube Data API v3 and configure the OAuth consent screen. Use a **Web application** OAuth client because the server exchanges the code. Register `https://YOUR_API_HOST/oauth/youtube/callback` as an authorized redirect URI. Add your Google account as a test user while the app is in testing. See [Google's server OAuth guide](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps).
3. In your Meta app, configure **Instagram API with Instagram Login**. Register `https://YOUR_API_HOST/oauth/instagram/callback` as an allowed redirect URI. Use its Instagram App ID and App Secret and configure eligible test accounts while in development. The integration requests `instagram_business_basic`; connecting requires an Instagram Creator or Business account. See [Meta's Instagram Login guide](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/).
4. Update `GOOGLE_REDIRECT_URI` and `INSTAGRAM_REDIRECT_URI` in `server/.env` to those exact registered URLs. Set the matching client IDs and secrets there, using `server/.env.example` as a reference. Keep secrets out of `EXPO_PUBLIC_*` variables. Restart the API. If a temporary tunnel URL changes, update both the server configuration and provider consoles.
5. The app's root `.env.local` can keep its LAN API address on the same Wi-Fi, or use `EXPO_PUBLIC_API_URL=https://YOUR_API_HOST` for remote testing. Restart Expo after changing it. Sign in as talent, open Portfolio, and tap **Connect YouTube** or **Connect Instagram**. Authorize in the browser and return to Expo Go; the screen refreshes connected media automatically. **Check connected media** also refreshes manually. **Reconnect** imports current media again; **Remove** deletes the source and its imported media from CC Circle.

These are portfolio connections for an existing CC Circle account, not social sign-in. The app imports public YouTube videos or Instagram posts and stores their URLs; it does not keep provider tokens for background synchronization.

### Display imported work

The Portfolio screen and public talent profile share an Images/Videos gallery showing up to ten available items of each kind. Tap an image for a full-size view or a video for in-app playback. YouTube and Vimeo use their embedded players. Instagram videos use direct CDN URLs with Expo Video; Instagram posts are never embedded. Only the selected video creates a player, and closing the viewer releases it. The original source remains accessible from the viewer. YouTube embedding follows [Google's player identity requirements](https://developers.google.com/youtube/terms/required-minimum-functionality#api-client-identity-and-credentials).

YouTube connects import public channel videos. Professional Instagram connects import images, carousel items and videos. Reconnect existing Instagram sources once to import playable video URLs; older imports contain only post links. Instagram CDN URLs can expire, so reconnect if media stops loading. Behance public profile links scan visible media and up to five linked public project pages. Public Instagram profile scans follow up to ten visible post/Reel links and JSON-only video references and extract direct video URLs from public JSON when exposed. Reel and story page links are not counted as playable video files. Other HTTPS portfolios import media exposed in their public HTML. A profile URL alone cannot guarantee access to every image or video; private posts, blocked pages and disabled embeds may be unavailable. Unsupported videos retain an original-source link.

## Verify and build

```bash
npm run lint
npm run typecheck
npm test --prefix server
npx expo-doctor
npx expo export --platform web
npx expo export --platform android
npx expo export --platform ios
```

Web export goes to `dist/`; host it with a single-page route fallback. `eas.json` contains build profiles. To create installable iOS and Android binaries, configure an Expo account, Apple/Google signing and store credentials, set the production API URL, then run `npx eas-cli@latest build --platform ios --profile production` and the equivalent Android command. No store accounts or signing credentials are included in this source.

## Structure

- `src/app/`: Expo Router screens; `src/components/`: shared UI and craft icons; `src/lib/api.ts`: API client.
- `server/src/`: Express API and SQLite schema; `server/test/`: core workflow integration test.
- `assets/demo/`: illustrative sample photos used in the demo and welcome artwork; `src/data.ts`: category names and demo content.
- `supabase/migrations/`: an earlier alternative schema prototype. The running app uses the Node/SQLite API.

## Before a public launch

This is a working full-stack MVP, not a deployed service. A production rollout still needs hosting, domain and TLS, app store accounts, backup and monitoring, password reset and email ownership confirmation, abuse reporting/moderation, legal review of privacy and consent text, and real-device accessibility and security review. The review process is human-operated; there is no automatic face match or liveness provider. Public profile links are supplied by their owners, and some external sites may block automated HTML access or direct image embedding. Verify ownership claims independently before approving them.

## Creative marketplace workspace

- Creators: registration → profile setup → portfolio import and curation → opportunities → application conversation → accepted and confirmed collaboration.
- Hiring teams: browse work → save creators → named project shortlists and comparison → publish a multi-craft brief or send an invitation → discuss scope in the inbox → confirm collaboration.
- Profiles include specialties, experience, rates, self-reported credits and dated availability. Date selection uses native calendar pickers on Android/iOS and the browser calendar on web. Optional numeric daily rates are in INR; the discovery budget filter uses that field. Unset rates and dates do not match those filters.
- Portfolio curation supports cover selection, captions/contributions, ordering and hiding imported items. Preferences are stored separately from imported rows so refreshing an unchanged source preserves curation. If a provider changes a media path, that item may need to be curated again. Only available media URLs are stored; files remain on their source platforms.
- Named shortlists support a read-only sharing link. Anyone with the link sees only public creator profiles and the project name. Reset sharing revokes the previous link. On Expo Go a sharing link targets the development app; deploy the web app for public browser links.
- Applicants and hiring teams can reply in private conversations. A team reviews applications; a creator reviews invitations. Accepted conversations can be marked as confirmed by the hiring team. Confirmation is a workflow status; contracts and payments are handled outside the app. The inbox refreshes every 15 seconds while focused.
- Following appears in Community; creator activity counters reflect followers, saved profiles, inquiries and confirmed collaborations. Saved searches show current match counts in Discover. No automated email alerts or paid subscriptions are enabled.
- SQLite schema additions migrate automatically on server startup, preserving existing profiles and imported media. Restart the API after updating and restart Expo with `npm start -- --clear --lan` to load the font package.

Validation: `npm run lint`, `npm run typecheck`, `npm test --prefix server`, and `npx expo export --platform web --platform android`. The marketplace integration test covers curation after refresh, filters, cross-account access, sharing-link revocation, applications, replies, confirmation, and account cleanup.

Community is the first navigation destination and signed-in landing page; Overview is second. The creator feed includes public text updates, persistent likes and comments, a Following filter, profile shortcuts, suggested creators, and open project briefs. A desktop three-column layout collapses to a single column on mobile. Portfolio spotlights are labelled and use existing creator work when the feed is empty.

The welcome account section and sign-in/register page include a three-row looping craft photo gallery, with alternate scrolling directions, pause controls, hover/focus pause, and reduced-motion support.
