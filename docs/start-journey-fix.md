# Start journey fix — 17 October 2026

Professional 0.1.5 / Android version code 6 fixes a reproduced silent cancellation in the booking screen. Customer remains 0.1.2 / code 3.

The user reported that Start journey loads and then does nothing. The action previously used the location watcher's cancellation counter. A temporary AppState change while acquiring GPS increments that counter, so the action returned before submitting the booking transition, without showing an error. A component regression reproduces this failure against the previous code.

The action now has its own cancellation counter, invalidated when leaving/changing the booking rather than when pausing location sharing. A synchronous pending guard prevents duplicate taps from submitting multiple transitions. GPS acquisition has a 20-second deadline with an actionable retry error; a late GPS result cannot start a journey after timeout. Leaving the booking before GPS completes still prevents a transition. Server rejection messages remain visible, and payment/active-job eligibility checks are retained on the server.

TypeScript and all 60 mobile tests pass, including four booking-screen regressions covering AppState changes during GPS, leaving the screen, GPS timeout/late results, duplicate taps and server errors. No backend or database change is required. An actual customer booking has not been started automatically during testing.

## Booking location follow-up: 0.1.6 / code 7

The connected professional 0.1.5 app showed Location not shared yet. Start journey discarded its first acquired GPS fix and the active journey waited for another unbounded native one-shot GPS request before even registering movement updates. Now it publishes the first fix after the server accepts en_route, refreshes booking/location even if publication fails, starts the movement watcher before its bounded 20-second one-shot lookup, and reuses the fresh first fix when available. Sharing becomes true only after a successful booking-location RPC. Booking location polling is five seconds; previous-booking local points are not reused. Two new component tests verify the initial booking write and movement publication while a one-shot request remains pending. All 62 mobile tests and TypeScript pass. Existing backend eligibility/privacy rules and customer APK remain unchanged.

Device verification (17 October 2026): professional0.1.6/code7 installed successfully with adb install -r, preserving app data; package version confirmed. Android UI automation could not become idle, so inspected a local screenshot instead: professional booking visibly shows Location recently updated, rider pin, highlighted route, remaining distance and recent timestamp. No booking status/payment/OTP action performed by agent. Release metadata marks this scoped physical check; full background-journey/service tests remain pending.
