export function App() {
  return (
    <main class="foundation">
      <section class="foundation-card" aria-labelledby="page-title">
        <div class="app-mark" aria-hidden="true">
          <img src="/app-icon-192.png" alt="" />
        </div>
        <p class="eyebrow">Living Music</p>
        <h1 id="page-title">A calmer way to listen.</h1>
        <p class="lede">
          The new player foundation is ready. Live browsing and playback arrive in
          the next prototype steps.
        </p>
        <div class="status" role="status">
          <span class="status-dot" aria-hidden="true" />
          Catalog client ready
        </div>
        <a class="catalog-link" href="https://living-music.github.io/musicapi/">
          View catalog API
        </a>
      </section>
      <p class="independent-note">
        An independent project. Not affiliated with or endorsed by The Church of
        Jesus Christ of Latter-day Saints.
      </p>
    </main>
  );
}
