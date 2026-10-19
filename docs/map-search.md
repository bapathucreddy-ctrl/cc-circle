# Map display and location search

**Superseded by the Google Maps migration.** Current setup and validation: [google-maps-setup.md](google-maps-setup.md). The Mappls details below are historical.

Both apps render **Mapbox Standard** (`mapbox://styles/mapbox/standard`) with 3D objects, buildings, trees, landmarks and place labels. The Dawn/Day/Dusk/Night controls update basemap lighting; the initial lighting follows the app's light/dark mode. Other app surfaces keep the existing monochrome theme. Discovery opens at zoom 15.5/pitch 55; tracking uses zoom 17/pitch 65. Aerial remains available; location picking starts overhead at zoom 16. Detail and landmark coverage depend on Mapbox's data for each area, so Bengaluru will not contain every landmark shown in the Munich reference.

Routes use the Standard middle slot and a contrasting black/white line. Existing professional craft pins, scooter tracking, red destination marker, routing and attribution remain. Current dependencies support Standard (`mapbox-gl` 3.32 and native Mapbox SDK 11.23.1 via `@rnmapbox/maps` 10.3.7). Android/iOS need a development build, not Expo Go.

Location search now uses **Mappls Autosuggest** for home, discovery, booking and event venues. Mapbox search endpoints are no longer called. Searches are debounced, biased around the current coordinates, scoped to India and limited to ten displayed places. Mappls documents a maximum query length of 45 characters. Include the area/city for common hotel or apartment names. Selecting a suggestion resolves its Mappls PIN through Place Details when coordinates are absent. A result without usable coordinates cannot silently become a booking pin. GPS and Choose on map remain available; users can name their manually selected entrance.

The authenticated Supabase function `location-search` proxies both operations. The Mappls key stays on the server; client responses contain only names, addresses, PINs and permitted coordinates. Arbitrary upstream URLs and suggested-search hyperlinks are never followed. Provider errors are sanitized. The function has per-worker burst protection; also configure provider account quotas. This is not a distributed rate limit.

Geocoding fallback (16 October 2026): if Place Details has no coordinates, resolution now calls Mappls Geocoding at `/search/address/geocode` with the selected place's address and India region. Both single-object and array `copResults` responses are supported. A coordinate result must match the selected Mappls PIN so a broad road/city match cannot silently replace a hotel/apartment. The mobile resolve request also supplies the selected address if Place Details is denied. This update is deployed; TypeScript and all 25 mobile tests pass. A live Geocoding check returned HTTP 200 and five results, but no latitude/longitude fields with the current key. Geocoding therefore also needs coordinate entitlement for automatic pin placement. The temporary protected diagnostic was removed after testing.

## Mappls setup

1. Create/sign in to the [Mappls developer console](https://auth.mappls.com/) and create a cloud/server application.
2. Enable **Autosuggest**, **Place Details** and **Geocoding**. Request latitude/longitude access for both Place Details and Geocoding; a basic key may return names/PINs without coordinates. Confirm your plan permits storing selected service venues and showing results on the app's Mapbox map.
3. Put the current API's server-side **static key** in `supabase/.env`:

   ```dotenv
   MAPPLS_ACCESS_TOKEN=your_static_key
   ```

   Keep this file local and ignored. Never use an `EXPO_PUBLIC_*` variable for this key. The current implementation uses Mappls's documented static-key endpoints, not the legacy OAuth endpoints. If your account supplies only legacy OAuth client credentials, obtain a current static key or adapt the server authentication flow.
4. Set the same secret in Supabase Dashboard → CC Circle → Edge Functions → Secrets, with name `MAPPLS_ACCESS_TOKEN`. Alternatively, use Supabase CLI `secrets set --env-file` with a local file containing only this key. Do not paste it into chat.
5. `location-search` is already deployed to CC Circle (`jssxdolqlnharkxatvqe`). No database migration or native dependency change is needed. If redeploying elsewhere:

   ```powershell
   supabase functions deploy location-search --project-ref YOUR_PROJECT_REF --no-verify-jwt
   ```

   The function verifies the caller with Supabase Auth internally, including projects using current signing keys. The public gateway JWT check is disabled in `config.toml`; this does not make search anonymous.
6. Reload the app, open Change location, search a known hotel/apartment plus Bengaluru, select it and check the entrance pin. Repeat in booking and event venues. If coordinates are restricted, enable that entitlement or use Choose on map. Avoid strict IP restrictions unless your server egress is fixed and configured accordingly.

Hosted credential verification (16 October 2026): MAPPLS_ACCESS_TOKEN is now configured in Supabase. A proof-protected, temporary server diagnostic called Autosuggest successfully (HTTP 200, ten suggestions for Taj MG Road Bengaluru). Place Details returned HTTP 200 with only address/name/eloc; neither suggestions nor details contained coordinates. Enable the Location Coordinates entitlement/subtemplate on the Mappls account before automatic pin selection can work. One successful backend request confirms the current key was accepted from that execution; it does not establish a fixed Supabase egress IP or guarantee future IP restrictions. The diagnostic function was removed after checking. Key values were never read out or returned. Mapbox Geocoding v6 had been the main source of the old missing hotel results: it does not contain POIs. A separate live check found Taj MG Road with Mapbox Search Box, despite the older geography list in its API reference; this does not affect the user's chosen Mappls integration.

References: [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/), [Mappls Autosuggest](https://developer.mappls.com/documentation/sdk/rest-apis/mappls-maps-auto-suggest-api-example/Readme/), [Mappls Place Details](https://developer.mappls.com/documentation/sdk/rest-apis/mappls-maps-place-details-api-example/Readme/).

Text Search verification (16 October 2026): tested the current /search/places/textsearch/json endpoint with the configured hosted key. Taj MG Road Bengaluru returned HTTP 200/nine suggestions; Prestige Shantiniketan Bengaluru returned HTTP 200/ten suggestions. No latitude, longitude, lat, lng, lon, coordinates or geometry fields were present in the inspected responses. The official Text Search response specification lists names/addresses/PINs and does not promise raw coordinates for every account. No Text Search fallback was added because these live responses cannot supply booking coordinates. Temporary diagnostic removed. Documentation: https://developer.mappls.com/documentation/sdk/rest-apis/mappls-textsearch-api/readme/
