import sanitizeHtml from "sanitize-html";

import type { Post, PostCategory, PostStatus, PostSummary } from "./post-types";

type Row = Record<string, unknown>;

export const POST_SUMMARY_COLUMNS = `id, title, slug, excerpt, category, tags, cover_image_url, cover_image_alt, author_name,
  is_featured, reading_minutes, published_at`;
export const POST_COLUMNS = `${POST_SUMMARY_COLUMNS}, content_html, status, seo_title, seo_description, focus_keyword,
  seo_keywords, created_at, updated_at`;

/** Published and not scheduled for later. */
export const PUBLIC_POST_WHERE = `status = 'published' AND published_at IS NOT NULL AND published_at <= now()`;

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

export function mapPostSummary(r: Row): PostSummary {
  return {
    id: String(r.id),
    title: String(r.title),
    slug: String(r.slug),
    excerpt: String(r.excerpt ?? ""),
    category: String(r.category) as PostCategory,
    tags: strArr(r.tags),
    coverImage: r.cover_image_url ? { url: String(r.cover_image_url), alt: String(r.cover_image_alt ?? "") } : null,
    authorName: (r.author_name as string | null) ?? null,
    isFeatured: Boolean(r.is_featured),
    readingMinutes: Number(r.reading_minutes ?? 1),
    publishedAt: iso(r.published_at),
  };
}

export function mapPost(r: Row): Post {
  return {
    ...mapPostSummary(r),
    contentHtml: String(r.content_html ?? ""),
    status: String(r.status) as PostStatus,
    seoTitle: (r.seo_title as string | null) ?? null,
    seoDescription: (r.seo_description as string | null) ?? null,
    focusKeyword: (r.focus_keyword as string | null) ?? null,
    seoKeywords: strArr(r.seo_keywords),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
  };
}

const YOUTUBE_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"];

/** Cleans editor HTML so only safe formatting, links, images, tables and YouTube embeds remain. */
export function sanitizePostHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "mark", "a", "ul", "ol", "li", "blockquote",
      "pre", "code", "hr", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col",
      "iframe", "div", "span", "sub", "sup",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      iframe: ["src", "width", "height", "allowfullscreen", "frameborder", "allow", "title"],
      th: ["colspan", "rowspan", "colwidth"],
      td: ["colspan", "rowspan", "colwidth"],
      ol: ["start", "type"],
      div: ["data-youtube-video"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": { "text-align": [/^(left|right|center|justify)$/] },
      col: { width: [/^\d+(px|%)$/], "min-width": [/^\d+(px|%)$/] },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"], iframe: ["https"] },
    allowProtocolRelative: false,
    allowedIframeHostnames: YOUTUBE_HOSTS,
    allowIframeRelativeUrls: false,
    transformTags: {
      h1: "h2",
      h5: "h4",
      h6: "h4",
      a: (tagName, attribs) => {
        const external = /^https?:\/\//i.test(attribs.href ?? "");
        const next = { ...attribs };
        if (attribs.target === "_blank" || external) {
          next.target = "_blank";
          next.rel = "noopener noreferrer";
        } else {
          delete next.target;
          delete next.rel;
        }
        return { tagName, attribs: next };
      },
    },
  }).trim();
}
