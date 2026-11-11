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
  const settings = await withDb(loadSettings);
  return { settings, paymentsEnabled: true, paymentMode: "live" as const };
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

/** Saves the order (with price snapshots). The customer then pays by bank transfer on the order page. */
export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { priceOrder, OrderError } = await import("./order-math");
    const { randomToken, sha256Hex } = await import("./password");
    try {
      const { catalog, settings } = await loadCatalog(data.items.map((i) => i.productId));
      const priced = priceOrder(data.items, catalog, data.options, settings);
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      await withDb((sql) =>
        sql.begin(async (tx) => {
          const [o] = await tx`
            INSERT INTO orders (customer_name, phone, email, address, city, state, notes, payment_method, payment_status,
              delivery_method, delivery_fee, installation_requested, installation_fee, subtotal, total, access_token_hash)
            VALUES (${data.customerName}, ${data.phone}, ${data.email}, ${data.address}, ${data.city}, ${data.state},
              ${data.notes || null}, 'bank_transfer', 'unpaid', ${data.options.deliveryMethod}, ${priced.deliveryFee},
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
      return { ok: true as const, orderToken: token };
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
    if (found.o.payment_method === "paystack" && found.o.payment_status !== "paid" && ref && (!data.reference || data.reference === ref)) {
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
      paymentMethod: String(o.payment_method),
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

/** Customer tells us they've sent the bank transfer; the team then checks the account and confirms. */
export const reportTransfer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().regex(/^[0-9a-f]{64}$/), senderName: z.string().trim().max(120).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { sha256Hex } = await import("./password");
    const hash = await sha256Hex(data.token);
    return withDb((sql) =>
      sql.begin(async (tx) => {
        const [o] = await tx`SELECT id, order_number, total, payment_status, status FROM orders WHERE access_token_hash = ${hash} FOR UPDATE`;
        if (!o) return { ok: false as const, message: "We couldn't find that order." };
        if (o.status === "cancelled") return { ok: false as const, message: "This order was cancelled. Please contact us." };
        if (o.payment_status === "paid") return { ok: true as const };
        if (o.payment_status === "pending") return { ok: true as const };
        const reference = `TRF-${o.order_number}-${Date.now().toString(36).toUpperCase()}`;
        const note = data.senderName ? `Customer says sent by: ${data.senderName}` : "Customer says transfer was sent";
        await tx`INSERT INTO payments (order_id, provider, reference, amount_kobo, status, channel, gateway_response)
                 VALUES (${o.id}, 'bank_transfer', ${reference}, ${Math.round(Number(o.total) * 100)}, 'pending', 'bank transfer', ${note})`;
        await tx`UPDATE orders SET payment_status = 'pending', payment_reference = ${reference}, updated_at = now() WHERE id = ${o.id}`;
        return { ok: true as const };
      }),
    );
  });
