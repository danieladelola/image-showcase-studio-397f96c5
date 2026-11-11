import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MapPin, MessageSquareQuote, Phone } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader, EmptyState, formatDateTime } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { adminSetQuoteStatus } from "@/lib/admin.functions";
import { adminQuotesQuery } from "@/lib/admin.queries";

export const Route = createFileRoute("/admin/_app/quotes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQuotesQuery),
  head: () => ({
    meta: [
      { title: "Quote requests | RUWATA Admin" },
      { name: "description", content: "Customer quote requests for RUWATA products and solar systems." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Quote requests | RUWATA Admin" },
      { property: "og:description", content: "Quote requests for the RUWATA team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuotesPage,
});

function QuotesPage() {
  const { data: quotes } = useSuspenseQuery(adminQuotesQuery);
  const [filter, setFilter] = useState<"new" | "handled" | "all">("new");
  const setStatus = useServerFn(adminSetQuoteStatus);
  const qc = useQueryClient();
  const shown = quotes.filter((q) => filter === "all" || q.status === filter);
  const newCount = quotes.filter((q) => q.status === "new").length;

  async function mark(id: string, status: "new" | "handled") {
    try {
      await setStatus({ data: { id, status } });
      await qc.invalidateQueries({ queryKey: ["admin", "quotes"] });
      toast.success(status === "handled" ? "Marked as handled." : "Moved back to new.");
    } catch {
      toast.error("Couldn't update. Please try again.");
    }
  }

  return (
    <>
      <AdminHeader title="Quote requests" description={`${newCount} new ${newCount === 1 ? "request" : "requests"}`} />
      <div className="mb-4 flex gap-2">
        {(["new", "handled", "all"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="font-bold capitalize" onClick={() => setFilter(f)}>{f}</Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={MessageSquareQuote} title="No quote requests here" description="Requests from “Request a Quote” buttons and the quote form appear here." />
      ) : (
        <div className="grid gap-4">
          {shown.map((q) => (
            <section key={q.id} className="admin-box admin-box-pad grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid gap-0.5">
                  <h2 className="font-heading text-lg font-semibold">{q.name}</h2>
                  <p className="text-xs text-muted-foreground">{formatDateTime(q.createdAt)}</p>
                </div>
                <span className="status-pill" data-tone={q.status === "new" ? "wait" : "good"}>{q.status === "new" ? "New" : "Handled"}</span>
              </div>
              {q.productName && (
                <p className="text-sm">
                  Product:{" "}
                  {q.productId ? <Link to="/admin/products/$id" params={{ id: q.productId }} className="font-bold text-brand hover:underline">{q.productName}</Link> : <strong>{q.productName}</strong>}
                  {q.quantity ? <> · Qty <strong>{q.quantity}</strong></> : null}
                </p>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <a href={`tel:${q.phone}`} className="flex items-center gap-1.5 hover:text-brand"><Phone className="size-4" aria-hidden="true" />{q.phone}</a>
                <a href={`mailto:${q.email}`} className="flex items-center gap-1.5 hover:text-brand"><Mail className="size-4" aria-hidden="true" />{q.email}</a>
                <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{q.location}</span>
              </div>
              <p className="rounded-lg bg-admin-canvas p-3 text-sm">{q.message}{q.systemSize ? ` · Size: ${q.systemSize}` : ""}{q.budget ? ` · Budget: ${q.budget}` : ""}</p>
              <div>
                <Button size="sm" variant="outline" className="font-bold" onClick={() => mark(q.id, q.status === "new" ? "handled" : "new")}>
                  {q.status === "new" ? "Mark as handled" : "Move back to new"}
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
