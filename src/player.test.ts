import { describe, expect, it, vi } from "vitest";
import { AudioEngine, collectionTracks } from "./player";
import type { CollectionSummary, Song } from "./types";

class FakeAudio extends EventTarget {
  src = "";
  currentTime = 0;
  duration = 200;
  paused = true;
  preload = "";
  load = vi.fn();
  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event("play"));
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
}

const collection: CollectionSummary = {
  id: "collection",
  slug: "collection",
  title: "Collection",
  sourceUrl: "https://example.test/collection",
  songCount: 3,
  playableSongCount: 2,
  revision: "revision",
  href: "collection.json",
};

const song = (id: string, recordings = [{
  id: `${id}:vocal`,
  type: "AUDIO_VOCAL",
  label: "Vocal",
  url: `https://example.test/${id}.mp3`,
  language: "eng",
}]): Song => ({
  id,
  slug: id,
  title: id,
  artists: [],
  authors: [],
  composers: [],
  arrangers: [],
  tags: [],
  recordings,
});

describe("collectionTracks", () => {
  it("excludes unavailable songs and chooses the vocal recording", () => {
    const tracks = collectionTracks([
      song("one", [
        { id: "a", type: "AUDIO_ACCOMPANIMENT", label: "Accompaniment", url: "https://example.test/a.mp3", language: "eng" },
        { id: "v", type: "AUDIO_VOCAL", label: "Vocal", url: "https://example.test/v.mp3", language: "eng" },
      ]),
      song("silent", []),
    ], collection);

    expect(tracks.map((track) => track.recording.id)).toEqual(["v"]);
  });
});

describe("AudioEngine", () => {
  it("loads a selected song and advances when it ends", async () => {
    const media = new FakeAudio();
    const engine = new AudioEngine(media as unknown as HTMLAudioElement);
    const songs = [song("one"), song("silent", []), song("two")];

    engine.playCollection(songs, collection, "one");
    await Promise.resolve();
    expect(engine.state.track?.song.id).toBe("one");
    expect(engine.state.status).toBe("playing");
    expect(engine.state.hasNext).toBe(true);

    media.dispatchEvent(new Event("ended"));
    await Promise.resolve();
    expect(engine.state.track?.song.id).toBe("two");
    expect(media.src).toBe("https://example.test/two.mp3");
  });

  it("seeks safely and restarts the current song from the previous control", () => {
    const media = new FakeAudio();
    const engine = new AudioEngine(media as unknown as HTMLAudioElement);
    engine.playCollection([song("one"), song("two")], collection, "two");

    engine.seek(400);
    expect(media.currentTime).toBe(200);
    media.currentTime = 12;
    engine.previous();
    expect(media.currentTime).toBe(0);
    expect(engine.state.track?.song.id).toBe("two");
  });

  it("surfaces rejected play requests", async () => {
    const media = new FakeAudio();
    media.play.mockRejectedValueOnce(new Error("blocked"));
    const engine = new AudioEngine(media as unknown as HTMLAudioElement);

    engine.playCollection([song("one")], collection, "one");
    await Promise.resolve();
    await Promise.resolve();

    expect(engine.state.status).toBe("error");
    expect(engine.state.error).toContain("could not be played");
  });
});
