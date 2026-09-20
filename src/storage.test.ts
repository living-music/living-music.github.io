import { describe, expect, it } from "vitest";
import { parseUserState } from "./storage";

describe("parseUserState", () => {
  it("keeps valid favorites, queue references, repeat mode, and recording preferences", () => {
    const state = parseUserState(JSON.stringify({
      favorites: ["song:one", "song:one", "song:two"],
      favoriteAddedAt: { "song:one": "2026-09-01T12:00:00.000Z", "song:two": "invalid" },
      librarySongs: ["song:two"],
      librarySongAddedAt: { "song:two": "2026-09-03T12:00:00.000Z" },
      albums: ["album:one", "album:one"],
      albumAddedAt: { "album:one": "2026-09-02T12:00:00.000Z" },
      playlists: [
        { id: "playlist:one", name: "  Sunday  ", createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "invalid", songIds: ["song:one", "song:one"] },
        { id: "playlist:one", name: "Duplicate", createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", songIds: [] },
        { id: "", name: "Broken", songIds: [] },
      ],
      queue: [
        { songId: "eng::song:one", collectionId: "eng::hymns", recordingId: "vocal" },
        { songId: 3, collectionId: "broken", recordingId: "broken" },
      ],
      currentQueueIndex: 4,
      repeatMode: "all",
      preferredRecordingType: "AUDIO_VOCAL",
      songRecordingPreferences: { "song:one": "AUDIO_INSTRUMENTAL", broken: 4 },
    }), null, "2026-09-07T12:00:00.000Z");

    expect(state.favorites).toEqual(["eng::song:one", "eng::song:two"]);
    expect(state.favoriteAddedAt).toEqual({
      "eng::song:one": "2026-09-01T12:00:00.000Z",
      "eng::song:two": "2026-09-07T12:00:00.000Z",
    });
    expect(state.librarySongs).toEqual(["eng::song:two"]);
    expect(state.librarySongAddedAt).toEqual({ "eng::song:two": "2026-09-03T12:00:00.000Z" });
    expect(state.albums).toEqual(["eng::album:one"]);
    expect(state.albumAddedAt).toEqual({ "eng::album:one": "2026-09-02T12:00:00.000Z" });
    expect(state.playlists).toEqual([{
      id: "playlist:one",
      name: "Sunday",
      createdAt: "2026-09-01T12:00:00.000Z",
      updatedAt: "2026-09-01T12:00:00.000Z",
      songIds: ["eng::song:one"],
    }]);
    expect(state.queue).toEqual([
      { songId: "eng::song:one", collectionId: "eng::hymns", recordingId: "vocal" },
    ]);
    expect(state.repeatMode).toBe("all");
    expect(state.songRecordingPreferences).toEqual({ "eng::song:one": "AUDIO_INSTRUMENTAL" });
  });

  it("falls back safely and migrates legacy favorites", () => {
    expect(parseUserState(
      "{broken",
      JSON.stringify(["legacy:song"]),
      "2026-09-07T12:00:00.000Z",
    )).toMatchObject({
      favorites: ["eng::legacy:song"],
      favoriteAddedAt: { "eng::legacy:song": "2026-09-07T12:00:00.000Z" },
      librarySongs: ["eng::legacy:song"],
      librarySongAddedAt: { "eng::legacy:song": "2026-09-07T12:00:00.000Z" },
      albums: [],
      queue: [],
      currentQueueIndex: -1,
      repeatMode: "off",
    });
  });

  it("migrates combined saved songs into Library using their original favorite timestamps", () => {
    const state = parseUserState(JSON.stringify({
      favorites: ["existing:song"],
      favoriteAddedAt: { "existing:song": "2026-09-01T12:00:00.000Z" },
    }), null, "2026-09-07T12:00:00.000Z");

    expect(state.favorites).toEqual(["eng::existing:song"]);
    expect(state.librarySongs).toEqual(["eng::existing:song"]);
    expect(state.librarySongAddedAt).toEqual({ "eng::existing:song": "2026-09-01T12:00:00.000Z" });
  });

  it("preserves qualified language identities in libraries and mixed playlists", () => {
    const state = parseUserState(JSON.stringify({
      albums: ["eng::album", "spa::album"],
      librarySongs: ["eng::song", "spa::song"],
      playlists: [{
        id: "mixed", name: "Mixed", createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z", songIds: ["spa::song", "eng::song"],
      }],
    }));

    expect(state.albums).toEqual(["eng::album", "spa::album"]);
    expect(state.librarySongs).toEqual(["eng::song", "spa::song"]);
    expect(state.playlists[0].songIds).toEqual(["spa::song", "eng::song"]);
  });

});
