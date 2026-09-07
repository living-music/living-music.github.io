import type { AudioEngine, PlayerSnapshot, PlayerTrack } from "./player";

type MediaAction =
  | "play"
  | "pause"
  | "previoustrack"
  | "nexttrack"
  | "seekbackward"
  | "seekforward"
  | "seekto";

interface MediaActionDetails {
  seekOffset?: number;
  seekTime?: number;
}

interface MediaSessionPort {
  metadata: unknown;
  playbackState: "none" | "paused" | "playing";
  setActionHandler(action: MediaAction, handler: ((details: MediaActionDetails) => void) | null): void;
  setPositionState?(state?: { duration: number; playbackRate: number; position: number }): void;
}

interface MetadataInit {
  title: string;
  artist: string;
  album: string;
  artwork?: { src: string }[];
}

type MetadataFactory = (metadata: MetadataInit) => unknown;

const actions: MediaAction[] = [
  "play",
  "pause",
  "previoustrack",
  "nexttrack",
  "seekbackward",
  "seekforward",
  "seekto",
];

export function mediaArtist(track: PlayerTrack): string {
  return track.song.artists[0]
    || track.song.composers[0]
    || track.song.authors[0]
    || track.recording.label;
}

function browserSession(): MediaSessionPort | undefined {
  return typeof navigator !== "undefined" && "mediaSession" in navigator
    ? navigator.mediaSession as unknown as MediaSessionPort
    : undefined;
}

function browserMetadataFactory(): MetadataFactory | undefined {
  return typeof MediaMetadata === "function"
    ? (metadata) => new MediaMetadata(metadata)
    : undefined;
}

/** Keeps lock-screen, Control Center, and hardware media controls in sync with the shared audio engine. */
export class MediaSessionController {
  private snapshot: PlayerSnapshot;
  private metadataKey: string | undefined;

  constructor(
    private readonly engine: AudioEngine,
    private readonly session = browserSession(),
    private readonly makeMetadata = browserMetadataFactory(),
  ) {
    this.snapshot = engine.state;
    if (!session) return;

    const handlers: Record<MediaAction, (details: MediaActionDetails) => void> = {
      play: () => {
        if (this.snapshot.track && this.snapshot.status !== "playing" && this.snapshot.status !== "loading") {
          this.engine.toggle();
        }
      },
      pause: () => {
        if (this.snapshot.status === "playing" || this.snapshot.status === "loading") this.engine.toggle();
      },
      previoustrack: () => this.engine.previous(),
      nexttrack: () => this.engine.next(),
      seekbackward: (details) => this.engine.seek(this.snapshot.currentTime - (details.seekOffset || 10)),
      seekforward: (details) => this.engine.seek(this.snapshot.currentTime + (details.seekOffset || 10)),
      seekto: (details) => {
        if (typeof details.seekTime === "number") this.engine.seek(details.seekTime);
      },
    };

    for (const action of actions) {
      try {
        session.setActionHandler(action, handlers[action]);
      } catch {
        // Browsers may expose Media Session while omitting individual actions.
      }
    }
  }

  update(snapshot: PlayerSnapshot): void {
    this.snapshot = snapshot;
    if (!this.session) return;

    const track = snapshot.track;
    const nextKey = track ? `${track.song.id}:${track.recording.id}` : "";
    if (nextKey !== this.metadataKey) {
      this.metadataKey = nextKey;
      try {
        this.session.metadata = track && this.makeMetadata
          ? this.makeMetadata({
              title: track.song.title,
              artist: mediaArtist(track),
              album: track.collectionTitle,
              artwork: track.artworkUrl ? [{ src: track.artworkUrl }] : undefined,
            })
          : null;
      } catch {
        // Metadata is an enhancement; playback remains available if a browser rejects it.
      }
    }

    try {
      this.session.playbackState = snapshot.status === "playing"
        ? "playing"
        : track ? "paused" : "none";
    } catch {
      // Some WebKit versions expose this property as read-only.
    }

    if (this.session.setPositionState && Number.isFinite(snapshot.duration) && snapshot.duration > 0) {
      try {
        this.session.setPositionState({
          duration: snapshot.duration,
          playbackRate: 1,
          position: Math.max(0, Math.min(snapshot.currentTime, snapshot.duration)),
        });
      } catch {
        // Ignore transient position errors while media metadata is changing.
      }
    }
  }

  destroy(): void {
    if (!this.session) return;
    for (const action of actions) {
      try {
        this.session.setActionHandler(action, null);
      } catch {
        // Match the defensive setup path for partially supported browsers.
      }
    }
  }
}
