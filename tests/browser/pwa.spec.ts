import { expect, test } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateServiceWorker } from "../../scripts/generate-service-worker.mjs";

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
  songCount: 2,
  playableSongCount: 2,
  revision: "sha256:collection",
  href: "collections/offline-hymns.json?v=collection",
};
const catalog = {
  schemaVersion: 1,
  language: "eng",
  collections: [collection],
  stats: { collectionCount: 1, songCount: 2, playableSongCount: 2 },
  search: { revision: "sha256:search", href: "search.json?v=search", songCount: 2 },
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
    url: "http://127.0.0.1:4173/musicapi/offline.wav",
    language: "eng",
  }],
};
const secondSong = {
  ...song,
  id: "offline-song-two",
  slug: "offline-song-two",
  title: "Second Offline Song",
  recordings: [{ ...song.recordings[0], id: "offline-recording-two", url: "http://127.0.0.1:4173/musicapi/offline-two.wav" }],
};

function silentWav(seconds = 2): Uint8Array {
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

async function writeCatalogFixture(): Promise<void> {
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
  await expect(page.getByRole("heading", { name: "Search", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Search 2 songs." })).toBeVisible();
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

test("applies updated shell assets only after the listener approves them", async ({ page }) => {
  await page.goto("/#/browse");
  await waitForControl(page);

  const workerPath = resolve(dist, "sw.js");
  const indexPath = resolve(dist, "index.html");
  const originalWorker = await readFile(workerPath, "utf8");
  const originalIndex = await readFile(indexPath, "utf8");
  const stylesheetHref = originalIndex.match(/\/assets\/[^"]+\.css/)?.[0];
  expect(stylesheetHref).toBeTruthy();
  const originalStyles = await readFile(resolve(dist, stylesheetHref!.slice(1)), "utf8");
  const updatedStylesheetHref = "/assets/pwa-update-probe.css";
  const updatedStylesheetPath = resolve(dist, updatedStylesheetHref.slice(1));

  try {
    await writeFile(updatedStylesheetPath, originalStyles + "\n:root { --living-music-update-probe: applied; }\n");
    await writeFile(indexPath, originalIndex.replace(stylesheetHref!, updatedStylesheetHref));
    await generateServiceWorker(dist);

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
    });

    await expect(page.getByText("Update ready", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--living-music-update-probe").trim(),
    )).toBe("");

    await Promise.all([
      page.waitForEvent("load"),
      page.getByRole("button", { name: "Update now" }).click(),
    ]);

    await expect.poll(() => page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--living-music-update-probe").trim(),
    )).toBe("applied");
    await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
  } finally {
    await writeFile(indexPath, originalIndex);
    await writeFile(workerPath, originalWorker);
    await rm(updatedStylesheetPath, { force: true });
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
  await page.getByRole("button", { name: "Dismiss local data notice" }).click();
  await expect(page.getByText("Local data", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Local data", { exact: true })).toHaveCount(0);
});

test("shows playlist options above sidebar chrome", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("livingMusic:userState:v1", JSON.stringify({
    playlists: [{ id: "sidebar-playlist", name: "Sunday Music", createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", songIds: [] }],
  })));
  await page.goto("/#/browse");
  await page.getByRole("button", { name: "Options for Sunday Music" }).click();
  const menu = page.getByRole("menu", { name: "Options for Sunday Music" });
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((element) => ({
    parent: element.parentElement?.tagName,
    position: getComputedStyle(element).position,
    zIndex: Number(getComputedStyle(element).zIndex),
  }))).toEqual({ parent: "BODY", position: "fixed", zIndex: 90 });
});

test("opens dedicated Settings from the sidebar and mobile header", async ({ page }) => {
  await page.goto("/#/browse");
  const desktopSettings = page.locator(".sidebar-settings-button");
  await expect(desktopSettings).toBeVisible();
  await desktopSettings.click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Appearance" })).toBeVisible();
  await expect(desktopSettings).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/browse");
  const mobileSettings = page.locator(".mobile-settings-button");
  await expect(mobileSettings).toBeVisible();
  const mobileNavigation = page.locator(".mobile-navigation");
  await expect(mobileNavigation).toBeVisible();
  expect((await mobileNavigation.boundingBox())?.height).toBeLessThanOrEqual(62);
  await mobileSettings.click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Local data" })).toBeVisible();
});

test("exports, clears, and restores listener data", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("livingMusic:userState:v1", JSON.stringify({
    favorites: ["offline-song"],
    favoriteAddedAt: { "offline-song": "2026-09-01T12:00:00.000Z" },
    librarySongs: ["offline-song"],
    librarySongAddedAt: { "offline-song": "2026-09-01T12:00:00.000Z" },
  })));
  await page.goto("/#/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear local data" }).click();
  await expect(page.getByText("Local listener data was cleared.", { exact: true })).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/library/songs"; });
  await expect(page.getByRole("heading", { name: "Add songs to your Library." })).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/settings"; });
  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  await expect(page.getByText("Backup restored.", { exact: true })).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/library/songs"; });
  await expect(page.getByText("Offline Song", { exact: true })).toBeVisible();
});

test("offers the captured browser install prompt from Settings", async ({ page }) => {
  await page.goto("/#/settings");
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
  await page.goto("/#/settings");
  await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
  await expect(page.getByText("Living Music is installed on this device.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Local data" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Install", exact: true })).toHaveCount(0);
});


test("downloads, seeks, plays, and removes a recording offline without removing it from Library", async ({ page, context }) => {
  await page.goto("/#/collection/offline-hymns");
  await waitForControl(page);
  const songButton = page.getByRole("button", { name: "Play Offline Song" });
  await expect(songButton).toBeVisible();
  await page.getByRole("button", { name: /^Download Offline Song\./ }).click();
  const downloadedStatus = page.getByRole("button", { name: /^Delete download for Offline Song\./ });
  await expect(downloadedStatus).toBeVisible();
  await expect(downloadedStatus).toHaveClass(/is-downloaded/);
  expect(await downloadedStatus.evaluate((element) => element.parentElement?.className)).toBe("song-row-actions");

  await context.setOffline(true);
  const range = await page.evaluate(async () => {
    const response = await fetch("/musicapi/offline.wav", { headers: { Range: "bytes=44-87" } });
    return { status: response.status, length: (await response.arrayBuffer()).byteLength, range: response.headers.get("content-range") };
  });
  expect(range).toEqual({ status: 206, length: 44, range: "bytes 44-87/32044" });

  await page.evaluate(() => { window.location.hash = "#/library/downloaded"; });
  await expect(page.getByRole("heading", { name: "Downloaded", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Play Offline Song" }).click();
  await expect(page.getByRole("button", { name: "Open Now Playing" })).toBeVisible();
  const seek = page.getByRole("slider", { name: "Playback position" });
  await expect(seek).toBeEnabled();
  await seek.fill("1");
  await expect(seek).toHaveAttribute("aria-valuetext", /0:01 of 0:02/);

  await page.getByRole("button", { name: /^Delete download for Offline Song\./ }).click();
  await expect(page.getByRole("heading", { name: "Download music for offline listening." })).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/library/songs"; });
  await expect(page.getByRole("button", { name: "Play Offline Song" })).toBeVisible();
});


test("downloads a playlist and advances through it while offline", async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem("livingMusic:userState:v1", JSON.stringify({
    playlists: [{ id: "offline-playlist", name: "Offline Playlist", createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", songIds: ["offline-song", "offline-song-two"] }],
  })));
  await page.goto("/#/playlist/offline-playlist");
  await waitForControl(page);
  await expect(page.getByRole("heading", { name: "Offline Playlist" })).toBeVisible();
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await expect(page.locator(".download-status.is-downloaded")).toHaveCount(2);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Open Now Playing" })).toContainText("Offline Song");
  await expect(page.getByRole("button", { name: "Open Now Playing" })).toContainText("Second Offline Song", { timeout: 7000 });
});

test("keeps listener data intact when quota prevents a download", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, "estimate", { configurable: true, value: async () => ({ usage: 9, quota: 10 }) });
  });
  await page.goto("/#/collection/offline-hymns");
  await page.getByRole("button", { name: "Play Offline Song" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Download", exact: true }).click();
  await expect(page.getByText("This device does not have enough browser storage for that recording.", { exact: true })).toBeVisible();
  await page.evaluate(() => { window.location.hash = "#/library/songs"; });
  await expect(page.getByRole("button", { name: "Play Offline Song" })).toBeVisible();
});

test("marks interrupted downloads as failed and retryable after restart", async ({ page }) => {
  await page.goto("/#/collection/offline-hymns");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("livingMusic", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("downloads", "readwrite");
      transaction.objectStore("downloads").put({
        recordingId: "offline-recording", songId: "offline-song", collectionId: "offline-hymns",
        songTitle: "Offline Song", collectionTitle: "Offline Hymns", recordingLabel: "Vocal",
        sourceUrl: "http://127.0.0.1:4173/musicapi/offline.wav", status: "downloading", bytesReceived: 100,
      });
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();
  await page.getByRole("button", { name: "Play Offline Song" }).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Retry Download" })).toBeVisible();
  await expect(page.locator(".download-status.is-failed")).toBeVisible();
});


test("marks changed catalog sources stale and lets the listener update them", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const oldUrl = "http://127.0.0.1:4173/musicapi/old-offline.wav";
    const cache = await caches.open("living-music-downloads-v1");
    await cache.put(oldUrl, new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/wav" } }));
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("livingMusic", 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("downloads", "readwrite");
      transaction.objectStore("downloads").put({
        recordingId: "offline-recording", songId: "offline-song", collectionId: "offline-hymns",
        songTitle: "Offline Song", collectionTitle: "Offline Hymns", recordingLabel: "Vocal",
        sourceUrl: oldUrl, status: "downloaded", bytesReceived: 3, totalBytes: 3, downloadedAt: "2026-09-01T12:00:00.000Z",
      });
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.goto("/?stale=1#/collection/offline-hymns");
  await expect(page.locator(".download-status.is-stale").first()).toBeVisible();
  await page.getByRole("button", { name: "Play Offline Song" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Update Download" }).click();
  await expect(page.locator(".download-status.is-downloaded").first()).toBeVisible();
});

test.describe("batch download queue", () => {
  test.use({ serviceWorkers: "block" });

  test("shows one active transfer, distinguishes queued songs, and cancels a queued item", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("livingMusic:userState:v1", JSON.stringify({
      playlists: [{ id: "queue-playlist", name: "Queue Playlist", createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", songIds: ["offline-song", "offline-song-two"] }],
    })));
    await page.route("**/musicapi/offline.wav", async (route) => {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 900));
      await route.continue();
    });
    await page.goto("/#/playlist/queue-playlist");
    await page.getByRole("button", { name: "Download", exact: true }).click();

    await expect(page.getByRole("button", { name: /^Cancel download for Offline Song\./ })).toBeVisible();
    const queued = page.getByRole("button", { name: /^Cancel queued download for Second Offline Song\./ });
    await expect(queued).toBeVisible();
    await expect(page.getByRole("button", { name: "Downloading..." })).toBeDisabled();

    await queued.click();
    await expect(page.getByRole("button", { name: /^Download Second Offline Song\./ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Delete download for Offline Song\./ })).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: /^Download Second Offline Song\./ })).toBeVisible();
  });
});
