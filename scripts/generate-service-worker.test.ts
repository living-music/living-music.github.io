import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectPrecacheEntries, generateServiceWorker } from "./generate-service-worker.mjs";

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
    expect(worker).toContain("living-music-shell-");
    expect(worker).toContain("event.request.mode === \"navigate\"");
    expect(worker).not.toContain("app.js.map");
  });
});
