import { describe, expect, it } from "vitest";
import { parseUserState } from "./storage";

describe("parseUserState", () => {
  it("keeps valid favorites, queue references, repeat mode, and recording preferences", () => {
    const state = parseUserState(JSON.stringify({
      favorites: ["song:one", "song:one", "song:two"],
      favoriteAddedAt: { "song:one": "2026-09-01T12:00:00.000Z", "song:two": "invalid" },
      albums: ["album:one", "album:one"],
      albumAddedAt: { "album:one": "2026-09-02T12:00:00.000Z" },
      queue: [
        { songId: "song:one", collectionId: "hymns", recordingId: "vocal" },
        { songId: 3, collectionId: "broken", recordingId: "broken" },
      ],
      currentQueueIndex: 4,
      repeatMode: "all",
      preferredRecordingType: "AUDIO_VOCAL",
      songRecordingPreferences: { "song:one": "AUDIO_INSTRUMENTAL", broken: 4 },
    }), null, "2026-09-07T12:00:00.000Z");

    expect(state.favorites).toEqual(["song:one", "song:two"]);
    expect(state.favoriteAddedAt).toEqual({
      "song:one": "2026-09-01T12:00:00.000Z",
      "song:two": "2026-09-07T12:00:00.000Z",
    });
    expect(state.albums).toEqual(["album:one"]);
    expect(state.albumAddedAt).toEqual({ "album:one": "2026-09-02T12:00:00.000Z" });
    expect(state.queue).toEqual([
      { songId: "song:one", collectionId: "hymns", recordingId: "vocal" },
    ]);
    expect(state.repeatMode).toBe("all");
    expect(state.songRecordingPreferences).toEqual({ "song:one": "AUDIO_INSTRUMENTAL" });
  });

  it("falls back safely and migrates legacy favorites", () => {
    expect(parseUserState(
      "{broken",
      JSON.stringify(["legacy:song"]),
      "2026-09-07T12:00:00.000Z",
    )).toMatchObject({
      favorites: ["legacy:song"],
      favoriteAddedAt: { "legacy:song": "2026-09-07T12:00:00.000Z" },
      albums: [],
      queue: [],
      currentQueueIndex: -1,
      repeatMode: "off",
    });
  });
});
