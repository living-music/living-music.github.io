import { describe, expect, it } from "vitest";
import { createPlaylist, deletePlaylist, renamePlaylist } from "./playlists";

const now = "2026-09-07T12:00:00.000Z";

describe("playlist management", () => {
  it("creates a named empty playlist", () => {
    expect(createPlaylist("  Sunday Morning  ", "playlist-one", now)).toEqual({
      id: "playlist-one",
      name: "Sunday Morning",
      createdAt: now,
      updatedAt: now,
      songIds: [],
    });
  });

  it("renames only the selected playlist", () => {
    const first = createPlaylist("First", "first", now);
    const second = createPlaylist("Second", "second", now);
    const renamed = renamePlaylist([first, second], "second", "  Evening  ", "2026-09-08T12:00:00.000Z");
    expect(renamed.map((playlist) => playlist.name)).toEqual(["First", "Evening"]);
    expect(renamed[1].updatedAt).toBe("2026-09-08T12:00:00.000Z");
  });

  it("deletes only the selected playlist", () => {
    const first = createPlaylist("First", "first", now);
    const second = createPlaylist("Second", "second", now);
    expect(deletePlaylist([first, second], "first")).toEqual([second]);
  });
});
