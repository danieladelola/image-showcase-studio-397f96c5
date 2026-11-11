import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArchiveRestore, Eye, EyeOff, MoreHorizontal, Package, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader, EmptyState, PAGE_SIZE, Pager, ProductStatusPill, formatDate } from "@/components/admin/admin-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useInvalidateCatalog } from "@/hooks/use-invalidate-catalog";
import { adminDeleteProduct, adminSetProductStatus } from "@/lib/admin.functions";
import { adminCategoriesQuery, adminProductsQuery } from "@/lib/admin.queries";
import { STOCK_LABEL, hasDiscount, sellingPrice, stockState } from "@/lib/product-rules";
import { naira, type AdminProduct, type ProductStatus } from "@/lib/shop-types";

export const Route = createFileRoute("/admin/_app/products/")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(adminProductsQuery), context.queryClient.ensureQueryData(adminCategoriesQuery)]),
  head: () => ({
    meta: [
      { title: "Products | RUWATA Admin" },
      { name: "description", content: "Manage RUWATA products, prices, stock and visibility." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Products | RUWATA Admin" },
      { property: "og:description", content: "Product management for the RUWATA store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

type Sort = "updated" | "name" | "price-asc" | "price-desc" | "stock";

function ProductsPage() {
  const { data: products } = useSuspenseQuery(adminProductsQuery);
  const { data: categories } = useSuspenseQuery(adminCategoriesQuery);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | ProductStatus | "all">("active");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState<"all" | "in_stock" | "out_of_stock" | "preorder" | "quote">("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<AdminProduct | null>(null);

  const setStatusFn = useServerFn(adminSetProductStatus);
  const deleteFn = useServerFn(adminDeleteProduct);
  const invalidate = useInvalidateCatalog();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = products.filter((p) => {
      if (status === "active" ? p.status === "archived" : status !== "all" && p.status !== status) return false;
      if (category !== "all" && (category === "none" ? p.categoryId !== null : p.categoryId !== category)) return false;
      if (stock !== "all") {
        if (stock === "quote") return sellingPrice(p) == null;
        if (sellingPrice(p) == null || stockState(p) !== stock) return false;
      }
      if (term && ![p.name, p.sku ?? "", p.slug, p.categoryName ?? ""].some((v) => v.toLowerCase().includes(term))) return false;
      return true;
    });
    const price = (p: AdminProduct) => sellingPrice(p) ?? -1;
    return list.sort((a, b) => {
      switch (sort) {
        case "name": return a.name.localeCompare(b.name);
        case "price-asc": return price(a) - price(b);
        case "price-desc": return price(b) - price(a);
        case "stock": return a.stockQuantity - b.stockQuantity;
        default: return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
  }, [products, q, status, category, stock, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  async function changeStatus(p: AdminProduct, next: ProductStatus) {
    const res = await setStatusFn({ data: { id: p.id, status: next } });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    await invalidate();
    toast.success(next === "published" ? `${p.name} is now live` : next === "archived" ? `${p.name} archived` : `${p.name} moved to drafts`);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const p = toDelete;
    setToDelete(null);
    const res = await deleteFn({ data: { id: p.id } });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    await invalidate();
    toast.success(`${p.name} deleted`);
  }

  const counts = {
    active: products.filter((p) => p.status !== "archived").length,
    published: products.filter((p) => p.status === "published").length,
    draft: products.filter((p) => p.status === "draft").length,
    archived: products.filter((p) => p.status === "archived").length,
  };

  return (
    <>
      <AdminHeader
        title="Products"
        description={`${counts.published} published · ${counts.draft} drafts · ${counts.archived} archived`}
        actions={
          <Button asChild className="font-bold">
            <Link to="/admin/products/$id" params={{ id: "new" }}><Plus aria-hidden="true" /> Add product</Link>
          </Button>
        }
      />

      <div className="admin-box">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search products</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input className="admin-input pl-9" placeholder="Search by name, SKU or category" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} />
          </label>
          <select aria-label="Visibility" className="admin-input w-auto" value={status} onChange={(e) => resetPage(setStatus)(e.target.value as typeof status)}>
            <option value="active">All except archived ({counts.active})</option>
            <option value="published">Published ({counts.published})</option>
            <option value="draft">Drafts ({counts.draft})</option>
            <option value="archived">Archived ({counts.archived})</option>
            <option value="all">Everything ({products.length})</option>
          </select>
          <select aria-label="Category" className="admin-input w-auto" value={category} onChange={(e) => resetPage(setCategory)(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">No category</option>
          </select>
          <select aria-label="Stock" className="admin-input w-auto" value={stock} onChange={(e) => resetPage(setStock)(e.target.value as typeof stock)}>
            <option value="all">Any stock</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="preorder">Pre-order</option>
            <option value="quote">No price yet</option>
          </select>
          <select aria-label="Sort" className="admin-input w-auto" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="updated">Recently updated</option>
            <option value="name">Name A–Z</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="stock">Stock: lowest first</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Package className="size-5" />} title={products.length ? "No products match" : "No products yet"}>
            {products.length ? "Try a different search or filter." : "Add your first product to start selling."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Visibility</th><th>Updated</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const price = sellingPrice(p);
                  const state = stockState(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex min-w-56 items-center gap-3">
                          <span className="admin-thumb">
                            {p.featuredImage ? <img src={p.featuredImage.url} alt="" loading="lazy" /> : <span className="grid size-full place-items-center"><Package className="size-5 text-muted-foreground" aria-hidden="true" /></span>}
                          </span>
                          <span className="grid">
                            <Link to="/admin/products/$id" params={{ id: p.id }} className="font-bold text-foreground hover:text-brand">{p.name}</Link>
                            {p.isFeatured && <span className="text-xs font-bold text-warning">Featured</span>}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">{p.sku ?? "—"}</td>
                      <td className="text-muted-foreground">{p.categoryName ?? "—"}</td>
                      <td className="whitespace-nowrap">
                        {price == null ? (
                          <span className="font-bold text-destructive">No price yet</span>
                        ) : (
                          <span className="grid">
                            <span className="font-bold">{naira.format(price)}</span>
                            {hasDiscount(p) && <span className="text-xs text-muted-foreground line-through">{naira.format(p.price!)}</span>}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={state === "in_stock" ? "text-success font-bold" : state === "out_of_stock" ? "font-bold text-destructive" : "font-bold text-warning"}>
                          {p.trackStock ? `${p.stockQuantity} in stock` : STOCK_LABEL[state]}
                        </span>
                      </td>
                      <td><ProductStatusPill status={p.status} /></td>
                      <td className="whitespace-nowrap text-muted-foreground">{formatDate(p.updatedAt)}</td>
                      <td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${p.name}`}><MoreHorizontal aria-hidden="true" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link to="/admin/products/$id" params={{ id: p.id }}><Pencil aria-hidden="true" /> Edit</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/our-products/${p.slug}?preview=true`} target="_blank" rel="noopener noreferrer"><Eye aria-hidden="true" /> Preview</a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {p.status !== "published" && (
                              <DropdownMenuItem onSelect={() => changeStatus(p, "published")}><Send aria-hidden="true" /> Publish</DropdownMenuItem>
                            )}
                            {p.status === "published" && (
                              <DropdownMenuItem onSelect={() => changeStatus(p, "draft")}><EyeOff aria-hidden="true" /> Unpublish</DropdownMenuItem>
                            )}
                            {p.status === "archived" ? (
                              <DropdownMenuItem onSelect={() => changeStatus(p, "draft")}><ArchiveRestore aria-hidden="true" /> Restore to drafts</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => changeStatus(p, "archived")}><Archive aria-hidden="true" /> Archive</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={p.hasOrders} onSelect={() => setToDelete(p)} className="text-destructive focus:text-destructive">
                              <Trash2 aria-hidden="true" /> {p.hasOrders ? "Has orders — archive instead" : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={current} total={filtered.length} onPage={setPage} noun="products" />
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the product for good. If you might sell it again, archive it instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep product</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete product</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
