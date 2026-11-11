import { describe, expect, it } from "vitest";

import { productInputSchema } from "@/lib/admin-schemas";
import { OrderError, priceOrder, toKobo, type CatalogEntry } from "@/lib/order-math";
import { checkTransaction, isValidPaystackSignature, paystackSignature } from "@/lib/paystack";
import { purchaseState, sellingPrice } from "@/lib/product-rules";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/store-settings";

const ID_A = "00000000-0000-4000-a000-0000000000aa";
const ID_B = "00000000-0000-4000-a000-0000000000bb";

function entry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: ID_A,
    name: "2.5 kVA Home Starter System",
    slug: "starter",
    sku: "RW-25",
    price: 2_150_000,
    salePrice: null,
    quoteOnly: false,
    status: "published",
    trackStock: false,
    stockQuantity: 0,
    availability: "in_stock",
    installationFee: null,
    specs: {},
    featuredImage: null,
    ...over,
  };
}

const settings: StoreSettings = { ...DEFAULT_SETTINGS, deliveryEnabled: true, deliveryFee: 15_000, pickupEnabled: true, pickupAddress: "RUWATA office, Abuja" };
const delivery = { deliveryMethod: "delivery" as const, installation: false };

describe("selling price", () => {
  it("uses the sale price when it is below the regular price", () => {
    expect(sellingPrice({ price: 2_150_000, salePrice: 1_950_000, quoteOnly: false })).toBe(1_950_000);
  });
  it("ignores the old quote-only flag: a priced product always has a selling price", () => {
    expect(sellingPrice({ price: 500_000, salePrice: null, quoteOnly: true })).toBe(500_000);
  });
});

describe("who can buy", () => {
  it("only lets published, priced, available products be bought", () => {
    expect(purchaseState(entry())).toBe("buy");
    expect(purchaseState(entry({ status: "draft" }))).toBe("unavailable");
    expect(purchaseState(entry({ status: "archived" }))).toBe("unavailable");
    expect(purchaseState(entry({ quoteOnly: true }))).toBe("buy");
    expect(purchaseState(entry({ price: null }))).toBe("unavailable");
    expect(purchaseState(entry({ trackStock: true, stockQuantity: 0 }))).toBe("unavailable");
    expect(purchaseState(entry({ availability: "out_of_stock" }))).toBe("unavailable");
  });
});

describe("server pricing", () => {
  it("charges the catalogue's sale price, not a browser price, plus delivery", () => {
    const catalog = new Map([[ID_A, entry({ salePrice: 1_950_000 })]]);
    const r = priceOrder([{ productId: ID_A, quantity: 2 }], catalog, delivery, settings);
    expect(r.subtotal).toBe(3_900_000);
    expect(r.deliveryFee).toBe(15_000);
    expect(r.total).toBe(3_915_000);
  });

  it("charges no delivery fee for pickup", () => {
    const catalog = new Map([[ID_A, entry()]]);
    const r = priceOrder([{ productId: ID_A, quantity: 1 }], catalog, { deliveryMethod: "pickup", installation: false }, settings);
    expect(r.deliveryFee).toBe(0);
    expect(r.total).toBe(2_150_000);
  });

  it("adds installation only for products that offer it and don't already include it", () => {
    const catalog = new Map([
      [ID_A, entry({ installationFee: 120_000 })],
      [ID_B, entry({ id: ID_B, installationFee: 80_000, specs: { installationIncluded: true } })],
    ]);
    const r = priceOrder(
      [{ productId: ID_A, quantity: 1 }, { productId: ID_B, quantity: 1 }],
      catalog,
      { deliveryMethod: "pickup", installation: true },
      settings,
    );
    expect(r.installationFee).toBe(120_000);
  });

  it("refuses products without a price and quantities above tracked stock", () => {
    expect(() => priceOrder([{ productId: ID_A, quantity: 1 }], new Map([[ID_A, entry({ price: null })]]), delivery, settings)).toThrow(OrderError);
    expect(() =>
      priceOrder([{ productId: ID_A, quantity: 3 }], new Map([[ID_A, entry({ trackStock: true, stockQuantity: 2 })]]), delivery, settings),
    ).toThrow(/Only 2/);
  });

  it("converts naira totals to kobo exactly", () => {
    expect(toKobo(1_950_000)).toBe(195_000_000);
    expect(toKobo(0.1 + 0.2)).toBe(30);
  });
});

describe("product form rules", () => {
  const base = {
    name: "Lithium Battery 5 kWh", slug: "lithium-battery-5-kwh", sku: "", categoryId: null, shortDescription: "", description: "",
    quoteOnly: false, price: 1_100_000, salePrice: null, installationFee: null, featuredImage: null, gallery: [], features: [],
    specs: {}, badge: null, trackStock: false, stockQuantity: 0, availability: "in_stock", isFeatured: false, status: "draft", sortOrder: 0,
  };
  it("rejects a sale price that isn't below the regular price", () => {
    expect(productInputSchema.safeParse({ ...base, salePrice: 1_100_000 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, salePrice: 1_000_000 }).success).toBe(true);
  });
  it("always needs a price (there is no quote-only option)", () => {
    expect(productInputSchema.safeParse({ ...base, price: null }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, price: null, quoteOnly: true }).success).toBe(false);
  });
});

describe("Paystack", () => {
  it("accepts only correctly signed webhooks", async () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "RW-1001-abc" } });
    const sig = await paystackSignature(body, "sk_test_secret");
    expect(await isValidPaystackSignature(body, sig, "sk_test_secret")).toBe(true);
    expect(await isValidPaystackSignature(body, sig, "sk_test_other")).toBe(false);
    expect(await isValidPaystackSignature(body + " ", sig, "sk_test_secret")).toBe(false);
    expect(await isValidPaystackSignature(body, null, "sk_test_secret")).toBe(false);
  });

  it("marks paid only when reference, amount and currency all match", () => {
    const expected = { reference: "RW-1001-abc", amountKobo: 195_000_000 };
    expect(checkTransaction({ status: "success", reference: "RW-1001-abc", amount: 195_000_000, currency: "NGN" }, expected)).toBe("paid");
    expect(checkTransaction({ status: "success", reference: "RW-1001-abc", amount: 100, currency: "NGN" }, expected)).toBe("mismatch");
    expect(checkTransaction({ status: "success", reference: "RW-1001-abc", amount: 195_000_000, currency: "USD" }, expected)).toBe("mismatch");
    expect(checkTransaction({ status: "success", reference: "RW-9999", amount: 195_000_000, currency: "NGN" }, expected)).toBe("mismatch");
    expect(checkTransaction({ status: "failed", reference: "RW-1001-abc", amount: 195_000_000, currency: "NGN" }, expected)).toBe("failed");
    expect(checkTransaction({ status: "abandoned", reference: "RW-1001-abc", amount: 195_000_000, currency: "NGN" }, expected)).toBe("abandoned");
  });
});
