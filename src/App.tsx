import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { CatalogClient } from "./api";
import { chooseRecording } from "./audio";
import { CatalogError, CatalogSkeleton, CollectionGrid, CollectionPage } from "./components/CatalogViews";
import { Icon, type IconName } from "./Icon";
import { MiniPlayer, NowPlaying } from "./components/Player";
import { SearchExperience } from "./components/SearchLibrary";
import { LibraryViews } from "./components/LibraryViews";
import { PlaylistDialog, PlaylistPage, PlaylistsPage, type PlaylistDialogState } from "./components/Playlists";
import { AudioEngine, type PlayerSnapshot, type PlayerTrack } from "./player";
import { MediaSessionController } from "./media-session";
import { toggleFavoriteInState } from "./library-state";
import { createPlaylist as createPlaylistRecord, deletePlaylist as deletePlaylistRecord, renamePlaylist as renamePlaylistRecord } from "./playlists";
import { hrefFor, hrefForLibrary, hrefForPlaylist, navigationDestination, routeFromHash, type Destination, type LibraryView, type Route } from "./router";
import { readTheme, readUserState, writeTheme, writeUserState, type Playlist, type Theme, type UserState } from "./storage";
import type { CatalogIndex, CollectionSummary, SearchSong, Song } from "./types";

interface NavigationItem {
  id: Destination;
  label: string;
  icon: IconName;
}

type CatalogState =
  | { status: "loading" }
  | { status: "ready"; index: CatalogIndex }
  | { status: "error"; message: string };

const catalogClient = new CatalogClient();

const navigation: NavigationItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "browse", label: "Browse", icon: "browse" },
  { id: "search", label: "Search", icon: "search" },
];

const libraryNavigation: { id: LibraryView; label: string }[] = [
  { id: "recent", label: "Recently Added" },
  { id: "albums", label: "Albums" },
  { id: "songs", label: "Songs" },
];

const pageTitles: Record<Destination, string> = {
  home: "Home",
  browse: "Browse",
  search: "Search",
  library: "Library",
};

function Navigation({
  current,
  libraryView,
  playlists,
  currentPlaylistId,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  mobile = false,
}: {
  current: Destination;
  libraryView?: LibraryView;
  playlists: Playlist[];
  currentPlaylistId?: string;
  onCreatePlaylist: () => void;
  onRenamePlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (playlist: Playlist) => void;
  mobile?: boolean;
}) {
  const [openPlaylistMenu, setOpenPlaylistMenu] = useState<string>();
  const items: NavigationItem[] = mobile
    ? [...navigation, { id: "library", label: "Library", icon: "heart" }]
    : navigation;
  return (
    <nav class={mobile ? "mobile-navigation" : "sidebar-navigation"} aria-label="Primary">
      {items.map((item) => (
        <a
          class={`navigation-item ${current === item.id ? "is-current" : ""}`}
          href={hrefFor(item.id)}
          aria-current={current === item.id ? "page" : undefined}
          key={item.id}
        >
          <Icon name={item.icon} filled={current === item.id && item.id === "library"} />
          <span>{item.label}</span>
        </a>
      ))}
      {!mobile && (
        <div class="library-navigation" aria-label="Library">
          <p class="library-navigation-title">Library</p>
          {libraryNavigation.map((item) => (
            <a
              class={`library-navigation-item ${current === "library" && libraryView === item.id ? "is-current" : ""}`}
              href={hrefForLibrary(item.id)}
              aria-current={current === "library" && libraryView === item.id ? "page" : undefined}
              key={item.id}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
      {!mobile && (
        <div class="playlist-navigation" aria-label="Playlists">
          <div class="playlist-navigation-heading">
            <a href="#/playlists">Playlists</a>
            <button type="button" onClick={onCreatePlaylist} aria-label="Create playlist"><Icon name="add" size={16} /></button>
          </div>
          <div class="playlist-navigation-row playlist-navigation-favorites">
            <a
              class={libraryView === "favorites" ? "is-current" : ""}
              href={hrefForLibrary("favorites")}
              aria-current={libraryView === "favorites" ? "page" : undefined}
            >
              <Icon name="heart" filled size={16} />
              <span>Favorites</span>
            </a>
          </div>
          {playlists.map((playlist) => (
            <div class="playlist-navigation-row" key={playlist.id}>
              <a
                class={currentPlaylistId === playlist.id ? "is-current" : ""}
                href={hrefForPlaylist(playlist.id)}
                aria-current={currentPlaylistId === playlist.id ? "page" : undefined}
              >
                <Icon name="music" size={16} />
                <span>{playlist.name}</span>
              </a>
              <button
                type="button"
                class="playlist-more-button"
                onClick={() => setOpenPlaylistMenu(openPlaylistMenu === playlist.id ? undefined : playlist.id)}
                aria-label={`Options for ${playlist.name}`}
                aria-expanded={openPlaylistMenu === playlist.id}
              >
                <Icon name="more" size={17} />
              </button>
              {openPlaylistMenu === playlist.id && (
                <div class="playlist-navigation-menu">
                  <button type="button" onClick={() => { setOpenPlaylistMenu(undefined); onRenamePlaylist(playlist); }}>Rename</button>
                  <button type="button" class="is-destructive" onClick={() => { setOpenPlaylistMenu(undefined); onDeletePlaylist(playlist); }}>Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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

function CatalogSection({
  state,
  onRetry,
  featured = false,
}: {
  state: CatalogState;
  onRetry: () => void;
  featured?: boolean;
}) {
  if (state.status === "loading") return <CatalogSkeleton count={featured ? 6 : 10} />;
  if (state.status === "error") return <CatalogError message={state.message} onRetry={onRetry} />;

  const collections = featured ? state.index.collections.slice(0, 6) : state.index.collections;
  return <CollectionGrid collections={collections} label={featured ? "Featured collections" : "All collections"} />;
}

function HomePage({ catalog, onRetry }: { catalog: CatalogState; onRetry: () => void }) {
  return (
    <div class="page page-home">
      <PageHeader
        eyebrow="Listen now"
        title="Music for quiet moments."
        description="A simple home for sacred music, designed to keep listening close and distractions out of the way."
      />

      <section class="hero-card" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="section-kicker">The complete catalog</p>
          <h2 id="hero-title">Find the music you need, then keep listening.</h2>
          <p>Explore collections from the Church music library through a calm, focused interface.</p>
          <a class="primary-action" href="#/browse">
            Explore the library
            <Icon name="chevron" size={18} />
          </a>
        </div>
        <img class="hero-icon" src="/app-icon-512.png" alt="" />
      </section>

      <section class="section-block" aria-labelledby="featured-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Start listening</p>
            <h2 id="featured-title">Featured collections</h2>
          </div>
          <a class="section-link" href="#/browse">See all <Icon name="chevron" size={16} /></a>
        </div>
        <CatalogSection state={catalog} onRetry={onRetry} featured />
      </section>

      <section class="section-block" aria-labelledby="shortcuts-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">More ways to listen</p>
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
          <a class="shortcut-card violet" href={hrefFor("library")}>
            <span class="shortcut-icon"><Icon name="heart" /></span>
            <span><strong>Library</strong><small>Songs, albums, and playlists</small></span>
            <Icon name="chevron" size={18} />
          </a>
        </div>
      </section>
    </div>
  );
}

function BrowsePage({ catalog, onRetry }: { catalog: CatalogState; onRetry: () => void }) {
  const stats = catalog.status === "ready" ? catalog.index.stats : undefined;
  return (
    <div class="page">
      <PageHeader
        eyebrow="All music"
        title="Browse"
        description={stats
          ? `${stats.collectionCount.toLocaleString()} collections and ${stats.songCount.toLocaleString()} songs from the Living Music catalog.`
          : "Explore every collection in the Living Music catalog."}
      />
      <CatalogSection state={catalog} onRetry={onRetry} />
    </div>
  );
}

function SearchPage({
  catalog,
  favorites,
  librarySongs,
  player,
  onRetry,
  onToggleFavorite,
  onToggleLibrarySong,
  onPlay,
}: {
  catalog: CatalogState;
  favorites: Set<string>;
  librarySongs: Set<string>;
  player: PlayerSnapshot;
  onRetry: () => void;
  onToggleFavorite: (songId: string) => void;
  onToggleLibrarySong: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  return (
    <div class="page">
      <PageHeader
        eyebrow="Find a song"
        title="Search"
        description="Search the complete catalog without downloading every collection."
      />
      {catalog.status === "loading" && <CatalogSkeleton count={7} />}
      {catalog.status === "error" && <CatalogError message={catalog.message} onRetry={onRetry} />}
      {catalog.status === "ready" && (
        <SearchExperience
          client={catalogClient}
          catalog={catalog.index}
          favorites={favorites}
          librarySongs={librarySongs}
          currentSongId={player.track?.song.id}
          playerStatus={player.status}
          onToggleFavorite={onToggleFavorite}
          onToggleLibrarySong={onToggleLibrarySong}
          onPlay={onPlay}
        />
      )}
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
            key={choice.id}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function LibraryPage({
  view,
  theme,
  onThemeChange,
  catalog,
  favorites,
  favoriteAddedAt,
  librarySongs,
  librarySongAddedAt,
  albums,
  albumAddedAt,
  player,
  onRetry,
  onToggleFavorite,
  onToggleLibrarySong,
  onPlay,
}: {
  view: LibraryView;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  catalog: CatalogState;
  favorites: Set<string>;
  favoriteAddedAt: Record<string, string>;
  librarySongs: Set<string>;
  librarySongAddedAt: Record<string, string>;
  albums: Set<string>;
  albumAddedAt: Record<string, string>;
  player: PlayerSnapshot;
  onRetry: () => void;
  onToggleFavorite: (songId: string) => void;
  onToggleLibrarySong: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const viewCopy: Record<LibraryView, { title: string; description: string }> = {
    favorites: { title: "Favorites", description: "Songs you marked as favorites, with the newest additions first." },
    recent: { title: "Recently Added", description: "Your Library music grouped by album and ordered by when you added it." },
    albums: { title: "Albums", description: "Albums you added and albums containing songs in your Library." },
    songs: { title: "Songs", description: "Every song you added to your Library, arranged alphabetically." },
    videos: { title: "Music Videos", description: "Video performances you added to your Library." },
  };
  const copy = viewCopy[view];
  return (
    <div class="page">
      <PageHeader
        eyebrow={view === "favorites" ? "Playlist" : "Library"}
        title={copy.title}
        description={copy.description}
      />
      {view === "favorites" ? (
        <a class="back-link playlist-mobile-back" href="#/playlists"><Icon name="back" size={18} /> Playlists</a>
      ) : (
        <nav class="library-mobile-navigation" aria-label="Library views">
          {libraryNavigation.map((item) => (
            <a
              class={view === item.id ? "is-current" : ""}
              href={hrefForLibrary(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              key={item.id}
            >
              {item.label}
            </a>
          ))}
          <a href="#/playlists">Playlists</a>
        </nav>
      )}
      <div class="library-content">
        {catalog.status === "loading" && <CatalogSkeleton count={5} />}
        {catalog.status === "error" && <CatalogError message={catalog.message} onRetry={onRetry} />}
        {catalog.status === "ready" && (
          <LibraryViews
            view={view}
            client={catalogClient}
            catalog={catalog.index}
            favorites={favorites}
            favoriteAddedAt={favoriteAddedAt}
            librarySongs={librarySongs}
            librarySongAddedAt={librarySongAddedAt}
            albums={albums}
            albumAddedAt={albumAddedAt}
            currentSongId={player.track?.song.id}
            playerStatus={player.status}
            onToggleFavorite={onToggleFavorite}
            onToggleLibrarySong={onToggleLibrarySong}
            onPlay={onPlay}
          />
        )}
        {view !== "favorites" && (
          <div class="library-settings">
            <ThemeSelector theme={theme} onChange={onThemeChange} />
          </div>
        )}
      </div>
    </div>
  );
}

function MissingCollection({ library = false }: { library?: boolean }) {
  return (
    <div class="page">
      <a class="back-link" href={library ? "#/library/albums" : "#/browse"}><Icon name="back" size={18} /> {library ? "Albums" : "Browse"}</a>
      <section class="empty-state" role="alert">
        <div class="empty-icon"><Icon name="music" size={28} /></div>
        <h1 class="empty-title">Collection not found.</h1>
        <p>This collection is not part of the current catalog. It may have moved after the catalog was refreshed.</p>
        <a class="primary-action" href="#/browse">Browse all collections</a>
      </section>
    </div>
  );
}

export function App() {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;
  const mediaSessionRef = useRef<MediaSessionController | null>(null);
  if (!mediaSessionRef.current) mediaSessionRef.current = new MediaSessionController(engine);
  const [player, setPlayer] = useState<PlayerSnapshot>(engine.state);
  const [userState, setUserState] = useState<UserState>(readUserState);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [playlistDialog, setPlaylistDialog] = useState<PlaylistDialogState>();
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const mainRef = useRef<HTMLElement>(null);
  const restoredQueue = useRef(false);
  const favorites = useMemo(() => new Set(userState.favorites), [userState.favorites]);
  const librarySongs = useMemo(() => new Set(userState.librarySongs), [userState.librarySongs]);
  const albums = useMemo(() => new Set(userState.albums), [userState.albums]);

  useEffect(() => engine.subscribe(setPlayer), [engine]);

  useEffect(() => {
    mediaSessionRef.current?.update(player);
  }, [player]);

  useEffect(() => () => mediaSessionRef.current?.destroy(), []);

  useEffect(() => {
    const handlePlaybackShortcut = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.metaKey || event.ctrlKey || event.altKey || !engine.state.track) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button, input, select, textarea, a, [contenteditable='true']")) return;
      event.preventDefault();
      engine.toggle();
    };
    window.addEventListener("keydown", handlePlaybackShortcut);
    return () => window.removeEventListener("keydown", handlePlaybackShortcut);
  }, [engine]);

  useEffect(() => {
    writeUserState(userState);
  }, [userState]);

  useEffect(() => {
    if (restoredQueue.current || catalog.status !== "ready") return;
    restoredQueue.current = true;
    if (!userState.queue.length) return;
    const catalogIndex = catalog.index;
    let active = true;

    void Promise.all(userState.queue.map(async (reference, originalIndex) => {
      const summary = catalogIndex.collections.find((entry) => entry.id === reference.collectionId);
      if (!summary) return undefined;
      try {
        const payload = await catalogClient.loadCollection(summary);
        const song = payload.songs.find((entry) => entry.id === reference.songId);
        if (!song) return undefined;
        const recording = song.recordings.find((entry) => entry.id === reference.recordingId)
          || chooseRecording(song, userState.songRecordingPreferences[song.id] || userState.preferredRecordingType);
        if (!recording) return undefined;
        const track: PlayerTrack = {
          song,
          recording,
          collectionId: summary.id,
          collectionTitle: summary.title,
          artworkUrl: recording.artworkUrl || song.artworkUrl || summary.artworkUrl,
        };
        return { track, originalIndex };
      } catch {
        return undefined;
      }
    })).then((entries) => {
      if (!active) return;
      const valid = entries.filter((entry): entry is { track: PlayerTrack; originalIndex: number } => Boolean(entry));
      if (!valid.length) return;
      const requested = Math.max(0, userState.currentQueueIndex);
      const restoredIndex = Math.max(0, valid.filter((entry) => entry.originalIndex <= requested).length - 1);
      engine.restoreQueue(valid.map((entry) => entry.track), restoredIndex, userState.repeatMode);
    });

    return () => { active = false; };
  }, [catalog, engine]);

  useEffect(() => {
    if (!restoredQueue.current || !player.track) return;
    setUserState((current) => ({
      ...current,
      queue: player.queue.map((track) => ({
        songId: track.song.id,
        collectionId: track.collectionId,
        recordingId: track.recording.id,
      })),
      currentQueueIndex: player.currentIndex,
      repeatMode: player.repeatMode,
    }));
  }, [player.queue, player.currentIndex, player.repeatMode, player.track?.recording.id]);

  useEffect(() => {
    let active = true;
    setCatalog({ status: "loading" });
    catalogClient.loadIndex().then(
      (index) => active && setCatalog({ status: "ready", index }),
      (error: unknown) => active && setCatalog({
        status: "error",
        message: error instanceof Error ? error.message : "An unexpected catalog error occurred.",
      }),
    );
    return () => { active = false; };
  }, [catalogAttempt]);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(routeFromHash(window.location.hash));
      requestAnimationFrame(() => mainRef.current?.focus());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const isCollection = route.page === "collection" || route.page === "library-album";
    const collectionTitle = isCollection && catalog.status === "ready"
      ? catalog.index.collections.find((entry) => entry.id === route.collectionId)?.title
      : undefined;
    const fallbackTitle = route.page === "library-album"
      ? "Library Album"
      : route.page === "collection"
        ? "Collection"
        : route.page === "playlist"
          ? userState.playlists.find((playlist) => playlist.id === route.playlistId)?.name || "Playlist"
          : route.page === "playlists"
            ? "Playlists"
            : pageTitles[route.page];
    document.title = `${collectionTitle || fallbackTitle} · Living Music`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route, catalog, userState.playlists]);

  const changeTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    writeTheme(nextTheme);
    const light = nextTheme === "light" ||
      (nextTheme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f2f2f7" : "#08080a");
  };

  const closeNowPlaying = useCallback(() => {
    setNowPlayingOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>("#now-playing-trigger")?.focus());
  }, []);

  const preferredRecording = (songId: string) =>
    userState.songRecordingPreferences[songId] || userState.preferredRecordingType;

  const toggleFavorite = (songId: string) => {
    const timestamp = new Date().toISOString();
    setUserState((current) => toggleFavoriteInState(current, songId, timestamp));
  };

  const toggleLibrarySong = (songId: string) => {
    setUserState((current) => {
      const next = new Set(current.librarySongs);
      const librarySongAddedAt = { ...current.librarySongAddedAt };
      if (next.has(songId)) {
        next.delete(songId);
        delete librarySongAddedAt[songId];
      } else {
        next.add(songId);
        librarySongAddedAt[songId] = new Date().toISOString();
      }
      return { ...current, librarySongs: [...next], librarySongAddedAt };
    });
  };

  const toggleAlbum = (albumId: string) => {
    setUserState((current) => {
      const next = new Set(current.albums);
      const albumAddedAt = { ...current.albumAddedAt };
      if (next.has(albumId)) {
        next.delete(albumId);
        delete albumAddedAt[albumId];
      } else {
        next.add(albumId);
        albumAddedAt[albumId] = new Date().toISOString();
      }
      return { ...current, albums: [...next], albumAddedAt };
    });
  };

  const playSong = (song: Song, songs: Song[], sourceCollection: CollectionSummary) => {
    engine.playCollection(songs, sourceCollection, song.id, preferredRecording(song.id));
  };

  const playSearchSong = async (result: SearchSong) => {
    if (catalog.status !== "ready") throw new Error("The catalog is still loading.");
    const summary = catalog.index.collections.find((entry) => entry.id === result.collectionId);
    if (!summary) throw new Error("This song’s collection is no longer available.");
    const payload = await catalogClient.loadCollection(summary);
    const song = payload.songs.find((entry) => entry.id === result.id);
    if (!song) throw new Error("This song is no longer available in its collection.");
    engine.playCollection(payload.songs, summary, song.id, preferredRecording(song.id));
  };

  const changeRecording = (recordingId: string) => {
    const recording = player.track?.song.recordings.find((entry) => entry.id === recordingId);
    const songId = player.track?.song.id;
    engine.changeRecording(recordingId);
    if (recording && songId) {
      setUserState((current) => ({
        ...current,
        preferredRecordingType: recording.type,
        songRecordingPreferences: { ...current.songRecordingPreferences, [songId]: recording.type },
      }));
    }
  };

  const createPlaylist = (name: string) => {
    const now = new Date().toISOString();
    const playlist = createPlaylistRecord(name, crypto.randomUUID(), now);
    setUserState((current) => ({ ...current, playlists: [...current.playlists, playlist] }));
    setPlaylistDialog(undefined);
    window.location.hash = hrefForPlaylist(playlist.id);
  };

  const renamePlaylist = (playlistId: string, name: string) => {
    const now = new Date().toISOString();
    setUserState((current) => ({
      ...current,
      playlists: renamePlaylistRecord(current.playlists, playlistId, name, now),
    }));
    setPlaylistDialog(undefined);
  };

  const deletePlaylist = (playlistId: string) => {
    setUserState((current) => ({
      ...current,
      playlists: deletePlaylistRecord(current.playlists, playlistId),
    }));
    setPlaylistDialog(undefined);
    if (route.page === "playlist" && route.playlistId === playlistId) window.location.hash = "#/playlists";
  };

  const currentDestination = navigationDestination(route);
  const currentLibraryView = route.page === "library" ? route.view : route.page === "library-album" ? "albums" : undefined;
  const currentPlaylistId = route.page === "playlist" ? route.playlistId : undefined;
  const currentPlaylist = currentPlaylistId ? userState.playlists.find((playlist) => playlist.id === currentPlaylistId) : undefined;
  const retryCatalog = () => setCatalogAttempt((attempt) => attempt + 1);
  const collectionRoute = route.page === "collection" || route.page === "library-album";
  const collection = collectionRoute && catalog.status === "ready"
    ? catalog.index.collections.find((entry) => entry.id === route.collectionId)
    : undefined;

  return (
    <div class={`app-shell ${player.track ? "has-player" : ""}`}>
      <a class="skip-link" href="#main-content">Skip to content</a>

      <aside class="sidebar">
        <a class="brand" href="#/home" aria-label="Living Music home">
          <img src="/app-icon-192.png" alt="" />
          <span>Living Music</span>
        </a>
        <Navigation
          current={currentDestination}
          libraryView={currentLibraryView}
          playlists={userState.playlists}
          currentPlaylistId={currentPlaylistId}
          onCreatePlaylist={() => setPlaylistDialog({ mode: "create" })}
          onRenamePlaylist={(playlist) => setPlaylistDialog({ mode: "rename", playlist })}
          onDeletePlaylist={(playlist) => setPlaylistDialog({ mode: "delete", playlist })}
        />
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
        {route.page === "home" && <HomePage catalog={catalog} onRetry={retryCatalog} />}
        {route.page === "browse" && <BrowsePage catalog={catalog} onRetry={retryCatalog} />}
        {route.page === "search" && (
          <SearchPage
            catalog={catalog}
            favorites={favorites}
            librarySongs={librarySongs}
            player={player}
            onRetry={retryCatalog}
            onToggleFavorite={toggleFavorite}
            onToggleLibrarySong={toggleLibrarySong}
            onPlay={playSearchSong}
          />
        )}
        {route.page === "library" && (
          <LibraryPage
            view={route.view}
            theme={theme}
            onThemeChange={changeTheme}
            catalog={catalog}
            favorites={favorites}
            favoriteAddedAt={userState.favoriteAddedAt}
            librarySongs={librarySongs}
            librarySongAddedAt={userState.librarySongAddedAt}
            albums={albums}
            albumAddedAt={userState.albumAddedAt}
            player={player}
            onRetry={retryCatalog}
            onToggleFavorite={toggleFavorite}
            onToggleLibrarySong={toggleLibrarySong}
            onPlay={playSearchSong}
          />
        )}
        {route.page === "playlists" && (
          <PlaylistsPage playlists={userState.playlists} favoriteCount={favorites.size} onCreate={() => setPlaylistDialog({ mode: "create" })} />
        )}
        {route.page === "playlist" && (
          currentPlaylist
            ? <PlaylistPage
                playlist={currentPlaylist}
                onRename={() => setPlaylistDialog({ mode: "rename", playlist: currentPlaylist })}
                onDelete={() => setPlaylistDialog({ mode: "delete", playlist: currentPlaylist })}
              />
            : <PlaylistsPage playlists={userState.playlists} favoriteCount={favorites.size} onCreate={() => setPlaylistDialog({ mode: "create" })} />
        )}
        {collectionRoute && catalog.status === "loading" && (
          <div class="page"><CatalogSkeleton count={8} /></div>
        )}
        {collectionRoute && catalog.status === "error" && (
          <div class="page"><CatalogError message={catalog.message} onRetry={retryCatalog} /></div>
        )}
        {collectionRoute && catalog.status === "ready" && (
          collection ? (
            <CollectionPage
              client={catalogClient}
              summary={collection}
              currentSongId={player.track?.song.id}
              playerStatus={player.status}
              onPlay={playSong}
              onPlayNext={(song, sourceCollection) => engine.playNext(song, sourceCollection, preferredRecording(song.id))}
              onAddToQueue={(song, sourceCollection) => engine.addToQueue(song, sourceCollection, preferredRecording(song.id))}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              librarySongs={librarySongs}
              onToggleLibrarySong={toggleLibrarySong}
              visibleSongIds={route.page === "library-album" && !albums.has(collection.id) ? librarySongs : undefined}
              libraryContext={route.page === "library-album"}
              savedAlbum={albums.has(collection.id)}
              onToggleAlbum={() => toggleAlbum(collection.id)}
            />
          ) : <MissingCollection library={route.page === "library-album"} />
        )}
        <footer class="content-footer">
          Living Music is not affiliated with or endorsed by The Church of Jesus Christ of Latter-day Saints.
        </footer>
      </main>

      <MiniPlayer
        player={player}
        onToggle={() => engine.toggle()}
        onPrevious={() => engine.previous()}
        onNext={() => engine.next()}
        onSeek={(seconds) => engine.seek(seconds)}
        onOpen={() => setNowPlayingOpen(true)}
      />

      <NowPlaying
        open={nowPlayingOpen}
        player={player}
        onClose={closeNowPlaying}
        onToggle={() => engine.toggle()}
        onPrevious={() => engine.previous()}
        onNext={() => engine.next()}
        onSeek={(seconds) => engine.seek(seconds)}
        onRecordingChange={changeRecording}
        onCycleRepeat={() => engine.cycleRepeat()}
        onPlayQueueItem={(index) => engine.playQueueItem(index)}
        onMoveQueueItem={(index, direction) => engine.moveQueueItem(index, direction)}
        onRemoveQueueItem={(index) => engine.removeQueueItem(index)}
        onClearUpNext={() => engine.clearUpNext()}
        favorite={player.track ? favorites.has(player.track.song.id) : false}
        onToggleFavorite={() => player.track && toggleFavorite(player.track.song.id)}
        inLibrary={player.track ? librarySongs.has(player.track.song.id) || albums.has(player.track.collectionId) : false}
        onToggleLibrary={() => player.track && !albums.has(player.track.collectionId) && toggleLibrarySong(player.track.song.id)}
        libraryActionDisabled={player.track ? albums.has(player.track.collectionId) : false}
      />

      {playlistDialog && (
        <PlaylistDialog
          key={playlistDialog.mode === "create" ? "create" : `${playlistDialog.mode}:${playlistDialog.playlist.id}`}
          state={playlistDialog}
          onCancel={() => setPlaylistDialog(undefined)}
          onCreate={createPlaylist}
          onRename={renamePlaylist}
          onDelete={deletePlaylist}
        />
      )}

      <Navigation
        current={currentDestination}
        libraryView={currentLibraryView}
        playlists={userState.playlists}
        currentPlaylistId={currentPlaylistId}
        onCreatePlaylist={() => setPlaylistDialog({ mode: "create" })}
        onRenamePlaylist={(playlist) => setPlaylistDialog({ mode: "rename", playlist })}
        onDeletePlaylist={(playlist) => setPlaylistDialog({ mode: "delete", playlist })}
        mobile
      />
    </div>
  );
}
