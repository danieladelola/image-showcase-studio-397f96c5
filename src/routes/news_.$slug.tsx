import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, Clock, Link2, Sun } from "lucide-react";
import { z } from "zod";

import { PageFrame } from "@/components/site-layout";
import { PostCard } from "@/components/site-pages";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/post-types";
import { newsPostQuery } from "@/lib/posts.queries";

export const Route = createFileRoute("/news_/$slug")({
  validateSearch: (search: Record<string, unknown>) => z.object({ preview: z.boolean().optional().catch(undefined) }).parse(search),
  loaderDeps: ({ search }) => ({ preview: search.preview === true }),
  loader: async ({ context, params, deps }) => {
    const data = await context.queryClient.ensureQueryData(newsPostQuery(params.slug, deps.preview));
    if (!data.post) throw notFound();
    const p = data.post;
    const image = p.coverImage ? (p.coverImage.url.startsWith("http") ? p.coverImage.url : `${data.origin}${p.coverImage.url}`) : null;
    return {
      title: p.seoTitle || p.title,
      description: p.seoDescription || p.excerpt,
      keywords: [p.focusKeyword, ...p.seoKeywords, ...p.tags].filter(Boolean).join(", "),
      image,
      url: `${data.origin}/news/${p.slug}`,
      noindex: data.preview,
      publishedAt: p.publishedAt,
      author: p.authorName,
      headline: p.title,
    };
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} | RUWATA` : "Article | RUWATA" },
      { name: "description", content: loaderData?.description || "A solar article from RUWATA." },
      ...(loaderData?.keywords ? [{ name: "keywords", content: loaderData.keywords }] : []),
      { property: "og:title", content: loaderData?.title ?? "RUWATA article" },
      { property: "og:description", content: loaderData?.description || "A solar article from RUWATA." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `/news/${params.slug}` },
      { name: "twitter:card", content: "summary_large_image" },
      ...(loaderData?.image?.startsWith("https://") ? [{ property: "og:image", content: loaderData.image }, { name: "twitter:image", content: loaderData.image }] : []),
      ...(!loaderData || loaderData.noindex ? [{ name: "robots", content: "noindex" }] : []),
    ],
    links: [{ rel: "canonical", href: `/news/${params.slug}` }],
    scripts: loaderData
      ? [{
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: loaderData.headline,
            description: loaderData.description,
            datePublished: loaderData.publishedAt,
            author: loaderData.author ? { "@type": "Person", name: loaderData.author } : { "@type": "Organization", name: "RUWATA" },
            publisher: { "@type": "Organization", name: "RUWATA" },
            ...(loaderData.image ? { image: loaderData.image } : {}),
          }),
        }]
      : [],
  }),
  notFoundComponent: ArticleNotFound,
  errorComponent: () => <p className="p-10 text-center">This article couldn’t load. Please refresh the page.</p>,
  component: ArticlePage,
});

function ArticleNotFound() {
  return (
    <PageFrame>
      <section className="section-space">
        <div className="site-wrap grid justify-items-center gap-4 text-center">
          <h1 className="section-heading">Article not found</h1>
          <p className="text-muted-foreground">This article may have been moved or removed.</p>
          <Button asChild><Link to="/news">Back to News</Link></Button>
        </div>
      </section>
    </PageFrame>
  );
}

const longDate = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" });

function ArticlePage() {
  const { slug } = Route.useParams();
  const { preview } = Route.useSearch();
  const { data } = useSuspenseQuery(newsPostQuery(slug, preview === true));
  const post = data.post!;
  const url = `${data.origin}/news/${post.slug}`;
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const shares = [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${post.title} ${url}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${enc(post.title)}&url=${enc(url)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  const shareIcons: Record<string, string> = { WhatsApp: "WA", Facebook: "f", X: "X", LinkedIn: "in" };
  const author = post.authorName || "RUWATA Team";
  const initials = author.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const Share = (
    <div className="flex flex-wrap items-center gap-2">
      {shares.map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="article-share-btn" aria-label={`Share on ${s.label}`} title={s.label}>{shareIcons[s.label]}</a>
      ))}
      <button type="button" onClick={copy} className="article-share-btn" aria-label={copied ? "Link copied" : "Copy link"} title={copied ? "Copied" : "Copy link"}>
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );

  return (
    <PageFrame>
      {data.preview && (
        <div className="bg-warning-soft py-2 text-center text-sm font-bold text-warning">Preview — this post isn’t live on your site yet.</div>
      )}
      <article>
        <header className="article-hero">
          <div className="article-hero-glow" aria-hidden="true" />
          <div className="site-wrap relative grid max-w-5xl gap-6">
            <nav aria-label="Breadcrumb" className="article-crumbs">
              <Link to="/">Home</Link>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <Link to="/news">News</Link>
              <ChevronRight className="hidden size-3.5 sm:block" aria-hidden="true" />
              <span className="hidden line-clamp-1 text-primary-foreground sm:block">{post.title}</span>
            </nav>
            <Link to="/news" search={{ category: post.category }} className="article-pill w-fit">{categoryLabel(post.category)}</Link>
            <h1 className="article-title">{post.title}</h1>
            {post.excerpt && <p className="max-w-3xl text-lg leading-8 text-primary-foreground/80">{post.excerpt}</p>}
            <div className="article-meta">
              <span className="flex items-center gap-3">
                <span className="article-avatar" aria-hidden="true">{initials}</span>
                <span className="text-primary-foreground">{author}</span>
              </span>
              {post.publishedAt && (
                <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-amber" aria-hidden="true" />{longDate.format(new Date(post.publishedAt))}</span>
              )}
              <span className="flex items-center gap-1.5"><Clock className="size-4 text-amber" aria-hidden="true" />{post.readingMinutes} min read</span>
            </div>
          </div>
        </header>

        {post.coverImage ? (
          <div className="site-wrap max-w-5xl">
            <div className="article-cover">
              <img src={post.coverImage.url} alt={post.coverImage.alt} className="aspect-[16/8] w-full object-cover" fetchPriority="high" />
            </div>
          </div>
        ) : null}

        <div className={`site-wrap max-w-5xl pb-16 ${post.coverImage ? "pt-12" : "pt-0"}`}>
          <div className={`article-layout ${post.coverImage ? "" : "relative z-[1] -mt-24 rounded-3xl bg-background p-6 md:p-10"}`}>
            <div className="grid gap-10">
              <div className="article-body" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
              {post.tags.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Tags">
                  {post.tags.map((t) => <li key={t} className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">#{t}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                <span className="text-sm font-bold">Found this helpful? Share it.</span>
                {Share}
              </div>
            </div>

            <aside className="article-aside" aria-label="More from RUWATA">
              <div className="article-card">
                <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Share this article</span>
                {Share}
              </div>
              <div className="article-cta">
                <Sun className="size-7 text-amber" aria-hidden="true" />
                <h2 className="font-heading text-xl font-semibold leading-snug">Ready to power your home?</h2>
                <p className="text-sm leading-6 text-primary-foreground/75">Shop solar systems, inverters and batteries — plus air conditioners, freezers, TVs, generators, pumping machines and solar generators.</p>
                <Button asChild className="mt-1 h-11 rounded-full font-bold"><Link to="/our-products">Shop products <ArrowRight aria-hidden="true" /></Link></Button>
                <Link to="/contact-us" className="text-center text-sm font-bold text-amber hover:underline">Talk to our team</Link>
              </div>
              <Link to="/news" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-brand">
                <ArrowLeft className="size-4" aria-hidden="true" /> Back to all news
              </Link>
            </aside>
          </div>
        </div>
      </article>

      {data.related.length > 0 && (
        <section className="section-space bg-card">
          <div className="site-wrap grid max-w-5xl gap-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="grid gap-3">
                <span className="eyebrow">More from RUWATA</span>
                <h2 className="section-heading">Keep reading</h2>
              </div>
              <Link to="/news" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand">All articles <ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
            <div className={`grid gap-6 ${data.related.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>{data.related.map((p) => <PostCard key={p.id} post={p} />)}</div>
          </div>
        </section>
      )}
    </PageFrame>
  );
}
