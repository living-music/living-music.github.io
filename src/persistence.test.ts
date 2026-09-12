import { describe, expect, it } from "vitest";
import { exportUserState, importUserState } from "./persistence";
import { EMPTY_USER_STATE } from "./storage";
describe("listener data backups", () => {
  it("round trips listener state through a versioned backup", () => {
    const state = { ...EMPTY_USER_STATE, favorites: ["song:one"], librarySongs: ["song:one"] };
    const backup = exportUserState(state, "2026-09-11T12:00:00.000Z");
    expect(JSON.parse(backup)).toMatchObject({ format: "living-music-user-data", version: 1, exportedAt: "2026-09-11T12:00:00.000Z" });
    expect(importUserState(backup)).toMatchObject({ favorites: ["song:one"], librarySongs: ["song:one"] });
  });
  it("rejects malformed and unsupported backups", () => {
    expect(() => importUserState("not json")).toThrow("valid JSON");
    expect(() => importUserState(JSON.stringify({ format: "something-else", version: 1 }))).toThrow("not supported");
  });
});
