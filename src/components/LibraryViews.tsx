import { useEffect, useMemo, useState } from "preact/hooks";
import type { CatalogClient } from "../api";
import { Icon } from "../Icon";
import type { PlayerStatus } from "../player";
import { hrefForLibraryAlbum, type LibraryView } from "../router";
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
        description="Add individual songs or a whole album to see your music here."
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
          ? `${savedCount.toLocaleString()} Library ${savedCount === 1 ? "song" : "songs"}`
          : `${group.collection.songCount.toLocaleString()} ${group.collection.songCount === 1 ? "song" : "songs"}`;
        return (
          <a class="recent-library-card" href={hrefForLibraryAlbum(group.collection.id)} key={group.collection.id}>
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
  librarySongs,
  librarySongAddedAt,
  albums,
  albumAddedAt,
  currentSongId,
  playerStatus,
  onToggleFavorite,
  onToggleLibrarySong,
  onPlay,
}: {
  view: LibraryView;
  client: CatalogClient;
  catalog: CatalogIndex;
  favorites: Set<string>;
  librarySongs: Set<string>;
  librarySongAddedAt: Record<string, string>;
  albums: Set<string>;
  albumAddedAt: Record<string, string>;
  currentSongId?: string;
  playerStatus: PlayerStatus;
  onToggleFavorite: (songId: string) => void;
  onToggleLibrarySong: (songId: string) => void;
  onPlay: (song: SearchSong) => Promise<void>;
}) {
  const [visibleCount, setVisibleCount] = useState(100);
  const needsSearch = favorites.size > 0 || librarySongs.size > 0;
  const search = useSearchIndex(client, needsSearch);

  useEffect(() => setVisibleCount(100), [view]);

  const searchIndex = !needsSearch ? emptySearch : search.status === "ready" ? search.index : undefined;
  const groups = useMemo(
    () => searchIndex
      ? libraryAlbumGroups(searchIndex, catalog, librarySongs, albums, librarySongAddedAt, albumAddedAt)
      : [],
    [searchIndex, catalog, librarySongs, albums, librarySongAddedAt, albumAddedAt],
  );
  const recentGroups = useMemo(() => recentLibraryAlbumGroups(groups), [groups]);
  const albumList = useMemo(
    () => groups
      .map((group) => group.collection)
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { sensitivity: "base" })),
    [groups],
  );
  const songs = searchIndex ? savedSongs(searchIndex, librarySongs) : [];
  const videos = searchIndex ? savedSongs(searchIndex, librarySongs, true) : [];
  const favoriteSongs = searchIndex ? savedSongs(searchIndex, favorites) : [];
  const activeSongs = view === "favorites" ? favoriteSongs : view === "videos" ? videos : songs;

  return (
    <section class="library-browser" aria-label="Saved library">
      <div class="library-panel">
        {needsSearch && search.status === "loading" && <ResultsSkeleton />}
        {needsSearch && search.status === "error" && <ResultsError message={search.message} />}

        {searchIndex && view === "favorites" && (
          favorites.size > 0
            ? <div class="library-song-view">
                <div class="results-heading">
                  <h2>Favorites</h2>
                  <p>{favoriteSongs.length.toLocaleString()} saved</p>
                </div>
                <SongResults
                  songs={favoriteSongs.slice(0, visibleCount)}
                  catalog={catalog}
                  favorites={favorites}
                  librarySongs={librarySongs}
                  currentSongId={currentSongId}
                  playerStatus={playerStatus}
                  onToggleFavorite={onToggleFavorite}
                  onToggleLibrarySong={onToggleLibrarySong}
                  onPlay={onPlay}
                />
                {visibleCount < favoriteSongs.length && (
                  <button type="button" class="library-load-more secondary-action" onClick={() => setVisibleCount((count) => count + 100)}>Show more</button>
                )}
              </div>
            : <LibraryEmpty icon="heart" title="Favorite songs you love." description="Select the heart beside any song and it will appear here." href="#/search" action="Find music" />
        )}

        {searchIndex && view === "recent" && <RecentAlbums groups={recentGroups} />}

        {searchIndex && view === "albums" && (
          albumList.length
            ? <CollectionGrid collections={albumList} label="Saved albums" hrefForItem={hrefForLibraryAlbum} />
            : <LibraryEmpty icon="browse" title="Add an album." description="Add an album or one of its songs to keep it in your Library." href="#/browse" action="Browse albums" />
        )}

        {view === "songs" && !librarySongs.size && (
          <LibraryEmpty icon="browse" title="Add songs to your Library." description="Select the add button beside any song and it will appear here." href="#/search" action="Find music" />
        )}
        {view === "videos" && !librarySongs.size && (
          <LibraryEmpty icon="video" title="Add a music video." description="Video-backed songs you add to your Library will appear here." href="#/search" action="Find music videos" />
        )}
        {(view === "songs" || view === "videos") && searchIndex && librarySongs.size > 0 && (
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
                librarySongs={librarySongs}
                currentSongId={currentSongId}
                playerStatus={playerStatus}
                onToggleFavorite={onToggleFavorite}
                onToggleLibrarySong={onToggleLibrarySong}
                onPlay={onPlay}
              />
              {visibleCount < activeSongs.length && (
                <button type="button" class="library-load-more secondary-action" onClick={() => setVisibleCount((count) => count + 100)}>
                  Show more
                </button>
              )}
            </div>
          ) : view === "videos" ? (
            <LibraryEmpty icon="video" title="No Library music videos." description="Add a video-backed song to your Library and it will appear here." href="#/search" action="Find music videos" />
          ) : (
            <ResultsError message="Your Library song IDs are no longer present in the current catalog." />
          )
        )}
      </div>
    </section>
  );
}
