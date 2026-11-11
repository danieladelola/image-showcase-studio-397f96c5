import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ContactPage } from "@/components/site-pages";

export const Route = createFileRoute("/contact-us")({
  head: () => ({ meta: [
    { title: "Request a Solar Quote | Contact RUWATA" },
    { name: "description", content: "Request a RUWATA solar quote. Share your location, property type, and power needs; you do not need to know your system size." },
    { name: "keywords", content: "solar quote Nigeria, contact RUWATA, solar installation quote, solar system sizing, request solar quote" },
    { property: "og:title", content: "Request a Solar Quote from RUWATA" },
    { property: "og:description", content: "Tell the RUWATA team what you need to power and explore a solar system sized around your needs." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  validateSearch: (search: Record<string, unknown>) => z.object({ product: z.string().max(140).optional().catch(undefined) }).parse(search),
  component: ContactPage,
});