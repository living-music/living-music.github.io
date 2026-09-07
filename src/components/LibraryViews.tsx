import { useEffect, useMemo, useState } from "preact/hooks";
import type { CatalogClient } from "../api";
import { Icon } from "../Icon";
import type { PlayerStatus } from "../player";
import { hrefForCollection } from "../router";
import type { CatalogIndex, CollectionSummary, SearchIndex, SearchSong } from "../types";
import { Artwork } from "./Artwork";
import { CollectionGrid } from "./CatalogViews";
import { ResultsError, ResultsSkeleton, SongResults, useSearchIndex } from "./SearchLibrary";

export type LibraryTab = "recent" | "albums" | "songs" | "videos";

export interface RecentLibraryReference {
  id: string;
  kind: "album" | "song";
  addedAt: string;
}

export function recentLibraryReferences(
  songIds: string[],
  albumIds: string[],
  songAddedAt: Record<string, string>,
  albumAddedAt: Record<string, string>,
): RecentLibraryReference[] {
  return [
    ...songIds.map((id) => ({ id, kind: "song" as const, addedAt: songAddedAt[id] || "" })),
    ...albumIds.map((id) => ({ id, kind: "album" as const, addedAt: albumAddedAt[id] || "" })),
  ].sort((left, right) => right.addedAt.localeCompare(left.addedAt) || left.id.localeCompare(right.id));
}

export function savedSongs(search: SearchIndex, songIds: Set<string>, videosOnly = false): SearchSong[] {
  return search.songs
    .filter((song) => songIds.has(song.id) && (!videosOnly || song.recordingTypes.includes("VIDEO")))
    .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" }));
}

function formatAddedDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date)
    : "Date unavailable";
}

function LibraryEmpty({
  icon,
  title,
  description,
  href,
  action,
}: {
  icon: "browse" | "heart" | "video";
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <section class="empty-state compact library-empty">
      <div class="empty-icon"><Icon name={icon} size={28} /></div>
      <h2>{title}</h2>
      <p>{description}</p>
      <a class="primary-action" href={href}>{action}</a>
    </section>
  );
}

function RecentLibrary({
  references,
  search,
  catalog,
  onPlay,
}: {
  references: RecentLibraryReference[];
  search: SearchIndex;
  catalog: CatalogIndex;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState<string>();
  const songs = useMemo(() => new Map(search.songs.map((song) => [song.id, song])), [search]);
  const albums = useMemo(() => new Map(catalog.collections.map((album) => [album.id, album])), [catalog]);
  const items = references.flatMap((reference) => {
    const value = reference.kind === "song" ? songs.get(reference.id) : albums.get(reference.id);
    return value ? [{ ...reference, value }] : [];
  });

  const play = async (song: SearchSong) => {
    setPendingId(song.id);
    setError(undefined);
    try {
      await onPlay(song);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This song could not be loaded.");
    } finally {
      setPendingId(undefined);
    }
  };

  if (!items.length) {
    return (
      <LibraryEmpty
        icon="heart"
        title="Build your library."
        description="Save a song with its heart button or add an album from its collection page."
        href="#/browse"
        action="Browse music"
      />
    );
  }

  return (
    <>
      {error && <p class="result-action-error" role="alert">{error}</p>}
      <div class="recent-library-grid">
        {items.map((item) => {
          const album = item.kind === "album" ? item.value as CollectionSummary : undefined;
          const song = item.kind === "song" ? item.value as SearchSong : undefined;
          const collection = song ? albums.get(song.collectionId) : album;
          const copy = (
            <>
              <Artwork url={collection?.artworkUrl} alt="" />
              <span class="recent-library-copy">
                <strong>{song?.title || album?.title}</strong>
                <small>{song
                  ? `${song.recordingTypes.includes("VIDEO") ? "Music Video" : "Song"} · ${collection?.title || "Living Music"}`
                  : `Album · ${album?.songCount.toLocaleString()} songs`}</small>
                <time dateTime={item.addedAt}>Added {formatAddedDate(item.addedAt)}</time>
              </span>
            </>
          );
          return song ? (
            <button
              type="button"
              class="recent-library-card"
              disabled={pendingId === song.id || song.recordingTypes.length === 0}
              onClick={() => void play(song)}
              aria-label={`Play ${song.title}`}
              key={`${item.kind}:${item.id}`}
            >
              {copy}
            </button>
          ) : (
            <a class="recent-library-card" href={hrefForCollection(album!.id)} key={`${item.kind}:${item.id}`}>
              {copy}
            </a>
          );
        })}
      </div>
    </>
  );
}

const tabs: { id: LibraryTab; label: string }[] = [
  { id: "recent", label: "Recently Added" },
  { id: "albums", label: "Albums" },
  { id: "songs", label: "Songs" },
  { id: "videos", label: "Music Videos" },
];

export function LibraryViews({
  client,
  catalog,
  favorites,
  favoriteAddedAt,
  albums,
  albumAddedAt,
  currentSongId,
  playerStatus,
  onToggleFavorite,
  onPlay,
}: {
  client: CatalogClient;
  catalog: CatalogIndex;
  favorites: Set<string>;
  favoriteAddedAt: Record<string, string>;
  albums: Set<string>;
  albumAddedAt: Record<string, string>;
  currentSongId?: string;
  playerStatus: PlayerStatus;
  onToggleFavorite: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const [tab, setTab] = useState<LibraryTab>("recent");
  const [visibleCount, setVisibleCount] = useState(100);
  const search = useSearchIndex(client, favorites.size > 0);
  const albumList = useMemo(
    () => catalog.collections
      .filter((album) => albums.has(album.id))
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" })),
    [catalog, albums],
  );
  const references = useMemo(
    () => recentLibraryReferences([...favorites], [...albums], favoriteAddedAt, albumAddedAt),
    [favorites, albums, favoriteAddedAt, albumAddedAt],
  );

  useEffect(() => setVisibleCount(100), [tab]);

  const needsSongs = tab !== "albums" && favorites.size > 0;
  const songs = search.status === "ready" ? savedSongs(search.index, favorites) : [];
  const videos = search.status === "ready" ? savedSongs(search.index, favorites, true) : [];
  const activeSongs = tab === "videos" ? videos : songs;

  return (
    <section class="library-browser" aria-label="Saved library">
      <div
        class="library-tabs"
        role="tablist"
        aria-label="Library views"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const current = tabs.findIndex((item) => item.id === tab);
          const nextIndex = event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          const next = tabs[nextIndex];
          setTab(next.id);
          requestAnimationFrame(() => document.getElementById(`library-tab-${next.id}`)?.focus());
        }}
      >
        {tabs.map((item) => (
          <button
            type="button"
            role="tab"
            id={`library-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`library-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            class={tab === item.id ? "is-selected" : ""}
            onClick={() => setTab(item.id)}
            key={item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        class="library-panel"
        role="tabpanel"
        id={`library-panel-${tab}`}
        aria-labelledby={`library-tab-${tab}`}
        tabIndex={0}
      >
        {tab === "albums" && (
          albumList.length
            ? <CollectionGrid collections={albumList} label="Saved albums" />
            : <LibraryEmpty icon="browse" title="Add an album." description="Open an album and add it to keep it in your Library." href="#/browse" action="Browse albums" />
        )}

        {needsSongs && search.status === "loading" && <ResultsSkeleton />}
        {needsSongs && search.status === "error" && <ResultsError message={search.message} />}

        {tab === "recent" && !favorites.size && search.status !== "error" && (
          <RecentLibrary references={references} search={{ schemaVersion: 1, songs: [], revision: "" }} catalog={catalog} onPlay={onPlay} />
        )}
        {tab === "recent" && search.status === "ready" && (
          <RecentLibrary references={references} search={search.index} catalog={catalog} onPlay={onPlay} />
        )}

        {tab === "songs" && !favorites.size && (
          <LibraryEmpty icon="heart" title="Save songs you love." description="Select the heart beside any song and it will appear here." href="#/search" action="Find music" />
        )}
        {tab === "videos" && !favorites.size && (
          <LibraryEmpty icon="video" title="Save a music video." description="Music videos you save with the heart button will appear here." href="#/search" action="Find music videos" />
        )}
        {(tab === "songs" || tab === "videos") && search.status === "ready" && (
          activeSongs.length ? (
            <div class="library-song-view">
              <div class="results-heading">
                <h2>{tab === "videos" ? "Music Videos" : "Songs"}</h2>
                <p>{activeSongs.length.toLocaleString()} saved</p>
              </div>
              <SongResults
                songs={activeSongs.slice(0, visibleCount)}
                catalog={catalog}
                favorites={favorites}
                currentSongId={currentSongId}
                playerStatus={playerStatus}
                onToggleFavorite={onToggleFavorite}
                onPlay={onPlay}
              />
              {visibleCount < activeSongs.length && (
                <button type="button" class="library-load-more secondary-action" onClick={() => setVisibleCount((count) => count + 100)}>
                  Show more
                </button>
              )}
            </div>
          ) : tab === "videos" ? (
            <LibraryEmpty icon="video" title="No saved music videos." description="Save a video-backed song and it will appear here." href="#/search" action="Find music videos" />
          ) : (
            <ResultsError message="Your saved song IDs are no longer present in the current catalog." />
          )
        )}
      </div>
    </section>
  );
}
