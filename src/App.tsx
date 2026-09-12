import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import { CatalogClient } from "./api";
import { chooseRecording } from "./audio";
import { catalogFailure, type CatalogFailureKind } from "./connectivity";
import { CatalogError, CatalogSkeleton, CollectionGrid, CollectionPage } from "./components/CatalogViews";
import { Icon, type IconName } from "./Icon";
import { MiniPlayer, NowPlaying } from "./components/Player";
import { SearchExperience } from "./components/SearchLibrary";
import { LibraryViews } from "./components/LibraryViews";
import { PlaylistDialog, PlaylistPage, PlaylistsPage, type PlaylistDialogState } from "./components/Playlists";
import { AudioEngine, trackForSong, type PlayerSnapshot, type PlayerTrack } from "./player";
import { MediaSessionController } from "./media-session";
import { applyPwaUpdate, currentPwaSnapshot, subscribeToPwa } from "./pwa";
import { clearAllDownloads, currentDownloadSnapshot, downloadMany, downloadRecording, downloadedBytes, downloadedSongIds, initializeDownloads, playbackUrl, reconcileDownloads, removeSongDownloads, subscribeToDownloads, type DownloadRecord, type DownloadSnapshot } from "./downloads";
import { currentInstallSnapshot, promptInstall, subscribeToInstall, type InstallSnapshot } from "./install";
import { clearUserState, emptyUserState, exportUserState, getStorageSnapshot, importUserState, requestPersistentStorage, saveUserState, type PersistenceLoadResult, type StorageSnapshot } from "./persistence";
import { toggleFavoriteInState } from "./library-state";
import { addSongToPlaylist, createPlaylist as createPlaylistRecord, deletePlaylist as deletePlaylistRecord, renamePlaylist as renamePlaylistRecord } from "./playlists";
import { hrefFor, hrefForLibrary, hrefForPlaylist, navigationDestination, routeFromHash, type Destination, type LibraryView, type Route } from "./router";
import { readTheme, writeTheme, type Playlist, type Theme, type UserState } from "./storage";
import type { CatalogIndex, CollectionSummary, SearchSong, Song } from "./types";

interface NavigationItem {
  id: Destination;
  label: string;
  icon: IconName;
}

type CatalogState =
  | { status: "loading" }
  | { status: "ready"; index: CatalogIndex }
  | { status: "error"; message: string; kind: CatalogFailureKind };

const catalogClient = new CatalogClient();
const DISMISSED_PERSISTENCE_NOTICE_KEY = "livingMusic:dismissedPersistenceNotice:v1";

function visiblePersistenceNotice(message?: string): string | undefined {
  if (!message) return undefined;
  try {
    return localStorage.getItem(DISMISSED_PERSISTENCE_NOTICE_KEY) === message ? undefined : message;
  } catch {
    return message;
  }
}

function rememberDismissedPersistenceNotice(message?: string): void {
  if (!message) return;
  try {
    localStorage.setItem(DISMISSED_PERSISTENCE_NOTICE_KEY, message);
  } catch {
    // The notice can still be dismissed for the current page when storage is unavailable.
  }
}

const navigation: NavigationItem[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "browse", label: "Browse", icon: "browse" },
  { id: "search", label: "Search", icon: "search" },
];

const libraryNavigation: { id: LibraryView; label: string }[] = [
  { id: "recent", label: "Recently Added" },
  { id: "albums", label: "Albums" },
  { id: "songs", label: "Songs" },
  { id: "downloaded", label: "Downloaded" },
];

const pageTitles: Record<Destination, string> = {
  home: "Home",
  browse: "Browse",
  search: "Search",
  library: "Library",
  settings: "Settings",
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
  const [openPlaylistMenu, setOpenPlaylistMenu] = useState<{ id: string; left: number; top: number }>();
  const playlistMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openPlaylistMenu) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && playlistMenuRef.current?.contains(event.target)) return;
      setOpenPlaylistMenu(undefined);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPlaylistMenu(undefined);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", keydown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openPlaylistMenu]);
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
                onClick={(event) => {
                  if (openPlaylistMenu?.id === playlist.id) {
                    setOpenPlaylistMenu(undefined);
                    return;
                  }
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const menuWidth = 128;
                  const menuHeight = 80;
                  setOpenPlaylistMenu({
                    id: playlist.id,
                    left: Math.max(8, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 8)),
                    top: bounds.bottom + menuHeight + 8 > window.innerHeight
                      ? Math.max(8, bounds.top - menuHeight - 4)
                      : bounds.bottom + 4,
                  });
                }}
                aria-label={`Options for ${playlist.name}`}
                aria-expanded={openPlaylistMenu?.id === playlist.id}
              >
                <Icon name="more" size={17} />
              </button>
              {openPlaylistMenu?.id === playlist.id && createPortal(
                <div
                  ref={playlistMenuRef}
                  class="playlist-navigation-menu"
                  style={{ left: `${openPlaylistMenu.left}px`, top: `${openPlaylistMenu.top}px` }}
                  role="menu"
                  aria-label={`Options for ${playlist.name}`}
                >
                  <button type="button" role="menuitem" onClick={() => { setOpenPlaylistMenu(undefined); onRenamePlaylist(playlist); }}>Rename</button>
                  <button type="button" role="menuitem" class="is-destructive" onClick={() => { setOpenPlaylistMenu(undefined); onDeletePlaylist(playlist); }}>Delete</button>
                </div>,
                document.body,
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
  if (state.status === "error") return <CatalogError message={state.message} kind={state.kind} onRetry={onRetry} />;

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
  playlists,
  player,
  onRetry,
  onToggleFavorite,
  onToggleLibrarySong,
  onAddToPlaylist,
  downloads,
  onDownload,
  onRemoveDownload,
  onPlay,
}: {
  catalog: CatalogState;
  favorites: Set<string>;
  librarySongs: Set<string>;
  playlists: Playlist[];
  player: PlayerSnapshot;
  onRetry: () => void;
  onToggleFavorite: (songId: string) => void;
  onToggleLibrarySong: (songId: string) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  downloads: Map<string, DownloadRecord>;
  onDownload: (song: SearchSong) => void;
  onRemoveDownload: (songId: string) => void;
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
      {catalog.status === "error" && <CatalogError message={catalog.message} kind={catalog.kind} onRetry={onRetry} />}
      {catalog.status === "ready" && (
        <SearchExperience
          client={catalogClient}
          catalog={catalog.index}
          favorites={favorites}
          librarySongs={librarySongs}
          playlists={playlists}
          currentSongId={player.track?.song.id}
          playerStatus={player.status}
          onToggleFavorite={onToggleFavorite}
          onToggleLibrarySong={onToggleLibrarySong}
          onAddToPlaylist={onAddToPlaylist}
          downloads={downloads}
          onDownload={onDownload}
          onRemoveDownload={onRemoveDownload}
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


function formatStorage(bytes?: number): string {
  if (bytes === undefined) return "Unavailable";
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / (1024 * 1024 * 1024) * 10) / 10} GB`;
}

function LocalDataSettings({ userState, persistence, install, downloads, onClearDownloads, onReplaceUserState, onMessage }: {
  userState: UserState;
  persistence: PersistenceLoadResult;
  install: InstallSnapshot;
  downloads: DownloadSnapshot;
  onClearDownloads: () => Promise<void>;
  onReplaceUserState: (state: UserState) => void;
  onMessage: (message?: string) => void;
}) {
  const [storage, setStorage] = useState<StorageSnapshot>({});
  const [busy, setBusy] = useState(false);
  const refreshStorage = () => void getStorageSnapshot().then(setStorage);
  useEffect(refreshStorage, [userState, downloads]);

  const exportData = () => {
    const blob = new Blob([exportUserState(userState)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `living-music-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onMessage("Your Living Music backup was downloaded.");
  };
  const importData = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const restored = importUserState(await file.text());
      await saveUserState(restored);
      onReplaceUserState(restored);
      onMessage("Backup restored.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "The backup could not be restored.");
    } finally { setBusy(false); }
  };
  const clearData = async () => {
    if (!window.confirm("Remove your Library, Favorites, playlists, queue, and playback preferences from this device?")) return;
    setBusy(true);
    try {
      await onClearDownloads();
      await clearUserState();
      onReplaceUserState(emptyUserState());
      onMessage("Local listener data was cleared.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Local data could not be cleared.");
    } finally { setBusy(false); }
  };
  const installCopy = install.mode === "ios"
    ? "In Safari, tap Share, then Add to Home Screen."
    : "Use your browser’s Install app or Add to Dock command.";

  return (
    <div class="settings-stack">
      <section class="settings-card" aria-labelledby="install-heading">
        <div>
          <h2 id="install-heading">Installation</h2>
          <p>{install.mode === "installed"
            ? "Living Music is installed on this device."
            : install.mode === "prompt"
              ? "Open Living Music like an app from your home screen or dock."
              : installCopy}</p>
        </div>
        {install.mode === "prompt" && <button type="button" class="settings-action" disabled={install.prompting} onClick={() => void promptInstall()}>{install.prompting ? "Opening…" : "Install"}</button>}
      </section>
      <section class="settings-card settings-card-column" aria-labelledby="data-heading">
        <div><h2 id="data-heading">Local data</h2><p>Your Library and playlists stay on this device. Export a backup before clearing browser data.</p></div>
        <dl class="storage-details">
          <div><dt>Storage</dt><dd>{formatStorage(storage.usage)}{storage.quota ? ` of ${formatStorage(storage.quota)}` : ""}</dd></div>
          <div><dt>Downloaded audio</dt><dd>{formatStorage(downloadedBytes(downloads))}</dd></div>
          <div><dt>Protection</dt><dd>{storage.persisted ? "Persistent" : persistence.mode === "indexeddb" ? "Browser managed" : "Limited"}</dd></div>
        </dl>
        <div class="settings-actions">
          <button type="button" class="settings-action" onClick={exportData}>Export backup</button>
          <label class="settings-action">Import backup<input class="visually-hidden" type="file" accept="application/json,.json" disabled={busy} onChange={(event) => void importData(event)} /></label>
          {downloads.records.length > 0 && <button type="button" class="settings-action" disabled={busy} onClick={() => {
            if (!window.confirm("Remove every downloaded recording from this device? Your Library and playlists will stay intact.")) return;
            setBusy(true); void onClearDownloads().then(() => onMessage("All downloads were removed."), () => onMessage("Some downloads could not be removed.")).finally(() => setBusy(false));
          }}>Remove all downloads</button>}
          <button type="button" class="settings-action settings-danger" disabled={busy} onClick={() => void clearData()}>Clear local data</button>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({
  theme,
  onThemeChange,
  userState,
  persistence,
  install,
  downloadState,
  onClearDownloads,
  onReplaceUserState,
  onPersistenceMessage,
}: {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  userState: UserState;
  persistence: PersistenceLoadResult;
  install: InstallSnapshot;
  downloadState: DownloadSnapshot;
  onClearDownloads: () => Promise<void>;
  onReplaceUserState: (state: UserState) => void;
  onPersistenceMessage: (message?: string) => void;
}) {
  return (
    <div class="page settings-page">
      <PageHeader
        eyebrow="Living Music"
        title="Settings"
        description="Manage appearance, installation, storage, and the data saved on this device."
      />
      <div class="settings-page-content">
        <ThemeSelector theme={theme} onChange={onThemeChange} />
        <LocalDataSettings
          userState={userState}
          persistence={persistence}
          install={install}
          downloads={downloadState}
          onClearDownloads={onClearDownloads}
          onReplaceUserState={onReplaceUserState}
          onMessage={onPersistenceMessage}
        />
      </div>
    </div>
  );
}

function LibraryPage({
  view,
  catalog,
  favorites,
  favoriteAddedAt,
  librarySongs,
  librarySongAddedAt,
  playlists,
  albums,
  albumAddedAt,
  player,
  onRetry,
  onToggleFavorite,
  onToggleLibrarySong,
  onAddToPlaylist,
  downloads,
  downloadedSongIds,
  onDownload,
  onRemoveDownload,
  onPlay,
}: {
  view: LibraryView;
  catalog: CatalogState;
  favorites: Set<string>;
  favoriteAddedAt: Record<string, string>;
  librarySongs: Set<string>;
  librarySongAddedAt: Record<string, string>;
  playlists: Playlist[];
  albums: Set<string>;
  albumAddedAt: Record<string, string>;
  player: PlayerSnapshot;
  onRetry: () => void;
  onToggleFavorite: (songId: string) => void;
  onToggleLibrarySong: (songId: string) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  downloads: Map<string, DownloadRecord>;
  downloadedSongIds: Set<string>;
  onDownload: (song: SearchSong) => void;
  onRemoveDownload: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const viewCopy: Record<LibraryView, { title: string; description: string }> = {
    favorites: { title: "Favorites", description: "Songs you marked as favorites, with the newest additions first." },
    recent: { title: "Recently Added", description: "Your Library music grouped by album and ordered by when you added it." },
    albums: { title: "Albums", description: "Albums you added and albums containing songs in your Library." },
    songs: { title: "Songs", description: "Every song you added to your Library, arranged alphabetically." },
    videos: { title: "Music Videos", description: "Video performances you added to your Library." },
    downloaded: { title: "Downloaded", description: "Music saved on this device for listening without a connection." },
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
        {catalog.status === "error" && <CatalogError message={catalog.message} kind={catalog.kind} onRetry={onRetry} />}
        {catalog.status === "ready" && (
          <LibraryViews
            view={view}
            client={catalogClient}
            catalog={catalog.index}
            favorites={favorites}
            favoriteAddedAt={favoriteAddedAt}
            librarySongs={librarySongs}
            librarySongAddedAt={librarySongAddedAt}
            playlists={playlists}
            albums={albums}
            albumAddedAt={albumAddedAt}
            currentSongId={player.track?.song.id}
            playerStatus={player.status}
            onToggleFavorite={onToggleFavorite}
            onToggleLibrarySong={onToggleLibrarySong}
            onAddToPlaylist={onAddToPlaylist}
            downloads={downloads}
            downloadedSongIds={downloadedSongIds}
            onDownload={onDownload}
            onRemoveDownload={onRemoveDownload}
            onPlay={onPlay}
          />
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

function AppStatus({
  online,
  catalogFallback,
  updateAvailable,
  applyingUpdate,
  persistenceMessage,
  onRetry,
  onDismissPersistence,
}: {
  online: boolean;
  catalogFallback: boolean;
  updateAvailable: boolean;
  applyingUpdate: boolean;
  persistenceMessage?: string;
  onRetry: () => void;
  onDismissPersistence: () => void;
}) {
  if (online && !catalogFallback && !updateAvailable && !persistenceMessage) return null;
  return (
    <div class="app-status-region" aria-live="polite">
      {!online && (
        <section class="app-status app-status-offline">
          <Icon name="browse" size={17} />
          <p><strong>Offline</strong><span>Saved catalog pages remain available. Audio may require a connection.</span></p>
          <button type="button" onClick={onRetry}>Try again</button>
        </section>
      )}
      {online && catalogFallback && (
        <section class="app-status app-status-cached">
          <Icon name="browse" size={17} />
          <p><strong>Using saved catalog</strong><span>The catalog service could not be reached.</span></p>
          <button type="button" onClick={onRetry}>Check again</button>
        </section>
      )}
      {persistenceMessage && (
        <section class="app-status app-status-cached">
          <Icon name="browse" size={17} />
          <p><strong>Local data</strong><span>{persistenceMessage}</span></p>
          <div class="app-status-actions">
            <button type="button" onClick={() => window.location.hash = "#/settings"}>Manage</button>
            <button type="button" class="app-status-dismiss" onClick={onDismissPersistence} aria-label="Dismiss local data notice" title="Dismiss">
              <Icon name="close" size={15} />
            </button>
          </div>
        </section>
      )}
      {updateAvailable && (
        <section class="app-status app-status-update">
          <Icon name="check" size={17} />
          <p><strong>Update ready</strong><span>Refresh when you’re ready to use the latest version.</span></p>
          <button type="button" onClick={applyPwaUpdate} disabled={applyingUpdate}>
            {applyingUpdate ? "Updating…" : "Update now"}
          </button>
        </section>
      )}
    </div>
  );
}

export function App({ initialPersistence }: { initialPersistence: PersistenceLoadResult }) {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;
  const mediaSessionRef = useRef<MediaSessionController | null>(null);
  if (!mediaSessionRef.current) mediaSessionRef.current = new MediaSessionController(engine);
  const [player, setPlayer] = useState<PlayerSnapshot>(engine.state);
  const [userState, setUserState] = useState<UserState>(initialPersistence.state);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [playlistDialog, setPlaylistDialog] = useState<PlaylistDialogState>();
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [catalog, setCatalog] = useState<CatalogState>({ status: "loading" });
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pwa, setPwa] = useState(currentPwaSnapshot);
  const [install, setInstall] = useState(currentInstallSnapshot);
  const [downloadState, setDownloadState] = useState<DownloadSnapshot>(currentDownloadSnapshot);
  const [persistenceMessage, setPersistenceMessage] = useState<string | undefined>(() => visiblePersistenceNotice(initialPersistence.warning));
  const mainRef = useRef<HTMLElement>(null);
  const restoredQueue = useRef(false);
  const loadedCatalogOnce = useRef(false);
  const requestedPersistence = useRef(false);
  const favorites = useMemo(() => new Set(userState.favorites), [userState.favorites]);
  const librarySongs = useMemo(() => new Set(userState.librarySongs), [userState.librarySongs]);
  const albums = useMemo(() => new Set(userState.albums), [userState.albums]);
  const downloadRecords = useMemo(() => new Map(downloadState.records.map((record) => [record.songId, record])), [downloadState]);
  const offlineSongIds = useMemo(() => downloadedSongIds(downloadState), [downloadState]);

  useEffect(() => engine.subscribe(setPlayer), [engine]);

  useEffect(() => subscribeToPwa(setPwa), []);

  useEffect(() => subscribeToInstall(setInstall), []);

  useEffect(() => {
    const unsubscribe = subscribeToDownloads(setDownloadState);
    void initializeDownloads();
    engine.setSourceResolver((track) => playbackUrl(track.recording));
    return unsubscribe;
  }, [engine]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setCatalogAttempt((attempt) => attempt + 1);
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
    void saveUserState(userState).then(
      () => setPersistenceMessage((message) => message?.includes("could not") ? undefined : message),
      (error: unknown) => setPersistenceMessage(error instanceof Error ? error.message : "Your changes could not be saved."),
    );
  }, [userState]);

  useEffect(() => {
    const hasMeaningfulData = userState.favorites.length > 0 || userState.librarySongs.length > 0 || userState.albums.length > 0 || userState.playlists.length > 0;
    if (!hasMeaningfulData || requestedPersistence.current || initialPersistence.mode !== "indexeddb") return;
    requestedPersistence.current = true;
    void requestPersistentStorage().then((granted) => {
      if (granted === false) setPersistenceMessage(visiblePersistenceNotice("Your browser may remove local data when storage is low. Export a backup to keep a copy."));
    }, () => setPersistenceMessage(visiblePersistenceNotice("Protected storage could not be requested. Export a backup to keep a copy.")));
  }, [userState.favorites.length, userState.librarySongs.length, userState.albums.length, userState.playlists.length]);

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
    const request = loadedCatalogOnce.current
      ? catalogClient.refreshIndex()
      : catalogClient.loadIndex();
    loadedCatalogOnce.current = true;
    request.then(
      (index) => active && setCatalog({ status: "ready", index }),
      (error: unknown) => {
        const failure = catalogFailure(error, "An unexpected catalog error occurred.");
        if (active) setCatalog({ status: "error", ...failure });
      },
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

  useEffect(() => {
    const appearance = window.matchMedia("(prefers-color-scheme: light)");
    const syncThemeColor = () => {
      const light = theme === "light" || (theme === "system" && appearance.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f2f2f7" : "#08080a");
    };
    syncThemeColor();
    if (theme === "system") appearance.addEventListener("change", syncThemeColor);
    return () => appearance.removeEventListener("change", syncThemeColor);
  }, [theme]);

  const changeTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    writeTheme(nextTheme);
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
    const offlineRecord = downloadRecords.get(result.id);
    const playSavedCopy = () => {
      if (!offlineRecord?.song || !offlineRecord.collection) return false;
      const track = trackForSong(offlineRecord.song, offlineRecord.collection, preferredRecording(offlineRecord.song.id));
      if (!track) return false;
      engine.playTracks([track], track.song.id, false);
      return true;
    };
    const summary = catalog.index.collections.find((entry) => entry.id === result.collectionId);
    if (!summary) {
      if (playSavedCopy()) return;
      throw new Error("This song’s collection is no longer available.");
    }
    const payload = await catalogClient.loadCollection(summary);
    reconcileDownloads(payload.songs);
    const song = payload.songs.find((entry) => entry.id === result.id);
    if (!song) {
      if (playSavedCopy()) return;
      throw new Error("This song is no longer available in its collection.");
    }
    engine.playCollection(payload.songs, summary, song.id, preferredRecording(song.id));
  };

  const playPlaylistSongs = async (results: SearchSong[], songId?: string) => {
    if (catalog.status !== "ready") throw new Error("The catalog is still loading.");
    const summaries = new Map(catalog.index.collections.map((entry) => [entry.id, entry]));
    const collectionIds = [...new Set(results.map((result) => result.collectionId))];
    const payloads = await Promise.all(collectionIds.map(async (collectionId) => {
      const summary = summaries.get(collectionId);
      if (!summary) return undefined;
      return { summary, payload: await catalogClient.loadCollection(summary) };
    }));
    const loaded = new Map(payloads.flatMap((entry) => entry ? [[entry.summary.id, entry] as const] : []));
    const tracks = results.flatMap((result) => {
      const entry = loaded.get(result.collectionId);
      const song = entry?.payload.songs.find((candidate) => candidate.id === result.id);
      const track = song && entry ? trackForSong(song, entry.summary, preferredRecording(song.id)) : undefined;
      return track ? [track] : [];
    });
    if (!tracks.length) throw new Error("No playable songs remain in this playlist.");
    const selectedId = songId && tracks.some((track) => track.song.id === songId) ? songId : tracks[0].song.id;
    const toggleCurrent = player.track?.song.id === selectedId
      && (player.status === "playing" || player.status === "loading");
    engine.playTracks(tracks, selectedId, toggleCurrent);
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

  const addSongToUserPlaylist = (playlistId: string, songId: string) => {
    const timestamp = new Date().toISOString();
    setUserState((current) => ({
      ...current,
      playlists: addSongToPlaylist(current.playlists, playlistId, songId, timestamp),
    }));
  };

  const ensureSongsInLibrary = (songIds: string[]) => {
    const timestamp = new Date().toISOString();
    setUserState((current) => {
      const next = new Set(current.librarySongs);
      const addedAt = { ...current.librarySongAddedAt };
      for (const songId of songIds) if (!next.has(songId)) { next.add(songId); addedAt[songId] = timestamp; }
      return { ...current, librarySongs: [...next], librarySongAddedAt: addedAt };
    });
  };

  const downloadFullSong = (song: Song, sourceCollection: CollectionSummary) => {
    ensureSongsInLibrary([song.id]);
    void downloadRecording({ song, collection: sourceCollection, preferredType: preferredRecording(song.id) })
      .catch((error: unknown) => setPersistenceMessage(error instanceof Error ? error.message : "Download failed."));
  };

  const downloadSearchResult = (result: SearchSong) => {
    if (catalog.status !== "ready") return;
    const summary = catalog.index.collections.find((entry) => entry.id === result.collectionId);
    if (!summary) return;
    void catalogClient.loadCollection(summary).then((payload) => {
      const song = payload.songs.find((entry) => entry.id === result.id);
      if (!song) throw new Error("This song is no longer available.");
      downloadFullSong(song, summary);
    }).catch((error: unknown) => setPersistenceMessage(error instanceof Error ? error.message : "Download failed."));
  };

  const toggleAlbumDownloads = (songs: Song[], sourceCollection: CollectionSummary, remove: boolean) => {
    if (remove) {
      void Promise.all(songs.map((song) => removeSongDownloads(song.id))).catch(() => setPersistenceMessage("Some downloads could not be removed."));
      return;
    }
    ensureSongsInLibrary(songs.map((song) => song.id));
    void downloadMany(songs.map((song) => ({ song, collection: sourceCollection, preferredType: preferredRecording(song.id) })));
  };

  const togglePlaylistDownloads = (results: SearchSong[], remove: boolean) => {
    if (remove) {
      void Promise.all(results.map((song) => removeSongDownloads(song.id))).catch(() => setPersistenceMessage("Some downloads could not be removed."));
      return;
    }
    if (catalog.status !== "ready") return;
    ensureSongsInLibrary(results.map((song) => song.id));
    const summaries = new Map(catalog.index.collections.map((entry) => [entry.id, entry]));
    void Promise.all([...new Set(results.map((song) => song.collectionId))].map(async (collectionId) => {
      const summary = summaries.get(collectionId);
      return summary ? { summary, payload: await catalogClient.loadCollection(summary) } : undefined;
    })).then((loaded) => {
      const byCollection = new Map(loaded.flatMap((entry) => entry ? [[entry.summary.id, entry] as const] : []));
      return downloadMany(results.flatMap((result) => {
        const entry = byCollection.get(result.collectionId);
        const song = entry?.payload.songs.find((candidate) => candidate.id === result.id);
        return song && entry ? [{ song, collection: entry.summary, preferredType: preferredRecording(song.id) }] : [];
      }));
    }).catch((error: unknown) => setPersistenceMessage(error instanceof Error ? error.message : "Playlist download failed."));
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
      <AppStatus
        online={online}
        catalogFallback={pwa.catalogFallback}
        updateAvailable={pwa.updateAvailable}
        applyingUpdate={pwa.applyingUpdate}
        persistenceMessage={persistenceMessage}
        onRetry={() => setCatalogAttempt((attempt) => attempt + 1)}
        onDismissPersistence={() => {
          rememberDismissedPersistenceNotice(persistenceMessage);
          setPersistenceMessage(undefined);
        }}
      />

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
          <div class="sidebar-footer-copy">
            <p>Independent project</p>
            <a href="https://www.churchofjesuschrist.org/media/music/collections/all-music?lang=eng">
              Official music library
            </a>
          </div>
          <a class="sidebar-settings-button" href="#/settings" aria-label="Settings" aria-current={route.page === "settings" ? "page" : undefined}>
            <Icon name="settings" size={19} />
          </a>
        </div>
      </aside>

      <header class="mobile-header">
        <a class="mobile-brand" href="#/home" aria-label="Living Music home">
          <img src="/app-icon-192.png" alt="" />
          <span>Living Music</span>
        </a>
        <a class="mobile-settings-button" href="#/settings" aria-label="Settings" aria-current={route.page === "settings" ? "page" : undefined}>
          <Icon name="settings" size={20} />
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
            playlists={userState.playlists}
            player={player}
            onRetry={retryCatalog}
            onToggleFavorite={toggleFavorite}
            onToggleLibrarySong={toggleLibrarySong}
            onAddToPlaylist={addSongToUserPlaylist}
            downloads={downloadRecords}
            onDownload={downloadSearchResult}
            onRemoveDownload={(songId) => void removeSongDownloads(songId)}
            onPlay={playSearchSong}
          />
        )}
        {route.page === "settings" && (
          <SettingsPage
            theme={theme}
            onThemeChange={changeTheme}
            userState={userState}
            persistence={initialPersistence}
            install={install}
            downloadState={downloadState}
            onClearDownloads={clearAllDownloads}
            onReplaceUserState={setUserState}
            onPersistenceMessage={setPersistenceMessage}
          />
        )}
        {route.page === "library" && (
          <LibraryPage
            view={route.view}
            catalog={catalog}
            favorites={favorites}
            favoriteAddedAt={userState.favoriteAddedAt}
            librarySongs={librarySongs}
            librarySongAddedAt={userState.librarySongAddedAt}
            playlists={userState.playlists}
            albums={albums}
            albumAddedAt={userState.albumAddedAt}
            player={player}
            onRetry={retryCatalog}
            onToggleFavorite={toggleFavorite}
            onToggleLibrarySong={toggleLibrarySong}
            onAddToPlaylist={addSongToUserPlaylist}
            downloads={downloadRecords}
            downloadedSongIds={offlineSongIds}
            onDownload={downloadSearchResult}
            onRemoveDownload={(songId) => void removeSongDownloads(songId)}
            onPlay={playSearchSong}
          />
        )}
        {route.page === "playlists" && (
          <PlaylistsPage playlists={userState.playlists} favoriteCount={favorites.size} onCreate={() => setPlaylistDialog({ mode: "create" })} />
        )}
        {route.page === "playlist" && (
          currentPlaylist
            ? catalog.status === "ready"
              ? <PlaylistPage
                  playlist={currentPlaylist}
                  client={catalogClient}
                  catalog={catalog.index}
                  favorites={favorites}
                  librarySongs={librarySongs}
                  playlists={userState.playlists}
                  currentSongId={player.track?.song.id}
                  playerStatus={player.status}
                  onToggleFavorite={toggleFavorite}
                  onToggleLibrarySong={toggleLibrarySong}
                  onAddToPlaylist={addSongToUserPlaylist}
                  onPlaySongs={playPlaylistSongs}
                  downloads={downloadRecords}
                  onDownload={downloadSearchResult}
                  onRemoveDownload={(songId) => void removeSongDownloads(songId)}
                  onDownloadPlaylist={togglePlaylistDownloads}
                  onRename={() => setPlaylistDialog({ mode: "rename", playlist: currentPlaylist })}
                  onDelete={() => setPlaylistDialog({ mode: "delete", playlist: currentPlaylist })}
                />
              : catalog.status === "error"
                ? <div class="page"><CatalogError message={catalog.message} kind={catalog.kind} onRetry={retryCatalog} /></div>
                : <div class="page"><CatalogSkeleton count={7} /></div>
            : <PlaylistsPage playlists={userState.playlists} favoriteCount={favorites.size} onCreate={() => setPlaylistDialog({ mode: "create" })} />
        )}
        {collectionRoute && catalog.status === "loading" && (
          <div class="page"><CatalogSkeleton count={8} /></div>
        )}
        {collectionRoute && catalog.status === "error" && (
          <div class="page"><CatalogError message={catalog.message} kind={catalog.kind} onRetry={retryCatalog} /></div>
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
              playlists={userState.playlists}
              onAddToPlaylist={addSongToUserPlaylist}
              downloads={downloadRecords}
              onDownload={downloadFullSong}
              onRemoveDownload={(songId) => void removeSongDownloads(songId)}
              onDownloadAlbum={toggleAlbumDownloads}
              onCollectionLoaded={reconcileDownloads}
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
