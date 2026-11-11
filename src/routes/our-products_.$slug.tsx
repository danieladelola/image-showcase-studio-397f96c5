import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Eye, Minus, Package, Plus, ShieldCheck, Truck, Wrench } from "lucide-react";
import { z } from "zod";

import { PageFrame } from "@/components/site-layout";
import { FeatureIcon } from "@/components/feature-icon";
import { PriceBlock, PurchaseActions, StockLabel } from "@/components/purchase-actions";
import { Button } from "@/components/ui/button";
import { discountPercent, maxOrderQty, purchaseState, sellingPrice } from "@/lib/product-rules";
import { productQuery } from "@/lib/shop.queries";
import { SPEC_FIELDS, naira, type Product } from "@/lib/shop-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/our-products_/$slug")({
  validateSearch: (search: Record<string, unknown>) => z.object({ preview: z.boolean().optional().catch(undefined) }).parse(search),
  loaderDeps: ({ search }) => ({ preview: search.preview === true }),
  loader: async ({ context, params, deps }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.slug, deps.preview));
    if (!data.product) throw notFound();
    return { name: data.product.name, summary: data.product.shortDescription, category: data.product.categoryName, image: data.product.featuredImage?.url ?? null };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Product"} | RUWATA Solar` },
      { name: "description", content: loaderData?.summary || "Solar equipment from RUWATA with nationwide delivery and installation." },
      {
        name: "keywords",
        content: [loaderData?.name, loaderData?.category, "RUWATA", "solar Nigeria", "buy solar equipment"].filter(Boolean).join(", "),
      },
      { property: "og:title", content: `${loaderData?.name ?? "Product"} | RUWATA` },
      { property: "og:description", content: loaderData?.summary || "Solar equipment from RUWATA." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
      ...(loaderData?.image?.startsWith("https://")
        ? [{ property: "og:image", content: loaderData.image }, { name: "twitter:image", content: loaderData.image }]
        : []),
    ],
  }),
  notFoundComponent: ProductNotFound,
  component: ProductDetailPage,
});

function ProductNotFound() {
  return (
    <PageFrame>
      <section className="section-space">
        <div className="site-wrap grid justify-items-center gap-4 text-center">
          <h1 className="section-heading">Product not found</h1>
          <p className="text-muted-foreground">This product may have been removed or renamed.</p>
          <Button asChild><Link to="/our-products" hash="shop">Back to the shop</Link></Button>
        </div>
      </section>
    </PageFrame>
  );
}

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const { preview } = Route.useLoaderDeps();
  const { data } = useSuspenseQuery(productQuery(slug, preview));
  const product = data.product!;
  return (
    <PageFrame>
      {data.preview && (
        <div className="border-b border-amber/40 bg-amber/15">
          <p className="site-wrap flex items-center gap-2 py-3 text-sm font-bold text-brand-deep">
            <Eye className="size-4" aria-hidden="true" /> Preview — this product is {product.status === "archived" ? "archived" : "a draft"} and not visible to customers.
          </p>
        </div>
      )}
      <ProductDetail key={product.id} product={product} />
      {data.related.length > 0 && <RelatedProducts products={data.related} />}
    </PageFrame>
  );
}

function ProductDetail({ product: p }: { product: Product }) {
  const images = uniqueImages(p);
  const [active, setActive] = useState(0);
  const max = Math.max(1, maxOrderQty(p));
  const [qty, setQty] = useState(1);
  const pct = discountPercent(p);
  const canBuy = purchaseState(p) === "buy";
  const specs = SPEC_FIELDS.filter((f) => p.specs[f.key]);
  const current = images[active];
  const hasSpecs = specs.length > 0 || p.specs.installationIncluded;
  const go = (step: number) => setActive((i) => (i + step + images.length) % images.length);

  return (
    <section className="pd-section">
      <div className="site-wrap">
        <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground sm:mb-8">
          <Link to="/our-products" hash="shop" className="inline-flex items-center gap-1.5 font-bold hover:text-brand">
            <ArrowLeft className="size-4" aria-hidden="true" /> Shop
          </Link>
          {p.categoryName && <><ChevronRight className="size-3.5" aria-hidden="true" /><span>{p.categoryName}</span></>}
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <span className="line-clamp-1 text-foreground">{p.name}</span>
        </nav>

        <div className="pd-hero">
          <div className="pd-gallery">
            <div className="pd-main">
              {current ? (
                <img key={current.url} src={current.url} alt={current.alt || p.name} width={1024} height={1024} />
              ) : (
                <div className="grid size-full place-items-center text-muted-foreground"><Package className="size-12" aria-hidden="true" /></div>
              )}
              {p.badge && <span className="pd-badge">{p.badge}</span>}
              {pct && <span className="pd-badge pd-badge-sale">-{pct}%</span>}
              {images.length > 1 && (
                <>
                  <button type="button" className="pd-nav left-3" aria-label="Previous photo" onClick={() => go(-1)}><ChevronLeft className="size-5" /></button>
                  <button type="button" className="pd-nav right-3" aria-label="Next photo" onClick={() => go(1)}><ChevronRight className="size-5" /></button>
                  <span className="pd-counter" aria-live="polite">{active + 1} / {images.length}</span>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="pd-thumbs" role="tablist" aria-label="Product photos">
                {images.map((img, i) => (
                  <button key={img.url} type="button" role="tab" aria-selected={active === i} aria-label={`Show photo ${i + 1}`} onClick={() => setActive(i)} className="pd-thumb">
                    <img src={img.url} alt="" loading="lazy" width={96} height={96} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid content-start gap-6">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {p.categoryName && <span className="rounded-full bg-accent px-3 py-1 text-xs font-extrabold tracking-[0.12em] text-brand uppercase">{p.categoryName}</span>}
                {p.sku && <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">SKU {p.sku}</span>}
              </div>
              <h1 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl">{p.name}</h1>
              {p.shortDescription && <p className="text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">{p.shortDescription}</p>}
            </div>

            <div className="pd-buybox">
              <div className="pd-price-row">
                <PriceBlock product={p} size="lg" />
                <StockLabel product={p} />
              </div>

              {canBuy && (
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-bold" id="qty-label">Quantity</span>
                  <div className="pd-qty" role="group" aria-labelledby="qty-label">
                    <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus className="size-4" /></button>
                    <span aria-live="polite">{qty}</span>
                    <button type="button" aria-label="Increase quantity" disabled={qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))}><Plus className="size-4" /></button>
                  </div>
                  {p.trackStock && <span className="text-xs text-muted-foreground">{p.stockQuantity} available</span>}
                </div>
              )}

              <PurchaseActions product={p} quantity={qty} layout="detail" />

              <div className="pd-trust">
                <div className="pd-trust-item"><Truck aria-hidden="true" /><strong>Delivery or pickup</strong><span>Options shown at checkout</span></div>
                <div className="pd-trust-item"><ShieldCheck aria-hidden="true" /><strong>Secure payment</strong><span>Guest checkout via Paystack</span></div>
                <div className="pd-trust-item">
                  <Wrench aria-hidden="true" />
                  <strong>Installation</strong>
                  <span>{p.specs.installationIncluded ? "Included with this product" : p.installationFee != null ? `Available for ${naira.format(p.installationFee)}` : "Ask our team"}</span>
                </div>
              </div>
            </div>

            {p.features.length > 0 && (
              <div className="grid gap-3">
                <h2 className="font-heading text-lg font-semibold">Key features</h2>
                <ul className="pd-features">
                  {p.features.map((f, i) => (
                    <li key={f.label + i} className="pd-feature">
                      <span className="pd-feature-icon"><FeatureIcon icon={f.icon} className="size-5" /></span>
                      <span className="grid">
                        <span className="text-sm font-bold text-foreground">{f.label}</span>
                        <span className="text-sm text-muted-foreground">{f.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {(p.description || hasSpecs) && (
          <div className={cn("mt-14 grid gap-6 sm:mt-20", p.description && hasSpecs && "lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]")}>
            {p.description && (
              <div className="pd-card grid content-start gap-4">
                <h2 className="font-heading text-2xl font-semibold">Product overview</h2>
                <p className="leading-8 whitespace-pre-line text-muted-foreground">{p.description}</p>
              </div>
            )}
            {hasSpecs && (
              <div className="pd-card grid content-start gap-4">
                <h2 className="font-heading text-2xl font-semibold">Specifications</h2>
                <dl className="pd-specs">
                  {specs.map((f) => (
                    <div key={f.key}>
                      <dt>{f.label}</dt>
                      <dd>{p.specs[f.key]}</dd>
                    </div>
                  ))}
                  {p.specs.installationIncluded && (
                    <div>
                      <dt>Installation</dt>
                      <dd>Included</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Featured photo first, then gallery photos, without repeats. */
function uniqueImages(p: Product) {
  const seen = new Set<string>();
  return [...(p.featuredImage ? [p.featuredImage] : []), ...p.gallery].filter((img) => {
    if (!img.url || seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
}

function RelatedProducts({ products }: { products: Product[] }) {
  return (
    <section className="section-space bg-card pt-0">
      <div className="site-wrap">
        <h2 className="mb-8 font-heading text-2xl font-semibold">You may also like</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((r) => (
            <Link key={r.id} to="/our-products/$slug" params={{ slug: r.slug }} className="shop-card group">
              <div className="shop-card-media">
                {r.featuredImage && <img src={r.featuredImage.url} alt={r.featuredImage.alt || r.name} loading="lazy" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              </div>
              <div className="grid gap-1 p-4">
                <span className="font-heading font-semibold">{r.name}</span>
                <span className="text-sm text-muted-foreground">{sellingPrice(r) != null ? naira.format(sellingPrice(r)!) : "Price coming soon"}</span>
                {purchaseState(r) === "buy" && <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand"><Check className="size-3.5" aria-hidden="true" /> Available</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
