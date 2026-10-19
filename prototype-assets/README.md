# CC Circle generated demo assets

These fictional portfolio photographs were generated with the built-in image-generation tool, then copied into this project. They are not actual work by the sample professionals and are labelled accordingly in the prototype. No images or identities were extracted from the supplied reference screenshot.

## Saved assets

- `makeup.png` — bridal makeup artist at work
- `actor.png` — adult actor on an independent film set
- `photographer.png` — photographer working in a daylight studio
- `editor.png` — editor at a color-grading workstation
- `dancer.png` — contemporary dance rehearsal

## Final prompt set

Every generation used this prefix:

> Use case: photorealistic-natural. Asset type: CC Circle sample professional portfolio photograph.

Individual scene prompts:

- Makeup: An adult South Asian makeup artist applying bridal makeup to an adult South Asian bride in an elegant daylight dressing room. Natural skin texture, beautiful subtle makeup, brushes visible, candid working moment.
- Actor: An adult South Asian woman actor on an independent film set, expressive confident portrait in contemporary modest clothing, cinema camera and blurred crew in background, candid working moment.
- Photographer: An adult South Asian photographer using a professional mirrorless camera for a warm editorial portrait session in a daylight studio, lighting equipment visible, candid working moment.
- Editor: An adult South Asian video editor at a sophisticated editing desk, monitor showing a cinematic color grading timeline without readable text, warm practical lighting, candid working moment.
- Dancer: An adult South Asian female dancer rehearsing contemporary dance in a sunlit studio, elegant dynamic full-body pose, comfortable modest rehearsal clothing, candid working moment.

Every generation used this suffix:

> Editorial photography, premium authentic human feel, landscape composition with subject central so it crops well to a square. Muted warm tones with soft contrast. No typography, no logos, no watermarks. Fictional generated adults, no celebrities. Save output for use in the project.

## Demo guide

Open `../prototype.html` for the interactive welcome screen, or `../prototype-previews/index.html` for the screenshot comparison gallery.

- Appearance: Soft Studio, Minimal and Neumorphic, each in light/dark.
- Welcome: two generously spaced auto-scrolling photo rows. Motion can be paused and respects reduced-motion preferences.
- Authentication: fictional 10-digit Indian mobile number, demo code `123456`. No SMS or account is created.
- Professional signup: select a profession; on step 2 open the detailed questionnaire. Each profession has 4 dedicated pages, with required capability questions and optional supporting details. Then complete basic profile, pricing, portfolio and review.
- Photographer details include Canon/Sony and other camera brands, body models, lenses, lighting, backup, drone readiness, editing and delivery.
- Actor/model casting measurements are optional and private, with a sharing preference. They are not public profile/search attributes.
- Questionnaire answers and demo contact details stay in memory and clear on reload. Only appearance preferences are saved locally.
- The 3D journey remains simulated. There is no maps API or real GPS connection.

The HTML prototype does not modify the production Expo application or integrate authentication, backend filtering, portfolio imports or secure private-data storage. Those remain implementation work after design approval.
