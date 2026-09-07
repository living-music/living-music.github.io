import { useEffect, useRef, useState } from "preact/hooks";
import { Icon, type IconName } from "./Icon";
import { hrefFor, routeFromHash, type Destination } from "./router";
import { readTheme, writeTheme, type Theme } from "./storage";

interface NavigationItem {
  id: Destination;
  label: string;
  icon: IconName;
}

const navigation: NavigationItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "browse", label: "Browse", icon: "browse" },
  { id: "search", label: "Search", icon: "search" },
  { id: "library", label: "Library", icon: "heart" },
];

const pageTitles: Record<Destination, string> = {
  home: "Home",
  browse: "Browse",
  search: "Search",
  library: "Library",
};

function Navigation({ current, mobile = false }: { current: Destination; mobile?: boolean }) {
  return (
    <nav class={mobile ? "mobile-navigation" : "sidebar-navigation"} aria-label="Primary">
      {navigation.map((item) => (
        <a
          class={`navigation-item ${current === item.id ? "is-current" : ""}`}
          href={hrefFor(item.id)}
          aria-current={current === item.id ? "page" : undefined}
        >
          <Icon name={item.icon} filled={current === item.id && item.id === "library"} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header class="page-header">
      <p class="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p class="page-description">{description}</p>
    </header>
  );
}

function HomePage() {
  return (
    <div class="page page-home">
      <PageHeader
        eyebrow="Listen now"
        title="Music for quiet moments."
        description="A simple home for sacred music, designed to keep listening close and distractions out of the way."
      />

      <section class="hero-card" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="section-kicker">Your library, made calmer</p>
          <h2 id="hero-title">Find the music you need, then keep listening.</h2>
          <p>Collections, search, favorites, and an always-available player are being connected one careful step at a time.</p>
          <a class="primary-action" href="#/browse">
            Explore the library
            <Icon name="chevron" size={18} />
          </a>
        </div>
        <img class="hero-icon" src="/app-icon-512.png" alt="" />
      </section>

      <section class="section-block" aria-labelledby="shortcuts-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Start here</p>
            <h2 id="shortcuts-title">A place for every kind of listening</h2>
          </div>
        </div>
        <div class="shortcut-grid">
          <a class="shortcut-card green" href="#/browse">
            <span class="shortcut-icon"><Icon name="browse" /></span>
            <span><strong>Browse</strong><small>Explore every collection</small></span>
            <Icon name="chevron" size={18} />
          </a>
          <a class="shortcut-card blue" href="#/search">
            <span class="shortcut-icon"><Icon name="search" /></span>
            <span><strong>Search</strong><small>Find a song quickly</small></span>
            <Icon name="chevron" size={18} />
          </a>
          <a class="shortcut-card violet" href="#/library">
            <span class="shortcut-icon"><Icon name="heart" /></span>
            <span><strong>Library</strong><small>Return to your favorites</small></span>
            <Icon name="chevron" size={18} />
          </a>
        </div>
      </section>
    </div>
  );
}

function BrowsePage() {
  return (
    <div class="page">
      <PageHeader
        eyebrow="All music"
        title="Browse"
        description="Collections will appear here directly from the Living Music catalog."
      />
      <section class="empty-state" aria-labelledby="browse-empty-title">
        <div class="empty-icon"><Icon name="browse" size={30} /></div>
        <h2 id="browse-empty-title">The shelves are ready.</h2>
        <p>Live collection artwork and song lists arrive in Step 3. The navigation and responsive layout are ready now.</p>
        <a class="secondary-action" href="https://living-music.github.io/musicapi/">
          View the catalog API
          <Icon name="chevron" size={17} />
        </a>
      </section>
    </div>
  );
}

function SearchPage() {
  return (
    <div class="page">
      <PageHeader
        eyebrow="Find a song"
        title="Search"
        description="Search will use the global 5,070-song index without downloading every collection."
      />
      <div class="search-field is-preview">
        <Icon name="search" size={20} />
        <input aria-label="Search music" placeholder="Search songs" disabled />
      </div>
      <section class="empty-state compact" aria-labelledby="search-empty-title">
        <h2 id="search-empty-title">Search is the next listening tool.</h2>
        <p>The field is shown in its final location. It becomes interactive when the global search step is connected.</p>
      </section>
    </div>
  );
}

function ThemeSelector({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  const choices: { id: Theme; label: string }[] = [
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
    { id: "system", label: "System" },
  ];

  return (
    <fieldset class="theme-setting">
      <legend>Appearance</legend>
      <p>Dark is the default. Choose the appearance that feels best on this device.</p>
      <div class="segmented-control">
        {choices.map((choice) => (
          <button
            type="button"
            class={theme === choice.id ? "is-selected" : ""}
            aria-pressed={theme === choice.id}
            onClick={() => onChange(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function LibraryPage({ theme, onThemeChange }: { theme: Theme; onThemeChange: (theme: Theme) => void }) {
  return (
    <div class="page">
      <PageHeader
        eyebrow="Your music"
        title="Library"
        description="Favorites and listening preferences stay privately on this device."
      />
      <div class="library-grid">
        <section class="empty-state compact" aria-labelledby="favorites-title">
          <div class="empty-icon"><Icon name="heart" size={28} /></div>
          <h2 id="favorites-title">Favorites will live here.</h2>
          <p>Favorite songs become available when live browsing and playback are connected.</p>
        </section>
        <ThemeSelector theme={theme} onChange={onThemeChange} />
      </div>
    </div>
  );
}

export function App() {
  const [destination, setDestination] = useState<Destination>(() => routeFromHash(window.location.hash));
  const [theme, setTheme] = useState<Theme>(readTheme);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleHashChange = () => {
      setDestination(routeFromHash(window.location.hash));
      requestAnimationFrame(() => mainRef.current?.focus());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    document.title = `${pageTitles[destination]} · Living Music`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [destination]);

  const changeTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    writeTheme(nextTheme);
    const light = nextTheme === "light" ||
      (nextTheme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f2f2f7" : "#08080a");
  };

  return (
    <div class="app-shell">
      <a class="skip-link" href="#main-content">Skip to content</a>

      <aside class="sidebar">
        <a class="brand" href="#/home" aria-label="Living Music home">
          <img src="/app-icon-192.png" alt="" />
          <span>Living Music</span>
        </a>
        <Navigation current={destination} />
        <div class="sidebar-footer">
          <p>Independent project</p>
          <a href="https://www.churchofjesuschrist.org/media/music/collections/all-music?lang=eng">
            Official music library
          </a>
        </div>
      </aside>

      <header class="mobile-header">
        <a class="mobile-brand" href="#/home" aria-label="Living Music home">
          <img src="/app-icon-192.png" alt="" />
          <span>Living Music</span>
        </a>
      </header>

      <main id="main-content" class="content" ref={mainRef} tabIndex={-1}>
        {destination === "home" && <HomePage />}
        {destination === "browse" && <BrowsePage />}
        {destination === "search" && <SearchPage />}
        {destination === "library" && <LibraryPage theme={theme} onThemeChange={changeTheme} />}
        <footer class="content-footer">
          Living Music is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints.
        </footer>
      </main>

      <Navigation current={destination} mobile />
    </div>
  );
}
