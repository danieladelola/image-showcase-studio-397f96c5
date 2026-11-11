import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(255),
});

const failure = { ok: false as const, message: "We couldn't sign you up just now. Please try again." };

export const subscribeToNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => newsletterSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { withDb } = await import("./db.server");
      await withDb(
        (sql) => sql`INSERT INTO newsletter_subscribers (email) VALUES (${data.email}) ON CONFLICT (email) DO NOTHING`,
      );
      return { ok: true as const, message: "Thanks! You're on the list." };
    } catch (error) {
      console.error("Newsletter signup could not be saved.", error);
      return failure;
    }
  });
