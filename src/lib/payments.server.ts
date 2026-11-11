import { getRequest } from "@tanstack/react-start/server";

import { withDb, type Sql } from "./db.server";
import { checkTransaction, type VerifiedTransaction } from "./paystack";
import { randomToken } from "./password";

const API = "https://api.paystack.co";

export function paystackSecret() {
  const key = process.env["PAYSTACK_SECRET_KEY"]?.trim();
  return key && /^sk_(test|live)_/.test(key) ? key : null;
}

/** Public origin of the site, honouring the proxy headers Coolify sets. */
export function siteOrigin() {
  const configured = process.env["PUBLIC_SITE_URL"]?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const req = getRequest();
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

async function paystackFetch<T>(path: string, init: RequestInit & { key: string }): Promise<{ ok: boolean; data?: T | undefined; message?: string | undefined }> {
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${init.key}`, "Content-Type": "application/json" },
    });
    const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || !body.status) {
      console.error("Paystack request failed", path.split("/").slice(0, 3).join("/"), res.status, body.message);
      return { ok: false, message: body.message };
    }
    return { ok: true, data: body.data };
  } catch (e) {
    console.error("Paystack request error", e);
    return { ok: false };
  }
}

export type PaymentStart = { ok: true; authorizationUrl: string } | { ok: false; message: string };

/** Records a new payment attempt with a unique reference and asks Paystack for a checkout link. */
export async function startPayment(order: { id: string; orderNumber: string; email: string; amountKobo: number; returnUrl: string }): Promise<PaymentStart> {
  const key = paystackSecret();
  if (!key) return { ok: false, message: "Online payment isn't available yet. Please contact us to complete your order." };
  const reference = `${order.orderNumber}-${randomToken().slice(0, 10)}`;
  await withDb(async (sql) => {
    await sql`INSERT INTO payments (order_id, reference, amount_kobo) VALUES (${order.id}, ${reference}, ${order.amountKobo})`;
    await sql`UPDATE orders SET payment_reference = ${reference}, payment_status = 'pending', updated_at = now()
              WHERE id = ${order.id} AND payment_status <> 'paid'`;
  });
  const res = await paystackFetch<{ authorization_url: string }>("/transaction/initialize", {
    key,
    method: "POST",
    body: JSON.stringify({
      email: order.email,
      amount: order.amountKobo,
      currency: "NGN",
      reference,
      callback_url: order.returnUrl,
      metadata: { order_id: order.id, order_number: order.orderNumber, cancel_action: order.returnUrl },
    }),
  });
  if (!res.ok || !res.data?.authorization_url) {
    await withDb(async (sql) => {
      await sql`UPDATE payments SET status = 'failed', gateway_response = 'Could not start payment', updated_at = now() WHERE reference = ${reference}`;
      await sql`UPDATE orders SET payment_status = 'failed', updated_at = now() WHERE id = ${order.id} AND payment_status <> 'paid'`;
    });
    return { ok: false, message: "We couldn't connect to Paystack just now. Please try again." };
  }
  return { ok: true, authorizationUrl: res.data.authorization_url };
}

const PAYMENT_TO_ORDER: Record<string, string> = { failed: "failed", abandoned: "cancelled", pending: "pending" };

/**
 * Verifies a payment with Paystack and updates the order. Safe to call many times (callback page,
 * webhook retries): the order flips to paid and stock is deducted only once.
 */
export async function confirmPayment(reference: string): Promise<"paid" | "failed" | "abandoned" | "pending" | "mismatch" | "unknown"> {
  const key = paystackSecret();
  if (!key) return "unknown";
  const payment = await withDb(async (sql) => {
    const rows = await sql`
      SELECT p.id, p.order_id, p.amount_kobo, p.status, o.total, o.payment_status
      FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.reference = ${reference}`;
    return rows[0];
  });
  if (!payment) return "unknown";
  if (payment.status === "success" && payment.payment_status === "paid") return "paid";

  const res = await paystackFetch<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`, { key, method: "GET" });
  if (!res.ok || !res.data) return "pending";
  const tx = res.data;
  const amountKobo = Number(payment.amount_kobo);
  // The order total must still match what this payment was opened for.
  const outcome = Math.round(Number(payment.total) * 100) === amountKobo ? checkTransaction(tx, { reference, amountKobo }) : "mismatch";

  await withDb((sql) =>
    sql.begin(async (tx2) => {
      const t = tx2 as unknown as Sql;
      if (outcome === "paid") {
        await t`UPDATE payments SET status = 'success', gateway_response = ${tx.gateway_response ?? null}, channel = ${tx.channel ?? null},
                  provider_transaction_id = ${tx.id != null ? String(tx.id) : null}, verified_at = now(), updated_at = now()
                WHERE reference = ${reference}`;
        const flipped = await t`
          UPDATE orders SET payment_status = 'paid', paid_at = now(), amount_paid = ${amountKobo / 100},
            payment_reference = ${reference}, status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END, updated_at = now()
          WHERE id = ${payment.order_id} AND payment_status <> 'paid' RETURNING id`;
        if (flipped.length) {
          const claimed = await t`UPDATE orders SET stock_deducted = true WHERE id = ${payment.order_id} AND NOT stock_deducted RETURNING id`;
          if (claimed.length) {
            await t`
              UPDATE products p SET stock_quantity = GREATEST(0, p.stock_quantity - i.qty), updated_at = now()
              FROM (SELECT product_id, sum(quantity)::int AS qty FROM order_items WHERE order_id = ${payment.order_id} AND product_id IS NOT NULL GROUP BY product_id) i
              WHERE p.id = i.product_id AND p.track_stock`;
          }
        }
        return;
      }
      if (outcome === "mismatch") {
        console.error("Paystack verification mismatch for reference", reference);
        await t`UPDATE payments SET status = 'failed', gateway_response = 'Amount, currency or reference did not match', verified_at = now(), updated_at = now() WHERE reference = ${reference} AND status <> 'success'`;
        await t`UPDATE orders SET payment_status = 'failed', updated_at = now() WHERE id = ${payment.order_id} AND payment_status <> 'paid'`;
        return;
      }
      await t`UPDATE payments SET status = ${outcome}, gateway_response = ${tx.gateway_response ?? null}, updated_at = now() WHERE reference = ${reference} AND status <> 'success'`;
      // Only the latest attempt decides an unpaid order's status.
      await t`UPDATE orders SET payment_status = ${PAYMENT_TO_ORDER[outcome]!}, updated_at = now()
              WHERE id = ${payment.order_id} AND payment_status <> 'paid' AND payment_reference = ${reference}`;
    }),
  );
  return outcome;
}
