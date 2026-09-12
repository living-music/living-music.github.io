# Offline media compatibility

Checked September 11, 2026 against representative URLs published by the Living Music catalog.

## Live endpoint results

Small `Range: bytes=0-1023` requests confirmed that the active Church media hosts accept byte ranges:

| Host | Example format | Range result | Browser-readable CORS | Living Music strategy |
| --- | --- | --- | --- | --- |
| `media2.ldscdn.org` | MP3 and MP4 | `206 Partial Content`, `Accept-Ranges: bytes` | Yes, `Access-Control-Allow-Origin: *` | Cache the full response, report byte progress, and synthesize cached `206` responses for seeking. |
| `assets.churchofjesuschrist.org` | MP3 and MP4 | `206 Partial Content` with a valid `Content-Range` | No exposed allow-origin header for Living Music | Cache an opaque response, show indeterminate progress, and return the complete cached response to media requests. |
| `broadcast2.lds.org` → `broadcast-portal.lds.org` | Legacy MP3 | Redirect followed by `206 Partial Content` | No exposed allow-origin header | Follow the browser redirect and use opaque-response caching. |

A Chromium production-preview check cached one 2.9 MB CORS-readable MP3 and one 4.9 MB opaque MP3. With browser networking disabled, both loaded metadata, started playback, and sought to one second from Cache Storage. Their reported durations were 143.151 and 152.256 seconds. The automated release suite separately verifies deterministic cached `206` responses, offline seeking, sequential playlist advancement, removal, quota failure, interruption recovery, and catalog-source reconciliation.

Opaque responses do not expose content length or a readable stream. Living Music therefore measures their approximate storage effect after caching and cannot show reliable byte progress while they download. Safari and installed mobile behavior remain part of the device release checklist because media-cache behavior can vary by browser.

## Storage and request model

- Audio and video enter `living-music-downloads-v1` only after the listener chooses Download for a song, album, or playlist.
- Playback keeps the catalog URL as metadata and resolves a saved source only inside the audio engine.
- Readable cached responses support byte-range slicing in the service worker. Opaque responses remain intact because browser security rules prevent reading or slicing their bytes.
- Each recording has a durable IndexedDB record keyed by its stable recording ID and source URL.
- Interrupted work becomes retryable at startup. A complete cached response found after interruption is recovered as downloaded.
- A changed or removed catalog source becomes stale while the saved response remains available. The listener can update or remove it.
- Quota failures update only the download record. Library, Favorites, playlists, and existing downloads are stored independently.
- Recently viewed and downloaded artwork uses a separate cache capped at 60 entries.

## Rights boundary

Living Music does not proxy, upload, or republish Church media. The browser requests the original Church URL and stores the response only on the listener's device after an explicit action. The Church’s [Rights and Use Information](https://newsroom.churchofjesuschrist.org/rights-and-use?lang=eng) permits individuals to view and download site materials for personal, noncommercial use, subject to item-specific restrictions and the current terms. The [Gospel Media FAQ](https://www.churchofjesuschrist.org/tools/help/frequently-asked-questions-about-gospel-media?lang=eng) directs users to the permissions guidance when a proposed use is uncertain. Living Music keeps official source links visible and describes its downloads as personal on-device copies.
