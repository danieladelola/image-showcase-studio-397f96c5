// SEO helpers for news posts: plain-text extraction, reading time and a
// Yoast-style checklist shown in the admin editor. Pure functions (no DOM).
import { slugify } from "./admin-schemas";

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

export function htmlToText(html: string) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|blockquote|div|tr)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

export const countWords = (text: string) => (text ? text.split(/\s+/).filter(Boolean).length : 0);

/** Minutes to read at 200 words a minute, never less than 1. */
export const readingMinutes = (html: string) => Math.max(1, Math.round(countWords(htmlToText(html)) / 200));

export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

export type SeoStatus = "good" | "ok" | "bad";
export type SeoCheck = { id: string; status: SeoStatus; label: string };

export type SeoInput = {
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  coverImageAlt: string | null;
};

const includes = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

function occurrences(text: string, keyword: string) {
  const t = text.toLowerCase();
  const k = keyword.toLowerCase();
  let n = 0;
  for (let i = t.indexOf(k); i !== -1; i = t.indexOf(k, i + k.length)) n++;
  return n;
}

export function analyzeSeo(p: SeoInput): { score: number; checks: SeoCheck[] } {
  const title = (p.seoTitle || p.title).trim();
  const description = (p.seoDescription || p.excerpt).trim();
  const text = htmlToText(p.contentHtml);
  const words = countWords(text);
  const keyword = p.focusKeyword.trim();
  const checks: SeoCheck[] = [];
  const add = (id: string, status: SeoStatus, label: string) => checks.push({ id, status, label });

  if (!keyword) {
    add("keyword", "bad", "Add a focus keyword — the main phrase people would search for.");
  } else {
    add("keyword-title", includes(title, keyword) ? "good" : "bad", includes(title, keyword) ? "Focus keyword is in the SEO title." : "Put the focus keyword in the SEO title.");
    add(
      "keyword-description",
      includes(description, keyword) ? "good" : "bad",
      includes(description, keyword) ? "Focus keyword is in the meta description." : "Put the focus keyword in the meta description.",
    );
    const inSlug = p.slug.includes(slugify(keyword));
    add("keyword-slug", inSlug ? "good" : "ok", inSlug ? "Focus keyword is in the web address." : "Consider adding the focus keyword to the web address.");
    const firstPara = htmlToText(/<p[^>]*>([\s\S]*?)<\/p>/i.exec(p.contentHtml)?.[1] ?? "");
    add(
      "keyword-intro",
      includes(firstPara, keyword) ? "good" : "ok",
      includes(firstPara, keyword) ? "Focus keyword appears in the first paragraph." : "Mention the focus keyword in the first paragraph.",
    );
    const headings = [...p.contentHtml.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi)].map((m) => htmlToText(m[1] ?? ""));
    const inHeading = headings.some((h) => includes(h, keyword));
    add("keyword-heading", inHeading ? "good" : "ok", inHeading ? "Focus keyword is used in a subheading." : "Use the focus keyword in at least one subheading.");
    if (words > 0) {
      const density = (occurrences(text, keyword) * countWords(keyword) * 100) / words;
      const pct = density.toFixed(1);
      if (density > 3) add("density", "bad", `Focus keyword is used too often (${pct}%). Aim for 0.5–3%.`);
      else if (density >= 0.5) add("density", "good", `Focus keyword density is ${pct}%. Nice.`);
      else add("density", "ok", `Focus keyword density is low (${pct}%). Aim for 0.5–3%.`);
    }
  }

  const tl = title.length;
  if (tl >= 30 && tl <= SEO_TITLE_MAX) add("title-length", "good", `SEO title length is good (${tl} characters).`);
  else if (tl > SEO_TITLE_MAX) add("title-length", tl <= 70 ? "ok" : "bad", `SEO title is ${tl} characters — Google may cut it off after ${SEO_TITLE_MAX}.`);
  else add("title-length", "ok", `SEO title is short (${tl} characters). Aim for 30–${SEO_TITLE_MAX}.`);

  const dl = description.length;
  if (dl === 0) add("description-length", "bad", "Write a meta description (or a post summary).");
  else if (dl >= 120 && dl <= SEO_DESCRIPTION_MAX) add("description-length", "good", `Meta description length is good (${dl} characters).`);
  else if (dl > SEO_DESCRIPTION_MAX) add("description-length", "ok", `Meta description is ${dl} characters — Google may cut it off after ${SEO_DESCRIPTION_MAX}.`);
  else add("description-length", "ok", `Meta description is short (${dl} characters). Aim for 120–${SEO_DESCRIPTION_MAX}.`);

  if (words >= 600) add("length", "good", `Good length: ${words} words.`);
  else if (words >= 300) add("length", "ok", `${words} words. Posts over 600 words usually rank better.`);
  else add("length", "bad", `Only ${words} words. Write at least 300.`);

  const hasSubheading = /<h[2-4][\s>]/i.test(p.contentHtml);
  add("subheadings", hasSubheading ? "good" : "ok", hasSubheading ? "Uses subheadings to break up the text." : "Add subheadings (Heading 2 or 3) to break up the text.");

  const imgs = [...p.contentHtml.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const missingAlt = imgs.filter((tag) => !/\balt="[^"]+"/i.test(tag)).length + (p.coverImageAlt !== null && !p.coverImageAlt.trim() ? 1 : 0);
  if (imgs.length === 0 && p.coverImageAlt === null) add("images", "ok", "Add a cover photo or an image in the post.");
  else if (missingAlt > 0) add("images", "ok", `${missingAlt} image${missingAlt > 1 ? "s are" : " is"} missing a description (alt text).`);
  else add("images", "good", "All images have a description.");

  const internal = /<a\b[^>]*href="\/(?!\/)/i.test(p.contentHtml);
  add("internal-link", internal ? "good" : "ok", internal ? "Links to another page on your site." : "Link to a product or another page on your site.");

  const points = checks.reduce((s, c) => s + (c.status === "good" ? 1 : c.status === "ok" ? 0.5 : 0), 0);
  return { score: Math.round((points / checks.length) * 100), checks };
}

export const seoGrade = (score: number): { tone: SeoStatus; label: string } =>
  score >= 80 ? { tone: "good", label: "Good" } : score >= 50 ? { tone: "ok", label: "OK" } : { tone: "bad", label: "Needs work" };
