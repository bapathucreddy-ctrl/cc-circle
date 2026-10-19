# Circle Android releases

Latest verified builds: 19 October 2026.

| App | Version | APK size | Download |
| --- | --- | --- | --- |
| Customer | 0.1.10 / code 11 | 82.96 MB | [Customer APK](Circle-Customer.apk) |
| Professional | 0.1.15 / code 16 | 82.96 MB | [Professional APK](Circle-Professional.apk) |

APK binaries are generated locally and excluded from Git. Metadata and SHA-256 checksums are in `customer-build.json` and `professional-build.json`. Versioned copies are retained alongside the current filenames.

Both are signed standalone production builds for Android 7.0+ (minimum SDK 24), containing both `armeabi-v7a` and `arm64-v8a`. Native Mapbox, Cashfree, notifications, image manipulation and role-specific background-location support were checked. Original signing certificates and 16 KB alignment are preserved.

These builds include the single-C-and-dot logo in the app, splash, launcher and notification icon, copyright and creator credits, keyboard-aware forms, and prior dashboard/profile updates. Asset optimization and R8 shrinking reduced APK size by approximately 51% without removing a phone architecture.

TypeScript and 139 mobile tests pass. Both iOS JavaScript exports pass. These checks do not establish physical-device, live-payment or native iOS runtime behavior; the latest APKs have not been tested on a phone.

[Full validation record](../previews/optimized-release-validation.json)
