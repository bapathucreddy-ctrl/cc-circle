# Circle Android updates

Latest builds: 21 October 2026.

| App | Version | Size | Download |
| --- | --- | --- | --- |
| Customer | 0.1.14 / code 15 | 56.24 MB | [APK](Circle-Customer-0.1.14.apk) |
| Professional | 0.1.19 / code 20 | 56.07 MB | [APK](Circle-Professional-0.1.19.apk) |
| Admin | 0.1.0 / code 1 | 0.09 MB | [APK](Circle-Admin-0.1.0.apk) |

These builds retain the existing package IDs and signing keys and update the previous releases. The customer app includes compact map controls, a collapsed nearby list, admin-uploaded banners and configurable multi-profession Festive picks.

TypeScript and 157 mobile tests passed. Signatures, native modules, original logo, 32-bit and 64-bit ARM support, production bundles and 16 KB alignment were checked. Physical-device installation and runtime testing remain unverified.

[Release validation](../previews/mobile-admin-release-validation.json)

Circle Admin installs separately. Sign in with the approved email `chetan.reddy@cclabs.space`, verify ownership, then upload a banner and select professions/services under **Festive picks**. The selected cards appear in the customer app within 30 seconds while open. It packages the panel and requires no localhost server. Native OAuth and file-picker behavior have not yet been checked on a physical phone.
