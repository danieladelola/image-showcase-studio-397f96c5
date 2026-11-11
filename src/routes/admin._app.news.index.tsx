import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, ArchiveRestore, Eye, EyeOff, MoreHorizontal, Newspaper, Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
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
import { seoGrade } from "@/lib/post-seo";
import { POST_CATEGORIES, categoryLabel, type PostStatus } from "@/lib/post-types";
import { adminDeletePost, adminSetPostStatus, type AdminPostRow } from "@/lib/posts.functions";
import { adminPostsQuery } from "@/lib/posts.queries";

export const Route = createFileRoute("/admin/_app/news/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminPostsQuery),
  head: () => ({
    meta: [
      { title: "News posts | RUWATA Admin" },
      { name: "description", content: "Write and manage RUWATA news posts and solar guides." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "News posts | RUWATA Admin" },
      { property: "og:description", content: "News post management for RUWATA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostsPage,
});

const isScheduled = (p: AdminPostRow) => p.status === "published" && !!p.publishedAt && new Date(p.publishedAt) > new Date();

function PostsPage() {
  const { data: posts } = useSuspenseQuery(adminPostsQuery);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | PostStatus | "all">("active");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<AdminPostRow | null>(null);
  const setStatusFn = useServerFn(adminSetPostStatus);
  const deleteFn = useServerFn(adminDeletePost);
  const qc = useQueryClient();
  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["news"] })]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (status === "active" ? p.status === "archived" : status !== "all" && p.status !== status) return false;
      if (category !== "all" && p.category !== category) return false;
      if (term && ![p.title, p.slug, p.focusKeyword ?? "", ...p.tags].some((v) => v.toLowerCase().includes(term))) return false;
      return true;
    });
  }, [posts, q, status, category]);

  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  async function changeStatus(p: AdminPostRow, next: PostStatus) {
    const res = await setStatusFn({ data: { id: p.id, status: next } });
    if (!res.ok) return void toast.error(res.message);
    await invalidate();
    toast.success(next === "published" ? `“${p.title}” is live` : next === "archived" ? "Post archived" : "Moved to drafts");
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const p = toDelete;
    setToDelete(null);
    await deleteFn({ data: { id: p.id } });
    await invalidate();
    toast.success("Post deleted");
  }

  const counts = {
    active: posts.filter((p) => p.status !== "archived").length,
    published: posts.filter((p) => p.status === "published").length,
    draft: posts.filter((p) => p.status === "draft").length,
    archived: posts.filter((p) => p.status === "archived").length,
  };

  return (
    <>
      <AdminHeader
        title="News"
        description={`${counts.published} published · ${counts.draft} drafts · ${counts.archived} archived`}
        actions={
          <Button asChild className="font-bold">
            <Link to="/admin/news/$id" params={{ id: "new" }}><Plus aria-hidden="true" /> New post</Link>
          </Button>
        }
      />
      <div className="admin-box">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search posts</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input className="admin-input pl-9" placeholder="Search by title, tag or keyword" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
          </label>
          <select aria-label="Status" className="admin-input w-auto" value={status} onChange={(e) => reset(setStatus)(e.target.value as typeof status)}>
            <option value="active">All except archived ({counts.active})</option>
            <option value="published">Published ({counts.published})</option>
            <option value="draft">Drafts ({counts.draft})</option>
            <option value="archived">Archived ({counts.archived})</option>
            <option value="all">Everything ({posts.length})</option>
          </select>
          <select aria-label="Category" className="admin-input w-auto" value={category} onChange={(e) => reset(setCategory)(e.target.value)}>
            <option value="all">All categories</option>
            {POST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Newspaper className="size-5" />} title={posts.length ? "No posts match" : "No posts yet"}>
            {posts.length ? "Try a different search or filter." : "Write your first solar guide or company update."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>Post</th><th>Category</th><th>SEO</th><th>Status</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const grade = seoGrade(p.seoScore);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="flex min-w-64 items-center gap-3">
                          <span className="admin-thumb">
                            {p.coverImage ? <img src={p.coverImage.url} alt="" loading="lazy" /> : <span className="grid size-full place-items-center"><Newspaper className="size-5 text-muted-foreground" aria-hidden="true" /></span>}
                          </span>
                          <span className="grid">
                            <Link to="/admin/news/$id" params={{ id: p.id }} className="font-bold text-foreground hover:text-brand">{p.title}</Link>
                            <span className="text-xs text-muted-foreground">{p.readingMinutes} min read{p.isFeatured ? " · Featured" : ""}</span>
                          </span>
                        </div>
                      </td>
                      <td className="text-muted-foreground">{categoryLabel(p.category)}</td>
                      <td><span className="seo-badge" data-tone={grade.tone}>{grade.label}</span></td>
                      <td>{isScheduled(p) ? <span className="seo-badge" data-tone="ok">Scheduled</span> : <ProductStatusPill status={p.status} />}</td>
                      <td className="whitespace-nowrap text-muted-foreground">{formatDate(p.publishedAt ?? p.updatedAt)}</td>
                      <td className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Actions for ${p.title}`}><MoreHorizontal aria-hidden="true" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild><Link to="/admin/news/$id" params={{ id: p.id }}><Pencil aria-hidden="true" /> Edit</Link></DropdownMenuItem>
                            <DropdownMenuItem asChild><a href={`/news/${p.slug}?preview=true`} target="_blank" rel="noopener noreferrer"><Eye aria-hidden="true" /> Preview</a></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {p.status !== "published" && <DropdownMenuItem onSelect={() => changeStatus(p, "published")}><Send aria-hidden="true" /> Publish</DropdownMenuItem>}
                            {p.status === "published" && <DropdownMenuItem onSelect={() => changeStatus(p, "draft")}><EyeOff aria-hidden="true" /> Unpublish</DropdownMenuItem>}
                            {p.status === "archived" ? (
                              <DropdownMenuItem onSelect={() => changeStatus(p, "draft")}><ArchiveRestore aria-hidden="true" /> Restore to drafts</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => changeStatus(p, "archived")}><Archive aria-hidden="true" /> Archive</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setToDelete(p)} className="text-destructive focus:text-destructive"><Trash2 aria-hidden="true" /> Delete</DropdownMenuItem>
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
        <Pager page={current} total={filtered.length} onPage={setPage} noun="posts" />
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{toDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This removes the post for good. To hide it but keep it, archive it instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep post</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete post</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
