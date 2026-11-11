import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { analyzeSeo, readingMinutes } from "./post-seo";
import { POST_CATEGORY_KEYS, POST_STATUSES, postInputSchema, type Post, type PostStatus, type PostSummary } from "./post-types";

async function postsDb() {
  const db = await import("./db.server");
  const posts = await import("./posts.server");
  return { ...db, ...posts };
}

async function adminPostsDb() {
  const { requireAdmin } = await import("./admin-session.server");
  const admin = await requireAdmin();
  return { ...(await postsDb()), admin };
}

/* ---------------- Public website ---------------- */

export const listPublicPosts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ category: z.enum(POST_CATEGORY_KEYS).optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { withDb, POST_SUMMARY_COLUMNS, PUBLIC_POST_WHERE, mapPostSummary } = await postsDb();
    return withDb(async (sql) => {
      const rows = await sql.unsafe(
        `SELECT ${POST_SUMMARY_COLUMNS} FROM posts WHERE ${PUBLIC_POST_WHERE} ${data.category ? "AND category = $1" : ""}
         ORDER BY is_featured DESC, published_at DESC LIMIT 60`,
        data.category ? [data.category] : [],
      );
      return rows.map(mapPostSummary);
    });
  });

export const getPublicPost = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(200), preview: z.boolean().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { withDb, POST_COLUMNS, POST_SUMMARY_COLUMNS, PUBLIC_POST_WHERE, mapPost, mapPostSummary } = await postsDb();
    const { getRequest } = await import("@tanstack/react-start/server");
    const url = new URL(getRequest().url);
    const sandboxHost = url.hostname === "localhost" ? getRequest().headers.get("x-forwarded-host") : null;
    const origin = sandboxHost ? `https://${sandboxHost}` : url.origin;
    // Drafts and scheduled posts are only visible to a signed-in admin previewing them.
    let canPreview = false;
    if (data.preview) {
      const { currentAdmin } = await import("./admin-session.server");
      canPreview = !!(await currentAdmin());
    }
    return withDb(async (sql) => {
      const rows = await sql.unsafe(`SELECT ${POST_COLUMNS} FROM posts WHERE slug = $1 ${canPreview ? "" : `AND ${PUBLIC_POST_WHERE}`}`, [data.slug]);
      if (!rows[0]) return { post: null, related: [] as PostSummary[], preview: false, origin };
      const post = mapPost(rows[0]);
      const related = await sql.unsafe(
        `SELECT ${POST_SUMMARY_COLUMNS} FROM posts WHERE ${PUBLIC_POST_WHERE} AND id <> $1
         ORDER BY (category = $2) DESC, published_at DESC LIMIT 3`,
        [post.id, post.category],
      );
      const isLive = post.status === "published" && !!post.publishedAt && new Date(post.publishedAt) <= new Date();
      return { post, related: related.map(mapPostSummary), preview: canPreview && !isLive, origin };
    });
  });

/* ---------------- Admin ---------------- */

export type AdminPostRow = PostSummary & { status: PostStatus; seoScore: number; focusKeyword: string | null; updatedAt: string };

export const adminListPosts = createServerFn({ method: "GET" }).handler(async () => {
  const { withDb, POST_COLUMNS, mapPost } = await adminPostsDb();
  return withDb(async (sql) => {
    const rows = await sql.unsafe(`SELECT ${POST_COLUMNS} FROM posts ORDER BY coalesce(published_at, updated_at) DESC LIMIT 1000`);
    return rows.map((r): AdminPostRow => {
      const { contentHtml, seoTitle, seoDescription, seoKeywords: _k, createdAt: _c, ...p } = mapPost(r);
      const { score } = analyzeSeo({
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        contentHtml,
        seoTitle: seoTitle ?? "",
        seoDescription: seoDescription ?? "",
        focusKeyword: p.focusKeyword ?? "",
        coverImageAlt: p.coverImage ? p.coverImage.alt : null,
      });
      return { ...p, seoScore: score };
    });
  });
});

export const adminGetPost = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { withDb, POST_COLUMNS, mapPost } = await adminPostsDb();
    return withDb(async (sql) => {
      const rows = await sql.unsafe(`SELECT ${POST_COLUMNS} FROM posts WHERE id = $1`, [data.id]);
      return rows[0] ? (mapPost(rows[0]) as Post) : null;
    });
  });

export const adminSavePost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid().nullable(), post: postInputSchema }).parse(input))
  .handler(async ({ data }) => {
    const { withDb, sanitizePostHtml, admin } = await adminPostsDb();
    const p = data.post;
    const content = sanitizePostHtml(p.contentHtml);
    const minutes = readingMinutes(content);
    const tags = [...new Set(p.tags.map((t) => t.trim()).filter(Boolean))];
    const keywords = [...new Set(p.seoKeywords.map((t) => t.trim()).filter(Boolean))];
    const author = p.authorName || admin.name || null;
    // Publishing without a date publishes now; drafts keep any chosen date for later.
    const publishedAt = p.publishedAt ? new Date(p.publishedAt) : p.status === "published" ? new Date() : null;
    const cover = p.coverImage;
    try {
      const row = await withDb(async (sql) => {
        if (data.id) {
          const rows = await sql`
            UPDATE posts SET title = ${p.title}, slug = ${p.slug}, excerpt = ${p.excerpt}, content_html = ${content},
              category = ${p.category}, tags = ${tags}, cover_image_url = ${cover?.url ?? null},
              cover_image_alt = ${cover ? cover.alt || p.title : null}, author_name = ${author}, status = ${p.status},
              is_featured = ${p.isFeatured}, reading_minutes = ${minutes}, published_at = ${publishedAt},
              seo_title = ${p.seoTitle || null}, seo_description = ${p.seoDescription || null},
              focus_keyword = ${p.focusKeyword || null}, seo_keywords = ${keywords}, updated_at = now()
            WHERE id = ${data.id} RETURNING id, published_at`;
          return rows[0];
        }
        const rows = await sql`
          INSERT INTO posts (title, slug, excerpt, content_html, category, tags, cover_image_url, cover_image_alt, author_name,
            status, is_featured, reading_minutes, published_at, seo_title, seo_description, focus_keyword, seo_keywords)
          VALUES (${p.title}, ${p.slug}, ${p.excerpt}, ${content}, ${p.category}, ${tags}, ${cover?.url ?? null},
            ${cover ? cover.alt || p.title : null}, ${author}, ${p.status}, ${p.isFeatured}, ${minutes}, ${publishedAt},
            ${p.seoTitle || null}, ${p.seoDescription || null}, ${p.focusKeyword || null}, ${keywords})
          RETURNING id, published_at`;
        return rows[0];
      });
      if (!row) return { ok: false as const, message: "That post no longer exists." };
      return {
        ok: true as const,
        id: String(row.id),
        slug: p.slug,
        status: p.status,
        publishedAt: row.published_at ? new Date(row.published_at as string).toISOString() : null,
        contentHtml: content,
        authorName: author,
      };
    } catch (e) {
      if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505") {
        return { ok: false as const, field: "slug", message: "Another post already uses that web address." };
      }
      console.error("Post save failed", e);
      return { ok: false as const, message: "The post couldn't be saved. Please try again." };
    }
  });

export const adminSetPostStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), status: z.enum(POST_STATUSES) }).parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminPostsDb();
    const rows = await withDb(
      (sql) => sql`
        UPDATE posts SET status = ${data.status}, updated_at = now(),
          published_at = CASE WHEN ${data.status} = 'published' THEN coalesce(published_at, now()) ELSE published_at END
        WHERE id = ${data.id} RETURNING id`,
    );
    return rows[0] ? { ok: true as const } : { ok: false as const, message: "That post no longer exists." };
  });

export const adminDeletePost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await adminPostsDb();
    await withDb((sql) => sql`DELETE FROM posts WHERE id = ${data.id}`);
    return { ok: true as const };
  });
