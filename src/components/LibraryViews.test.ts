import { describe, expect, it } from "vitest";
import { favoriteSongsByAddedDate, libraryAlbumGroups, recentLibraryAlbumGroups, savedSongs } from "./LibraryViews";
import type { CatalogIndex, SearchIndex } from "../types";

const search: SearchIndex = {
  schemaVersion: 1,
  revision: "revision",
  songs: [
    { id: "one", title: "Zion", collectionId: "album", artists: [], recordingTypes: ["AUDIO_VOCAL"] },
    { id: "two", title: "Abide", collectionId: "album", artists: [], recordingTypes: ["VIDEO"] },
    { id: "three", title: "Hidden", collectionId: "other", artists: [], recordingTypes: ["VIDEO"] },
  ],
};

const catalog: CatalogIndex = {
  schemaVersion: 1,
  language: "eng",
  revision: "revision",
  collections: [
    { id: "album", slug: "album", title: "First Album", sourceUrl: "", songCount: 2, playableSongCount: 2, revision: "", href: "" },
    { id: "other", slug: "other", title: "Other Album", sourceUrl: "", songCount: 1, playableSongCount: 1, revision: "", href: "" },
  ],
  stats: { collectionCount: 2, songCount: 3, playableSongCount: 3 },
  search: { revision: "", href: "", songCount: 3 },
};

describe("library views", () => {
  it("groups saved songs with their albums and uses each album's newest add date", () => {
    const groups = recentLibraryAlbumGroups(libraryAlbumGroups(
      search,
      catalog,
      new Set(["one", "two", "three"]),
      new Set(["album"]),
      {
        one: "2026-09-01T00:00:00.000Z",
        two: "2026-09-03T00:00:00.000Z",
        three: "2026-09-02T00:00:00.000Z",
      },
      { album: "2026-08-30T00:00:00.000Z" },
    ));

    expect(groups.map((group) => group.collection.id)).toEqual(["album", "other"]);
    expect(groups[0].savedSongIds).toEqual(["one", "two"]);
    expect(groups[0].addedAt).toBe("2026-09-03T00:00:00.000Z");
  });

  it("includes an explicitly saved album without individually saved songs", () => {
    const groups = libraryAlbumGroups(search, catalog, new Set(), new Set(["other"]), {}, {
      other: "2026-09-02T00:00:00.000Z",
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ albumSaved: true, savedSongIds: [], addedAt: "2026-09-02T00:00:00.000Z" });
  });

  it("sorts Favorites by when each song was favorited, newest first", () => {
    expect(favoriteSongsByAddedDate(
      search,
      new Set(["one", "two", "three"]),
      {
        one: "2026-09-01T00:00:00.000Z",
        two: "2026-09-03T00:00:00.000Z",
        three: "2026-09-02T00:00:00.000Z",
      },
    ).map((song) => song.id)).toEqual(["two", "three", "one"]);
  });

  it("returns saved songs alphabetically and filters music videos", () => {
    const ids = new Set(["one", "two"]);
    expect(savedSongs(search, ids).map((song) => song.id)).toEqual(["two", "one"]);
    expect(savedSongs(search, ids, true).map((song) => song.id)).toEqual(["two"]);
  });
});
