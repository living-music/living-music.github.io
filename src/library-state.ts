import type { UserState } from "./storage";

export function toggleFavoriteInState(state: UserState, songId: string, timestamp: string): UserState {
  const favorites = new Set(state.favorites);
  const favoriteAddedAt = { ...state.favoriteAddedAt };

  if (favorites.has(songId)) {
    favorites.delete(songId);
    delete favoriteAddedAt[songId];
    return { ...state, favorites: [...favorites], favoriteAddedAt };
  }

  favorites.add(songId);
  favoriteAddedAt[songId] = timestamp;

  const librarySongs = new Set(state.librarySongs);
  const librarySongAddedAt = { ...state.librarySongAddedAt };
  if (!librarySongs.has(songId)) {
    librarySongs.add(songId);
    librarySongAddedAt[songId] = timestamp;
  }

  return {
    ...state,
    favorites: [...favorites],
    favoriteAddedAt,
    librarySongs: [...librarySongs],
    librarySongAddedAt,
  };
}
