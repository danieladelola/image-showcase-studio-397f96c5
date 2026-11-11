import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FULFILMENT_LABEL, PAYMENT_LABEL, type FulfilmentStatus, type PaymentStatus } from "@/lib/admin-schemas";
import type { ProductStatus } from "@/lib/shop-types";

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "good" | "wait" | "bad" | "info" | "muted";

const FULFILMENT_TONE: Record<FulfilmentStatus, Tone> = {
  pending: "info",
  confirmed: "info",
  processing: "wait",
  shipped: "wait",
  delivered: "good",
  installed: "good",
  cancelled: "muted",
};
const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  unpaid: "muted",
  pending: "wait",
  paid: "good",
  failed: "bad",
  cancelled: "muted",
  refunded: "info",
};
const PRODUCT_TONE: Record<ProductStatus, Tone> = { published: "good", draft: "wait", archived: "muted" };
export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = { published: "Published", draft: "Draft", archived: "Archived" };

export function FulfilmentPill({ status }: { status: string }) {
  const s = status as FulfilmentStatus;
  return <span className="status-pill" data-tone={FULFILMENT_TONE[s] ?? "info"}>{FULFILMENT_LABEL[s] ?? status}</span>;
}

export function PaymentPill({ status }: { status: string }) {
  const s = status as PaymentStatus;
  return <span className="status-pill" data-tone={PAYMENT_TONE[s] ?? "info"}>{PAYMENT_LABEL[s] ?? status}</span>;
}

export function ProductStatusPill({ status }: { status: ProductStatus }) {
  return <span className="status-pill" data-tone={PRODUCT_TONE[status]}>{PRODUCT_STATUS_LABEL[status]}</span>;
}

const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
const dateTimeFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" });
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 px-6 py-14 text-center">
      <div className="admin-stat-icon size-12">{icon}</div>
      <p className="font-heading text-lg font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export const PAGE_SIZE = 10;

export function Pager({ page, total, onPage, noun }: { page: number; total: number; onPage: (p: number) => void; noun: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total === 0) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <span>
        Showing {start}–{end} of {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="min-w-16 text-center font-bold text-foreground">
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function FieldError({ id, message }: { id?: string | undefined; message?: string | undefined }) {
  if (!message) return null;
  return (
    <span id={id} className="text-xs font-bold text-destructive">
      {message}
    </span>
  );
}
