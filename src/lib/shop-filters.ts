// Price bands for the storefront price filter (amounts in naira, compared against the selling price).
export const PRICE_RANGES = [
  { value: "all", label: "Any price", min: null, max: null },
  { value: "under-500k", label: "Under ₦500,000", min: null, max: 500_000 },
  { value: "500k-1m", label: "₦500,000 – ₦1,000,000", min: 500_000, max: 1_000_000 },
  { value: "1m-3m", label: "₦1,000,000 – ₦3,000,000", min: 1_000_000, max: 3_000_000 },
  { value: "over-3m", label: "Over ₦3,000,000", min: 3_000_000, max: null },
] as const;

export type PriceRange = (typeof PRICE_RANGES)[number]["value"];

/** Lower bound is inclusive, upper bound is exclusive, so each price falls in exactly one band. */
export function inPriceRange(price: number | null, range: PriceRange): boolean {
  if (range === "all") return true;
  if (price == null) return false;
  const band = PRICE_RANGES.find((r) => r.value === range)!;
  if (band.min != null && price < band.min) return false;
  if (band.max != null && price >= band.max) return false;
  return true;
}
