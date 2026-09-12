import {
  EMPTY_USER_STATE,
  parseUserState,
  readUserState,
  removeLegacyUserState,
  writeUserState,
  type UserState,
} from "./storage";

const DATABASE_NAME = "livingMusic";
const DATABASE_VERSION = 1;
const STATE_STORE = "listenerData";
const STATE_KEY = "userState:v2";
const DOWNLOAD_STORE = "downloads";
const BACKUP_FORMAT = "living-music-user-data";
const BACKUP_VERSION = 1;

export type PersistenceMode = "indexeddb" | "localstorage";

export interface PersistenceLoadResult {
  state: UserState;
  mode: PersistenceMode;
  warning?: string;
}

export interface StorageSnapshot {
  usage?: number;
  quota?: number;
  persisted?: boolean;
}

interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  userState: UserState;
}

let mode: PersistenceMode = "indexeddb";
let databasePromise: Promise<IDBDatabase> | undefined;
let writeQueue = Promise.resolve();

function cloneEmptyState(): UserState {
  return {
    ...EMPTY_USER_STATE,
    favorites: [], favoriteAddedAt: {}, librarySongs: [], librarySongAddedAt: {},
    albums: [], albumAddedAt: {}, playlists: [], queue: [], songRecordingPreferences: {},
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB is unavailable."));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STATE_STORE)) request.result.createObjectStore(STATE_STORE);
      if (!request.result.objectStoreNames.contains(DOWNLOAD_STORE)) request.result.createObjectStore(DOWNLOAD_STORE, { keyPath: "recordingId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local storage."));
    request.onblocked = () => reject(new Error("Local storage upgrade was blocked by another tab."));
  });
  return databasePromise;
}

async function readIndexedState(): Promise<UserState | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STATE_STORE, "readonly").objectStore(STATE_STORE).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result === undefined ? undefined : parseUserState(JSON.stringify(request.result)));
    request.onerror = () => reject(request.error || new Error("Could not read local data."));
  });
}

async function writeIndexedState(state: UserState): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STATE_STORE, "readwrite");
    transaction.objectStore(STATE_STORE).put(state, STATE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not save local data."));
    transaction.onabort = () => reject(transaction.error || new Error("Saving local data was interrupted."));
  });
}

export async function loadUserState(): Promise<PersistenceLoadResult> {
  const legacy = readUserState();
  try {
    const existing = await readIndexedState();
    if (existing) {
      mode = "indexeddb";
      return { state: existing, mode };
    }
    await writeIndexedState(legacy);
    const verified = await readIndexedState();
    if (!verified || JSON.stringify(verified) !== JSON.stringify(legacy)) throw new Error("Local data migration could not be verified.");
    removeLegacyUserState();
    mode = "indexeddb";
    return { state: verified, mode };
  } catch (error) {
    mode = "localstorage";
    return {
      state: legacy,
      mode,
      warning: error instanceof Error ? error.message : "IndexedDB is unavailable.",
    };
  }
}

export function saveUserState(state: UserState): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    if (mode === "localstorage") {
      if (!writeUserState(state)) throw new Error("Your changes could not be saved on this device.");
    } else {
      await writeIndexedState(state);
    }
  });
  return writeQueue;
}

export async function clearUserState(): Promise<void> {
  await writeQueue.catch(() => undefined);
  if (mode === "localstorage") return removeLegacyUserState();
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STATE_STORE, "readwrite");
    transaction.objectStore(STATE_STORE).delete(STATE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not clear local data."));
  });
}

export function emptyUserState(): UserState { return cloneEmptyState(); }

export function exportUserState(state: UserState, exportedAt = new Date().toISOString()): string {
  const backup: BackupEnvelope = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, userState: state };
  return JSON.stringify(backup, null, 2);
}

export function importUserState(raw: string): UserState {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("That file is not valid JSON."); }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("That file is not a Living Music backup.");
  const backup = value as Partial<BackupEnvelope>;
  if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !backup.userState) throw new Error("That backup format is not supported.");
  return parseUserState(JSON.stringify(backup.userState));
}

export async function getStorageSnapshot(): Promise<StorageSnapshot> {
  if (!("storage" in navigator)) return {};
  const [estimate, persisted]: [StorageEstimate, boolean] = await Promise.all([
    navigator.storage.estimate?.().catch(() => ({} as StorageEstimate)) || Promise.resolve({} as StorageEstimate),
    navigator.storage.persisted?.().catch(() => false) || Promise.resolve(false),
  ]);
  return { usage: estimate.usage, quota: estimate.quota, persisted };
}

export async function requestPersistentStorage(): Promise<boolean | undefined> {
  if (!navigator.storage?.persist) return undefined;
  return navigator.storage.persist();
}
