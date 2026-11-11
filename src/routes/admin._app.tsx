import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate, type ErrorComponentProps } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FolderTree, LayoutDashboard, LogOut, Menu, Newspaper, Package, Settings, ShoppingBag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { adminSignOut } from "@/lib/admin-auth.functions";
import { adminStatusQuery } from "@/lib/admin.queries";
import whiteLogoSrc from "@/assets/ruwata-logo-white.webp";
import logoSrc from "@/assets/ruwata-logo.webp";

export const Route = createFileRoute("/admin/_app")({
  beforeLoad: async ({ context }) => {
    const status = await context.queryClient.fetchQuery(adminStatusQuery);
    if (!status.admin) throw redirect({ to: "/admin/login" });
    return { admin: status.admin };
  },
  component: AdminLayout,
  errorComponent: AdminError,
});

const NAV = [
  { to: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", Icon: Package, exact: false },
  { to: "/admin/categories", label: "Categories", Icon: FolderTree, exact: false },
  { to: "/admin/orders", label: "Orders", Icon: ShoppingBag, exact: false },
  { to: "/admin/news", label: "News", Icon: Newspaper, exact: false },
  { to: "/admin/settings", label: "Settings", Icon: Settings, exact: false },
] as const;

function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await queryClient.cancelQueries();
    await adminSignOut().catch(() => {});
    queryClient.clear();
    await navigate({ to: "/admin/login", replace: true });
  };
}

function AdminLayout() {
  const { admin } = Route.useRouteContext();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const signOut = useSignOut();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="admin-app">
      <aside className="admin-side" data-open={open} aria-label="Admin navigation">
        <div className="flex items-center justify-between px-2">
          <Link to="/admin" aria-label="RUWATA admin home">
            <img src={whiteLogoSrc} alt="RUWATA" className="brand-logo w-32" />
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <p className="px-3 text-[0.68rem] font-extrabold tracking-[0.18em] text-amber uppercase">Store admin</p>
        <nav className="grid gap-1">
          {NAV.map(({ to, label, Icon, exact }) => (
            <Link key={to} to={to} activeOptions={{ exact }} className="admin-side-link">
              <Icon aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="min-w-0">
        <header className="admin-topbar">
          <div className="flex items-center gap-3 lg:hidden">
            <Button variant="outline" size="icon" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
              <Menu aria-hidden="true" />
            </Button>
            <img src={logoSrc} alt="RUWATA" className="brand-logo w-28" />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button asChild variant="ghost" size="sm">
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" /> <span className="hidden sm:inline">View website</span>
              </a>
            </Button>
            <div className="hidden border-l border-border pl-4 text-right md:block">
              <p className="max-w-48 truncate text-sm font-bold">{admin.name}</p>
              <p className="max-w-48 truncate text-xs text-muted-foreground">{admin.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminError({ error, reset }: ErrorComponentProps) {
  const signedOut = error instanceof Error && error.message.includes("Unauthorized");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return (
    <div className="grid min-h-svh place-items-center bg-admin-canvas p-6">
      <div className="admin-box admin-box-pad grid max-w-md justify-items-center gap-3 text-center">
        <h1 className="font-heading text-xl font-semibold">{signedOut ? "Your session has ended" : "This page didn't load"}</h1>
        <p className="text-sm text-muted-foreground">
          {signedOut ? "Please sign in again to continue." : "Something went wrong. Please try again."}
        </p>
        <Button
          onClick={() => {
            if (signedOut) {
              queryClient.clear();
              void navigate({ to: "/admin/login" });
            } else reset();
          }}
        >
          {signedOut ? "Sign in" : "Try again"}
        </Button>
      </div>
    </div>
  );
}
