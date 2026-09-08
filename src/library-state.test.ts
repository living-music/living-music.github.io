import { describe, expect, it } from "vitest";
import { toggleFavoriteInState } from "./library-state";
import { EMPTY_USER_STATE } from "./storage";

const timestamp = "2026-09-07T12:00:00.000Z";

describe("favorite membership", () => {
  it("adds a newly favorited song to Favorites and Library with the same timestamp", () => {
    const state = toggleFavoriteInState(EMPTY_USER_STATE, "song:one", timestamp);
    expect(state.favorites).toEqual(["song:one"]);
    expect(state.favoriteAddedAt).toEqual({ "song:one": timestamp });
    expect(state.librarySongs).toEqual(["song:one"]);
    expect(state.librarySongAddedAt).toEqual({ "song:one": timestamp });
  });

  it("keeps an existing Library timestamp when the song is later favorited", () => {
    const state = toggleFavoriteInState({
      ...EMPTY_USER_STATE,
      librarySongs: ["song:one"],
      librarySongAddedAt: { "song:one": "2026-09-01T12:00:00.000Z" },
    }, "song:one", timestamp);
    expect(state.librarySongAddedAt).toEqual({ "song:one": "2026-09-01T12:00:00.000Z" });
  });

  it("removes a favorite without removing its Library membership", () => {
    const added = toggleFavoriteInState(EMPTY_USER_STATE, "song:one", timestamp);
    const removed = toggleFavoriteInState(added, "song:one", "2026-09-08T12:00:00.000Z");
    expect(removed.favorites).toEqual([]);
    expect(removed.favoriteAddedAt).toEqual({});
    expect(removed.librarySongs).toEqual(["song:one"]);
    expect(removed.librarySongAddedAt).toEqual({ "song:one": timestamp });
  });
});
