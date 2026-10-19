# Location, launch and event fixes — 17 October 2026

Android release 0.1.1, version code 2. Both apps retain their existing package IDs and release signing keys, so the update can install over version 0.1.0 without clearing the app's local account session.

## Location search and startup

The location picker is now a full-screen, keyboard-aware view. Search stays at the top; results appear immediately below it in their own scroll area, ahead of the GPS/map/city actions. Android uses a height-adjusting keyboard container with the existing native `adjustResize` setting; iOS uses padding adjustment. Web follows visual-viewport changes. Result taps are handled while the input is focused, and dragging the results can dismiss the keyboard.

After account registration/sign-in, the customer app requests fresh device coordinates on entry and moves to them immediately. Mapbox reverse lookup then supplies the street/area/city label. “Use current location” in search and booking forms also resolves an address. The professional app uses device coordinates for the profile setup map and shows its current address in the live-sharing card. This does not enable background tracking or publish an offline professional's location.

When the customer returns to the foreground in GPS mode, the location refreshes. An explicitly chosen search result, map pin or city stays selected for that session. Pending GPS or address requests cannot overwrite that manual selection. A denied permission shows a request to choose a location, instead of labeling the default map area as current GPS. When reverse lookup fails, the label shows the actual coordinates. Coarse fixes use an area-level label and say they are approximate; an exact building or apartment is not inferred from an inaccurate fix.

Google remains responsible only for typed place search and result coordinates. Mapbox continues to provide maps, reverse lookup, routes and tracking.

## Map gestures and launch

Android Mapbox now asks surrounding views not to intercept map touch events, allowing pan/pinch gestures inside a scrollable screen. On web, wheel and touch-move events stay within the map viewport; scrolling outside the map still moves the page.

Native Android/iOS use the native launch screen only, held until layout and initial session restoration are ready and then faded out. The extra JavaScript logo animation is now web-only, avoiding two consecutive branded launch screens in the APK.

## Delete an event

Open Request → My events → Delete event. A confirmation explains that the event and its applications will be removed. “Keep event” makes no delete request. Failure leaves the event visible and retryable; success removes it from the list immediately.

The owner-only `delete_team_request` RPC locks the event row, serialising deletion with applicant acceptance. Event roles/applications are removed through their foreign-key cascades. Existing bookings, service times, invoices and payment records remain. Deleting a post does not cancel a confirmed booking or initiate a refund; manage those bookings separately in My bookings.

Migration `202610160010_delete_team_events` is deployed. All 24 migrations pass the hosted read-only deployment verifier. Database tests cover unauthenticated/other-customer/professional denial, discovery removal, stale acceptance/application rejection, cascade cleanup and preservation of accepted bookings.

## Validation

TypeScript, 42 mobile tests and 18 database tests pass. Browser fixtures verify stationary page scroll during map wheel/pinch, working scroll outside the map, event confirmation/cancel/failure/success behavior, startup GPS/address and permission-denied handling. At 393px width and 420px/320px viewport heights, the search field and first result remain visible, with no horizontal overflow; selection works while the input is focused. Fixture account/provider responses were mocked and no real event was deleted during UI checks.

Binary verification checks the embedded app identity and version, non-debug release signature, signing-key continuity, native Mapbox/Cashfree modules, embedded Hermes code, policies and alignment. Native phone keyboard/pinch behavior and end-to-end payment still need physical-device validation. Payments remain sandbox.
