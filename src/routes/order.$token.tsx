import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Landmark, LoaderCircle, RefreshCw, Send, XCircle } from "lucide-react";
import { z } from "zod";

import { PageFrame } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { FULFILMENT_LABEL, PAYMENT_LABEL, type FulfilmentStatus, type PaymentStatus } from "@/lib/admin-schemas";
import { cart } from "@/lib/cart";
import { BANK_ACCOUNT } from "@/lib/bank-transfer";
import { getOrderStatus, reportTransfer, retryPayment } from "@/lib/checkout.functions";
import { naira } from "@/lib/shop-types";

export const Route = createFileRoute("/order/$token")({
  validateSearch: (search: Record<string, unknown>) =>
    z.object({ reference: z.string().max(100).optional().catch(undefined), trxref: z.string().max(100).optional().catch(undefined) }).parse(search),
  head: () => ({
    meta: [
      { title: "Your Order | RUWATA Solar" },
      { name: "description", content: "Order confirmation and payment status for your RUWATA solar order." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your RUWATA Order" },
      { property: "og:description", content: "Order confirmation and payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrderPage,
});

function OrderPage() {
  const { token } = Route.useParams();
  const { reference, trxref } = Route.useSearch();
  const fetchStatus = useServerFn(getOrderStatus);
  const retry = useServerFn(retryPayment);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const valid = /^[0-9a-f]{64}$/.test(token);

  const order = useQuery({
    queryKey: ["order", token],
    queryFn: () => fetchStatus({ data: { token, reference: reference ?? trxref } }),
    enabled: valid,
    // Keep checking briefly while Paystack is still confirming.
    // While the team is checking a transfer, look again every 30 seconds so the page turns "paid" by itself.
    refetchInterval: (q) => (q.state.data?.paymentStatus === "pending" ? 30_000 : false),
  });

  const paid = order.data?.paymentStatus === "paid";
  useEffect(() => {
    if (!paid) return;
    try {
      if (sessionStorage.getItem("ruwata-clear-cart-for") === token) {
        cart.clear();
        sessionStorage.removeItem("ruwata-clear-cart-for");
        sessionStorage.removeItem("ruwata-checkout-details");
      }
    } catch {
      /* ignore */
    }
  }, [paid, token]);

  async function tryAgain() {
    setRetrying(true);
    setRetryError("");
    try {
      const res = await retry({ data: { token } });
      if (res.ok) {
        window.location.assign(res.authorizationUrl);
        return;
      }
      setRetryError(res.message);
    } catch {
      setRetryError("We couldn't restart payment. Please try again.");
    }
    setRetrying(false);
  }

  if (!valid || (order.isSuccess && !order.data)) {
    return (
      <Shell>
        <XCircle className="size-14 text-destructive" aria-hidden="true" />
        <h1 className="font-heading text-3xl font-semibold">Order not found</h1>
        <p className="text-muted-foreground">Please check the link, or contact us with your order number.</p>
        <Button asChild><Link to="/contact-us">Contact RUWATA</Link></Button>
      </Shell>
    );
  }
  if (order.isPending) {
    return (
      <Shell>
        <LoaderCircle className="size-12 animate-spin text-brand" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-semibold">Confirming your payment…</h1>
        <p className="text-muted-foreground">This only takes a moment.</p>
      </Shell>
    );
  }
  if (order.isError || !order.data) {
    return (
      <Shell>
        <AlertTriangle className="size-12 text-amber" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-semibold">We couldn't load your order</h1>
        <Button variant="outline" onClick={() => order.refetch()}>Try again</Button>
      </Shell>
    );
  }

  const o = order.data;
  const status = o.paymentStatus as PaymentStatus;
  const isTransfer = o.paymentMethod === "bank_transfer";
  const canRetry = !isTransfer && status !== "paid" && status !== "refunded" && status !== "pending" && o.fulfilmentStatus !== "cancelled";
  const awaitingTransfer = isTransfer && (status === "unpaid" || status === "failed" || status === "cancelled") && o.fulfilmentStatus !== "cancelled";
  const Icon = status === "paid" ? CheckCircle2 : status === "pending" ? Clock : awaitingTransfer ? Landmark : XCircle;
  const heading = {
    paid: "Thank you — your order is confirmed",
    pending: isTransfer ? "Thanks — we're confirming your transfer" : "We're confirming your payment",
    failed: "Your payment didn't go through",
    cancelled: "Payment not completed",
    unpaid: isTransfer ? "Order placed — now complete your bank transfer" : "Your order is waiting for payment",
    refunded: "This order was refunded",
  }[status];
  

  return (
    <PageFrame>
      <section className="section-space">
        <div className="site-wrap grid max-w-3xl gap-8">
          <div className="grid justify-items-center gap-3 text-center">
            <Icon className={status === "paid" ? "size-14 text-brand" : status === "pending" || awaitingTransfer ? "size-14 text-amber" : "size-14 text-destructive"} aria-hidden="true" />
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
            <p className="text-lg text-muted-foreground">
              Order number <strong className="text-foreground">{o.orderNumber}</strong>
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="status-pill" data-tone={status === "paid" ? "good" : status === "pending" || status === "unpaid" ? "wait" : "bad"}>Payment: {PAYMENT_LABEL[status]}</span>
              {status === "paid" && <span className="status-pill" data-tone="info">Order: {FULFILMENT_LABEL[o.fulfilmentStatus as FulfilmentStatus] ?? o.fulfilmentStatus}</span>}
            </div>
            {status === "paid" && <p className="max-w-lg text-muted-foreground">Our team will call you to arrange {o.deliveryMethod === "pickup" ? "pickup" : "delivery"}{o.installationFee > 0 ? " and installation" : ""}.</p>}
            {isTransfer && status === "pending" && (
              <p className="max-w-lg text-muted-foreground">We've been notified. Our team will check our GTBank account and confirm your payment — usually within a few hours during business days. This page updates by itself, and we'll call you on the number you gave us.</p>
            )}
            {canRetry && (
              <div className="grid justify-items-center gap-2">
                <p className="max-w-lg text-muted-foreground">Your order is saved. You haven't been charged — you can try paying again.</p>
                <Button className="h-12 px-7 font-bold" onClick={tryAgain} disabled={retrying}>
                  {retrying ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />} Try payment again
                </Button>
                {retryError && <p role="alert" className="text-sm font-bold text-destructive">{retryError}</p>}
              </div>
            )}
          </div>

          {awaitingTransfer && <TransferPanel token={token} total={o.total} orderNumber={o.orderNumber} failed={status !== "unpaid"} onDone={() => order.refetch()} />}

          <div className="checkout-panel">
            <h2 className="checkout-legend">Order details</h2>
            <ul className="grid divide-y divide-border">
              {o.items.map((i) => (
                <li key={i.name} className="flex items-center gap-4 py-3">
                  {i.imageUrl && <img src={i.imageUrl} alt="" className="size-14 rounded-lg object-cover" />}
                  <span className="grid flex-1">
                    <span className="font-bold">{i.name}</span>
                    <span className="text-sm text-muted-foreground">{i.quantity} × {naira.format(i.unitPrice)}</span>
                  </span>
                  <span className="font-bold">{naira.format(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{naira.format(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{o.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}</dt><dd>{o.deliveryFee ? naira.format(o.deliveryFee) : "Free"}</dd></div>
              {o.installationFee > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Installation</dt><dd>{naira.format(o.installationFee)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-border pt-3"><dt className="font-bold">Total</dt><dd className="font-heading text-2xl font-semibold">{naira.format(o.total)}</dd></div>
            </dl>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline" className="font-bold"><Link to="/our-products" hash="shop">Continue shopping</Link></Button>
            <Button asChild variant="ghost" className="font-bold"><Link to="/contact-us">Questions? Contact us</Link></Button>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

function TransferPanel({ token, total, orderNumber, failed, onDone }: { token: string; total: number; orderNumber: string; failed: boolean; onDone: () => void }) {
  const report = useServerFn(reportTransfer);
  const [senderName, setSenderName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function send() {
    setSending(true);
    setError("");
    try {
      const res = await report({ data: { token, senderName: senderName.trim() || undefined } });
      if (res.ok) {
        onDone();
        return;
      }
      setError(res.message);
    } catch {
      setError("We couldn't send that just now. Please try again.");
    }
    setSending(false);
  }

  return (
    <div className="checkout-panel grid gap-5">
      <div className="grid gap-1">
        <h2 className="checkout-legend mb-0">Pay by bank transfer</h2>
        {failed ? (
          <p className="text-sm font-bold text-destructive">We couldn't find your last transfer in our account. Please check the details below and try again, or contact us.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Transfer the exact amount below from your bank app, then tap "I have made payment".</p>
        )}
      </div>
      <dl className="grid divide-y divide-border rounded-xl border border-border">
        <CopyRow label="Amount to pay" value={naira.format(total)} copyValue={String(Math.round(total))} big />
        <CopyRow label="Bank" value={BANK_ACCOUNT.bankName} />
        <CopyRow label="Account number" value={BANK_ACCOUNT.accountNumber} copyValue={BANK_ACCOUNT.accountNumber} big />
        <CopyRow label="Account name" value={BANK_ACCOUNT.accountName} />
        <CopyRow label="Narration / description" value={orderNumber} copyValue={orderNumber} />
      </dl>
      <p className="text-xs text-muted-foreground">Please put your order number <strong className="text-foreground">{orderNumber}</strong> in the transfer description so we can match your payment quickly.</p>
      <label className="grid gap-2" htmlFor="sender-name">
        <span className="text-sm font-bold">Name on the sending account <span className="font-normal text-muted-foreground">(optional — helps us find it)</span></span>
        <input id="sender-name" className="form-control" maxLength={120} value={senderName} onChange={(e) => setSenderName(e.target.value)} />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-brand)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>I have transferred {naira.format(total)} to {BANK_ACCOUNT.accountName} ({BANK_ACCOUNT.bankName}).</span>
      </label>
      {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
      <Button className="h-12 font-bold" disabled={!confirmed || sending} onClick={send}>
        {sending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} I have made payment
      </Button>
    </div>
  );
}

function CopyRow({ label, value, copyValue, big }: { label: string; value: string; copyValue?: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue ?? value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="grid">
        <dt className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</dt>
        <dd className={big ? "font-heading text-xl font-semibold tracking-wide" : "font-bold"}>{value}</dd>
      </div>
      {copyValue && (
        <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? "Copied" : "Copy"}
        </Button>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageFrame>
      <section className="section-space">
        <div className="site-wrap grid max-w-xl justify-items-center gap-4 text-center">{children}</div>
      </section>
    </PageFrame>
  );
}
