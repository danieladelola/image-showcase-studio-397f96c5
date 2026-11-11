import { describe, expect, it } from "vitest";

import { quoteRequestSchema } from "@/lib/quote-requests.functions";

const validRequest = {
  name: "Ada Obi",
  phone: "+234 800 000 0000",
  email: "ada@example.com",
  location: "Lagos",
  propertyType: "Home" as const,
  systemSize: "",
  powerNeeds: "Lights, refrigerator, and fans",
};

describe("RUWATA quote request validation", () => {
  it("allows customers to leave the system size blank", () => {
    expect(quoteRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it.each(["2.5 kVA", "10 kVA", "20 kVA", "30 kVA"])(
    "accepts the listed system size %s",
    (systemSize) => {
      expect(quoteRequestSchema.safeParse({ ...validRequest, systemSize }).success).toBe(true);
    },
  );

  it("rejects malformed email addresses", () => {
    expect(quoteRequestSchema.safeParse({ ...validRequest, email: "not-an-email" }).success).toBe(
      false,
    );
  });
});