# Living Music

Living Music is an independent, Apple-native-feeling web player for music made available through The Church of Jesus Christ of Latter-day Saints music library. It is built as a static application and hosted at [living-music.github.io](https://living-music.github.io/).

The companion [musicapi](https://github.com/living-music/musicapi) repository publishes the optimized catalog at [living-music.github.io/musicapi](https://living-music.github.io/musicapi/).

## Status

Steps 1 through 5 of the first prototype are complete: the project has a typed Preact foundation, a responsive dark-default shell, live catalog browsing, persistent playback, expanded Now Playing, recording choices, and an editable queue. Search, favorites, and Library population begin in Step 6. See the [prototype checklist](docs/PROTOTYPE.md) and [implementation plan](docs/PLAN.md).

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
  components/               Catalog views, artwork, song rows, and mini player
  Icon.tsx                 Project-owned interface icons
  api.ts                   Versioned musicapi client and runtime validation
  audio.ts                 Recording choice and media formatting helpers
  player.ts                Shared HTMLAudioElement engine and playback state
  storage.ts               Defensive local favorites and theme persistence
  types.ts                 Catalog and player data contracts
  *.test.ts                Focused unit tests
docs/PLAN.md               Product and implementation plan
docs/BRAND.md              App icon concept, assets, and usage rules
docs/PROTOTYPE.md          Seven-step delivery checklist and current behavior
.github/workflows/pages.yml  Tested GitHub Pages build and deployment
site/                      Retired pre-tooling prototype; removal is deferred
```

## Playback

Open a collection and select any song with audio. Living Music chooses a vocal recording when available, begins playback from that user action, and keeps one mini player visible while navigating the app. The mini player provides play/pause, previous, next, elapsed and remaining time, and a seek control. Previous restarts the current song after three seconds and otherwise moves to the preceding playable song.

Select the song details in the mini player to open Now Playing. This view offers large artwork, alternate recording selection, full transport controls, repeat off/all/one, and the Up Next queue. A song row’s options menu can place that song next or at the end. Queue items can play immediately, move up or down, be removed, or be cleared together.

The queue and recording choice remain in memory for the current tab. Step 6 adds durable user-owned library state.

## Catalog contract

Production loads the same-origin catalog from `/musicapi/`. Local development defaults to the published API. The client first requests `index.json`, rejects unsupported schema versions, resolves the advertised version index, and resolves collection and search links against the document that declared them.

Catalog payloads are untrusted network input. The client validates collection summaries, songs, and recordings before rendering them, and all catalog strings are rendered as text. Null artwork fields may be omitted by the compact API; the interface provides a local fallback. Collection payloads are fetched only when their revisioned hash route is opened.

## Deployment

A push to `main` runs type-checking, unit tests, and a Vite production build. GitHub Actions uploads only `dist/` and deploys it to [living-music.github.io](https://living-music.github.io/). GitHub Pages must use **GitHub Actions** as its publishing source.

Everything in `dist/` is public. Never place credentials in source files, Vite environment variables, or Pages artifacts.

## Independence and media

Living Music is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints. The application stores catalog metadata and URLs; it does not copy Church-hosted audio or artwork into this repository. Public availability does not grant redistribution rights.
