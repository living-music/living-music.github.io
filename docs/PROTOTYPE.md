# Prototype delivery checklist

The first Living Music prototype is split into seven independently reviewable steps.

| Step | Status | Deliverable |
| --- | --- | --- |
| 1. Project foundation | Complete | Vite, TypeScript, Preact, tests, production build, and Pages workflow |
| 2. Dark Apple-native shell | Complete | Responsive navigation, destination layouts, appearance control, safe areas, and motion/accessibility foundations |
| 3. Live catalog browsing | Complete | Catalog index, collection artwork, lazy collection pages, and API error states |
| 4. Core playback | Complete | Shared audio engine, vocal-first selection, transport controls, seeking, and mini player |
| 5. Now Playing and queue | Next | Expanded player, recording choices, Up Next, and track advancement |
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

Search and favorites remain explicit preview states. Browse and collection song lists use live catalog data.

## Step 3 behavior

Home loads six featured collections and Browse presents the complete catalog from `https://living-music.github.io/musicapi/`. The client follows the manifest’s revisioned version link and validates summaries before displaying them.

Each collection has a GitHub Pages-safe route at `#/collection/<collection-id>`. Opening it fetches only that collection’s revisioned payload, validates its songs and recordings, and displays the artwork, source link, audio availability, and song list. Collection requests are cached for the session; failed requests can be retried.

Loading skeletons preserve the final layout. Network, HTTP, malformed-data, and unsupported-schema failures receive a retry action and a link to the official music library. Missing or failed artwork uses the Living Music note fallback. Step 3 presents song rows as catalog information; Step 4 makes playable rows interactive.

## Step 4 behavior

Selecting a playable song creates an in-memory sequence from the playable songs in its collection and starts the vocal recording when one is available. A single shared `HTMLAudioElement` owns playback across route changes. It reacts to media loading, play, pause, time, duration, ended, and error events rather than inferring browser state.

The persistent mini player shows artwork, song and recording labels, elapsed and remaining time, a keyboard-accessible seek control, and previous, play/pause, and next actions. On phones it sits above the labeled navigation bar and keeps the primary controls reachable at 390 px without horizontal overflow. Playback automatically advances to the next playable song. The previous action restarts after three seconds or moves back near the beginning of a track.

Unavailable song rows are disabled and labeled. Media errors stay visible in the player and selecting another playable song recovers. Playback always starts from a listener action; a reload does not automatically resume audio. Queue editing, recording choices, and the expanded Now Playing surface remain Step 5 work.
