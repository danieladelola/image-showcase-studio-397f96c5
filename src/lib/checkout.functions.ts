import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { checkoutSchema, quoteSchema } from "./checkout-schema";
import type { Product } from "./shop-types";

async function loadCatalog(ids: string[]) {
  const { withDb } = await import("./db.server");
  const { PRODUCT_COLUMNS, mapProduct, loadSettings } = await import("./catalog.server");
  return withDb(async (sql) => {
    const rows = await sql.unsafe(`SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ANY($1::uuid[])`, [ids]);
    const products = rows.map(mapProduct) as Product[];
    return { catalog: new Map(products.map((p) => [p.id, p])), settings: await loadSettings(sql) };
  });
}

/** Store options for checkout: delivery/pickup, and whether online payment is switched on. */
export const getCheckoutConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { withDb } = await import("./db.server");
  const { loadSettings } = await import("./catalog.server");
  const { paystackSecret } = await import("./payments.server");
  const { paystackMode } = await import("./paystack");
  const settings = await withDb(loadSettings);
  return { settings, paymentsEnabled: !!paystackSecret(), paymentMode: paystackMode(paystackSecret()) };
});

/** Current products for the lines in a cart, so checkout always shows live prices and stock. */
export const getCartProducts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ ids: z.array(z.string().uuid()).max(50), slug: z.string().max(200).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { PRODUCT_COLUMNS, mapProduct } = await import("./catalog.server");
    return withDb(async (sql) => {
      const rows = await sql.unsafe(
        `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.status = 'published' AND (p.id = ANY($1::uuid[]) OR p.slug = $2)`,
        [data.ids, data.slug ?? ""],
      );
      return rows.map(mapProduct) as Product[];
    });
  });

/** Server-calculated totals for the review step. */
export const quoteCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => quoteSchema.parse(input))
  .handler(async ({ data }) => {
    const { priceOrder, OrderError } = await import("./order-math");
    try {
      const { catalog, settings } = await loadCatalog(data.items.map((i) => i.productId));
      return { ok: true as const, ...priceOrder(data.items, catalog, data.options, settings) };
    } catch (e) {
      if (e instanceof OrderError) return { ok: false as const, message: e.message };
      throw e;
    }
  });

/** Saves the order (with price snapshots) and then opens a Paystack payment for its total. */
export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { priceOrder, OrderError, toKobo } = await import("./order-math");
    const { paystackSecret, siteOrigin, startPayment } = await import("./payments.server");
    const { randomToken, sha256Hex } = await import("./password");
    if (!paystackSecret()) return { ok: false as const, message: "Online payment isn't available yet. Please contact us to complete your order." };
    try {
      const { catalog, settings } = await loadCatalog(data.items.map((i) => i.productId));
      const priced = priceOrder(data.items, catalog, data.options, settings);
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const order = await withDb((sql) =>
        sql.begin(async (tx) => {
          const [o] = await tx`
            INSERT INTO orders (customer_name, phone, email, address, city, state, notes, payment_method, payment_status,
              delivery_method, delivery_fee, installation_requested, installation_fee, subtotal, total, access_token_hash)
            VALUES (${data.customerName}, ${data.phone}, ${data.email}, ${data.address}, ${data.city}, ${data.state},
              ${data.notes || null}, 'paystack', 'unpaid', ${data.options.deliveryMethod}, ${priced.deliveryFee},
              ${data.options.installation && priced.installationFee > 0}, ${priced.installationFee}, ${priced.subtotal}, ${priced.total}, ${tokenHash})
            RETURNING id, order_number`;
          for (const i of priced.items) {
            await tx`
              INSERT INTO order_items (order_id, product_id, product_name, sku, image_url, regular_price, unit_price, quantity, line_total, installation_fee)
              VALUES (${o!.id}, ${i.productId}, ${i.productName}, ${i.sku}, ${i.imageUrl}, ${i.regularPrice}, ${i.unitPrice}, ${i.quantity}, ${i.lineTotal}, ${i.installationFee})`;
          }
          return { id: String(o!.id), orderNumber: String(o!.order_number) };
        }),
      );
      const returnUrl = `${siteOrigin()}/order/${token}`;
      const pay = await startPayment({ id: order.id, orderNumber: order.orderNumber, email: data.email, amountKobo: toKobo(priced.total), returnUrl });
      if (!pay.ok) return { ok: false as const, message: pay.message, orderToken: token };
      return { ok: true as const, authorizationUrl: pay.authorizationUrl, orderToken: token };
    } catch (error) {
      if (error instanceof OrderError) return { ok: false as const, message: error.message };
      console.error("Order could not be saved.", error);
      return { ok: false as const, message: "We couldn't place your order just now. Please try again." };
    }
  });

const tokenSchema = z.object({ token: z.string().regex(/^[0-9a-f]{64}$/), reference: z.string().max(100).optional() });

/** Order confirmation for the customer, found by the private link from checkout. Verifies payment when needed. */
export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { sha256Hex } = await import("./password");
    const { confirmPayment } = await import("./payments.server");
    const hash = await sha256Hex(data.token);
    const load = () =>
      withDb(async (sql) => {
        const [o] = await sql`SELECT * FROM orders WHERE access_token_hash = ${hash}`;
        if (!o) return null;
        const items = await sql`SELECT product_name, image_url, unit_price, quantity, line_total, installation_fee FROM order_items WHERE order_id = ${o.id} ORDER BY product_name`;
        return { o, items };
      });
    let found = await load();
    if (!found) return null;
    // Check with Paystack when the customer comes back, unless the webhook already confirmed it.
    const ref = String(found.o.payment_reference ?? "");
    if (found.o.payment_status !== "paid" && ref && (!data.reference || data.reference === ref)) {
      await confirmPayment(ref);
      found = (await load())!;
    }
    const { o, items } = found;
    return {
      orderNumber: String(o.order_number),
      createdAt: new Date(o.created_at as string).toISOString(),
      customerName: String(o.customer_name),
      email: String(o.email),
      paymentStatus: String(o.payment_status),
      fulfilmentStatus: String(o.status),
      deliveryMethod: String(o.delivery_method),
      subtotal: Number(o.subtotal),
      deliveryFee: Number(o.delivery_fee),
      installationFee: Number(o.installation_fee),
      total: Number(o.total),
      items: items.map((i) => ({
        name: String(i.product_name),
        imageUrl: (i.image_url as string | null) ?? null,
        unitPrice: Number(i.unit_price),
        quantity: Number(i.quantity),
        lineTotal: Number(i.line_total),
        installationFee: Number(i.installation_fee),
      })),
    };
  });

/** Starts a fresh Paystack attempt for an unpaid order after a failed or cancelled payment. */
export const retryPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { sha256Hex } = await import("./password");
    const { siteOrigin, startPayment } = await import("./payments.server");
    const { toKobo } = await import("./order-math");
    const hash = await sha256Hex(data.token);
    const [o] = await withDb((sql) => sql`SELECT id, order_number, email, total, payment_status, status FROM orders WHERE access_token_hash = ${hash}`);
    if (!o) return { ok: false as const, message: "We couldn't find that order." };
    if (o.payment_status === "paid") return { ok: false as const, message: "This order is already paid." };
    if (o.status === "cancelled") return { ok: false as const, message: "This order was cancelled. Please contact us." };
    const pay = await startPayment({
      id: String(o.id),
      orderNumber: String(o.order_number),
      email: String(o.email),
      amountKobo: toKobo(Number(o.total)),
      returnUrl: `${siteOrigin()}/order/${data.token}`,
    });
    return pay.ok ? { ok: true as const, authorizationUrl: pay.authorizationUrl } : { ok: false as const, message: pay.message };
  });
