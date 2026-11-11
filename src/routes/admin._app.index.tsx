import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Banknote, ClipboardList, Package, Truck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { z } from "zod";

import { AdminHeader, EmptyState, FulfilmentPill, PaymentPill, formatDate } from "@/components/admin/admin-ui";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { FULFILMENT_LABEL, PAYMENT_LABEL, type FulfilmentStatus, type PaymentStatus } from "@/lib/admin-schemas";
import { dashboardQuery, daysAgo, lagosDate, type DashboardRange } from "@/lib/admin.queries";
import { naira } from "@/lib/shop-types";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Route = createFileRoute("/admin/_app/")({
  validateSearch: (search: Record<string, unknown>) =>
    z
      .object({
        from: dateStr.optional().catch(undefined),
        to: dateStr.optional().catch(undefined),
        groupBy: z.enum(["day", "week", "month"]).optional().catch(undefined),
      })
      .parse(search),
  loaderDeps: ({ search }): DashboardRange => ({
    from: search.from ?? daysAgo(29),
    to: search.to ?? lagosDate(),
    groupBy: search.groupBy ?? "day",
  }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(dashboardQuery(deps)),
  head: () => ({
    meta: [
      { title: "Dashboard | RUWATA Admin" },
      { name: "description", content: "Revenue, orders and product overview for the RUWATA store." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "RUWATA Admin Dashboard" },
      { property: "og:description", content: "Store overview for the RUWATA team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const PRESETS = [
  { label: "7 days", days: 7, groupBy: "day" },
  { label: "30 days", days: 30, groupBy: "day" },
  { label: "90 days", days: 90, groupBy: "week" },
  { label: "12 months", days: 365, groupBy: "month" },
] as const;

const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-6)", "var(--chart-5)", "var(--chart-7)"];

const revenueConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig;

const shortDay = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short" });
const shortMonth = new Intl.DateTimeFormat("en-NG", { month: "short", year: "2-digit" });
const compactNaira = new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 });

function Dashboard() {
  const range = Route.useLoaderDeps();
  const { data } = useSuspenseQuery(dashboardQuery(range));
  const navigate = useNavigate({ from: Route.fullPath });
  const [mix, setMix] = useState<"fulfilment" | "payment">("fulfilment");
  const s = data.stats;

  const setRange = (next: Partial<DashboardRange>) => navigate({ search: (prev) => ({ ...prev, ...next }) });
  const activePreset = PRESETS.find((p) => range.to === lagosDate() && range.from === daysAgo(p.days - 1) && range.groupBy === p.groupBy);

  const cards = [
    { label: "Revenue", hint: "Verified Paystack payments", value: naira.format(s.revenue), Icon: Banknote, tone: undefined },
    { label: "Paid orders", hint: `${s.orders} orders placed in this period`, value: s.paidOrders, Icon: ClipboardList, tone: "deep" },
    { label: "Waiting to fulfil", hint: "Paid, not yet shipped", value: s.toFulfil, Icon: Truck, tone: "amber" },
    { label: "Products live", hint: `${s.products} active products in total`, value: s.published, Icon: Package, tone: undefined },
  ] as const;

  const fmtBucket = (b: string) => {
    const d = new Date(`${b}T00:00:00`);
    return range.groupBy === "month" ? shortMonth.format(d) : shortDay.format(d);
  };

  const mixRows = (mix === "fulfilment" ? data.fulfilment : data.payment).filter((r) => r.count > 0);
  const mixLabel = (status: string) =>
    mix === "fulfilment" ? (FULFILMENT_LABEL[status as FulfilmentStatus] ?? status) : (PAYMENT_LABEL[status as PaymentStatus] ?? status);
  const mixTotal = mixRows.reduce((n, r) => n + r.count, 0);
  const mixConfig = Object.fromEntries(mixRows.map((r, i) => [r.status, { label: mixLabel(r.status), color: PIE_COLORS[i % PIE_COLORS.length]! }])) as ChartConfig;

  return (
    <>
      <AdminHeader title="Dashboard" description={`${formatDate(`${range.from}T12:00:00Z`)} – ${formatDate(`${range.to}T12:00:00Z`)}`} />

      <div className="admin-box admin-box-pad mb-6 flex flex-wrap items-end gap-4">
        <div className="admin-seg" role="group" aria-label="Quick date ranges">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={activePreset?.label === p.label}
              onClick={() => setRange({ from: daysAgo(p.days - 1), to: lagosDate(), groupBy: p.groupBy })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="grid gap-1">
          <span className="admin-label">From</span>
          <input type="date" className="admin-input" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ from: e.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="admin-label">To</span>
          <input type="date" className="admin-input" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ to: e.target.value })} />
        </label>
        <label className="grid gap-1">
          <span className="admin-label">Group by</span>
          <select className="admin-input" value={range.groupBy} onChange={(e) => setRange({ groupBy: e.target.value as DashboardRange["groupBy"] })}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, hint, value, Icon, tone }) => (
          <div key={label} className="admin-box admin-box-pad grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-muted-foreground">{label}</p>
              <span className="admin-stat-icon" data-tone={tone}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
            </div>
            <p className="font-heading text-3xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="admin-box admin-box-pad" aria-labelledby="rev-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="rev-title" className="admin-box-title">Revenue</h2>
            <span className="text-sm font-bold text-muted-foreground">{naira.format(s.revenue)}</span>
          </div>
          {s.revenue === 0 ? (
            <EmptyState icon={<Banknote className="size-5" />} title="No paid orders yet">
              Revenue appears here once Paystack confirms a payment.
            </EmptyState>
          ) : (
            <ChartContainer config={revenueConfig} className="aspect-auto h-72 w-full">
              <BarChart data={data.series} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={fmtBucket} />
                <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => compactNaira.format(v)} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent labelFormatter={(l) => fmtBucket(String(l))} formatter={(v) => naira.format(Number(v))} />}
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ChartContainer>
          )}
        </section>

        <section className="admin-box admin-box-pad" aria-labelledby="mix-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="mix-title" className="admin-box-title">Order status</h2>
            <div className="admin-seg" role="group" aria-label="Status type">
              <button type="button" aria-pressed={mix === "fulfilment"} onClick={() => setMix("fulfilment")}>Fulfilment</button>
              <button type="button" aria-pressed={mix === "payment"} onClick={() => setMix("payment")}>Payment</button>
            </div>
          </div>
          {mixTotal === 0 ? (
            <EmptyState icon={<ClipboardList className="size-5" />} title="No orders in this period" />
          ) : (
            <>
              <div className="relative">
                <ChartContainer config={mixConfig} className="mx-auto aspect-square h-56">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
                    <Pie data={mixRows} dataKey="count" nameKey="status" innerRadius={62} outerRadius={92} strokeWidth={3} stroke="var(--color-card)">
                      {mixRows.map((r, i) => (
                        <Cell key={r.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                  <span className="font-heading text-3xl font-semibold">{mixTotal}</span>
                  <span className="text-xs text-muted-foreground">orders</span>
                </div>
              </div>
              <ul className="mt-4 grid gap-2 text-sm">
                {mixRows.map((r, i) => (
                  <li key={r.status} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {mixLabel(r.status)}
                    </span>
                    <span className="font-bold">{r.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="admin-box mt-6" aria-labelledby="recent-title">
        <div className="flex items-center justify-between p-4 sm:px-6">
          <h2 id="recent-title" className="admin-box-title">Recent orders</h2>
          <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">
            All orders <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        {data.recent.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-5" />} title="No orders yet">
            New orders from the shop will show up here.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Status</th><th className="text-right">Total</th></tr>
              </thead>
              <tbody>
                {data.recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link to="/admin/orders/$id" params={{ id: o.id }} className="font-bold text-foreground hover:text-brand">{o.orderNumber}</Link></td>
                    <td>{o.customerName}</td>
                    <td className="text-muted-foreground">{formatDate(o.createdAt)}</td>
                    <td><PaymentPill status={o.paymentStatus} /></td>
                    <td><FulfilmentPill status={o.status} /></td>
                    <td className="text-right font-bold">{naira.format(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
