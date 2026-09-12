import { chooseRecording } from "./audio";
import type { CollectionSummary, Recording, Song } from "./types";

const DATABASE_NAME = "livingMusic";
const DATABASE_VERSION = 1;
const DOWNLOAD_STORE = "downloads";
const DOWNLOAD_CACHE = "living-music-downloads-v1";
const ARTWORK_CACHE = "living-music-artwork-v1";
const MAX_ARTWORK_ENTRIES = 60;

export type DownloadStatus = "queued" | "downloading" | "downloaded" | "failed" | "stale";
export interface DownloadRecord {
  recordingId: string;
  songId: string;
  collectionId: string;
  songTitle: string;
  collectionTitle: string;
  recordingLabel: string;
  sourceUrl: string;
  artworkUrl?: string | null;
  status: DownloadStatus;
  bytesReceived?: number;
  totalBytes?: number;
  downloadedAt?: string;
  error?: string;
  song?: Song;
  collection?: CollectionSummary;
}
export interface DownloadSnapshot { initialized: boolean; records: DownloadRecord[]; }
export interface DownloadRequest { song: Song; collection: CollectionSummary; preferredType?: string; }

type Listener = (snapshot: DownloadSnapshot) => void;
const listeners = new Set<Listener>();
const active = new Map<string, AbortController>();
let records = new Map<string, DownloadRecord>();
const knownSongs = new Map<string, Song>();
let snapshot: DownloadSnapshot = { initialized: false, records: [] };
let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("listenerData")) request.result.createObjectStore("listenerData");
      if (!request.result.objectStoreNames.contains(DOWNLOAD_STORE)) request.result.createObjectStore(DOWNLOAD_STORE, { keyPath: "recordingId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline storage could not be opened."));
    request.onblocked = () => reject(new Error("Offline storage is blocked by another tab."));
  });
  return databasePromise;
}

async function allRecords(): Promise<DownloadRecord[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(DOWNLOAD_STORE).objectStore(DOWNLOAD_STORE).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error || new Error("Downloads could not be read."));
  });
}

async function persistRecord(record: DownloadRecord): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DOWNLOAD_STORE, "readwrite");
    transaction.objectStore(DOWNLOAD_STORE).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Download status could not be saved."));
  });
}

async function deleteRecord(recordingId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DOWNLOAD_STORE, "readwrite");
    transaction.objectStore(DOWNLOAD_STORE).delete(recordingId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Download status could not be removed."));
  });
}

function publish(): void {
  snapshot = { initialized: true, records: [...records.values()].sort((a, b) => (b.downloadedAt || "").localeCompare(a.downloadedAt || "")) };
  listeners.forEach((listener) => listener(snapshot));
}
async function update(record: DownloadRecord): Promise<void> {
  records.set(record.recordingId, record); publish(); await persistRecord(record);
}

export function currentDownloadSnapshot(): DownloadSnapshot { return snapshot; }
export function subscribeToDownloads(listener: Listener): () => void { listeners.add(listener); listener(snapshot); return () => listeners.delete(listener); }

export async function initializeDownloads(): Promise<void> {
  try {
    records = new Map((await allRecords()).map((record) => [record.recordingId, record]));
    const cache = await caches.open(DOWNLOAD_CACHE);
    for (const record of records.values()) {
      const cached = await cache.match(record.sourceUrl, { ignoreVary: true });
      let recovered = record;
      if (record.status === "queued" || record.status === "downloading") {
        recovered = cached
          ? { ...record, status: "downloaded" as const, downloadedAt: record.downloadedAt || new Date().toISOString(), error: undefined }
          : { ...record, status: "failed" as const, error: "Download was interrupted. Try again." };
      } else if ((record.status === "downloaded" || record.status === "stale") && !cached) {
        recovered = { ...record, status: "failed" as const, error: "The browser removed this media copy. Download it again." };
      }
      if (recovered !== record) { records.set(record.recordingId, recovered); await persistRecord(recovered); }
    }
  } catch {
    records = new Map();
  }
  if (knownSongs.size) reconcileDownloads([...knownSongs.values()]);
  else publish();
}

function validMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch { return false; }
}

async function fetchForDownload(url: string, signal: AbortSignal): Promise<Response> {
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit", signal });
    if (!response.ok) throw new Error(`Media server returned ${response.status}.`);
    return response;
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.message.startsWith("Media server"))) throw error;
    return fetch(url, { mode: "no-cors", credentials: "omit", signal });
  }
}

function quotaMessage(error: unknown): string {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ? "This device does not have enough browser storage for that recording."
    : error instanceof Error ? error.message : "This recording could not be downloaded.";
}

async function cacheArtwork(url?: string | null): Promise<void> {
  if (!url || !validMediaUrl(url)) return;
  try {
    const cache = await caches.open(ARTWORK_CACHE);
    if (!(await cache.match(url, { ignoreVary: true }))) {
      const response = await fetch(url, { mode: "no-cors", credentials: "omit" });
      await cache.put(new Request(url, { mode: "no-cors", credentials: "omit" }), response);
    }
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ARTWORK_ENTRIES)).map((key) => cache.delete(key)));
  } catch {}
}

export async function downloadRecording(request: DownloadRequest): Promise<DownloadRecord> {
  const recording = chooseRecording(request.song, request.preferredType);
  if (!recording) throw new Error("No downloadable recording is available for this song.");
  if (!validMediaUrl(recording.url)) throw new Error("This recording does not use a supported media URL.");
  const existing = records.get(recording.id);
  if (existing?.status === "downloaded" && existing.sourceUrl === recording.url) return existing;
  if (active.has(recording.id)) return records.get(recording.id)!;

  const controller = new AbortController(); active.set(recording.id, controller);
  let record: DownloadRecord = {
    recordingId: recording.id, songId: request.song.id, collectionId: request.collection.id,
    songTitle: request.song.title, collectionTitle: request.collection.title,
    recordingLabel: recording.label, sourceUrl: recording.url,
    artworkUrl: recording.artworkUrl || request.song.artworkUrl || request.collection.artworkUrl,
    song: request.song, collection: request.collection,
    status: "queued", bytesReceived: 0,
  };
  try {
    await update(record);
    record = { ...record, status: "downloading" };
    await update(record);
    const usageBefore = await navigator.storage?.estimate?.().then((value) => value.usage, () => undefined);
    const response = await fetchForDownload(recording.url, controller.signal);
    if (response.type !== "opaque" && !response.ok) throw new Error(`Media server returned ${response.status}.`);
    const totalHeader = response.headers.get("content-length");
    const totalBytes = totalHeader ? Number(totalHeader) : undefined;
    if (totalBytes) {
      const estimate = await navigator.storage?.estimate?.();
      const remaining = estimate?.quota !== undefined && estimate.usage !== undefined ? estimate.quota - estimate.usage : undefined;
      if (remaining !== undefined && totalBytes > remaining * 0.9) throw new DOMException("Insufficient storage", "QuotaExceededError");
    }
    record = { ...record, totalBytes: Number.isFinite(totalBytes) ? totalBytes : undefined };
    records.set(record.recordingId, record); publish();
    const cache = await caches.open(DOWNLOAD_CACHE);
    const key = new Request(recording.url, { mode: response.type === "opaque" ? "no-cors" : "cors", credentials: "omit" });
    const cacheWork = cache.put(key, response.clone());
    let received = 0;
    let lastPublishedBytes = 0;
    let lastPublishedAt = performance.now();
    if (response.type !== "opaque" && response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        received += value.byteLength;
        record = { ...record, bytesReceived: received };
        const now = performance.now();
        if (received - lastPublishedBytes >= 262144 || now - lastPublishedAt >= 250) {
          records.set(record.recordingId, record); publish(); lastPublishedBytes = received; lastPublishedAt = now;
        }
      }
    }
    await cacheWork;
    if (!(await cache.match(recording.url, { ignoreVary: true }))) throw new Error("The downloaded response could not be verified.");
    if (controller.signal.aborted) {
      await cache.delete(recording.url, { ignoreVary: true });
      throw new Error("Download was removed.");
    }
    if (existing && existing.sourceUrl !== recording.url) await cache.delete(existing.sourceUrl, { ignoreVary: true });
    const usageAfter = totalBytes || received ? undefined : await navigator.storage?.estimate?.().then((value) => value.usage, () => undefined);
    const measuredBytes = usageAfter !== undefined && usageBefore !== undefined ? Math.max(0, usageAfter - usageBefore) : undefined;
    record = {
      ...record, status: "downloaded", bytesReceived: totalBytes || received || measuredBytes,
      totalBytes: totalBytes || received || measuredBytes, downloadedAt: new Date().toISOString(), error: undefined,
    };
    await update(record);
    void cacheArtwork(record.artworkUrl);
    return record;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Download was removed.");
    record = { ...record, status: "failed", error: quotaMessage(error) };
    try { await update(record); } catch { records.set(record.recordingId, record); publish(); }
    throw new Error(record.error);
  } finally { active.delete(recording.id); }
}

export async function downloadMany(requests: DownloadRequest[]): Promise<void> {
  for (const request of requests) {
    const recording = chooseRecording(request.song, request.preferredType);
    if (!recording || records.has(recording.id)) continue;
    await update({
      recordingId: recording.id, songId: request.song.id, collectionId: request.collection.id,
      songTitle: request.song.title, collectionTitle: request.collection.title,
      recordingLabel: recording.label, sourceUrl: recording.url,
      artworkUrl: recording.artworkUrl || request.song.artworkUrl || request.collection.artworkUrl,
      song: request.song, collection: request.collection,
      status: "queued", bytesReceived: 0,
    });
  }
  for (const request of requests) {
    try { await downloadRecording(request); } catch { /* Each failed record remains retryable. */ }
  }
}

export async function removeDownload(recordingId: string): Promise<void> {
  active.get(recordingId)?.abort();
  const record = records.get(recordingId);
  if (!record) return;
  const cache = await caches.open(DOWNLOAD_CACHE);
  await cache.delete(record.sourceUrl, { ignoreVary: true });
  records.delete(recordingId); publish();
  await deleteRecord(recordingId);
}

export async function removeSongDownloads(songId: string): Promise<void> {
  await Promise.all([...records.values()].filter((record) => record.songId === songId).map((record) => removeDownload(record.recordingId)));
}

export async function clearAllDownloads(): Promise<void> {
  active.forEach((controller) => controller.abort());
  active.clear();
  await Promise.all([caches.delete(DOWNLOAD_CACHE), caches.delete(ARTWORK_CACHE)]);
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DOWNLOAD_STORE, "readwrite");
      transaction.objectStore(DOWNLOAD_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Downloads could not be cleared."));
    });
  } finally { records.clear(); publish(); }
}

export function reconcileDownloads(songs: Song[]): void {
  songs.forEach((song) => knownSongs.set(song.id, song));
  for (const record of records.values()) {
    const song = knownSongs.get(record.songId);
    if (!song) continue;
    const recording = song.recordings.find((entry) => entry.id === record.recordingId);
    if (recording?.url === record.sourceUrl || record.status === "queued" || record.status === "downloading" || record.status === "failed") continue;
    const stale = {
      ...record, status: "stale" as const,
      error: recording ? "The catalog has a newer source. Update this download when you are online." : "This recording is no longer in the catalog. The saved copy remains playable.",
    };
    records.set(record.recordingId, stale); void persistRecord(stale);
  }
  publish();
}


export function playbackUrl(recording: Recording): string {
  const record = records.get(recording.id);
  if (!record || (record.status !== "downloaded" && record.status !== "stale")) return recording.url;
  if (record.sourceUrl !== recording.url && record.status !== "stale") {
    const stale = { ...record, status: "stale" as const, error: "The catalog has a newer source. Remove and download again to update." };
    records.set(record.recordingId, stale); publish(); void persistRecord(stale);
  }
  return record.sourceUrl;
}

export function downloadedSongIds(value: DownloadSnapshot): Set<string> {
  return new Set(value.records.filter((record) => record.status === "downloaded" || record.status === "stale").map((record) => record.songId));
}

export function downloadedBytes(value: DownloadSnapshot): number {
  return value.records.reduce((sum, record) => sum + (record.status === "downloaded" || record.status === "stale" ? record.totalBytes || record.bytesReceived || 0 : 0), 0);
}
