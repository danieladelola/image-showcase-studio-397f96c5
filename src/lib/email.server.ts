// Server-only email sending through Resend, with RUWATA-branded templates.
import { BANK_ACCOUNT } from "./bank-transfer";

export const ADMIN_EMAIL = "musanchina@gmail.com";
const BRAND = "#0f8a2e";
const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }) {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM_EMAIL"];
  if (!key || !from) {
    console.error("Email not sent: RESEND_API_KEY or RESEND_FROM_EMAIL is missing.");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `RUWATA <${from}>`, to: [opts.to], subject: opts.subject, html: opts.html, reply_to: opts.replyTo }),
    });
    if (!res.ok) {
      console.error(`Resend failed [${res.status}]: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Resend request failed", e);
    return false;
  }
}

/** Sends several emails without letting one failure stop the others or the caller. */
export async function sendAll(list: Array<Parameters<typeof sendEmail>[0]>) {
  await Promise.allSettled(list.map(sendEmail));
}

function layout(origin: string, title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
<tr><td style="padding:24px 28px;border-bottom:4px solid ${BRAND}"><img src="${origin}/email/ruwata-logo.png" alt="RUWATA" width="180" style="display:block;height:auto;border:0"></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#111827">${title}</h1>
${body}
${cta ? `<p style="margin:24px 0 0"><a href="${cta.url}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${esc(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px;background:#0b0b0b;color:#d1d5db;font-size:12px;line-height:1.6">RUWATA Nig. Ltd · 17 Toyin Street, Ikeja, Lagos · +234 902 912 5979</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6">${html}</p>`;
function rows(list: Array<[string, string]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border:1px solid #e5e7eb;border-radius:12px">${list
    .map(([k, v], i) => `<tr><td style="padding:10px 14px;font-size:13px;color:#6b7280;${i ? "border-top:1px solid #e5e7eb;" : ""}">${esc(k)}</td><td style="padding:10px 14px;font-size:14px;font-weight:bold;text-align:right;${i ? "border-top:1px solid #e5e7eb;" : ""}">${v}</td></tr>`)
    .join("")}</table>`;
}

export type OrderEmailData = {
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  deliveryMethod: string;
  total: number;
  items: Array<{ name: string; quantity: number; lineTotal: number }>;
};

const itemRows = (o: OrderEmailData) => rows([...o.items.map((i) => [`${i.name} × ${i.quantity}`, esc(naira.format(i.lineTotal))] as [string, string]), ["Total", esc(naira.format(o.total))]]);
const bankRows = (o: OrderEmailData) =>
  rows([["Bank", esc(BANK_ACCOUNT.bankName)], ["Account number", esc(BANK_ACCOUNT.accountNumber)], ["Account name", esc(BANK_ACCOUNT.accountName)], ["Amount", esc(naira.format(o.total))], ["Narration", esc(o.orderNumber)]]);

export function orderPlacedEmails(origin: string, o: OrderEmailData, orderUrl: string) {
  return [
    {
      to: o.email,
      subject: `Order ${o.orderNumber} received – complete your bank transfer`,
      html: layout(origin, `Thanks for your order, ${esc(o.customerName)}!`,
        p(`We've received order <strong>${esc(o.orderNumber)}</strong>. To complete it, transfer the total to our account below and put your order number in the description.`) +
        itemRows(o) + bankRows(o) + p(`After paying, open your order page and tap <strong>"I have made payment"</strong> so our team can confirm it.`),
        { label: "Open my order", url: orderUrl }),
    },
    {
      to: ADMIN_EMAIL,
      replyTo: o.email,
      subject: `New order ${o.orderNumber} – ${naira.format(o.total)} (awaiting transfer)`,
      html: layout(origin, `New order ${esc(o.orderNumber)}`,
        p(`<strong>${esc(o.customerName)}</strong> placed an order. Payment is by bank transfer and hasn't been confirmed yet.`) +
        itemRows(o) +
        rows([["Phone", esc(o.phone)], ["Email", esc(o.email)], [o.deliveryMethod === "pickup" ? "Pickup" : "Deliver to", `${esc(o.address)}, ${esc(o.city)}, ${esc(o.state)}`]]),
        { label: "View in admin", url: `${origin}/admin/orders` }),
    },
  ];
}

export function transferReportedEmail(origin: string, o: { id: string; orderNumber: string; customerName: string; phone: string; email: string; total: number; senderName?: string }) {
  return {
    to: ADMIN_EMAIL,
    replyTo: o.email,
    subject: `Transfer sent for ${o.orderNumber} – please confirm ${naira.format(o.total)}`,
    html: layout(origin, `Customer says they've paid`,
      p(`<strong>${esc(o.customerName)}</strong> tapped "I have made payment" for order <strong>${esc(o.orderNumber)}</strong>. Check the GTBank account, then mark the order as paid in admin.`) +
      rows([["Amount", esc(naira.format(o.total))], ["Narration", esc(o.orderNumber)], ["Sender name", esc(o.senderName || "Not given")], ["Phone", esc(o.phone)]]),
      { label: "Confirm payment", url: `${origin}/admin/orders/${o.id}` }),
  };
}

export function paymentConfirmedEmail(origin: string, o: { orderNumber: string; customerName: string; email: string; total: number; deliveryMethod: string }) {
  return {
    to: o.email,
    subject: `Payment confirmed for order ${o.orderNumber}`,
    html: layout(origin, `Payment received – thank you!`,
      p(`Hi ${esc(o.customerName)}, we've confirmed your payment of <strong>${esc(naira.format(o.total))}</strong> for order <strong>${esc(o.orderNumber)}</strong>.`) +
      p(`Our team will call you shortly to arrange ${o.deliveryMethod === "pickup" ? "pickup" : "delivery"}.`)),
  };
}

export type QuoteEmailData = { name: string; email: string; phone: string; location: string; message: string; productName?: string | null; quantity?: number | null; extra?: Array<[string, string]> };

export function quoteEmails(origin: string, q: QuoteEmailData) {
  const what = q.productName ? `${q.productName}${q.quantity ? ` (qty ${q.quantity})` : ""}` : "a solar system";
  return [
    {
      to: ADMIN_EMAIL,
      replyTo: q.email,
      subject: `New quote request: ${what} – ${q.name}`,
      html: layout(origin, `New quote request`,
        rows([["Product", esc(what)], ["Name", esc(q.name)], ["Phone", esc(q.phone)], ["Email", esc(q.email)], ["Location", esc(q.location)], ...(q.extra ?? []).map(([k, v]) => [k, esc(v)] as [string, string])]) +
        p(`<strong>Message:</strong> ${esc(q.message)}`),
        { label: "View quote requests", url: `${origin}/admin/quotes` }),
    },
    {
      to: q.email,
      subject: `We've received your quote request`,
      html: layout(origin, `Thanks, ${esc(q.name)}!`,
        p(`We've received your request for a quote on <strong>${esc(what)}</strong>. Our sales team will contact you shortly on ${esc(q.phone)} with pricing.`)),
    },
  ];
}
