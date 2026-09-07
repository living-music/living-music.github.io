import { describe, expect, it } from "vitest";
import { parseUserState } from "./storage";

describe("parseUserState", () => {
  it("keeps valid favorites, queue references, repeat mode, and recording preferences", () => {
    const state = parseUserState(JSON.stringify({
      favorites: ["song:one", "song:one", "song:two"],
      queue: [
        { songId: "song:one", collectionId: "hymns", recordingId: "vocal" },
        { songId: 3, collectionId: "broken", recordingId: "broken" },
      ],
      currentQueueIndex: 4,
      repeatMode: "all",
      preferredRecordingType: "AUDIO_VOCAL",
      songRecordingPreferences: { "song:one": "AUDIO_INSTRUMENTAL", broken: 4 },
    }));

    expect(state.favorites).toEqual(["song:one", "song:two"]);
    expect(state.queue).toEqual([
      { songId: "song:one", collectionId: "hymns", recordingId: "vocal" },
    ]);
    expect(state.repeatMode).toBe("all");
    expect(state.songRecordingPreferences).toEqual({ "song:one": "AUDIO_INSTRUMENTAL" });
  });

  it("falls back safely and migrates legacy favorites", () => {
    expect(parseUserState("{broken", JSON.stringify(["legacy:song"]))).toMatchObject({
      favorites: ["legacy:song"],
      queue: [],
      currentQueueIndex: -1,
      repeatMode: "off",
    });
  });
});
