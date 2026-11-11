import { useState, type FormEvent } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Facebook, Instagram, Linkedin, LoaderCircle, MapPin, Menu, Phone, ShoppingCart, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cartCount, useCart } from "@/lib/cart";
import { newsletterSchema, subscribeToNewsletter } from "@/lib/newsletter.functions";
import logoSrc from "@/assets/ruwata-logo.webp";
const logo = { url: logoSrc };
import whiteLogoSrc from "@/assets/ruwata-logo-white.webp";
const whiteLogo = { url: whiteLogoSrc };

const navItems = [
  { label: "Home", to: "/" },
  { label: "Our Impact", to: "/our-impact" },
  { label: "About Us", to: "/about-us" },
  { label: "Our Products", to: "/our-products" },
  { label: "News", to: "/news" },
  { label: "Contact Us", to: "/contact-us" },
] as const;

function CartButton() {
  const count = cartCount(useCart());
  return (
    <Link to="/checkout" aria-label={count ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart, empty"} className="cart-button">
      <ShoppingCart className="size-5" aria-hidden="true" />
      {count > 0 && <span className="cart-count">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}

export function SiteHeader() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-wrap grid min-h-18 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-6">
        <Link to="/" aria-label="RUWATA home" className="shrink-0">
          <img src={logo.url} alt="RUWATA" className="brand-logo" />
        </Link>
        <nav aria-label="Main navigation" className="desktop-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={pathname === item.to ? "page" : undefined}
              className="nav-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-2">
          <CartButton />
          <Button asChild className="hidden h-11 px-5 text-sm font-bold md:inline-flex">
            <Link to="/our-products">
              Buy Now <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <div className="mobile-menu">
            <Button
              variant="outline"
              size="icon"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </div>
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        data-open={menuOpen}
        className="site-wrap mobile-nav"
      >
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={pathname === item.to ? "page" : undefined}
            className="nav-link"
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
        <Button asChild className="mt-3 h-11 w-full font-bold">
          <Link to="/our-products" onClick={() => setMenuOpen(false)}>
            Buy Now <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </nav>
    </header>
  );
}

const socialLinks = [
  { label: "RUWATA on Facebook", href: "https://www.facebook.com/", Icon: Facebook },
  { label: "RUWATA on Instagram", href: "https://www.instagram.com/", Icon: Instagram },
  { label: "RUWATA on LinkedIn", href: "https://www.linkedin.com/", Icon: Linkedin },
] as const;

const footerColumns = [
  {
    title: "Company",
    links: [
      { label: "About Us", to: "/about-us" },
      { label: "News", to: "/news" },
      { label: "Contact Us", to: "/contact-us" },
    ],
  },
  {
    title: "Products",
    links: [
      { label: "Our Products", to: "/our-products" },
      { label: "Request a Solar Quote", to: "/contact-us" },
    ],
  },
  {
    title: "Impact",
    links: [
      { label: "Our Impact", to: "/our-impact" },
        ],
  },
] as const;

function NewsletterForm() {
  const submit = useServerFn(subscribeToNewsletter);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = newsletterSchema.safeParse({ email });
    if (!result.success) {
      setStatus({ ok: false, message: result.error.issues[0]?.message ?? "Enter a valid email address." });
      return;
    }
    setSending(true);
    try {
      const response = await submit({ data: result.data });
      setStatus(response);
      if (response.ok) setEmail("");
    } catch {
      setStatus({ ok: false, message: "We couldn't sign you up just now. Please try again." });
    } finally {
      setSending(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="w-full max-w-md justify-self-end max-lg:justify-self-start">
      <div className="newsletter-pill">
        <label htmlFor="newsletter-email" className="sr-only">Your email</label>
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="Your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={status ? !status.ok : undefined}
          aria-describedby={status ? "newsletter-status" : undefined}
          className="newsletter-input"
        />
        <button type="submit" disabled={sending} className="newsletter-send">
          {sending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : "Send"}
        </button>
      </div>
      {status ? (
        <p id="newsletter-status" role={status.ok ? "status" : "alert"} className="mt-2 pl-5 text-sm text-footer-muted">
          {status.message}
        </p>
      ) : null}
    </form>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer-band pt-16 pb-10">
      <div className="site-wrap">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="grid gap-2">
            <h2 className="font-heading text-2xl font-bold sm:text-3xl">Sign up for our newsletter</h2>
            <p className="text-sm text-footer-muted sm:text-base">Get the latest updates and solar insights delivered to your inbox.</p>
          </div>
          <NewsletterForm />
        </div>

        <div className="my-14 h-px bg-footer-line" />

        <div className="footer-grid">
          <div className="grid content-start gap-5 max-lg:col-span-full">
            <Link to="/" aria-label="RUWATA home" className="w-fit">
              <img src={whiteLogo.url} alt="RUWATA" className="footer-logo" />
            </Link>
            <div className="flex items-center gap-5 pl-1">
              {socialLinks.map(({ label, href, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="footer-link">
                  <Icon aria-hidden="true" className="size-5" />
                </a>
              ))}
            </div>
            <p className="flex items-center gap-2 text-sm text-primary-foreground/75"><MapPin aria-hidden="true" className="size-4 shrink-0" />17 Toyin Street, Ikeja, Lagos</p>
            <a href="tel:+2349029125979" className="footer-link flex items-center gap-2 text-sm text-primary-foreground/75"><Phone aria-hidden="true" className="size-4 shrink-0" />+234 902 912 5979</a>
          </div>
          {footerColumns.map((column) => (
            <div key={column.title} className="grid content-start gap-4">
              <h3 className="font-heading text-base font-bold">{column.title}</h3>
              {column.links.map((link) => (
                <Link key={link.label} to={link.to} className="footer-link">
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <p className="mt-14 lg:mt-24 text-center text-sm text-footer-muted">
          © Copyright {new Date().getFullYear()} RUWATA. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <a href="https://wa.me/2349029125979" target="_blank" rel="noopener noreferrer" aria-label="Chat with RUWATA on WhatsApp" className="whatsapp-float">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-8" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
      </a>
    </>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
}) {
  return (
    <section className="page-hero">
      <div className={`site-wrap ${image ? "split-section" : ""}`}>
        <div className="rise-in grid content-center justify-items-start gap-5">
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="text-lead">{description}</p>
          <Button asChild className="mt-2 h-12 px-6 font-bold">
            <Link to="/contact-us">
              Request a Solar Quote <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
        {image ? <img src={image} alt={imageAlt ?? "RUWATA solar team at work"} className="split-image" /> : null}
      </div>
    </section>
  );
}