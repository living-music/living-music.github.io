import { describe, expect, it } from "vitest";
import { sanitizedAnalyticsPage } from "./analytics";

describe("sanitizedAnalyticsPage", () => {
  it("reports ordinary routes", () => {
    expect(sanitizedAnalyticsPage("#/browse")).toEqual({
      title: "Browse · Living Music",
      hash: "#/browse",
    });
    expect(sanitizedAnalyticsPage("#/library/downloaded")).toEqual({
      title: "Library: downloaded · Living Music",
      hash: "#/library/downloaded",
    });
  });

  it("removes catalog and listener identifiers", () => {
    expect(sanitizedAnalyticsPage("#/collection/a-secret-album")).toEqual({
      title: "Collection · Living Music",
      hash: "#/collection",
    });
    expect(sanitizedAnalyticsPage("#/playlist/private-playlist-id")).toEqual({
      title: "Playlist · Living Music",
      hash: "#/playlist",
    });
    expect(sanitizedAnalyticsPage("#/library/album/saved-album")).toEqual({
      title: "Library album · Living Music",
      hash: "#/library-album",
    });
  });
});
