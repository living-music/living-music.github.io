import { useEffect, useMemo, useState } from "preact/hooks";
import type { CatalogClient } from "../api";
import { Icon } from "../Icon";
import type { PlayerStatus } from "../player";
import { hrefForCollection, type LibraryView } from "../router";
import type { CatalogIndex, CollectionSummary, SearchIndex, SearchSong } from "../types";
import { Artwork } from "./Artwork";
import { CollectionGrid } from "./CatalogViews";
import { ResultsError, ResultsSkeleton, SongResults, useSearchIndex } from "./SearchLibrary";

export interface LibraryAlbumGroup {
  collection: CollectionSummary;
  savedSongIds: string[];
  albumSaved: boolean;
  addedAt: string;
}

export function libraryAlbumGroups(
  search: SearchIndex,
  catalog: CatalogIndex,
  songIds: Set<string>,
  albumIds: Set<string>,
  songAddedAt: Record<string, string>,
  albumAddedAt: Record<string, string>,
): LibraryAlbumGroup[] {
  const collections = new Map(catalog.collections.map((collection) => [collection.id, collection]));
  const groups = new Map<string, LibraryAlbumGroup>();

  for (const albumId of albumIds) {
    const collection = collections.get(albumId);
    if (!collection) continue;
    groups.set(albumId, {
      collection,
      savedSongIds: [],
      albumSaved: true,
      addedAt: albumAddedAt[albumId] || "",
    });
  }

  for (const song of search.songs) {
    if (!songIds.has(song.id)) continue;
    const collection = collections.get(song.collectionId);
    if (!collection) continue;
    const group = groups.get(song.collectionId) || {
      collection,
      savedSongIds: [],
      albumSaved: false,
      addedAt: "",
    };
    group.savedSongIds.push(song.id);
    if ((songAddedAt[song.id] || "") > group.addedAt) group.addedAt = songAddedAt[song.id] || "";
    groups.set(song.collectionId, group);
  }

  return [...groups.values()];
}

export function recentLibraryAlbumGroups(groups: LibraryAlbumGroup[]): LibraryAlbumGroup[] {
  return [...groups].sort((left, right) =>
    right.addedAt.localeCompare(left.addedAt) ||
    left.collection.title.localeCompare(right.collection.title, undefined, { sensitivity: "base" }),
  );
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

function RecentAlbums({ groups }: { groups: LibraryAlbumGroup[] }) {
  if (!groups.length) {
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
    <div class="recent-library-grid" aria-label="Recently added albums">
      {groups.map((group) => {
        const savedCount = group.savedSongIds.length;
        const detail = savedCount > 0
          ? `${savedCount.toLocaleString()} saved ${savedCount === 1 ? "song" : "songs"}`
          : `${group.collection.songCount.toLocaleString()} ${group.collection.songCount === 1 ? "song" : "songs"}`;
        return (
          <a class="recent-library-card" href={hrefForCollection(group.collection.id)} key={group.collection.id}>
            <Artwork url={group.collection.artworkUrl} alt="" />
            <span class="recent-library-copy">
              <strong>{group.collection.title}</strong>
              <small>{detail}</small>
              <time dateTime={group.addedAt}>Added {formatAddedDate(group.addedAt)}</time>
            </span>
          </a>
        );
      })}
    </div>
  );
}

const emptySearch: SearchIndex = { schemaVersion: 1, songs: [], revision: "" };

export function LibraryViews({
  view,
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
  view: LibraryView;
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
  const [visibleCount, setVisibleCount] = useState(100);
  const search = useSearchIndex(client, favorites.size > 0);

  useEffect(() => setVisibleCount(100), [view]);

  const searchIndex = favorites.size === 0 ? emptySearch : search.status === "ready" ? search.index : undefined;
  const groups = useMemo(
    () => searchIndex
      ? libraryAlbumGroups(searchIndex, catalog, favorites, albums, favoriteAddedAt, albumAddedAt)
      : [],
    [searchIndex, catalog, favorites, albums, favoriteAddedAt, albumAddedAt],
  );
  const recentGroups = useMemo(() => recentLibraryAlbumGroups(groups), [groups]);
  const albumList = useMemo(
    () => groups
      .map((group) => group.collection)
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" })),
    [groups],
  );
  const songs = searchIndex ? savedSongs(searchIndex, favorites) : [];
  const videos = searchIndex ? savedSongs(searchIndex, favorites, true) : [];
  const activeSongs = view === "videos" ? videos : songs;
  const needsSearch = favorites.size > 0;

  return (
    <section class="library-browser" aria-label="Saved library">
      <div class="library-panel">
        {needsSearch && search.status === "loading" && <ResultsSkeleton />}
        {needsSearch && search.status === "error" && <ResultsError message={search.message} />}

        {searchIndex && view === "recent" && <RecentAlbums groups={recentGroups} />}

        {searchIndex && view === "albums" && (
          albumList.length
            ? <CollectionGrid collections={albumList} label="Saved albums" />
            : <LibraryEmpty icon="browse" title="Add an album." description="Save an album or one of its songs to keep it in your Library." href="#/browse" action="Browse albums" />
        )}

        {view === "songs" && !favorites.size && (
          <LibraryEmpty icon="heart" title="Save songs you love." description="Select the heart beside any song and it will appear here." href="#/search" action="Find music" />
        )}
        {view === "videos" && !favorites.size && (
          <LibraryEmpty icon="video" title="Save a music video." description="Music videos you save with the heart button will appear here." href="#/search" action="Find music videos" />
        )}
        {(view === "songs" || view === "videos") && searchIndex && favorites.size > 0 && (
          activeSongs.length ? (
            <div class="library-song-view">
              <div class="results-heading">
                <h2>{view === "videos" ? "Music Videos" : "Songs"}</h2>
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
          ) : view === "videos" ? (
            <LibraryEmpty icon="video" title="No saved music videos." description="Save a video-backed song and it will appear here." href="#/search" action="Find music videos" />
          ) : (
            <ResultsError message="Your saved song IDs are no longer present in the current catalog." />
          )
        )}
      </div>
    </section>
  );
}
