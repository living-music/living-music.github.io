import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { removeCatalogFixture, writeCatalogFixture } from "./catalog-fixture";

const capture = process.env.LM_CAPTURE_BASELINE === "1";
const outputDirectory = resolve("docs/baselines/7279cca");
const playlistState = {
  playlists: [{
    id: "baseline-playlist",
    name: "Sunday Music",
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    songIds: ["offline-song", "offline-song-two"],
  }],
  favorites: ["offline-song"],
  favoriteAddedAt: { "offline-song": "2026-09-01T12:00:00.000Z" },
  librarySongs: ["offline-song", "offline-song-two"],
  librarySongAddedAt: {
    "offline-song": "2026-09-01T12:00:00.000Z",
    "offline-song-two": "2026-09-02T12:00:00.000Z",
  },
};

async function preparePage(page: Page, standalone = false): Promise<void> {
  await page.addInitScript(({ state, installed }) => {
    localStorage.setItem("livingMusic:userState:v1", JSON.stringify(state));
    if (installed) {
      Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => query === "(display-mode: standalone)"
        ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true }
        : original(query);
    }
  }, { state: playlistState, installed: standalone });
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  const dismiss = page.locator(".app-status-dismiss");
  if (await dismiss.isVisible()) await dismiss.click();
}

async function screenshot(page: Page, name: string): Promise<void> {
  await settle(page);
  await page.screenshot({ path: resolve(outputDirectory, name), animations: "disabled" });
}

async function layoutRecord(page: Page, mode: string): Promise<Record<string, unknown>> {
  return page.evaluate((captureMode) => {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.append(probe);
    const probeStyle = getComputedStyle(probe);
    const rectangle = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element || getComputedStyle(element).display === "none") return null;
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const before = getComputedStyle(element, "::before");
      return {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
        position: style.position,
        zIndex: style.zIndex,
        background: style.backgroundColor,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
        before: {
          content: before.content,
          background: before.backgroundColor,
          backdropFilter: before.backdropFilter || before.webkitBackdropFilter,
        },
      };
    };
    const scrollers = [document.documentElement, document.body, document.querySelector<HTMLElement>(".content")]
      .filter((element): element is HTMLElement => Boolean(element))
      .map((element) => ({
        element: element === document.documentElement ? "html" : element === document.body ? "body" : ".content",
        overflowY: getComputedStyle(element).overflowY,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
    const result = {
      mode: captureMode,
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      standalone: document.querySelector(".app-shell")?.classList.contains("is-ios-standalone") ?? false,
      scrollingElement: document.scrollingElement === document.documentElement ? "html" : "body",
      safeAreaInsets: {
        top: Number.parseFloat(probeStyle.paddingTop),
        right: Number.parseFloat(probeStyle.paddingRight),
        bottom: Number.parseFloat(probeStyle.paddingBottom),
        left: Number.parseFloat(probeStyle.paddingLeft),
      },
      scrollers,
      chrome: {
        sidebar: rectangle(".sidebar"),
        header: rectangle(".mobile-header"),
        miniPlayer: rectangle(".mini-player"),
        navigation: rectangle(".mobile-navigation"),
      },
    };
    probe.remove();
    return result;
  }, mode);
}

test.describe("Liquid Glass visual baseline", () => {
  test.skip(!capture, "Run npm run baseline:visual to refresh committed Stage 0 references.");
  test.beforeAll(async () => {
    await mkdir(outputDirectory, { recursive: true });
    await writeCatalogFixture();
  });
  test.afterAll(removeCatalogFixture);

  test("captures desktop navigation and player surfaces", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await preparePage(page);

    await page.goto("/#/browse");
    await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
    await screenshot(page, "chromium-desktop-browse.png");

    await page.goto("/#/collection/offline-hymns");
    await expect(page.getByRole("heading", { name: "Offline Hymns" })).toBeVisible();
    await page.getByRole("button", { name: "Play Offline Song" }).click();
    await expect(page.getByRole("button", { name: "Open Now Playing" })).toBeVisible();
    await screenshot(page, "chromium-desktop-album-player.png");

    await page.goto("/#/playlist/baseline-playlist");
    await expect(page.getByRole("heading", { name: "Sunday Music" })).toBeVisible();
    await screenshot(page, "chromium-desktop-playlist.png");

    await writeFile(
      resolve(outputDirectory, "chromium-desktop-layout.json"),
      JSON.stringify(await layoutRecord(page, "desktop-browser"), null, 2) + "\n",
    );
  });

  test("captures mobile browser chrome with and without playback", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparePage(page);

    await page.goto("/#/browse");
    await expect(page.getByRole("heading", { name: "Browse" })).toBeVisible();
    await screenshot(page, "chromium-mobile-browser-browse.png");

    await page.goto("/#/collection/offline-hymns");
    await page.getByRole("button", { name: "Play Offline Song" }).click();
    await expect(page.getByRole("button", { name: "Open Now Playing" })).toBeVisible();
    await screenshot(page, "chromium-mobile-browser-player.png");

    await writeFile(
      resolve(outputDirectory, "chromium-mobile-browser-layout.json"),
      JSON.stringify(await layoutRecord(page, "mobile-browser"), null, 2) + "\n",
    );
  });

  test("captures installed mobile Settings and Now Playing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparePage(page, true);

    await page.goto("/#/settings");
    await expect(page.locator(".app-shell")).toHaveClass(/is-ios-standalone/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await screenshot(page, "chromium-mobile-installed-settings.png");
    await writeFile(
      resolve(outputDirectory, "chromium-mobile-installed-layout.json"),
      JSON.stringify(await layoutRecord(page, "mobile-installed-emulation"), null, 2) + "\n",
    );

    await page.goto("/#/collection/offline-hymns");
    await page.getByRole("button", { name: "Play Offline Song" }).click();
    await expect(page.getByRole("button", { name: "Open Now Playing" })).toBeVisible();
    await screenshot(page, "chromium-mobile-installed-player.png");
    await writeFile(
      resolve(outputDirectory, "chromium-mobile-installed-player-layout.json"),
      JSON.stringify(await layoutRecord(page, "mobile-installed-emulation-with-player"), null, 2) + "\n",
    );

    await page.getByRole("button", { name: "Open Now Playing" }).click();
    await expect(page.getByRole("dialog", { name: "Now Playing" })).toBeVisible();
    await screenshot(page, "chromium-mobile-installed-now-playing.png");
  });
});
