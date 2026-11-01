# Artist House 0.2.1

Customer code 20, Professional code 23 and Admin code 9 retain their original package identifiers and signing certificates. Existing authentication storage and OAuth schemes are unchanged.

## Included

- Home service search with live suggestions, common typo tolerance, prefixes, occasion aliases and admin-managed labels/photos. Wedding suggestions span photography, bridal/groom/guest makeup, hair, reels and film editing. Selecting a suggestion opens nearby professionals for its stable service key.
- Private registered professional home addresses, 5–10 km online-first discovery and approximate offline/busy markers.
- First-name public identity, required photographer equipment and relevant editing-software selections.
- Searchable map pin selection.
- Admin Requests tab with original bulk requests, professional responses and final approval. Professional acceptance alone creates no confirmed booking.
- Individual portrait screening and exact-photo admin review.

Existing professionals need to complete their registered home address and new required profile fields. Offline bases cannot be inferred from their previous GPS location. Unreviewed portraits remain private until review.

## Installation

Install the matching APK over its existing app. Do not uninstall first if you want to retain the local session. Android still requires matching package/signing identity and sufficient device storage. Runtime and real push delivery must be checked on a physical device.

## Deployment

The backend migration and portfolio function must be deployed together with these clients. Detailed rollout behavior: [Professional discovery and bulk approval](professional-discovery-and-bulk-approval.md).

Production migration and portfolio deployment completed on 31 October 2026. Package/certificate/source-bundle checks passed for all three APKs. Firebase-hosted privacy publication completed and the live page was verified against the updated source. Physical-device operation remains untested.
