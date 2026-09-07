# Living Music

Living Music is an independent, Apple-native-feeling web player for music made available through The Church of Jesus Christ of Latter-day Saints music library. It is built as a static application and hosted at [living-music.github.io](https://living-music.github.io/).

The companion [musicapi](https://github.com/living-music/musicapi) repository publishes the optimized catalog at [living-music.github.io/musicapi](https://living-music.github.io/musicapi/).

## Status

The first seven-step prototype is complete. It supports live browsing, playback, Now Playing, an editable queue, global search, favorites, a populated Library, durable on-device listening state, and system media controls. See the [release notes](docs/RELEASE.md), [prototype checklist](docs/PROTOTYPE.md), and [implementation plan](docs/PLAN.md).

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
npm test           # Run focused unit tests once
npm run build      # Type-check and create dist/
npm run preview    # Serve the production build locally
```

## Project layout

```text
index.html                 Vite document entry and pre-render theme bootstrap
public/                    Static PWA files copied into dist/
src/
  App.tsx                  Application shell, catalog state, and top-level views
  components/               Catalog, search, Library, artwork, and player views
  Icon.tsx                 Project-owned interface icons
  api.ts                   Versioned musicapi client and runtime validation
  audio.ts                 Recording choice and media formatting helpers
  player.ts                Shared HTMLAudioElement engine and playback state
  media-session.ts          Lock-screen and hardware media-control integration
  storage.ts               Defensive local user-state and theme persistence
  types.ts                 Catalog and player data contracts
  *.test.ts                Focused unit tests
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

The browser Media Session API connects playback to supported lock screens, Control Center surfaces, keyboards, and headset controls. When focus is outside an interactive control, Space toggles playback. Saved songs and albums with their add timestamps, the queue, repeat mode, and recording preferences are stored under the versioned `livingMusic:userState:v1` key. On reload, valid catalog entries are restored in a paused state; removed songs or recordings are discarded or replaced safely.

## Search and Library

Search opens the compact global index only when Search or Library is visited. Queries ignore case and accents, accept multiple non-adjacent words, and match song titles, numbers, artists, and collection names. Selecting a result then downloads only its collection payload before playback. Large result sets show the first 80 entries to keep rendering responsive.

Heart controls in collections, search results, Library song lists, and Now Playing manage Favorites independently. Adjacent add/check controls manage individual Library songs, while collection pages can add whole albums. Library exposes Favorites, Recently Added, Albums, and Songs in the desktop sidebar and a compact mobile switcher. Recently Added groups Library songs by album and sorts each album by its newest device-local add timestamp; Albums includes both explicitly added albums and albums containing Library songs. Opening an album from Library shows only its individually added songs unless the complete album was added. Existing combined saved-song data migrates into both Favorites and Library Songs so prior choices are preserved. A separate Playlists sidebar section supports locally persisted playlist creation, rename, deletion, and direct playlist routes.

## Catalog contract

Production loads the same-origin catalog from `/musicapi/`. Local development defaults to the published API. The client first requests `index.json`, rejects unsupported schema versions, resolves the advertised version index, and resolves collection and search links against the document that declared them.

Catalog payloads are untrusted network input. The client validates collection summaries, songs, and recordings before rendering them, and all catalog strings are rendered as text. Null artwork fields may be omitted by the compact API; the interface provides a local fallback. Collection payloads are fetched only when their revisioned hash route is opened.

## Deployment

A push to `main` runs type-checking, unit tests, and a Vite production build. GitHub Actions uploads only `dist/` and deploys it to [living-music.github.io](https://living-music.github.io/). GitHub Pages must use **GitHub Actions** as its publishing source.

Everything in `dist/` is public. Never place credentials in source files, Vite environment variables, or Pages artifacts.

## Independence and media

Living Music is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints. The application stores catalog metadata and URLs; it does not copy Church-hosted audio or artwork into this repository. Public availability does not grant redistribution rights.
