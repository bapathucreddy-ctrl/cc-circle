# Approved close-up craft navigation

The newer Circle branding/notification release preserves this navigation: customer0.1.5/code6 and professional0.1.10/code11. See [current APKs](../artifacts/android/README.md) and [notifications](notifications-and-circle.md). The version/hash records below describe the original navigation release.

17 October 2026: professional 0.1.9 / Android code 10; customer 0.1.4 / code 5.

Both apps use the approved extreme close-up: Mapbox Standard at zoom 20.4, pitch 70, with space ahead of the rider. The booking map is taller for an immersive road view. Aerial remains available.

All seven crafts have matching rear-facing 3D-style white scooters. The profession badge replaces the rider's head rather than floating beside the vehicle:

| Craft | Head symbol | Asset |
| --- | --- | --- |
| Makeup | Lipstick and brush | `rider-3d-makeup.png` |
| Actor | Comedy/tragedy masks | `rider-3d-actor.png` |
| Photographer | Camera | `rider-3d-photographer.png` |
| Editor | Clapperboard and timeline | `rider-3d-editor.png` |
| Dancer | Dancing silhouette | `rider-3d-dancer.png` |
| Hair stylist | Scissors and comb | `rider-3d-hairstylist.png` |
| Content creator | Phone on gimbal | `rider-3d-contentcreator.png` |

An eighth neutral creative-spark rider is the loading/unknown-category fallback. Images are in `mobile/assets/brand/`. They are transparent rendered sprites, not live 3D meshes. Native image decoding resizes for their displayed dimensions. Discovery pins use the same craft family.

The scooter stays upright in follow mode while the camera/road turns under it. Manual rotation is disabled in follow; Aerial permits rotation and uses a small direction pointer independently of the upright rider. The rear wheel anchors to the map position. Native and web use the same camera and marker dimensions. This removes the upside-down side-view scooter problem.

Nearby GPS offsets may be visually projected onto the current route within 35 metres. Distant points remain at their measured location; published GPS is never changed. The first delayed route/GPS bearing can initialise direction while stationary, and movement supplies direction when both course and route are unavailable. Existing background booking publication, payment/OTP gates and optional Google Maps handoff remain.

TypeScript and all 78 mobile tests pass. This includes actual native component rendering across all seven categories and cardinal bearings, fallback/aerial behavior, PNG dimensions/alpha format, route proximity and missing/delayed bearing behavior. All eight images were visually reviewed together and their alpha sampled in a browser. The public sample-route preview is not a physical Android road test. Build metadata records the native verification separately.

## Artwork provenance

The approved makeup asset was preserved. The other six craft variants and neutral fallback were generated using built-in `image_gen` edits of that image, preserving the scooter and changing its head symbol. All originals were retained and final images copied into the project. See the [all-craft visual sheet](../artifacts/previews/all-craft-3d-scooters.png), [exact edit prompts](../artifacts/previews/craft-scooter-generation.json), and [original generation prompt](../artifacts/previews/navigation-3d-closeup.md).

No backend migration or booking/payment/OTP action is needed for this release. A powered-off phone cannot send GPS; background location remains subject to the existing consent, online preference, network and OS scheduling rules.
