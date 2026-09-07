# Living Music prototype release

## Version 0.1.0 — September 7, 2026

This release completes the first Living Music prototype at [living-music.github.io](https://living-music.github.io/). It is a static Preact application backed by the separately published, revisioned [musicapi catalog](https://living-music.github.io/musicapi/).

## Included

- Dark-first, responsive navigation for Home, Browse, Search, Library, and collection routes
- Lazy catalog and collection fetching with runtime validation, retry states, and local artwork fallbacks
- One shared audio engine with vocal-first recording choice, seeking, previous/next, and automatic advancement
- Responsive Now Playing, alternate recordings, repeat modes, and an editable Up Next queue
- Accent- and case-insensitive global search over the compact search index
- On-device favorites, queue, repeat mode, and recording preferences with defensive migration
- Media Session metadata and play, pause, previous, next, and seek handlers where browsers support them
- Manifest, Apple touch icon, social metadata, safe-area layouts, reduced-motion/transparency, contrast, and forced-colors adaptations

## Architecture

The Pages artifact is produced from `index.html`, `src/`, and `public/`. Hash routes keep direct navigation compatible with a static root domain. The app requests `/musicapi/index.json`, follows revisioned links declared by that response, and downloads full collection records only when playback or a collection page requires them. No server, account, analytics, cookie, or application database is involved.

Audio and artwork remain on Church-managed media hosts. Living Music stores only catalog references and the listener's preferences in local browser storage. A reload restores the queue paused and never attempts autoplay.

## QA record

The release gate is:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. Desktop and 390 px responsive smoke tests against the production bundle
6. Live checks for the root document, revisioned catalog, search, playback controls, persistence, and absence of horizontal overflow

For this release, 27 unit tests pass and Vite produces the production artifact with no type errors. Automated browser checks use current Chromium. Safari 27 is the WebKit reference on macOS; the implementation uses standard HTML audio and treats Media Session, backdrop blur, and install affordances as progressive enhancements. Firefox should retain the full in-page player even when operating-system media surfaces vary.

## Known limits

- Favorites and queue state are local to one browser profile and do not sync across devices.
- Search renders at most 80 results per query, while still reporting the complete result count.
- Offline listening is unavailable. There is no service worker and audio is never pre-cached.
- Playback and artwork depend on the continued public availability and cross-origin behavior of Church media hosts.
- Media Session controls and home-screen installation vary by browser and operating system.
- The interface and catalog currently use English metadata.

## Deployment and rollback

A push to `main` runs the complete release gate in `.github/workflows/pages.yml` and deploys only `dist/` through GitHub Pages. The repository's Pages source must remain **GitHub Actions**.

To roll back, revert the problem commit on `main` and push the revert. The workflow rebuilds and redeploys the prior source. Catalog releases are independent; musicapi's stable manifest selects its current revision.

## Project status

This prototype is suitable for everyday browsing, queueing, favorites, and listening. The next product cycle can focus on feedback from real use, larger-library navigation, richer collection grouping, and optional offline app-shell support.

Living Music is an independent project and is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints.
