# Prototype delivery checklist

The first Living Music prototype is split into seven independently reviewable steps.

| Step | Status | Deliverable |
| --- | --- | --- |
| 1. Project foundation | Complete | Vite, TypeScript, Preact, tests, production build, and Pages workflow |
| 2. Dark Apple-native shell | Complete | Responsive navigation, destination layouts, appearance control, safe areas, and motion/accessibility foundations |
| 3. Live catalog browsing | Next | Catalog index, collection artwork, lazy collection pages, and API error states |
| 4. Core playback | Planned | Shared audio engine, vocal-first selection, transport controls, seeking, and mini player |
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

Browse, Search, favorites, and playback content remain explicit preview states. They do not imply that live catalog or audio behavior is available before its scheduled step.
