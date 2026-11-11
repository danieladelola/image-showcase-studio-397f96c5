import { createFileRoute } from "@tanstack/react-router";

// Paystack calls this URL after payment events. The signature header proves the request
// came from Paystack; the payment is then re-verified with Paystack before the order changes.
export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { paystackSecret, confirmPayment } = await import("@/lib/payments.server");
        const { isValidPaystackSignature } = await import("@/lib/paystack");
        const key = paystackSecret();
        if (!key) return new Response("Payments not configured", { status: 503 });

        const raw = await request.text();
        if (raw.length > 200_000) return new Response("Too large", { status: 413 });
        const valid = await isValidPaystackSignature(raw, request.headers.get("x-paystack-signature"), key);
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let event: { event?: string; data?: { reference?: string } };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const reference = event.data?.reference;
        if (reference && typeof reference === "string" && reference.length <= 100 && (event.event === "charge.success" || event.event === "charge.failed")) {
          try {
            await confirmPayment(reference);
          } catch (e) {
            console.error("Webhook processing failed", e);
            return new Response("Retry later", { status: 500 });
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
