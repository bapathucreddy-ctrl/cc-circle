# UI assets

Content creator adds a phone/gimbal craft icon and matching scooter marker (`contentcreator-neutral.svg` and PNGs). `welcome/contentcreator.png` is an original generated editorial photograph of a fictional adult filming reels; both welcome gallery rows include it. Built-in imagegen provenance and the exact prompt are in [contentcreator-generation.md](welcome/contentcreator-generation.md). These seven categories share assets across customer/professional builds; welcome art never represents a real professional's portfolio.

Hair Stylist uses an original scissors/comb vector (`crafts/hairstylist.svg`), its PNG render, a matching gallery illustration and a scooter variant in `brand/rider-hairstylist`. These extend the existing icon system without copying a real person's portfolio. The six-category assets are shared by both app builds.

`brand/` contains original SVG drawings and 3× PNG renders for the CC double-ring splash mark, red service-location house and profession-on-scooter tracking markers. Five riders reuse the existing craft illustrations (camera, lipstick, actor masks, editor and dancer); a neutral CC rider is used when a profession cannot be loaded. SVGs are editable sources; native and web maps use the PNGs. The supplied `cc-circle-splash.mp4` informed the short logo reveal, recreated with React Native animation rather than an embedded video player.

The newer `splash reference.mp4` supersedes the earlier reveal motion: `splash-trace-minimal` and `splash-trace-gallery` are editable SVG sprite sheets and PNG renders containing 36 frames of the ring trace and travelling dot. The app steps through them before revealing the existing wordmark, tagline and footer. Reduced-motion startup uses the static shared logo.

`icons/` and `crafts/` are native-compatible PNG renders of the vector drawings in the repository's `prototype.html`. They are used for navigation and profession categories in both themes.

`welcome/` contains copies of the fictional generated illustrations documented in `../../prototype-assets/README.md`. These illustrate the welcome/sign-in screens only. They are not presented as a real professional's work, identity or portfolio.

The Gallery theme's decorative rings and connected spheres are drawn in React Native views in `src/ui.tsx`, so the appearance works on web and native without an additional graphics dependency.

`icons/google.png` is the official Google G sign-in mark from https://developers.google.com/identity/images/g-logo.png. It is displayed unmodified on the Google sign-in button. The local video supplied on 15 October 2026 informed layout and motion only; no food artwork, brand, or code shown in that video was imported.
