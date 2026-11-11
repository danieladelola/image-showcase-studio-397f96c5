import { useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, ImagePlus, LoaderCircle, Plus, Save, Send, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader, FieldError, ProductStatusPill } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useInvalidateCatalog } from "@/hooks/use-invalidate-catalog";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, productInputSchema, slugify } from "@/lib/admin-schemas";
import { adminSaveProduct, adminUploadImage } from "@/lib/admin.functions";
import { adminCategoriesQuery, adminProductQuery } from "@/lib/admin.queries";
import { sellingPrice } from "@/lib/product-rules";
import {
  AVAILABILITIES,
  FEATURE_ICONS,
  SPEC_FIELDS,
  naira,
  type AdminProduct,
  type Availability,
  type Category,
  type ProductFeature,
  type ProductImage,
  type ProductSpecs,
  type ProductStatus,
} from "@/lib/shop-types";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/admin/_app/products/$id")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(adminCategoriesQuery);
    if (params.id === "new") return;
    if (!UUID.test(params.id)) throw notFound();
    const product = await context.queryClient.ensureQueryData(adminProductQuery(params.id));
    if (!product) throw notFound();
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.id === "new" ? "Add product" : "Edit product"} | RUWATA Admin` },
      { name: "description", content: "Edit product details, prices, photos and stock for the RUWATA store." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Product editor | RUWATA Admin" },
      { property: "og:description", content: "Product editor for the RUWATA store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => (
    <div className="admin-box admin-box-pad grid justify-items-center gap-3 text-center">
      <h1 className="font-heading text-xl font-semibold">Product not found</h1>
      <p className="text-sm text-muted-foreground">It may have been deleted.</p>
      <Button asChild variant="outline"><Link to="/admin/products">Back to products</Link></Button>
    </div>
  ),
  component: EditorPage,
});

function EditorPage() {
  const { id } = Route.useParams();
  const { data: categories } = useSuspenseQuery(adminCategoriesQuery);
  if (id === "new") return <ProductEditor key="new" initial={null} categories={categories} />;
  return <ExistingProduct id={id} categories={categories} />;
}

function ExistingProduct({ id, categories }: { id: string; categories: Category[] }) {
  const { data } = useSuspenseQuery(adminProductQuery(id));
  if (!data) return null;
  return <ProductEditor key={id} initial={data} categories={categories} />;
}

type Form = {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  quoteOnly: boolean;
  price: string;
  salePrice: string;
  installationFee: string;
  featuredImage: ProductImage | null;
  gallery: ProductImage[];
  features: ProductFeature[];
  specs: ProductSpecs;
  badge: string;
  trackStock: boolean;
  stockQuantity: string;
  availability: Availability;
  isFeatured: boolean;
  status: ProductStatus;
  sortOrder: string;
};

const money = (n: number | null) => (n == null ? "" : String(n));

function toForm(p: AdminProduct | null): Form {
  return {
    name: p?.name ?? "",
    slug: p?.slug ?? "",
    sku: p?.sku ?? "",
    categoryId: p?.categoryId ?? "",
    shortDescription: p?.shortDescription ?? "",
    description: p?.description ?? "",
    quoteOnly: false,
    price: money(p?.price ?? null),
    salePrice: money(p?.salePrice ?? null),
    installationFee: money(p?.installationFee ?? null),
    featuredImage: p?.featuredImage ?? null,
    gallery: p?.gallery ?? [],
    features: p?.features ?? [],
    specs: p?.specs ?? {},
    badge: p?.badge ?? "",
    trackStock: p?.trackStock ?? false,
    stockQuantity: String(p?.stockQuantity ?? 0),
    availability: p?.availability ?? "in_stock",
    isFeatured: p?.isFeatured ?? false,
    status: p?.status ?? "draft",
    sortOrder: String(p?.sortOrder ?? 0),
  };
}

const parseMoney = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[,\s₦]/g, "")));
const parseInt10 = (s: string) => (s.trim() === "" ? Number.NaN : Number(s.replace(/[,\s]/g, "")));

function toInput(f: Form, status: ProductStatus) {
  return {
    name: f.name,
    slug: f.slug,
    sku: f.sku,
    categoryId: f.categoryId || null,
    shortDescription: f.shortDescription,
    description: f.description,
    quoteOnly: false,
    price: parseMoney(f.price),
    salePrice: parseMoney(f.salePrice),
    installationFee: parseMoney(f.installationFee),
    featuredImage: f.featuredImage,
    gallery: f.gallery,
    features: f.features,
    specs: f.specs,
    badge: f.badge.trim() || null,
    trackStock: f.trackStock,
    stockQuantity: parseInt10(f.stockQuantity),
    availability: f.availability,
    isFeatured: f.isFeatured,
    status,
    sortOrder: parseInt10(f.sortOrder || "0"),
  };
}

const AVAILABILITY_LABEL: Record<Availability, string> = { in_stock: "In stock", out_of_stock: "Out of stock", preorder: "Pre-order" };

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function ProductEditor({ initial, categories }: { initial: AdminProduct | null; categories: Category[] }) {
  const isNew = !initial;
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, setSaving] = useState<"draft" | "publish" | "preview" | null>(null);
  const [uploading, setUploading] = useState(0);
  const featuredInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const saveFn = useServerFn(adminSaveProduct);
  const uploadFn = useServerFn(adminUploadImage);
  const invalidate = useInvalidateCatalog();
  const navigate = useNavigate();

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors(({ [key as string]: _, ...rest }) => rest);
  };
  const setSpec = <K extends keyof ProductSpecs>(key: K, value: ProductSpecs[K]) => setForm((f) => ({ ...f, specs: { ...f.specs, [key]: value } }));

  async function upload(files: FileList | null, target: "featured" | "gallery") {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name}: please use a JPG, PNG or WebP image.`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} is larger than 5 MB.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const res = await uploadFn({ data: { filename: file.name, contentType: file.type as (typeof IMAGE_TYPES)[number], base64: await fileToBase64(file) } });
        if (!res.ok) {
          toast.error(res.message);
          continue;
        }
        const img = { url: res.url, alt: "" };
        setForm((f) => {
          if (target === "featured" || !f.featuredImage) {
            return { ...f, featuredImage: img, gallery: target === "featured" && f.featuredImage ? [f.featuredImage, ...f.gallery].slice(0, 12) : f.gallery };
          }
          if (f.gallery.length >= 12) {
            toast.error("You can add up to 12 gallery photos.");
            return f;
          }
          return { ...f, gallery: [...f.gallery, img] };
        });
      } catch {
        toast.error(`${file.name} couldn't be uploaded. Please try again.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const moveGallery = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const g = [...f.gallery];
      const j = i + dir;
      if (j < 0 || j >= g.length) return f;
      [g[i], g[j]] = [g[j]!, g[i]!];
      return { ...f, gallery: g };
    });

  const makeFeatured = (i: number) =>
    setForm((f) => {
      const g = [...f.gallery];
      const [picked] = g.splice(i, 1);
      return { ...f, featuredImage: picked!, gallery: f.featuredImage ? [f.featuredImage, ...g] : g };
    });

  async function save(action: "draft" | "publish" | "preview") {
    const status: ProductStatus = action === "draft" ? "draft" : action === "publish" ? "published" : form.status;
    const parsed = productInputSchema.safeParse(toInput(form, status));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      toast.error("Please fix the highlighted fields.");
      const first = Object.keys(next)[0];
      document.querySelector<HTMLElement>(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const previewWindow = action === "preview" ? window.open("about:blank", "_blank") : null;
    setSaving(action);
    try {
      const res = await saveFn({ data: { id: initial?.id ?? null, product: parsed.data } });
      if (!res.ok) {
        previewWindow?.close();
        if ("field" in res && res.field) setErrors({ [res.field]: res.message });
        toast.error(res.message);
        return;
      }
      setErrors({});
      setForm((f) => ({ ...f, status: res.status, sku: parsed.data.sku ?? "" }));
      await invalidate();
      if (previewWindow) previewWindow.location.href = `/our-products/${res.slug}?preview=true`;
      toast.success(action === "publish" ? `${parsed.data.name} is live in the shop` : action === "draft" ? "Saved as draft" : "Saved — preview opened in a new tab");
      if (isNew) await navigate({ to: "/admin/products/$id", params: { id: res.id }, replace: true });
    } catch {
      previewWindow?.close();
      toast.error("The product couldn't be saved. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  const price = sellingPrice({ price: parseMoney(form.price), salePrice: parseMoney(form.salePrice), quoteOnly: form.quoteOnly });
  const busy = saving !== null || uploading > 0;

  return (
    <>
      <Link to="/admin/products" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden="true" /> Products
      </Link>
      <AdminHeader title={isNew ? "Add product" : form.name || "Edit product"} actions={!isNew && <ProductStatusPill status={form.status} />} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid gap-6">
          <Section title="Basic details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name" name="name" errors={errors} wide>
                <input
                  className="admin-input"
                  value={form.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!slugTouched) set("slug", slugify(e.target.value));
                  }}
                />
              </Field>
              <Field label="Web address" name="slug" errors={errors} hint={`/our-products/${form.slug || "…"}`}>
                <input
                  className="admin-input"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                />
              </Field>
              <Field label="SKU" name="sku" errors={errors} hint="Optional stock code, e.g. RW-INV-5K">
                <input className="admin-input uppercase" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
              </Field>
              <Field label="Category" name="categoryId" errors={errors} wide>
                <select className="admin-input" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Short description" name="shortDescription" errors={errors} wide hint="Shown on product cards. Keep it to one or two sentences.">
                <textarea rows={2} className="admin-input" value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
              </Field>
              <Field label="Full description" name="description" errors={errors} wide>
                <textarea rows={6} className="admin-input" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Pricing">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Regular price (₦)" name="price" errors={errors}>
                <input inputMode="numeric" className="admin-input" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="e.g. 650000" />
              </Field>
              <Field label="Sale price (₦)" name="salePrice" errors={errors} hint="Optional. Must be lower than the regular price.">
                <input inputMode="numeric" className="admin-input" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} />
              </Field>
              <Field label="Installation fee (₦)" name="installationFee" errors={errors} hint="Optional. Offered at checkout.">
                <input inputMode="numeric" className="admin-input" value={form.installationFee} onChange={(e) => set("installationFee", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Photos" description="JPG, PNG or WebP up to 5 MB. Describe each photo for people using screen readers.">
            <div className="grid gap-5">
              <div data-field="featuredImage" className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
                <div className="aspect-square overflow-hidden rounded-xl border border-border bg-accent">
                  {form.featuredImage ? (
                    <img src={form.featuredImage.url} alt="" className="size-full object-cover" />
                  ) : (
                    <button type="button" onClick={() => featuredInput.current?.click()} className="grid size-full place-items-center text-sm font-bold text-muted-foreground hover:text-brand">
                      <span className="grid justify-items-center gap-1"><ImagePlus className="size-6" aria-hidden="true" /> Main photo</span>
                    </button>
                  )}
                </div>
                <div className="grid gap-2">
                  <p className="admin-label">Main photo</p>
                  {form.featuredImage && (
                    <input
                      className="admin-input"
                      aria-label="Main photo description"
                      placeholder={`Describe the photo, e.g. ${form.name || "product"} front view`}
                      value={form.featuredImage.alt}
                      onChange={(e) => set("featuredImage", { ...form.featuredImage!, alt: e.target.value })}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => featuredInput.current?.click()} disabled={busy}>
                      <ImagePlus aria-hidden="true" /> {form.featuredImage ? "Replace" : "Upload"}
                    </Button>
                    {form.featuredImage && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => set("featuredImage", null)}><X aria-hidden="true" /> Remove</Button>
                    )}
                  </div>
                  <FieldError message={errors.featuredImage} />
                </div>
                <input ref={featuredInput} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => { void upload(e.target.files, "featured"); e.target.value = ""; }} />
              </div>

              <div className="grid gap-3 border-t border-border pt-5" data-field="gallery">
                <div className="flex items-center justify-between">
                  <p className="admin-label">Gallery ({form.gallery.length}/12)</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => galleryInput.current?.click()} disabled={busy || form.gallery.length >= 12}>
                    <Plus aria-hidden="true" /> Add photos
                  </Button>
                  <input ref={galleryInput} type="file" multiple accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => { void upload(e.target.files, "gallery"); e.target.value = ""; }} />
                </div>
                {uploading > 0 && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Uploading…</p>}
                {form.gallery.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No extra photos yet.</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {form.gallery.map((img, i) => (
                      <li key={img.url + i} className="flex gap-3 rounded-xl border border-border p-2.5">
                        <img src={img.url} alt="" className="size-20 shrink-0 rounded-lg object-cover" />
                        <div className="grid min-w-0 flex-1 content-between gap-2">
                          <input
                            className="admin-input min-h-9 text-sm"
                            aria-label={`Photo ${i + 2} description`}
                            placeholder="Describe the photo"
                            value={img.alt}
                            onChange={(e) => set("gallery", form.gallery.map((g, j) => (j === i ? { ...g, alt: e.target.value } : g)))}
                          />
                          <div className="flex flex-wrap gap-1">
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Move earlier" disabled={i === 0} onClick={() => moveGallery(i, -1)}><ArrowUp aria-hidden="true" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Move later" disabled={i === form.gallery.length - 1} onClick={() => moveGallery(i, 1)}><ArrowDown aria-hidden="true" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Use as main photo" onClick={() => makeFeatured(i)}><Star aria-hidden="true" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" aria-label="Remove photo" onClick={() => set("gallery", form.gallery.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" /></Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <FieldError message={errors.gallery} />
              </div>
            </div>
          </Section>

          <Section title="Stock">
            <ToggleRow
              id="track-stock"
              label="Track stock quantity"
              description="Stock goes down automatically when a payment is confirmed. Sells out at zero."
              checked={form.trackStock}
              onChange={(v) => set("trackStock", v)}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {form.trackStock ? (
                <Field label="Units in stock" name="stockQuantity" errors={errors}>
                  <input inputMode="numeric" className="admin-input" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} />
                </Field>
              ) : (
                <Field label="Availability" name="availability" errors={errors}>
                  <select className="admin-input" value={form.availability} onChange={(e) => set("availability", e.target.value as Availability)}>
                    {AVAILABILITIES.map((a) => <option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </Section>

          <Section title="Key features" description="Short highlights shown on the product card and page.">
            <ul className="grid gap-3">
              {form.features.map((f, i) => (
                <li key={i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-start">
                  <select aria-label="Icon" className="admin-input" value={f.icon} onChange={(e) => set("features", form.features.map((x, j) => (j === i ? { ...x, icon: e.target.value } : x)))}>
                    {FEATURE_ICONS.map((ic) => <option key={ic.key} value={ic.key}>{ic.label}</option>)}
                  </select>
                  <div className="grid gap-1" data-field={`features.${i}.label`}>
                    <input aria-label="Feature name" placeholder="e.g. Battery" className="admin-input" aria-invalid={!!errors[`features.${i}.label`]}
                      value={f.label} onChange={(e) => set("features", form.features.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <FieldError message={errors[`features.${i}.label`]} />
                  </div>
                  <div className="grid gap-1" data-field={`features.${i}.value`}>
                    <input aria-label="Feature detail" placeholder="e.g. 5 kWh lithium (LiFePO4)" className="admin-input" aria-invalid={!!errors[`features.${i}.value`]}
                      value={f.value} onChange={(e) => set("features", form.features.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                    <FieldError message={errors[`features.${i}.value`]} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove feature" onClick={() => set("features", form.features.filter((_, j) => j !== i))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" size="sm" className="mt-3" disabled={form.features.length >= 12}
              onClick={() => set("features", [...form.features, { icon: "panel", label: "", value: "" }])}>
              <Plus aria-hidden="true" /> Add feature
            </Button>
          </Section>

          <Section title="Solar specifications" description="Leave blank anything that doesn't apply. Only enter verified details.">
            <div className="grid gap-4 sm:grid-cols-2">
              {SPEC_FIELDS.map((s) => (
                <Field key={s.key} label={s.label} name={`specs.${s.key}`} errors={errors} wide={s.key === "includedComponents"}>
                  <input className="admin-input" placeholder={s.placeholder} value={form.specs[s.key] ?? ""} onChange={(e) => setSpec(s.key, e.target.value)} />
                </Field>
              ))}
            </div>
            <div className="mt-4">
              <ToggleRow id="install-included" label="Installation included in the price" checked={!!form.specs.installationIncluded} onChange={(v) => setSpec("installationIncluded", v)} />
            </div>
          </Section>
        </div>

        <aside className="grid gap-6 lg:sticky lg:top-6">
          <Section title="Publish">
            <dl className="mb-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Status</dt><dd><ProductStatusPill status={form.status} /></dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted-foreground">Customer pays</dt><dd className="font-bold">{price == null ? "Quote only" : Number.isFinite(price) ? naira.format(price) : "—"}</dd></div>
            </dl>
            <div className="grid gap-2">
              <Button type="button" className="h-11 font-bold" disabled={busy} onClick={() => save("publish")}>
                {saving === "publish" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {form.status === "published" ? "Update" : "Publish"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="font-bold" disabled={busy} onClick={() => save("draft")}>
                  {saving === "draft" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  {form.status === "published" ? "Unpublish" : "Save draft"}
                </Button>
                <Button type="button" variant="outline" className="font-bold" disabled={busy} onClick={() => save("preview")}>
                  {saving === "preview" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />} Preview
                </Button>
              </div>
              {form.status === "archived" && <p className="text-xs text-muted-foreground">This product is archived. Publishing or saving as a draft restores it.</p>}
            </div>
          </Section>

          <Section title="Display">
            <div className="grid gap-4">
              <ToggleRow id="featured" label="Feature in the shop" description="Shown first in product lists." checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} />
              <Field label="Badge" name="badge" errors={errors} hint='Optional label on the photo, e.g. "Best seller"'>
                <input className="admin-input" maxLength={30} value={form.badge} onChange={(e) => set("badge", e.target.value)} />
              </Field>
              <Field label="Sort order" name="sortOrder" errors={errors} hint="Lower numbers show first.">
                <input inputMode="numeric" className="admin-input" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
              </Field>
            </div>
          </Section>
        </aside>
      </div>
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="admin-box admin-box-pad">
      <h2 className="admin-box-title">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, name, errors, hint, wide, children }: { label: string; name: string; errors: Record<string, string>; hint?: string; wide?: boolean; children: ReactNode }) {
  const error = errors[name];
  return (
    <label className={cn("grid content-start gap-1.5", wide && "sm:col-span-2")} data-field={name} data-invalid={!!error || undefined}>
      <span className="admin-label">{label}</span>
      {children}
      {error ? <FieldError message={error} /> : hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function ToggleRow({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="grid gap-0.5">
        <span className="text-sm font-bold">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
