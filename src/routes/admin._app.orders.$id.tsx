import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LoaderCircle, Mail, MapPin, Package, Phone, Store, Truck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader, FulfilmentPill, PaymentPill, formatDateTime } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { FULFILMENT_LABEL, FULFILMENT_STATUSES, type FulfilmentStatus } from "@/lib/admin-schemas";
import { adminUpdateOrderStatus } from "@/lib/admin.functions";
import { adminOrderQuery } from "@/lib/admin.queries";
import { naira } from "@/lib/shop-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/admin/_app/orders/$id")({
  loader: async ({ context, params }) => {
    if (!UUID.test(params.id)) throw notFound();
    const order = await context.queryClient.ensureQueryData(adminOrderQuery(params.id));
    if (!order) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Order details | RUWATA Admin" },
      { name: "description", content: "Order items, payment and delivery details." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Order details | RUWATA Admin" },
      { property: "og:description", content: "Order details for the RUWATA team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => (
    <div className="admin-box admin-box-pad grid justify-items-center gap-3 text-center">
      <h1 className="font-heading text-xl font-semibold">Order not found</h1>
      <Button asChild variant="outline"><Link to="/admin/orders">Back to orders</Link></Button>
    </div>
  ),
  component: OrderPage,
});

const PAYMENT_ATTEMPT_LABEL: Record<string, string> = {
  initialized: "Started",
  pending: "Pending",
  success: "Successful",
  failed: "Failed",
  abandoned: "Not completed",
};

function OrderPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(adminOrderQuery(id));
  const o = data!;
  const [status, setStatus] = useState<FulfilmentStatus>(o.status as FulfilmentStatus);
  const [saving, setSaving] = useState(false);
  const updateFn = useServerFn(adminUpdateOrderStatus);
  const qc = useQueryClient();

  async function saveStatus() {
    setSaving(true);
    try {
      await updateFn({ data: { id: o.id, status } });
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(`Order marked as ${FULFILMENT_LABEL[status].toLowerCase()}`);
    } catch {
      toast.error("The status couldn't be updated. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link to="/admin/orders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden="true" /> Orders
      </Link>
      <AdminHeader
        title={`Order ${o.orderNumber}`}
        description={`Placed ${formatDateTime(o.createdAt)}`}
        actions={<><PaymentPill status={o.paymentStatus} /><FulfilmentPill status={o.status} /></>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid gap-6">
          <section className="admin-box">
            <h2 className="admin-box-title p-4 sm:px-6">Items</h2>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="admin-thumb">
                            {i.imageUrl ? <img src={i.imageUrl} alt="" /> : <span className="grid size-full place-items-center"><Package className="size-5 text-muted-foreground" aria-hidden="true" /></span>}
                          </span>
                          <span className="grid">
                            {i.productId ? (
                              <Link to="/admin/products/$id" params={{ id: i.productId }} className="font-bold hover:text-brand">{i.productName}</Link>
                            ) : (
                              <span className="font-bold">{i.productName}</span>
                            )}
                            {i.sku && <span className="font-mono text-xs text-muted-foreground">{i.sku}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {naira.format(i.unitPrice)}
                        {i.regularPrice != null && i.regularPrice > i.unitPrice && <span className="ml-1.5 text-xs text-muted-foreground line-through">{naira.format(i.regularPrice)}</span>}
                      </td>
                      <td>{i.quantity}</td>
                      <td className="text-right font-bold whitespace-nowrap">{naira.format(i.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="grid gap-2 border-t border-border p-4 text-sm sm:px-6">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{naira.format(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{o.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}</dt><dd>{o.deliveryFee ? naira.format(o.deliveryFee) : "Free"}</dd></div>
              {o.installationFee > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Installation</dt><dd>{naira.format(o.installationFee)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-border pt-3"><dt className="font-bold">Total</dt><dd className="font-heading text-xl font-semibold">{naira.format(o.total)}</dd></div>
              {o.amountPaid != null && <div className="flex justify-between"><dt className="text-muted-foreground">Paid {o.paidAt ? formatDateTime(o.paidAt) : ""}</dt><dd className="font-bold text-success">{naira.format(o.amountPaid)}</dd></div>}
            </dl>
          </section>

          <section className="admin-box">
            <h2 className="admin-box-title p-4 sm:px-6">Payment attempts</h2>
            {o.payments.length === 0 ? (
              <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-6">No payment has been started for this order.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead><tr><th>Reference</th><th>Started</th><th>Result</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {o.payments.map((p) => (
                      <tr key={p.reference}>
                        <td className="font-mono text-xs">{p.reference}</td>
                        <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(p.createdAt)}</td>
                        <td>
                          <span className="status-pill" data-tone={p.status === "success" ? "good" : p.status === "failed" ? "bad" : p.status === "abandoned" ? "muted" : "wait"}>
                            {PAYMENT_ATTEMPT_LABEL[p.status] ?? p.status}
                          </span>
                          {p.gatewayResponse && <span className="mt-1 block text-xs text-muted-foreground">{p.gatewayResponse}</span>}
                        </td>
                        <td className="text-muted-foreground capitalize">{p.channel ?? "—"}</td>
                        <td className="text-right font-bold">{naira.format(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="grid gap-6 lg:sticky lg:top-6">
          <section className="admin-box admin-box-pad">
            <h2 className="admin-box-title">Order status</h2>
            <p className="mt-1 text-sm text-muted-foreground">Payment status is set automatically by Paystack.</p>
            <div className="mt-4 flex gap-2">
              <select aria-label="Order status" className="admin-input" value={status} onChange={(e) => setStatus(e.target.value as FulfilmentStatus)}>
                {FULFILMENT_STATUSES.map((s) => <option key={s} value={s}>{FULFILMENT_LABEL[s]}</option>)}
              </select>
              <Button className="font-bold" disabled={saving || status === o.status} onClick={saveStatus}>
                {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />} Save
              </Button>
            </div>
            {o.paymentStatus !== "paid" && status !== "cancelled" && status !== "pending" && (
              <p className="mt-3 text-xs font-bold text-warning">This order hasn't been paid yet.</p>
            )}
          </section>

          <section className="admin-box admin-box-pad grid gap-3 text-sm">
            <h2 className="admin-box-title">Customer</h2>
            <p className="font-bold">{o.customerName}</p>
            <a href={`mailto:${o.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-brand"><Mail className="size-4" aria-hidden="true" /> {o.email}</a>
            <a href={`tel:${o.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-brand"><Phone className="size-4" aria-hidden="true" /> {o.phone}</a>
          </section>

          <section className="admin-box admin-box-pad grid gap-3 text-sm">
            <h2 className="admin-box-title">{o.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}</h2>
            <p className="flex items-start gap-2 text-muted-foreground">
              {o.deliveryMethod === "pickup" ? <Store className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Truck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
              {o.deliveryMethod === "pickup" ? "Customer will collect from RUWATA" : "Deliver to the address below"}
            </p>
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span>{o.address}<br />{o.city}, {o.state}</span></p>
            {o.installationRequested && <p className="flex items-center gap-2 font-bold text-brand"><Wrench className="size-4" aria-hidden="true" /> Installation requested</p>}
            {o.notes && <p className="rounded-lg bg-admin-canvas p-3 text-muted-foreground"><span className="font-bold text-foreground">Note: </span>{o.notes}</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
