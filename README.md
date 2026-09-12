# Living Music

Living Music is an independent, Apple-native-feeling web player for music made available through The Church of Jesus Christ of Latter-day Saints music library. It is built as a static application and hosted at [living-music.github.io](https://living-music.github.io/).

The companion [musicapi](https://github.com/living-music/musicapi) repository publishes the optimized catalog at [living-music.github.io/musicapi](https://living-music.github.io/musicapi/).

## Status

The first seven-step prototype is complete. It supports live browsing, playback, Now Playing, an editable queue, global search, favorites, a populated Library, durable on-device listening state, and system media controls. All three post-prototype PWA phases are complete: offline-ready catalog updates, installation polish, durable IndexedDB listener data, and listener-selected offline music. See the [release notes](docs/RELEASE.md), [prototype checklist](docs/PROTOTYPE.md), and [implementation plan](docs/PLAN.md#post-prototype-pwa-roadmap).

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Local development

Install the locked dependencies and start Vite:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. On localhost, the client uses the published catalog API automatically.

To use another catalog, create an untracked `.env.local` file:

```text
VITE_MUSIC_API_ROOT=http://127.0.0.1:8080/
```

The value must resolve to a catalog root containing `index.json`.

## Commands

```sh
npm run dev        # Start the local development server
npm run typecheck  # Validate TypeScript
npm test              # Run focused unit tests once
npm run build         # Type-check and create dist/
npm run test:browser  # Test the built PWA in Chromium
npm run preview       # Serve the production build locally
```

## Project layout

```text
index.html                 Vite document entry and pre-render theme bootstrap
public/                    Static PWA files copied into dist/
scripts/                   Content-addressed service-worker generation and tests
src/
  App.tsx                  Application shell, catalog state, and top-level views
  components/               Catalog, search, Library, artwork, and player views
  Icon.tsx                 Project-owned interface icons
  api.ts                   Versioned musicapi client and runtime validation
  connectivity.ts          Catalog failure classification and connection state
  pwa.ts                   Service-worker registration, updates, and cache status
  audio.ts                 Recording choice and media formatting helpers
  player.ts                Shared HTMLAudioElement engine and playback state
  media-session.ts          Lock-screen and hardware media-control integration
  storage.ts               User-state validation and synchronous theme persistence
  persistence.ts           IndexedDB migration, backups, and storage management
  install.ts               Install-prompt and standalone-mode handling
  downloads.ts             Explicit media downloads, progress, recovery, and reconciliation
  types.ts                 Catalog and player data contracts
  *.test.ts                Focused unit tests
tests/browser/             Production offline and update smoke tests
playwright.config.ts        Browser PWA test configuration
docs/PLAN.md               Product and implementation plan
docs/BRAND.md              App icon concept, assets, and usage rules
docs/PROTOTYPE.md          Seven-step delivery checklist and current behavior
docs/RELEASE.md            Prototype scope, QA record, limits, and release process
CHANGELOG.md               User-visible release history
.github/workflows/pages.yml  Tested GitHub Pages build and deployment
```

## Playback

Open a collection and select any song with audio. Living Music chooses a vocal recording when available, begins playback from that user action, and keeps one mini player visible while navigating the app. The mini player provides play/pause, previous, next, elapsed and remaining time, and a seek control. Previous restarts the current song after three seconds and otherwise moves to the preceding playable song.

Select the song details in the mini player to open Now Playing. This view offers large artwork, alternate recording selection, full transport controls, repeat off/all/one, and the Up Next queue. A song row’s options menu can place that song next or at the end. Queue items can play immediately, move up or down, be removed, or be cleared together.

The browser Media Session API connects playback to supported lock screens, Control Center surfaces, keyboards, and headset controls. When focus is outside an interactive control, Space toggles playback. Saved songs and albums with their add timestamps, the queue, repeat mode, and recording preferences are stored in the versioned `livingMusic` IndexedDB database. On reload, valid catalog entries are restored in a paused state; removed songs or recordings are discarded or replaced safely.

## Search and Library

Search opens the compact global index only when Search or Library is visited. Queries ignore case and accents, accept multiple non-adjacent words, and match song titles, numbers, artists, and collection names. Selecting a result then downloads only its collection payload before playback. Large result sets show the first 80 entries to keep rendering responsive.

Heart controls in collections, search results, Library song lists, and Now Playing add songs to the fixed Favorites playlist and ensure they are also in Library. Unfavoriting leaves Library membership intact. Adjacent add/check controls manage individual Library songs, while collection pages can add whole albums. Library exposes Recently Added, Albums, and Songs in the desktop sidebar and a compact mobile switcher. Favorites appears first under Playlists as a fixed smart playlist that cannot be renamed or deleted and sorts songs by favorite date, newest first. Recently Added groups Library songs by album and sorts each album by its newest device-local add timestamp; Albums includes both explicitly added albums and albums containing Library songs. Opening an album from Library shows only its individually added songs unless the complete album was added. Existing combined saved-song data migrates into both Favorites and Library Songs so prior choices are preserved. Existing `livingMusic:userState:v1` data is copied and verified before its source record is removed. A separate Playlists sidebar section supports locally persisted playlist creation, rename, deletion, and direct playlist routes. Right-clicking any song opens a shared context menu for favorite, Library, queue, and playlist actions; overflow buttons expose the same menu without a pointer. Songs added to a playlist appear in insertion order on its detail page. Playing any row continues through that playlist order, while the playlist Play and Random buttons start from the beginning in saved or randomized order.

## Offline catalog and updates

Production registers a generated service worker that precaches the document, hashed JavaScript and CSS, the web manifest, and local icons. Every shell file has a content-derived cache key. The worker fetches that revisioned URL and verifies its SHA-256 digest before accepting it, so a partially propagated Pages deployment cannot label an older CDN response as current. Deployments reuse only byte-verified unchanged entries and install atomically. A completed update waits for the listener to select **Update now**, then activates the verified shell and reloads under its control without interrupting playback before approval.

The service worker maintains a separate `living-music-catalog-v1` runtime cache. `/musicapi/index.json` uses network-first loading with the last complete manifest as fallback; its referenced index must be available before that fallback is replaced. Revisioned catalog indexes, search data, and opened collections use cache-first loading, retaining the two newest responses for each logical path. The interface identifies offline, saved-catalog, upstream, unsupported-schema, and malformed-data states and retries the catalog automatically when connectivity returns. Church-hosted audio remains outside automatic caching. Artwork uses a separate bounded cache on view.

## Installation and local data

Living Music can be installed from the Local data area below Library settings. Browsers with an install prompt provide a direct **Install** action; iPhone and iPad show Safari’s Share → Add to Home Screen instructions. Installed windows hide this promotion. The manifest launches into Browse and includes shortcuts for Browse, Search, Favorites, and Playlists.

Library, Favorites, albums, playlists, queue position, repeat mode, and recording choices live in IndexedDB. Theme stays in `localStorage` so the correct appearance can be applied before rendering. After meaningful listener data is created, the app asks the browser for persistent storage and reports a denial without interrupting playback. Library settings show storage use and provide versioned JSON export, validated import, and a confirmed Clear Local Data action. Browsers without IndexedDB retain the prior local-storage record and show limited-storage status.


## Offline music

Choose **Download** from a song’s right-click or overflow menu, or use the Download action on an album or playlist. Living Music saves the selected recording directly from its official Church URL and adds the song to Library. Downloaded, queued, active, failed, and stale states appear beside song rows and in their menus. **Library → Downloaded** collects the recordings available without a connection.

Downloads remain local to the current browser profile. Readable media responses show byte progress and support cached byte-range seeking; non-CORS media uses opaque browser caching with indeterminate progress. Interrupted downloads become retryable after restart. When the catalog changes a recording URL, the old copy stays playable and is marked for an optional update. Removing audio leaves Library, Favorites, albums, and playlists intact.

Library settings report downloaded-audio size and overall browser usage, and can remove all downloads or clear all local listener data. Artwork caching is bounded to 60 recently viewed or downloaded images. See the [media compatibility record](docs/OFFLINE_MEDIA.md) for tested hosts, browser behavior, and the personal-use boundary.

## Catalog contract

Production loads the same-origin catalog from `/musicapi/`. Local development defaults to the published API. The client first requests `index.json`, rejects unsupported schema versions, resolves the advertised version index, and resolves collection and search links against the document that declared them.

Catalog payloads are untrusted network input. The client validates collection summaries, songs, and recordings before rendering them, and all catalog strings are rendered as text. Null artwork fields may be omitted by the compact API; the interface provides a local fallback. Collection payloads are fetched only when their revisioned hash route is opened.

## Deployment

A push to `main` runs type-checking, unit tests, and a Vite production build. GitHub Actions uploads only `dist/` and deploys it to [living-music.github.io](https://living-music.github.io/). GitHub Pages must use **GitHub Actions** as its publishing source.

Everything in `dist/` is public. Never place credentials in source files, Vite environment variables, or Pages artifacts.

## Independence and media

Living Music is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints. The application stores catalog metadata and URLs; it does not copy Church-hosted audio or artwork into this repository. Public availability does not grant redistribution rights.
