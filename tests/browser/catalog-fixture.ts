import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const dist = resolve("dist");
const stats = { collectionCount: 1, songCount: 3, playableSongCount: 2 };
const language = { code: "eng", locale: "en", name: "English", autonym: "English" };
const spanishLanguage = { code: "spa", locale: "es", name: "Spanish", autonym: "Español" };
export const manifest = {
  schemaVersion: 1,
  currentVersion: "v1",
  revision: "sha256:legacy-index",
  href: "v1/index.json?v=legacy-index",
  multilingual: { schemaVersion: 2, revision: "sha256:multilingual", href: "v2/index.json?v=multilingual", languageCount: 2 },
};
export const multilingualCatalog = {
  schemaVersion: 2,
  defaultLanguage: "eng",
  languages: [
    { ...language, revision: "sha256:index", href: "languages/eng/index.json?v=index", stats },
    { ...spanishLanguage, revision: "sha256:spanish-index", href: "languages/spa/index.json?v=spanish-index", stats: { collectionCount: 1, songCount: 1, playableSongCount: 1 } },
  ],
  revision: "sha256:multilingual",
};
export const collection = {
  id: "offline-hymns",
  slug: "offline-hymns",
  title: "Offline Hymns",
  language: "eng",
  availableLanguages: ["eng"],
  artworkUrl: null,
  sourceUrl: "https://example.test/offline-hymns",
  songCount: 3,
  playableSongCount: 2,
  revision: "sha256:collection",
  href: "collections/offline-hymns.json?v=collection",
};
export const catalog = {
  schemaVersion: 2,
  language,
  collections: [collection],
  stats,
  search: { revision: "sha256:search", href: "search.json?v=search", songCount: 3 },
  revision: "sha256:index",
};
export const song = {
  id: "offline-song",
  slug: "offline-song",
  title: "Offline Song",
  language: "eng",
  availableLanguages: ["eng"],
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
export const unplayableSong = {
  ...song,
  id: "unplayable-song",
  slug: "unplayable-song",
  title: "Unplayable Song",
  recordings: [],
};

const spanishCollection = {
  ...collection,
  title: "Himnos sin conexión",
  language: "spa",
  availableLanguages: ["eng", "spa"],
  songCount: 1,
  playableSongCount: 1,
  revision: "sha256:spanish-collection",
  href: "collections/offline-hymns.json?v=spanish-collection",
};
const spanishSong = {
  ...song,
  title: "Canción sin conexión",
  language: "spa",
  availableLanguages: ["eng", "spa"],
  sourceUrl: "https://example.test/offline-song?lang=spa",
  recordings: [{ ...song.recordings[0], id: "offline-recording-spa", language: "spa" }],
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
  const languageRoot = `${dist}/musicapi/v2/languages/eng`;
  const spanishRoot = `${dist}/musicapi/v2/languages/spa`;
  await mkdir(`${languageRoot}/collections`, { recursive: true });
  await mkdir(`${spanishRoot}/collections`, { recursive: true });
  await writeFile(`${dist}/musicapi/index.json`, JSON.stringify(manifest));
  await writeFile(`${dist}/musicapi/offline.wav`, silentWav());
  await writeFile(`${dist}/musicapi/offline-two.wav`, silentWav());
  await writeFile(`${dist}/musicapi/v2/index.json`, JSON.stringify(multilingualCatalog));
  await writeFile(`${languageRoot}/index.json`, JSON.stringify(catalog));
  await writeFile(`${languageRoot}/search.json`, JSON.stringify({
    schemaVersion: 2,
    language: "eng",
    songs: [song, secondSong, unplayableSong].map((entry) => ({
      id: entry.id,
      title: entry.title,
      collectionId: collection.id,
      artists: [],
      recordingTypes: entry.recordings.map((recording) => recording.type),
      language: "eng",
      availableLanguages: ["eng"],
    })),
    revision: "sha256:search",
  }));
  await writeFile(`${languageRoot}/collections/offline-hymns.json`, JSON.stringify({
    schemaVersion: 2,
    language: "eng",
    collection,
    songs: [song, secondSong, unplayableSong],
    revision: "sha256:collection",
  }));
  await writeFile(`${spanishRoot}/index.json`, JSON.stringify({
    schemaVersion: 2,
    language: spanishLanguage,
    collections: [spanishCollection],
    stats: { collectionCount: 1, songCount: 1, playableSongCount: 1 },
    search: { revision: "sha256:spanish-search", href: "search.json?v=spanish-search", songCount: 1 },
    revision: "sha256:spanish-index",
  }));
  await writeFile(`${spanishRoot}/search.json`, JSON.stringify({
    schemaVersion: 2,
    language: "spa",
    songs: [{
      id: spanishSong.id, title: spanishSong.title, collectionId: spanishCollection.id,
      artists: [], recordingTypes: ["AUDIO_VOCAL"], language: "spa", availableLanguages: ["eng", "spa"],
    }],
    revision: "sha256:spanish-search",
  }));
  await writeFile(`${spanishRoot}/collections/offline-hymns.json`, JSON.stringify({
    schemaVersion: 2, language: "spa", collection: spanishCollection,
    songs: [spanishSong], revision: "sha256:spanish-collection",
  }));

}

export async function removeCatalogFixture(): Promise<void> {
  await rm(`${dist}/musicapi`, { recursive: true, force: true });
}
