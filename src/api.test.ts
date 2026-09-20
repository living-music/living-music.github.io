import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogClient } from "./api";

const stats = { collectionCount: 1, songCount: 1, playableSongCount: 1 };
const language = { code: "eng", locale: "en", name: "English", autonym: "English" };
const summary = {
  id: "hymns", slug: "hymns", title: "Hymns", artworkUrl: null,
  sourceUrl: "https://www.churchofjesuschrist.org/media/music/collections/hymns",
  songCount: 1, playableSongCount: 1, revision: "collection-revision",
  href: "collections/hymns.json?v=collection-revision", language: "eng", availableLanguages: ["eng"],
};
const manifest = {
  schemaVersion: 1, currentVersion: "v1", revision: "legacy-revision", href: "v1/index.json?v=legacy-revision",
  multilingual: { schemaVersion: 2, revision: "multi-revision", href: "v2/index.json?v=multi-revision", languageCount: 1 },
};
const multilingual = {
  schemaVersion: 2, defaultLanguage: "eng", revision: "multi-revision",
  languages: [{ ...language, revision: "eng-revision", href: "languages/eng/index.json?v=eng-revision", stats }],
};
const index = {
  schemaVersion: 2, language, collections: [summary], stats,
  search: { revision: "search-revision", href: "search.json?v=search-revision", songCount: 1 }, revision: "eng-revision",
};
const search = {
  schemaVersion: 2, language: "eng", revision: "search-revision",
  songs: [{ id: "song", title: "Song", collectionId: "hymns", artists: [], recordingTypes: ["AUDIO_VOCAL"], language: "eng", availableLanguages: ["eng"] }],
};

function payloadFor(url: string): unknown {
  if (url.includes("collections/")) return { schemaVersion: 2, language: "eng", collection: summary, songs: [], revision: "collection-revision" };
  if (url.includes("search.json")) return search;
  if (url.includes("languages/eng")) return index;
  if (url.includes("/v2/")) return multilingual;
  return manifest;
}

afterEach(() => vi.unstubAllGlobals());

describe("CatalogClient", () => {
  it("follows revisioned multilingual links and qualifies client identities", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      new Response(JSON.stringify(payloadFor(String(input))), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new CatalogClient(new URL("https://example.test/musicapi/"));
    const loadedIndex = await client.loadIndex();
    await client.loadCollection(loadedIndex.collections[0]);
    const loadedSearch = await client.loadSearch();

    expect(loadedIndex.collections[0]).toMatchObject({ id: "eng::hymns", languageName: "English" });
    expect(loadedSearch.songs[0]).toMatchObject({ id: "eng::song", collectionId: "eng::hymns" });
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "https://example.test/musicapi/index.json",
      "https://example.test/musicapi/v2/index.json?v=multi-revision",
      "https://example.test/musicapi/v2/languages/eng/index.json?v=eng-revision",
      "https://example.test/musicapi/v2/languages/eng/collections/hymns.json?v=collection-revision",
      "https://example.test/musicapi/v2/languages/eng/search.json?v=search-revision",
    ]);
  });

  it("keeps equal source IDs distinct when catalogs are combined", async () => {
    const spa = { code: "spa", locale: "es", name: "Spanish", autonym: "Español" };
    const root = {
      ...multilingual,
      languages: [multilingual.languages[0], { ...spa, revision: "spa-revision", href: "languages/spa/index.json?v=spa-revision", stats }],
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      let payload: unknown = manifest;
      if (url.includes("/v2/index")) payload = root;
      else if (url.includes("languages/eng/search")) payload = search;
      else if (url.includes("languages/spa/search")) payload = { ...search, language: "spa", songs: search.songs.map((song) => ({ ...song, language: "spa", availableLanguages: ["spa"] })) };
      else if (url.includes("languages/eng")) payload = index;
      else if (url.includes("languages/spa")) payload = { ...index, language: spa, collections: [{ ...summary, language: "spa", availableLanguages: ["spa"] }] };
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new CatalogClient(new URL("https://example.test/musicapi/"));
    const combinedIndex = await client.loadIndex("all");
    const combinedSearch = await client.loadSearch("all");

    expect(combinedIndex.collections.map((entry) => entry.id)).toEqual(["eng::hymns", "spa::hymns"]);
    expect(combinedSearch.songs.map((entry) => entry.id)).toEqual(["eng::song", "spa::song"]);
  });

  it("rejects a discovery manifest without the multilingual schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...manifest, multilingual: undefined }), { status: 200 })));
    await expect(new CatalogClient(new URL("https://example.test/")).loadIndex()).rejects.toThrow("manifest is incomplete");
  });

  it("rejects malformed compact search records", async () => {
    const brokenSearch = { ...search, songs: [{ ...search.songs[0], artists: "not-an-array" }] };
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const payload = url.includes("search.json") ? brokenSearch : payloadFor(url);
      return new Response(JSON.stringify(payload), { status: 200 });
    }));
    await expect(new CatalogClient(new URL("https://example.test/musicapi/")).loadSearch()).rejects.toThrow("search index is incomplete");
  });
});

describe("catalog failure recovery", () => {
  it("classifies a failed fetch while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(new CatalogClient(new URL("https://example.test/musicapi/")).loadIndex()).rejects.toMatchObject({ kind: "offline" });
  });

  it("restores the last in-memory language catalog when refresh fails", async () => {
    let available = true;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (!available) throw new TypeError("Failed to fetch");
      return new Response(JSON.stringify(payloadFor(String(input))), { status: 200 });
    }));
    const client = new CatalogClient(new URL("https://example.test/musicapi/"));
    const initial = await client.loadIndex();
    available = false;
    await expect(client.refreshIndex()).rejects.toMatchObject({ kind: "upstream" });
    await expect(client.loadIndex()).resolves.toBe(initial);
  });
});
