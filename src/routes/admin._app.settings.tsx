import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CreditCard, LoaderCircle, TriangleAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AdminHeader, FieldError, formatDate } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { addAdminUser } from "@/lib/admin-auth.functions";
import { adminSaveSettings } from "@/lib/admin.functions";
import { adminSettingsQuery } from "@/lib/admin.queries";
import { storeSettingsSchema, type StoreSettings } from "@/lib/store-settings";

export const Route = createFileRoute("/admin/_app/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminSettingsQuery),
  head: () => ({
    meta: [
      { title: "Settings | RUWATA Admin" },
      { name: "description", content: "Delivery, pickup, payment and team settings for the RUWATA store." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Settings | RUWATA Admin" },
      { property: "og:description", content: "Store settings for the RUWATA team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSuspenseQuery(adminSettingsQuery);
  return (
    <>
      <AdminHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <DeliverySettings initial={data.settings} />
        <div className="grid gap-6">
          <PaymentStatus configured={data.paystack.configured} mode={data.paystack.mode} />
          <TeamSettings admins={data.admins} meId={data.me.id} />
        </div>
      </div>
    </>
  );
}

function DeliverySettings({ initial }: { initial: StoreSettings }) {
  const [s, setS] = useState({ ...initial, deliveryFee: String(initial.deliveryFee) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const saveFn = useServerFn(adminSaveSettings);
  const qc = useQueryClient();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const fee = s.deliveryFee.trim() === "" ? Number.NaN : Number(s.deliveryFee.replace(/[,\s₦]/g, ""));
    const parsed = storeSettingsSchema.safeParse({ ...s, deliveryFee: fee });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const i of parsed.error.issues) next[String(i.path[0])] ??= i.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveFn({ data: parsed.data });
      await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      await qc.invalidateQueries({ queryKey: ["checkout-config"] });
      toast.success("Delivery settings saved");
    } catch {
      toast.error("Settings couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="admin-box admin-box-pad grid gap-5">
      <div>
        <h2 className="admin-box-title">Delivery and pickup</h2>
        <p className="mt-1 text-sm text-muted-foreground">These options and fees appear at checkout.</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="delivery-on" className="text-sm font-bold">Offer delivery</label>
          <Switch id="delivery-on" checked={s.deliveryEnabled} onCheckedChange={(v) => setS({ ...s, deliveryEnabled: v })} />
        </div>
        {s.deliveryEnabled && (
          <>
            <label className="grid gap-1.5">
              <span className="admin-label">Delivery fee (₦)</span>
              <input inputMode="numeric" className="admin-input w-48" aria-invalid={!!errors.deliveryFee} value={s.deliveryFee} onChange={(e) => setS({ ...s, deliveryFee: e.target.value })} />
              {errors.deliveryFee ? <FieldError message={errors.deliveryFee} /> : <span className="text-xs text-muted-foreground">Enter 0 for free delivery.</span>}
            </label>
            <label className="grid gap-1.5">
              <span className="admin-label">Delivery note</span>
              <input className="admin-input" maxLength={200} value={s.deliveryNote} onChange={(e) => setS({ ...s, deliveryNote: e.target.value })} placeholder="e.g. Delivered within 3–5 working days in Lagos" />
            </label>
          </>
        )}
        <FieldError message={errors.deliveryEnabled} />
      </div>

      <div className="grid gap-4 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="pickup-on" className="text-sm font-bold">Offer pickup</label>
          <Switch id="pickup-on" checked={s.pickupEnabled} onCheckedChange={(v) => setS({ ...s, pickupEnabled: v })} />
        </div>
        {s.pickupEnabled && (
          <label className="grid gap-1.5">
            <span className="admin-label">Pickup address</span>
            <textarea rows={2} className="admin-input" aria-invalid={!!errors.pickupAddress} value={s.pickupAddress} onChange={(e) => setS({ ...s, pickupAddress: e.target.value })} />
            <FieldError message={errors.pickupAddress} />
          </label>
        )}
      </div>

      <Button type="submit" disabled={saving} className="justify-self-start font-bold">
        {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />} Save delivery settings
      </Button>
    </form>
  );
}

function PaymentStatus({ configured, mode }: { configured: boolean; mode: string | null }) {
  return (
    <section className="admin-box admin-box-pad grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="admin-box-title flex items-center gap-2"><CreditCard className="size-5 text-brand" aria-hidden="true" /> Paystack payments</h2>
        {configured ? (
          <span className="status-pill" data-tone={mode === "live" ? "good" : "wait"}>{mode === "live" ? "Live" : "Test mode"}</span>
        ) : (
          <span className="status-pill" data-tone="bad">Not connected</span>
        )}
      </div>
      {configured ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          {mode === "live" ? "Customers can pay online. Real money is charged." : "Customers can try checkout, but no real money is charged until you switch to your live key."}
        </p>
      ) : (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          Online payment is switched off. Customers see a message asking them to contact you. Ask your developer to add your Paystack secret key to turn it on.
        </p>
      )}
    </section>
  );
}

function TeamSettings({ admins, meId }: { admins: Array<{ id: string; name: string; email: string; createdAt: string }>; meId: string }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const addFn = useServerFn(addAdminUser);
  const qc = useQueryClient();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter a name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.password.length < 10) next.password = "Use at least 10 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const res = await addFn({ data: form });
      if (!res.ok) {
        setErrors({ email: res.message });
        return;
      }
      setForm({ name: "", email: "", password: "" });
      await qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Team member added. Share their password with them securely.");
    } catch {
      toast.error("We couldn't add that person. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-box admin-box-pad grid gap-4">
      <h2 className="admin-box-title">Team</h2>
      <ul className="grid divide-y divide-border rounded-xl border border-border">
        {admins.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="grid min-w-0">
              <span className="truncate font-bold">{a.name}{a.id === meId && <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>}</span>
              <span className="truncate text-muted-foreground">{a.email}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">Since {formatDate(a.createdAt)}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} noValidate className="grid gap-3 border-t border-border pt-4">
        <p className="text-sm font-bold">Add a team member</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="admin-label">Name</span>
            <input className="admin-input" aria-invalid={!!errors.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <FieldError message={errors.name} />
          </label>
          <label className="grid gap-1.5">
            <span className="admin-label">Email</span>
            <input type="email" className="admin-input" aria-invalid={!!errors.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <FieldError message={errors.email} />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="admin-label">Temporary password</span>
            <input type="password" autoComplete="new-password" className="admin-input" aria-invalid={!!errors.password} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {errors.password ? <FieldError message={errors.password} /> : <span className="text-xs text-muted-foreground">At least 10 characters.</span>}
          </label>
        </div>
        <Button type="submit" variant="outline" disabled={saving} className="justify-self-start font-bold">
          {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />} Add team member
        </Button>
      </form>
    </section>
  );
}
