# Living Music

A static webapp in development for a simpler listening experience with music from The Church of Jesus Christ of Latter-day Saints.

## Status

Base repository initialized. The site is a responsive starting page with a link to the official music library; in-app playback and a music catalog are not implemented yet. Product scope and architecture are proposed in [the app plan](docs/PLAN.md).

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

1. Create a GitHub repository and push this local repository to its `main` branch.
2. In the repository’s **Settings → Pages**, select **GitHub Actions** as the source.
3. Run the **Deploy static site to GitHub Pages** workflow, or push a change to `main`.

The workflow uploads only `site/`. It follows [GitHub’s custom workflow guidance](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). Relative asset paths support both a root site and a project URL such as `https://USERNAME.github.io/living-music/`. No remote repository or deployed site has been created by this initialization.

Keep credentials out of public files: everything in `site/` is downloadable. GitHub Pages supplies static hosting, so any catalog maintenance will happen before deployment, not on a server at runtime.

## Development direction

Start with standard HTML, CSS, browser JavaScript modules, and a single native audio element. Revisit a framework when the approved interface warrants it. Add focused checks as catalog and playback behavior are implemented; this base has no automated test suite.

Living Music is a working name. This is an independent project, not affiliated with or endorsed by the Church. A source-code license has not yet been selected; any eventual code license will not grant rights to third-party music or artwork.
