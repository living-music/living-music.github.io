import type { SearchSong, Song } from "./types";

export function isPlayableSong(song: Song): boolean {
  return song.recordings.length > 0;
}

export function isPlayableSearchSong(song: SearchSong): boolean {
  return song.recordingTypes.length > 0;
}
