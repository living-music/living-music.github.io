import { expect, test } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve("dist");
const manifest = {
  schemaVersion: 1,
  currentVersion: "v1",
  revision: "sha256:index",
  href: "v1/index.json?v=index",
};
const collection = {
  id: "offline-hymns",
  slug: "offline-hymns",
  title: "Offline Hymns",
  artworkUrl: null,
  sourceUrl: "https://example.test/offline-hymns",
  songCount: 1,
  playableSongCount: 1,
  revision: "sha256:collection",
  href: "collections/offline-hymns.json?v=collection",
};
const catalog = {
  schemaVersion: 1,
  language: "eng",
  collections: [collection],
  stats: { collectionCount: 1, songCount: 1, playableSongCount: 1 },
  search: { revision: "sha256:search", href: "search.json?v=search", songCount: 1 },
  revision: "sha256:index",
};
const song = {
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
    url: "https://example.test/offline.mp3",
    language: "eng",
  }],
};

async function writeCatalogFixture(): Promise<void> {
  await mkdir(`${dist}/musicapi/v1/collections`, { recursive: true });
  await writeFile(`${dist}/musicapi/index.json`, JSON.stringify(manifest));
  await writeFile(`${dist}/musicapi/v1/index.json`, JSON.stringify(catalog));
  await writeFile(`${dist}/musicapi/v1/search.json`, JSON.stringify({
    schemaVersion: 1,
    songs: [{
      id: song.id,
      title: song.title,
      collectionId: collection.id,
      artists: [],
      recordingTypes: ["AUDIO_VOCAL"],
    }],
    revision: "sha256:search",
  }));
  await writeFile(`${dist}/musicapi/v1/collections/offline-hymns.json`, JSON.stringify({
    schemaVersion: 1,
    collection,
    songs: [song],
    revision: "sha256:collection",
  }));
}

async function waitForControl(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

test.beforeAll(writeCatalogFixture);
test.afterAll(() => rm(`${dist}/musicapi`, { recursive: true, force: true }));

test("reloads Browse and an opened collection from catalog cache while offline", async ({ page, context }) => {
  await page.goto("/#/browse");
  await waitForControl(page);
  await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
  await expect(page.getByText("Offline Hymns", { exact: true })).toBeVisible();
  await page.getByText("Offline Hymns", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Offline Hymns" })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Offline Hymns" })).toBeVisible();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();

  await page.evaluate(() => { window.location.hash = "#/search"; });
  await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search 1 songs." })).toBeVisible();
});

test("shows a dedicated first-use offline state when no catalog is cached", async ({ page, context }) => {
  await page.goto("/#/browse");
  await waitForControl(page);
  await page.evaluate(() => caches.delete("living-music-catalog-v1"));
  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole("heading", { name: "You’re offline." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" }).first()).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
  await expect(page.getByText("Offline Hymns", { exact: true })).toBeVisible();
});

test("keeps an app update waiting until the listener applies it", async ({ page }) => {
  await page.goto("/#/browse");
  await waitForControl(page);
  const workerPath = `${dist}/sw.js`;
  const original = await readFile(workerPath, "utf8");
  try {
    await writeFile(workerPath, `${original}\n// browser-update-test\n`);
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });
    await expect(page.getByText("Update ready", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
    await Promise.all([
      page.waitForEvent("load"),
      page.getByRole("button", { name: "Update now" }).click(),
    ]);
    await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
  } finally {
    await writeFile(workerPath, original);
  }
});

test("applies saved light and system appearance to the browser theme color", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("livingMusic:theme", "light"));
  await page.reload();
  await expect.poll(() => page.locator('meta[name="theme-color"]').getAttribute("content")).toBe("#f2f2f7");

  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => localStorage.setItem("livingMusic:theme", "system"));
  await page.reload();
  await expect.poll(() => page.locator('meta[name="theme-color"]').getAttribute("content")).toBe("#f2f2f7");
});

test("retains only the two newest revisions for each catalog path", async ({ page }) => {
  await page.goto("/#/browse");
  await waitForControl(page);
  await page.evaluate(async () => {
    await fetch("/musicapi/v1/search.json?v=one");
    await fetch("/musicapi/v1/search.json?v=two");
    await fetch("/musicapi/v1/search.json?v=three");
  });
  const revisions = await page.evaluate(async () => {
    const cache = await caches.open("living-music-catalog-v1");
    const keys = await cache.keys();
    return keys
      .map((key) => new URL(key.url))
      .filter((url) => url.pathname === "/musicapi/v1/search.json")
      .map((url) => url.searchParams.get("v"));
  });
  expect(revisions).toEqual(["two", "three"]);
});

test("keeps the last complete manifest when a catalog release is interrupted", async ({ page }) => {
  await page.goto("/#/browse");
  await waitForControl(page);
  const manifestPath = `${dist}/musicapi/index.json`;
  const original = await readFile(manifestPath, "utf8");
  try {
    await writeFile(manifestPath, JSON.stringify({
      ...manifest,
      revision: "sha256:incomplete",
      href: "v1/missing-index.json?v=incomplete",
    }));
    const resolvedHref = await page.evaluate(async () => {
      const response = await fetch("/musicapi/index.json", { cache: "no-cache" });
      return (await response.json()).href;
    });
    expect(resolvedHref).toBe(manifest.href);
    await expect(page.getByText("Using saved catalog", { exact: true })).toBeVisible();
  } finally {
    await writeFile(manifestPath, original);
  }
});

test("migrates existing listener data into IndexedDB before rendering", async ({ page }) => {
  const legacy = {
    favorites: ["offline-song"],
    favoriteAddedAt: { "offline-song": "2026-09-01T12:00:00.000Z" },
    librarySongs: ["offline-song"],
    librarySongAddedAt: { "offline-song": "2026-09-01T12:00:00.000Z" },
    albums: [], albumAddedAt: {}, playlists: [], queue: [], currentQueueIndex: -1,
    repeatMode: "off", songRecordingPreferences: {},
  };
  await page.addInitScript((state) => localStorage.setItem("livingMusic:userState:v1", JSON.stringify(state)), legacy);
  await page.goto("/#/library/songs");
  await expect(page.getByText("Offline Song", { exact: true })).toBeVisible();
  const migrated = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("livingMusic", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const state = await new Promise<unknown>((resolve, reject) => {
      const request = database.transaction("listenerData").objectStore("listenerData").get("userState:v2");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return { state, legacy: localStorage.getItem("livingMusic:userState:v1") };
  });
  expect(migrated).toEqual({ state: legacy, legacy: null });
});

test("keeps legacy data and explains limited storage when IndexedDB cannot open", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("livingMusic:userState:v1", JSON.stringify({ favorites: ["offline-song"] }));
    IDBFactory.prototype.open = () => { throw new Error("storage unavailable"); };
  });
  await page.goto("/#/library/favorites");
  await expect(page.getByText("Offline Song", { exact: true })).toBeVisible();
  await expect(page.getByText("storage unavailable", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("livingMusic:userState:v1"))).not.toBeNull();
});

test("exports, clears, and restores listener data", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("livingMusic:userState:v1", JSON.stringify({
    favorites: ["offline-song"],
    favoriteAddedAt: { "offline-song": "2026-09-01T12:00:00.000Z" },
    librarySongs: ["offline-song"],
    librarySongAddedAt: { "offline-song": "2026-09-01T12:00:00.000Z" },
  })));
  await page.goto("/#/library/songs");
  await expect(page.getByText("Offline Song", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear local data" }).click();
  await expect(page.getByRole("heading", { name: "Add songs to your Library." })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  await expect(page.getByText("Backup restored.", { exact: true })).toBeVisible();
  await expect(page.getByText("Offline Song", { exact: true })).toBeVisible();
});

test("offers the captured browser install prompt from Library settings", async ({ page }) => {
  await page.goto("/#/library/songs");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    event.prompt = async () => { (window as Window & { installPromptOpened?: boolean }).installPromptOpened = true; };
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Install", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { installPromptOpened?: boolean }).installPromptOpened)).toBe(true);
});

test("hides install promotion in standalone mode", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => query === "(display-mode: standalone)"
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true }
      : original(query);
  });
  await page.goto("/#/library/songs");
  await expect(page.getByRole("heading", { name: "Local data" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Install Living Music" })).toHaveCount(0);
});
