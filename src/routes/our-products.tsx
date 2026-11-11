import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/components/site-pages";
import { shopQuery } from "@/lib/shop.queries";

export const Route = createFileRoute("/our-products")({
  head: () => ({ meta: [
    { title: "Our Products | RUWATA Solar" },
      { name: "description", content: "Shop solar systems, panels, inverters and batteries, plus air conditioners, freezers, TVs, generators, pumping machines and solar generators from RUWATA." },
    { name: "keywords", content: "buy solar panels Nigeria, solar inverters, lithium batteries, solar kits, buy AC Nigeria, chest freezer, smart LED TV, petrol generator, RUWATA products" },
    { property: "og:title", content: "Solar Products | RUWATA" },
      { property: "og:description", content: "Solar equipment, ACs, freezers, TVs, generators and pumping machines with nationwide delivery." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(shopQuery),
  component: ProductsPage,
});
