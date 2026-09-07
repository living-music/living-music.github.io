import type { RepeatMode } from "./player";

const USER_STATE_KEY = "livingMusic:userState:v1";
const LEGACY_FAVORITES_KEY = "livingMusic:favorites:v1";
const THEME_KEY = "livingMusic:theme";

export type Theme = "dark" | "light" | "system";

export interface QueueReference {
  songId: string;
  collectionId: string;
  recordingId: string;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  songIds: string[];
}

export interface UserState {
  favorites: string[];
  favoriteAddedAt: Record<string, string>;
  librarySongs: string[];
  librarySongAddedAt: Record<string, string>;
  albums: string[];
  albumAddedAt: Record<string, string>;
  playlists: Playlist[];
  queue: QueueReference[];
  currentQueueIndex: number;
  repeatMode: RepeatMode;
  preferredRecordingType?: string;
  songRecordingPreferences: Record<string, string>;
}

export const EMPTY_USER_STATE: UserState = {
  favorites: [],
  favoriteAddedAt: {},
  librarySongs: [],
  librarySongAddedAt: {},
  albums: [],
  albumAddedAt: {},
  playlists: [],
  queue: [],
  currentQueueIndex: -1,
  repeatMode: "off",
  songRecordingPreferences: {},
};

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function queueReferences(value: unknown): QueueReference[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is QueueReference =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as QueueReference).songId === "string" &&
      typeof (entry as QueueReference).collectionId === "string" &&
      typeof (entry as QueueReference).recordingId === "string")
    : [];
}

function playlists(value: unknown): Playlist[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!id || !name || seen.has(id)) return [];
    const createdAt = typeof candidate.createdAt === "string" && Number.isFinite(Date.parse(candidate.createdAt))
      ? candidate.createdAt
      : new Date(0).toISOString();
    const updatedAt = typeof candidate.updatedAt === "string" && Number.isFinite(Date.parse(candidate.updatedAt))
      ? candidate.updatedAt
      : createdAt;
    const songIds = stringArray(candidate.songIds) ? [...new Set(candidate.songIds)] : [];
    seen.add(id);
    return [{ id, name, createdAt, updatedAt, songIds }];
  });
}

function recordingPreferences(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key, entry]) => key && typeof entry === "string"),
  );
}

function addedAtValues(value: unknown, ids: string[], fallback: string): Record<string, string> {
  const source = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(ids.map((id) => {
    const timestamp = source[id];
    return [id, typeof timestamp === "string" && Number.isFinite(Date.parse(timestamp)) ? timestamp : fallback];
  }));
}

export function parseUserState(
  raw: string | null,
  legacyFavorites: string | null = null,
  migrationTime = new Date().toISOString(),
): UserState {
  let legacy: string[] = [];
  try {
    const value: unknown = JSON.parse(legacyFavorites || "[]");
    if (stringArray(value)) legacy = value;
  } catch {}

  try {
    const value: unknown = JSON.parse(raw || "{}");
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {
        ...EMPTY_USER_STATE,
        favorites: legacy,
        favoriteAddedAt: addedAtValues({}, legacy, migrationTime),
        librarySongs: legacy,
        librarySongAddedAt: addedAtValues({}, legacy, migrationTime),
      };
    }
    const data = value as Record<string, unknown>;
    const repeatMode = data.repeatMode === "all" || data.repeatMode === "one" ? data.repeatMode : "off";
    const favorites = stringArray(data.favorites) ? [...new Set(data.favorites)] : legacy;
    const favoriteAddedAt = addedAtValues(data.favoriteAddedAt, favorites, migrationTime);
    const librarySongs = stringArray(data.librarySongs) ? [...new Set(data.librarySongs)] : favorites;
    const librarySongAddedAtSource = data.librarySongAddedAt === undefined
      ? favoriteAddedAt
      : data.librarySongAddedAt;
    const albums = stringArray(data.albums) ? [...new Set(data.albums)] : [];
    return {
      favorites,
      favoriteAddedAt,
      librarySongs,
      librarySongAddedAt: addedAtValues(
        librarySongAddedAtSource,
        librarySongs,
        migrationTime,
      ),
      albums,
      albumAddedAt: addedAtValues(data.albumAddedAt, albums, migrationTime),
      playlists: playlists(data.playlists),
      queue: queueReferences(data.queue),
      currentQueueIndex: typeof data.currentQueueIndex === "number" && Number.isInteger(data.currentQueueIndex)
        ? data.currentQueueIndex
        : -1,
      repeatMode,
      preferredRecordingType: typeof data.preferredRecordingType === "string"
        ? data.preferredRecordingType
        : undefined,
      songRecordingPreferences: recordingPreferences(data.songRecordingPreferences),
    };
  } catch {
    return {
      ...EMPTY_USER_STATE,
      favorites: legacy,
      favoriteAddedAt: addedAtValues({}, legacy, migrationTime),
      librarySongs: legacy,
      librarySongAddedAt: addedAtValues({}, legacy, migrationTime),
    };
  }
}

export function readUserState(): UserState {
  try {
    return parseUserState(localStorage.getItem(USER_STATE_KEY), localStorage.getItem(LEGACY_FAVORITES_KEY));
  } catch {
    return { ...EMPTY_USER_STATE };
  }
}

export function writeUserState(state: UserState): boolean {
  try {
    localStorage.setItem(USER_STATE_KEY, JSON.stringify(state));
    localStorage.removeItem(LEGACY_FAVORITES_KEY);
    return true;
  } catch {
    return false;
  }
}

export function readTheme(): Theme {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    return theme === "light" || theme === "system" || theme === "dark" ? theme : "dark";
  } catch {
    return "dark";
  }
}

export function writeTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}
