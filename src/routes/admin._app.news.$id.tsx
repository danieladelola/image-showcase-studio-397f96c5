import { useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, ImagePlus, LoaderCircle, Save, Send, X } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader, FieldError, ProductStatusPill } from "@/components/admin/admin-ui";
import { RichEditor } from "@/components/admin/rich-editor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, slugify } from "@/lib/admin-schemas";
import { adminUploadImage } from "@/lib/admin.functions";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, analyzeSeo, seoGrade } from "@/lib/post-seo";
import { POST_CATEGORIES, postInputSchema, type Post, type PostCategory, type PostStatus } from "@/lib/post-types";
import { adminSavePost } from "@/lib/posts.functions";
import { adminPostQuery } from "@/lib/posts.queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_app/news/$id")({
  loader: async ({ context, params }) => {
    if (params.id === "new") return null;
    const post = await context.queryClient.ensureQueryData(adminPostQuery(params.id));
    if (!post) throw notFound();
    return null;
  },
  head: () => ({
    meta: [
      { title: "Write post | RUWATA Admin" },
      { name: "description", content: "Write and edit a RUWATA news post." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Write post | RUWATA Admin" },
      { property: "og:description", content: "News post editor for RUWATA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => (
    <div className="admin-box admin-box-pad grid gap-3">
      <p className="font-bold">That post doesn’t exist.</p>
      <Link to="/admin/news" className="text-sm font-bold text-brand">Back to news</Link>
    </div>
  ),
  component: PostEditorPage,
});

function PostEditorPage() {
  const { id } = Route.useParams();
  if (id === "new") return <PostEditor key="new" initial={null} />;
  return <ExistingPost id={id} />;
}

function ExistingPost({ id }: { id: string }) {
  const { data } = useSuspenseQuery(adminPostQuery(id));
  return <PostEditor key={id} initial={data} />;
}

type Form = {
  title: string; slug: string; excerpt: string; contentHtml: string; category: PostCategory; tags: string;
  coverImage: { url: string; alt: string } | null; authorName: string; isFeatured: boolean; status: PostStatus;
  publishedAt: string; seoTitle: string; seoDescription: string; focusKeyword: string; seoKeywords: string;
};

/** ISO -> value for <input type="datetime-local"> in the browser's time zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const splitList = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

function toForm(p: Post | null): Form {
  return {
    title: p?.title ?? "", slug: p?.slug ?? "", excerpt: p?.excerpt ?? "", contentHtml: p?.contentHtml ?? "",
    category: p?.category ?? "guides", tags: p?.tags.join(", ") ?? "", coverImage: p?.coverImage ?? null,
    authorName: p?.authorName ?? "", isFeatured: p?.isFeatured ?? false, status: p?.status ?? "draft",
    publishedAt: toLocalInput(p?.publishedAt ?? null), seoTitle: p?.seoTitle ?? "", seoDescription: p?.seoDescription ?? "",
    focusKeyword: p?.focusKeyword ?? "", seoKeywords: p?.seoKeywords.join(", ") ?? "",
  };
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function PostEditor({ initial }: { initial: Post | null }) {
  const isNew = !initial;
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, setSaving] = useState<"draft" | "publish" | "preview" | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const saveFn = useServerFn(adminSavePost);
  const uploadFn = useServerFn(adminUploadImage);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setErrors(({ [key as string]: _, ...rest }) => rest);
  };

  async function uploadFile(file: File): Promise<string | null> {
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error(`${file.name}: please use a JPG, PNG or WebP image.`);
      return null;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`${file.name} is larger than 5 MB.`);
      return null;
    }
    try {
      const res = await uploadFn({ data: { filename: file.name, contentType: file.type as (typeof IMAGE_TYPES)[number], base64: await fileToBase64(file) } });
      if (!res.ok) {
        toast.error(res.message);
        return null;
      }
      return res.url;
    } catch {
      toast.error(`${file.name} couldn't be uploaded. Please try again.`);
      return null;
    }
  }

  async function uploadCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setCoverUploading(true);
    const url = await uploadFile(file);
    setCoverUploading(false);
    if (url) set("coverImage", { url, alt: form.coverImage?.alt || form.title });
  }

  const seo = useMemo(
    () => analyzeSeo({
      title: form.title, slug: form.slug, excerpt: form.excerpt, contentHtml: form.contentHtml, seoTitle: form.seoTitle,
      seoDescription: form.seoDescription, focusKeyword: form.focusKeyword, coverImageAlt: form.coverImage ? form.coverImage.alt : null,
    }),
    [form],
  );
  const grade = seoGrade(seo.score);

  async function save(action: "draft" | "publish" | "preview") {
    const status: PostStatus = action === "draft" ? "draft" : action === "publish" ? "published" : form.status;
    const parsed = postInputSchema.safeParse({
      title: form.title, slug: form.slug, excerpt: form.excerpt, contentHtml: form.contentHtml, category: form.category,
      tags: splitList(form.tags), coverImage: form.coverImage, authorName: form.authorName.trim() || null, isFeatured: form.isFeatured,
      status, publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
      seoTitle: form.seoTitle.trim() || null, seoDescription: form.seoDescription.trim() || null,
      focusKeyword: form.focusKeyword.trim() || null, seoKeywords: splitList(form.seoKeywords),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      toast.error("Please fix the highlighted fields.");
      document.querySelector<HTMLElement>(`[data-field="${Object.keys(next)[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const previewWindow = action === "preview" ? window.open("about:blank", "_blank") : null;
    setSaving(action);
    try {
      const res = await saveFn({ data: { id: initial?.id ?? null, post: parsed.data } });
      if (!res.ok) {
        previewWindow?.close();
        if ("field" in res && res.field) setErrors({ [res.field]: res.message });
        toast.error(res.message);
        return;
      }
      setErrors({});
      setForm((f) => ({ ...f, status: res.status, publishedAt: toLocalInput(res.publishedAt), authorName: res.authorName ?? "" }));
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["news"] })]);
      if (previewWindow) previewWindow.location.href = `/news/${res.slug}?preview=true`;
      const scheduled = res.status === "published" && res.publishedAt && new Date(res.publishedAt) > new Date();
      toast.success(action === "publish" ? (scheduled ? "Post scheduled" : "Post published on your News page") : action === "draft" ? "Saved as draft" : "Saved — preview opened in a new tab");
      if (isNew) await navigate({ to: "/admin/news/$id", params: { id: res.id }, replace: true });
    } catch {
      previewWindow?.close();
      toast.error("The post couldn't be saved. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  const busy = saving !== null || coverUploading;
  const seoTitleLen = (form.seoTitle || form.title).length;
  const seoDescLen = (form.seoDescription || form.excerpt).length;

  return (
    <>
      <Link to="/admin/news" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden="true" /> News
      </Link>
      <AdminHeader title={isNew ? "New post" : form.title || "Edit post"} actions={!isNew && <ProductStatusPill status={form.status} />} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="grid gap-6">
          <Section title="Post">
            <div className="grid gap-4">
              <Field label="Title" name="title" errors={errors}>
                <input
                  className="admin-input text-lg font-semibold"
                  value={form.title}
                  placeholder="e.g. How to size a solar system for your home"
                  onChange={(e) => {
                    set("title", e.target.value);
                    if (!slugTouched) set("slug", slugify(e.target.value));
                  }}
                />
              </Field>
              <Field label="Web address" name="slug" errors={errors} hint={`/news/${form.slug || "…"}`}>
                <input className="admin-input" value={form.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-")); }} />
              </Field>
              <div className="grid gap-1.5" data-field="contentHtml">
                <span className="admin-label">Content</span>
                <RichEditor initialHtml={form.contentHtml} onChange={(html) => set("contentHtml", html)} onUpload={uploadFile} invalid={!!errors.contentHtml} />
                <FieldError message={errors.contentHtml} />
              </div>
              <Field label="Summary" name="excerpt" errors={errors} hint="Shown on the News page and used as the search description if you don’t write one.">
                <textarea rows={3} className="admin-input" value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Search settings" description="How this post appears on Google.">
            <div className="grid gap-4">
              <Field label="Focus keyword" name="focusKeyword" errors={errors} hint="The main phrase people would search for, e.g. “solar inverter price in Nigeria”.">
                <input className="admin-input" value={form.focusKeyword} onChange={(e) => set("focusKeyword", e.target.value)} />
              </Field>
              <Field label="Extra keywords" name="seoKeywords" errors={errors} hint="Separate with commas.">
                <input className="admin-input" value={form.seoKeywords} onChange={(e) => set("seoKeywords", e.target.value)} />
              </Field>
              <Field label={`Search title (${seoTitleLen}/${SEO_TITLE_MAX})`} name="seoTitle" errors={errors} hint="Leave empty to use the post title.">
                <input className="admin-input" value={form.seoTitle} placeholder={form.title} onChange={(e) => set("seoTitle", e.target.value)} />
              </Field>
              <Field label={`Search description (${seoDescLen}/${SEO_DESCRIPTION_MAX})`} name="seoDescription" errors={errors} hint="Leave empty to use the summary.">
                <textarea rows={3} className="admin-input" value={form.seoDescription} placeholder={form.excerpt} onChange={(e) => set("seoDescription", e.target.value)} />
              </Field>
              <div className="rounded-xl border border-border bg-admin-canvas p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase">Google preview</p>
                <p className="mt-2 truncate text-xs text-success">ruwata · news › {form.slug || "post"}</p>
                <p className="truncate text-lg font-semibold text-brand-deep">{form.seoTitle || form.title || "Post title"}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{form.seoDescription || form.excerpt || "Add a summary or search description."}</p>
              </div>
            </div>
          </Section>
        </div>

        <div className="grid gap-6 lg:sticky lg:top-6">
          <Section title="Publish">
            <div className="grid gap-3">
              <Field label="Publish date" name="publishedAt" errors={errors} hint="Pick a future date to schedule. Empty publishes now.">
                <input type="datetime-local" className="admin-input" value={form.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} />
              </Field>
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="featured" className="grid gap-0.5">
                  <span className="text-sm font-bold">Feature this post</span>
                  <span className="text-xs text-muted-foreground">Shown first on the News page.</span>
                </label>
                <Switch id="featured" checked={form.isFeatured} onCheckedChange={(v) => set("isFeatured", v)} />
              </div>
              <div className="grid gap-2 pt-2">
                <Button onClick={() => save("publish")} disabled={busy} className="font-bold">
                  {saving === "publish" ? <LoaderCircle className="animate-spin" /> : <Send />} {form.status === "published" ? "Update" : "Publish"}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => save("draft")} disabled={busy}>
                    {saving === "draft" ? <LoaderCircle className="animate-spin" /> : <Save />} {form.status === "published" ? "Unpublish" : "Save draft"}
                  </Button>
                  <Button variant="outline" onClick={() => save("preview")} disabled={busy}>
                    {saving === "preview" ? <LoaderCircle className="animate-spin" /> : <Eye />} Preview
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          <Section title="SEO score">
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span className="seo-badge" data-tone={grade.tone}>{grade.label}</span>
                <span className="font-heading text-2xl font-bold">{seo.score}<span className="text-sm text-muted-foreground">/100</span></span>
              </div>
              <ul className="grid gap-2 text-sm">
                {seo.checks.map((c) => (
                  <li key={c.id} className="flex gap-2"><span className="seo-dot" data-tone={c.status} aria-hidden="true" /><span>{c.label}</span></li>
                ))}
              </ul>
            </div>
          </Section>

          <Section title="Details">
            <div className="grid gap-4">
              <Field label="Category" name="category" errors={errors}>
                <select className="admin-input" value={form.category} onChange={(e) => set("category", e.target.value as PostCategory)}>
                  {POST_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Tags" name="tags" errors={errors} hint="Separate with commas.">
                <input className="admin-input" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
              </Field>
              <Field label="Author" name="authorName" errors={errors} hint="Empty uses your admin name.">
                <input className="admin-input" value={form.authorName} onChange={(e) => set("authorName", e.target.value)} />
              </Field>
              <div className="grid gap-1.5" data-field="coverImage">
                <span className="admin-label">Cover photo</span>
                {form.coverImage ? (
                  <div className="grid gap-2">
                    <div className="relative overflow-hidden rounded-xl border border-border">
                      <img src={form.coverImage.url} alt="" className="aspect-[16/9] w-full object-cover" />
                      <Button variant="secondary" size="icon" className="absolute top-2 right-2" aria-label="Remove cover photo" onClick={() => set("coverImage", null)}><X /></Button>
                    </div>
                    <input className="admin-input" placeholder="Describe the photo (alt text)" value={form.coverImage.alt} onChange={(e) => set("coverImage", { url: form.coverImage!.url, alt: e.target.value })} />
                  </div>
                ) : (
                  <button type="button" className="rte-drop" disabled={coverUploading} onClick={() => coverInput.current?.click()}>
                    <span className="grid justify-items-center gap-2 text-sm font-bold text-muted-foreground">
                      {coverUploading ? <LoaderCircle className="size-6 animate-spin" /> : <ImagePlus className="size-6" />} {coverUploading ? "Uploading…" : "Upload cover photo"}
                    </span>
                  </button>
                )}
                <input ref={coverInput} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={(e) => { void uploadCover(e.target.files); e.target.value = ""; }} />
              </div>
            </div>
          </Section>
        </div>
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

function Field({ label, name, errors, hint, children }: { label: string; name: string; errors: Record<string, string>; hint?: string; children: ReactNode }) {
  const error = errors[name];
  return (
    <label className={cn("grid content-start gap-1.5")} data-field={name} data-invalid={!!error || undefined}>
      <span className="admin-label">{label}</span>
      {children}
      {error ? <FieldError message={error} /> : hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
