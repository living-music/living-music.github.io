import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectPrecacheEntries, generateServiceWorker, renderServiceWorker } from "./generate-service-worker.mjs";

describe("service worker generation", () => {
  it("content-addresses app assets and excludes maps and deployment files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "living-music-sw-"));
    await mkdir(join(directory, "assets"));
    await writeFile(join(directory, "index.html"), "<main>Living Music</main>");
    await writeFile(join(directory, "assets", "app.js"), "console.log('app')");
    await writeFile(join(directory, "assets", "app.js.map"), "{}");
    await writeFile(join(directory, ".nojekyll"), "");

    const first = await collectPrecacheEntries(directory);
    expect(first.map((entry) => entry.url)).toEqual(["/assets/app.js", "/"]);

    await writeFile(join(directory, "assets", "app.js"), "console.log('updated')");
    const second = await collectPrecacheEntries(directory);
    expect(second.find((entry) => entry.url === "/")?.cacheKey)
      .toBe(first.find((entry) => entry.url === "/")?.cacheKey);
    expect(second.find((entry) => entry.url === "/assets/app.js")?.cacheKey)
      .not.toBe(first.find((entry) => entry.url === "/assets/app.js")?.cacheKey);

    await generateServiceWorker(directory);
    const worker = await readFile(join(directory, "sw.js"), "utf8");
    expect(worker).toContain('SHELL_CACHE_NAME = SHELL_CACHE_PREFIX + "v2-');
    expect(worker).toContain("shellResponseMatches(prior, entry.revision)");
    expect(worker).toContain("fetch(requestFor(entry.cacheKey, { cache: \"reload\" }))");
    expect(worker).toContain("shellResponseMatches(response, entry.revision)");
    expect(worker).toContain("event.request.mode === \"navigate\"");
    expect(worker).not.toContain("app.js.map");
  });

  it("separates shell and catalog caches with safe catalog policies", () => {
    const worker = renderServiceWorker([{ url: "/", revision: "root", cacheKey: "/?__lm=root" }]);
    expect(worker).toContain('CATALOG_CACHE_NAME = CATALOG_CACHE_PREFIX + "v1"');
    expect(worker).toContain('CATALOG_MANIFEST_PATH = "/musicapi/index.json"');
    expect(worker).toContain("CATALOG_REVISIONS_PER_PATH = 2");
    expect(worker).toContain("name.startsWith(CATALOG_CACHE_PREFIX) && name !== CATALOG_CACHE_NAME");
    expect(worker).toContain("catalogManifestNetworkFirst(event.request)");
    expect(worker).toContain("catalogCacheFirst(event.request)");
    expect(worker).toContain("Catalog index has no search link");
    expect(worker).toContain("await cache.put(manifestKey, response.clone())");
    expect(worker).toContain("LIVING_MUSIC_CATALOG_FALLBACK");
    expect(worker).toContain('DOWNLOAD_CACHE_NAME = "living-music-downloads-v1"');
    expect(worker).toContain('const match = /^bytes=(\\d+)-(\\d*)$/');
    expect(worker).toContain('status: 206');
    expect(worker).toContain('ARTWORK_CACHE_NAME = "living-music-artwork-v1"');
  });

  it("waits for listener approval before activating an update", () => {
    const worker = renderServiceWorker([{ url: "/", revision: "root", cacheKey: "/?__lm=root" }]);
    expect(worker).toContain("LIVING_MUSIC_SKIP_WAITING");
    expect(worker).toContain("void self.skipWaiting()");
    expect(worker).not.toContain("await self.skipWaiting()");
    expect(() => new Function(worker)).not.toThrow();
  });
});
