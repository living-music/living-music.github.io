import { expect, test } from "@playwright/test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateServiceWorker } from "../../scripts/generate-service-worker.mjs";
import { dist, manifest, removeCatalogFixture, writeCatalogFixture } from "./catalog-fixture";

async function waitForControl(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

test.beforeAll(writeCatalogFixture);
test.afterAll(removeCatalogFixture);

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

test("isolates the desktop sidebar material and honors reduced transparency", async ({ page }) => {
  await page.goto("/#/browse");
  const sidebar = page.locator(".sidebar");
  await expect(sidebar).toHaveClass(/glass-surface--regular/);

  const material = await sidebar.evaluate((element) => {
    const root = getComputedStyle(document.documentElement);
    const surface = getComputedStyle(element);
    const layer = getComputedStyle(element, "::before");
    const firstChild = getComputedStyle(element.firstElementChild!);
    return {
      variants: ["regular", "clear", "subdued"].map((variant) => ({
        tint: root.getPropertyValue(`--glass-tint-${variant}`).trim(),
        fallback: root.getPropertyValue(`--glass-fallback-${variant}`).trim(),
      })),
      surfaceBackground: surface.backgroundColor,
      layerBackground: layer.backgroundColor,
      layerBoxShadow: layer.boxShadow,
      enhancedSupport: CSS.supports("(backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))"),
      pointerEvents: layer.pointerEvents,
      childZIndex: firstChild.zIndex,
    };
  });
  expect(new Set(material.variants.map((variant) => variant.tint)).size).toBe(3);
  expect(new Set(material.variants.map((variant) => variant.fallback)).size).toBe(3);
  expect(material.surfaceBackground).toBe("rgba(0, 0, 0, 0)");
  expect(material.layerBackground).toBe("rgba(24, 24, 28, 0.66)");
  expect(material.layerBoxShadow).toBe("none");
  expect(material.enhancedSupport).toBe(true);
  expect(material.pointerEvents).toBe("none");
  expect(material.childZIndex).toBe("1");

  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  await expect.poll(() => sidebar.evaluate((element) => {
    const layer = getComputedStyle(element, "::before");
    return {
      background: layer.backgroundColor,
      filters: [layer.backdropFilter, layer.getPropertyValue("-webkit-backdrop-filter")]
        .map((filter) => filter || "none"),
    };
  })).toEqual({ background: "rgb(24, 24, 28)", filters: ["none", "none"] });
});

test("floats persistent mobile chrome while keeping content reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/collection/offline-hymns");
  await page.getByRole("button", { name: "Play Offline Song" }).click();

  const header = page.locator(".mobile-header");
  const navigation = page.locator(".mobile-navigation");
  const miniPlayer = page.locator(".mini-player");
  await expect(header).toHaveClass(/glass-surface--regular/);
  await expect(navigation).toHaveClass(/glass-surface--clear/);
  await expect(miniPlayer).toHaveClass(/glass-surface--regular/);
  await expect.poll(async () => {
    const [navigationBounds, playerBounds] = await Promise.all([
      navigation.boundingBox(),
      miniPlayer.boundingBox(),
    ]);
    return (navigationBounds?.y ?? 0) - ((playerBounds?.y ?? 0) + (playerBounds?.height ?? 0));
  }).toBeGreaterThanOrEqual(7);

  const [headerBox, navigationBox, playerBox] = await Promise.all([
    header.boundingBox(),
    navigation.boundingBox(),
    miniPlayer.boundingBox(),
  ]);
  expect(headerBox?.height).toBeLessThanOrEqual(58);
  expect(navigationBox?.height).toBeLessThanOrEqual(62);
  expect(playerBox?.height).toBeLessThanOrEqual(58);
  expect(navigationBox?.x).toBeGreaterThanOrEqual(17);
  expect((navigationBox?.x ?? 0) + (navigationBox?.width ?? 0)).toBeLessThanOrEqual(373);
  expect(playerBox?.x).toBe(navigationBox?.x);
  expect(playerBox?.width).toBe(navigationBox?.width);
  expect(844 - ((navigationBox?.y ?? 0) + (navigationBox?.height ?? 0))).toBeGreaterThanOrEqual(15);
  const artworkBox = await page.locator(".mini-artwork").boundingBox();
  expect((artworkBox?.x ?? 0) - (playerBox?.x ?? 0)).toBeGreaterThanOrEqual(15);
  expect((artworkBox?.x ?? 0) - (playerBox?.x ?? 0)).toBeLessThanOrEqual(17);
  expect(artworkBox?.width).toBeLessThanOrEqual(41);

  const capsuleShape = await Promise.all([navigation, miniPlayer].map((surface) => surface.evaluate((element) => ({
    radius: Number.parseFloat(getComputedStyle(element).borderRadius),
    height: element.getBoundingClientRect().height,
    edge: getComputedStyle(element, "::before").boxShadow,
    depth: getComputedStyle(element, "::before").backgroundImage,
    blur: getComputedStyle(element).getPropertyValue("--glass-material-blur").trim(),
  }))));
  expect(capsuleShape.every(({ radius, height }) => radius >= height / 2)).toBe(true);
  expect(capsuleShape.every(({ edge }) => edge.includes("0.5px") && edge.includes("1.25px 1.1px"))).toBe(true);
  expect(capsuleShape.every(({ edge }) => edge.includes("-1.25px 1.1px"))).toBe(true);
  expect(capsuleShape.every(({ edge }) => !edge.includes("0px 0px 0px 1px"))).toBe(true);
  expect(capsuleShape.every(({ depth }) => depth.match(/radial-gradient/g)?.length === 1 && depth.includes("linear-gradient"))).toBe(true);
  expect(capsuleShape.map(({ blur }) => blur)).toEqual(["22px", "18px"]);
  await expect(page.locator(".mini-progress")).toBeHidden();

  const contentPaddingBottom = await page.locator(".content").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).paddingBottom),
  );
  expect(contentPaddingBottom).toBeGreaterThan(
    (navigationBox?.height ?? 0) + (playerBox?.height ?? 0),
  );

  await page.setViewportSize({ width: 320, height: 700 });
  const [compactNavigationBox, compactPlayerBox] = await Promise.all([
    navigation.boundingBox(),
    miniPlayer.boundingBox(),
  ]);
  expect(compactNavigationBox?.x).toBeGreaterThanOrEqual(17);
  expect((compactNavigationBox?.x ?? 0) + (compactNavigationBox?.width ?? 0)).toBeLessThanOrEqual(303);
  expect(compactPlayerBox?.x).toBe(compactNavigationBox?.x);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Library", exact: true })).toBeVisible();

  const surfaces = await Promise.all([header, navigation, miniPlayer].map((surface) => surface.evaluate((element) => {
    const container = getComputedStyle(element);
    const layer = getComputedStyle(element, "::before");
    return {
      background: container.backgroundColor,
      material: layer.backgroundColor,
      pointerEvents: layer.pointerEvents,
      contentZIndex: getComputedStyle(element.firstElementChild!).zIndex,
    };
  })));
  expect(surfaces).toEqual([
    { background: "rgba(0, 0, 0, 0)", material: "rgba(24, 24, 28, 0.66)", pointerEvents: "none", contentZIndex: "1" },
    { background: "rgba(0, 0, 0, 0)", material: "rgba(18, 18, 22, 0.44)", pointerEvents: "none", contentZIndex: "1" },
    { background: "rgba(0, 0, 0, 0)", material: "rgba(24, 24, 28, 0.66)", pointerEvents: "none", contentZIndex: "1" },
  ]);

  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  await expect.poll(() => Promise.all([header, navigation, miniPlayer].map((surface) => surface.evaluate((element) => {
    const layer = getComputedStyle(element, "::before");
    return {
      background: layer.backgroundColor,
      filters: [layer.backdropFilter, layer.getPropertyValue("-webkit-backdrop-filter")]
        .map((filter) => filter || "none"),
    };
  })))).toEqual([
    { background: "rgb(24, 24, 28)", filters: ["none", "none"] },
    { background: "rgb(18, 18, 22)", filters: ["none", "none"] },
    { background: "rgb(24, 24, 28)", filters: ["none", "none"] },
  ]);
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
  const mobileHeader = page.locator(".mobile-header");
  await expect(mobileHeader).toBeVisible();
  expect((await mobileHeader.boundingBox())?.height).toBeLessThanOrEqual(58);
  const mobileNavigation = page.locator(".mobile-navigation");
  await expect(mobileNavigation).toBeVisible();
  expect((await mobileNavigation.boundingBox())?.height).toBeLessThanOrEqual(62);
  await mobileSettings.click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Local data" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
  await expect(page.getByText("0.1.0", { exact: true })).toBeVisible();
  await expect(page.locator(".settings-build-id")).toHaveText(/^[0-9a-f]{7}$/);
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

test("formats large storage quotas in GB and reports browser-managed protection", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, "estimate", {
      configurable: true,
      value: async () => ({ usage: 512 * 1024 * 1024, quota: 20 * 1024 * 1024 * 1024 }),
    });
    Object.defineProperty(navigator.storage, "persisted", {
      configurable: true,
      value: async () => false,
    });
  });
  await page.goto("/#/settings");
  await expect(page.getByText("512.0 MB of 20 GB", { exact: true })).toBeVisible();
  await expect(page.getByText("Browser managed", { exact: true })).toBeVisible();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => query === "(display-mode: standalone)"
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true }
      : original(query);
  });
  await page.goto("/#/settings");
  const standaloneHeader = page.locator(".mobile-header");
  await expect(page.locator(".app-shell")).toHaveClass(/is-ios-standalone/);
  await expect(standaloneHeader).toHaveClass(/is-standalone/);
  expect((await standaloneHeader.boundingBox())?.height).toBeGreaterThanOrEqual(71);
  await expect.poll(() => standaloneHeader.evaluate((element) => getComputedStyle(element).backdropFilter)).toBe("none");
  await expect.poll(() => standaloneHeader.evaluate((element) => getComputedStyle(element, "::before").content)).not.toBe("none");
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
