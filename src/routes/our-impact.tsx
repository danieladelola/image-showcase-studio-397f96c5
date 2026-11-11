import { createFileRoute } from "@tanstack/react-router";
import { ImpactPage } from "@/components/site-pages";

export const Route = createFileRoute("/our-impact")({
  head: () => ({ meta: [
    { title: "Our Impact | RUWATA Solar" },
    { name: "description", content: "Discover how RUWATA solar installations can support essential power needs, with verified project details as they become available." },
    { name: "keywords", content: "solar impact Nigeria, solar projects, clean energy, RUWATA installations, renewable energy" },
    { property: "og:title", content: "Our Impact | RUWATA" },
    { property: "og:description", content: "Solar projects designed around real power needs, with outcomes reported when verified." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ImpactPage,
});