# Circle iOS simulator builds

Both EAS builds succeeded on 17 October 2026:

| App | Version | Archive | EAS build |
| --- | --- | --- | --- |
| Customer | 0.1.5 (1) | [Circle-Customer-Simulator.tar.gz](Circle-Customer-Simulator.tar.gz) | [Customer](https://expo.dev/accounts/chiketan/projects/circle/builds/0e9ab228-fca3-4d25-8851-28092a43ae04) |
| Professional | 0.1.10 (1) | [Circle-Professional-Simulator.tar.gz](Circle-Professional-Simulator.tar.gz) | [Professional](https://expo.dev/accounts/chiketan/projects/circle-profession/builds/172f493d-1eb2-4805-90c4-0be453d2b14c) |

These are development clients for an iOS Simulator. Extract the archive and install its Circle.app in a compatible Mac/Xcode simulator. Start the corresponding Metro server with `mobile/run-device.cmd customer` or `mobile/run-device.cmd professional`. Distinct bundle IDs allow both apps to coexist.

Simulator archives cannot install on a physical iPhone. No native runtime test has been performed. The Expo account returned remote simulator availability=false, so running from Windows is pending Expo simulator access. See [iPhone build instructions](../../docs/iphone-builds.md).

The adjacent customer-build.json and professional-build.json record artifact URLs, build status, native bundle identity, architecture, local file size and SHA256 after archive verification. Keep the local archives: cloud download links may expire.
