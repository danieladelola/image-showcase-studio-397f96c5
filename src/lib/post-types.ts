import { z } from "zod";

import { imageSchema, slugField } from "./admin-schemas";
import { htmlToText } from "./post-seo";

export const POST_STATUSES = ["draft", "published", "archived"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_CATEGORIES = [
  { key: "guides", label: "Solar Guides" },
  { key: "company", label: "Company Updates" },
  { key: "projects", label: "Project Stories" },
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number]["key"];
export const POST_CATEGORY_KEYS = POST_CATEGORIES.map((c) => c.key) as [PostCategory, ...PostCategory[]];
export const categoryLabel = (key: string) => POST_CATEGORIES.find((c) => c.key === key)?.label ?? "News";

/** A post as listed on the website (no body). */
export type PostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: PostCategory;
  tags: string[];
  coverImage: { url: string; alt: string } | null;
  authorName: string | null;
  isFeatured: boolean;
  readingMinutes: number;
  publishedAt: string | null;
};

export type Post = PostSummary & {
  contentHtml: string;
  status: PostStatus;
  seoTitle: string | null;
  seoDescription: string | null;
  focusKeyword: string | null;
  seoKeywords: string[];
  createdAt: string;
  updatedAt: string;
};

const tag = z.string().trim().min(1).max(60);

export const postInputSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a title.").max(160, "Keep the title under 160 characters."),
    slug: slugField,
    excerpt: z.string().trim().max(320, "Keep the summary under 320 characters.").default(""),
    contentHtml: z.string().max(400_000, "This post is too long."),
    category: z.enum(POST_CATEGORY_KEYS),
    tags: z.array(tag).max(15, "Add up to 15 tags."),
    coverImage: imageSchema.nullable(),
    authorName: z.string().trim().max(80).nullable(),
    isFeatured: z.boolean(),
    status: z.enum(POST_STATUSES),
    publishedAt: z.string().datetime({ offset: true }).nullable(),
    seoTitle: z.string().trim().max(120, "Keep the SEO title under 120 characters.").nullable(),
    seoDescription: z.string().trim().max(320, "Keep the meta description under 320 characters.").nullable(),
    focusKeyword: z.string().trim().max(80).nullable(),
    seoKeywords: z.array(tag).max(20, "Add up to 20 keywords."),
  })
  .superRefine((p, ctx) => {
    if (p.status === "published" && htmlToText(p.contentHtml).length < 20) {
      ctx.addIssue({ code: "custom", path: ["contentHtml"], message: "Write the post before publishing it." });
    }
  });
export type PostInput = z.input<typeof postInputSchema>;
