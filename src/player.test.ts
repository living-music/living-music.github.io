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

  it("plays supplied tracks in order and advances from the selected track", async () => {
    const media = new FakeAudio();
    const engine = new AudioEngine(media as unknown as HTMLAudioElement);
    const tracks = collectionTracks([song("three"), song("one"), song("two")], collection);

    engine.playTracks(tracks, "one", false);
    await Promise.resolve();
    expect(engine.state.queue.map((track) => track.song.id)).toEqual(["three", "one", "two"]);

    media.dispatchEvent(new Event("ended"));
    await Promise.resolve();
    expect(engine.state.track?.song.id).toBe("two");
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


describe("queue editing", () => {
  it("inserts, appends, reorders, removes, and clears upcoming songs", () => {
    const media = new FakeAudio();
    const engine = new AudioEngine(media as unknown as HTMLAudioElement);
    engine.playCollection([song("one"), song("two")], collection, "one");

    engine.playNext(song("next"), collection);
    engine.addToQueue(song("end"), collection);
    expect(engine.state.queue.map((track) => track.song.id)).toEqual(["one", "next", "two", "end"]);

    engine.moveQueueItem(3, -1);
    expect(engine.state.queue.map((track) => track.song.id)).toEqual(["one", "next", "end", "two"]);

    engine.removeQueueItem(1);
    expect(engine.state.queue.map((track) => track.song.id)).toEqual(["one", "end", "two"]);

    engine.clearUpNext();
    expect(engine.state.queue.map((track) => track.song.id)).toEqual(["one"]);
    expect(engine.state.hasNext).toBe(false);
  });

  it("switches the current recording and keeps the song in place", () => {
    const media = new FakeAudio();
    const engine = new AudioEngine(media as unknown as HTMLAudioElement);
    const versions = song("one", [
      { id: "vocal", type: "AUDIO_VOCAL", label: "Vocal", url: "https://example.test/vocal.mp3", language: "eng" },
      { id: "piano", type: "AUDIO_INSTRUMENTAL", label: "Piano", url: "https://example.test/piano.mp3", language: "eng" },
    ]);
    engine.playCollection([versions], collection, "one");

    engine.changeRecording("piano");

    expect(engine.state.track?.song.id).toBe("one");
    expect(engine.state.track?.recording.id).toBe("piano");
    expect(media.src).toBe("https://example.test/piano.mp3");
  });

  it("repeats the current song when repeat one is selected", async () => {
    const media = new FakeAudio();
    const engine = new AudioEngine(media as unknown as HTMLAudioElement);
    engine.playCollection([song("one")], collection, "one");
    engine.cycleRepeat();
    engine.cycleRepeat();

    media.currentTime = 200;
    media.dispatchEvent(new Event("ended"));
    await Promise.resolve();

    expect(engine.state.repeatMode).toBe("one");
    expect(media.currentTime).toBe(0);
    expect(engine.state.track?.song.id).toBe("one");
  });
});


it("wraps to the first queued song in repeat-all mode", async () => {
  const media = new FakeAudio();
  const engine = new AudioEngine(media as unknown as HTMLAudioElement);
  engine.playCollection([song("one"), song("two")], collection, "two");
  engine.cycleRepeat();

  expect(engine.state.repeatMode).toBe("all");
  expect(engine.state.hasNext).toBe(true);
  media.dispatchEvent(new Event("ended"));
  await Promise.resolve();

  expect(engine.state.track?.song.id).toBe("one");
});


it("restores a saved queue paused without requesting autoplay", () => {
  const media = new FakeAudio();
  const engine = new AudioEngine(media as unknown as HTMLAudioElement);
  const tracks = collectionTracks([song("one"), song("two")], collection);

  engine.restoreQueue(tracks, 1, "all");

  expect(engine.state.status).toBe("paused");
  expect(engine.state.track?.song.id).toBe("two");
  expect(engine.state.repeatMode).toBe("all");
  expect(media.play).not.toHaveBeenCalled();
});
