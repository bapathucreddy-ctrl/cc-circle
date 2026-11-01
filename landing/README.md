# Circle landing page

Responsive static marketing page for Circle. Open `dist/index.html` through a static HTTP server. No build or credentials are required.

Includes service filters and keyword search, occasion collections, service detail dialogs, customer/professional app selectors, mobile navigation and accessible native dialogs/FAQ disclosures. App requests open a prefilled support email; the page does not imply a store listing or collect form submissions.

The optional motion layer (`motion.css` / `motion.js`) adds scroll reveals, hero image movement, animated filters, pointer-sensitive service cards, a pausable creative-services strip, reading progress, a back-to-top control and five interactive phone-preview categories. Touch controls work without hover. Reduced-motion preferences disable decorative movement, including when the preference changes during the visit. Without IntersectionObserver the content remains visible; without JavaScript the main page and FAQ are still readable.

`refinements.css` provides consistent button dimensions, readable dark/light states and neutral gray surfaces. The visual tour is a silent 15-second H.264 montage (about 1.3 MB) of the existing service artwork. It does not autoplay or preload the video body. Native controls support playback and seeking; the five chapter buttons select a service. Playback pauses offscreen or when the document is hidden. `create-film.cjs` is an optional workspace utility using the local FFmpeg binary to regenerate it; the hosted site only needs the packaged MP4 and poster.

Run `node check.cjs` for JavaScript syntax, referenced files, anchor targets and service catalog checks. Run `node serve.cjs` for a local preview at `http://localhost:4173`.

Artwork comes from the Circle application's generated service images. These illustrate services, not specific professionals. No fabricated ratings, prices or testimonials are used.

The original brand marks and optimized WebP images are included in `dist/assets`. `prepare-assets.cjs` is a workspace-only utility for refreshing those images using the existing local Sharp installation; it is not needed for hosting.

Hosting configuration: `.openai/hosting.json`. The landing page is independent of the mobile and admin applications.
