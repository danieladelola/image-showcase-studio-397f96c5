import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/site-pages";

export const Route = createFileRoute("/about-us")({
  head: () => ({ meta: [
    { title: "About Us | RUWATA Solar" },
    { name: "description", content: "Meet RUWATA, a Nigerian solar installation team supporting you from power assessment through system handover." },
    { name: "keywords", content: "about RUWATA, solar company Nigeria, solar installers, solar energy experts, RUWATA team" },
    { property: "og:title", content: "About RUWATA" },
    { property: "og:description", content: "RUWATA plans, supplies, and installs complete solar systems in Nigeria." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AboutPage,
});