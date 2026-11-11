import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { productQuoteSchema, submitProductQuote } from "@/lib/product-quote.functions";
import type { Product } from "@/lib/shop-types";

type Field = "name" | "phone" | "email" | "location" | "message";
const EMPTY: Record<Field, string> = { name: "", phone: "", email: "", location: "", message: "" };

export function ProductQuoteDialog({ product, quantity, open, onOpenChange }: { product: Product; quantity: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const send = useServerFn(submitProductQuote);
  const [form, setForm] = useState(EMPTY);
  const [qty, setQty] = useState(String(quantity));
  const [errors, setErrors] = useState<Partial<Record<Field | "quantity", string>>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = productQuoteSchema.safeParse({ ...form, productId: product.id, quantity: Number(qty) });
    if (!parsed.success) {
      const next: Partial<Record<Field | "quantity", string>> = {};
      for (const i of parsed.error.issues) next[i.path[0] as Field] ??= i.path[0] === "quantity" ? "Enter a quantity." : i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const res = await send({ data: parsed.data });
      if (res.ok) {
        setDone(true);
        setForm(EMPTY);
      } else setError(res.message);
    } catch {
      setError("We couldn't send your request just now. Please try again.");
    }
    setSending(false);
  }

  const input = (id: Field, label: string, type = "text", auto?: string) => (
    <label className="grid gap-1.5" htmlFor={`pq-${id}`}>
      <span className="text-sm font-bold">{label}</span>
      <input id={`pq-${id}`} type={type} autoComplete={auto} className="form-control" value={form[id]} aria-invalid={!!errors[id]}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))} />
      {errors[id] && <span className="text-sm text-destructive">{errors[id]}</span>}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setDone(false); }}>
      <DialogContent className="quote-sheet">
        {done ? (
          <div className="grid justify-items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-12 text-brand" aria-hidden="true" />
            <DialogTitle className="font-heading text-2xl">Request sent</DialogTitle>
            <DialogDescription>Thanks! Our sales team has your request for <strong>{product.name}</strong> and will contact you with a price shortly.</DialogDescription>
            <Button className="mt-2 font-bold" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4 pb-[env(safe-area-inset-bottom)]">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle className="font-heading text-2xl">Request a quote</DialogTitle>
              <DialogDescription>Tell us how to reach you and we'll send you the price for this product.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-accent/60 p-3">
              {product.featuredImage?.url ? <img src={product.featuredImage.url} alt="" className="size-12 shrink-0 rounded-lg object-cover sm:size-14" /> : <span />}
              <span className="min-w-0 font-bold leading-snug break-words">{product.name}</span>
              <label className="grid gap-1 text-xs font-bold" htmlFor="pq-qty">Qty
                <input id="pq-qty" inputMode="numeric" className="form-control w-16 text-center sm:w-20" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
              </label>
            </div>
            {errors.quantity && <span className="text-sm text-destructive">{errors.quantity}</span>}
            <div className="grid gap-4 sm:grid-cols-2">
              {input("name", "Full name", "text", "name")}
              {input("phone", "Phone number", "tel", "tel")}
              {input("email", "Email address", "email", "email")}
              {input("location", "State / city", "text", "address-level2")}
            </div>
            <label className="grid gap-1.5" htmlFor="pq-message">
              <span className="text-sm font-bold">Anything else? <span className="font-normal text-muted-foreground">(optional)</span></span>
              <textarea id="pq-message" rows={3} className="form-control" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            </label>
            {error && <p role="alert" className="text-sm font-bold text-destructive">{error}</p>}
            <Button type="submit" className="h-12 w-full font-bold" disabled={sending}>
              {sending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Send quote request
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
