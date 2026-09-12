import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXCLUDED_FILES = new Set([".nojekyll", "sw.js"]);

function digest(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }));
  return files.flat().sort();
}

export async function collectPrecacheEntries(directory) {
  const root = resolve(directory);
  const files = (await filesBelow(root)).filter((path) => {
    const name = relative(root, path).replaceAll("\\", "/");
    return !EXCLUDED_FILES.has(name) && !name.endsWith(".map");
  });
  return Promise.all(files.map(async (path) => {
    const name = relative(root, path).replaceAll("\\", "/");
    const revision = digest(await readFile(path));
    const url = name === "index.html" ? "/" : `/${name}`;
    return { url, revision, cacheKey: `${url}${url.includes("?") ? "&" : "?"}__lm=${revision}` };
  }));
}

export function renderServiceWorker(entries) {
  const version = "v2-" + digest(JSON.stringify(entries));
  return `const SHELL_CACHE_PREFIX = "living-music-shell-";
const SHELL_CACHE_NAME = SHELL_CACHE_PREFIX + ${JSON.stringify(version)};
const CATALOG_CACHE_PREFIX = "living-music-catalog-";
const CATALOG_CACHE_NAME = CATALOG_CACHE_PREFIX + "v1";
const CATALOG_PATH_PREFIX = "/musicapi/";
const CATALOG_MANIFEST_PATH = "/musicapi/index.json";
const CATALOG_REVISIONS_PER_PATH = 2;
const DOWNLOAD_CACHE_NAME = "living-music-downloads-v1";
const ARTWORK_CACHE_NAME = "living-music-artwork-v1";
const MAX_ARTWORK_ENTRIES = 60;
const PRECACHE = ${JSON.stringify(entries)};
const ROOT_ENTRY = PRECACHE.find((entry) => entry.url === "/");
const BY_PATH = new Map(PRECACHE.map((entry) => [new URL(entry.url, self.location.origin).pathname, entry]));
const requestFor = (value, options) => new Request(new URL(value, self.location.origin), options);

async function shellResponseMatches(response, revision) {
  if (!response?.ok) return false;
  const bytes = await response.clone().arrayBuffer();
  const hash = await self.crypto.subtle.digest("SHA-256", bytes);
  const actual = [...new Uint8Array(hash)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return actual === revision;
}

async function notifyClients(type) {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) client.postMessage({ type });
}

async function trimCatalogRevisions(cache, requestUrl) {
  if (!requestUrl.searchParams.has("v")) return;
  const keys = await cache.keys();
  const matching = keys.filter((key) => {
    const url = new URL(key.url);
    return url.pathname === requestUrl.pathname && url.searchParams.has("v");
  });
  await Promise.all(matching
    .slice(0, Math.max(0, matching.length - CATALOG_REVISIONS_PER_PATH))
    .map((key) => cache.delete(key)));
}

async function catalogCacheFirst(request) {
  const cache = await caches.open(CATALOG_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trimCatalogRevisions(cache, new URL(request.url));
  }
  return response;
}

async function catalogManifestNetworkFirst(request) {
  const cache = await caches.open(CATALOG_CACHE_NAME);
  const manifestKey = requestFor(CATALOG_MANIFEST_PATH);
  try {
    const response = await fetch(request);
    if (!response.ok) throw new Error("Catalog manifest returned " + response.status);
    const manifest = await response.clone().json();
    if (!manifest || typeof manifest.href !== "string") throw new Error("Catalog manifest has no index link");
    const indexRequest = new Request(new URL(manifest.href, request.url), { headers: { Accept: "application/json" } });
    const indexResponse = await catalogCacheFirst(indexRequest);
    if (!indexResponse.ok) throw new Error("Catalog index returned " + indexResponse.status);
    const index = await indexResponse.clone().json();
    if (!index?.search || typeof index.search.href !== "string") throw new Error("Catalog index has no search link");
    const searchRequest = new Request(new URL(index.search.href, indexRequest.url), { headers: { Accept: "application/json" } });
    const searchResponse = await catalogCacheFirst(searchRequest);
    if (!searchResponse.ok) throw new Error("Catalog search index returned " + searchResponse.status);
    await cache.put(manifestKey, response.clone());
    await notifyClients("LIVING_MUSIC_CATALOG_NETWORK");
    return response;
  } catch (error) {
    const cached = await cache.match(manifestKey);
    if (cached) {
      await notifyClients("LIVING_MUSIC_CATALOG_FALLBACK");
      return cached;
    }
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE_NAME);
    await Promise.all(PRECACHE.map(async (entry) => {
      const key = requestFor(entry.cacheKey);
      const prior = await caches.match(key);
      if (prior && await shellResponseMatches(prior, entry.revision)) {
        await cache.put(key, prior);
        return;
      }
      const response = await fetch(requestFor(entry.cacheKey, { cache: "reload" }));
      if (!response.ok) throw new Error("Could not cache " + entry.url + ": " + response.status);
      if (!(await shellResponseMatches(response, entry.revision))) {
        throw new Error("Shell response did not match " + entry.url + " revision " + entry.revision);
      }
      await cache.put(key, response);
    }));
    try {
      await catalogManifestNetworkFirst(requestFor(CATALOG_MANIFEST_PATH, { headers: { Accept: "application/json" } }));
    } catch {
      // The shell remains installable even if the optional catalog warm-up fails.
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) =>
        (name.startsWith(SHELL_CACHE_PREFIX) && name !== SHELL_CACHE_NAME) ||
        (name.startsWith(CATALOG_CACHE_PREFIX) && name !== CATALOG_CACHE_NAME))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "LIVING_MUSIC_SKIP_WAITING") void self.skipWaiting();
});

async function downloadedMedia(request) {
  const cache = await caches.open(DOWNLOAD_CACHE_NAME);
  const cached = await cache.match(request.url, { ignoreVary: true });
  if (!cached) return fetch(request);
  const range = request.headers.get("range");
  if (!range || cached.type === "opaque") return cached;
  const match = /^bytes=(\\d+)-(\\d*)$/.exec(range);
  if (!match) return cached;
  const body = await cached.arrayBuffer();
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : body.byteLength - 1;
  if (start >= body.byteLength) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + body.byteLength } });
  const end = Math.min(requestedEnd, body.byteLength - 1);
  const headers = new Headers(cached.headers);
  headers.set("Content-Range", "bytes " + start + "-" + end + "/" + body.byteLength);
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Accept-Ranges", "bytes");
  return new Response(body.slice(start, end + 1), { status: 206, statusText: "Partial Content", headers });
}

async function artworkCacheOnUse(request) {
  const cache = await caches.open(ARTWORK_CACHE_NAME);
  const cached = await cache.match(request.url, { ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ARTWORK_ENTRIES)).map((key) => cache.delete(key)));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const mediaPath = /\\.(?:mp3|m4a|aac|wav|ogg|mp4|m4v|webm)$/i.test(url.pathname);
  if (event.request.destination === "audio" || event.request.destination === "video" || mediaPath) {
    event.respondWith(downloadedMedia(event.request));
    return;
  }
  if (event.request.destination === "image" && url.origin !== self.location.origin) {
    event.respondWith(artworkCacheOnUse(event.request));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (url.pathname === CATALOG_MANIFEST_PATH) {
    event.respondWith(catalogManifestNetworkFirst(event.request));
    return;
  }
  if (url.pathname.startsWith(CATALOG_PATH_PREFIX)) {
    event.respondWith(catalogCacheFirst(event.request));
    return;
  }

  const entry = event.request.mode === "navigate" ? ROOT_ENTRY : BY_PATH.get(url.pathname);
  if (!entry) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE_NAME);
    return (await cache.match(requestFor(entry.cacheKey))) || fetch(event.request);
  })());
});
`;
}

export async function generateServiceWorker(directory = resolve("dist")) {
  const entries = await collectPrecacheEntries(directory);
  if (!entries.some((entry) => entry.url === "/")) throw new Error("The production build has no index.html.");
  await writeFile(resolve(directory, "sw.js"), renderServiceWorker(entries));
  return entries;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const entries = await generateServiceWorker();
  console.log(`Generated service worker for ${entries.length} app-shell assets.`);
}
