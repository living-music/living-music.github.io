import { describe, expect, it, vi } from "vitest";
import { MediaSessionController, mediaArtist } from "./media-session";
import type { AudioEngine, PlayerSnapshot, PlayerTrack } from "./player";

const track: PlayerTrack = {
  song: {
    id: "song",
    slug: "song",
    title: "A Song",
    artists: ["A Singer"],
    authors: [],
    composers: [],
    arrangers: [],
    tags: [],
    recordings: [],
  },
  recording: {
    id: "vocal",
    type: "AUDIO_VOCAL",
    label: "Vocal",
    url: "https://example.test/song.mp3",
    language: "eng",
  },
  collectionId: "collection",
  collectionTitle: "A Collection",
  artworkUrl: "https://example.test/art.jpg",
};

const snapshot = (overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({
  status: "paused",
  track,
  currentTime: 12,
  duration: 100,
  hasPrevious: true,
  hasNext: true,
  queue: [track],
  currentIndex: 0,
  repeatMode: "off",
  ...overrides,
});

type Handler = ((details: { seekTime?: number; seekOffset?: number }) => void) | null;

describe("MediaSessionController", () => {
  it("publishes track metadata, playback state, and a safe position", () => {
    const handlers = new Map<string, Handler>();
    const session = {
      metadata: null as unknown,
      playbackState: "none" as "none" | "paused" | "playing",
      setActionHandler: vi.fn((action: string, handler: Handler) => handlers.set(action, handler)),
      setPositionState: vi.fn(),
    };
    const engine = {
      state: snapshot(),
      toggle: vi.fn(),
      previous: vi.fn(),
      next: vi.fn(),
      seek: vi.fn(),
    } as unknown as AudioEngine;
    const controller = new MediaSessionController(engine, session, (value) => value);

    controller.update(snapshot({ status: "playing", currentTime: 120 }));

    expect(session.metadata).toEqual({
      title: "A Song",
      artist: "A Singer",
      album: "A Collection",
      artwork: [{ src: "https://example.test/art.jpg" }],
    });
    expect(session.playbackState).toBe("playing");
    expect(session.setPositionState).toHaveBeenCalledWith({ duration: 100, playbackRate: 1, position: 100 });

    handlers.get("seekto")?.({ seekTime: 42 });
    expect(engine.seek).toHaveBeenCalledWith(42);
  });

  it("maps hardware controls to the audio engine and removes them on cleanup", () => {
    const handlers = new Map<string, Handler>();
    const session = {
      metadata: null as unknown,
      playbackState: "none" as "none" | "paused" | "playing",
      setActionHandler: vi.fn((action: string, handler: Handler) => handlers.set(action, handler)),
    };
    const engine = {
      state: snapshot(),
      toggle: vi.fn(),
      previous: vi.fn(),
      next: vi.fn(),
      seek: vi.fn(),
    } as unknown as AudioEngine;
    const controller = new MediaSessionController(engine, session, (value) => value);
    controller.update(snapshot());

    handlers.get("play")?.({});
    handlers.get("nexttrack")?.({});
    handlers.get("seekforward")?.({ seekOffset: 15 });

    expect(engine.toggle).toHaveBeenCalledOnce();
    expect(engine.next).toHaveBeenCalledOnce();
    expect(engine.seek).toHaveBeenCalledWith(27);

    controller.destroy();
    expect([...handlers.values()].every((handler) => handler === null)).toBe(true);
  });
});

it("uses composer, author, then recording label when an artist is absent", () => {
  expect(mediaArtist({ ...track, song: { ...track.song, artists: [], composers: ["Composer"] } })).toBe("Composer");
  expect(mediaArtist({ ...track, song: { ...track.song, artists: [], composers: [], authors: ["Author"] } })).toBe("Author");
  expect(mediaArtist({ ...track, song: { ...track.song, artists: [], composers: [], authors: [] } })).toBe("Vocal");
});
