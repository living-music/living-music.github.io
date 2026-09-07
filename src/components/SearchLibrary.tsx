import { useEffect, useMemo, useState } from "preact/hooks";
import { normalizeSearch, CatalogClient } from "../api";
import { Icon } from "../Icon";
import type { PlayerStatus } from "../player";
import type { CatalogIndex, SearchIndex, SearchSong } from "../types";
import { Artwork } from "./Artwork";

type SearchState =
  | { status: "loading" }
  | { status: "ready"; index: SearchIndex }
  | { status: "error"; message: string };

function useSearchIndex(client: CatalogClient, enabled = true): SearchState {
  const [state, setState] = useState<SearchState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ status: "loading" });
    client.loadSearch().then(
      (index) => active && setState({ status: "ready", index }),
      (error: unknown) => active && setState({
        status: "error",
        message: error instanceof Error ? error.message : "An unexpected search error occurred.",
      }),
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

function ResultsError({ message }: { message: string }) {
  return (
    <section class="results-message" role="alert">
      <Icon name="search" size={25} />
      <div>
        <h2>These songs couldn’t be loaded.</h2>
        <p>{message}</p>
      </div>
    </section>
  );
}

function ResultsSkeleton() {
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

function SongResults({
  songs,
  catalog,
  favorites,
  currentSongId,
  playerStatus,
  onToggleFavorite,
  onPlay,
}: {
  songs: SearchSong[];
  catalog: CatalogIndex;
  favorites: Set<string>;
  currentSongId?: string;
  playerStatus: PlayerStatus;
  onToggleFavorite: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string>();
  const [actionError, setActionError] = useState<string>();
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
          return (
            <li class={`result-row ${current ? "is-current" : ""}`} key={song.id}>
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
              <button
                type="button"
                class={`favorite-button ${favorites.has(song.id) ? "is-favorite" : ""}`}
                onClick={() => onToggleFavorite(song.id)}
                aria-label={favorites.has(song.id) ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
                aria-pressed={favorites.has(song.id)}
              >
                <Icon name="heart" filled={favorites.has(song.id)} size={19} />
              </button>
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
  currentSongId,
  playerStatus,
  onToggleFavorite,
  onPlay,
}: {
  client: CatalogClient;
  catalog: CatalogIndex;
  favorites: Set<string>;
  currentSongId?: string;
  playerStatus: PlayerStatus;
  onToggleFavorite: (songId: string) => void;
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
      {search.status === "error" && <ResultsError message={search.message} />}
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
            currentSongId={currentSongId}
            playerStatus={playerStatus}
            onToggleFavorite={onToggleFavorite}
            onPlay={onPlay}
          />
        </section>
      )}
    </>
  );
}

export function FavoriteSongs({
  client,
  catalog,
  favorites,
  currentSongId,
  playerStatus,
  onToggleFavorite,
  onPlay,
}: {
  client: CatalogClient;
  catalog: CatalogIndex;
  favorites: Set<string>;
  currentSongId?: string;
  playerStatus: PlayerStatus;
  onToggleFavorite: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const search = useSearchIndex(client, favorites.size > 0);

  if (!favorites.size) {
    return (
      <section class="empty-state compact library-empty" aria-labelledby="favorites-title">
        <div class="empty-icon"><Icon name="heart" size={28} /></div>
        <h2 id="favorites-title">Save songs you love.</h2>
        <p>Select the heart beside a song in a collection or search result, and it will appear here.</p>
        <a class="primary-action" href="#/search">Find music</a>
      </section>
    );
  }

  if (search.status === "loading") return <ResultsSkeleton />;
  if (search.status === "error") return <ResultsError message={search.message} />;

  const byId = new Map(search.index.songs.map((song) => [song.id, song]));
  const songs = [...favorites].flatMap((id) => {
    const song = byId.get(id);
    return song ? [song] : [];
  });

  return (
    <section class="favorite-songs" aria-labelledby="favorites-title">
      <div class="results-heading">
        <h2 id="favorites-title">Favorite Songs</h2>
        <p>{songs.length.toLocaleString()} saved on this device</p>
      </div>
      {songs.length ? (
        <SongResults
          songs={songs}
          catalog={catalog}
          favorites={favorites}
          currentSongId={currentSongId}
          playerStatus={playerStatus}
          onToggleFavorite={onToggleFavorite}
          onPlay={onPlay}
        />
      ) : (
        <ResultsError message="Your saved song IDs are no longer present in the current catalog." />
      )}
    </section>
  );
}
