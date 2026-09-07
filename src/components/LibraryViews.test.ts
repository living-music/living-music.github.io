import { describe, expect, it } from "vitest";
import { recentLibraryReferences, savedSongs } from "./LibraryViews";
import type { SearchIndex } from "../types";

const search: SearchIndex = {
  schemaVersion: 1,
  revision: "revision",
  songs: [
    { id: "one", title: "Zion", collectionId: "album", artists: [], recordingTypes: ["AUDIO_VOCAL"] },
    { id: "two", title: "Abide", collectionId: "album", artists: [], recordingTypes: ["VIDEO"] },
    { id: "three", title: "Hidden", collectionId: "album", artists: [], recordingTypes: ["VIDEO"] },
  ],
};

describe("library views", () => {
  it("sorts saved songs and albums by the listener's add timestamp", () => {
    expect(recentLibraryReferences(
      ["one", "two"],
      ["album"],
      { one: "2026-09-01T00:00:00.000Z", two: "2026-09-03T00:00:00.000Z" },
      { album: "2026-09-02T00:00:00.000Z" },
    ).map((item) => `${item.kind}:${item.id}`)).toEqual(["song:two", "album:album", "song:one"]);
  });

  it("returns saved songs alphabetically and filters music videos", () => {
    const ids = new Set(["one", "two"]);
    expect(savedSongs(search, ids).map((song) => song.id)).toEqual(["two", "one"]);
    expect(savedSongs(search, ids, true).map((song) => song.id)).toEqual(["two"]);
  });
});
