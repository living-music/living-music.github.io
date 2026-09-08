import type { Playlist } from "./storage";
import type { SearchSong } from "./types";

export function createPlaylist(name: string, id: string, timestamp: string): Playlist {
  return { id, name: name.trim(), createdAt: timestamp, updatedAt: timestamp, songIds: [] };
}

export function renamePlaylist(playlists: Playlist[], playlistId: string, name: string, timestamp: string): Playlist[] {
  const trimmed = name.trim();
  return playlists.map((playlist) => playlist.id === playlistId
    ? { ...playlist, name: trimmed, updatedAt: timestamp }
    : playlist);
}

export function deletePlaylist(playlists: Playlist[], playlistId: string): Playlist[] {
  return playlists.filter((playlist) => playlist.id !== playlistId);
}


export function addSongToPlaylist(
  playlists: Playlist[],
  playlistId: string,
  songId: string,
  timestamp: string,
): Playlist[] {
  return playlists.map((playlist) => playlist.id === playlistId && !playlist.songIds.includes(songId)
    ? { ...playlist, songIds: [...playlist.songIds, songId], updatedAt: timestamp }
    : playlist);
}


export function resolvePlaylistSongs(songs: SearchSong[], songIds: string[]): SearchSong[] {
  const byId = new Map(songs.map((song) => [song.id, song]));
  return songIds.flatMap((songId) => {
    const song = byId.get(songId);
    return song ? [song] : [];
  });
}

export function randomizePlaylistSongs<T>(songs: T[], random: () => number = Math.random): T[] {
  const randomized = [...songs];
  for (let index = randomized.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [randomized[index], randomized[target]] = [randomized[target], randomized[index]];
  }
  return randomized;
}
