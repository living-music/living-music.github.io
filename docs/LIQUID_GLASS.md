# Liquid Glass implementation plan

Status: Stage 3 implemented, deployed, and verified in the installed iOS 27 Simulator PWA. Automated Chromium, iOS 27 Simulator Safari comparisons, and the interactive installed-PWA baseline are recorded. The baseline found a landscape Now Playing defect; remaining Simulator accessibility checks and physical-device validation are still required. See [Stage 0 baseline](LIQUID_GLASS_BASELINE.md). Baseline UI: commit `7279cca` as restored by `8787b20`.

## Goal

Evolve Living Music toward Apple's Liquid Glass design language while preserving its reliability as a static, installable web app. Glass belongs to the navigation and control layer: the desktop sidebar, mobile header and navigation, mini player, Now Playing controls, menus, and dialogs. Album artwork, song lists, and other content remain visually direct.

The visual target is the iOS 27 and macOS 27 generation documented in Apple's 2026 guidance. Living Music uses regular glass for text-heavy navigation, allows underlying content color to influence the material, and avoids a persistent highlighted outline around the large desktop sidebar. Border emphasis remains available for compact floating controls and accessibility modes where separation is necessary.

The web implementation will use standards-based CSS and progressive enhancement. It will resemble Liquid Glass through translucency, depth, edge light, adaptive tint, and responsive motion. It will not depend on WebKit's private `-apple-system-glass-material` or `-apple-visual-effect` values, which are not stable web APIs.

## Non-negotiable behavior

- Playback, queue progression, downloads, Library, playlists, and service-worker updates must behave exactly as they do before the visual migration.
- The document keeps its existing scroll ownership and safe-area layout until a separately reviewed stage explicitly changes geometry.
- Fixed chrome must remain translucent when content passes behind it, without fading, clipping, or blurring its labels and icons.
- Installed iOS testing is required. Chromium emulation is useful but does not approve a stage involving WebKit compositing.
- Dark remains the default. Light and System appearances receive complete glass and opaque-fallback treatments.
- `prefers-reduced-transparency`, `prefers-reduced-motion`, increased contrast, forced colors, keyboard navigation, and 200% text zoom remain supported.
- A browser without `backdrop-filter` receives an opaque surface with the same hierarchy and readable contrast.
- Each stage is independently deployable and revertible. Do not combine stages into one release.

## Stage 0 — Baseline and visual test matrix

Establish evidence before changing the interface.

Deliver:

- Capture reference images for Browse, an album, a playlist, Settings, the mini player, and Now Playing.
- Record phone layouts with and without the mini player, in browser and installed PWA modes.
- Add a manual test sheet for current iPhone Safari, installed iOS PWA, macOS Safari, Chromium, and Firefox.
- Record computed safe-area dimensions and which element owns vertical scrolling.
- Document the expected service-worker update sequence for visual releases.

Acceptance:

- The baseline images are labeled by browser, operating system, viewport, theme, and commit.
- The installed iOS header has no label or icon fade.
- The top and bottom chrome blur content that visibly passes behind them.
- Playback remains controllable from the page and the operating-system media surface.
- The app can update from one deployed test build to the next without clearing browser storage.

Rollback boundary: documentation and test tooling only; no production visual changes.

## Stage 1 — Material tokens and one reusable surface

Create a single CSS material primitive without changing component geometry.

Deliver:

- Add semantic tokens for glass tint, border, edge highlight, shadow, blur, saturation, and fallback color in dark and light appearances.
- Define regular, clear, and subdued project variants. Use clear only over artwork-rich surfaces.
- Implement the material with a pseudo-element so blur and decorative light stay isolated from labels and icons.
- Gate enhanced styling with `@supports (backdrop-filter: blur(1px))` and retain `-webkit-backdrop-filter` for older Safari.
- Keep an opaque fallback and existing reduced-transparency behavior.
- Apply the primitive to one low-risk surface, initially the desktop sidebar.

Acceptance:

- Sidebar content stays sharp while only the layer behind it is blurred.
- Text and icons pass contrast checks over the lightest and darkest available content.
- No stacking-context, menu-z-index, pointer-event, or scroll regression appears.
- Unsupported blur and Reduced Transparency both produce a deliberate opaque surface.

Rollback boundary: remove the shared material class and token block.

Implementation record — September 12, 2026:

- Added dark and light semantic tokens for regular, clear, and subdued tint, fallback color, blur, saturation, border, edge highlight, and shadow.
- Added a reusable `glass-surface` primitive whose non-interactive pseudo-element owns the material while direct content remains in a sharp layer above it.
- Kept the solid material as the base rule and enabled blur only inside the standards/WebKit `@supports` gate.
- Applied regular glass only to the desktop sidebar; its width, padding, fixed position, scroll behavior, and stacking level are unchanged.
- Removed inset borders, edge highlights, and the floating-panel shadow from the desktop sidebar. Like Apple Music on macOS 27, it uses material tone and selected-row contrast instead of a drawn boundary.
- Added explicit Reduced Transparency, increased-contrast, and forced-colors behavior.
- Validated the candidate with TypeScript, 60 unit tests, the production build, 21 browser tests, dark/light Chromium captures, a dark macOS Safari inspection, and the native Apple Music sidebar as the macOS 27 reference.

## Stage 2 — Persistent navigation and player chrome

Apply the proven primitive to the surfaces listeners use throughout a session.

Deliver:

- Adopt regular glass for the mobile header and navigation.
- Adopt a slightly stronger material for the mini player so playback remains legible above navigation.
- Add restrained one-pixel edge light and content-aware-looking shadows without sampling pixels in JavaScript.
- Preserve the current header, player, navigation, safe-area, padding, and scrollbar geometry.
- Keep all interactive children in a content layer above the glass pseudo-element.

Acceptance:

- Real-device iOS browser and installed PWA views retain transparency at the top and bottom.
- The Living Music label and Settings icon never fade or blur.
- Scrolling does not expose seams, black flashes, or opaque blocks.
- The mini player remains usable at 320 px and does not overlap navigation.
- Opening a playlist menu still places it above the independent-project bar and other fixed chrome.

Rollback boundary: revert the three surfaces to their Stage 1 backgrounds without changing layout.

Implementation record — September 12, 2026:

- Applied regular glass to the mobile header and bottom navigation, including the taller iOS Home Screen header.
- Applied the more opaque subdued material to the mini player so track information remains distinct above navigation.
- Replaced each surface's direct filter with the shared pseudo-element layer, keeping labels, artwork, controls, and the seek bar above the blur.
- Preserved the existing header, navigation, mini-player, safe-area, content-padding, and stacking geometry.
- Limited edge light and shadow to the adjoining edges of the bottom navigation and mini player; the header uses a restrained lower separator.
- Consolidated all three surfaces onto the shared solid fallback for Reduced Transparency and browsers without filter support.
- Validated dark and light installed-size renders, exact player-to-navigation placement after animation, TypeScript, 60 unit tests, 22 browser tests, and the production build.
- Verified the deployed service-worker path in the installed iOS 27 PWA: build `6ad86e1` presented **Update ready**, **Update now** performed one visible reload, Settings then reported build `a34d474`, and the existing mini-player state remained present without clearing cache or local data.
- Captured the deployed player and build evidence in `docs/baselines/a34d474/`. Stage 2 is complete in the simulator; physical-device behavior remains part of the final resilience gate.

## Stage 3 — Floating geometry and scroll edges

Introduce the most visible Liquid Glass composition after material stability is proven.

Deliver:

- Prototype a floating mobile navigation capsule and a visually related mini-player accessory.
- Add soft scroll-edge fades behind pinned controls, separate from the glass material itself.
- Preserve safe-area spacing and ensure page content remains reachable above all fixed controls.
- Keep the native page scrollbar behavior unless real-device testing proves an alternative reliable.
- Evaluate a desktop floating player treatment without reducing queue or seek-control space.

Acceptance:

- Content never becomes hidden beneath the player or navigation at the end of a page.
- The scrollbar does not pass visibly through control labels or disappear unexpectedly.
- Top and bottom blur continue to sample scrolling content.
- Layout passes portrait, landscape, dynamic text, keyboard, and 200% zoom checks.
- Any scroll-edge effect disappears when no pinned control requires separation.

Rollback boundary: material styling remains, while geometry returns to the existing full-width bars.

Reference direction — Apple Music on iOS 27:

- The resting layout uses separate player and navigation capsules with the same horizontal inset, a narrow visible gap, continuous corner curvature, and enough translucency for nearby artwork color to influence both materials.
- The compact scrolled layout splits navigation into circular destination controls and a central playback pill. Treat this as a later interaction refinement after the resting two-capsule layout passes installed-WebKit geometry, accessibility, and playback checks.
- Living Music keeps its draggable progress control and four primary destinations, so dimensions follow the reference hierarchy without copying Apple Music's exact tab count or controls.

Implementation record — September 12, 2026:

- Floated the mobile navigation 16 px from the viewport sides and safe-area floor, with continuous capsule curvature, a full perimeter edge light, and a compact ambient shadow.
- Matched the mini player's horizontal inset to navigation and separated the two surfaces by 8 px, while retaining the subdued player material and draggable progress control.
- Added independent fixed scroll-edge fades behind the header and bottom chrome. They do not own blur, intercept input, or alter document scroll ownership.
- Increased mobile content clearance for the floating gaps so the end of every page remains reachable above persistent controls.
- Kept the desktop sidebar geometry and borderless macOS 27 treatment unchanged.
- Validated TypeScript, 60 unit tests, the production build, 22 browser tests, exact player/navigation alignment, and usable controls at 320 px.
- Verified the deployed update from `a34d474` to `4a73898` in the installed iOS 27 PWA without clearing storage. Settings reported the new build, the prior track remained in the mini player, and artwork visibly influenced the floating player material. Stage 3 is complete in the simulator.
- Refined both mobile surfaces to full pill curvature after installed-iOS comparison. Reduced the mini player to a 56 px target height, scaled its artwork and controls with it, and removed the mini seek line on mobile to match Apple Music's resting player. The full Now Playing seek control remains available and draggable.
- Recalculated the bottom fade and page clearance from the actual player, navigation, gap, and safe-area values after shortening the player.
- Replaced the crisp one-pixel capsule outlines with a layered rim: a faint half-pixel perimeter, soft upper inner light, lower inner shade, near-edge depth shadow, and diffuse ambient lift. Light and dark appearances use separate edge-shadow values, while Increased Contrast and forced colors retain their explicit boundaries.
- Increased color transmission through the floating chrome by moving navigation to clear glass and the mini player from subdued to regular glass. Added 4 px of left breathing room inside the mini player so artwork no longer crowds the curved rim; opaque accessibility fallbacks remain unchanged.
- Moved the mini-player artwork farther from the leading rim to a 16 px inner inset after device review. Strengthened capsule volume with an upper curved highlight bloom, face shading, directional inner rim light, lower refraction shade, and paired contact/ambient shadows while retaining the underlying clear and regular materials.
- Increased the visible lens curve after direct comparison with Apple Music on iOS 27: rounded-end radial highlights now bend light inward from both sides, a broader top-face bloom and 3.5 px soft inner band shape the capsule, and stronger directional refraction defines the upper and lower curves without returning to a hard outline. Floating chrome also receives extra backdrop saturation so artwork color carries through like the native reference.
- Rebalanced that curve after installed review: removed the luminous side bands, reduced the perimeter to a faint half-pixel boundary, concentrated a smaller and shinier specular highlight along the top, and softened both lower refraction and ambient lift. The resulting surface follows Apple Music's top-lit glass rather than tracing the entire pill.
- Tightened the internal refraction into a shallower, quieter band while preserving the narrow top glint. Mobile chrome now uses less blur so content reads through the material more clearly, and mini-player artwork is slightly smaller to give the capsule more breathing room.
- Narrowed both floating mobile capsules by two pixels and introduced a restrained lower-edge reflection above a softer depth shadow, mirroring the small secondary highlight visible in iOS Liquid Glass.
- Balanced the upper and lower inset glows around matching geometry: the upper refraction is softer, while the mirrored lower refraction remains slightly dimmer to preserve the top-lit appearance.
- Reduced mobile capsule blur again so underlying color and form remain more legible through the material, strengthening the liquid-lens effect without changing saturation or edge lighting.
- Increased mobile capsule transparency with dedicated dark- and light-mode tints, and lowered blur once more so more artwork color and page structure refracts through the floating controls.
- Simplified mobile playback controls by removing the accent circle behind play/pause, rounding the play glyph itself, and replacing the barred next-track symbol with a compact double-forward glyph.
- Widened the play silhouette and rebuilt Next from two overlapping copies of the same rounded form, giving both controls a longer profile and making the double-forward symbol read as one connected mark.
- Thickened Pause into two softly rounded filled bars and increased bottom-navigation glyphs from 22 to 25 pixels for clearer visual weight inside the mobile capsule.
- Reordered mobile navigation to Home, Browse, Library, Search and replaced the angular Home outline with a softly rounded filled-house silhouette modeled after the iOS tab-bar treatment.
- Filled the Browse tile grid and kept the Library heart filled at rest, using color rather than outline weight to distinguish the active destination.
- Moved the mobile Living Music and Settings row into normal page flow above Browse and Library titles. Other destinations no longer render that header, and content no longer reserves space for or scrolls beneath a fixed top material.
- Added one rem of installed-iOS-only top clearance above the normal safe-area inset, keeping brand controls and page eyebrow text below the PWA's top compositing fade while leaving browser-mode spacing unchanged.

## Stage 4 — Controls, menus, and interaction response

Make glass respond to input without adding distracting continuous animation.

Deliver:

- Add edge-light and scale responses for press, hover, keyboard focus, and selected states.
- Apply subdued glass to context menus, recording menus, playlist actions, and dialogs.
- Prototype morph-like transitions between a triggering control and its menu or sheet using transforms and opacity.
- Use the View Transitions API only as progressive enhancement; retain the current immediate route and dialog behavior.
- Keep routine transitions within the existing 160–320 ms motion range.

Acceptance:

- Every action responds immediately and remains usable during or after interrupted animation.
- Focus enters dialogs, stays trapped where required, and returns to the invoking control.
- Reduced Motion replaces spatial movement with a brief fade or immediate state change.
- Right-click, touch, keyboard, and pointer paths expose the same song actions.
- No animation interrupts audio or delays queue mutations.

Rollback boundary: remove interaction decoration while retaining the stable materials from Stages 1–3.

## Stage 5 — Now Playing depth and restrained tint

Use artwork to strengthen the player experience without turning all content into glass.

Deliver:

- Refine the existing artwork-derived Now Playing background into distinct content, atmosphere, and control layers.
- Use clear glass only for bold playback controls over the media-rich background; use regular glass for menus and detailed text.
- Add a restrained Living Music green tint to the primary action rather than tinting every control.
- Adjust shadow and tint by theme through tokens, without canvas pixel sampling or cross-origin artwork processing.

Acceptance:

- Titles, recording labels, time values, and control symbols stay readable over every fixture artwork and the fallback artwork.
- Missing or failed artwork produces an intentional neutral composition.
- Changing tracks does not flash an unstyled or incorrectly tinted control layer.
- Reduced Transparency replaces glass with solid surfaces while keeping artwork and controls clearly separated.

Rollback boundary: restore the current Now Playing styling independently of persistent navigation glass.

## Stage 6 — Performance, accessibility, and resilience gate

Harden the complete treatment before making it the default.

Deliver:

- Profile scroll, menu, and Now Playing interactions on a representative iPhone and Mac.
- Limit backdrop filters to persistent navigation and active overlays; remove nested or visually redundant filters.
- Add browser tests for fallback classes, accessibility preferences, z-index ordering, and service-worker visual updates.
- Run VoiceOver, keyboard-only, increased-contrast, Reduced Transparency, Reduced Motion, forced-colors, and 200% zoom checks.
- Verify no visual effect changes Media Session, background playback recovery, downloads, or offline startup.

Acceptance:

- Scrolling and player interactions remain smooth during audio playback.
- No fixed control becomes illegible over light or high-detail artwork.
- Accessibility preferences change the material immediately and consistently.
- A deployed update applies through the in-app Update action without manual cache clearing.
- All type, unit, browser, production-build, and live smoke checks pass.

Rollback boundary: a single release commit restores the Stage 5 candidate while retaining test coverage and findings.

## Stage 7 — Controlled rollout

Ship the verified design without trapping users on a broken visual release.

Deliver:

- Deploy the complete candidate behind one root class or versioned material switch.
- Perform the installed-iOS smoke test against the actual GitHub Pages artifact.
- Make the new material the default only after the live artifact passes.
- Update screenshots, release notes, brand guidance, version, and build ID.
- Keep the previous stable material definitions for one release cycle so rollback is a small, reviewable change.

Acceptance:

- GitHub Pages serves the expected hashed CSS and JavaScript assets.
- The service worker presents and applies the update correctly.
- Browser mode and installed mode match the approved visual references.
- No unresolved severity-one visual, playback, navigation, or update issue remains.

Rollback boundary: switch the root material class to the prior stable implementation and publish a patch release.

## Validation matrix

Every visual stage must cover:

| Environment | Required checks |
| --- | --- |
| Installed iPhone PWA | Safe areas, header content, blur, bottom chrome, scrolling, background playback, update flow |
| iPhone Safari | Browser chrome resizing, portrait/landscape, scroll edges, playback |
| macOS Safari | Sidebar/player materials, menus, keyboard, reduced transparency |
| Chromium desktop/mobile | Layout, fallback paths, automated browser suite |
| Firefox | Opaque or standard-blur fallback, keyboard, playback |
| Offline installed PWA | Cached shell, settings, library, downloaded playback, update recovery |

For each environment, test dark, light, and system appearances. Accessibility passes add Reduced Transparency, Reduced Motion, increased contrast, forced colors where available, and 200% text zoom.

## Implementation order and commit policy

1. Complete only one stage at a time.
2. Keep the stage diff limited to its listed surfaces and tests.
3. Run type checking, unit tests, the production build, and browser tests before each push.
4. Deploy the stage to GitHub Pages and use the in-app Update action.
5. Test the installed iOS PWA on a physical device.
6. Record the result in this document or the release notes.
7. Continue only after the stage meets its acceptance criteria; otherwise revert that stage.

Recommended commit sequence:

- `Document Liquid Glass baseline`
- `Add Liquid Glass material tokens`
- `Apply glass to persistent chrome`
- `Introduce floating navigation geometry`
- `Add responsive glass interactions`
- `Refine Now Playing glass depth`
- `Harden Liquid Glass accessibility and performance`
- `Release Liquid Glass interface`

## References

- [Apple: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple: Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Apple: Platforms State of the Union — WWDC26](https://developer.apple.com/videos/play/wwdc2026/102/)
- [Apple: Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
- [Apple: Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/)
- [WebKit: Backdrop Filter in Safari](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)
- [WebKit CSS Feature Status](https://webkit.org/css-status/)
