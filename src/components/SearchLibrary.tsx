import { useEffect, useMemo, useState } from "preact/hooks";
import { normalizeSearch, CatalogClient } from "../api";
import { catalogFailure, type CatalogFailureKind } from "../connectivity";
import { Icon } from "../Icon";
import type { PlayerStatus } from "../player";
import type { Playlist } from "../storage";
import type { DownloadRecord } from "../downloads";
import type { CatalogIndex, SearchIndex, SearchSong } from "../types";
import { Artwork } from "./Artwork";
import { DownloadStatus } from "./DownloadStatus";
import { SongContextMenu, type ContextMenuPosition } from "./SongContextMenu";

export type SearchState =
  | { status: "loading" }
  | { status: "ready"; index: SearchIndex }
  | { status: "error"; message: string; kind: CatalogFailureKind };

export function useSearchIndex(client: CatalogClient, enabled = true): SearchState {
  const [state, setState] = useState<SearchState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ status: "loading" });
    client.loadSearch().then(
      (index) => active && setState({ status: "ready", index }),
      (error: unknown) => {
        const failure = catalogFailure(error, "An unexpected search error occurred.");
        if (active) setState({ status: "error", ...failure });
      },
    );
    return () => { active = false; };
  }, [client, enabled]);

  return state;
}

export function filterSearchSongs(
  search: SearchIndex,
  catalog: CatalogIndex,
  query: string,
): SearchSong[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];
  const collectionNames = new Map(catalog.collections.map((collection) => [collection.id, collection.title]));
  const terms = normalized.split(/\s+/).filter(Boolean);
  return search.songs.filter((song) => {
    const searchable = normalizeSearch([
      song.title,
      song.number,
      song.artists.join(" "),
      collectionNames.get(song.collectionId),
    ].filter(Boolean).join(" "));
    return terms.every((term) => searchable.includes(term));
  });
}

export function ResultsError({ message, kind = "upstream" }: { message: string; kind?: CatalogFailureKind }) {
  const title = kind === "offline"
    ? "These songs aren’t saved for offline use yet."
    : kind === "unsupported"
      ? "Living Music needs an update."
      : "These songs couldn’t be loaded.";
  return (
    <section class="results-message" role="alert">
      <Icon name="search" size={25} />
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </section>
  );
}

export function ResultsSkeleton() {
  return (
    <div class="results-skeleton" aria-busy="true" aria-label="Loading songs">
      {Array.from({ length: 7 }, (_, index) => (
        <div class="result-row" key={index}>
          <span class="skeleton result-artwork-skeleton" />
          <span>
            <span class="skeleton skeleton-result-title" />
            <span class="skeleton skeleton-result-detail" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SongResults({
  songs,
  catalog,
  favorites,
  librarySongs,
  playlists,
  currentSongId,
  playerStatus,
  onToggleFavorite,
  onToggleLibrarySong,
  onAddToPlaylist,
  downloads = new Map(),
  onDownload,
  onRemoveDownload,
  onPlay,
}: {
  songs: SearchSong[];
  catalog: CatalogIndex;
  favorites: Set<string>;
  librarySongs: Set<string>;
  playlists: Playlist[];
  currentSongId?: string;
  playerStatus: PlayerStatus;
  onToggleFavorite: (songId: string) => void;
  onToggleLibrarySong: (songId: string) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  downloads?: Map<string, DownloadRecord>;
  onDownload?: (song: SearchSong) => void;
  onRemoveDownload?: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [menu, setMenu] = useState<{ songId: string; position: ContextMenuPosition }>();
  const collections = useMemo(
    () => new Map(catalog.collections.map((collection) => [collection.id, collection])),
    [catalog],
  );

  const play = async (song: SearchSong) => {
    setPendingId(song.id);
    setActionError(undefined);
    try {
      await onPlay(song);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "This song could not be loaded.");
    } finally {
      setPendingId(undefined);
    }
  };

  return (
    <>
      {actionError && <p class="result-action-error" role="alert">{actionError}</p>}
      <ol class="result-list">
        {songs.map((song) => {
          const collection = collections.get(song.collectionId);
          const current = currentSongId === song.id;
          const active = current && (playerStatus === "playing" || playerStatus === "loading");
          const playable = song.recordingTypes.length > 0;
          const download = downloads.get(song.id);
          return (
            <li
              class={`result-row ${current ? "is-current" : ""}`}
              key={song.id}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ songId: song.id, position: { x: event.clientX, y: event.clientY } });
              }}
            >
              <button
                type="button"
                class="result-main"
                onClick={() => void play(song)}
                disabled={!playable || pendingId === song.id}
                aria-label={playable
                  ? active ? `Pause ${song.title}` : `Play ${song.title}`
                  : `${song.title}, no audio available`}
              >
                <Artwork url={collection?.artworkUrl} alt="" className="result-artwork" />
                <span class="result-copy">
                  <strong>{song.title}</strong>
                  <small>
                    {[song.number && `No. ${song.number}`, song.artists[0], collection?.title]
                      .filter(Boolean).join(" · ")}
                  </small>
                </span>
                <span class="result-play">
                  <Icon name={active ? "pause" : "play"} filled={!active} size={15} />
                </span>
              </button>
              <div class="result-row-actions">
                <button
                  type="button"
                  class={`library-song-button ${librarySongs.has(song.id) ? "is-added" : ""}`}
                  onClick={() => onToggleLibrarySong(song.id)}
                  aria-label={librarySongs.has(song.id) ? `Remove ${song.title} from Library` : `Add ${song.title} to Library`}
                  aria-pressed={librarySongs.has(song.id)}
                >
                  <Icon name={librarySongs.has(song.id) ? "check" : "add"} size={19} />
                </button>
                <button
                  type="button"
                  class={`favorite-button ${favorites.has(song.id) ? "is-favorite" : ""}`}
                  onClick={() => onToggleFavorite(song.id)}
                  aria-label={favorites.has(song.id) ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
                  aria-pressed={favorites.has(song.id)}
                >
                  <Icon name="heart" filled={favorites.has(song.id)} size={19} />
                </button>
                <DownloadStatus download={download} />
                <button
                  type="button"
                  class="result-more-button"
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu(menu?.songId === song.id ? undefined : { songId: song.id, position: { x: rect.right, y: rect.bottom } });
                  }}
                  aria-label={`Options for ${song.title}`}
                  aria-expanded={menu?.songId === song.id}
                >
                  <Icon name="more" size={19} />
                </button>
              </div>
              {menu?.songId === song.id && (
                <SongContextMenu
                  songId={song.id}
                  title={song.title}
                  position={menu.position}
                  favorite={favorites.has(song.id)}
                  inLibrary={librarySongs.has(song.id)}
                  playlists={playlists}
                  onFavorite={() => onToggleFavorite(song.id)}
                  onToggleLibrary={() => onToggleLibrarySong(song.id)}
                  onAddToPlaylist={(playlistId) => onAddToPlaylist(playlistId, song.id)}
                  download={download}
                  onDownload={onDownload ? () => onDownload(song) : undefined}
                  onRemoveDownload={onRemoveDownload ? () => onRemoveDownload(song.id) : undefined}
                  onClose={() => setMenu(undefined)}
                />
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

export function SearchExperience({
  client,
  catalog,
  favorites,
  librarySongs,
  playlists,
  currentSongId,
  playerStatus,
  onToggleFavorite,
  onToggleLibrarySong,
  onAddToPlaylist,
  downloads,
  onDownload,
  onRemoveDownload,
  onPlay,
}: {
  client: CatalogClient;
  catalog: CatalogIndex;
  favorites: Set<string>;
  librarySongs: Set<string>;
  playlists: Playlist[];
  currentSongId?: string;
  playerStatus: PlayerStatus;
  onToggleFavorite: (songId: string) => void;
  onToggleLibrarySong: (songId: string) => void;
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  downloads?: Map<string, DownloadRecord>;
  onDownload?: (song: SearchSong) => void;
  onRemoveDownload?: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const search = useSearchIndex(client);
  const [query, setQuery] = useState("");
  const normalized = normalizeSearch(query);

  const matches = useMemo(
    () => search.status === "ready" ? filterSearchSongs(search.index, catalog, normalized) : [],
    [search, normalized, catalog],
  );

  return (
    <>
      <label class="search-field live-search">
        <Icon name="search" size={20} />
        <input
          type="search"
          aria-label="Search music"
          placeholder="Songs, numbers, artists, or collections"
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
          autoComplete="off"
          spellcheck={false}
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
            <Icon name="close" size={17} />
          </button>
        )}
      </label>

      {search.status === "loading" && <ResultsSkeleton />}
      {search.status === "error" && <ResultsError message={search.message} kind={search.kind} />}
      {search.status === "ready" && !normalized && (
        <section class="search-prompt">
          <Icon name="music" size={28} />
          <h2>Search {search.index.songs.length.toLocaleString()} songs.</h2>
          <p>Try a title, song number, artist, or collection name.</p>
        </section>
      )}
      {search.status === "ready" && normalized && !matches.length && (
        <section class="search-prompt">
          <Icon name="search" size={28} />
          <h2>No songs found.</h2>
          <p>Try a shorter title or a different spelling.</p>
        </section>
      )}
      {search.status === "ready" && matches.length > 0 && (
        <section class="search-results" aria-labelledby="results-title">
          <div class="results-heading">
            <h2 id="results-title">{matches.length.toLocaleString()} {matches.length === 1 ? "result" : "results"}</h2>
            {matches.length > 80 && <p>Showing the first 80</p>}
          </div>
          <SongResults
            songs={matches.slice(0, 80)}
            catalog={catalog}
            favorites={favorites}
            librarySongs={librarySongs}
            playlists={playlists}
            currentSongId={currentSongId}
            playerStatus={playerStatus}
            onToggleFavorite={onToggleFavorite}
            onToggleLibrarySong={onToggleLibrarySong}
            onAddToPlaylist={onAddToPlaylist}
            downloads={downloads}
            onDownload={onDownload}
            onRemoveDownload={onRemoveDownload}
            onPlay={onPlay}
          />
        </section>
      )}
    </>
  );
}
