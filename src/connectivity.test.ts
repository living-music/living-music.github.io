import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogClientError, catalogFailure, deviceIsOffline } from "./connectivity";

afterEach(() => vi.unstubAllGlobals());

describe("catalog connectivity failures", () => {
  it("preserves explicit catalog failure kinds", () => {
    const failure = catalogFailure(
      new CatalogClientError("unsupported", "A newer app is required."),
      "fallback",
    );
    expect(failure).toEqual({ kind: "unsupported", message: "A newer app is required." });
  });

  it("classifies unknown failures using device connectivity", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(deviceIsOffline()).toBe(true);
    expect(catalogFailure(new TypeError("Failed to fetch"), "fallback")).toEqual({
      kind: "offline",
      message: "Failed to fetch",
    });
  });
});
