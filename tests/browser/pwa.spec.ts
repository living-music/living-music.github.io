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
