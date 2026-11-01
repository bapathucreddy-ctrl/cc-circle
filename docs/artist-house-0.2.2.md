# Artist House 0.2.2

This release uses the supplied `artist-house-crafts-reveal.html` animation at startup in Customer, Professional and Admin. The animation and images are bundled locally; no network request is needed. The demonstration Replay control is hidden. Completion hands off to the existing app without altering authentication storage. A startup deadline prevents a failed animation from trapping users, and reduced-motion playback shows the completed artwork.

Professional registration now offers an optional Instagram connection beside the name details, using the existing OAuth and connection-status flow. Work uploads remain separate. Questionnaire examples, including “Moodboard, shot list, wardrobe or permissions”, appear inside empty fields as placeholders rather than separate input labels.

The release also includes the stacked Artist House header and craft-only professional markers from the preceding source changes. Scooters appear only while a professional is en route.

| App | Package | Version code | APK |
| --- | --- | --- | --- |
| Customer | com.cccircle.customer | 21 | ArtistHouse-Customer-0.2.2.apk |
| Professional | com.cccircle.professional | 24 | ArtistHouse-Professional-0.2.2.apk |
| Admin | com.cccircle.admin | 10 | ArtistHouse-Admin-0.2.2.apk |

Original release signing keys and authentication storage keys are retained. Install over the corresponding existing app; uninstalling is unnecessary.

Validation includes TypeScript, mobile and Admin regression tests, animation execution for normal/reduced motion, APK identity and original certificate checks, 16 KB alignment and bundled source matching. No physical-device startup or Instagram OAuth test was performed for this release.
