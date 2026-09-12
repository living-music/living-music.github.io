# Living Music prototype release

## Version 0.1.0 — September 7, 2026

This release completes the first Living Music prototype at [living-music.github.io](https://living-music.github.io/). It is a static Preact application backed by the separately published, revisioned [musicapi catalog](https://living-music.github.io/musicapi/).

## Included

- Dark-first, responsive navigation for Home, Browse, Search, Library, and collection routes
- Lazy catalog and collection fetching with runtime validation, retry states, and local artwork fallbacks
- One shared audio engine with vocal-first recording choice, seeking, previous/next, and automatic advancement
- Responsive Now Playing, alternate recordings, repeat modes, and an editable Up Next queue
- Accent- and case-insensitive global search over the compact search index
- IndexedDB-backed Library, favorites, playlists, queue, repeat mode, and recording preferences with verified migration and JSON backup/restore
- Media Session metadata and play, pause, previous-track, next-track, and timeline-seek handlers where browsers support them
- Install guidance, shortcuts, screenshots, dedicated icon purposes, social metadata, safe-area layouts, reduced-motion/transparency, contrast, and forced-colors adaptations
- Explicit song, album, and playlist downloads with offline playback, seeking, recovery, source reconciliation, and independent cleanup

## Architecture

The Pages artifact is produced from `index.html`, `src/`, and `public/`. Hash routes keep direct navigation compatible with a static root domain. The app requests `/musicapi/index.json`, follows revisioned links declared by that response, and downloads full collection records only when playback or a collection page requires them. No server, account, or remote application database is involved. Production can report sanitized page views to Google Analytics 4 after an explicit listener choice; Settings provides an off switch, advertising features are disabled, and private content and identifiers are excluded.

Audio and artwork remain on Church-managed media hosts. Living Music stores only catalog references and the listener's preferences in the browser's IndexedDB storage. A reload restores the queue paused and never attempts autoplay.

## QA record

The release gate is:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. Desktop and 390 px responsive smoke tests against the production bundle
6. Live checks for the root document, revisioned catalog, search, playback controls, persistence, and absence of horizontal overflow

For this release, 62 unit tests and 23 Chromium browser tests pass and Vite produces the production artifact with no type errors. Automated browser checks use current Chromium. Safari 27 is the WebKit reference on macOS; the implementation uses standard HTML audio and treats Media Session, backdrop blur, and install affordances as progressive enhancements. Firefox should retain the full in-page player even when operating-system media surfaces vary.

## Known limits

- Listener data is local to one browser profile and does not sync across devices; JSON backup and restore supports manual transfer.
- Search renders at most 80 results per query, while still reporting the complete result count.
- Church-hosted audio is cached only after an explicit Download action. CORS-readable media supports precise progress and cached range seeking; opaque media has indeterminate progress and relies on full-response playback.
- Playback and artwork depend on the continued public availability and cross-origin behavior of Church media hosts.
- Media Session controls and home-screen installation vary by browser and operating system.
- The interface and catalog currently use English metadata.

## Deployment and rollback

A push to `main` builds and type-checks the app in `.github/workflows/pages.yml`, then deploys only `dist/` through GitHub Pages. The full unit and Playwright suite lives in `.github/workflows/checks.yml` and can be started when needed from **Actions → Run Living Music checks → Run workflow**. The repository's Pages source must remain **GitHub Actions**.

To roll back, revert the problem commit on `main` and push the revert. The workflow rebuilds and redeploys the prior source. Catalog releases are independent; musicapi's stable manifest selects its current revision.

## Project status

The PWA is suitable for everyday browsing, queueing, favorites, listening, installation, and listener-selected offline music. The next product cycle focuses on real-device Safari and Android verification, production feedback, and media-host compatibility monitoring.

Living Music is an independent project and is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints.
