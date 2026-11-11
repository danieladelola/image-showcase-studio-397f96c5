import type { Sql } from "./db.server";
import { DEFAULT_SETTINGS, storeSettingsSchema, type StoreSettings } from "./store-settings";
import type { Availability, Category, Product, ProductFeature, ProductImage, ProductSpecs, ProductStatus } from "./shop-types";

type Row = Record<string, unknown>;

export const PRODUCT_COLUMNS = `
  p.id, p.name, p.slug, p.sku, p.category_id, c.name AS category_name, c.slug AS category_slug,
  p.short_description, p.description, p.price, p.sale_price, p.quote_only, p.image_url, p.image_alt, p.gallery_images,
  p.features, p.specs, p.installation_fee, p.badge, p.status, p.is_featured, p.track_stock, p.stock_quantity,
  p.availability, p.sort_order, p.updated_at`;

const num = (v: unknown) => (v == null ? null : Number(v));

function images(v: unknown): ProductImage[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i): i is Row => !!i && typeof i === "object" && typeof (i as Row).url === "string")
    .map((i) => ({ url: String(i.url), alt: String(i.alt ?? "") }));
}

export function mapProduct(r: Row): Product {
  const features = Array.isArray(r.features) ? (r.features as ProductFeature[]) : [];
  const specs = r.specs && typeof r.specs === "object" ? (r.specs as ProductSpecs) : {};
  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    sku: (r.sku as string | null) ?? null,
    categoryId: (r.category_id as string | null) ?? null,
    categoryName: (r.category_name as string | null) ?? null,
    categorySlug: (r.category_slug as string | null) ?? null,
    shortDescription: (r.short_description as string | null) ?? "",
    description: (r.description as string | null) ?? "",
    price: num(r.price),
    salePrice: num(r.sale_price),
    quoteOnly: Boolean(r.quote_only),
    featuredImage: r.image_url ? { url: String(r.image_url), alt: String(r.image_alt ?? r.name ?? "") } : null,
    gallery: images(r.gallery_images),
    features: features.map((f) => ({ icon: String(f.icon ?? ""), label: String(f.label ?? ""), value: String(f.value ?? "") })),
    specs,
    installationFee: num(r.installation_fee),
    badge: (r.badge as string | null) ?? null,
    status: String(r.status) as ProductStatus,
    isFeatured: Boolean(r.is_featured),
    trackStock: Boolean(r.track_stock),
    stockQuantity: Number(r.stock_quantity ?? 0),
    availability: String(r.availability ?? "in_stock") as Availability,
    sortOrder: Number(r.sort_order ?? 0),
    updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : new Date(0).toISOString(),
  };
}

export function mapCategory(r: Row): Category {
  return {
    id: String(r.id),
    name: String(r.name),
    slug: String(r.slug),
    description: (r.description as string | null) ?? "",
    sortOrder: Number(r.sort_order ?? 0),
    productCount: Number(r.product_count ?? 0),
  };
}

export async function loadSettings(sql: Sql): Promise<StoreSettings> {
  const rows = await sql`SELECT value FROM settings WHERE key = 'store'`;
  const parsed = storeSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...((rows[0]?.value as object | undefined) ?? {}) });
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
