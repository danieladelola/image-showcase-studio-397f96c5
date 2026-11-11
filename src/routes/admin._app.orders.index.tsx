import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";

import { AdminHeader, EmptyState, FulfilmentPill, PAGE_SIZE, Pager, PaymentPill, formatDateTime } from "@/components/admin/admin-ui";
import { FULFILMENT_LABEL, FULFILMENT_STATUSES, PAYMENT_LABEL, PAYMENT_STATUSES } from "@/lib/admin-schemas";
import { adminOrdersQuery } from "@/lib/admin.queries";
import { naira } from "@/lib/shop-types";

export const Route = createFileRoute("/admin/_app/orders/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminOrdersQuery),
  head: () => ({
    meta: [
      { title: "Orders | RUWATA Admin" },
      { name: "description", content: "Track RUWATA orders, payments and deliveries." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Orders | RUWATA Admin" },
      { property: "og:description", content: "Order management for the RUWATA store." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { data: orders } = useSuspenseQuery(adminOrdersQuery);
  const [q, setQ] = useState("");
  const [payment, setPayment] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (payment === "all" || o.paymentStatus === payment) &&
        (status === "all" || o.status === status) &&
        (!term || [o.orderNumber, o.customerName, o.email, o.phone, o.paymentReference ?? ""].some((v) => v.toLowerCase().includes(term))),
    );
  }, [orders, q, payment, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const toFulfil = orders.filter((o) => o.paymentStatus === "paid" && ["pending", "confirmed", "processing"].includes(o.status)).length;

  return (
    <>
      <AdminHeader title="Orders" description={`${orders.length} orders · ${toFulfil} paid and waiting to be fulfilled`} />
      <div className="admin-box">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search orders</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input className="admin-input pl-9" placeholder="Order number, name, email, phone or reference" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </label>
          <select aria-label="Payment status" className="admin-input w-auto" value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1); }}>
            <option value="all">Any payment</option>
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
          </select>
          <select aria-label="Order status" className="admin-input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">Any status</option>
            {FULFILMENT_STATUSES.map((s) => <option key={s} value={s}>{FULFILMENT_LABEL[s]}</option>)}
          </select>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-5" />} title={orders.length ? "No orders match" : "No orders yet"}>
            {orders.length ? "Try a different search or filter." : "Orders placed in the shop will appear here."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Status</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td><Link to="/admin/orders/$id" params={{ id: o.id }} className="font-bold text-foreground hover:text-brand">{o.orderNumber}</Link></td>
                    <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                    <td>
                      <span className="grid">
                        <span className="font-bold">{o.customerName}</span>
                        <span className="text-xs text-muted-foreground">{o.location || o.email}</span>
                      </span>
                    </td>
                    <td>{o.itemCount}</td>
                    <td><PaymentPill status={o.paymentStatus} /></td>
                    <td><FulfilmentPill status={o.status} /></td>
                    <td className="text-right font-bold whitespace-nowrap">{naira.format(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={current} total={filtered.length} onPage={setPage} noun="orders" />
      </div>
    </>
  );
}
