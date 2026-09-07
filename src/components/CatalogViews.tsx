import { useEffect, useState } from "preact/hooks";
import { CatalogClient } from "../api";
import { Icon } from "../Icon";
import { hrefForCollection } from "../router";
import type { CollectionPayload, CollectionSummary, Song } from "../types";
import { Artwork } from "./Artwork";

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

export function CatalogError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section class="catalog-error" role="alert">
      <span class="empty-icon"><Icon name="music" size={28} /></span>
      <div>
        <h2>The library couldn’t be loaded.</h2>
        <p>{message} Check your connection, then try again.</p>
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

export function CollectionGrid({ collections, label }: { collections: CollectionSummary[]; label: string }) {
  return (
    <div class="collection-grid" aria-label={label}>
      {collections.map((collection) => (
        <a class="collection-card" href={hrefForCollection(collection.id)} key={collection.id}>
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
  | { status: "error"; message: string };

function songCredits(song: Song): string {
  const names = song.artists.length ? song.artists : song.composers.length ? song.composers : song.authors;
  return names.length ? names.slice(0, 2).join(", ") : song.section || "Sacred music";
}

export function CollectionPage({ client, summary }: { client: CatalogClient; summary: CollectionSummary }) {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<CollectionState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    client.loadCollection(summary).then(
      (payload) => active && setState({ status: "ready", payload }),
      (error: unknown) => active && setState({
        status: "error",
        message: error instanceof Error ? error.message : "An unexpected catalog error occurred.",
      }),
    );
    return () => { active = false; };
  }, [client, summary.id, request]);

  if (state.status === "loading") {
    return (
      <div class="page collection-page" aria-busy="true">
        <a class="back-link" href="#/browse"><Icon name="back" size={18} /> Browse</a>
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
        <a class="back-link" href="#/browse"><Icon name="back" size={18} /> Browse</a>
        <CatalogError message={state.message} onRetry={() => setRequest((value) => value + 1)} />
      </div>
    );
  }

  const { collection, songs } = state.payload;

  return (
    <div class="page collection-page">
      <a class="back-link" href="#/browse"><Icon name="back" size={18} /> Browse</a>
      <header class="collection-header">
        <Artwork url={collection.artworkUrl} alt="" className="collection-artwork" eager />
        <div class="collection-header-copy">
          <p class="section-kicker">Collection</p>
          <h1>{collection.title}</h1>
          <p>
            {collection.songCount.toLocaleString()} songs · {collection.playableSongCount.toLocaleString()} with audio
          </p>
          <a class="source-link" href={collection.sourceUrl}>
            View in the official music library <Icon name="chevron" size={16} />
          </a>
        </div>
      </header>

      <section class="song-section" aria-labelledby="songs-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Track list</p>
            <h2 id="songs-title">Songs</h2>
          </div>
        </div>
        <ol class="song-list">
          {songs.map((song, index) => (
            <li class="song-row" key={song.id}>
              <span class="song-number">{song.number || index + 1}</span>
              <Artwork url={song.artworkUrl || collection.artworkUrl} alt="" className="song-artwork" />
              <span class="song-copy">
                <strong>{song.title}</strong>
                <small>{songCredits(song)}</small>
              </span>
              <span class="recording-count">
                {song.recordings.length
                  ? `${song.recordings.length} ${song.recordings.length === 1 ? "recording" : "recordings"}`
                  : "No audio"}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
