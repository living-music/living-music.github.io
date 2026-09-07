# Prototype delivery checklist

The first Living Music prototype is split into seven independently reviewable steps.

| Step | Status | Deliverable |
| --- | --- | --- |
| 1. Project foundation | Complete | Vite, TypeScript, Preact, tests, production build, and Pages workflow |
| 2. Dark Apple-native shell | Complete | Responsive navigation, destination layouts, appearance control, safe areas, and motion/accessibility foundations |
| 3. Live catalog browsing | Complete | Catalog index, collection artwork, lazy collection pages, and API error states |
| 4. Core playback | Next | Shared audio engine, vocal-first selection, transport controls, seeking, and mini player |
| 5. Now Playing and queue | Planned | Expanded player, recording choices, Up Next, and track advancement |
| 6. Search, favorites, and Library | Planned | Global search, local favorites, and populated Library |
| 7. Polish, documentation, and deployment | Planned | Media Session, cross-browser QA, cleanup, and release documentation |

## Step 2 behavior

The shell owns four GitHub Pages-safe hash routes:

- `#/home`
- `#/browse`
- `#/search`
- `#/library`

Desktop layouts use a fixed sidebar. Screens at 760 px and below use a fixed header and labeled bottom navigation. Both account for browser safe-area insets. Route changes update the document title, restore the top scroll position, and focus the main content region.

Dark appearance is the default and is set before CSS or Preact loads. Library provides Dark, Light, and System choices, stored under `livingMusic:theme`. Reduced-motion and reduced-transparency preferences have CSS fallbacks.

Search, favorites, and playback remain explicit preview states. Browse and collection song lists now use live catalog data.

## Step 3 behavior

Home loads six featured collections and Browse presents the complete catalog from `https://living-music.github.io/musicapi/`. The client follows the manifest’s revisioned version link and validates summaries before displaying them.

Each collection has a GitHub Pages-safe route at `#/collection/<collection-id>`. Opening it fetches only that collection’s revisioned payload, validates its songs and recordings, and displays the artwork, source link, audio availability, and song list. Collection requests are cached for the session; failed requests can be retried.

Loading skeletons preserve the final layout. Network, HTTP, malformed-data, and unsupported-schema failures receive a retry action and a link to the official music library. Missing or failed artwork uses the Living Music note fallback. Song rows are informational until playback is added in Step 4.
