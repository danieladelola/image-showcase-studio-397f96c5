// Paystack helpers that are safe to share with tests (no secrets, no I/O).
const enc = new TextEncoder();

export function paystackMode(secretKey: string | null | undefined): "test" | "live" | null {
  if (!secretKey) return null;
  return secretKey.startsWith("sk_live_") ? "live" : "test";
}

/** HMAC-SHA512 of the raw body with the secret key, hex encoded — Paystack's `x-paystack-signature`. */
export async function paystackSignature(rawBody: string, secretKey: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secretKey), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidPaystackSignature(rawBody: string, signature: string | null, secretKey: string) {
  if (!signature) return false;
  const expected = await paystackSignature(rawBody, secretKey);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export type VerifiedTransaction = { status: string; reference: string; amount: number; currency: string; gateway_response?: string; channel?: string; id?: number };

export type VerificationOutcome = "paid" | "failed" | "abandoned" | "pending" | "mismatch";

/** Decides what a Paystack verification result means for an order, checking reference, amount and currency. */
export function checkTransaction(tx: VerifiedTransaction, expected: { reference: string; amountKobo: number }): VerificationOutcome {
  if (tx.reference !== expected.reference) return "mismatch";
  if (tx.status === "success") {
    return tx.currency === "NGN" && Number(tx.amount) === expected.amountKobo ? "paid" : "mismatch";
  }
  if (tx.status === "failed" || tx.status === "reversed") return "failed";
  if (tx.status === "abandoned") return "abandoned";
  return "pending";
}
