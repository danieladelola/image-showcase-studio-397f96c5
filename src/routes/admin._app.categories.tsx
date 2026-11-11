import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FolderTree, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader, EmptyState, FieldError } from "@/components/admin/admin-ui";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInvalidateCatalog } from "@/hooks/use-invalidate-catalog";
import { categoryInputSchema, slugify } from "@/lib/admin-schemas";
import { adminDeleteCategory, adminSaveCategory } from "@/lib/admin.functions";
import { adminCategoriesQuery } from "@/lib/admin.queries";
import type { Category } from "@/lib/shop-types";

export const Route = createFileRoute("/admin/_app/categories")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminCategoriesQuery),
  head: () => ({
    meta: [
      { title: "Categories | RUWATA Admin" },
      { name: "description", content: "Organise RUWATA products into shop categories." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Categories | RUWATA Admin" },
      { property: "og:description", content: "Category management for the RUWATA store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CategoriesPage,
});

type Draft = { id: string | null; name: string; slug: string; description: string; sortOrder: string; slugTouched: boolean };

function CategoriesPage() {
  const { data: categories } = useSuspenseQuery(adminCategoriesQuery);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const saveFn = useServerFn(adminSaveCategory);
  const deleteFn = useServerFn(adminDeleteCategory);
  const invalidate = useInvalidateCatalog();

  const open = (c: Category | null) => {
    setErrors({});
    setDraft(
      c
        ? { id: c.id, name: c.name, slug: c.slug, description: c.description, sortOrder: String(c.sortOrder), slugTouched: true }
        : { id: null, name: "", slug: "", description: "", sortOrder: String(categories.length + 1), slugTouched: false },
    );
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const parsed = categoryInputSchema.safeParse({ ...draft, sortOrder: Number(draft.sortOrder || 0) });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      const res = await saveFn({ data: { id: draft.id, category: parsed.data } });
      if (!res.ok) {
        setErrors({ slug: res.message });
        return;
      }
      await invalidate();
      toast.success(draft.id ? "Category updated" : "Category added");
      setDraft(null);
    } catch {
      toast.error("The category couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const c = toDelete;
    setToDelete(null);
    await deleteFn({ data: { id: c.id } });
    await invalidate();
    toast.success(`${c.name} deleted`);
  }

  return (
    <>
      <AdminHeader
        title="Categories"
        description="Group products so customers can filter the shop."
        actions={<Button className="font-bold" onClick={() => open(null)}><Plus aria-hidden="true" /> Add category</Button>}
      />

      <div className="admin-box overflow-hidden">
        {categories.length === 0 ? (
          <EmptyState icon={<FolderTree className="size-5" />} title="No categories yet">Add one to start organising your products.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Web address</th><th>Products</th><th>Order</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="grid">
                        <span className="font-bold">{c.name}</span>
                        {c.description && <span className="max-w-md truncate text-xs text-muted-foreground">{c.description}</span>}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">{c.slug}</td>
                    <td>{c.productCount}</td>
                    <td className="text-muted-foreground">{c.sortOrder}</td>
                    <td className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => open(c)}><Pencil aria-hidden="true" /></Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} className="text-destructive" onClick={() => setToDelete(c)}><Trash2 aria-hidden="true" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <form onSubmit={submit} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{draft?.id ? "Edit category" : "Add category"}</DialogTitle>
              <DialogDescription>Categories appear as filters on the shop page.</DialogDescription>
            </DialogHeader>
            {draft && (
              <>
                <label className="grid gap-1.5">
                  <span className="admin-label">Name</span>
                  <input className="admin-input" aria-invalid={!!errors.name} value={draft.name} autoFocus
                    onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.slugTouched ? draft.slug : slugify(e.target.value) })} />
                  <FieldError message={errors.name} />
                </label>
                <label className="grid gap-1.5">
                  <span className="admin-label">Web address</span>
                  <input className="admin-input" aria-invalid={!!errors.slug} value={draft.slug}
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/\s+/g, "-"), slugTouched: true })} />
                  <FieldError message={errors.slug} />
                </label>
                <label className="grid gap-1.5">
                  <span className="admin-label">Description <span className="font-normal text-muted-foreground">(optional)</span></span>
                  <textarea rows={2} className="admin-input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </label>
                <label className="grid gap-1.5">
                  <span className="admin-label">Display order</span>
                  <input inputMode="numeric" className="admin-input w-32" aria-invalid={!!errors.sortOrder} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} />
                  <FieldError message={errors.sortOrder} />
                </label>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="font-bold">
                {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />} Save category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.productCount
                ? `Its ${toDelete.productCount} ${toDelete.productCount === 1 ? "product stays" : "products stay"} in the shop without a category.`
                : "This category has no products."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep category</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
