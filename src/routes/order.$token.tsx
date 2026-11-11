import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock, LoaderCircle, RefreshCw, XCircle } from "lucide-react";
import { z } from "zod";

import { PageFrame } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { FULFILMENT_LABEL, PAYMENT_LABEL, type FulfilmentStatus, type PaymentStatus } from "@/lib/admin-schemas";
import { cart } from "@/lib/cart";
import { getOrderStatus, retryPayment } from "@/lib/checkout.functions";
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
    refetchInterval: (q) => (q.state.data?.paymentStatus === "pending" && q.state.dataUpdateCount < 6 ? 4000 : false),
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
  const canRetry = status !== "paid" && status !== "refunded" && status !== "pending" && o.fulfilmentStatus !== "cancelled";
  const heading = {
    paid: "Thank you — your order is confirmed",
    pending: "We're confirming your payment",
    failed: "Your payment didn't go through",
    cancelled: "Payment not completed",
    unpaid: "Your order is waiting for payment",
    refunded: "This order was refunded",
  }[status];
  const Icon = status === "paid" ? CheckCircle2 : status === "pending" ? Clock : XCircle;

  return (
    <PageFrame>
      <section className="section-space">
        <div className="site-wrap grid max-w-3xl gap-8">
          <div className="grid justify-items-center gap-3 text-center">
            <Icon className={status === "paid" ? "size-14 text-brand" : status === "pending" ? "size-14 text-amber" : "size-14 text-destructive"} aria-hidden="true" />
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
            <p className="text-lg text-muted-foreground">
              Order number <strong className="text-foreground">{o.orderNumber}</strong>
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="status-pill" data-tone={status === "paid" ? "good" : status === "pending" || status === "unpaid" ? "wait" : "bad"}>Payment: {PAYMENT_LABEL[status]}</span>
              {status === "paid" && <span className="status-pill" data-tone="info">Order: {FULFILMENT_LABEL[o.fulfilmentStatus as FulfilmentStatus] ?? o.fulfilmentStatus}</span>}
            </div>
            {status === "paid" && <p className="max-w-lg text-muted-foreground">Our team will call you to arrange {o.deliveryMethod === "pickup" ? "pickup" : "delivery"}{o.installationFee > 0 ? " and installation" : ""}.</p>}
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageFrame>
      <section className="section-space">
        <div className="site-wrap grid max-w-xl justify-items-center gap-4 text-center">{children}</div>
      </section>
    </PageFrame>
  );
}
