/*
# London Tint & Detail — Initial Schema

1. Overview
   Builds the full database for a premium automotive booking platform.
   Single-tenant from the customer perspective (no customer sign-in):
   customers book as guests using the anon key. A single admin user (London)
   authenticates via Supabase email/password to manage the dashboard.

2. New Tables
   - services, packages, add_ons — service catalog
   - vehicle_mappings, pricing_rules — pricing engine
   - customers, vehicles, appointments, payments — booking + payments
   - gallery, reviews — public content
   - business_settings — singleton config (hours, bays, buffers)

3. Security
   - RLS on every table.
   - Public read on catalog/content tables so anon-key frontend can render.
   - Public insert on customers, vehicles, appointments, payments so guests can book.
   - Admin (authenticated) gets full CRUD on operational tables.
   - Appointments/payments SELECT is authenticated-only to protect customer privacy.

4. Notes
   - business_settings is a singleton (id=1).
   - Prices stored as cents (integer).
   - appointments.add_ons is a JSONB snapshot array.
*/

-- ---------- services ----------
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0
);
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_services" ON services;
CREATE POLICY "public_read_services" ON services FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_services" ON services;
CREATE POLICY "admin_insert_services" ON services FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_update_services" ON services;
CREATE POLICY "admin_update_services" ON services FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_services" ON services;
CREATE POLICY "admin_delete_services" ON services FOR DELETE
  TO authenticated USING (true);

-- ---------- packages ----------
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price int NOT NULL,
  estimated_duration int NOT NULL,
  warranty text
);
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_packages" ON packages;
CREATE POLICY "public_read_packages" ON packages FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_packages" ON packages;
CREATE POLICY "admin_insert_packages" ON packages FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_update_packages" ON packages;
CREATE POLICY "admin_update_packages" ON packages FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_packages" ON packages;
CREATE POLICY "admin_delete_packages" ON packages FOR DELETE
  TO authenticated USING (true);

-- ---------- add_ons ----------
CREATE TABLE IF NOT EXISTS add_ons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL,
  price int NOT NULL,
  description text
);
ALTER TABLE add_ons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_add_ons" ON add_ons;
CREATE POLICY "public_read_add_ons" ON add_ons FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_add_ons" ON add_ons;
CREATE POLICY "admin_insert_add_ons" ON add_ons FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_update_add_ons" ON add_ons;
CREATE POLICY "admin_update_add_ons" ON add_ons FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_add_ons" ON add_ons;
CREATE POLICY "admin_delete_add_ons" ON add_ons FOR DELETE
  TO authenticated USING (true);

-- ---------- vehicle_mappings ----------
CREATE TABLE IF NOT EXISTS vehicle_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make text NOT NULL,
  model text NOT NULL,
  trim text,
  pricing_class text NOT NULL,
  body_style text
);
ALTER TABLE vehicle_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_vehicle_mappings" ON vehicle_mappings;
CREATE POLICY "public_read_vehicle_mappings" ON vehicle_mappings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_vehicle_mappings" ON vehicle_mappings;
CREATE POLICY "admin_insert_vehicle_mappings" ON vehicle_mappings FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_update_vehicle_mappings" ON vehicle_mappings;
CREATE POLICY "admin_update_vehicle_mappings" ON vehicle_mappings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_vehicle_mappings" ON vehicle_mappings;
CREATE POLICY "admin_delete_vehicle_mappings" ON vehicle_mappings FOR DELETE
  TO authenticated USING (true);

-- ---------- pricing_rules ----------
CREATE TABLE IF NOT EXISTS pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  pricing_class text NOT NULL,
  base_price int NOT NULL,
  deposit int NOT NULL,
  duration int NOT NULL,
  UNIQUE (service, pricing_class)
);
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_pricing_rules" ON pricing_rules;
CREATE POLICY "public_read_pricing_rules" ON pricing_rules FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_pricing_rules" ON pricing_rules;
CREATE POLICY "admin_insert_pricing_rules" ON pricing_rules FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_update_pricing_rules" ON pricing_rules;
CREATE POLICY "admin_update_pricing_rules" ON pricing_rules FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_pricing_rules" ON pricing_rules;
CREATE POLICY "admin_delete_pricing_rules" ON pricing_rules FOR DELETE
  TO authenticated USING (true);

-- ---------- customers ----------
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_customers" ON customers;
CREATE POLICY "public_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_customers" ON customers;
CREATE POLICY "admin_read_customers" ON customers FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_update_customers" ON customers;
CREATE POLICY "admin_update_customers" ON customers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_customers" ON customers;
CREATE POLICY "admin_delete_customers" ON customers FOR DELETE
  TO authenticated USING (true);

-- ---------- vehicles ----------
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  year int NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  trim text,
  vehicle_class text NOT NULL,
  body_style text,
  vin text,
  notes text
);
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_vehicles" ON vehicles;
CREATE POLICY "public_insert_vehicles" ON vehicles FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_vehicles" ON vehicles;
CREATE POLICY "admin_read_vehicles" ON vehicles FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_update_vehicles" ON vehicles;
CREATE POLICY "admin_update_vehicles" ON vehicles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_vehicles" ON vehicles;
CREATE POLICY "admin_delete_vehicles" ON vehicles FOR DELETE
  TO authenticated USING (true);

-- ---------- appointments ----------
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  appointment_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  deposit_paid boolean NOT NULL DEFAULT false,
  balance_due int NOT NULL DEFAULT 0,
  total_price int NOT NULL DEFAULT 0,
  deposit_amount int NOT NULL DEFAULT 0,
  assigned_bay int,
  add_ons jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_appointments" ON appointments;
CREATE POLICY "public_insert_appointments" ON appointments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_appointments" ON appointments;
CREATE POLICY "admin_read_appointments" ON appointments FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_update_appointments" ON appointments;
CREATE POLICY "admin_update_appointments" ON appointments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_appointments" ON appointments;
CREATE POLICY "admin_delete_appointments" ON appointments FOR DELETE
  TO authenticated USING (true);

-- ---------- payments ----------
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  square_payment_id text,
  amount int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_payments" ON payments;
CREATE POLICY "public_insert_payments" ON payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_read_payments" ON payments;
CREATE POLICY "admin_read_payments" ON payments FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_update_payments" ON payments;
CREATE POLICY "admin_update_payments" ON payments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_payments" ON payments;
CREATE POLICY "admin_delete_payments" ON payments FOR DELETE
  TO authenticated USING (true);

-- ---------- gallery ----------
CREATE TABLE IF NOT EXISTS gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  featured boolean NOT NULL DEFAULT false,
  caption text
);
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_gallery" ON gallery;
CREATE POLICY "public_read_gallery" ON gallery FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_gallery" ON gallery;
CREATE POLICY "admin_insert_gallery" ON gallery FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_update_gallery" ON gallery;
CREATE POLICY "admin_update_gallery" ON gallery FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_gallery" ON gallery;
CREATE POLICY "admin_delete_gallery" ON gallery FOR DELETE
  TO authenticated USING (true);

-- ---------- reviews ----------
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  vehicle text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review text NOT NULL,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_reviews" ON reviews;
CREATE POLICY "public_read_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_insert_reviews" ON reviews;
CREATE POLICY "admin_insert_reviews" ON reviews FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_update_reviews" ON reviews;
CREATE POLICY "admin_update_reviews" ON reviews FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "admin_delete_reviews" ON reviews;
CREATE POLICY "admin_delete_reviews" ON reviews FOR DELETE
  TO authenticated USING (true);

-- ---------- business_settings (singleton) ----------
CREATE TABLE IF NOT EXISTS business_settings (
  id int PRIMARY KEY DEFAULT 1,
  business_name text NOT NULL DEFAULT 'London Tint & Detail',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  maps_url text,
  hours_monday text NOT NULL DEFAULT 'Closed',
  hours_tuesday text NOT NULL DEFAULT '9:00 AM - 6:00 PM',
  hours_wednesday text NOT NULL DEFAULT '9:00 AM - 6:00 PM',
  hours_thursday text NOT NULL DEFAULT '9:00 AM - 6:00 PM',
  hours_friday text NOT NULL DEFAULT '9:00 AM - 6:00 PM',
  hours_saturday text NOT NULL DEFAULT '9:00 AM - 4:00 PM',
  hours_sunday text NOT NULL DEFAULT 'Closed',
  buffer_minutes int NOT NULL DEFAULT 30,
  bays int NOT NULL DEFAULT 2,
  square_location_id text,
  deposit_percentage int NOT NULL DEFAULT 20
);
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_business_settings" ON business_settings;
CREATE POLICY "public_read_business_settings" ON business_settings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_update_business_settings" ON business_settings;
CREATE POLICY "admin_update_business_settings" ON business_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO business_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ---------- indexes ----------
CREATE INDEX IF NOT EXISTS idx_packages_service_id ON packages(service_id);
CREATE INDEX IF NOT EXISTS idx_add_ons_service_id ON add_ons(service_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_mappings_make_model ON vehicle_mappings(make, model);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_service_class ON pricing_rules(service, pricing_class);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
