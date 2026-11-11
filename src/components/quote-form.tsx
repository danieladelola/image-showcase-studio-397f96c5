import { useState, type FormEvent, type ReactNode } from "react";
import { useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { quoteRequestSchema, submitQuoteRequest } from "@/lib/quote-requests.functions";

type RequestFields = {
  name: string;
  phone: string;
  email: string;
  location: string;
  propertyType: "" | "Home" | "Apartment" | "Office" | "Business" | "Other";
  systemSize: "" | "2.5 kVA" | "10 kVA" | "20 kVA" | "30 kVA" | "Not sure" | "Other";
  budget: string;
  powerNeeds: string;
};

const emptyFields: RequestFields = {
  name: "",
  phone: "",
  email: "",
  location: "",
  propertyType: "",
  systemSize: "",
  budget: "",
  powerNeeds: "",
};

export function QuoteForm() {
  const submit = useServerFn(submitQuoteRequest);
  const { product } = useSearch({ strict: false }) as { product?: string };
  const [fields, setFields] = useState<RequestFields>(() =>
    product ? { ...emptyFields, powerNeeds: `I'd like a quote for the ${product}.` } : emptyFields,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  const update = (key: keyof RequestFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
    setStatus(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    const result = quoteRequestSchema.safeParse(fields);
    if (!result.success) {
      const nextErrors: Partial<Record<keyof RequestFields, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in emptyFields) {
          const field = key as keyof RequestFields;
          if (!nextErrors[field]) nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSending(true);
    try {
      const response = await submit({ data: result.data });
      setStatus(response);
      if (response.ok) setFields(emptyFields);
    } catch {
      setStatus({ ok: false, message: "We couldn't save your request just now. Please try again." });
    } finally {
      setSending(false);
    }
  };

  const messageId = (key: keyof RequestFields) => (errors[key] ? `${key}-error` : undefined);

  return (
    <div>
      {status?.ok ? (
        <div role="status" className="grid justify-items-start gap-4 py-8">
          <CheckCircle2 aria-hidden="true" className="size-10 text-brand" />
          <h3 className="text-2xl font-semibold">Request received</h3>
          <p className="max-w-md text-lead">{status.message}</p>
          <Button variant="outline" onClick={() => setStatus(null)}>Send another request</Button>
        </div>
      ) : (
        <form className="quote-form" noValidate onSubmit={handleSubmit} aria-describedby={status ? "quote-status" : undefined}>
          <div className="form-grid">
          <Field id="name" label="Your name" error={errors["name"]}>
              <input id="name" className="form-control" autoComplete="name" value={fields.name} onChange={(event) => update("name", event.target.value)} aria-invalid={Boolean(errors["name"])} aria-describedby={messageId("name")} />
            </Field>
            <Field id="phone" label="Phone number" error={errors["phone"]}>
              <input id="phone" className="form-control" type="tel" autoComplete="tel" value={fields.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(errors["phone"])} aria-describedby={messageId("phone")} />
            </Field>
            <Field id="email" label="Email address" error={errors["email"]}>
              <input id="email" className="form-control" type="email" autoComplete="email" value={fields.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors["email"])} aria-describedby={messageId("email")} />
            </Field>
            <Field id="location" label="State or city" error={errors["location"]}>
              <input id="location" className="form-control" autoComplete="address-level1" value={fields.location} onChange={(event) => update("location", event.target.value)} aria-invalid={Boolean(errors["location"])} aria-describedby={messageId("location")} />
            </Field>
            <Field id="propertyType" label="Property type" error={errors["propertyType"]}>
              <select id="propertyType" className="form-control" value={fields.propertyType} onChange={(event) => update("propertyType", event.target.value)} aria-invalid={Boolean(errors["propertyType"])} aria-describedby={messageId("propertyType")}>
                <option value="">Choose a property type</option>
                <option value="Home">Home</option>
                <option value="Apartment">Apartment</option>
                <option value="Office">Office</option>
                <option value="Business">Business</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field id="systemSize" label="System size (optional)" error={errors["systemSize"]}>
              <select id="systemSize" className="form-control" value={fields.systemSize} onChange={(event) => update("systemSize", event.target.value)} aria-invalid={Boolean(errors["systemSize"])} aria-describedby={messageId("systemSize")}>
                <option value="">I’m not sure yet</option>
                <option value="2.5 kVA">2.5 kVA</option>
                <option value="10 kVA">10 kVA</option>
                <option value="20 kVA">20 kVA</option>
                <option value="30 kVA">30 kVA</option>
                <option value="Not sure">Not sure</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field id="budget" label="Preferred budget (optional)" error={errors["budget"]}>
              <input id="budget" className="form-control" placeholder="e.g. ₦2,000,000" value={fields.budget} onChange={(event) => update("budget", event.target.value)} aria-invalid={Boolean(errors["budget"])} aria-describedby={messageId("budget")} />
            </Field>
          </div>
          <Field id="powerNeeds" label="Energy requirements — what do you need to power?" error={errors["powerNeeds"]}>
            <textarea id="powerNeeds" className="form-control min-h-32 resize-y" value={fields.powerNeeds} onChange={(event) => update("powerNeeds", event.target.value)} aria-invalid={Boolean(errors["powerNeeds"])} aria-describedby={messageId("powerNeeds")} />
          </Field>
          {status && !status.ok ? <p id="quote-status" role="alert" className="text-sm font-semibold text-destructive">{status.message}</p> : null}
          <p className="text-sm leading-6 text-muted-foreground">A member of the RUWATA team will review your power needs before recommending a system.</p>
          <Button type="submit" disabled={sending} className="h-12 w-fit min-w-48 px-6 font-bold">
            {sending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ArrowRight aria-hidden="true" />}
            {sending ? "Sending request…" : "Get a Quote"}
          </Button>
        </form>
      )}
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error: string | undefined; children: ReactNode }) {
  return (
    <div className="form-field">
      <label className="text-sm font-bold" htmlFor={id}>{label}</label>
      {children}
      {error ? <span id={`${id}-error`} className="text-sm text-destructive">{error}</span> : null}
    </div>
  );
}