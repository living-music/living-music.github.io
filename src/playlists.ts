import type { Playlist } from "./storage";

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
