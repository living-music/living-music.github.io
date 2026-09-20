import { catalogItemId, DEFAULT_CATALOG_LANGUAGE } from "./catalog-identity";
import { CatalogClientError, deviceIsOffline } from "./connectivity";
import type {
  CatalogIndex, CatalogLanguage, CatalogLanguageSummary, CatalogManifest, CollectionPayload,
  CollectionSummary, MultilingualCatalogIndex, Recording, SearchIndex, SearchSong, Song,
} from "./types";

const DISCOVERY_SCHEMA = 1;
const CATALOG_SCHEMA = 2;
export const ALL_CATALOG_LANGUAGES = "all";

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
    throw new CatalogClientError("upstream", `The music catalog is temporarily unavailable (${response.status}).`);
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

function schema(value: unknown, expected: number, label: string): asserts value is Record<string, unknown> & { schemaVersion: number } {
  if (!record(value) || value.schemaVersion !== expected) {
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
function validStats(value: unknown): boolean {
  return record(value) && typeof value.collectionCount === "number" && typeof value.songCount === "number" && typeof value.playableSongCount === "number";
}
function validLanguage(value: unknown): value is CatalogLanguage {
  return record(value) && requiredString(value.code) && requiredString(value.locale) && requiredString(value.name) && requiredString(value.autonym);
}
function validLanguageSummary(value: unknown): value is CatalogLanguageSummary {
  return record(value) && validLanguage(value) && requiredString(value.revision) && requiredString(value.href) && validStats(value.stats);
}
function validSummary(value: unknown): boolean {
  return record(value) && requiredString(value.id) && requiredString(value.slug) && requiredString(value.title) &&
    validArtwork(value.artworkUrl) && requiredString(value.sourceUrl) && typeof value.songCount === "number" &&
    typeof value.playableSongCount === "number" && requiredString(value.revision) && requiredString(value.href) &&
    requiredString(value.language) && stringArray(value.availableLanguages);
}
function validRecording(value: unknown): value is Recording {
  return record(value) && requiredString(value.id) && requiredString(value.type) && requiredString(value.label) &&
    requiredString(value.url) && requiredString(value.language) &&
    (value.durationMs === undefined || typeof value.durationMs === "number") && optionalString(value.artworkUrl);
}
function validSong(value: unknown): boolean {
  return record(value) && requiredString(value.id) && requiredString(value.slug) && requiredString(value.title) &&
    optionalString(value.number) && optionalString(value.section) && optionalString(value.date) && validArtwork(value.artworkUrl) &&
    stringArray(value.artists) && stringArray(value.authors) && stringArray(value.composers) && stringArray(value.arrangers) &&
    stringArray(value.tags) && optionalString(value.sourceUrl) && requiredString(value.language) && stringArray(value.availableLanguages) &&
    Array.isArray(value.recordings) && value.recordings.every(validRecording);
}
function validSearchSong(value: unknown): boolean {
  return record(value) && requiredString(value.id) && requiredString(value.title) && optionalString(value.number) &&
    requiredString(value.collectionId) && stringArray(value.artists) && stringArray(value.recordingTypes) &&
    requiredString(value.language) && stringArray(value.availableLanguages);
}

function assertManifest(value: unknown): asserts value is CatalogManifest {
  schema(value, DISCOVERY_SCHEMA, "The catalog manifest");
  if (!requiredString(value.href) || !requiredString(value.revision) || !requiredString(value.currentVersion) ||
      !record(value.multilingual) || value.multilingual.schemaVersion !== CATALOG_SCHEMA ||
      !requiredString(value.multilingual.href) || !requiredString(value.multilingual.revision) ||
      typeof value.multilingual.languageCount !== "number") {
    throw new CatalogClientError("invalid", "The catalog manifest is incomplete.");
  }
}
function assertMultilingualIndex(value: unknown): asserts value is MultilingualCatalogIndex {
  schema(value, CATALOG_SCHEMA, "The multilingual catalog");
  if (!requiredString(value.defaultLanguage) || !requiredString(value.revision) ||
      !Array.isArray(value.languages) || !value.languages.every(validLanguageSummary)) {
    throw new CatalogClientError("invalid", "The multilingual catalog index is incomplete.");
  }
}
function assertIndex(value: unknown): asserts value is CatalogIndex {
  schema(value, CATALOG_SCHEMA, "The catalog");
  if (!validLanguage(value.language) || !Array.isArray(value.collections) || !value.collections.every(validSummary) ||
      !validStats(value.stats) || !record(value.search) || !requiredString(value.search.href) ||
      !requiredString(value.search.revision) || typeof value.search.songCount !== "number" || !requiredString(value.revision)) {
    throw new CatalogClientError("invalid", "The catalog index is incomplete.");
  }
}
function assertCollection(value: unknown): asserts value is CollectionPayload {
  schema(value, CATALOG_SCHEMA, "This collection");
  if (!requiredString(value.language) || !validSummary(value.collection) || !Array.isArray(value.songs) ||
      !value.songs.every(validSong) || !requiredString(value.revision)) {
    throw new CatalogClientError("invalid", "The collection response is incomplete.");
  }
}
function assertSearch(value: unknown): asserts value is SearchIndex {
  schema(value, CATALOG_SCHEMA, "The search index");
  if (!requiredString(value.language) || !Array.isArray(value.songs) ||
      !value.songs.every(validSearchSong) || !requiredString(value.revision)) {
    throw new CatalogClientError("invalid", "The search index is incomplete.");
  }
}

function normalizeSummary(summary: CollectionSummary, language: CatalogLanguage): CollectionSummary {
  return { ...summary, id: catalogItemId(language.code, summary.id), language: language.code, languageName: language.autonym };
}
function normalizeSong(song: Song, language: CatalogLanguage): Song {
  return { ...song, id: catalogItemId(language.code, song.id), language: language.code, languageName: language.autonym };
}
function normalizeSearchSong(song: SearchSong, language: CatalogLanguage): SearchSong {
  return {
    ...song,
    id: catalogItemId(language.code, song.id),
    collectionId: catalogItemId(language.code, song.collectionId),
    language: language.code,
    languageName: language.autonym,
  };
}

export class CatalogClient {
  readonly apiRoot: URL;
  private multilingualIndex?: Promise<MultilingualCatalogIndex>;
  private multilingualIndexUrl?: URL;
  private languageIndexUrls = new Map<string, URL>();
  private indexes = new Map<string, Promise<CatalogIndex>>();
  private searches = new Map<string, Promise<SearchIndex>>();
  private collections = new Map<string, Promise<CollectionPayload>>();
  private combinedIndex?: Promise<CatalogIndex>;
  private combinedSearch?: Promise<SearchIndex>;

  constructor(apiRoot = defaultRoot()) {
    this.apiRoot = apiRoot;
  }

  loadLanguages(): Promise<MultilingualCatalogIndex> {
    if (!this.multilingualIndex) {
      this.multilingualIndex = this.fetchLanguages();
      this.multilingualIndex.catch(() => { this.multilingualIndex = undefined; });
    }
    return this.multilingualIndex;
  }

  private async fetchLanguages(): Promise<MultilingualCatalogIndex> {
    const manifestData = await fetchJson(new URL("index.json", this.apiRoot), true);
    assertManifest(manifestData);
    this.multilingualIndexUrl = new URL(manifestData.multilingual.href, this.apiRoot);
    const data = await fetchJson(this.multilingualIndexUrl);
    assertMultilingualIndex(data);
    return data;
  }

  loadIndex(language = DEFAULT_CATALOG_LANGUAGE): Promise<CatalogIndex> {
    if (language === ALL_CATALOG_LANGUAGES) return this.loadCombinedIndex();
    let request = this.indexes.get(language);
    if (!request) {
      request = this.fetchIndex(language);
      this.indexes.set(language, request);
      request.catch(() => this.indexes.delete(language));
    }
    return request;
  }

  private async fetchIndex(language: string): Promise<CatalogIndex> {
    const root = await this.loadLanguages();
    const entry = root.languages.find((candidate) => candidate.code === language);
    if (!entry || !this.multilingualIndexUrl) {
      throw new CatalogClientError("invalid", `The ${language} catalog is not available.`);
    }
    const indexUrl = new URL(entry.href, this.multilingualIndexUrl);
    this.languageIndexUrls.set(language, indexUrl);
    const data = await fetchJson(indexUrl);
    assertIndex(data);
    return {
      ...data,
      collections: data.collections.map((summary) => normalizeSummary(summary, data.language)),
    };
  }

  async refreshIndex(language = DEFAULT_CATALOG_LANGUAGE): Promise<CatalogIndex> {
    const previousIndex = this.indexes.get(language);
    const previousSearch = this.searches.get(language);
    const previousUrl = this.languageIndexUrls.get(language);
    this.indexes.delete(language);
    this.searches.delete(language);
    this.languageIndexUrls.delete(language);
    for (const key of this.collections.keys()) {
      if (key.startsWith(`${language}::`)) this.collections.delete(key);
    }
    this.combinedIndex = undefined;
    this.combinedSearch = undefined;
    try {
      return await this.loadIndex(language);
    } catch (error) {
      if (previousIndex) this.indexes.set(language, previousIndex);
      if (previousSearch) this.searches.set(language, previousSearch);
      if (previousUrl) this.languageIndexUrls.set(language, previousUrl);
      throw error;
    }
  }

  loadSearch(language = DEFAULT_CATALOG_LANGUAGE): Promise<SearchIndex> {
    if (language === ALL_CATALOG_LANGUAGES) return this.loadCombinedSearch();
    let request = this.searches.get(language);
    if (!request) {
      request = this.fetchSearch(language);
      this.searches.set(language, request);
      request.catch(() => this.searches.delete(language));
    }
    return request;
  }

  private async fetchSearch(language: string): Promise<SearchIndex> {
    const current = await this.loadIndex(language);
    const indexUrl = this.languageIndexUrls.get(language);
    if (!indexUrl) throw new Error("The catalog index URL is unavailable.");
    const data = await fetchJson(new URL(current.search.href, indexUrl));
    assertSearch(data);
    return {
      ...data,
      songs: data.songs.map((song) => normalizeSearchSong(song, current.language)),
    };
  }

  loadCollection(summary: CollectionSummary): Promise<CollectionPayload> {
    let request = this.collections.get(summary.id);
    if (!request) {
      request = this.fetchCollection(summary);
      this.collections.set(summary.id, request);
      request.catch(() => this.collections.delete(summary.id));
    }
    return request;
  }

  private async fetchCollection(summary: CollectionSummary): Promise<CollectionPayload> {
    const language = summary.language ?? DEFAULT_CATALOG_LANGUAGE;
    const current = await this.loadIndex(language);
    const indexUrl = this.languageIndexUrls.get(language);
    if (!indexUrl) throw new Error("The catalog index URL is unavailable.");
    const data = await fetchJson(new URL(summary.href, indexUrl));
    assertCollection(data);
    return {
      ...data,
      collection: normalizeSummary(data.collection, current.language),
      songs: data.songs.map((song) => normalizeSong(song, current.language)),
    };
  }

  private loadCombinedIndex(): Promise<CatalogIndex> {
    if (!this.combinedIndex) {
      this.combinedIndex = this.buildCombinedIndex();
      this.combinedIndex.catch(() => { this.combinedIndex = undefined; });
    }
    return this.combinedIndex;
  }

  private async buildCombinedIndex(): Promise<CatalogIndex> {
    const root = await this.loadLanguages();
    const settled = await Promise.allSettled(root.languages.map((language) => this.loadIndex(language.code)));
    const indexes = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (!indexes.length) {
      const failure = settled.find((result) => result.status === "rejected");
      throw failure && failure.status === "rejected" ? failure.reason : new CatalogClientError("offline", "No catalog languages are available offline yet.");
    }
    return {
      schemaVersion: CATALOG_SCHEMA,
      language: { code: ALL_CATALOG_LANGUAGES, locale: "mul", name: "All languages", autonym: "All languages" },
      collections: indexes.flatMap((index) => index.collections),
      stats: indexes.reduce((sum, index) => ({
        collectionCount: sum.collectionCount + index.stats.collectionCount,
        songCount: sum.songCount + index.stats.songCount,
        playableSongCount: sum.playableSongCount + index.stats.playableSongCount,
      }), { collectionCount: 0, songCount: 0, playableSongCount: 0 }),
      search: { revision: root.revision, href: "combined", songCount: indexes.reduce((sum, index) => sum + index.search.songCount, 0) },
      revision: root.revision,
    };
  }

  private loadCombinedSearch(): Promise<SearchIndex> {
    if (!this.combinedSearch) {
      this.combinedSearch = this.buildCombinedSearch();
      this.combinedSearch.catch(() => { this.combinedSearch = undefined; });
    }
    return this.combinedSearch;
  }

  private async buildCombinedSearch(): Promise<SearchIndex> {
    const root = await this.loadLanguages();
    const settled = await Promise.allSettled(root.languages.map((language) => this.loadSearch(language.code)));
    const searches = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (!searches.length) {
      const failure = settled.find((result) => result.status === "rejected");
      throw failure && failure.status === "rejected" ? failure.reason : new CatalogClientError("offline", "No catalog searches are available offline yet.");
    }
    return {
      schemaVersion: CATALOG_SCHEMA,
      language: ALL_CATALOG_LANGUAGES,
      songs: searches.flatMap((search) => search.songs),
      revision: root.revision,
    };
  }
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
}
