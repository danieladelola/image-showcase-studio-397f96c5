import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";

import { NewsPage } from "@/components/site-pages";
import { POST_CATEGORY_KEYS } from "@/lib/post-types";
import { newsListQuery } from "@/lib/posts.queries";

export const Route = createFileRoute("/news")({
  validateSearch: (search: Record<string, unknown>) => z.object({ category: z.enum(POST_CATEGORY_KEYS).optional().catch(undefined) }).parse(search),
  loaderDeps: ({ search }) => ({ category: search.category }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(newsListQuery(deps.category)),
  head: () => ({
    meta: [
      { title: "News & Solar Guides | RUWATA" },
      { name: "description", content: "Solar guides, company updates, and verified project stories from RUWATA." },
      { name: "keywords", content: "solar news Nigeria, solar guides, solar tips, RUWATA updates, renewable energy Nigeria" },
      { property: "og:title", content: "RUWATA News & Solar Guides" },
      { property: "og:description", content: "Solar guides, company updates, and installation stories from RUWATA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <p className="p-10 text-center">News couldn’t load. Please refresh the page.</p>,
  component: NewsRoute,
});

function NewsRoute() {
  const { category } = Route.useSearch();
  const { data } = useSuspenseQuery(newsListQuery(category));
  return <NewsPage posts={data} category={category} />;
}
