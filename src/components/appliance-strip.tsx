import { Link } from "@tanstack/react-router";
import { AirVent, ArrowUpRight, BatteryCharging, Droplets, Fuel, Refrigerator, Tv } from "lucide-react";

export const APPLIANCES = [
  { Icon: AirVent, title: "Air conditioners", text: "Split ACs that keep rooms cool and comfortable." },
  { Icon: Refrigerator, title: "Freezers", text: "Chest freezers for homes, shops and kitchens." },
  { Icon: Tv, title: "Televisions", text: "Smart LED TVs for the living room or office." },
  { Icon: Fuel, title: "Generators", text: "Petrol generators for dependable backup power." },
  { Icon: Droplets, title: "Pumping machines", text: "Water pumps for homes, farms and businesses." },
  { Icon: BatteryCharging, title: "Solar generators", text: "Portable solar power, ready wherever you are." },
];

/** Captions the non-solar range RUWATA sells: AC, freezers, TVs, generators, pumping machines and solar generators. */
export function ApplianceStrip({ eyebrow = "Also in our shop", title = "Air conditioners, freezers, TVs, generators and more." }: { eyebrow?: string; title?: string }) {
  return (
    <section className="appliance-band">
      <div className="site-wrap">
        <div className="mb-8 grid gap-3 lg:grid-cols-2 lg:items-end">
          <div className="grid gap-3">
            <span className="eyebrow eyebrow-plain">{eyebrow}</span>
            <h2 className="section-heading">{title}</h2>
          </div>
          <p className="text-lead lg:max-w-md lg:justify-self-end">
            Beyond solar, RUWATA sells the appliances and backup power your home or business runs on — ready to add to cart and buy online.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {APPLIANCES.map(({ Icon, title: name, text }) => (
            <Link key={name} to="/our-products" hash="shop" className="appliance-tile group">
              <span className="appliance-tile-icon"><Icon aria-hidden="true" className="size-6" strokeWidth={1.8} /></span>
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="font-heading text-base font-semibold sm:text-lg">{name}</span>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-brand transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
              <span className="text-xs leading-5 text-muted-foreground sm:text-sm">{text}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
