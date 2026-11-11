-- RUWATA database schema for the external PostgreSQL database in DATABASE_URL.
-- Safe to re-run: every statement is idempotent.

CREATE TABLE IF NOT EXISTS quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  phone text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 7 AND 30),
  email text NOT NULL CHECK (char_length(btrim(email)) BETWEEN 3 AND 255),
  location text NOT NULL CHECK (char_length(btrim(location)) BETWEEN 2 AND 120),
  property_type text NOT NULL CHECK (property_type IN ('Home', 'Apartment', 'Office', 'Business', 'Other')),
  power_needs text NOT NULL CHECK (char_length(btrim(power_needs)) BETWEEN 3 AND 1000),
  system_size text CHECK (system_size IS NULL OR system_size IN ('2.5 kVA', '10 kVA', '20 kVA', '30 kVA', 'Not sure', 'Other')),
  budget text CHECK (budget IS NULL OR char_length(btrim(budget)) <= 120)
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL UNIQUE CHECK (char_length(btrim(email)) BETWEEN 3 AND 255)
);

CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  filename text,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  data bytea NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  slug text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 140),
  slug text NOT NULL UNIQUE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  short_description text,
  description text,
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  old_price numeric(14,2) CHECK (old_price IS NULL OR old_price >= 0),
  image_url text,
  gallery text[] NOT NULL DEFAULT '{}',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  badge text,
  in_stock boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions(admin_id);

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  order_number text NOT NULL UNIQUE DEFAULT ('RW-' || nextval('order_number_seq')),
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  notes text,
  payment_method text NOT NULL CHECK (payment_method IN ('pay_on_delivery', 'bank_transfer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'delivered', 'cancelled')),
  subtotal numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  image_url text,
  unit_price numeric(14,2) NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  line_total numeric(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id);
