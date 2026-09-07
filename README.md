# Living Music

Living Music is an independent, Apple-native-feeling web player for music made available through The Church of Jesus Christ of Latter-day Saints music library. It is built as a static application and hosted at [living-music.github.io](https://living-music.github.io/).

The companion [musicapi](https://github.com/living-music/musicapi) repository publishes the optimized catalog at [living-music.github.io/musicapi](https://living-music.github.io/musicapi/).

## Status

Step 1 of the first prototype is complete: the project has a typed Preact foundation, a Vite production build, focused unit tests, PWA metadata, and a GitHub Pages deployment workflow. The checked-in screen is intentionally small; navigation, live browsing, and playback are delivered in the following prototype steps described in [the implementation plan](docs/PLAN.md).

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
  App.tsx                  Current application entry screen
  Icon.tsx                 Project-owned interface icons
  api.ts                   Versioned musicapi client and runtime validation
  audio.ts                 Recording choice and media formatting helpers
  storage.ts               Defensive local favorites and theme persistence
  types.ts                 Catalog and player data contracts
  *.test.ts                Focused unit tests
docs/PLAN.md               Product and implementation plan
.github/workflows/pages.yml  Tested GitHub Pages build and deployment
site/                      Retired pre-tooling prototype; removal is deferred
```

## Catalog contract

Production loads the same-origin catalog from `/musicapi/`. Local development defaults to the published API. The client first requests `index.json`, rejects unsupported schema versions, resolves the advertised version index, and resolves collection and search links against the document that declared them.

Catalog payloads are untrusted network input. Required envelope fields receive runtime checks, and rendering code must continue to treat all catalog strings as text.

## Deployment

A push to `main` runs type-checking, unit tests, and a Vite production build. GitHub Actions uploads only `dist/` and deploys it to [living-music.github.io](https://living-music.github.io/). GitHub Pages must use **GitHub Actions** as its publishing source.

Everything in `dist/` is public. Never place credentials in source files, Vite environment variables, or Pages artifacts.

## Independence and media

Living Music is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints. The application stores catalog metadata and URLs; it does not copy Church-hosted audio or artwork into this repository. Public availability does not grant redistribution rights.
