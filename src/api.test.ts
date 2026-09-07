import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogClient } from "./api";
import type { CollectionSummary } from "./types";

const summary: CollectionSummary = {
  id: "hymns",
  slug: "hymns",
  title: "Hymns",
  artworkUrl: null,
  sourceUrl: "https://www.churchofjesuschrist.org/media/music/collections/hymns",
  songCount: 1,
  playableSongCount: 1,
  revision: "collection-revision",
  href: "collections/hymns.json?v=collection-revision",
};

const manifest = {
  schemaVersion: 1,
  currentVersion: "v1",
  revision: "index-revision",
  href: "v1/index.json?v=index-revision",
};

const index = {
  schemaVersion: 1,
  language: "eng",
  collections: [summary],
  stats: { collectionCount: 1, songCount: 1, playableSongCount: 1 },
  search: { revision: "search-revision", href: "search.json?v=search-revision", songCount: 1 },
  revision: "index-revision",
};

afterEach(() => vi.unstubAllGlobals());

describe("CatalogClient", () => {
  it("follows revisioned links from the documents that declare them", async () => {
    const collection = { schemaVersion: 1, collection: summary, songs: [], revision: "collection-revision" };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const payload = url.includes("collections/") ? collection : url.includes("/v1/") ? index : manifest;
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new CatalogClient(new URL("https://example.test/musicapi/"));
    const loadedIndex = await client.loadIndex();
    await client.loadCollection(loadedIndex.collections[0]);

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "https://example.test/musicapi/index.json",
      "https://example.test/musicapi/v1/index.json?v=index-revision",
      "https://example.test/musicapi/v1/collections/hymns.json?v=collection-revision",
    ]);
  });

  it("rejects an unsupported schema before exposing catalog data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ...manifest, schemaVersion: 2 }), { status: 200 }),
    ));

    await expect(new CatalogClient(new URL("https://example.test/")).loadIndex())
      .rejects.toThrow("unsupported catalog format");
  });

  it("rejects malformed collection entries", async () => {
    const brokenIndex = { ...index, collections: [{ ...summary, href: undefined }] };
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      new Response(JSON.stringify(String(input).includes("/v1/") ? brokenIndex : manifest), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(new CatalogClient(new URL("https://example.test/musicapi/")).loadIndex())
      .rejects.toThrow("catalog index is incomplete");
  });
});
