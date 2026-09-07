import { describe, expect, it } from "vitest";
import { hrefFor, routeFromHash } from "./router";

describe("routeFromHash", () => {
  it("reads supported top-level routes", () => {
    expect(routeFromHash("#/browse")).toBe("browse");
    expect(routeFromHash("#search")).toBe("search");
  });

  it("falls back to home for empty or unknown routes", () => {
    expect(routeFromHash("")).toBe("home");
    expect(routeFromHash("#/unknown")).toBe("home");
  });
});

describe("hrefFor", () => {
  it("creates GitHub Pages-safe hash links", () => {
    expect(hrefFor("library")).toBe("#/library");
  });
});
