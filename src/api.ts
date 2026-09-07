import type { CatalogIndex, CatalogManifest, CollectionPayload, CollectionSummary, Recording, SearchIndex, Song } from "./types";

const SCHEMA = 1;

function defaultRoot(): URL {
  const configured = import.meta.env.VITE_MUSIC_API_ROOT as string | undefined;
  if (configured) return new URL(configured, window.location.origin);
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    return new URL("https://living-music.github.io/musicapi/");
  }
  return new URL("/musicapi/", window.location.origin);
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: url.pathname.endsWith("/index.json") ? "no-cache" : "default",
  });
  if (!response.ok) throw new Error(`The music catalog returned ${response.status}.`);
  return response.json();
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function schema(value: unknown, label: string): asserts value is Record<string, unknown> & { schemaVersion: number } {
  if (!record(value) || value.schemaVersion !== SCHEMA) {
    throw new Error(`${label} uses an unsupported catalog format.`);
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

function manifest(value: unknown): asserts value is CatalogManifest {
  schema(value, "The catalog manifest");
  if (!requiredString(value.href) || !requiredString(value.revision) || !requiredString(value.currentVersion)) {
    throw new Error("The catalog manifest is incomplete.");
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
    throw new Error("The catalog index is incomplete.");
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
    throw new Error("The collection response is incomplete.");
  }
}

function search(value: unknown): asserts value is SearchIndex {
  schema(value, "The search index");
  if (!Array.isArray(value.songs)) throw new Error("The search index is incomplete.");
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
    const manifestData = await fetchJson(new URL("index.json", this.apiRoot));
    manifest(manifestData);
    this.indexUrl = new URL(manifestData.href, this.apiRoot);
    const indexData = await fetchJson(this.indexUrl);
    index(indexData);
    this.index = indexData;
    return indexData;
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
