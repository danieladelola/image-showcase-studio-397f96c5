import { describe, expect, it } from "vitest";
import { isStaleChunkError } from "@/lib/stale-chunk";

describe("isStaleChunkError", () => {
  it("recognises a missing page file after a new deploy", () => {
    expect(
      isStaleChunkError(
        new TypeError(
          "Failed to fetch dynamically imported module: https://x.lovable.app/assets/our-products-BTaJXfqE.js",
        ),
      ),
    ).toBe(true);
  });

  it("ignores ordinary errors", () => {
    expect(isStaleChunkError(new Error("Product not found"))).toBe(false);
  });
});
