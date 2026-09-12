import manifestText from "../public/manifest.webmanifest?raw";
import { describe, expect, it } from "vitest";

describe("web app manifest", () => {
  const manifest = JSON.parse(manifestText);
  it("provides install metadata, dedicated icon purposes, shortcuts, and screenshots", () => {
    expect(manifest.start_url).toBe("/#/browse");
    expect(manifest.lang).toBe("en-US");
    expect(manifest.icons.map((icon: { purpose: string }) => icon.purpose)).toEqual(expect.arrayContaining(["any", "maskable", "monochrome"]));
    expect(manifest.shortcuts.map((shortcut: { name: string }) => shortcut.name)).toEqual(["Browse", "Search", "Favorites", "Playlists"]);
    expect(manifest.screenshots.map((shot: { form_factor: string }) => shot.form_factor)).toEqual(["wide", "narrow"]);
  });
});
