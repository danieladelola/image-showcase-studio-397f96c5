import { describe, expect, it } from "vitest";

import { inPriceRange } from "@/lib/shop-filters";

describe("shop price filter", () => {
  it("shows everything for Any price", () => {
    expect(inPriceRange(6_800_000, "all")).toBe(true);
  });
  it("puts ₦485,000 under ₦500,000 and ₦500,000 in the next band", () => {
    expect(inPriceRange(485_000, "under-500k")).toBe(true);
    expect(inPriceRange(500_000, "under-500k")).toBe(false);
    expect(inPriceRange(500_000, "500k-1m")).toBe(true);
  });
  it("puts ₦1,100,000 in ₦1M–₦3M and ₦6,800,000 over ₦3M", () => {
    expect(inPriceRange(1_100_000, "1m-3m")).toBe(true);
    expect(inPriceRange(6_800_000, "over-3m")).toBe(true);
    expect(inPriceRange(6_800_000, "1m-3m")).toBe(false);
  });
});
