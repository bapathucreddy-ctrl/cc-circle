# Google Places search with Mapbox maps

Current requested architecture:

| Responsibility | Provider |
| --- | --- |
| Hotel/apartment/address suggestions | Google Places API (New) Autocomplete |
| Selected place latitude/longitude | Google Place Details (New), requesting id/location |
| Map rendering, 3D buildings and lighting | Mapbox Standard |
| Live craft/scooter/red destination markers | Existing app markers on Mapbox |
| Routes, distance, ETA and navigation instructions | Mapbox Directions |

This supersedes the earlier full Google Maps migration. Google map SDKs, map IDs, browser map keys and Google Routes are no longer used. The native Mapbox plugin and dependencies are restored. Google OAuth sign-in credentials remain separate from Places API access.

## Set up Google search

1. Open your existing [Google Cloud project](https://console.cloud.google.com/) and attach billing.
2. Enable **Places API (New)**. This implementation does not call Maps JavaScript API, Maps SDK for Android/iOS or Routes API.
3. Open APIs & Services ? Credentials ? Create credentials ? API key.
4. Restrict the key to **Places API (New)**. Keep this server key out of client code. Supabase Edge Functions have dynamic outgoing IPs; leave application restrictions as None unless fixed egress has been arranged. Configure quotas and billing alerts as appropriate.
5. In Supabase ? CC Circle ? Edge Functions ? Secrets, add the key with name **GOOGLE_MAPS_SERVER_KEY**. The project is jssxdolqlnharkxatvqe. The authenticated location-search function is already redeployed for suggestions and coordinate resolution only.
6. Keep **EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN** in mobile/.env and in the existing EAS environments for both app variants. Its existing public Mapbox token is still used for map rendering and directions. No Google client/browser/native map key is needed.
7. Reload the app and test Change location ? search ? select ? verify the Mapbox pin, then booking route/distance/ETA. New APKs are needed if a Google-maps-native build was installed; a compatible Mapbox development build can continue using its matching native modules. Expo Go still cannot run native Mapbox/Cashfree.

The local server-key example belongs in supabase/.env, never mobile/.env:

```dotenv
GOOGLE_MAPS_SERVER_KEY=your_places_api_key
```

Do not paste keys into chat. Existing Google sign-in client ID/secret cannot substitute for this Places API key.

## Search behavior

The app opens a fresh UUID session when the location dialog opens. Autocomplete requests and the selected Place Details request share that token. Search remains biased around the current map point and restricted to India. Google latitude/longitude are converted to the app's longitude/latitude coordinate tuple, passed through the existing location callbacks and used for the Mapbox center/booking destination. Results and search sessions are not cached to device storage. Google attribution is shown in the search list; Mapbox retains its map attribution. GPS and named manual pins remain available.

## Provider restrictions

This implements the user's explicitly requested technical combination. Google's standard Places policies require Places results displayed on a map to use a Google map. That restriction was explained in the conversation; this code change does not establish an exception or make the combination approved for production. Confirm applicable provider permission/terms before deployment to end users. Also review storage/retention rules for Google-derived booking coordinates and addresses before production; no retention job/place-ID persistence was added here.

## Validation

TypeScript and 25 mobile tests pass, covering Google sessions, coordinate lookup/order, provider errors, the Mapbox native plugin and Mapbox directions independent of Google. Customer/professional Android/iOS/web exports also pass. An isolated browser fixture confirmed mocked Google search coordinates flow into an actual Mapbox map, 3D/dusk controls and named pin confirmation work, and there is no map error or horizontal overflow. No live Google calls or booking mutations occurred. Live verification (16 October 2026): GOOGLE_MAPS_SERVER_KEY is now configured in Supabase. A temporary proof-protected server check using the production Places functions returned four autocomplete predictions for Taj MG Road Bengaluru and valid selected-place coordinates in the Bengaluru area. The same session token was used for autocomplete and details. No key values were returned. The temporary diagnostic was removed. This verifies provider access and coordinate parsing; authenticated app/device behavior still needs a user smoke test.

References: [Google Autocomplete sessions](https://developers.google.com/maps/documentation/places/web-service/using-session-tokens), [Google Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details), [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Mapbox Standard](https://docs.mapbox.com/map-styles/reference/standard/).

## Latest map layout and token check

The title/recenter, camera/lighting controls, instructions and tracking status now sit outside the map viewport; compact lighting expands below it. All viewports are at least 300px high. Mobile browser layout checks passed at 393px and 320px; TypeScript and both Android/iOS/web exports pass. During this check Mapbox Standard and vector-tile requests returned HTTP 401 with Invalid Token. Replace EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in the ignored mobile/.env with a valid public Mapbox token, then restart Expo. This is independent of the working Google Places server key. Live map-tile rendering was not verified successfully in this layout check.
