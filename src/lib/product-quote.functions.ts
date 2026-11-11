import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const productQuoteSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(30),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  location: z.string().trim().min(2, "Enter your state or city.").max(120),
  message: z.string().trim().max(1000).optional().default(""),
});

/** Saves a "Request a Quote" for a product that has no price, so the team can follow up. */
export const submitProductQuote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => productQuoteSchema.parse(input))
  .handler(async ({ data }) => {
    const { withDb } = await import("./db.server");
    try {
      const saved = await withDb(async (sql) => {
        const [p] = await sql`SELECT id, name FROM products WHERE id = ${data.productId} AND status = 'published'`;
        if (!p) return false;
        const needs = data.message || `Quote request for ${p.name} (qty ${data.quantity})`;
        await sql`
          INSERT INTO quote_requests (name, phone, email, location, property_type, power_needs, product_id, product_name, quantity)
          VALUES (${data.name}, ${data.phone}, ${data.email}, ${data.location}, 'Other', ${needs.length >= 3 ? needs : needs + "..."},
                  ${p.id}, ${p.name}, ${data.quantity})`;
        return String(p.name);
      });
      if (saved) {
        const { siteOrigin } = await import("./payments.server");
        const { quoteEmails, sendAll } = await import("./email.server");
        await sendAll(quoteEmails(siteOrigin(), { ...data, message: data.message || "No message", productName: saved, quantity: data.quantity }));
      }
      if (!saved) return { ok: false as const, message: "That product isn't available any more." };
      return { ok: true as const };
    } catch (error) {
      console.error("Product quote could not be saved.", error);
      return { ok: false as const, message: "We couldn't send your request just now. Please try again." };
    }
  });
