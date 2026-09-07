# Living Music implementation plan

Status: implementation proposal, September 7, 2026.

## Product goal

Build a fast, artwork-forward music player for everyday listening at [living-music.github.io](https://living-music.github.io/). The experience must feel Apple-native even in a browser: smooth, direct, calm, and immediately understandable, while retaining a distinct Living Music identity and using only music metadata and media URLs published by the companion [musicapi](https://living-music.github.io/musicapi/).

The first release succeeds when a listener can discover a collection, find a song, choose an available recording, start playback, build a queue, and return to favorites without creating an account.

## Product principles

1. **Native feel serves clarity.** Motion, materials, spacing, and direct manipulation should feel at home on Apple devices while every action remains visible, labeled, and usable on the wider web.
2. **Playback stays present.** Once a song is selected, a mini player remains available while the listener browses, searches, or edits the queue.
3. **Artwork leads the interface.** Collection and song artwork provide hierarchy and color, while text and controls remain readable when artwork is missing.
4. **One tap starts a sensible recording.** Prefer a vocal recording for everyday listening, remember the listener’s last recording preference, and keep alternate versions easy to reach.
5. **The queue is understandable.** Show what is playing, what comes next, and what autoplay behavior will occur.
6. **Dark by default.** The first paint and initial experience use a considered dark appearance; listeners can choose light or system appearance without losing contrast or readability.
7. **Local-first preferences.** Favorites, queue state, playback preferences, and appearance live on the device. No account or backend is required.
8. **Progressive enhancement.** Browsing and source links remain useful when storage, Media Session, installation, or advanced browser features are unavailable.
9. **Respect the source.** Keep official source links visible and describe Living Music as an independent interface rather than an official Church product.

## Experience model

### Mobile

Use four persistent destinations:

- **Home:** recently played items, favorites, and selected collection rows.
- **Browse:** all collections in a two-column artwork grid, followed by collection detail and song lists.
- **Search:** an immediately available search field with results grouped by song and collection.
- **Library:** favorite songs, recently played songs, and playback preferences.

A compact mini player sits above the bottom navigation whenever a track is loaded. Tapping it opens a full-screen Now Playing view. The expanded view contains large artwork, song and recording labels, scrubber, elapsed and remaining time, previous/play/next controls, favorite, queue, and recording-version controls.

### Desktop and wide tablet

Use a three-region layout:

- A fixed left sidebar for Home, Browse, Search, and Library.
- A scrollable content region for collection grids and song lists.
- A persistent bottom player across the window.

Open the queue in a right-side panel. Keep the current content position when the queue or Now Playing panel opens and closes.

### Visual direction

Use Apple Music as an interaction reference, not as a pixel-for-pixel copy.

- Large artwork with 12–18 px corner radii.
- Dark mode is the default, using near-black layered surfaces instead of flat pure black so navigation, content, sheets, and player chrome remain distinct.
- Use restrained shadows and translucent materials where contrast remains sufficient, with an opaque fallback when `backdrop-filter` is unavailable.
- A warm Living Music accent replaces Apple’s red and never carries meaning by itself.
- Use the Apple system font stack on Apple devices and native system fonts elsewhere. A restrained display face may be used only for major editorial headings.
- Artwork-derived color may tint Now Playing, but semantic text and control colors remain stable and tested.
- Offer light and system-following appearances as explicit settings; support increased contrast, reduced transparency, reduced motion, and 200% text zoom.
- Use original icons from an open icon set or project-owned SVGs. Do not copy Apple icons, branding, screenshots, or proprietary assets.

### Motion and native-feeling behavior

- Make transitions explain spatial relationships: content pushes for navigation, the mini player expands into Now Playing, and queue/settings surfaces rise as sheets.
- Keep common transitions in the 160–320 ms range with consistent ease-out curves. Controls respond immediately on press; decorative motion never delays an action.
- Animate only opacity and transforms during routine navigation. Crossfade artwork changes and avoid large parallax or continuous background motion.
- Respect `prefers-reduced-motion` by replacing movement with short fades or immediate state changes.
- Treat touch, pointer, and keyboard as equal inputs. Hover adds information but is never required; drag-to-reorder always has button and keyboard alternatives.
- Use native scrolling, predictable back behavior, retained scroll positions, and focus restoration rather than recreating browser primitives.
- Account for `env(safe-area-inset-*)` around the mobile tab bar, mini player, full-screen sheets, and installed-app title area.
- Use pressed, loading, disabled, selected, and focus-visible states consistently so every control feels responsive.
- Prefer skeletons and preserved layout over blocking spinners. Optimistic favorite and queue actions should settle instantly and roll back with a clear message only if persistence fails.
- Add `viewport-fit=cover`, Apple touch icons, manifest metadata, and dark status-bar styling for an app-like installed experience.
- Apply the default theme before loading the main stylesheet or rendering Preact so a returning listener never sees a light flash.
- Keep translucency subtle and functional. Under reduced transparency or unsupported blur, use an opaque surface with the same hierarchy.

Apple’s guidance favors persistent, labeled top-level navigation, visible playback controls, user-initiated audio, and interfaces that adapt to appearance and accessibility settings. References:

- [Apple Human Interface Guidelines: Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio)
- [Apple Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple Human Interface Guidelines: Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields)
- [Apple Human Interface Guidelines: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines: Color](https://developer.apple.com/design/human-interface-guidelines/color)

## First-release scope

### Included

- Home, Browse, Search, and Library destinations.
- Collection grid and collection detail views.
- Global song search by title, number, author, composer, artist, tag, and collection metadata exposed by the search index.
- A single persistent `HTMLAudioElement`.
- Play, pause, seek, previous, next, replay, and track progress.
- Queue actions: Play Next, Add to Queue, remove, reorder, clear, and play an item immediately.
- Automatic advancement when a recording ends.
- Repeat off, repeat queue, repeat one, and shuffle.
- Alternate recording selection.
- Favorite and unfavorite songs.
- Recently played history.
- Media Session metadata and headset/lock-screen actions when supported.
- Installable PWA metadata and app icons.
- Loading, empty, offline, unavailable-media, storage-error, and unsupported-schema states.
- Links to each item’s official source page.
- Dark appearance by default, with selectable light and system-following appearances.

### Deferred

- User accounts and cloud sync.
- Offline audio downloads or caching Church-hosted audio.
- Lyrics, sheet music, casting, AirPlay-specific controls, or playlists shared between users.
- Personalized recommendations.
- Multiple languages.
- Editorial content that requires a separate content-management workflow.

## Technical foundation

Adopt **Vite, TypeScript, and Preact** for the application.

This interface now has enough shared state and conditional views to justify a component framework. Preact keeps the shipped runtime small while providing predictable component rendering; TypeScript makes catalog parsing and player transitions safer; Vite produces static files that GitHub Pages can deploy without a server.

Place a tiny inline theme bootstrap in the document `<head>` before the stylesheet. It reads the saved appearance safely and sets `data-theme`; when no preference exists, it selects dark. CSS declares `color-scheme: dark` at the root and supplies complete semantic tokens for dark, light, system-following, increased-contrast, and reduced-transparency modes.

The Pages workflow will:

1. Check out `main`.
2. Install the locked dependencies with `npm ci`.
3. Run type checking and tests.
4. Build the static app into `dist/`.
5. Upload `dist/` with `actions/upload-pages-artifact`.
6. Deploy with `actions/deploy-pages`.

Use root-relative app paths because the site owns `https://living-music.github.io/`. The API is on the same origin at `/musicapi/`, so the production base is:

```ts
const API_ROOT = new URL("/musicapi/", window.location.origin);
```

Allow a development override such as `VITE_MUSIC_API_ROOT` so local work can use the public API or a local catalog fixture.

## API integration

### Fetch sequence

1. Fetch `/musicapi/index.json`.
2. Reject an unsupported `schemaVersion`.
3. Resolve its `href` against the API root and fetch the current version index.
4. Render collection navigation from the version index.
5. Fetch `search.href` only when search is opened or during idle prefetch.
6. Fetch a collection payload only when its collection is opened or queued for playback.
7. Resolve every nested `href` against the document URL that declared it.

The current API provides:

- 112 collections.
- 5,070 searchable songs.
- 4,755 playable recordings.
- Stable song and recording IDs.
- Collection and song artwork.
- Recording-specific artwork overrides.
- Deterministic revisions and cache-busting `href` values.
- Recording labels, types, URLs, languages, and optional durations.
- Official source URLs.

### Client types

Define runtime-validated TypeScript types for:

- `CatalogManifest`
- `CatalogIndex`
- `SearchIndex`
- `CollectionSummary`
- `CollectionPayload`
- `Song`
- `Recording`

Do not rely on TypeScript types alone for network data. Validate required fields and supported schema versions at runtime, then surface a friendly “catalog update required” screen if the contract changes.

### Caching

- Let the browser cache revisioned API responses normally.
- Keep the manifest request revalidated so a new catalog version is discovered quickly.
- Store parsed index and collection objects in an in-memory cache for the current session.
- Persist only small user-owned state in `localStorage`: IDs, queue order, history, preferences, and schema version.
- Do not store the full catalog in `localStorage`; it is synchronous and unnecessary for revisioned static files.
- A later service worker may cache the app shell and catalog JSON. It must never pre-cache or download Church-hosted audio.

### Recording selection

When a song starts without an explicit recording choice:

1. Use the listener’s saved type for that song if it still exists.
2. Use the listener’s global preferred type if available.
3. Prefer `AUDIO_VOCAL`.
4. Then prefer audience-specific vocal versions.
5. Then prefer `AUDIO_INSTRUMENTAL`.
6. Then prefer accompaniment.
7. Otherwise use the first playable recording.

Show the chosen recording beneath the song title and expose alternate versions through a clearly labeled menu.

## Application architecture

```text
src/
  app/
    App.tsx
    router.ts
    store.ts
    types.ts
  api/
    catalog-client.ts
    catalog-schema.ts
    catalog-cache.ts
  audio/
    audio-engine.ts
    media-session.ts
    queue-reducer.ts
    recording-choice.ts
  components/
    AppShell.tsx
    Artwork.tsx
    CollectionCard.tsx
    MiniPlayer.tsx
    PlayerControls.tsx
    QueuePanel.tsx
    RecordingMenu.tsx
    SearchField.tsx
    SongRow.tsx
  views/
    HomeView.tsx
    BrowseView.tsx
    CollectionView.tsx
    SearchView.tsx
    LibraryView.tsx
    NowPlayingView.tsx
  persistence/
    storage.ts
    migrations.ts
  styles/
    tokens.css
    base.css
    layout.css
    components.css
  main.tsx
public/
  icons/
  manifest.webmanifest
tests/
  fixtures/
  unit/
  browser/
```

Use hash routing for shareable views such as `#/collection/hymns-for-home-and-church`. GitHub Pages serves the root `index.html` without rewrite rules, and hash routes survive direct navigation and refresh.

### State boundaries

Keep these state groups separate:

- **Catalog:** manifest, index, loaded collections, search index, loading/error states.
- **Navigation:** active destination, selected collection, open panels.
- **Player:** current song/recording, play state, current time, duration, buffering, error.
- **Queue:** ordered entries, current index, shuffle order, repeat mode.
- **Library:** favorites, recent history, recording preferences.
- **Settings:** theme (default dark), reduced artwork motion, data-saving preferences.

The audio engine owns the `HTMLAudioElement` and emits state updates. UI components send commands to the engine rather than mutating the element independently.

### Player state

Represent playback explicitly:

```text
idle → loading → playing
              ↘ paused
              ↘ error
playing ↔ paused
playing → ended → loading next item
```

Update the interface from media events such as `loadedmetadata`, `durationchange`, `play`, `pause`, `waiting`, `canplay`, `timeupdate`, `ended`, and `error`. Treat `audio.play()` as asynchronous and show playback only after its promise resolves. MDN documents the media event model and rejected play promises:

- [HTMLMediaElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)
- [HTMLMediaElement.play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)

## Persistence schema

Use one versioned key, for example `livingMusic:userState:v1`.

```ts
interface UserStateV1 {
  favorites: string[];
  recentSongIds: string[];
  queue: QueueEntry[];
  currentQueueIndex: number | null;
  lastPosition?: {
    recordingId: string;
    seconds: number;
  };
  preferredRecordingType?: string;
  songRecordingPreferences: Record<string, string>;
  repeatMode: "off" | "all" | "one";
  shuffle: boolean;
  theme: "dark" | "light" | "system";
}

const DEFAULT_THEME = "dark";
```

Limit recents to 50 items, validate all parsed values, discard unknown IDs gracefully, and wrap storage access in `try/catch`. `localStorage` persists across sessions but can be unavailable or cleared, especially in private browsing. Reference: [MDN Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).

Do not automatically resume audio after a page reload. Restore the queue and selected track in a paused state because browser autoplay rules require user intent.

## Accessibility and interaction requirements

- Use native buttons, links, headings, landmarks, dialogs, and range inputs before custom ARIA widgets.
- Every icon-only control needs an accessible name and visible focus style.
- Keep targets at least 44 × 44 CSS pixels on touch layouts.
- Announce track changes and playback errors through a polite live region; do not announce every progress update.
- Expose seek position with elapsed time, duration, and keyboard-adjustable range semantics.
- Support Space for play/pause when focus is not in an input; support arrow keys on focused sliders and queue controls.
- Preserve focus when panels open and return it to the invoking control when they close.
- Do not use color alone for favorite, selected, buffering, or error states.
- Disable nonessential artwork and panel animations under `prefers-reduced-motion`.
- Test the default dark appearance first, then light, system-following, increased contrast, reduced transparency, 200% zoom, keyboard-only navigation, VoiceOver, and TalkBack.
- Never autoplay on initial load.

## Error behavior

- **Manifest unavailable:** show Retry and an official Church Music Library link.
- **Unsupported schema:** explain that the app needs an update and retain the source link.
- **Collection unavailable:** keep navigation usable and offer Retry.
- **Recording fails:** mark that recording unavailable for the session and offer another version when present.
- **Track fails in a queue:** pause and present Skip; do not silently skip repeatedly.
- **Artwork fails:** use a stable branded placeholder with the song or collection initials.
- **Storage fails:** continue in memory and explain that favorites will not persist.
- **Offline:** keep the app shell and any already cached metadata useful; do not promise offline playback.

## Implementation milestones

### Milestone 1 — Foundation and design system

Deliver:

- Vite, TypeScript, Preact, linting, and focused test setup.
- GitHub Pages build workflow.
- Responsive app shell with desktop sidebar and mobile tab bar.
- Design tokens, a no-flash default dark theme, optional light/system themes, artwork placeholders, and base components.
- Hash router and route restoration.
- API client with runtime schema validation.

Acceptance:

- Root URL loads from a clean deployment.
- First paint is dark with no light-theme flash; appearance changes persist across reloads.
- App shell works at 320 px width, wide desktop, keyboard-only, and 200% zoom.
- A malformed or unsupported manifest produces a recoverable error screen.
- No playback or install prompt occurs without user action.

### Milestone 2 — Browse and search

Deliver:

- Collection grid from `/musicapi/v1/index.json`.
- Lazy-loaded collection detail pages.
- Song rows with title, number, artwork, creator metadata, and recording count.
- Search index loading, normalization, debounced input, and ranked results.
- Loading skeletons, empty results, retry states, and source links.

Acceptance:

- Initial load does not download all 112 collection files.
- Opening a collection fetches it once per session.
- Search works across the full 5,070-song index.
- Direct hash links open the requested collection after refresh.
- Stale or broken artwork does not shift the layout.

### Milestone 3 — Playback and Now Playing

Deliver:

- Single audio engine and player state model.
- Play/pause, seek, previous/next, progress, duration, and buffering feedback.
- Mini player and expanded Now Playing view.
- Recording selection and remembered preferences.
- Artwork-colored Now Playing background with accessible fallback.
- Media Session metadata and action handlers where supported.

Acceptance:

- Playback begins only after an explicit listener action.
- UI state follows audio events and rejected `play()` promises.
- Switching recordings preserves the song and resets progress predictably.
- Headset and lock-screen play/pause/next/previous work on supported browsers.
- A failed audio URL offers another recording or a clear recovery action.

### Milestone 4 — Queue and continuous listening

Deliver:

- Play Next, Add to Queue, remove, reorder, clear, and jump-to-item actions.
- End-of-track advancement.
- Repeat and shuffle modes.
- Queue restoration in a paused state after reload.
- Queue panel on desktop and sheet on mobile.

Acceptance:

- Queue transitions are deterministic under rapid next/previous input.
- Removing the current or upcoming item selects the documented next state.
- Shuffle retains every queue entry exactly once and can return to original order.
- Repeat one and repeat all behave correctly at queue boundaries.
- An unavailable track cannot trap the player in an error loop.

### Milestone 5 — Favorites, history, and installability

Deliver:

- Favorite controls in song rows and Now Playing.
- Library views for favorites and recent history.
- Versioned local persistence and migrations.
- Web app manifest, Apple touch icons, standalone display settings, safe-area handling, and dark-default theme colors.
- Optional service worker for app shell and metadata only.

Acceptance:

- Favorites and queue survive a normal browser restart.
- Corrupt or unavailable storage does not stop playback.
- Removed catalog IDs disappear gracefully.
- The app is installable in supported browsers.
- No audio file is placed in Cache Storage or the repository.

A web app manifest is the basis for installation, while service-worker caching is optional and should be added only with a clear update strategy. Reference: [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

### Milestone 6 — Release readiness

Deliver:

- Cross-browser and device test pass.
- Accessibility review and fixes.
- Performance budget enforcement.
- Privacy/source/about screen.
- Production error messaging and API compatibility checks.
- Updated README with development, test, build, and release instructions.

Acceptance:

- Current Safari on iPhone/iPad and macOS, Chrome on Android and desktop, and Firefox desktop pass the core journey.
- Browse content appears quickly on a typical mobile connection.
- Initial compressed JavaScript stays under 100 KB where practical.
- No layout shift occurs when artwork loads.
- Lighthouse accessibility and best-practice findings are reviewed, with material issues fixed.
- A manual test confirms play, seek, queue advancement, lock-screen controls, interruption recovery, and Bluetooth/headphone behavior.
- The production site and API workflows both pass.

## Test strategy

### Unit tests

Cover logic with high failure impact:

- URL resolution at every manifest level.
- Runtime schema rejection and error mapping.
- Recording preference selection.
- Queue insertion, removal, shuffle, repeat, and end-of-track transitions.
- Persistence parsing and version migration.
- Search normalization and ranking.

### Component and integration tests

Use fixed catalog fixtures to verify:

- Loading, success, empty, unsupported, and failed API states.
- Collection navigation and hash restoration.
- Mini player and Now Playing synchronization.
- Favorite changes across views.
- Keyboard navigation and dialog focus return.

Mock media events in automated tests. Do not depend on live Church audio in CI.

### Browser and device tests

Use Playwright for a small deterministic smoke suite against fixtures. Keep live-media checks manual or scheduled because upstream network behavior can be transient.

Representative manual checks:

- Vocal and accompaniment versions of the same hymn.
- A track with recording-specific artwork.
- A track with no artwork or duration.
- A broken recording URL with a valid alternate.
- iOS interruption, lock screen, wired/Bluetooth controls, and page backgrounding.
- Android media notification and backgrounding.
- Slow connection and offline reload.

## Performance budget

- Fetch only the manifest and version index on initial load.
- Lazy-load search and collection payloads.
- Use responsive image sizing and `loading="lazy"` outside the active player.
- Avoid decoding large artwork for off-screen rows.
- Virtualize only after profiling shows a real need; collection lists are preferable as semantic HTML when practical.
- Debounce search rendering, not keystroke capture.
- Keep animations on opacity and transforms; do not animate layout properties during navigation or playback transitions.
- Target 60 frames per second for active motion and under 100 ms visual response to taps and clicks on representative devices.
- Measure first contentful render, interaction latency, animation frame stability, memory during long queues, and artwork transfer size.

## Security, privacy, and rights

- Ship no secrets; all GitHub Pages files are public.
- Treat API strings as untrusted text and render them without `innerHTML`.
- Permit only expected HTTPS media and artwork URLs.
- Collect no analytics in the first release.
- Store listening state only in the browser and provide a Clear Local Data action.
- Do not proxy, download, or redistribute Church-hosted audio or artwork.
- Keep the independent-project notice and official source links visible.
- Review source terms and rights before a public launch beyond development testing.

## Recommended implementation decisions

- Target: everyday listening.
- Hosting: organization-root GitHub Pages site.
- API: `https://living-music.github.io/musicapi/`, schema version 1.
- Stack: Vite + TypeScript + Preact.
- Routing: hash routes.
- Playback: one `HTMLAudioElement`.
- Persistence: versioned `localStorage` for small user state.
- Default recording: vocal-first with remembered overrides.
- Offline: app shell and metadata only; no audio downloads.
- Initial language: English.
- Initial appearance: dark, with light and system-following options.
- Initial analytics: none.

## First implementation slice

Start with Milestone 1 and the smallest vertical path through Milestones 2 and 3:

1. Set up Vite, TypeScript, Preact, and the Pages build.
2. Load and validate the manifest and version index.
3. Render the collection grid.
4. Open one collection and render its song rows.
5. Play one selected recording through the shared audio engine.
6. Keep that track visible in a responsive mini player.
7. Deploy and verify the path on iPhone Safari and desktop Chrome.

This slice tests the highest-risk assumptions—catalog resolution, artwork, live media playback, responsive navigation, and GitHub Pages deployment—before queue and library features expand the state model.
