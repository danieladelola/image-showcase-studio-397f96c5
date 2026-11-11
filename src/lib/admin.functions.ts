import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { FULFILMENT_STATUSES, IMAGE_TYPES, MAX_IMAGE_BYTES, categoryInputSchema, productInputSchema } from "./admin-schemas";
import { PRODUCT_STATUSES, type AdminProduct } from "./shop-types";
import { storeSettingsSchema } from "./store-settings";

/** Every admin function starts here: it rejects callers without a valid admin session. */
async function adminDb() {
  const { requireAdmin } = await import("./admin-session.server");
  const db = await import("./db.server");
  const catalog = await import("./catalog.server");
  const admin = await requireAdmin();
  return { ...db, ...catalog, admin };
}

const idSchema = z.object({ id: z.string().uuid() });

function isUniqueViolation(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505";
}
function constraintName(e: unknown) {
  return typeof e === "object" && e !== null && "constraint_name" in e ? String((e as { constraint_name: unknown }).constraint_name) : "";
}

/* ---------------- Dashboard ---------------- */

const dashboardInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupBy: z.enum(["day", "week", "month"]),
});

export const getDashboard = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => dashboardInput.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    const from = data.from <= data.to ? data.from : data.to;
    const to = data.from <= data.to ? data.to : data.from;
    return withDb(async (sql) => {
      // Dates are calendar days in Lagos time; `to` is inclusive.
      const [stats] = await sql`
        SELECT
          (SELECT count(*) FROM products WHERE status <> 'archived')::int AS products,
          (SELECT count(*) FROM products WHERE status = 'published')::int AS published,
          (SELECT count(*) FROM orders WHERE (created_at AT TIME ZONE 'Africa/Lagos')::date BETWEEN ${from}::date AND ${to}::date)::int AS orders,
          (SELECT count(*) FROM orders WHERE payment_status = 'paid' AND (paid_at AT TIME ZONE 'Africa/Lagos')::date BETWEEN ${from}::date AND ${to}::date)::int AS paid_orders,
          (SELECT coalesce(sum(amount_paid), 0) FROM orders WHERE payment_status = 'paid' AND (paid_at AT TIME ZONE 'Africa/Lagos')::date BETWEEN ${from}::date AND ${to}::date)::float8 AS revenue,
          (SELECT count(*) FROM orders WHERE payment_status = 'paid' AND status IN ('pending', 'confirmed', 'processing'))::int AS to_fulfil`;
      const series = await sql`
        WITH buckets AS (
          SELECT generate_series(date_trunc(${data.groupBy}, ${from}::date::timestamp), date_trunc(${data.groupBy}, ${to}::date::timestamp), ('1 ' || ${data.groupBy})::interval) AS bucket
        )
        SELECT to_char(b.bucket, 'YYYY-MM-DD') AS bucket, coalesce(sum(o.amount_paid), 0)::float8 AS revenue, count(o.id)::int AS orders
        FROM buckets b
        LEFT JOIN orders o ON o.payment_status = 'paid'
          AND (o.paid_at AT TIME ZONE 'Africa/Lagos')::date BETWEEN ${from}::date AND ${to}::date
          AND date_trunc(${data.groupBy}, o.paid_at AT TIME ZONE 'Africa/Lagos') = b.bucket
        GROUP BY b.bucket ORDER BY b.bucket`;
      const fulfilment = await sql`
        SELECT status, count(*)::int AS count FROM orders
        WHERE (created_at AT TIME ZONE 'Africa/Lagos')::date BETWEEN ${from}::date AND ${to}::date GROUP BY status`;
      const payment = await sql`
        SELECT payment_status AS status, count(*)::int AS count FROM orders
        WHERE (created_at AT TIME ZONE 'Africa/Lagos')::date BETWEEN ${from}::date AND ${to}::date GROUP BY payment_status`;
      const recent = await sql`
        SELECT id, order_number, customer_name, total::float8 AS total, status, payment_status, created_at
        FROM orders ORDER BY created_at DESC LIMIT 6`;
      return {
        range: { from, to, groupBy: data.groupBy },
        stats: {
          products: Number(stats!.products),
          published: Number(stats!.published),
          orders: Number(stats!.orders),
          paidOrders: Number(stats!.paid_orders),
          revenue: Number(stats!.revenue),
          toFulfil: Number(stats!.to_fulfil),
        },
        series: series.map((r) => ({ bucket: String(r.bucket), revenue: Number(r.revenue), orders: Number(r.orders) })),
        fulfilment: fulfilment.map((r) => ({ status: String(r.status), count: Number(r.count) })),
        payment: payment.map((r) => ({ status: String(r.status), count: Number(r.count) })),
        recent: recent.map((r) => ({
          id: String(r.id),
          orderNumber: String(r.order_number),
          customerName: String(r.customer_name),
          total: Number(r.total),
          status: String(r.status),
          paymentStatus: String(r.payment_status),
          createdAt: new Date(r.created_at as string).toISOString(),
        })),
      };
    });
  });

/* ---------------- Products ---------------- */

export const adminListProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { withDb, PRODUCT_COLUMNS, mapProduct } = await adminDb();
  return withDb(async (sql) => {
    const rows = await sql.unsafe(
      `SELECT ${PRODUCT_COLUMNS}, EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id) AS has_orders
       FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.sort_order, p.created_at`,
    );
    return rows.map((r) => ({ ...mapProduct(r), hasOrders: Boolean(r.has_orders) })) as AdminProduct[];
  });
});

export const adminGetProduct = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb, PRODUCT_COLUMNS, mapProduct } = await adminDb();
    return withDb(async (sql) => {
      const rows = await sql.unsafe(
        `SELECT ${PRODUCT_COLUMNS}, EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id) AS has_orders
         FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1`,
        [data.id],
      );
      return rows[0] ? ({ ...mapProduct(rows[0]), hasOrders: Boolean(rows[0].has_orders) } as AdminProduct) : null;
    });
  });

export const adminSaveProduct = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid().nullable(), product: productInputSchema }).parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    const p = data.product;
    const featured = p.featuredImage;
    const alt = (s: string) => s || p.name;
    const gallery = p.gallery.map((g) => ({ url: g.url, alt: alt(g.alt) }));
    const specs = Object.fromEntries(Object.entries(p.specs).filter(([, v]) => v !== undefined && v !== ""));
    const price = p.price;
    const salePrice = p.salePrice;
    try {
      const id = await withDb(async (sql) => {
        if (data.id) {
          const rows = await sql`
            UPDATE products SET name = ${p.name}, slug = ${p.slug}, sku = ${p.sku}, category_id = ${p.categoryId},
              short_description = ${p.shortDescription}, description = ${p.description}, quote_only = ${p.quoteOnly},
              price = ${price}, sale_price = ${salePrice}, installation_fee = ${p.installationFee},
              image_url = ${featured?.url ?? null}, image_alt = ${featured ? alt(featured.alt) : null},
              gallery_images = ${sql.json(gallery)}, features = ${sql.json(p.features)}, specs = ${sql.json(specs)},
              badge = ${p.badge || null}, track_stock = ${p.trackStock}, stock_quantity = ${p.stockQuantity},
              availability = ${p.availability}, is_featured = ${p.isFeatured}, status = ${p.status},
              sort_order = ${p.sortOrder}, updated_at = now()
            WHERE id = ${data.id} RETURNING id`;
          return rows[0]?.id as string | undefined;
        }
        const rows = await sql`
          INSERT INTO products (name, slug, sku, category_id, short_description, description, quote_only, price, sale_price,
            installation_fee, image_url, image_alt, gallery_images, features, specs, badge, track_stock, stock_quantity,
            availability, is_featured, status, sort_order)
          VALUES (${p.name}, ${p.slug}, ${p.sku}, ${p.categoryId}, ${p.shortDescription}, ${p.description}, ${p.quoteOnly},
            ${price}, ${salePrice}, ${p.installationFee}, ${featured?.url ?? null}, ${featured ? alt(featured.alt) : null},
            ${sql.json(gallery)}, ${sql.json(p.features)}, ${sql.json(specs)}, ${p.badge || null}, ${p.trackStock},
            ${p.stockQuantity}, ${p.availability}, ${p.isFeatured}, ${p.status}, ${p.sortOrder})
          RETURNING id`;
        return rows[0]?.id as string | undefined;
      });
      if (!id) return { ok: false as const, message: "That product no longer exists." };
      return { ok: true as const, id: String(id), slug: p.slug, status: p.status };
    } catch (e) {
      if (isUniqueViolation(e)) {
        const field = constraintName(e).includes("sku") ? "sku" : "slug";
        return {
          ok: false as const,
          field,
          message: field === "sku" ? "Another product already uses that SKU." : "Another product already uses that link name.",
        };
      }
      console.error("Product save failed", e);
      return { ok: false as const, message: "The product couldn't be saved. Please try again." };
    }
  });

export const adminSetProductStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: z.enum(PRODUCT_STATUSES) }).parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    const rows = await withDb((sql) => sql`UPDATE products SET status = ${data.status}, updated_at = now() WHERE id = ${data.id} RETURNING id`);
    return rows[0] ? { ok: true as const } : { ok: false as const, message: "That product no longer exists." };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    // Products with order history are archived instead, so past orders keep their link.
    const rows = await withDb(
      (sql) => sql`DELETE FROM products WHERE id = ${data.id} AND NOT EXISTS (SELECT 1 FROM order_items WHERE product_id = ${data.id}) RETURNING id`,
    );
    if (!rows[0]) return { ok: false as const, message: "This product has orders, so it can't be deleted. Archive it instead." };
    return { ok: true as const };
  });

/* ---------------- Categories ---------------- */

export const adminListCategories = createServerFn({ method: "GET" }).handler(async () => {
  const { withDb, mapCategory } = await adminDb();
  return withDb(async (sql) => {
    const rows = await sql`
      SELECT c.*, (SELECT count(*) FROM products p WHERE p.category_id = c.id)::int AS product_count
      FROM categories c ORDER BY c.sort_order, c.name`;
    return rows.map(mapCategory);
  });
});

export const adminSaveCategory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid().nullable(), category: categoryInputSchema }).parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    const c = data.category;
    try {
      await withDb((sql) =>
        data.id
          ? sql`UPDATE categories SET name = ${c.name}, slug = ${c.slug}, description = ${c.description}, sort_order = ${c.sortOrder} WHERE id = ${data.id}`
          : sql`INSERT INTO categories (name, slug, description, sort_order) VALUES (${c.name}, ${c.slug}, ${c.description}, ${c.sortOrder})`,
      );
      return { ok: true as const };
    } catch (e) {
      if (isUniqueViolation(e)) return { ok: false as const, message: "Another category already uses that link name." };
      console.error("Category save failed", e);
      return { ok: false as const, message: "The category couldn't be saved. Please try again." };
    }
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    await withDb((sql) => sql`DELETE FROM categories WHERE id = ${data.id}`);
    return { ok: true as const };
  });

/* ---------------- Orders ---------------- */

export const adminListOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { withDb } = await adminDb();
  return withDb(async (sql) => {
    const rows = await sql`
      SELECT o.id, o.order_number, o.created_at, o.customer_name, o.email, o.phone, o.city, o.state, o.total::float8 AS total,
        o.status, o.payment_status, o.payment_reference, o.delivery_method,
        (SELECT coalesce(sum(quantity), 0) FROM order_items i WHERE i.order_id = o.id)::int AS item_count
      FROM orders o ORDER BY o.created_at DESC LIMIT 1000`;
    return rows.map((o) => ({
      id: String(o.id),
      orderNumber: String(o.order_number),
      createdAt: new Date(o.created_at as string).toISOString(),
      customerName: String(o.customer_name),
      email: String(o.email),
      phone: String(o.phone),
      location: [o.city, o.state].filter(Boolean).join(", "),
      total: Number(o.total),
      status: String(o.status),
      paymentStatus: String(o.payment_status),
      paymentReference: (o.payment_reference as string | null) ?? null,
      deliveryMethod: String(o.delivery_method),
      itemCount: Number(o.item_count),
    }));
  });
});

export const adminGetOrder = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    return withDb(async (sql) => {
      const [o] = await sql`SELECT * FROM orders WHERE id = ${data.id}`;
      if (!o) return null;
      const items = await sql`SELECT * FROM order_items WHERE order_id = ${o.id} ORDER BY product_name`;
      const payments = await sql`SELECT reference, amount_kobo, status, gateway_response, channel, created_at, verified_at FROM payments WHERE order_id = ${o.id} ORDER BY created_at DESC`;
      return {
        id: String(o.id),
        orderNumber: String(o.order_number),
        createdAt: new Date(o.created_at as string).toISOString(),
        updatedAt: new Date(o.updated_at as string).toISOString(),
        customerName: String(o.customer_name),
        phone: String(o.phone),
        email: String(o.email),
        address: String(o.address),
        city: String(o.city),
        state: String(o.state),
        notes: (o.notes as string | null) ?? "",
        paymentMethod: String(o.payment_method),
        paymentStatus: String(o.payment_status),
        paymentReference: (o.payment_reference as string | null) ?? null,
        paidAt: o.paid_at ? new Date(o.paid_at as string).toISOString() : null,
        amountPaid: o.amount_paid == null ? null : Number(o.amount_paid),
        status: String(o.status),
        deliveryMethod: String(o.delivery_method),
        installationRequested: Boolean(o.installation_requested),
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.delivery_fee),
        installationFee: Number(o.installation_fee),
        total: Number(o.total),
        items: items.map((i) => ({
          id: String(i.id),
          productId: (i.product_id as string | null) ?? null,
          productName: String(i.product_name),
          sku: (i.sku as string | null) ?? null,
          imageUrl: (i.image_url as string | null) ?? null,
          regularPrice: i.regular_price == null ? null : Number(i.regular_price),
          unitPrice: Number(i.unit_price),
          quantity: Number(i.quantity),
          lineTotal: Number(i.line_total),
          installationFee: Number(i.installation_fee),
        })),
        payments: payments.map((p) => ({
          reference: String(p.reference),
          amount: Number(p.amount_kobo) / 100,
          status: String(p.status),
          gatewayResponse: (p.gateway_response as string | null) ?? null,
          channel: (p.channel as string | null) ?? null,
          createdAt: new Date(p.created_at as string).toISOString(),
          verifiedAt: p.verified_at ? new Date(p.verified_at as string).toISOString() : null,
        })),
      };
    });
  });

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: z.enum(FULFILMENT_STATUSES) }).parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    await withDb((sql) => sql`UPDATE orders SET status = ${data.status}, updated_at = now() WHERE id = ${data.id}`);
    return { ok: true as const };
  });

/* ---------------- Settings ---------------- */

export const adminGetSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { withDb, loadSettings, admin } = await adminDb();
  const { paystackSecret } = await import("./payments.server");
  const { paystackMode } = await import("./paystack");
  return withDb(async (sql) => {
    const admins = await sql`SELECT id, name, email, created_at FROM admin_users ORDER BY created_at`;
    return {
      settings: await loadSettings(sql),
      paystack: { configured: !!paystackSecret(), mode: paystackMode(paystackSecret()) },
      me: admin,
      admins: admins.map((a) => ({ id: String(a.id), name: String(a.name), email: String(a.email), createdAt: new Date(a.created_at as string).toISOString() })),
    };
  });
});

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => storeSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    await withDb(
      (sql) => sql`INSERT INTO settings (key, value) VALUES ('store', ${sql.json(data)})
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    );
    return { ok: true as const };
  });

/* ---------------- Images ---------------- */

export const adminUploadImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        filename: z.string().max(200),
        contentType: z.enum(IMAGE_TYPES),
        base64: z.string().max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { withDb } = await adminDb();
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.length > MAX_IMAGE_BYTES) return { ok: false as const, message: "Images must be 5 MB or smaller." };
    const rows = await withDb(
      (sql) => sql`
        INSERT INTO images (filename, content_type, size_bytes, data)
        VALUES (${data.filename}, ${data.contentType}, ${bytes.length}, ${bytes})
        RETURNING id`,
    );
    return { ok: true as const, url: `/api/public/images/${rows[0]!.id}` };
  });
