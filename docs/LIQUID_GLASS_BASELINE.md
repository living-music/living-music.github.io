# Liquid Glass Stage 0 baseline

Status: automated Chromium capture complete; iOS 27 Simulator Safari comparison capture complete; installed-PWA interactive baseline recorded with one landscape defect; physical-iPhone validation pending.

Baseline UI: commit `7279cca`, restored by `8787b20`. Capture date: September 12, 2026. The documentation and capture tooling do not change production styling.

## Reproduce the automated baseline

From a clean checkout with Node.js 22 or newer:

```sh
npm ci
npm run baseline:visual
```

The command creates a production build, serves it through Vite Preview, installs the generated service worker, writes a deterministic two-song catalog into the temporary build, and captures the files in `docs/baselines/7279cca/`. The normal browser suite skips the capture-only tests.

The deterministic catalog deliberately uses local fallback artwork. Later stages must also be reviewed manually against light, dark, and detailed production artwork.

## Captured references

| Reference | Environment | Surface |
| --- | --- | --- |
| `chromium-desktop-browse.png` | Chromium, 1440 × 900 | Browse and sidebar without playback |
| `chromium-desktop-album-player.png` | Chromium, 1440 × 900 | Album and persistent player |
| `chromium-desktop-playlist.png` | Chromium, 1440 × 900 | Playlist, sidebar, and persistent player |
| `chromium-mobile-browser-browse.png` | Chromium, 390 × 844 | Browser-mode header and navigation without playback |
| `chromium-mobile-browser-player.png` | Chromium, 390 × 844 | Browser-mode header, mini player, and navigation |
| `chromium-mobile-installed-settings.png` | Standalone-mode emulation, 390 × 844 | Taller installed header and Settings |
| `chromium-mobile-installed-player.png` | Standalone-mode emulation, 390 × 844 | Taller installed header, mini player, and navigation |
| `chromium-mobile-installed-now-playing.png` | Standalone-mode emulation, 390 × 844 | Full-screen Now Playing |
| `ios27-safari-browse.png` | iPhone 13 Simulator, iOS 27.0 | Live Browse in Safari |
| `ios27-safari-album.png` | iPhone 13 Simulator, iOS 27.0 | Live production album in Safari |
| `ios27-safari-settings.png` | iPhone 13 Simulator, iOS 27.0 | Live Settings in Safari |
| `ios27-installed-open.png` | iPhone 13 Simulator, iOS 27.0 Home Screen PWA | Standalone Browse, safe areas, and fixed navigation |
| `ios27-installed-settings.png` | iPhone 13 Simulator, iOS 27.0 Home Screen PWA | Standalone Settings and device storage reporting |
| `ios27-installed-player.png` | iPhone 13 Simulator, iOS 27.0 Home Screen PWA | Scrolled album, active track, mini player, and fixed navigation |
| `ios27-installed-now-playing.png` | iPhone 13 Simulator, iOS 27.0 Home Screen PWA | Portrait Now Playing and populated queue |
| `ios27-installed-now-playing-increase-contrast.png` | iPhone 13 Simulator, iOS 27.0 Home Screen PWA | Now Playing with Increase Contrast enabled |
| `ios27-installed-now-playing-landscape.png` | iPhone 13 Simulator, iOS 27.0 Home Screen PWA | Landscape Now Playing and its current transport-control defect |

The adjacent JSON files record viewport metrics, safe-area probe results, document scroll ownership, fixed-element rectangles, stacking order, backgrounds, and computed filter values. Chromium's production CSSOM can report `backdrop-filter: none` when the optimized stylesheet retains only the WebKit-prefixed declaration, so those computed values are diagnostic data rather than proof that WebKit rendered or failed to render blur.

## Baseline layout facts

The automated 390 × 844 reference records:

- The root `html` element owns vertical document scrolling.
- Browser-mode mobile header: 56 px high.
- Installed-mode emulated header: 72 px high.
- Mobile navigation: 60 px high and fixed to the viewport bottom.
- Mini player: approximately 74.4 px high, fixed immediately above navigation.
- Header, mini player, and navigation use stacking levels 20, 40, and 30 respectively.
- Chromium reports zero safe-area insets because desktop browser emulation does not reproduce iOS hardware insets.

Do not use these measurements as substitutes for the iOS 27 Simulator record. The simulator record must include nonzero safe areas on a device with a sensor housing or Dynamic Island.

## iOS 27 Simulator gate

The host now has iOS 27.0 build `24A5408d` and a booted iPhone 13 Simulator. Dark-mode Safari references were captured from the live GitHub Pages site at the device's native 1170 × 2532 screenshot resolution with a normalized 9:41 status bar.

Browse, album, and Settings Safari comparison captures pass the first visual check: the header label and Settings icon are sharp and fully visible, content respects Safari's visible viewport, artwork loads, and navigation remains fixed.

The installed Home Screen PWA was then exercised directly in portrait and landscape. Browse, Settings, long album scrolling, song playback, the mini player, portrait Now Playing, queue rendering, rotation, and Increase Contrast all work in standalone mode. The installed header respects the top safe area, its label and Settings icon remain sharp, the mini player stays immediately above navigation, and playback continued through the visual checks. Scrolled rows visibly pass beneath the fixed top and bottom materials without covering their controls.

The landscape Now Playing capture records one existing defect: the two-column layout places the primary transport controls below the visible viewport. This is baseline evidence and remains open for the geometry stage. Reduced Transparency, Reduced Motion, larger text, menus and dialogs, Web Inspector/service-worker inspection, and the deployed update sequence still require manual runs.

Use the installed Home Screen PWA as the primary iOS 27 test target. Safari is used to install it and to provide a comparison capture for browser-chrome behavior. Apple documents Simulator as the more accurate option for iOS-specific web rendering and exposes Simulator pages, Home Screen web apps, and service workers through macOS Safari's Web Inspector.

The current installed-PWA record uses these names:

- `ios27-safari-browse.png`
- `ios27-safari-player.png`
- `ios27-installed-settings.png`
- `ios27-installed-player.png`
- `ios27-installed-now-playing.png`
- `ios27-installed-now-playing-increase-contrast.png`
- `ios27-installed-now-playing-landscape.png`

Record the device model, iOS build, Safari build, orientation, appearance, display zoom, text size, and whether Increased Contrast, Reduced Transparency, or Reduced Motion is enabled.

### Simulator checks

1. In Safari, add Living Music to the Home Screen and then close Safari.
2. Launch Living Music from its Home Screen icon; use this standalone PWA for every primary check below.
3. Open Browse in the PWA and scroll colorful artwork under the header and navigation.
4. Start a song and confirm that the mini player is directly above navigation and remains translucent.
5. Confirm the taller installed header respects the top safe area.
6. Confirm that the Living Music label and Settings icon remain sharp and fully opaque while the header background blurs.
7. Scroll long album, playlist, and Settings pages to both ends; record where the native scrollbar appears relative to fixed chrome.
8. Open Now Playing, context menus, playlist menus, and dialogs; inspect seams, stacking, focus, and background scroll locking.
9. Rotate portrait to landscape and back, then repeat with larger text.
10. Enable Reduced Transparency and confirm every glass surface becomes intentionally opaque.
11. Enable Reduced Motion and confirm controls remain responsive without spatial animation.
12. Inspect the Home Screen web app and its service worker from macOS Safari's Develop menu.

## Physical iPhone gate

A simulator does not accurately represent device performance, memory pressure, networking, audio-session interruption, lock-screen controls, or background suspension. Before Stage 0 is marked complete, repeat these checks on a physical iPhone:

- Scroll each reference view while audio is playing and watch for dropped frames or black compositing flashes.
- Lock the device, control playback from the system media surface, unlock, and confirm the page remains synchronized.
- Background the PWA for at least ten minutes, return, and confirm playback can recover.
- Change orientation and text size, including the largest practical accessibility size.
- Install one older deployed build, publish a visual probe build, apply the in-app update, and verify that no manual cache clearing is required.

## Cross-browser manual matrix

| Environment | State | Required evidence |
| --- | --- | --- |
| iOS 27 Home Screen PWA | Partial: installed Browse, Settings, playback, Now Playing, rotation, and Increase Contrast captured | Remaining accessibility, overlays, Web Inspector, and deployed-update record |
| iOS 27 Simulator Safari | Partial: live Browse, album, and Settings captured | Comparison record for browser chrome and Safari-only behavior |
| Physical iPhone | Pending | Background audio, performance, lock-screen, orientation, and update notes |
| macOS Safari | Pending | Browse, playlist, player, menus, Reduced Transparency, keyboard |
| Chromium | Complete | Eight PNG references and four JSON layout records |
| Firefox | Pending | Opaque/standard blur fallback, keyboard, playback |
| Offline installed PWA | Pending offline run | Cached startup, downloaded playback, update recovery |

Use a new dated subsection below this matrix for every manual run. Include failures; do not overwrite an earlier result.

## Service-worker visual update procedure

1. Install and open deployed build A. In Settings, record its version and build ID.
2. Keep build A open and begin playback.
3. Deploy build B with a visible, harmless test token or style change.
4. Return build A to the foreground. Visibility change invokes `registration.update()`.
5. Confirm the update banner appears while build A remains active and playback is not interrupted.
6. Select **Update now**. The page sends `LIVING_MUSIC_SKIP_WAITING` to the waiting worker.
7. Confirm `controllerchange` causes exactly one reload.
8. In Settings, confirm build B's build ID. Confirm its hashed stylesheet in Web Inspector and verify the visible probe.
9. Confirm Library, favorites, playlists, queue state, downloads, and appearance survived the reload.
10. Close and reopen the installed app, switch offline, and confirm build B still starts from the new shell cache.
11. In Cache Storage, confirm the active `living-music-shell-*` cache is the new revision and the prior shell cache was removed after activation.

A stage fails this procedure if the Update action leaves old CSS active, reloads repeatedly, interrupts playback before listener approval, loses local state, or requires manual cache clearing.

## Stage 0 completion record

- [x] Deterministic automated capture command
- [x] Browse, album, playlist, Settings, mini-player, and Now Playing Chromium references
- [x] Browser and emulated-installed mobile states
- [x] Scroll ownership, fixed-chrome geometry, and safe-area diagnostics
- [x] Service-worker visual update procedure
- [x] iOS 27 Simulator Safari static Browse, album, and Settings record
- [x] iOS 27 Simulator interactive player and installed-PWA record
- [ ] iOS 27 Simulator accessibility, overlays, Web Inspector, and deployed-update record
- [ ] Physical-iPhone playback, performance, and update record
- [ ] macOS Safari record
- [ ] Firefox fallback record

Stage 1 may be implemented locally after the simulator baseline is recorded. Do not make Stage 1 materials the production default until the physical-iPhone baseline and update path are also recorded.

## References

- [Apple: Installing Xcode and Simulators](https://developer.apple.com/documentation/safari-developer-tools/installing-xcode-and-simulators)
- [Apple: Responsive Design Mode and Open with Simulator](https://developer.apple.com/documentation/safari-developer-tools/responsive-design-mode)
- [Apple: Inspect Apps and Devices](https://developer.apple.com/documentation/safari-developer-tools/inspect-apps-and-devices)
- [WebKit: Enabling Web Inspector](https://webkit.org/web-inspector/enabling-web-inspector/)
