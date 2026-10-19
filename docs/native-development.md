# Run CC Circle on an Android phone

For standalone iPhone apps, see [iPhone signing, device registration and builds](iphone-builds.md). The customer and professional preview profiles explicitly disable the development client and target physical iOS devices; an Apple-signed cloud build is still required.

## Standalone release APKs

Current releases: **customer 0.1.4 (Android code 5)** and **professional 0.1.9 (Android code 10)**. Professional background location requires RECEIVE_BOOT_COMPLETED for persisted TaskManager jobs; see [confirmed crash and fix](android-location-crash.md). Install over the previous signed release; signing keys and package identities are unchanged. See [background GPS and loading improvements](live-professional-location.md), plus the earlier [location, keyboard, splash and event fixes](location-and-event-fixes.md).

Professional background GPS requires this rebuilt APK. Go online, tap Allow background location on Work/Profile, and grant Always / Allow all the time. Android shows an ongoing sharing notification. Going offline stops the service. Customer builds do not request background access. Device battery restrictions and force-stop can interrupt updates; physical-device background validation is pending.

Download [Customer APK](../artifacts/android/CC-Circle-Customer.apk) and [Professional APK](../artifacts/android/CC-Circle-Professional.apk). [Installation, verification and checksums](../artifacts/android/README.md). Both are signed local release builds.

Standalone release builds embed the JavaScript bundle and native Mapbox/Cashfree modules. They run directly after installation and do not need Expo Go, the Expo development launcher, a running Metro server, or the computer's Wi-Fi connection. Internet access is still required for sign-in, maps, bookings and payment.

The app variants have independent Android packages and signing keys:

| App | Package | Launcher icon | EAS APK profile |
| --- | --- | --- | --- |
| Customer | `com.cccircle.customer` | Black CC mark on white | `customer-apk` |
| Professional | `com.cccircle.professional` | White CC mark on charcoal | `professional-apk` |

Both launcher names remain CC Circle. The APK profiles explicitly use `developmentClient: false` and Android `buildType: apk`. They are separate from the development profiles documented below; production store profiles continue to produce store bundles.

Local release tooling and signing credentials are kept in the ignored `.local-tools/android-release/` directory. Preserve its `signing/` directory to sign future updates with the same keys. Signing passwords and private keys must stay outside source control and APK download folders.

If an older development APK uses the same package but another signing key, Android requires uninstalling that old installation before installing the new release; this clears that installation's local session. Server accounts/bookings remain in Supabase.

## Why Expo Go shows the red screen

The app uses native Mapbox maps and a custom native Cashfree payment SDK. Expo Go does not include those modules. A JavaScript reload cannot add the required native code/configuration. Install a CC Circle **development build**, which includes this project's native modules.

The app entry now checks Expo's `isRunningInExpoGo()` before importing `App`. Expo Go shows a setup screen instead of importing Cashfree and crashing. Web and installed development builds still load the full app. This safeguard does not add native maps or payments to Expo Go.

Mapbox rendering and directions are retained. Google Places is used only by the backend for search/coordinates; see [current search setup](google-maps-setup.md). If you built the temporary Google-map-native variant, build a Mapbox development APK again. Otherwise use the matching Mapbox development build.

## 1. Create an Expo account and projects

Create/sign in to an account at [expo.dev](https://expo.dev/signup). In the dashboard, create projects for the two app variants:

| Variant | Project slug | Android package | EAS build profile |
| --- | --- | --- | --- |
| Customer | `cc-circle` | `com.cccircle.customer` | `customer-development` |
| Professional | `cc-circle-pro` | `com.cccircle.professional` | `professional-development` |

Copy each project's **Project ID** from its settings. These UUIDs are project identifiers, not passwords. `app.config.ts` reads `EAS_CUSTOMER_PROJECT_ID` or `EAS_PROFESSIONAL_PROJECT_ID` to link the selected variant. Neither ID is preconfigured because an Expo account/project has not been provided.

## 2. Set EAS development environment variables

For **each** Expo project, open its Environment Variables settings and create these values for the **development** environment, using the existing matching values in `mobile/.env`:

- `EXPO_PUBLIC_SUPABASE_ONLINE` = `true`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_KEY` (or the supported `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (existing public Mapbox token).
- Customer project: `EAS_CUSTOMER_PROJECT_ID` = its Project ID.
- Professional project: `EAS_PROFESSIONAL_PROJECT_ID` = its Project ID.

Use plain text visibility for these client configuration values/project IDs so EAS can resolve the dynamic config locally and during cloud builds. Keep service-role keys, Cashfree secrets, OAuth secrets and server-only tokens in Supabase, outside the app. Keep `GOOGLE_MAPS_SERVER_KEY` only in Supabase secrets for Places search. No Google map SDK/client key is used.

The existing development profiles already select the correct app variant. Do not add a conflicting `EXPO_PUBLIC_APP_VARIANT` to a shared EAS environment. The local `.env` is intentionally excluded from the uploaded build archive; cloud builds therefore need these EAS environment settings.

## 3. Prepare PowerShell

From the repository root:

```powershell
cd mobile
$env:Path = (Resolve-Path '..\.local-tools\node-v24.21.0-win-x64').Path + ';' + $env:Path
$env:EAS_NO_VCS = '1'
npx eas-cli login
```

This uses the existing portable Node and makes `npm`/`npx` available in this terminal. `EAS_NO_VCS` supports this source package without Git. No global PATH changes are made.

Set the project IDs copied from the dashboard, replacing both placeholders:

```powershell
$env:EAS_CUSTOMER_PROJECT_ID = 'YOUR_CUSTOMER_PROJECT_UUID'
$env:EAS_PROFESSIONAL_PROJECT_ID = 'YOUR_PROFESSIONAL_PROJECT_UUID'
```

You can also save those two IDs in the existing ignored `mobile/.env` for later local launches. Preserve the existing Supabase values and retain the public Mapbox token; the Google Places key stays on the server. `.env.example` documents the optional ID names; do not replace your real `.env` with the example.

## 4. Build the customer development APK

```powershell
$env:CC_APP_VARIANT = 'customer'
$env:EXPO_PUBLIC_APP_VARIANT = 'customer'
npx eas-cli build --platform android --profile customer-development
```

If asked about Android signing, let EAS generate/manage the development signing credentials. Wait for the build, open its install link on the Android phone and install the APK. Native compilation happens in EAS, so Android Studio/Java/ADB are not needed on this computer for this route.

The project has an explicit `.easignore` excluding existing generated `android/ios` directories, dependencies, build outputs and local environment files. EAS generates fresh native projects using the selected package and configured plugins. The older `mobile/android` project is left untouched and is not uploaded; it predates the app split.

## 5. Connect the installed app

Keep your computer and phone on the same Wi-Fi. From `mobile/`:

```powershell
.\run-device.cmd customer
```

Open the **installed CC Circle development app** and scan/connect to the displayed server. Use its development launcher, not Expo Go. The launcher uses portable Node, selects the customer identity, clears Metro's cache and targets port 8081. If another server is already using that port, stop that specific server or reuse its matching development-build session; do not connect a customer build to a professional session.

## 6. Build/run the professional app

In the prepared PowerShell terminal, still in `mobile/`:

```powershell
$env:CC_APP_VARIANT = 'professional'
$env:EXPO_PUBLIC_APP_VARIANT = 'professional'
npx eas-cli build --platform android --profile professional-development
```

Install that APK from its EAS build link, then run:

```powershell
.\run-device.cmd professional
```

This development variant uses port 8082 and a separate Android package/session. Both app display names remain CC Circle as requested. The customer launcher icon has a white background; the professional launcher icon has a charcoal background.

## Validation limits

Startup selection is tested so Expo Go never imports the native-only app, while native builds/web still do. Local Android tooling is now installed under the ignored `.local-tools/android-release/` directory, and standalone release APK preparation uses isolated native projects for the two variants. EAS accounts/projects are needed only for the optional cloud-build workflow, not for installing a locally built standalone APK. Native compilation and binary verification do not establish physical-device or live-payment behavior; device testing remains required.

Official references: [Mapbox Expo installation](https://github.com/rnmapbox/maps/blob/main/plugin/install.md), [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/), [EAS first build](https://docs.expo.dev/build/setup/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/), [EAS archive ignores](https://docs.expo.dev/build-reference/easignore/).
