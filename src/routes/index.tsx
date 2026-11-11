import { ArrowRight, ArrowUpRight, Building2, Factory, Headphones, House, Layers, PanelsTopLeft, PlugZap, ShieldCheck, Sun } from "lucide-react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/site-layout";
import { ProductShop } from "@/components/product-shop";
import { ApplianceStrip } from "@/components/appliance-strip";
import { shopQuery } from "@/lib/shop.queries";
import heroImageSrc from "@/assets/ruwata-home-hero-shop.webp";
const heroImage = { url: heroImageSrc };
import installImageSrc from "@/assets/ruwata-installation-team.webp";
const installImage = { url: installImageSrc };
import teamImageSrc from "@/assets/ruwata-field-team.png";
const teamImage = { url: teamImageSrc };
import appliancesImageSrc from "@/assets/home-appliances-card.jpg";
import pumpingImageSrc from "@/assets/pumping-solar-generator-card.jpg";
import technicianImageSrc from "@/assets/ruwata-solar-technician.png";
const technicianImage = { url: technicianImageSrc };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RUWATA | Solar Power Systems for Nigerian Homes & Businesses" },
      { name: "description", content: "RUWATA plans, supplies, and installs complete solar power systems in Nigeria, and sells air conditioners, freezers, TVs, generators, pumping machines and solar generators." },
      { name: "keywords", content: "solar power systems Nigeria, solar installation company, home solar Nigeria, business solar, inverter and battery, buy AC Nigeria, chest freezer, smart TV, petrol generator, RUWATA" },
      { property: "og:title", content: "RUWATA | Reliable Solar Power for Homes and Businesses" },
      { property: "og:description", content: "Solar systems that fit your needs, plus ACs, freezers, TVs, generators, pumping machines and solar generators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "RUWATA | Reliable Solar Power for Homes and Businesses" },
      { name: "twitter:description", content: "Solar systems, ACs, freezers, TVs, generators and pumping machines across Nigeria." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(shopQuery),
  component: HomePage,
});

const solutions = [
  { title: "Homes", description: "Power the everyday essentials that make a house feel like home.", icon: House },
  { title: "Apartments", description: "A considered solution for the space you have and the power you use.", icon: Building2 },
  { title: "Offices", description: "Keep your workplace productive when grid power is uncertain.", icon: PanelsTopLeft },
  { title: "Businesses", description: "Plan for the equipment, operating hours, and demands of your business.", icon: PlugZap },
];

const products = [
  { title: "Solar panels", detail: "Capture energy from daylight.", image: installImage.url, alt: "RUWATA technicians installing solar panels" },
  { title: "Inverters", detail: "Convert solar energy into usable power.", image: technicianImage.url, alt: "Solar inverter being inspected by a RUWATA technician" },
  { title: "Home appliances", detail: "ACs, freezers, TVs and generators.", image: appliancesImageSrc, alt: "Living room with air conditioner, smart TV, chest freezer and generator" },
  { title: "Pumping & solar generators", detail: "Water pumps and portable solar power.", image: pumpingImageSrc, alt: "Portable solar generator with foldable solar panel next to a blue water pumping machine" },
];

const trustPoints = [
  { icon: Factory, label: "Factory-direct equipment" },
  { icon: Layers, label: "Complete solar systems" },
  { icon: ShieldCheck, label: "Professional installation" },
  { icon: Headphones, label: "Guidance from start to finish" },
];

const steps = [
  ["01", "Understand your needs", "We learn what you want to power and where."],
  ["02", "Plan your system", "The recommendation is based on your requirements."],
  ["03", "Supply and install", "RUWATA supplies the equipment and completes installation."],
  ["04", "Handover", "Your solar system is handed over once work is complete."],
];

function HomePage() {
  return (
    <PageFrame>
      <section className="home-hero-bg">
        <img src={heroImage.url} alt="RUWATA team member showing a shop owner his solar inverter and battery" className="home-hero-bg-image" fetchPriority="high" />
        <div className="home-hero-bg-shade" aria-hidden="true" />
        <div className="site-wrap home-hero">
          <div className="grid content-center justify-items-start gap-6 rise-in home-hero-copy">
            <span className="font-heading text-sm font-bold uppercase tracking-wider text-amber">Solar Systems &amp; Home Appliances</span>
            <h1 className="home-hero-title">Power Your World with Reliable Solar Solutions</h1>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground">Enjoy greater control over your electricity supply with Ruwata — solar systems, air conditioners, freezers, TVs, generators, pumping machines and solar generators, all in one place.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-12 rounded-full px-7 font-bold">
                <Link to="/contact-us">Request a Solar Quote <ArrowRight aria-hidden="true" /></Link>
              </Button>
              <Button asChild variant="outline" className="home-hero-outline h-12 rounded-full px-7 font-bold">
                <Link to="/our-products">EXPLORE OUR PRODUCTS <ArrowUpRight aria-hidden="true" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card">
        <div className="site-wrap grid grid-cols-2 gap-px lg:grid-cols-4">
          {trustPoints.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 py-6 text-sm font-semibold">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><Icon aria-hidden="true" className="size-5" /></span>
              {label}
            </div>
          ))}
        </div>
      </section>

      <ProductShop limit={8} />

      <ApplianceStrip />

      <section className="section-space bg-card">
        <div className="site-wrap">
          <div className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end">
            <div className="grid gap-4">
              <span className="eyebrow eyebrow-plain">Power for every place</span>
              <h2 className="section-heading">Different spaces. A system that fits.</h2>
            </div>
            <p className="text-lead lg:justify-self-end lg:max-w-md">We provide complete solar power solutions for homes, apartments, offices, small businesses, and large commercial establishments.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {solutions.map(({ title, description, icon: Icon }) => (
              <article key={title} className="about-card group">
                <span className="grid size-12 place-items-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-primary-foreground"><Icon aria-hidden="true" className="size-6" strokeWidth={1.8} /></span>
                <h3 className="mt-8 font-heading text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space bg-card pt-0">
        <div className="site-wrap">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div className="grid max-w-2xl gap-4">
              <span className="eyebrow eyebrow-plain">The system, made complete</span>
              <h2 className="section-heading">Everything working together.</h2>
              <p className="text-lead">Solar panels, inverters and batteries — plus air conditioners, freezers, TVs, generators, pumping machines and solar generators — sourced direct from factories at fair prices.</p>
            </div>
            <Button asChild variant="outline" className="h-11 rounded-full px-6 font-bold">
              <Link to="/our-products">All products <ArrowRight aria-hidden="true" /></Link>
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <Link to="/our-products" key={product.title} className="home-product group">
                <img src={product.image} alt={product.alt} className="home-product-image" loading="lazy" />
                <div className="home-product-shade" aria-hidden="true" />
                <div className="relative mt-auto grid gap-1 p-6">
                  <h3 className="font-heading text-2xl font-semibold">{product.title}</h3>
                  <p className="text-sm text-primary-foreground/80">{product.detail}</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-amber">Find out more <ArrowUpRight aria-hidden="true" className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="about-purpose-band">
        <div className="site-wrap">
          <div className="mx-auto mb-14 grid max-w-2xl justify-items-center gap-4 text-center">
            <span className="eyebrow eyebrow-plain text-amber">From first conversation to handover</span>
            <h2 className="section-heading text-primary-foreground">A clear path to your solar system.</h2>
          </div>
          <ol className="home-steps">
            {steps.map(([number, title, description]) => (
              <li key={number} className="home-step">
                <span className="home-step-number">{number}</span>
                <h3 className="mt-6 font-heading text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-primary-foreground/70">{description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section-space bg-card">
        <div className="site-wrap">
          <div className="home-cta">
            <div className="grid content-center justify-items-start gap-5 p-8 sm:p-12 lg:p-16">
              <span className="eyebrow eyebrow-plain text-amber">Your power, better understood</span>
              <h2 className="section-heading text-primary-foreground">Let’s plan the right system for you.</h2>
              <p className="max-w-lg text-base leading-8 text-primary-foreground/75">Tell us about your space, the appliances you rely on, and the way you use power. We’ll help you explore your options.</p>
              <Button asChild className="mt-2 h-12 rounded-full px-7 font-bold">
                <Link to="/contact-us">Request a Solar Quote <ArrowRight aria-hidden="true" /></Link>
              </Button>
            </div>
            <img src={installImage.url} alt="RUWATA technicians working together on a solar panel installation" loading="lazy" className="h-full min-h-72 w-full object-cover" />
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
