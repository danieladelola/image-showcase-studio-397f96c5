import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CreditCard, LoaderCircle, Lock, Minus, Package, Plus, ShoppingBag, Store, Trash2, Truck, Wrench } from "lucide-react";
import { z } from "zod";

import { PageFrame } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { cart, useCart } from "@/lib/cart";
import { customerSchema, type CustomerInput } from "@/lib/checkout-schema";
import { getCartProducts, getCheckoutConfig, placeOrder, quoteCheckout } from "@/lib/checkout.functions";
import { OrderError, installationFeeFor, priceOrder, type DeliveryMethod } from "@/lib/order-math";
import { maxOrderQty, purchaseState, sellingPrice } from "@/lib/product-rules";
import { naira, type Product } from "@/lib/shop-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) =>
    z
      .object({
        buy: z.string().max(200).optional().catch(undefined),
        qty: z.number().int().min(1).max(99).optional().catch(undefined),
      })
      .parse(search),
  head: () => ({
    meta: [
      { title: "Checkout | RUWATA Solar" },
      { name: "description", content: "Review your cart, choose delivery or installation, and pay securely with Paystack — no account needed." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Checkout | RUWATA Solar" },
      { property: "og:description", content: "Guest checkout for RUWATA solar products with secure Paystack payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

const STEPS = ["Cart", "Details", "Delivery", "Review", "Payment"] as const;

type Line = { productId: string; quantity: number; name: string; slug: string; imageUrl: string | null; product: Product | null };
type Field = keyof CustomerInput;

const EMPTY_CUSTOMER: Record<Field, string> = { customerName: "", email: "", phone: "", address: "", city: "", state: "", notes: "" };
const DETAILS_KEY = "ruwata-checkout-details";

function CheckoutPage() {
  const search = Route.useSearch();
  const buyMode = !!search.buy;
  const cartLines = useCart();
  const [buyQty, setBuyQty] = useState(search.qty ?? 1);
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<Record<Field, string>>(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("delivery");
  const [installation, setInstallation] = useState(false);

  // Keep typed details for this browser tab so going back and forth doesn't lose them.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DETAILS_KEY) ?? "null");
      if (saved && typeof saved === "object") setCustomer((c) => ({ ...c, ...saved }));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(DETAILS_KEY, JSON.stringify(customer));
    } catch {
      /* ignore */
    }
  }, [customer]);

  const fetchProducts = useServerFn(getCartProducts);
  const fetchConfig = useServerFn(getCheckoutConfig);
  const ids = buyMode ? [] : cartLines.map((l) => l.productId);
  const config = useQuery({ queryKey: ["checkout-config"], queryFn: () => fetchConfig(), staleTime: 30_000 });
  const products = useQuery({
    queryKey: ["checkout-products", ids.join(","), search.buy ?? ""],
    queryFn: () => fetchProducts({ data: { ids, slug: search.buy } }),
    enabled: buyMode || ids.length > 0,
    staleTime: 15_000,
  });

  const lines: Line[] = useMemo(() => {
    const live = new Map((products.data ?? []).map((p) => [p.id, p]));
    if (buyMode) {
      const p = (products.data ?? []).find((x) => x.slug === search.buy) ?? null;
      return p ? [{ productId: p.id, quantity: buyQty, name: p.name, slug: p.slug, imageUrl: p.featuredImage?.url ?? null, product: p }] : [];
    }
    return cartLines.map((l) => ({ ...l, product: products.data ? (live.get(l.productId) ?? null) : null }));
  }, [buyMode, buyQty, cartLines, products.data, search.buy]);

  // Refresh saved cart lines with live prices and stock limits.
  useEffect(() => {
    if (buyMode || !products.data) return;
    cart.sync(
      products.data.map((p) => ({ productId: p.id, slug: p.slug, name: p.name, price: sellingPrice(p) ?? 0, imageUrl: p.featuredImage?.url ?? null, maxQty: maxOrderQty(p) })),
    );
  }, [buyMode, products.data]);

  const settings = config.data?.settings;
  useEffect(() => {
    if (settings && !settings.deliveryEnabled && settings.pickupEnabled) setDeliveryMethod("pickup");
  }, [settings]);

  const issues = lines.flatMap((l) => {
    if (!products.data) return [];
    if (!l.product) return [{ id: l.productId, text: `${l.name} is no longer available. Please remove it.` }];
    const state = purchaseState(l.product);
    if (state === "unavailable") return [{ id: l.productId, text: `${l.name} is not available right now. Please remove it.` }];
    if (l.quantity > maxOrderQty(l.product)) return [{ id: l.productId, text: `Only ${maxOrderQty(l.product)} of ${l.name} available.` }];
    return [];
  });

  const installableLines = lines.filter((l) => l.product && installationFeeFor(l.product) != null);
  const options = { deliveryMethod, installation: installation && installableLines.length > 0 };

  const estimate = useMemo(() => {
    if (!settings || !products.data || issues.length) return null;
    const catalog = new Map(lines.filter((l) => l.product).map((l) => [l.productId, l.product!]));
    try {
      return priceOrder(lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), catalog, options, settings);
    } catch (e) {
      if (e instanceof OrderError) return null;
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, products.data, lines, deliveryMethod, installation, issues.length]);

  const loading = config.isPending || ((buyMode || ids.length > 0) && products.isPending);
  const loadFailed = config.isError || products.isError;

  function goTo(next: number) {
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitDetails(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = customerSchema.safeParse(customer);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as Field] ??= issue.message;
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first) document.getElementById(`co-${first}`)?.focus();
      return;
    }
    setErrors({});
    goTo(2);
  }

  const setQty = (l: Line, q: number) => {
    const max = l.product ? Math.max(1, maxOrderQty(l.product)) : 99;
    const value = Math.max(1, Math.min(max, q));
    if (buyMode) setBuyQty(value);
    else cart.setQuantity(l.productId, value);
  };

  const empty = !loading && lines.length === 0;

  return (
    <PageFrame>
      <section className="section-space">
        <div className="site-wrap">
          <div className="mb-8 grid gap-3">
            <span className="eyebrow eyebrow-plain">Guest checkout</span>
            <h1 className="section-heading">{buyMode ? "Buy now" : "Your cart"}</h1>
            <p className="text-muted-foreground">No account needed. Prices and charges are confirmed before you pay.</p>
          </div>

          {!empty && <Stepper step={step} onStep={(i) => i < step && goTo(i)} />}

          {buyMode && cartLines.length > 0 && (
            <p className="mb-6 rounded-xl border border-border bg-accent px-4 py-3 text-sm text-accent-foreground">
              You're buying just this item. Your cart ({cartLines.length} {cartLines.length === 1 ? "product" : "products"}) is saved for later.
            </p>
          )}

          {loadFailed ? (
            <div role="alert" className="grid justify-items-center gap-3 rounded-2xl border border-destructive/40 p-10 text-center">
              <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
              <p className="font-bold">We couldn't load checkout just now.</p>
              <Button variant="outline" onClick={() => { void config.refetch(); void products.refetch(); }}>Try again</Button>
            </div>
          ) : loading ? (
            <div className="grid gap-3" aria-busy="true" aria-label="Loading checkout">
              {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-accent" />)}
            </div>
          ) : empty ? (
            <div className="grid justify-items-center gap-4 rounded-2xl border border-dashed border-border p-14 text-center">
              <ShoppingBag className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-lg font-semibold">{buyMode ? "That product isn't available to buy online." : "Your cart is empty"}</p>
              <Button asChild className="h-11 px-6 font-bold"><Link to="/our-products" hash="shop">Browse products</Link></Button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
              <div className="grid gap-6">
                {step === 0 && (
                  <div className="checkout-panel">
                    <h2 className="checkout-legend">Review your items</h2>
                    <ul className="grid divide-y divide-border">
                      {lines.map((l) => {
                        const price = l.product ? sellingPrice(l.product) : null;
                        const max = l.product ? maxOrderQty(l.product) : 0;
                        const issue = issues.find((i) => i.id === l.productId);
                        return (
                          <li key={l.productId} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[5rem_minmax(0,1fr)_auto]">
                            {l.imageUrl ? <img src={l.imageUrl} alt="" className="size-18 rounded-xl object-cover sm:size-20" /> : <div className="grid size-18 place-items-center rounded-xl bg-accent sm:size-20"><Package className="size-6 text-muted-foreground" aria-hidden="true" /></div>}
                            <div className="grid content-start gap-1.5">
                              <Link to="/our-products/$slug" params={{ slug: l.slug }} className="font-bold leading-snug hover:text-brand">{l.name}</Link>
                              <span className="text-sm text-muted-foreground">{price != null ? `${naira.format(price)} each` : "—"}</span>
                              {issue && <span className="text-sm font-bold text-destructive">{issue.text}</span>}
                              <div className="mt-1 flex items-center gap-3">
                                <div className="pd-qty pd-qty-sm" role="group" aria-label={`Quantity of ${l.name}`}>
                                  <button type="button" aria-label={`Decrease ${l.name}`} disabled={l.quantity <= 1} onClick={() => setQty(l, l.quantity - 1)}><Minus className="size-3.5" /></button>
                                  <span aria-live="polite">{l.quantity}</span>
                                  <button type="button" aria-label={`Increase ${l.name}`} disabled={l.quantity >= max} onClick={() => setQty(l, l.quantity + 1)}><Plus className="size-3.5" /></button>
                                </div>
                                {!buyMode && (
                                  <button type="button" onClick={() => cart.remove(l.productId)} className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-destructive">
                                    <Trash2 className="size-4" aria-hidden="true" /> Remove
                                  </button>
                                )}
                              </div>
                            </div>
                            <span className="col-start-2 font-heading text-lg font-semibold sm:col-start-3 sm:text-right">{price != null ? naira.format(price * l.quantity) : ""}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
                      <Button asChild variant="ghost" className="font-bold"><Link to="/our-products" hash="shop"><ArrowLeft aria-hidden="true" /> Keep shopping</Link></Button>
                      <Button className="h-12 px-7 font-bold" disabled={issues.length > 0} onClick={() => goTo(1)}>Continue to details <ArrowRight aria-hidden="true" /></Button>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <form onSubmit={submitDetails} noValidate className="checkout-panel">
                    <h2 className="checkout-legend">Your details</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField id="customerName" label="Full name" autoComplete="name" wide value={customer} error={errors} onChange={setCustomer} />
                      <TextField id="email" label="Email address" type="email" autoComplete="email" value={customer} error={errors} onChange={setCustomer} hint="Your receipt is sent here." />
                      <TextField id="phone" label="Phone number" type="tel" autoComplete="tel" value={customer} error={errors} onChange={setCustomer} />
                      <TextField id="address" label="Delivery address" autoComplete="street-address" wide value={customer} error={errors} onChange={setCustomer} />
                      <TextField id="city" label="City / town" autoComplete="address-level2" value={customer} error={errors} onChange={setCustomer} />
                      <label className="grid gap-2" htmlFor="co-state">
                        <span className="text-sm font-bold">State</span>
                        <select id="co-state" className="form-control" autoComplete="address-level1" value={customer.state} aria-invalid={!!errors.state}
                          onChange={(e) => setCustomer((c) => ({ ...c, state: e.target.value }))}>
                          <option value="">Choose a state</option>
                          {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {errors.state && <span className="text-sm text-destructive">{errors.state}</span>}
                      </label>
                      <label className="grid gap-2 sm:col-span-2" htmlFor="co-notes">
                        <span className="text-sm font-bold">Notes for our team <span className="font-normal text-muted-foreground">(optional)</span></span>
                        <textarea id="co-notes" rows={3} className="form-control" value={customer.notes} onChange={(e) => setCustomer((c) => ({ ...c, notes: e.target.value }))} />
                      </label>
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
                      <Button type="button" variant="ghost" className="font-bold" onClick={() => goTo(0)}><ArrowLeft aria-hidden="true" /> Back to cart</Button>
                      <Button type="submit" className="h-12 px-7 font-bold">Continue to delivery <ArrowRight aria-hidden="true" /></Button>
                    </div>
                  </form>
                )}

                {step === 2 && settings && (
                  <div className="checkout-panel">
                    <h2 className="checkout-legend">Delivery and installation</h2>
                    <fieldset className="grid gap-3">
                      <legend className="mb-2 text-sm font-bold">How would you like to receive your order?</legend>
                      {settings.deliveryEnabled && (
                        <label className="checkout-option">
                          <input type="radio" name="delivery" checked={deliveryMethod === "delivery"} onChange={() => setDeliveryMethod("delivery")} className="accent-[var(--color-brand)]" />
                          <Truck className="size-5 shrink-0 text-brand" aria-hidden="true" />
                          <span className="grid flex-1">
                            <span className="font-bold">Delivery to my address</span>
                            <span className="text-sm text-muted-foreground">{settings.deliveryNote || `${customer.city}, ${customer.state}`}</span>
                          </span>
                          <span className="font-bold">{settings.deliveryFee > 0 ? naira.format(settings.deliveryFee) : "Free"}</span>
                        </label>
                      )}
                      {settings.pickupEnabled && (
                        <label className="checkout-option">
                          <input type="radio" name="delivery" checked={deliveryMethod === "pickup"} onChange={() => setDeliveryMethod("pickup")} className="accent-[var(--color-brand)]" />
                          <Store className="size-5 shrink-0 text-brand" aria-hidden="true" />
                          <span className="grid flex-1">
                            <span className="font-bold">Pick up from RUWATA</span>
                            <span className="text-sm text-muted-foreground">{settings.pickupAddress}</span>
                          </span>
                          <span className="font-bold">Free</span>
                        </label>
                      )}
                    </fieldset>

                    <div className="mt-6 grid gap-3">
                      <p className="text-sm font-bold">Installation</p>
                      {installableLines.length > 0 ? (
                        <label className="checkout-option">
                          <input type="checkbox" checked={installation} onChange={(e) => setInstallation(e.target.checked)} className="size-4 accent-[var(--color-brand)]" />
                          <Wrench className="size-5 shrink-0 text-brand" aria-hidden="true" />
                          <span className="grid flex-1">
                            <span className="font-bold">Add professional installation</span>
                            <span className="text-sm text-muted-foreground">For {installableLines.map((l) => l.name).join(", ")}</span>
                          </span>
                          <span className="font-bold">
                            {naira.format(installableLines.reduce((s, l) => s + (installationFeeFor(l.product!) ?? 0) * l.quantity, 0))}
                          </span>
                        </label>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {lines.some((l) => l.product?.specs.installationIncluded)
                            ? "Installation is already included with your system."
                            : "Installation isn't sold online for these items. Our team can advise after your order."}
                        </p>
                      )}
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
                      <Button type="button" variant="ghost" className="font-bold" onClick={() => goTo(1)}><ArrowLeft aria-hidden="true" /> Back to details</Button>
                      <Button className="h-12 px-7 font-bold" onClick={() => goTo(3)}>Review order <ArrowRight aria-hidden="true" /></Button>
                    </div>
                  </div>
                )}

                {step >= 3 && (
                  <ReviewStep
                    lines={lines}
                    customer={customer}
                    options={options}
                    paymentsEnabled={!!config.data?.paymentsEnabled}
                    testMode={config.data?.paymentMode === "test"}
                    clearCartWhenPaid={!buyMode}
                    onBack={() => goTo(2)}
                    onEdit={goTo}
                    onPaying={() => setStep(4)}
                    onFailed={() => setStep(3)}
                  />
                )}
              </div>

              <OrderSummary lines={lines} estimate={estimate} step={step} options={options} />
            </div>
          )}
        </div>
      </section>
    </PageFrame>
  );
}

function Stepper({ step, onStep }: { step: number; onStep: (i: number) => void }) {
  return (
    <ol className="checkout-steps" aria-label="Checkout progress">
      {STEPS.map((label, i) => (
        <li key={label} aria-current={i === step ? "step" : undefined} data-done={i < step || undefined}>
          <button type="button" onClick={() => onStep(i)} disabled={i >= step} className="checkout-step">
            <span className="checkout-step-dot">{i < step ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}</span>
            <span className="checkout-step-label">{label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function TextField({ id, label, type = "text", autoComplete, wide, value, error, onChange, hint }: {
  id: Field; label: string; type?: string; autoComplete?: string; wide?: boolean; hint?: string;
  value: Record<Field, string>; error: Partial<Record<Field, string>>;
  onChange: React.Dispatch<React.SetStateAction<Record<Field, string>>>;
}) {
  return (
    <label className={cn("grid gap-2", wide && "sm:col-span-2")} htmlFor={`co-${id}`}>
      <span className="text-sm font-bold">{label}</span>
      <input id={`co-${id}`} type={type} autoComplete={autoComplete} className="form-control" value={value[id]} aria-invalid={!!error[id]}
        aria-describedby={error[id] ? `co-${id}-error` : undefined} onChange={(e) => onChange((c) => ({ ...c, [id]: e.target.value }))} />
      {error[id] ? <span id={`co-${id}-error`} className="text-sm text-destructive">{error[id]}</span> : hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

type Estimate = ReturnType<typeof priceOrder> | null;

function OrderSummary({ lines, estimate, step, options }: { lines: Line[]; estimate: Estimate; step: number; options: { deliveryMethod: DeliveryMethod; installation: boolean } }) {
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <aside className="checkout-panel lg:sticky lg:top-24" aria-label="Order summary">
      <h2 className="checkout-legend">Order summary</h2>
      <p className="text-sm text-muted-foreground">{count} {count === 1 ? "item" : "items"}</p>
      <dl className="mt-4 grid gap-2.5 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-bold">{estimate ? naira.format(estimate.subtotal) : "—"}</dd></div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{options.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}</dt>
          <dd>{step < 2 ? "Next steps" : estimate ? (estimate.deliveryFee ? naira.format(estimate.deliveryFee) : "Free") : "—"}</dd>
        </div>
        {estimate && estimate.installationFee > 0 && (
          <div className="flex justify-between"><dt className="text-muted-foreground">Installation</dt><dd>{naira.format(estimate.installationFee)}</dd></div>
        )}
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-4">
          <dt className="font-bold">Total</dt>
          <dd className="font-heading text-2xl font-semibold">{estimate ? naira.format(estimate.total) : "—"}</dd>
        </div>
      </dl>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Lock className="size-3.5" aria-hidden="true" /> Payments are processed securely by Paystack.</p>
    </aside>
  );
}

function ReviewStep({ lines, customer, options, paymentsEnabled, testMode, clearCartWhenPaid, onBack, onEdit, onPaying, onFailed }: {
  lines: Line[]; customer: Record<Field, string>; options: { deliveryMethod: DeliveryMethod; installation: boolean };
  paymentsEnabled: boolean; testMode: boolean; clearCartWhenPaid: boolean;
  onBack: () => void; onEdit: (step: number) => void; onPaying: () => void; onFailed: () => void;
}) {
  const quote = useServerFn(quoteCheckout);
  const place = useServerFn(placeOrder);
  const items = lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));
  const review = useQuery({
    queryKey: ["checkout-quote", JSON.stringify(items), options.deliveryMethod, options.installation],
    queryFn: () => quote({ data: { items, options } }),
  });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setError("");
    setPaying(true);
    onPaying();
    try {
      const res = await place({ data: { ...customerSchema.parse(customer), items, options } });
      if (res.ok) {
        if (clearCartWhenPaid) sessionStorage.setItem("ruwata-clear-cart-for", res.orderToken);
        window.location.assign(res.authorizationUrl);
        return;
      }
      setError(res.message);
    } catch {
      setError("We couldn't start your payment. Please try again.");
    }
    setPaying(false);
    onFailed();
  }

  const r = review.data;
  return (
    <div className="checkout-panel">
      <h2 className="checkout-legend">Review your order</h2>
      {review.isPending ? (
        <div className="grid gap-3" aria-busy="true"><div className="h-16 animate-pulse rounded-xl bg-accent" /><div className="h-16 animate-pulse rounded-xl bg-accent" /></div>
      ) : review.isError || !r ? (
        <p role="alert" className="text-destructive">We couldn't confirm your total. <button className="font-bold underline" onClick={() => review.refetch()}>Try again</button></p>
      ) : !r.ok ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-4 font-bold text-destructive">{r.message}</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <caption className="sr-only">Products in this order</caption>
            <thead className="text-left text-xs tracking-wider text-muted-foreground uppercase">
              <tr><th className="pb-2 font-bold">Product</th><th className="pb-2 text-center font-bold">Qty</th><th className="pb-2 text-right font-bold">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-border border-y border-border">
              {r.items.map((i) => (
                <tr key={i.productId}>
                  <td className="py-3 pr-3"><span className="font-bold">{i.productName}</span><br /><span className="text-muted-foreground">{naira.format(i.unitPrice)} each</span></td>
                  <td className="py-3 text-center">{i.quantity}</td>
                  <td className="py-3 text-right font-bold">{naira.format(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-bold">{naira.format(r.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{options.deliveryMethod === "pickup" ? "Pickup" : "Delivery"}</dt><dd>{r.deliveryFee ? naira.format(r.deliveryFee) : "Free"}</dd></div>
            {r.installationFee > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Installation</dt><dd>{naira.format(r.installationFee)}</dd></div>}
            <div className="flex items-baseline justify-between border-t border-border pt-3"><dt className="font-bold">Total to pay</dt><dd className="font-heading text-2xl font-semibold">{naira.format(r.total)}</dd></div>
          </dl>

          <div className="mt-6 grid gap-4 rounded-xl bg-accent/60 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="flex items-center justify-between font-bold">Contact <button type="button" className="text-xs text-brand underline" onClick={() => onEdit(1)}>Edit</button></p>
              <p className="mt-1 text-muted-foreground">{customer.customerName}<br />{customer.email}<br />{customer.phone}</p>
            </div>
            <div>
              <p className="flex items-center justify-between font-bold">{options.deliveryMethod === "pickup" ? "Pickup" : "Deliver to"} <button type="button" className="text-xs text-brand underline" onClick={() => onEdit(2)}>Edit</button></p>
              <p className="mt-1 text-muted-foreground">{customer.address}<br />{customer.city}, {customer.state}</p>
            </div>
          </div>

          {!paymentsEnabled && (
            <div role="status" className="mt-6 flex gap-3 rounded-xl border border-amber/60 bg-amber/10 p-4 text-sm">
              <AlertTriangle className="size-5 shrink-0 text-amber" aria-hidden="true" />
              <p><strong>Online payment isn't available yet.</strong> Please <Link to="/contact-us" className="font-bold text-brand underline">contact us</Link> to complete this order — we'll confirm it with you directly.</p>
            </div>
          )}
          {paymentsEnabled && testMode && (
            <p className="mt-6 text-xs font-bold text-muted-foreground">Test mode: no real money will be charged.</p>
          )}
          {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/40 p-3 text-sm font-bold text-destructive">{error}</p>}
        </>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" className="font-bold" onClick={onBack} disabled={paying}><ArrowLeft aria-hidden="true" /> Back</Button>
        <Button className="h-12 px-7 font-bold" disabled={!paymentsEnabled || paying || !r?.ok} onClick={pay}>
          {paying ? <><LoaderCircle className="animate-spin" aria-hidden="true" /> Opening Paystack…</> : <><CreditCard aria-hidden="true" /> {r?.ok ? `Pay ${naira.format(r.total)}` : "Pay now"}</>}
        </Button>
      </div>
    </div>
  );
}
