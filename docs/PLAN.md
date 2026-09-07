# Living Music app plan

Status: proposal for discussion, September 7, 2026. Only the base repository is implemented.

## Purpose

Make it easy to find a song, choose a recording, and keep listening to music from the Church library. Design for phones first, with large controls, readable song titles, keyboard access, and a player that stays available while browsing.

## Confirmed constraints

- Static webapp deployable to GitHub Pages.
- Music comes from the Church of Jesus Christ of Latter-day Saints music library.
- Plan and implement incrementally with the project owner.
- First-version priority: everyday listening through browsing, queues, and favorites (confirmed by the owner).

## Proposed first release

Confirmed audience: everyday listeners. Browsing, queues, and favorites define the first-version listening journey.

1. Browse a small English-language catalog from one agreed collection.
2. Search by song title or number and select an available recording version.
3. Play/pause, seek, move to the previous/next track, and see what is playing.
4. Queue songs and continue to the next item when a recording ends.
5. Favorite songs locally on the current device.

Keep the first release focused. Accounts, cross-device sync, offline audio, lyrics, sheet music, and a complete multilingual catalog are later decisions. A local favorites list is not a cloud backup.

## Music sources: first investigation

The Church lists collections in its [Music Library](https://www.churchofjesuschrist.org/music/library?country=usa&lang=eng) and offers an [All Music](https://www.churchofjesuschrist.org/media/music/collections/all-music?lang=eng) browsing surface. These are discovery sources, not verified third-party APIs. A reliable machine-readable catalog or supported integration has not been established.

Before wiring playback:

- Choose 5–10 tracks in one collection; record the official song pages and exact audio URLs without guessing paths.
- Determine which recording versions exist and how they are labeled.
- Review applicable source terms and track-specific restrictions; record the basis for using each recording. Availability on a public page does not by itself establish permission for this app.
- Verify direct playback, seeking/range requests, redirects, and URL stability from a browser on another origin. An audio element can often stream cross-origin without fetch access; fetching metadata or processing audio may require CORS permission. Test the actual operation.
- Keep official source-page links available when recordings are unavailable. Do not introduce a proxy or copy audio into the repository as an automatic workaround.
- Document whether catalog maintenance can use a supported feed, a permitted build-time import, or a small curated manifest. Do not scrape the entire library before resolving this.

Deliverable: a short source-investigation note and a reviewed sample manifest. If direct streaming is unsuitable, decide whether to use source links or pursue another authorized approach.

## Architecture proposal

The checked-in public site is served directly by GitHub Pages. There is no build step or runtime backend. This keeps deployment simple and leaves framework choice open.

As functionality grows, split browser modules into catalog loading/search, player state, and local storage. Keep one `HTMLAudioElement` as the playback source of truth. Derive play/pause/loading/error state from its events and handle rejected `play()` promises. Start audio only following user interaction; evaluate lock-screen controls with the Media Session API after basic playback works.

Publish a versioned JSON catalog alongside the app. Use relative URLs for app assets and catalog fetches so project subpaths work. If we add shareable views, use hash-based routes unless we deliberately generate separate HTML pages; history routes would need a Pages-compatible fallback.

Proposed records (not an implemented schema):

| Entity | Fields |
| --- | --- |
| Collection | Stable ID, title, language, official source page |
| Song | Stable ID, collection ID, title, optional number, language, official source page |
| Recording | Stable ID, song ID, version label, audio URL, optional duration, source page, last-verified date, usage notes |

Separate songs from recordings so vocal, instrumental, or other versions do not become duplicate songs. Only represent versions verified at the source. Use nullable durations rather than invented values.

Store favorites and queue references by stable IDs with a storage schema version. Handle blocked storage, corrupted data, and deleted catalog entries without breaking playback. Review localStorage versus IndexedDB when the data size is known.

## Milestones and acceptance criteria

### 0 — Base repository (complete)

Local Git repository, static starting page, GitHub Pages workflow, run instructions, and this planning document. No music copied or playback implied.

### 1 — Source feasibility

Approve a small collection and document verified recording URLs, usage basis, and cross-origin playback/seek results. Identify the maintenance approach and unresolved limitations.

### 2 — First playable slice

Load the small manifest; browse/search; choose a recording; play, pause, and seek. Show loading, empty-catalog, no-search-results, and media-error states. Preserve a link to the official source. Verify on desktop and a real mobile browser.

### 3 — Continuous listening

Add queue, next/previous, end-of-track progression, and local favorites. Verify a rejected play request, an unavailable next track, rapid track changes, refresh recovery, and unavailable browser storage. Decide shuffle/repeat behavior with the owner.

### 4 — Release readiness

Check keyboard navigation, screen-reader labels, visible focus, text enlargement, and narrow screens. Test at a GitHub Pages project subpath. Verify Safari/iOS and Chrome/Android playback, including interruptions and background behavior, and document limitations observed on devices. Publish after the owner chooses the GitHub repository and approves release scope.

## Decisions to make together

- First collection and language: existing hymns, Hymns—For Home and Church, children’s songs, or another collection?
- What is most frustrating about the current library: finding music, choosing recordings, continuous play, or organizing favorites?
- Is Living Music the final name? What visual tone should the app have?
- Which source-code license and GitHub repository should we use?

Recommended next step: agree on the listening journey and first collection, then complete the source-feasibility milestone before building a larger interface.
