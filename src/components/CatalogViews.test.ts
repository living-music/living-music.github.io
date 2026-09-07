import { describe, expect, it } from "vitest";
import { visibleCollectionSongs } from "./CatalogViews";
import type { Song } from "../types";

const songs = [
  { id: "one", slug: "one", title: "One", artists: [], authors: [], composers: [], arrangers: [], tags: [], recordings: [] },
  { id: "two", slug: "two", title: "Two", artists: [], authors: [], composers: [], arrangers: [], tags: [], recordings: [] },
] satisfies Song[];

describe("Library collection filtering", () => {
  it("shows only individually added songs for a partial Library album", () => {
    expect(visibleCollectionSongs(songs, new Set(["two"])).map((song) => song.id)).toEqual(["two"]);
  });

  it("shows the complete track list for an album added as a whole", () => {
    expect(visibleCollectionSongs(songs).map((song) => song.id)).toEqual(["one", "two"]);
  });
});
