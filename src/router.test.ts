import { describe, expect, it } from "vitest";
import { hrefFor, hrefForCollection, hrefForLibrary, hrefForLibraryAlbum, hrefForPlaylist, navigationDestination, routeFromHash } from "./router";

describe("routeFromHash", () => {
  it("reads supported top-level routes", () => {
    expect(routeFromHash("#/browse")).toEqual({ page: "browse" });
    expect(routeFromHash("#search")).toEqual({ page: "search" });
  });

  it("reads Library views and defaults old Library links to Recently Added", () => {
    expect(routeFromHash("#/library/favorites")).toEqual({ page: "library", view: "favorites" });
    expect(routeFromHash("#/library/albums")).toEqual({ page: "library", view: "albums" });
    expect(routeFromHash("#/library")).toEqual({ page: "library", view: "recent" });
    expect(routeFromHash("#/library/unknown")).toEqual({ page: "library", view: "recent" });
  });

  it("reads Library album routes", () => {
    expect(routeFromHash("#/library/album/hymns%20for%20home")).toEqual({
      page: "library-album",
      collectionId: "hymns for home",
    });
    expect(navigationDestination(routeFromHash("#/library/album/hymns"))).toBe("library");
  });

  it("reads playlist routes", () => {
    expect(routeFromHash("#/playlists")).toEqual({ page: "playlists" });
    expect(routeFromHash("#/playlist/sunday%20morning")).toEqual({ page: "playlist", playlistId: "sunday morning" });
    expect(navigationDestination(routeFromHash("#/playlist/one"))).toBe("library");
  });

  it("reads and decodes collection routes", () => {
    expect(routeFromHash("#/collection/hymns%20for%20home")).toEqual({
      page: "collection",
      collectionId: "hymns for home",
    });
    expect(navigationDestination(routeFromHash("#/collection/hymns"))).toBe("browse");
  });

  it("falls back to home for empty, malformed, or unknown routes", () => {
    expect(routeFromHash("")).toEqual({ page: "home" });
    expect(routeFromHash("#/unknown")).toEqual({ page: "home" });
    expect(routeFromHash("#/collection/%E0%A4%A")).toEqual({ page: "home" });
  });
});

describe("route hrefs", () => {
  it("creates GitHub Pages-safe hash links", () => {
    expect(hrefFor("library")).toBe("#/library/recent");
    expect(hrefForLibrary("videos")).toBe("#/library/videos");
    expect(hrefForLibraryAlbum("hymns & songs")).toBe("#/library/album/hymns%20%26%20songs");
    expect(hrefForPlaylist("Sunday & evening")).toBe("#/playlist/Sunday%20%26%20evening");
    expect(hrefForCollection("hymns & songs")).toBe("#/collection/hymns%20%26%20songs");
  });
});
