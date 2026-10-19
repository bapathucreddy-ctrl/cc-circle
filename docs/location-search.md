# Location selection

**Superseded by the Google Maps migration.** Current setup and validation: [google-maps-setup.md](google-maps-setup.md). The Mappls details below are historical.

Location search now uses Mappls, superseding the earlier Mapbox-only address search. Map display and routes remain Mapbox. See [map and search setup](map-search.md) for API access, server-secret configuration and current validation limits.

Home and Discover share the selected location during the app session. Booking and event venues use their own picker. Searches are debounced and cancelled when replaced. Selected Mappls PINs are resolved to coordinates before use; absent coordinate access produces an actionable error. GPS and named map-pin selection remain available.

Customer booking names come from the saved private full-name field. Professionals use their chosen public display/pen name. See [registration and name privacy](registration-and-names.md).
