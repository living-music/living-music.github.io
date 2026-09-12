# Prototype delivery checklist

The first Living Music prototype is split into seven independently reviewable steps.

| Step | Status | Deliverable |
| --- | --- | --- |
| 1. Project foundation | Complete | Vite, TypeScript, Preact, tests, production build, and Pages workflow |
| 2. Dark Apple-native shell | Complete | Responsive navigation, destination layouts, appearance control, safe areas, and motion/accessibility foundations |
| 3. Live catalog browsing | Complete | Catalog index, collection artwork, lazy collection pages, and API error states |
| 4. Core playback | Complete | Shared audio engine, vocal-first selection, transport controls, seeking, and mini player |
| 5. Now Playing and queue | Complete | Expanded player, recording choices, Up Next, and track advancement |
| 6. Search, favorites, and Library | Complete | Global search, local favorites, and populated Library |
| 7. Polish, documentation, and deployment | Complete | Media Session, cross-browser QA, cleanup, and release documentation |

## Step 2 behavior

The shell owns four GitHub Pages-safe hash routes:

- `#/home`
- `#/browse` (default when no route is present)
- `#/search`
- `#/library/favorites`
- `#/library/recent`
- `#/library/albums`
- `#/library/songs`
- `#/library/album/<collection-id>`
- `#/playlists`
- `#/playlist/<playlist-id>`

Desktop layouts use a fixed sidebar. Screens at 760 px and below use a fixed header and labeled bottom navigation. Both account for browser safe-area insets. Route changes update the document title, restore the top scroll position, and focus the main content region.

Dark appearance is the default and is set before CSS or Preact loads. Library provides Dark, Light, and System choices, stored under `livingMusic:theme`. Reduced-motion and reduced-transparency preferences have CSS fallbacks.

At the end of Step 2, Search and favorites remain preview states; Browse and collection song lists gain live data in Step 3.

## Step 3 behavior

Home loads six featured collections and Browse presents the complete catalog from `https://living-music.github.io/musicapi/`. The client follows the manifest’s revisioned version link and validates summaries before displaying them.

Each collection has a GitHub Pages-safe route at `#/collection/<collection-id>`. Opening it fetches only that collection’s revisioned payload, validates its songs and recordings, and displays the artwork, source link, audio availability, and song list. Collection requests are cached for the session; failed requests can be retried.

Loading skeletons preserve the final layout. Network, HTTP, malformed-data, and unsupported-schema failures receive a retry action and a link to the official music library. Missing or failed artwork uses the Living Music note fallback. Step 3 presents song rows as catalog information; Step 4 makes playable rows interactive.

## Step 4 behavior

Selecting a playable song creates an in-memory sequence from the playable songs in its collection and starts the vocal recording when one is available. A single shared `HTMLAudioElement` owns playback across route changes. It reacts to media loading, play, pause, time, duration, ended, and error events rather than inferring browser state.

The persistent mini player shows artwork, song and recording labels, elapsed and remaining time, a keyboard-accessible seek control, and previous, play/pause, and next actions. On phones it sits above the labeled navigation bar and keeps the primary controls reachable at 390 px without horizontal overflow. Playback automatically advances to the next playable song. The previous action restarts after three seconds or moves back near the beginning of a track.

Unavailable song rows are disabled and labeled. Media errors stay visible in the player and selecting another playable song recovers. Playback always starts from a listener action; a reload does not automatically resume audio. Queue editing, recording choices, and the expanded Now Playing surface remain Step 5 work.

## Step 5 behavior

Selecting the song and recording details in the mini player opens an accessible Now Playing dialog. Desktop uses a centered two-region sheet for playback and Up Next; phones use a full-screen, safe-area-aware surface. Escape and the close control dismiss it, keyboard focus remains inside while open, and focus returns to the mini player.

Now Playing offers large artwork, a native alternate-recording selector, a larger seek control, transport controls, and repeat off, all, and one. Changing recordings keeps the same song selected and starts the chosen version. Repeat state and next-button availability stay synchronized.

Each playable song row exposes Play Next and Add to End. Up Next supports immediate playback, move up, move down, remove, and clear actions. Queue edits never interrupt the current recording, and unavailable songs cannot enter the queue. Step 5 initially keeps the queue and recording selection in the session; Step 6 adds validated persistence and paused restoration.

## Step 6 behavior

Search fetches the revisioned compact search index only when Search or Library opens. Case- and accent-insensitive terms match titles, song numbers, artists, and collection names; every term may appear separately in the searchable text. The interface reports the full match count and renders at most 80 results at once. Playing a result lazily resolves its full song from the owning collection, so the 5,070-song catalog does not require eager collection downloads.

Heart controls in collection rows, search results, Library lists, and Now Playing add a song to Favorites and Library together; unfavoriting leaves it in Library. Separate add/check controls manage per-song Library membership, and collection pages can add a whole album. Library provides Recently Added, Albums, and Songs in the desktop sidebar and a compact mobile switcher. Favorites is the fixed first playlist under Playlists, cannot be renamed or deleted, and sorts songs newest-first by favorite timestamp. Recently Added groups Library songs by album and sorts albums by their newest listener add time. Albums includes explicitly added albums and albums inferred from Library songs; opening one through Library shows only added songs unless the whole album belongs to Library. The Playlists sidebar section supports creating, renaming, deleting, and opening device-local playlists. Song rows open a shared action menu on right-click or from their overflow button, including Add to Playlist. Playlist pages resolve their song IDs through the compact search index and retain insertion order. Starting a song queues the remaining playlist sequence, while Play and Random controls start the full playlist in saved or randomized order. Catalog IDs that disappear are ignored safely.

A validated `livingMusic:userState:v1` record stores Favorites, Library songs, albums, and playlists with separate add timestamps where applicable, queue references, current queue position, repeat mode, the global preferred recording type, and per-song recording preferences. Legacy favorite IDs and previously combined saved songs migrate into both Favorites and Library Songs automatically. On reload the client resolves valid queue references against the current revisioned catalog and restores the selected track paused, preserving browser autoplay expectations. Malformed storage, unavailable storage, removed songs, and removed recordings degrade to valid defaults.


## Step 7 behavior

Supported browsers receive Media Session metadata for the active title, artist, collection, and artwork. Lock-screen, headset, keyboard, and operating-system controls can play, pause, move between tracks, and seek. The integration treats every Media Session feature as optional so browsers with partial or no support retain the complete in-page player. Space toggles playback when keyboard focus is outside a link or form control.

The app adds higher-contrast and forced-colors adaptations, complete sharing and install metadata, and dedicated release notes. The retired static prototype has been removed, leaving Vite's source and `dist/` as the only application paths. Automated tests cover catalog validation, audio selection, queue behavior, storage migration, routing, search, and Media Session actions. Production QA checks the responsive 390 px layout, desktop layout, live API, local persistence, and the minified Pages build.
