// Creates/upgrades the RUWATA database and imports the original catalogue once.
// Run from the project root: bun db/seed.ts   (safe to re-run: migrations and the
// catalogue import are recorded in schema_migrations and never repeat, so admin
// edits and deletions are never overwritten).
import { readFileSync } from "node:fs";
import postgres from "postgres";

import { migrate, once } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { ssl: process.env.DATABASE_SSL === "true" ? "require" : false, max: 1, onnotice: () => {} });

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
await sql.unsafe(schema);
await migrate(sql);

const images = [
  { id: "00000000-0000-4000-a000-000000000001", file: "shop-solar-kit.jpg" },
  { id: "00000000-0000-4000-a000-000000000002", file: "shop-solar-panel.jpg" },
  { id: "00000000-0000-4000-a000-000000000003", file: "shop-hybrid-inverter.jpg" },
  { id: "00000000-0000-4000-a000-000000000004", file: "shop-lithium-battery.jpg" },
  { id: "00000000-0000-4000-a000-000000000005", file: "products-hero-system.jpg" },
  { id: "00000000-0000-4000-a000-000000000006", file: "products-inverter.jpg" },
  { id: "00000000-0000-4000-a000-000000000007", file: "products-battery.jpg" },
];
for (const img of images) {
  const data = readFileSync(new URL(`../src/assets/${img.file}`, import.meta.url));
  await sql`
    INSERT INTO images (id, filename, content_type, size_bytes, data)
    VALUES (${img.id}, ${img.file}, 'image/jpeg', ${data.length}, ${data})
    ON CONFLICT (id) DO NOTHING`;
}
const img = (n: number) => `/api/public/images/${images[n - 1]!.id}`;

const categories = [
  { slug: "complete-systems", name: "Complete systems", description: "Panels, inverter and battery sized and supplied together.", sort: 1 },
  { slug: "solar-panels", name: "Solar panels", description: "High-efficiency panels for homes and businesses.", sort: 2 },
  { slug: "inverters", name: "Inverters", description: "Hybrid inverters that manage solar, battery and grid power.", sort: 3 },
  { slug: "batteries", name: "Batteries", description: "Long-life lithium storage for day and night power.", sort: 4 },
];
type Feature = { icon: string; label: string; value: string };
const products: Array<{
  slug: string; name: string; category: string; price: number; oldPrice?: number; badge?: string; inStock: boolean;
  short: string; description: string; image: string; gallery: string[]; features: Feature[];
}> = [
  {
    slug: "2-5-kva-home-starter-system", name: "2.5 kVA Home Starter System", category: "complete-systems", price: 1950000, oldPrice: 2150000, badge: "Best seller", inStock: true,
    short: "A complete solar setup for lights, fans, TV and a fridge in a typical home.",
    description: "Everything a typical home needs to move off generator power: four high-efficiency panels, a 2.5 kVA hybrid inverter and a 5 kWh lithium battery. Installed by the RUWATA team and sized around what you need to power.",
    image: img(1), gallery: [img(1), img(2), img(3), img(4)],
    features: [
      { icon: "panel", label: "Solar panels", value: "4 × 450W mono panels" },
      { icon: "inverter", label: "Inverter capacity", value: "2.5 kVA hybrid inverter" },
      { icon: "battery", label: "Battery", value: "5 kWh lithium (LiFePO4)" },
      { icon: "charging", label: "Dual charging", value: "Charges from solar and grid" },
      { icon: "warranty", label: "Warranty", value: "5-year system warranty" },
    ],
  },
  {
    slug: "10-kva-business-power-system", name: "10 kVA Business Power System", category: "complete-systems", price: 6800000, inStock: true,
    short: "Reliable power for offices, shops and larger homes with heavy loads.",
    description: "A full 10 kVA system for businesses and large homes: sixteen 550W panels, a 10 kVA hybrid inverter and 15 kWh of lithium storage, with remote monitoring so you can see your power at any time.",
    image: img(1), gallery: [img(1), img(5), img(3), img(4)],
    features: [
      { icon: "panel", label: "Solar panels", value: "16 × 550W panels" },
      { icon: "inverter", label: "Inverter capacity", value: "10 kVA hybrid inverter" },
      { icon: "battery", label: "Battery", value: "15 kWh lithium storage" },
      { icon: "wifi", label: "Monitoring", value: "Wi-Fi app monitoring" },
      { icon: "warranty", label: "Warranty", value: "5-year system warranty" },
    ],
  },
  {
    slug: "mono-solar-panel-450w", name: "Mono Solar Panel 450W", category: "solar-panels", price: 185000, inStock: true,
    short: "Monocrystalline panel with strong output in Nigerian sunshine.",
    description: "A 450W monocrystalline panel with 21% efficiency, built for rooftop and ground installations.",
    image: img(2), gallery: [img(2), img(1)],
    features: [
      { icon: "panel", label: "Output", value: "450W monocrystalline" },
      { icon: "gauge", label: "Efficiency", value: "21% cell efficiency" },
      { icon: "warranty", label: "Warranty", value: "25-year output warranty" },
    ],
  },
  {
    slug: "bifacial-solar-panel-550w", name: "Bifacial Solar Panel 550W", category: "solar-panels", price: 245000, oldPrice: 265000, badge: "New", inStock: true,
    short: "Double-sided panel that also generates from reflected light.",
    description: "A 550W bifacial panel with tempered glass on both sides — ideal for open roofs and ground mounts.",
    image: img(2), gallery: [img(2), img(1)],
    features: [
      { icon: "panel", label: "Output", value: "550W bifacial" },
      { icon: "shield", label: "Build", value: "Tempered glass front and back" },
      { icon: "warranty", label: "Warranty", value: "25-year output warranty" },
    ],
  },
  {
    slug: "hybrid-inverter-5-kva", name: "Hybrid Inverter 5 kVA", category: "inverters", price: 650000, inStock: true,
    short: "Pure sine wave inverter with a built-in solar charger.",
    description: "A 5 kVA hybrid inverter that manages solar, battery and grid power automatically, with Wi-Fi monitoring.",
    image: img(3), gallery: [img(3), img(6)],
    features: [
      { icon: "inverter", label: "Capacity", value: "5 kVA pure sine wave" },
      { icon: "charging", label: "Dual charging", value: "Built-in MPPT and grid charger" },
      { icon: "wifi", label: "Monitoring", value: "Wi-Fi monitoring" },
      { icon: "warranty", label: "Warranty", value: "2-year warranty" },
    ],
  },
  {
    slug: "hybrid-inverter-10-kva", name: "Hybrid Inverter 10 kVA", category: "inverters", price: 1250000, inStock: false,
    short: "High-capacity inverter for three-phase and generator-backed sites.",
    description: "A 10 kVA hybrid inverter with dual MPPT inputs and generator support for demanding homes and businesses.",
    image: img(3), gallery: [img(3), img(6)],
    features: [
      { icon: "inverter", label: "Capacity", value: "10 kVA, three-phase ready" },
      { icon: "charging", label: "Solar input", value: "Dual MPPT inputs" },
      { icon: "gauge", label: "Backup", value: "Generator support" },
      { icon: "warranty", label: "Warranty", value: "2-year warranty" },
    ],
  },
  {
    slug: "lithium-battery-5-kwh", name: "Lithium Battery 5 kWh", category: "batteries", price: 1100000, badge: "Popular", inStock: true,
    short: "Stackable LiFePO4 battery for thousands of charge cycles.",
    description: "A 5 kWh lithium iron phosphate battery that stacks as your needs grow, rated for more than 6,000 cycles.",
    image: img(4), gallery: [img(4), img(7)],
    features: [
      { icon: "battery", label: "Capacity", value: "5 kWh LiFePO4" },
      { icon: "gauge", label: "Lifespan", value: "6,000+ cycles" },
      { icon: "warranty", label: "Warranty", value: "5-year warranty" },
    ],
  },
  {
    slug: "lithium-battery-10-kwh", name: "Lithium Battery 10 kWh", category: "batteries", price: 2050000, inStock: true,
    short: "Large-capacity storage with built-in battery management.",
    description: "A 10 kWh lithium battery with built-in battery management for long, steady backup power.",
    image: img(4), gallery: [img(4), img(7)],
    features: [
      { icon: "battery", label: "Capacity", value: "10 kWh LiFePO4" },
      { icon: "shield", label: "Protection", value: "Built-in battery management" },
      { icon: "warranty", label: "Warranty", value: "10-year warranty" },
    ],
  },
];

await once(sql, "seed-catalog-v1", async (tx) => {
  for (const c of categories) {
    await tx`
      INSERT INTO categories (name, slug, description, sort_order)
      VALUES (${c.name}, ${c.slug}, ${c.description}, ${c.sort})
      ON CONFLICT (slug) DO NOTHING`;
  }
  let order = 1;
  for (const p of products) {
    const regular = p.oldPrice && p.oldPrice > p.price ? p.oldPrice : p.price;
    const sale = p.oldPrice && p.oldPrice > p.price ? p.price : null;
    const gallery = p.gallery.filter((u) => u !== p.image).map((url) => ({ url, alt: p.name }));
    await tx`
      INSERT INTO products (name, slug, category_id, short_description, description, price, sale_price, image_url, image_alt,
        gallery_images, features, badge, availability, status, sort_order)
      VALUES (
        ${p.name}, ${p.slug}, (SELECT id FROM categories WHERE slug = ${p.category}),
        ${p.short}, ${p.description}, ${regular}, ${sale}, ${p.image}, ${p.name}, ${tx.json(gallery)},
        ${tx.json(p.features)}, ${p.badge ?? null}, ${p.inStock ? "in_stock" : "preorder"}, 'published', ${order++}
      )
      ON CONFLICT (slug) DO NOTHING`;
  }
});

const [counts] = await sql`SELECT (SELECT count(*) FROM categories)::int AS categories, (SELECT count(*) FROM products)::int AS products, (SELECT count(*) FROM images)::int AS images`;
console.log("Seeded:", counts);
await sql.end();
