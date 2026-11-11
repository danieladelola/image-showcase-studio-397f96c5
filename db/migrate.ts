// Ordered, run-once database migrations for the RUWATA Postgres database.
// Each step is recorded in schema_migrations so re-running never repeats it.
import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const steps: Array<{ name: string; sql: string }> = [
  {
    name: "2026-11-products-v2",
    sql: `
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price numeric(14,2);
      ALTER TABLE products ADD COLUMN IF NOT EXISTS quote_only boolean NOT NULL DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'in_stock';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_alt text;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS specs jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS installation_fee numeric(14,2);
      ALTER TABLE products ALTER COLUMN price DROP NOT NULL;

      -- Carry existing data into the new shape.
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_published') THEN
          UPDATE products SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END;
          ALTER TABLE products DROP COLUMN is_published;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'old_price') THEN
          -- The old "price" was the selling price and "old_price" the struck-through price.
          UPDATE products SET sale_price = price, price = old_price WHERE old_price IS NOT NULL AND old_price > price;
          ALTER TABLE products DROP COLUMN old_price;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gallery') THEN
          UPDATE products p SET gallery_images = coalesce((
            SELECT jsonb_agg(jsonb_build_object('url', g.u, 'alt', p.name) ORDER BY g.ord)
            FROM unnest(p.gallery) WITH ORDINALITY AS g(u, ord)
            WHERE g.u IS DISTINCT FROM p.image_url
          ), '[]'::jsonb);
          ALTER TABLE products DROP COLUMN gallery;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'in_stock') THEN
          UPDATE products SET availability = CASE WHEN in_stock THEN 'in_stock' ELSE 'preorder' END;
          ALTER TABLE products DROP COLUMN in_stock;
        END IF;
      END $$;
      UPDATE products SET image_alt = name WHERE image_url IS NOT NULL AND image_alt IS NULL;
      UPDATE products SET quote_only = false WHERE quote_only;

      ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status IN ('draft', 'published', 'archived'));
      ALTER TABLE products ADD CONSTRAINT products_availability_check CHECK (availability IN ('in_stock', 'out_of_stock', 'preorder'));
      ALTER TABLE products ADD CONSTRAINT products_stock_check CHECK (stock_quantity >= 0);
      ALTER TABLE products ADD CONSTRAINT products_sale_price_check CHECK (sale_price IS NULL OR (sale_price >= 0 AND price IS NOT NULL AND sale_price < price));
      ALTER TABLE products ADD CONSTRAINT products_installation_fee_check CHECK (installation_fee IS NULL OR installation_fee >= 0);
      CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON products (lower(sku)) WHERE sku IS NOT NULL;
      CREATE INDEX IF NOT EXISTS products_status_idx ON products (status);
    `,
  },
  {
    name: "2026-11-orders-payments-v2",
    sql: `
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
      ALTER TABLE orders ALTER COLUMN payment_method SET DEFAULT 'paystack';
      ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('paystack', 'pay_on_delivery', 'bank_transfer'));
      ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'installed', 'cancelled'));
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
        CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refunded'));
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token_hash text UNIQUE;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'delivery'
        CONSTRAINT orders_delivery_method_check CHECK (delivery_method IN ('delivery', 'pickup'));
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee numeric(14,2) NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS installation_requested boolean NOT NULL DEFAULT false;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS installation_fee numeric(14,2) NOT NULL DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid numeric(14,2);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_deducted boolean NOT NULL DEFAULT false;
      CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at);
      CREATE INDEX IF NOT EXISTS orders_paid_idx ON orders (paid_at) WHERE payment_status = 'paid';

      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku text;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS regular_price numeric(14,2);
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS installation_fee numeric(14,2) NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items (product_id);

      CREATE TABLE IF NOT EXISTS payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        provider text NOT NULL DEFAULT 'paystack',
        reference text NOT NULL UNIQUE,
        amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
        currency text NOT NULL DEFAULT 'NGN',
        status text NOT NULL DEFAULT 'initialized' CHECK (status IN ('initialized', 'pending', 'success', 'failed', 'abandoned')),
        gateway_response text,
        channel text,
        provider_transaction_id text,
        verified_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);

      CREATE TABLE IF NOT EXISTS settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    name: "2026-11-news-posts",
    sql: `
      CREATE TABLE IF NOT EXISTS posts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz,
        title text NOT NULL,
        slug text NOT NULL UNIQUE,
        excerpt text NOT NULL DEFAULT '',
        content_html text NOT NULL DEFAULT '',
        category text NOT NULL DEFAULT 'guides' CHECK (category IN ('guides', 'company', 'projects')),
        tags text[] NOT NULL DEFAULT '{}',
        cover_image_url text,
        cover_image_alt text,
        author_name text,
        status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
        is_featured boolean NOT NULL DEFAULT false,
        reading_minutes integer NOT NULL DEFAULT 1,
        seo_title text,
        seo_description text,
        focus_keyword text,
        seo_keywords text[] NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS posts_public_idx ON posts (status, published_at DESC);
    `,
  },
  {
    // Starter articles so the News page isn't empty; fully editable/deletable in Admin → News.
    name: "2026-11-starter-news-posts",
    sql: `
      INSERT INTO posts (title, slug, excerpt, content_html, category, tags, cover_image_url, cover_image_alt, author_name,
                         status, is_featured, reading_minutes, published_at, seo_title, seo_description, focus_keyword, seo_keywords)
      VALUES
      ('How to Choose the Right Solar System Size for Your Home',
       'choose-right-solar-system-size',
       'Not sure whether you need a 2.5 kVA or a 10 kVA system? Here is a simple way to work out the right size for your home and budget.',
       '<p>Picking the right solar system starts with knowing how much power you actually use. A system that is too small leaves you in the dark at night; one that is too big costs more than you need to spend.</p>
<h2>1. List your appliances</h2>
<p>Write down everything you want to run — lights, fans, TV, fridge or freezer, air conditioner — and how many hours a day each one runs. Multiply the wattage by the hours to get daily energy use.</p>
<h2>2. Match the inverter</h2>
<p>Add up the wattage of everything that may run at the same time. Your inverter should handle that load with some room to spare. Most homes are well served by a 3.5–5 kVA hybrid inverter; offices and shops often need 10 kVA.</p>
<h2>3. Size your batteries</h2>
<p>Batteries carry you through the night. A 5 kWh lithium battery comfortably powers lights, fans and a TV overnight, while a 10 kWh battery adds room for a freezer or a small air conditioner.</p>
<h2>4. Add enough panels</h2>
<p>Your panels need to recharge the batteries and run the home during the day. As a rule of thumb, plan for about 1.5 times your daily energy use in panel capacity.</p>
<p>Not sure where to start? Our team will visit, assess your load and recommend the right package — free of charge.</p>',
       'guides', ARRAY['solar sizing','inverter','batteries'],
       '/api/public/images/00000000-0000-4000-a000-000000000001', 'Home solar power system with inverter and batteries', 'RUWATA Team',
       'published', true, 3, now() - interval '2 days',
       'How to Choose the Right Solar System Size | RUWATA',
       'A simple guide to sizing your solar panels, inverter and batteries for your home and budget.',
       'solar system size', ARRAY['solar system size','inverter size','solar batteries']),

      ('Now Available: Air Conditioners, Freezers, TVs and Generators',
       'now-selling-ac-freezers-tvs-generators',
       'RUWATA now sells home appliances alongside solar — air conditioners, deep freezers, smart TVs and generators, all with delivery.',
       '<p>We are excited to announce that RUWATA now offers more than solar. You can now shop air conditioners, chest deep freezers, smart LED TVs and petrol generators right on our website.</p>
<h2>Why we added appliances</h2>
<p>Many of our customers asked for one trusted place to buy both their power system and the appliances it runs. Now you can get everything together, with one delivery and one point of support.</p>
<h2>Works great with solar</h2>
<p>Our energy-efficient air conditioners and freezers pair well with a RUWATA solar system, so you can enjoy cooling and cold storage without worrying about fuel or grid outages.</p>
<p>Visit the shop to see current prices — every item can be added to your cart or bought instantly.</p>',
       'company', ARRAY['air conditioner','freezer','tv','generator'],
       '/api/public/images/7c91dce2-ced9-4b7f-a02c-c701a9af9d11', 'Split air conditioner', 'RUWATA Team',
       'published', false, 2, now() - interval '5 days',
       'Air Conditioners, Freezers, TVs & Generators Now at RUWATA',
       'Shop air conditioners, deep freezers, smart TVs and generators alongside solar systems at RUWATA.',
       'home appliances', ARRAY['air conditioner','deep freezer','smart tv','generator']),

      ('Lithium vs Lead-Acid Batteries: Which Is Better for Solar?',
       'lithium-vs-lead-acid-solar-batteries',
       'Lithium batteries cost more up front but last far longer. We compare lifespan, maintenance and real cost over time.',
       '<p>Your battery is one of the most important parts of a solar system. The two main choices are lithium and lead-acid — and the difference matters.</p>
<h2>Lifespan</h2>
<p>A good lithium battery lasts 6,000 cycles or more — often over 10 years. Lead-acid batteries typically last 2–4 years before they need replacing.</p>
<h2>Usable power</h2>
<p>You can safely use about 90% of a lithium battery''s capacity, compared with around 50% for lead-acid. That means a smaller lithium battery can do the same job.</p>
<h2>Maintenance</h2>
<p>Lithium batteries need no topping up and no ventilation room. Lead-acid batteries need regular checks and can leak.</p>
<h2>The verdict</h2>
<p>Lithium costs more on day one but is usually cheaper over the life of your system. That is why every RUWATA package now ships with lithium storage.</p>',
       'guides', ARRAY['batteries','lithium','solar storage'],
       '/api/public/images/00000000-0000-4000-a000-000000000004', 'Lithium solar battery', 'RUWATA Team',
       'published', false, 3, now() - interval '9 days',
       'Lithium vs Lead-Acid Solar Batteries | RUWATA',
       'Compare lithium and lead-acid solar batteries on lifespan, usable power, maintenance and long-term cost.',
       'lithium battery', ARRAY['lithium battery','lead acid battery','solar battery'])
      ON CONFLICT (slug) DO NOTHING;
    `,
  },
];

export async function migrate(sql: Sql) {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  for (const step of steps) {
    await sql.begin(async (tx) => {
      // Lock so two containers starting together can't run the same step twice.
      await tx`SELECT pg_advisory_xact_lock(727101)`;
      const done = await tx`SELECT 1 FROM schema_migrations WHERE name = ${step.name}`;
      if (done.length) return;
      await tx.unsafe(step.sql);
      await tx`INSERT INTO schema_migrations (name) VALUES (${step.name})`;
      console.log("Applied migration", step.name);
    });
  }
}

/** Runs `fn` once ever, recorded under `name` (used for the one-time catalogue import). */
export async function once(sql: Sql, name: string, fn: (tx: Sql) => Promise<void>) {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(727102)`;
    const done = await tx`SELECT 1 FROM schema_migrations WHERE name = ${name}`;
    if (done.length) return;
    await fn(tx as unknown as Sql);
    await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
    console.log("Applied", name);
  });
}
