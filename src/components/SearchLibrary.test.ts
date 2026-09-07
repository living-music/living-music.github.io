import { describe, expect, it } from "vitest";
import { filterSearchSongs } from "./SearchLibrary";
import type { CatalogIndex, SearchIndex } from "../types";

const catalog: CatalogIndex = {
  schemaVersion: 1,
  language: "eng",
  collections: [{
    id: "children",
    slug: "children",
    title: "Children’s Songbook",
    sourceUrl: "https://example.test/children",
    songCount: 2,
    playableSongCount: 2,
    revision: "revision",
    href: "children.json",
  }],
  stats: { collectionCount: 1, songCount: 2, playableSongCount: 2 },
  search: { revision: "revision", href: "search.json", songCount: 2 },
  revision: "revision",
};

const search: SearchIndex = {
  schemaVersion: 1,
  songs: [
    {
      id: "children:one",
      title: "A Child’s Prayer",
      number: "12",
      collectionId: "children",
      artists: ["José Smith"],
      recordingTypes: ["AUDIO_VOCAL"],
    },
    {
      id: "children:two",
      title: "Faith",
      collectionId: "children",
      artists: [],
      recordingTypes: ["AUDIO_VOCAL"],
    },
  ],
  revision: "revision",
};

describe("filterSearchSongs", () => {
  it("matches normalized titles, numbers, artists, and collection names", () => {
    expect(filterSearchSongs(search, catalog, "child prayer").map((song) => song.id)).toEqual(["children:one"]);
    expect(filterSearchSongs(search, catalog, "12").map((song) => song.id)).toEqual(["children:one"]);
    expect(filterSearchSongs(search, catalog, "jose").map((song) => song.id)).toEqual(["children:one"]);
    expect(filterSearchSongs(search, catalog, "songbook")).toHaveLength(2);
  });

  it("returns no results for an empty query", () => {
    expect(filterSearchSongs(search, catalog, "  ")).toEqual([]);
  });
});
