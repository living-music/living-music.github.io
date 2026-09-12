import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const dist = resolve("dist");
export const manifest = {
  schemaVersion: 1,
  currentVersion: "v1",
  revision: "sha256:index",
  href: "v1/index.json?v=index",
};
export const collection = {
  id: "offline-hymns",
  slug: "offline-hymns",
  title: "Offline Hymns",
  artworkUrl: null,
  sourceUrl: "https://example.test/offline-hymns",
  songCount: 2,
  playableSongCount: 2,
  revision: "sha256:collection",
  href: "collections/offline-hymns.json?v=collection",
};
export const catalog = {
  schemaVersion: 1,
  language: "eng",
  collections: [collection],
  stats: { collectionCount: 1, songCount: 2, playableSongCount: 2 },
  search: { revision: "sha256:search", href: "search.json?v=search", songCount: 2 },
  revision: "sha256:index",
};
export const song = {
  id: "offline-song",
  slug: "offline-song",
  title: "Offline Song",
  artworkUrl: null,
  artists: [],
  authors: [],
  composers: [],
  arrangers: [],
  tags: [],
  sourceUrl: "https://example.test/offline-song",
  recordings: [{
    id: "offline-recording",
    type: "AUDIO_VOCAL",
    label: "Vocal",
    url: "http://127.0.0.1:4173/musicapi/offline.wav",
    language: "eng",
  }],
};
export const secondSong = {
  ...song,
  id: "offline-song-two",
  slug: "offline-song-two",
  title: "Second Offline Song",
  recordings: [{ ...song.recordings[0], id: "offline-recording-two", url: "http://127.0.0.1:4173/musicapi/offline-two.wav" }],
};

export function silentWav(seconds = 2): Uint8Array {
  const sampleRate = 8000;
  const dataSize = sampleRate * seconds * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((character, index) => bytes[offset + index] = character.charCodeAt(0));
  text(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, dataSize, true);
  return bytes;
}

export async function writeCatalogFixture(): Promise<void> {
  await mkdir(`${dist}/musicapi/v1/collections`, { recursive: true });
  await writeFile(`${dist}/musicapi/index.json`, JSON.stringify(manifest));
  await writeFile(`${dist}/musicapi/offline.wav`, silentWav());
  await writeFile(`${dist}/musicapi/offline-two.wav`, silentWav());
  await writeFile(`${dist}/musicapi/v1/index.json`, JSON.stringify(catalog));
  await writeFile(`${dist}/musicapi/v1/search.json`, JSON.stringify({
    schemaVersion: 1,
    songs: [song, secondSong].map((entry) => ({
      id: entry.id,
      title: entry.title,
      collectionId: collection.id,
      artists: [],
      recordingTypes: ["AUDIO_VOCAL"],
    })),
    revision: "sha256:search",
  }));
  await writeFile(`${dist}/musicapi/v1/collections/offline-hymns.json`, JSON.stringify({
    schemaVersion: 1,
    collection,
    songs: [song, secondSong],
    revision: "sha256:collection",
  }));
}

export async function removeCatalogFixture(): Promise<void> {
  await rm(`${dist}/musicapi`, { recursive: true, force: true });
}
