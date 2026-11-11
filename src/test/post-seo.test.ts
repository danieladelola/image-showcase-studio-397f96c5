import { describe, expect, it } from "vitest";

import { analyzeSeo, readingMinutes, seoGrade } from "@/lib/post-seo";

const base = {
  title: "Solar inverter guide",
  slug: "solar-inverter-guide",
  excerpt: "",
  contentHtml: "<p>Hello</p>",
  seoTitle: "",
  seoDescription: "",
  focusKeyword: "",
  coverImageAlt: null,
};

describe("post SEO checklist", () => {
  it("flags a missing focus keyword as needs work", () => {
    const { checks } = analyzeSeo(base);
    expect(checks.find((c) => c.id === "keyword")?.status).toBe("bad");
  });

  it("marks the keyword in the title as good", () => {
    const { checks } = analyzeSeo({ ...base, focusKeyword: "solar inverter" });
    expect(checks.find((c) => c.id === "keyword-title")?.status).toBe("good");
  });

  it("warns when the keyword is used more than 3% of the time", () => {
    const html = `<p>${"solar inverter ".repeat(20)}</p>`;
    const { checks } = analyzeSeo({ ...base, focusKeyword: "solar inverter", contentHtml: html });
    expect(checks.find((c) => c.id === "density")?.status).toBe("bad");
  });

  it("grades 80+ Good, 50+ OK, below Needs work", () => {
    expect(seoGrade(80).label).toBe("Good");
    expect(seoGrade(50).label).toBe("OK");
    expect(seoGrade(49).label).toBe("Needs work");
  });

  it("reads at 200 words a minute, at least 1 minute", () => {
    expect(readingMinutes("<p>one two</p>")).toBe(1);
    expect(readingMinutes(`<p>${"word ".repeat(600)}</p>`)).toBe(3);
  });
});
