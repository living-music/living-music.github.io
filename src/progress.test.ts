import { describe, expect, it } from "vitest";
import { projectedPlaybackTime } from "./progress";

describe("projectedPlaybackTime", () => {
  it("advances between authoritative media time updates", () => {
    expect(projectedPlaybackTime(12.25, 250, 60)).toBe(12.5);
  });

  it("clamps progress to the playable time range", () => {
    expect(projectedPlaybackTime(59.9, 500, 60)).toBe(60);
    expect(projectedPlaybackTime(-1, -500, 60)).toBe(0);
  });
});
