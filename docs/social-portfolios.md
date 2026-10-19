# In-app photo and video portfolios

Customers browse up to ten work samples inside CC Circle. No external-profile buttons or account handles appear in the gallery. YouTube uses its official embedded player; channel branding and watermarks can still reveal identity. This feature cannot promise anonymity. Professionals choose a public professional/studio name rather than being asked for an original/legal name.

Direct uploads work independently of social credentials: JPG, PNG, WebP, MP4 and MOV, up to 25 MB each. The server creates a private `portfolio-work` bucket on the first upload. Scoped signed upload tokens and signed viewing URLs keep unpublished work restricted to its owner. Upload only work you own and may publish.

## Your existing YouTube OAuth setup

1. In Google Cloud, enable **YouTube Data API v3** for the existing OAuth project's API library.
2. In its **Web application** OAuth client, add this exact authorized redirect URI:
   `https://jssxdolqlnharkxatvqe.supabase.co/functions/v1/portfolio-callback`
3. Allow `https://www.googleapis.com/auth/youtube.readonly` on the consent screen. While in Testing, add the Google accounts that own the test channels as test users. Follow Google's verification process before broader use when required.
4. In **Supabase → Project Settings → Edge Functions → Secrets**, add `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` using this client's values. Keep secrets in Supabase; never paste them in chat or put them in `mobile/.env`.
5. `PORTFOLIO_TOKEN_KEY` must also be configured as 32 random bytes encoded with Base64. The workspace setup provisions this independently; do not overwrite an existing key, since it encrypts stored provider tokens.
6. Open CC Circle's professional app → Profile → Connect your work → **Connect YouTube & import videos**. Authorize the channel owner, then return to the app. We select up to ten public, embeddable videos from that account's uploads, rather than accepting someone else's channel URL.

Supabase's existing Google login credentials do **not** automatically become Edge Function secrets. Adding these settings leaves customer sign-in unchanged. YouTube authorization may have to be renewed to refresh an import; no downloaded YouTube video files are stored. Videos that cannot be embedded are skipped.

## Instagram setup (not configured yet)

### Generated-token test (16 October 2026)

The locally supplied test token was accepted by Facebook Graph, with `instagram_basic` and `public_profile` granted. Instagram Login requests to `graph.instagram.com` returned HTTP401 / code190 (Cannot parse access token). This is a login-product mismatch; the test did not establish Instagram media access or import any portfolio items. No tokens, account identifiers or media URLs were printed, no files were downloaded, and the token was not uploaded to Supabase.

This app implements **Instagram API with Instagram Login**, which uses `instagram_business_basic`, rather than the Facebook Login `instagram_basic` scope. Generate the token from that Instagram Login setup for a Business/Creator account, then replace the value of `INSTAGRAM_TEST_ACCESS_TOKEN` in the ignored `supabase/.env`. The local diagnostic is `.local-tools/check-instagram-token.cjs`, run with the workspace's portable Node. Never put test tokens in `mobile/.env`, commits, screenshots or chat. A test token does not replace the App ID/App Secret required for each professional's OAuth connection below. [Meta's Instagram Login reference](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login).

### Configure professional account connections

1. Create a Meta developer app with **Instagram API with Instagram Login**.
2. Configure Instagram business login with the same callback URI above. Use the Instagram app's ID and secret for `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET` in Supabase secrets.
3. Request `instagram_business_basic`. Use a Business or Creator Instagram account and the appropriate app/tester roles during development. Personal consumer accounts cannot be imported through this integration. Complete Meta's required access/app review before making connections broadly available.
4. Match `INSTAGRAM_API_VERSION` to a supported Graph API version for the app (default `v25.0`).
5. Use **Connect Instagram & import work**. The permission window belongs to the professional's setup; customers stay in the CC Circle gallery. Carousels are flattened into photo/video samples, capped at ten.

Tokens are encrypted on the server and never returned to clients. The server refreshes stale Instagram media URLs using the authorized API while the connection remains valid. Reconnect when access expires. Connecting a second source preserves up to five existing samples and fills the remaining slots from the new source. Disconnect removes that source's work from CC Circle; platform-level access can also be revoked in the provider's account settings.

There is no generic scraper for arbitrary professional websites. Add their original work files directly instead. Instagram is not silently scraped if API credentials/permissions are missing.

## Deployment and checks

Apply migrations `202610150004_hair_stylist_category` and `202610150005_portfolios_and_reviews` incrementally. Deploy `portfolio` and `portfolio-callback` (the latter accepts public OAuth redirects). `portfolio` verifies Supabase sessions inside the handler; the callback verifies an expiring, hashed, one-use OAuth state.

API metadata cached for YouTube must be refreshed or removed within the provider's retention window. The gallery suppresses entries older than 30 days. Schedule regular expired-import/token cleanup before a production launch; no production scheduler is configured in this prototype. No live account import is considered verified until the appropriate provider credentials and permissions have been configured and tested.

Sources: [YouTube owned-channel lookup](https://developers.google.com/youtube/v3/docs/channels/list), [YouTube playlist items](https://developers.google.com/youtube/v3/docs/playlistItems/list), [YouTube embedded player](https://developers.google.com/youtube/player_parameters), [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies), [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).

## Public profile URLs (requested alternative)

AnonyIG publishes a third-party [public Instagram API](https://anonyig.com/en/api/) using a server-side bearer key. Its documented posts endpoint accepts a username and advertises images, videos and carousels. This could support pasting a public Instagram profile URL and selecting up to ten work samples without redirecting customers to Instagram. This is an available integration option, not a tested or implemented feature in CC Circle. No provider key is configured.

Before adding it, validate live response fields/media URLs and the provider's allowed use, require the professional to confirm ownership/publication rights, enforce the existing ten-item limit, and keep profile handles/captions out of customer responses. A public URL alone does not verify who owns the work. Source watermarks can still reveal an Instagram identity. Use a fixed provider endpoint and validated Instagram URLs, never unrestricted server-side fetching of user-supplied URLs. Provider outages/limits must retain direct uploads as a fallback.
