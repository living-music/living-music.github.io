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
  "seekto",
];

const disabledSeekActions: MediaAction[] = ["seekbackward", "seekforward"];

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
  private metadataKey: string | undefined;
  private playbackActive = false;

  constructor(
    private readonly engine: AudioEngine,
    private readonly session = browserSession(),
    private readonly makeMetadata = browserMetadataFactory(),
  ) {
    if (!session) return;

    this.installActionHandlers();
  }

  private installActionHandlers(): void {
    if (!this.session) return;
    const handlers: Record<MediaAction, (details: MediaActionDetails) => void> = {
      play: () => this.engine.play(),
      pause: () => this.engine.pause(),
      previoustrack: () => this.engine.previous(),
      nexttrack: () => this.engine.next(),
      seekbackward: () => undefined,
      seekforward: () => undefined,
      seekto: (details) => {
        if (typeof details.seekTime === "number") this.engine.seek(details.seekTime);
      },
    };

    // WebKit can install its default ten-second seek controls when an audio
    // session becomes active. Clear those commands before advertising the
    // music-style previous/next controls.
    for (const action of disabledSeekActions) {
      try {
        this.session.setActionHandler(action, null);
      } catch {
        // Browsers may expose Media Session while omitting individual actions.
      }
    }
    for (const action of actions) {
      try {
        this.session.setActionHandler(action, handlers[action]);
      } catch {
        // Browsers may expose Media Session while omitting individual actions.
      }
    }
  }

  update(snapshot: PlayerSnapshot): void {
    if (!this.session) return;

    const track = snapshot.track;
    const nextKey = track ? `${track.song.id}:${track.recording.id}` : "";
    const playbackActive = snapshot.status === "playing";
    if (nextKey !== this.metadataKey || (playbackActive && !this.playbackActive)) {
      // iOS may discard handlers registered before the underlying audio
      // element starts playing or when its source changes.
      this.installActionHandlers();
    }
    this.playbackActive = playbackActive;
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
      this.session.playbackState = snapshot.status === "playing" || snapshot.status === "loading"
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

  refresh(): void {
    this.installActionHandlers();
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
    for (const action of disabledSeekActions) {
      try {
        this.session.setActionHandler(action, null);
      } catch {
        // Match the defensive setup path for partially supported browsers.
      }
    }
  }
}
