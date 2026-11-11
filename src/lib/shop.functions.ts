import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Category, Product } from "./shop-types";

export const listShop = createServerFn({ method: "GET" }).handler(async () => {
  const { withDb } = await import("./db.server");
  const { PRODUCT_COLUMNS, mapCategory, mapProduct } = await import("./catalog.server");
  return withDb(async (sql) => {
    const products = await sql.unsafe(
      `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.status = 'published' ORDER BY p.is_featured DESC, p.sort_order, p.created_at`,
    );
    const categories = await sql`
      SELECT c.*, (SELECT count(*) FROM products p WHERE p.category_id = c.id AND p.status = 'published')::int AS product_count
      FROM categories c ORDER BY c.sort_order, c.name`;
    return {
      products: products.map(mapProduct) as Product[],
      categories: categories.map(mapCategory) as Category[],
    };
  });
});

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(200), preview: z.boolean().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    const { PRODUCT_COLUMNS, mapProduct } = await import("./catalog.server");
    // Drafts and archived products are only visible to a signed-in admin previewing them.
    let canPreview = false;
    if (data.preview) {
      const { currentAdmin } = await import("./admin-session.server");
      canPreview = !!(await currentAdmin());
    }
    return withDb(async (sql) => {
      const rows = await sql.unsafe(
        `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.slug = $1 ${canPreview ? "" : "AND p.status = 'published'"}`,
        [data.slug],
      );
      if (!rows[0]) return { product: null, related: [] as Product[], preview: false };
      const product = mapProduct(rows[0]);
      const related = await sql.unsafe(
        `SELECT ${PRODUCT_COLUMNS} FROM products p LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.status = 'published' AND p.id <> $1
         ORDER BY (p.category_id IS NOT DISTINCT FROM $2) DESC, p.sort_order LIMIT 4`,
        [product.id, product.categoryId],
      );
      return { product, related: related.map(mapProduct), preview: canPreview && product.status !== "published" };
    });
  });
