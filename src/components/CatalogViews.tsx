import { useEffect, useState } from "preact/hooks";
import { CatalogClient } from "../api";
import { catalogFailure, type CatalogFailureKind } from "../connectivity";
import { Icon } from "../Icon";
import type { PlayerStatus } from "../player";
import { hrefForCollection } from "../router";
import type { Playlist } from "../storage";
import type { DownloadRecord } from "../downloads";
import type { CollectionPayload, CollectionSummary, Song } from "../types";
import { Artwork } from "./Artwork";
import { DownloadStatus } from "./DownloadStatus";
import { SongContextMenu, type ContextMenuPosition } from "./SongContextMenu";

export function CatalogSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div class="collection-grid" aria-label="Loading collections" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div class="collection-card skeleton-card" key={index}>
          <span class="skeleton artwork-skeleton" />
          <span class="skeleton skeleton-title" />
          <span class="skeleton skeleton-detail" />
        </div>
      ))}
    </div>
  );
}

export function CatalogError({
  message,
  kind = "upstream",
  onRetry,
}: {
  message: string;
  kind?: CatalogFailureKind;
  onRetry: () => void;
}) {
  const title = kind === "offline"
    ? "You’re offline."
    : kind === "unsupported"
      ? "Living Music needs an update."
      : kind === "invalid"
        ? "The catalog couldn’t be read."
        : "The library couldn’t be loaded.";
  return (
    <section class={`catalog-error catalog-error-${kind}`} role="alert">
      <span class="empty-icon"><Icon name="music" size={28} /></span>
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
        <div class="error-actions">
          <button type="button" class="primary-action" onClick={onRetry}>Try again</button>
          <a class="secondary-action" href="https://www.churchofjesuschrist.org/media/music/collections/all-music?lang=eng">
            Open the official library
          </a>
        </div>
      </div>
    </section>
  );
}

export function CollectionGrid({
  collections,
  label,
  hrefForItem = hrefForCollection,
}: {
  collections: CollectionSummary[];
  label: string;
  hrefForItem?: (collectionId: string) => string;
}) {
  return (
    <div class="collection-grid" aria-label={label}>
      {collections.map((collection) => (
        <a class="collection-card" href={hrefForItem(collection.id)} key={collection.id}>
          <Artwork url={collection.artworkUrl} alt="" />
          <strong>{collection.title}</strong>
          <small>
            {collection.songCount.toLocaleString()} {collection.songCount === 1 ? "song" : "songs"}
          </small>
        </a>
      ))}
    </div>
  );
}

type CollectionState =
  | { status: "loading" }
  | { status: "ready"; payload: CollectionPayload }
  | { status: "error"; message: string; kind: CatalogFailureKind };

function songCredits(song: Song): string {
  const names = song.artists.length ? song.artists : song.composers.length ? song.composers : song.authors;
  return names.length ? names.slice(0, 2).join(", ") : song.section || "Sacred music";
}

export function visibleCollectionSongs(songs: Song[], visibleSongIds?: Set<string>): Song[] {
  return visibleSongIds ? songs.filter((song) => visibleSongIds.has(song.id)) : songs;
}

export function CollectionPage({
  client,
  summary,
  currentSongId,
  playerStatus,
  onPlay,
  onPlayNext,
  onAddToQueue,
  favorites,
  onToggleFavorite,
  librarySongs,
  onToggleLibrarySong,
  playlists,
  onAddToPlaylist,
  downloads,
  onDownload,
  onRemoveDownload,
  onDownloadAlbum,
  onCollectionLoaded,
  visibleSongIds,
  libraryContext = false,
  savedAlbum,
  onToggleAlbum,
}: {
  client: CatalogClient;
  summary: CollectionSummary;
  currentSongId?: string;
  playerStatus: PlayerStatus;
  onPlay: (song: Song, songs: Song[], collection: CollectionSummary) => void;
  onPlayNext: (song: Song, collection: CollectionSummary) => void;
  onAddToQueue: (song: Song, collection: CollectionSummary) => void;
  favorites: Set<string>;
  onToggleFavorite: (songId: string) => void;
  librarySongs: Set<string>;
  onToggleLibrarySong: (songId: string) => void;
  playlists: Playlist[];
  onAddToPlaylist: (playlistId: string, songId: string) => void;
  downloads: Map<string, DownloadRecord>;
  onDownload: (song: Song, collection: CollectionSummary) => void;
  onRemoveDownload: (songId: string) => void;
  onDownloadAlbum: (songs: Song[], collection: CollectionSummary, remove: boolean) => void;
  onCollectionLoaded: (songs: Song[]) => void;
  visibleSongIds?: Set<string>;
  libraryContext?: boolean;
  savedAlbum: boolean;
  onToggleAlbum: () => void;
}) {
  const [request, setRequest] = useState(0);
  const [menu, setMenu] = useState<{ songId: string; position: ContextMenuPosition }>();
  const [state, setState] = useState<CollectionState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    client.loadCollection(summary).then(
      (payload) => {
        if (active) { setState({ status: "ready", payload }); onCollectionLoaded(payload.songs); }
      },
      (error: unknown) => {
        const failure = catalogFailure(error, "An unexpected catalog error occurred.");
        if (active) setState({ status: "error", ...failure });
      },
    );
    return () => { active = false; };
  }, [client, summary.id, request, onCollectionLoaded]);

  if (state.status === "loading") {
    return (
      <div class="page collection-page" aria-busy="true">
        <a class="back-link" href={libraryContext ? "#/library/albums" : "#/browse"}><Icon name="back" size={18} /> {libraryContext ? "Albums" : "Browse"}</a>
        <div class="collection-header collection-header-skeleton">
          <span class="skeleton collection-artwork-skeleton" />
          <div>
            <span class="skeleton skeleton-kicker" />
            <span class="skeleton skeleton-heading" />
            <span class="skeleton skeleton-detail" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div class="page collection-page">
        <a class="back-link" href={libraryContext ? "#/library/albums" : "#/browse"}><Icon name="back" size={18} /> {libraryContext ? "Albums" : "Browse"}</a>
        <CatalogError message={state.message} kind={state.kind} onRetry={() => setRequest((value) => value + 1)} />
      </div>
    );
  }

  const { collection, songs: collectionSongs } = state.payload;
  const songs = visibleCollectionSongs(collectionSongs, visibleSongIds);
  const downloadableSongs = songs.filter((song) => song.recordings.length > 0);
  const downloadedCount = downloadableSongs.filter((song) => {
    const record = downloads.get(song.id);
    return record?.status === "downloaded" || record?.status === "stale";
  }).length;
  const albumDownloaded = downloadableSongs.length > 0 && downloadedCount === downloadableSongs.length;

  return (
    <div class="page collection-page">
      <a class="back-link" href={libraryContext ? "#/library/albums" : "#/browse"}><Icon name="back" size={18} /> {libraryContext ? "Albums" : "Browse"}</a>
      <header class="collection-header">
        <Artwork url={collection.artworkUrl} alt="" className="collection-artwork" eager />
        <div class="collection-header-copy">
          <p class="section-kicker">Collection</p>
          <h1>{collection.title}</h1>
          <p>
            {libraryContext
              ? `${songs.length.toLocaleString()} ${songs.length === 1 ? "song" : "songs"} in your Library`
              : `${collection.songCount.toLocaleString()} songs · ${collection.playableSongCount.toLocaleString()} with audio`}
          </p>
          <div class="collection-header-actions">
            <button
              type="button"
              class={`album-library-button ${savedAlbum ? "is-saved" : ""}`}
              onClick={onToggleAlbum}
              aria-pressed={savedAlbum}
            >
              <Icon name={savedAlbum ? "check" : "add"} size={17} />
              {savedAlbum ? "Added to Library" : "Add Album to Library"}
            </button>
            <button type="button" class="album-download-button" onClick={() => onDownloadAlbum(downloadableSongs, collection, albumDownloaded)} disabled={!downloadableSongs.length}>
              <Icon name={albumDownloaded ? "check" : "download"} size={17} />
              {albumDownloaded ? "Remove Downloads" : downloadedCount ? `Download Remaining (${downloadedCount}/${downloadableSongs.length})` : "Download Album"}
            </button>
            <a class="source-link" href={collection.sourceUrl}>
              View in the official music library <Icon name="chevron" size={16} />
            </a>
          </div>
        </div>
      </header>

      <section class="song-section" aria-labelledby="songs-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Track list</p>
            <h2 id="songs-title">Songs</h2>
          </div>
        </div>
        {libraryContext && songs.length === 0 && (
          <div class="collection-library-empty">
            <Icon name="music" size={24} />
            <p>No individually added songs remain in this album.</p>
            <a href="#/library/albums">Back to Albums</a>
          </div>
        )}
        <ol class="song-list">
          {songs.map((song, index) => {
            const isCurrent = currentSongId === song.id;
            const isPlaying = isCurrent && (playerStatus === "playing" || playerStatus === "loading");
            const unavailable = song.recordings.length === 0;
            const download = downloads.get(song.id);
            return (
              <li
                class={`song-row ${isCurrent ? "is-current" : ""}`}
                key={song.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({ songId: song.id, position: { x: event.clientX, y: event.clientY } });
                }}
              >
                <button
                  type="button"
                  class="song-button"
                  onClick={() => onPlay(song, songs, collection)}
                  disabled={unavailable}
                  aria-label={unavailable
                    ? `${song.title}, no audio available`
                    : isPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                >
                  <span class="song-number">{song.number || index + 1}</span>
                  <Artwork url={song.artworkUrl || collection.artworkUrl} alt="" className="song-artwork" />
                  <span class="song-copy">
                    <strong>{song.title}</strong>
                    <small>{songCredits(song)}</small>
                  </span>
                  <span class="recording-count">
                    {unavailable
                      ? "No audio"
                      : `${song.recordings.length} ${song.recordings.length === 1 ? "recording" : "recordings"}`}
                  </span>
                </button>
                <div class="song-row-actions">
                  <button
                    type="button"
                    class={`song-library-button ${librarySongs.has(song.id) || savedAlbum ? "is-added" : ""}`}
                    onClick={() => onToggleLibrarySong(song.id)}
                    disabled={savedAlbum}
                    aria-label={savedAlbum
                      ? `${song.title} is included with this saved album`
                      : librarySongs.has(song.id) ? `Remove ${song.title} from Library` : `Add ${song.title} to Library`}
                    aria-pressed={librarySongs.has(song.id) || savedAlbum}
                  >
                    <Icon name={librarySongs.has(song.id) || savedAlbum ? "check" : "add"} size={18} />
                  </button>
                  <button
                    type="button"
                    class={`song-favorite-button ${favorites.has(song.id) ? "is-favorite" : ""}`}
                    onClick={() => onToggleFavorite(song.id)}
                    aria-label={favorites.has(song.id) ? `Remove ${song.title} from favorites` : `Add ${song.title} to favorites`}
                    aria-pressed={favorites.has(song.id)}
                  >
                    <Icon name="heart" filled={favorites.has(song.id)} size={18} />
                  </button>
                  <DownloadStatus download={download} />
                  {!unavailable && (
                    <button
                      type="button"
                      class="song-more-button"
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setMenu(menu?.songId === song.id ? undefined : { songId: song.id, position: { x: rect.right, y: rect.bottom } });
                      }}
                      aria-label={`Options for ${song.title}`}
                      aria-expanded={menu?.songId === song.id}
                    >
                      <Icon name="more" size={20} />
                    </button>
                  )}
                </div>
                {menu?.songId === song.id && (
                  <SongContextMenu
                    songId={song.id}
                    title={song.title}
                    position={menu.position}
                    favorite={favorites.has(song.id)}
                    inLibrary={librarySongs.has(song.id) || savedAlbum}
                    libraryActionDisabled={savedAlbum}
                    playlists={playlists}
                    onFavorite={() => onToggleFavorite(song.id)}
                    onToggleLibrary={() => onToggleLibrarySong(song.id)}
                    onPlayNext={() => onPlayNext(song, collection)}
                    onAddToQueue={() => onAddToQueue(song, collection)}
                    onAddToPlaylist={(playlistId) => onAddToPlaylist(playlistId, song.id)}
                    download={download}
                    onDownload={() => onDownload(song, collection)}
                    onRemoveDownload={() => onRemoveDownload(song.id)}
                    onClose={() => setMenu(undefined)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
