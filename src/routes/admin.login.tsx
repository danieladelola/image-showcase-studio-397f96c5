import { useState, type FormEvent } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { adminStatusQuery } from "@/lib/admin.queries";
import { useQueryClient } from "@tanstack/react-query";
import { adminSignIn } from "@/lib/admin-auth.functions";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info, LoaderCircle, Lock, Mail, ShieldCheck, Sun, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import logoSrc from "@/assets/ruwata-logo.webp";
const logo = { url: logoSrc };
import whiteLogoSrc from "@/assets/ruwata-logo-white.webp";
const whiteLogo = { url: whiteLogoSrc };
import fieldTeamSrc from "@/assets/ruwata-field-team.png";
const fieldTeam = { url: fieldTeamSrc };

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Sign In | RUWATA Solar" },
      { name: "description", content: "Sign in to the RUWATA admin area to manage quote requests and newsletter subscribers." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "RUWATA Admin Sign In" },
      { property: "og:description", content: "Secure sign in for the RUWATA team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const status = await context.queryClient.fetchQuery(adminStatusQuery).catch(() => null);
    if (status?.admin) throw redirect({ to: "/admin" });
  },
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setPending(true);
    setNotice(null);
    try {
      const res = await adminSignIn({
        data: { email: String(f.get("email") ?? ""), password: String(f.get("password") ?? ""), remember: f.get("remember") === "on" },
      });
      if (res.ok) {
        queryClient.removeQueries({ queryKey: ["admin"] });
        await navigate({ to: "/admin" });
        return;
      }
      setNotice(res.message);
    } catch {
      setNotice("Enter a valid email and password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="admin-shell">
      <BrandPanel />

      <section className="admin-panel" aria-labelledby="admin-login-title">
        <div className="admin-card">
          <img src={logo.url} alt="RUWATA" className="brand-logo mb-10 lg:hidden" />

          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold text-accent-foreground">
            <ShieldCheck className="size-3.5 text-brand" aria-hidden="true" />
            Team access only
          </div>

          <h1 id="admin-login-title" className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-[2.75rem] sm:leading-[1.05]">
            Welcome back
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            Sign in to manage quote requests, customers and updates.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 grid gap-5" noValidate>
            <div className="grid gap-2">
              <label htmlFor="admin-email" className="text-sm font-bold text-foreground">Email address</label>
              <div className="admin-field">
                <Mail aria-hidden="true" />
                <input id="admin-email" name="email" type="email" autoComplete="email" placeholder="you@ruwata.com" className="form-control" />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="admin-password" className="text-sm font-bold text-foreground">Password</label>
              <div className="admin-field">
                <Lock aria-hidden="true" />
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  className="form-control pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground select-none">
              <input type="checkbox" name="remember" className="size-4 rounded accent-[var(--color-brand)]" />
              Keep me signed in on this device
            </label>

            <Button type="submit" disabled={pending} className="admin-submit mt-1 h-13 rounded-xl text-base">
              {pending ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden="true" /> Signing in…
                </>
              ) : (
                <>
                  Sign in to dashboard <ArrowRight aria-hidden="true" />
                </>
              )}
            </Button>

            {notice && (
              <p role="status" className="rise-in flex items-start gap-2.5 rounded-lg border border-border bg-accent px-4 py-3 text-sm text-accent-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {notice}
              </p>
            )}
          </form>

          <div className="mt-10 flex items-center justify-between border-t border-border pt-6 text-sm">
            <Link to="/" className="inline-flex items-center gap-1.5 font-bold text-muted-foreground transition-colors hover:text-brand">
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to website
            </Link>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Lock className="size-3.5" aria-hidden="true" /> Encrypted connection
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

function BrandPanel() {
  return (
    <aside className="admin-visual" aria-hidden="true">
      <img src={fieldTeam.url} alt="" className="admin-visual-image" />
      <div className="admin-visual-shade" />
      <div className="admin-sun" />

      <img src={whiteLogo.url} alt="" className="brand-logo w-36" />

      <div className="grid gap-10">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-extrabold tracking-[0.18em] text-amber uppercase">
            <Sun className="size-4" /> RUWATA Control Room
          </p>
          <h2 className="admin-headline">
            Every quote is a home waiting to be <em>powered.</em>
          </h2>
        </div>

        <div className="grid max-w-xl grid-cols-[1.35fr_1fr] gap-4">
          <div className="admin-glass admin-float p-5">
            <div className="flex items-center justify-between text-xs font-bold text-footer-muted">
              <span>Quote requests</span>
              <span className="inline-flex items-center gap-2 text-whatsapp">
                <span className="admin-live-dot" /> Live
              </span>
            </div>
            <p className="mt-3 font-heading text-4xl font-semibold">+28%</p>
            <p className="text-xs text-footer-muted">vs. last month</p>
            <svg viewBox="0 0 200 56" className="mt-4 h-14 w-full" fill="none">
              <path
                className="admin-spark"
                d="M2 48 C 24 44, 32 30, 52 34 S 84 46, 100 30 S 132 12, 150 20 S 182 8, 198 4"
                stroke="var(--color-amber)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="grid gap-4">
            <div className="admin-glass p-4 [animation-delay:1.2s] admin-float">
              <Zap className="size-5 text-amber" />
              <p className="mt-2 font-heading text-2xl font-semibold">30 kVA</p>
              <p className="text-xs text-footer-muted">Largest system this week</p>
            </div>
            <div className="admin-glass p-4">
              <p className="font-heading text-2xl font-semibold">Lagos</p>
              <p className="text-xs text-footer-muted">Top request location</p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-footer-muted">© {new Date().getFullYear()} RUWATA Solar · Admin</p>
    </aside>
  );
}
