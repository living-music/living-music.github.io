import { describe, expect, it } from "vitest";
import { hrefFor, hrefForCollection, hrefForLibrary, navigationDestination, routeFromHash } from "./router";

describe("routeFromHash", () => {
  it("reads supported top-level routes", () => {
    expect(routeFromHash("#/browse")).toEqual({ page: "browse" });
    expect(routeFromHash("#search")).toEqual({ page: "search" });
  });

  it("reads Library views and defaults old Library links to Recently Added", () => {
    expect(routeFromHash("#/library/albums")).toEqual({ page: "library", view: "albums" });
    expect(routeFromHash("#/library")).toEqual({ page: "library", view: "recent" });
    expect(routeFromHash("#/library/unknown")).toEqual({ page: "library", view: "recent" });
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
    expect(hrefForCollection("hymns & songs")).toBe("#/collection/hymns%20%26%20songs");
  });
});
