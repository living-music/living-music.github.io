import { CatalogClientError, deviceIsOffline } from "./connectivity";
import type { CatalogIndex, CatalogManifest, CollectionPayload, CollectionSummary, Recording, SearchIndex, SearchSong, Song } from "./types";

const SCHEMA = 1;

function defaultRoot(): URL {
  const configured = import.meta.env.VITE_MUSIC_API_ROOT as string | undefined;
  if (configured) return new URL(configured, window.location.origin);
  if (import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return new URL("https://living-music.github.io/musicapi/");
  }
  return new URL("/musicapi/", window.location.origin);
}

async function fetchJson(url: URL, revalidate = false): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: revalidate ? "no-cache" : "default",
    });
  } catch (cause) {
    throw new CatalogClientError(
      deviceIsOffline() ? "offline" : "upstream",
      deviceIsOffline()
        ? "You’re offline, and this part of the catalog has not been saved on this device yet."
        : "The music catalog could not be reached. Try again shortly.",
      { cause },
    );
  }
  if (!response.ok) {
    throw new CatalogClientError(
      "upstream",
      `The music catalog is temporarily unavailable (${response.status}).`,
    );
  }
  try {
    return await response.json();
  } catch (cause) {
    throw new CatalogClientError("invalid", "The music catalog returned unreadable data.", { cause });
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function schema(value: unknown, label: string): asserts value is Record<string, unknown> & { schemaVersion: number } {
  if (!record(value) || value.schemaVersion !== SCHEMA) {
    throw new CatalogClientError("unsupported", `${label} uses an unsupported catalog format.`);
  }
}

function requiredString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function validArtwork(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function validSummary(value: unknown): value is CollectionSummary {
  return record(value) &&
    requiredString(value.id) &&
    requiredString(value.slug) &&
    requiredString(value.title) &&
    validArtwork(value.artworkUrl) &&
    requiredString(value.sourceUrl) &&
    typeof value.songCount === "number" &&
    typeof value.playableSongCount === "number" &&
    requiredString(value.revision) &&
    requiredString(value.href);
}

function validRecording(value: unknown): value is Recording {
  return record(value) &&
    requiredString(value.id) &&
    requiredString(value.type) &&
    requiredString(value.label) &&
    requiredString(value.url) &&
    requiredString(value.language) &&
    (value.durationMs === undefined || typeof value.durationMs === "number") &&
    optionalString(value.artworkUrl);
}

function validSong(value: unknown): value is Song {
  return record(value) &&
    requiredString(value.id) &&
    requiredString(value.slug) &&
    requiredString(value.title) &&
    optionalString(value.number) &&
    optionalString(value.section) &&
    optionalString(value.date) &&
    validArtwork(value.artworkUrl) &&
    stringArray(value.artists) &&
    stringArray(value.authors) &&
    stringArray(value.composers) &&
    stringArray(value.arrangers) &&
    stringArray(value.tags) &&
    optionalString(value.sourceUrl) &&
    Array.isArray(value.recordings) &&
    value.recordings.every(validRecording);
}

function validSearchSong(value: unknown): value is SearchSong {
  return record(value) &&
    requiredString(value.id) &&
    requiredString(value.title) &&
    optionalString(value.number) &&
    requiredString(value.collectionId) &&
    stringArray(value.artists) &&
    stringArray(value.recordingTypes);
}

function manifest(value: unknown): asserts value is CatalogManifest {
  schema(value, "The catalog manifest");
  if (!requiredString(value.href) || !requiredString(value.revision) || !requiredString(value.currentVersion)) {
    throw new CatalogClientError("invalid", "The catalog manifest is incomplete.");
  }
}

function index(value: unknown): asserts value is CatalogIndex {
  schema(value, "The catalog");
  if (
    !Array.isArray(value.collections) ||
    !value.collections.every(validSummary) ||
    !record(value.stats) ||
    typeof value.stats.collectionCount !== "number" ||
    typeof value.stats.songCount !== "number" ||
    typeof value.stats.playableSongCount !== "number" ||
    !record(value.search) ||
    !requiredString(value.search.href)
  ) {
    throw new CatalogClientError("invalid", "The catalog index is incomplete.");
  }
}

function collection(value: unknown): asserts value is CollectionPayload {
  schema(value, "This collection");
  if (
    !validSummary(value.collection) ||
    !Array.isArray(value.songs) ||
    !value.songs.every(validSong) ||
    !requiredString(value.revision)
  ) {
    throw new CatalogClientError("invalid", "The collection response is incomplete.");
  }
}

function search(value: unknown): asserts value is SearchIndex {
  schema(value, "The search index");
  if (!Array.isArray(value.songs) || !value.songs.every(validSearchSong) || !requiredString(value.revision)) {
    throw new CatalogClientError("invalid", "The search index is incomplete.");
  }
}

export class CatalogClient {
  readonly apiRoot: URL;
  private indexUrl?: URL;
  private index?: CatalogIndex;
  private search?: SearchIndex;
  private collections = new Map<string, Promise<CollectionPayload>>();

  constructor(apiRoot = defaultRoot()) {
    this.apiRoot = apiRoot;
  }

  async loadIndex(): Promise<CatalogIndex> {
    if (this.index) return this.index;
    const manifestData = await fetchJson(new URL("index.json", this.apiRoot), true);
    manifest(manifestData);
    this.indexUrl = new URL(manifestData.href, this.apiRoot);
    const indexData = await fetchJson(this.indexUrl);
    index(indexData);
    this.index = indexData;
    return indexData;
  }

  async refreshIndex(): Promise<CatalogIndex> {
    const previous = {
      index: this.index,
      indexUrl: this.indexUrl,
      search: this.search,
      collections: this.collections,
    };
    this.index = undefined;
    this.indexUrl = undefined;
    this.search = undefined;
    this.collections = new Map();
    try {
      return await this.loadIndex();
    } catch (error) {
      this.index = previous.index;
      this.indexUrl = previous.indexUrl;
      this.search = previous.search;
      this.collections = previous.collections;
      throw error;
    }
  }

  async loadSearch(): Promise<SearchIndex> {
    if (this.search) return this.search;
    const current = await this.loadIndex();
    if (!this.indexUrl) throw new Error("The catalog index URL is unavailable.");
    const data = await fetchJson(new URL(current.search.href, this.indexUrl));
    search(data);
    this.search = data;
    return data;
  }

  async loadCollection(summary: CollectionSummary): Promise<CollectionPayload> {
    let request = this.collections.get(summary.id);
    if (!request) {
      request = this.fetchCollection(summary);
      this.collections.set(summary.id, request);
      request.catch(() => this.collections.delete(summary.id));
    }
    return request;
  }

  private async fetchCollection(summary: CollectionSummary): Promise<CollectionPayload> {
    await this.loadIndex();
    if (!this.indexUrl) throw new Error("The catalog index URL is unavailable.");
    const data = await fetchJson(new URL(summary.href, this.indexUrl));
    collection(data);
    return data;
  }
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
}
