# Living Music

A static webapp in development for a simpler listening experience with music from The Church of Jesus Christ of Latter-day Saints.

## Status

Base repository initialized. The site is a responsive starting page with a link to the official music library; in-app playback and a music catalog are not implemented yet. Product scope and architecture are proposed in [the app plan](docs/PLAN.md).

The companion catalog API is published at [https://living-music.github.io/musicapi/](https://living-music.github.io/musicapi/).

## Run locally

Requires Python 3. No package installation or build step is needed.

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

Open http://127.0.0.1:8000. Use an HTTP server rather than opening the HTML file directly, since future modules and catalog fetching will require HTTP.

## Project layout

```text
site/                    Public files; only this folder is deployed
  index.html             Accessible starting page
  styles.css             Responsive styles
  app.js                 Browser module entry point
docs/PLAN.md             Product scope, architecture, milestones, open decisions
.github/workflows/       GitHub Pages deployment
```

## GitHub Pages

This repository is the organization site for the `living-music` GitHub organization. Its canonical URL is [https://living-music.github.io/](https://living-music.github.io/).

The deployment workflow uploads `site/`, placing `site/index.html` at the domain root. In **Settings → Pages**, the publishing source is **GitHub Actions**. Relative asset paths keep styles, scripts, and navigation rooted correctly at `/`.

Keep credentials out of public files: everything in `site/` is downloadable. GitHub Pages supplies static hosting, so catalog maintenance happens before deployment rather than on a server at runtime.

## Development direction

Start with standard HTML, CSS, browser JavaScript modules, and a single native audio element. Revisit a framework when the approved interface warrants it. Add focused checks as catalog and playback behavior are implemented; this base has no automated test suite.

Living Music is a working name. This is an independent project, not affiliated with or endorsed by the Church. A source-code license has not yet been selected; any eventual code license will not grant rights to third-party music or artwork.
