import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
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
    return { url, cacheKey: `${url}${url.includes("?") ? "&" : "?"}__lm=${revision}` };
  }));
}

export function renderServiceWorker(entries) {
  const version = digest(JSON.stringify(entries));
  return `const CACHE_PREFIX = "living-music-shell-";
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const PRECACHE = ${JSON.stringify(entries)};
const ROOT_ENTRY = PRECACHE.find((entry) => entry.url === "/");
const BY_PATH = new Map(PRECACHE.map((entry) => [new URL(entry.url, self.location.origin).pathname, entry]));
const requestFor = (value, options) => new Request(new URL(value, self.location.origin), options);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE.map(async (entry) => {
      const key = requestFor(entry.cacheKey);
      const prior = await caches.match(key);
      if (prior) {
        await cache.put(key, prior);
        return;
      }
      const response = await fetch(requestFor(entry.url, { cache: "reload" }));
      if (!response.ok) throw new Error("Could not cache " + entry.url + ": " + response.status);
      await cache.put(key, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const entry = event.request.mode === "navigate" ? ROOT_ENTRY : BY_PATH.get(url.pathname);
  if (!entry) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
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
