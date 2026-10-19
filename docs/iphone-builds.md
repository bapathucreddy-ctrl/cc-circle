# Circle iOS builds

The active project IDs are saved in the ignored mobile/.env. Updating an example file alone does not configure Expo. The customer Expo project is @chiketan/circle and the professional project is @chiketan/circle-profession. Native bundle IDs, callback schemes and logos remain unchanged.

## Simulator builds without paid Apple signing

The owner confirmed there is no paid Apple membership and requested EAS simulator builds. Separate development-client profiles customer-simulator and professional-simulator have ios.simulator=true. These produce simulator app archives, not iPhone-installable IPA files.

On 17 October 2026 both builds succeeded:

- [Customer build](https://expo.dev/accounts/chiketan/projects/circle/builds/0e9ab228-fca3-4d25-8851-28092a43ae04)
- [Professional build](https://expo.dev/accounts/chiketan/projects/circle-profession/builds/172f493d-1eb2-4805-90c4-0be453d2b14c)

Downloads and installation notes are in [artifacts/ios](../artifacts/ios/README.md). Build status, artifact URLs and archive verification are recorded in customer-build.json and professional-build.json there. Compilation succeeded; native runtime testing has not been performed.

The local portable EAS CLI is installed under .local-tools/eas-client. From mobile/ in PowerShell:

```powershell
.\run-eas.cmd customer whoami
.\run-eas.cmd customer login
.\run-eas.cmd customer project-info
.\run-eas.cmd professional project-info
.\run-eas.cmd customer simulator
.\run-eas.cmd professional simulator
```

The launcher loads mobile/.env explicitly and sets both app-variant flags. The example IDs have been activated and verified against the signed-in Expo account. Slugs match the registered projects. Cloud workers also accept EAS_BUILD_PROJECT_ID as a fallback. The helper env-development action synchronizes an explicit allowlist of public Supabase/Mapbox settings and the matching project ID into that project's development environment. Server credentials are excluded. This synchronization has already been completed for both projects.

## Run the development client

A local iOS Simulator needs macOS/Xcode. After a successful build, download and extract its simulator archive, then drag the Circle.app bundle into a running compatible Mac iOS Simulator. Customer/professional apps have different bundle IDs and can coexist.

Start the corresponding Metro server from mobile/ on this computer:

```powershell
.\run-device.cmd customer
# In another terminal, if needed:
.\run-device.cmd professional
```

Open the installed development client and connect to the development server. A Mac on another computer needs access to this computer's LAN address and port 8081 (customer) or 8082 (professional). Expo Go does not contain the required native map/payment modules. These simulator clients need Metro for application JavaScript; the existing standalone Android APKs do not.

EAS also offers remote simulators. The account's simulator-availability check returned available=false on 17 October 2026. Remote running from Windows cannot proceed until that access is enabled: [Expo simulator access](https://expo.dev/services/simulators). No remote session was started and no runtime test is claimed.

## Physical iPhone

An EAS build for a physical iPhone still needs paid Apple Developer signing and device registration. The existing customer-development/professional-development and preview profiles remain device profiles; simulator profiles do not replace them. Simulator archives cannot be installed on an iPhone. A Mac with Xcode can use a free Apple ID for a local personal-device development build, subject to Apple's provisioning restrictions.

No Apple passwords or signing keys should be placed in environment files or chat. Signing is separate from the Expo project IDs.

References: [EAS simulator builds](https://docs.expo.dev/build-reference/simulators/), [development build options](https://docs.expo.dev/develop/development-builds/introduction/), [iOS Simulator and remote simulator support](https://docs.expo.dev/workflow/ios-simulator/), [device signing](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/).
