import { chooseRecording } from "./audio";
import type { CollectionSummary, Recording, Song } from "./types";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";
export type RepeatMode = "off" | "all" | "one";

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
  queue: PlayerTrack[];
  currentIndex: number;
  repeatMode: RepeatMode;
}

type Listener = (snapshot: PlayerSnapshot) => void;

export function trackForSong(
  song: Song,
  collection: CollectionSummary,
  preferredType?: string,
): PlayerTrack | undefined {
  const recording = chooseRecording(song, preferredType);
  return recording ? {
    song,
    recording,
    collectionId: collection.id,
    collectionTitle: collection.title,
    artworkUrl: recording.artworkUrl || song.artworkUrl || collection.artworkUrl,
  } : undefined;
}

export function collectionTracks(
  songs: Song[],
  collection: CollectionSummary,
  preferredType?: string,
): PlayerTrack[] {
  return songs.flatMap((song) => {
    const track = trackForSong(song, collection, preferredType);
    return track ? [track] : [];
  });
}

export class AudioEngine {
  private readonly media: HTMLAudioElement;
  private readonly listeners = new Set<Listener>();
  private tracks: PlayerTrack[] = [];
  private index = -1;
  private playRequest = 0;
  private repeatMode: RepeatMode = "off";
  private snapshot: PlayerSnapshot = {
    status: "idle",
    currentTime: 0,
    duration: 0,
    hasPrevious: false,
    hasNext: false,
    queue: [],
    currentIndex: -1,
    repeatMode: "off",
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

  playNext(song: Song, collection: CollectionSummary, preferredType?: string): void {
    const track = trackForSong(song, collection, preferredType);
    if (!track) return;
    if (this.index < 0) {
      this.tracks = [track];
      this.index = 0;
      this.loadCurrent(true);
      return;
    }
    this.tracks.splice(this.index + 1, 0, track);
    this.refreshQueue();
  }

  addToQueue(song: Song, collection: CollectionSummary, preferredType?: string): void {
    const track = trackForSong(song, collection, preferredType);
    if (!track) return;
    if (this.index < 0) {
      this.tracks = [track];
      this.index = 0;
      this.loadCurrent(false);
      return;
    }
    this.tracks.push(track);
    this.refreshQueue();
  }

  removeQueueItem(queueIndex: number): void {
    if (queueIndex <= this.index || queueIndex >= this.tracks.length) return;
    this.tracks.splice(queueIndex, 1);
    this.refreshQueue();
  }

  moveQueueItem(queueIndex: number, direction: -1 | 1): void {
    const target = queueIndex + direction;
    if (queueIndex <= this.index || target <= this.index || queueIndex >= this.tracks.length || target >= this.tracks.length) {
      return;
    }
    [this.tracks[queueIndex], this.tracks[target]] = [this.tracks[target], this.tracks[queueIndex]];
    this.refreshQueue();
  }

  clearUpNext(): void {
    if (this.index < 0) return;
    this.tracks.splice(this.index + 1);
    this.refreshQueue();
  }

  playQueueItem(queueIndex: number): void {
    if (queueIndex < 0 || queueIndex >= this.tracks.length) return;
    if (queueIndex === this.index) {
      this.toggle();
      return;
    }
    this.index = queueIndex;
    this.loadCurrent(true);
  }

  changeRecording(recordingId: string): void {
    const current = this.tracks[this.index];
    const recording = current?.song.recordings.find((entry) => entry.id === recordingId);
    if (!current || !recording || recording.id === current.recording.id) return;
    this.tracks[this.index] = {
      ...current,
      recording,
      artworkUrl: recording.artworkUrl || current.song.artworkUrl || current.artworkUrl,
    };
    this.loadCurrent(true);
  }

  cycleRepeat(): void {
    const modes: RepeatMode[] = ["off", "all", "one"];
    this.repeatMode = modes[(modes.indexOf(this.repeatMode) + 1) % modes.length];
    this.refreshQueue();
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
    if (this.index < 0) return;
    if (this.index < this.tracks.length - 1) {
      this.index += 1;
      this.loadCurrent(true);
    } else if (this.repeatMode === "all" && this.tracks.length) {
      this.index = 0;
      this.loadCurrent(true);
    }
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
      hasNext: this.index < this.tracks.length - 1 || (this.repeatMode === "all" && this.tracks.length > 1),
      queue: [...this.tracks],
      currentIndex: this.index,
      repeatMode: this.repeatMode,
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

  private refreshQueue(): void {
    this.setState({
      queue: [...this.tracks],
      currentIndex: this.index,
      hasPrevious: this.index > 0,
      hasNext: this.index < this.tracks.length - 1 || (this.repeatMode === "all" && this.tracks.length > 1),
      repeatMode: this.repeatMode,
    });
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
    if (this.repeatMode === "one") {
      this.seek(0);
      void this.requestPlay();
    } else if (this.index < this.tracks.length - 1) {
      this.index += 1;
      this.loadCurrent(true);
    } else if (this.repeatMode === "all" && this.tracks.length) {
      this.index = 0;
      this.loadCurrent(true);
    } else {
      this.setState({ status: "paused", currentTime: this.duration() });
    }
  };

  private handleError = () => {
    this.setState({ status: "error", error: "This recording is unavailable. Choose another song to continue." });
  };
}
