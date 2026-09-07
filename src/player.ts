import { chooseRecording } from "./audio";
import type { CollectionSummary, Recording, Song } from "./types";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlayerTrack {
  song: Song;
  recording: Recording;
  collectionId: string;
  collectionTitle: string;
  artworkUrl?: string | null;
}

export interface PlayerSnapshot {
  status: PlayerStatus;
  track?: PlayerTrack;
  currentTime: number;
  duration: number;
  error?: string;
  hasPrevious: boolean;
  hasNext: boolean;
}

type Listener = (snapshot: PlayerSnapshot) => void;

export function collectionTracks(
  songs: Song[],
  collection: CollectionSummary,
  preferredType?: string,
): PlayerTrack[] {
  return songs.flatMap((song) => {
    const recording = chooseRecording(song, preferredType);
    return recording ? [{
      song,
      recording,
      collectionId: collection.id,
      collectionTitle: collection.title,
      artworkUrl: recording.artworkUrl || song.artworkUrl || collection.artworkUrl,
    }] : [];
  });
}

export class AudioEngine {
  private readonly media: HTMLAudioElement;
  private readonly listeners = new Set<Listener>();
  private tracks: PlayerTrack[] = [];
  private index = -1;
  private playRequest = 0;
  private snapshot: PlayerSnapshot = {
    status: "idle",
    currentTime: 0,
    duration: 0,
    hasPrevious: false,
    hasNext: false,
  };

  constructor(media: HTMLAudioElement = new Audio()) {
    this.media = media;
    this.media.preload = "metadata";
    this.media.addEventListener("play", this.handlePlay);
    this.media.addEventListener("pause", this.handlePause);
    this.media.addEventListener("waiting", this.handleWaiting);
    this.media.addEventListener("canplay", this.handleCanPlay);
    this.media.addEventListener("loadedmetadata", this.handleDuration);
    this.media.addEventListener("durationchange", this.handleDuration);
    this.media.addEventListener("timeupdate", this.handleTime);
    this.media.addEventListener("ended", this.handleEnded);
    this.media.addEventListener("error", this.handleError);
  }

  get state(): PlayerSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  playCollection(
    songs: Song[],
    collection: CollectionSummary,
    songId: string,
    preferredType?: string,
  ): void {
    const tracks = collectionTracks(songs, collection, preferredType);
    const nextIndex = tracks.findIndex((track) => track.song.id === songId);
    if (nextIndex < 0) {
      this.setState({ status: "error", error: "No playable recording is available for this song." });
      return;
    }

    if (this.snapshot.track?.song.id === songId && this.snapshot.track.collectionId === collection.id) {
      this.toggle();
      return;
    }

    this.tracks = tracks;
    this.index = nextIndex;
    this.loadCurrent(true);
  }

  toggle(): void {
    if (!this.snapshot.track) return;
    if (this.snapshot.status === "playing" || this.snapshot.status === "loading") {
      this.playRequest += 1;
      this.media.pause();
      this.setState({ status: "paused" });
    } else {
      void this.requestPlay();
    }
  }

  next(): void {
    if (this.index < 0 || this.index >= this.tracks.length - 1) return;
    this.index += 1;
    this.loadCurrent(true);
  }

  previous(): void {
    if (!this.snapshot.track) return;
    if (this.media.currentTime > 3 || this.index <= 0) {
      this.seek(0);
      return;
    }
    this.index -= 1;
    this.loadCurrent(true);
  }

  seek(seconds: number): void {
    if (!this.snapshot.track || !Number.isFinite(seconds)) return;
    const duration = this.duration();
    const nextTime = Math.max(0, duration ? Math.min(seconds, duration) : seconds);
    this.media.currentTime = nextTime;
    this.setState({ currentTime: nextTime });
  }

  destroy(): void {
    this.playRequest += 1;
    this.media.pause();
    this.media.removeEventListener("play", this.handlePlay);
    this.media.removeEventListener("pause", this.handlePause);
    this.media.removeEventListener("waiting", this.handleWaiting);
    this.media.removeEventListener("canplay", this.handleCanPlay);
    this.media.removeEventListener("loadedmetadata", this.handleDuration);
    this.media.removeEventListener("durationchange", this.handleDuration);
    this.media.removeEventListener("timeupdate", this.handleTime);
    this.media.removeEventListener("ended", this.handleEnded);
    this.media.removeEventListener("error", this.handleError);
    this.listeners.clear();
  }

  private loadCurrent(autoplay: boolean): void {
    const track = this.tracks[this.index];
    if (!track) return;
    this.playRequest += 1;
    this.media.src = track.recording.url;
    this.media.currentTime = 0;
    this.media.load();
    this.snapshot = {
      status: autoplay ? "loading" : "paused",
      track,
      currentTime: 0,
      duration: track.recording.durationMs ? track.recording.durationMs / 1000 : 0,
      hasPrevious: this.index > 0,
      hasNext: this.index < this.tracks.length - 1,
    };
    this.emit();
    if (autoplay) void this.requestPlay();
  }

  private async requestPlay(): Promise<void> {
    const request = ++this.playRequest;
    this.setState({ status: "loading", error: undefined });
    try {
      await this.media.play();
      if (request === this.playRequest && !this.media.paused) this.setState({ status: "playing" });
    } catch {
      if (request === this.playRequest) {
        this.setState({ status: "error", error: "This recording could not be played. Try another song." });
      }
    }
  }

  private duration(): number {
    return Number.isFinite(this.media.duration) && this.media.duration > 0
      ? this.media.duration
      : this.snapshot.duration;
  }

  private setState(update: Partial<PlayerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...update };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.snapshot);
  }

  private handlePlay = () => this.setState({ status: "playing", error: undefined });

  private handlePause = () => {
    if (this.snapshot.status !== "idle" && this.snapshot.status !== "error") {
      this.setState({ status: "paused" });
    }
  };

  private handleWaiting = () => {
    if (this.snapshot.status === "playing") this.setState({ status: "loading" });
  };

  private handleCanPlay = () => {
    if (this.snapshot.status === "loading" && this.media.paused) this.setState({ status: "paused" });
  };

  private handleDuration = () => this.setState({ duration: this.duration() });

  private handleTime = () => this.setState({
    currentTime: Number.isFinite(this.media.currentTime) ? this.media.currentTime : 0,
    duration: this.duration(),
  });

  private handleEnded = () => {
    if (this.index < this.tracks.length - 1) {
      this.index += 1;
      this.loadCurrent(true);
    } else {
      this.setState({ status: "paused", currentTime: this.duration() });
    }
  };

  private handleError = () => {
    this.setState({ status: "error", error: "This recording is unavailable. Choose another song to continue." });
  };
}
