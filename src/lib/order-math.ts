// Server-authoritative checkout pricing, shared by checkout (server) and tests.
import { maxOrderQty, purchaseState, sellingPrice } from "./product-rules";
import type { Product } from "./shop-types";
import type { StoreSettings } from "./store-settings";

export { MAX_QTY_PER_LINE } from "./product-rules";

export type CatalogEntry = Pick<
  Product,
  "id" | "name" | "slug" | "sku" | "price" | "salePrice" | "quoteOnly" | "status" | "trackStock" | "stockQuantity" | "availability" | "installationFee" | "specs" | "featuredImage"
>;

export type RequestedLine = { productId: string; quantity: number };
export type DeliveryMethod = "delivery" | "pickup";
export type CheckoutOptions = { deliveryMethod: DeliveryMethod; installation: boolean };

export class OrderError extends Error {}

/** Installation can be added for a product when it has an installation fee and doesn't already include it. */
export function installationFeeFor(p: Pick<CatalogEntry, "installationFee" | "specs">) {
  if (p.specs.installationIncluded) return null;
  return p.installationFee;
}

/**
 * Prices an order from the catalogue's current prices and the store settings — never from
 * prices sent by the browser. Duplicate lines for the same product are merged.
 */
export function priceOrder(lines: RequestedLine[], catalog: Map<string, CatalogEntry>, options: CheckoutOptions, settings: StoreSettings) {
  if (lines.length === 0) throw new OrderError("Your cart is empty.");
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.productId, (merged.get(l.productId) ?? 0) + l.quantity);

  const items = [...merged].map(([productId, quantity]) => {
    const p = catalog.get(productId);
    if (!p) throw new OrderError("A product in your cart is no longer available.");
    const state = purchaseState(p);
    if (state === "unavailable") throw new OrderError(`${p.name} is not available right now.`);
    const max = maxOrderQty(p);
    if (!Number.isInteger(quantity) || quantity < 1) throw new OrderError("Quantity must be at least 1.");
    if (quantity > max) throw new OrderError(`Only ${max} of ${p.name} can be ordered right now.`);
    const unitPrice = sellingPrice(p)!;
    const unitInstall = options.installation ? (installationFeeFor(p) ?? 0) : 0;
    return {
      productId,
      productName: p.name,
      sku: p.sku,
      imageUrl: p.featuredImage?.url ?? null,
      regularPrice: p.price!,
      unitPrice,
      quantity,
      lineTotal: unitPrice * quantity,
      installationFee: unitInstall * quantity,
    };
  });

  if (options.deliveryMethod === "pickup" && !settings.pickupEnabled) throw new OrderError("Pickup isn't available. Please choose delivery.");
  if (options.deliveryMethod === "delivery" && !settings.deliveryEnabled) throw new OrderError("Delivery isn't available. Please choose pickup.");

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  const deliveryFee = options.deliveryMethod === "delivery" ? settings.deliveryFee : 0;
  const installationFee = items.reduce((sum, i) => sum + i.installationFee, 0);
  const total = subtotal + deliveryFee + installationFee;
  return { items, subtotal, deliveryFee, installationFee, total };
}

/** Naira to kobo for Paystack, avoiding floating-point drift. */
export const toKobo = (amount: number) => Math.round(amount * 100);
