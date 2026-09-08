import { describe, expect, it } from "vitest";
import { addSongToPlaylist, createPlaylist, deletePlaylist, renamePlaylist, resolvePlaylistSongs } from "./playlists";

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

  it("adds a song once to the selected playlist", () => {
    const first = createPlaylist("First", "first", now);
    const second = createPlaylist("Second", "second", now);
    const added = addSongToPlaylist([first, second], "first", "song:one", "2026-09-08T12:00:00.000Z");
    const duplicate = addSongToPlaylist(added, "first", "song:one", "2026-09-09T12:00:00.000Z");
    expect(duplicate[0].songIds).toEqual(["song:one"]);
    expect(duplicate[0].updatedAt).toBe("2026-09-08T12:00:00.000Z");
    expect(duplicate[1].songIds).toEqual([]);
  });

  it("resolves playlist songs in insertion order and ignores removed catalog IDs", () => {
    const songs = [
      { id: "one", title: "One", collectionId: "album", artists: [], recordingTypes: [] },
      { id: "two", title: "Two", collectionId: "album", artists: [], recordingTypes: [] },
    ];
    expect(resolvePlaylistSongs(songs, ["two", "missing", "one"]).map((song) => song.id)).toEqual(["two", "one"]);
  });

  it("deletes only the selected playlist", () => {
    const first = createPlaylist("First", "first", now);
    const second = createPlaylist("Second", "second", now);
    expect(deletePlaylist([first, second], "first")).toEqual([second]);
  });
});
