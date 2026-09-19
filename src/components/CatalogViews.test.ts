import { describe, expect, it } from "vitest";
import { visibleCollectionSongs } from "./CatalogViews";
import type { Song } from "../types";

const songs = [
  { id: "one", slug: "one", title: "One", artists: [], authors: [], composers: [], arrangers: [], tags: [], recordings: [{ id: "one:audio", type: "AUDIO_VOCAL", label: "Vocal", url: "https://example.test/one.mp3", language: "eng" }] },
  { id: "two", slug: "two", title: "Two", artists: [], authors: [], composers: [], arrangers: [], tags: [], recordings: [] },
  { id: "three", slug: "three", title: "Three", artists: [], authors: [], composers: [], arrangers: [], tags: [], recordings: [{ id: "three:audio", type: "AUDIO_VOCAL", label: "Vocal", url: "https://example.test/three.mp3", language: "eng" }] },
] satisfies Song[];

describe("Library collection filtering", () => {
  it("shows only individually added songs for a partial Library album", () => {
    expect(visibleCollectionSongs(songs, new Set(["two", "three"])).map((song) => song.id)).toEqual(["three"]);
  });

  it("shows the complete track list for an album added as a whole", () => {
    expect(visibleCollectionSongs(songs).map((song) => song.id)).toEqual(["one", "three"]);
  });
});
