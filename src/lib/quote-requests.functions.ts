import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const quoteRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  location: z.string().trim().min(2, "Enter your state or city.").max(120),
  propertyType: z.enum(["Home", "Apartment", "Office", "Business", "Other"]),
  systemSize: z.enum(["", "2.5 kVA", "10 kVA", "20 kVA", "30 kVA", "Not sure", "Other"]),
  budget: z.string().trim().max(120).optional().default(""),
  powerNeeds: z.string().trim().min(3, "Tell us what you need to power.").max(1000),
});

export const submitQuoteRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => quoteRequestSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { withDb } = await import("./db.server");
      await withDb(
        (sql) => sql`
          INSERT INTO quote_requests (name, phone, email, location, property_type, system_size, power_needs, budget)
          VALUES (${data.name}, ${data.phone}, ${data.email}, ${data.location}, ${data.propertyType},
                  ${data.systemSize || null}, ${data.powerNeeds}, ${data.budget || null})`,
      );
      return { ok: true as const, message: "Thank you. Your quote request has been sent to RUWATA." };
    } catch (error) {
      console.error("Quote request could not be saved.", error);
      return { ok: false as const, message: "We couldn't save your request just now. Please try again." };
    }
  });