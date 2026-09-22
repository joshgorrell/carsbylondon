/*
# Lock Down RLS — Remove Public Write Access on Admin Tables

## Summary
Several tables had RLS policies that allowed the `anon` role (any visitor with the
public API key) to INSERT, UPDATE, or DELETE rows that should only be modifiable
by an authenticated admin. This migration removes those overly-permissive
policies and replaces them with `authenticated`-only equivalents. Public (anon)
read access is preserved where the customer-facing site needs it.

## Tables Changed

### add_ons (service add-ons / pricing)
- SELECT: anon + authenticated (unchanged — site displays add-ons)
- INSERT, UPDATE, DELETE: **authenticated only** (was anon + authenticated)

### business_settings (shop config: hours, phone, deposit %, etc.)
- SELECT: anon + authenticated (unchanged — site displays hours/contact)
- UPDATE: **authenticated only** (was anon + authenticated)

### pricing_rules (service pricing by vehicle class)
- SELECT: anon + authenticated (unchanged — site shows starting prices)
- INSERT, UPDATE, DELETE: **authenticated only** (was anon + authenticated)

### services (service catalog)
- SELECT: anon + authenticated (unchanged — site lists services)
- INSERT, UPDATE, DELETE: **authenticated only** (was anon + authenticated)

### review_tokens (one-time review links)
- SELECT: anon + authenticated (unchanged — customer validates token via URL)
- UPDATE: **authenticated only** (was anon + authenticated — only admin should mark tokens used)
- INSERT: authenticated only (admin creates tokens)
- DELETE: authenticated only

### customers (PII: names, phone, email)
- SELECT: **authenticated only** (was anon + authenticated — customers must not read each other's PII)
- INSERT: anon + authenticated (unchanged — booking flow creates customer records)
- UPDATE, DELETE: authenticated only (unchanged)

### vehicles (PII: customer vehicle info)
- SELECT: **authenticated only** (was anon + authenticated — contains customer PII)
- INSERT: anon + authenticated (unchanged — booking flow creates vehicle records)
- UPDATE, DELETE: authenticated only (unchanged)

## Security Impact
After this migration, a visitor using only the public anon key can:
- READ public catalog data (services, add-ons, pricing, gallery, reviews, business settings, vehicle mappings, review tokens by ID)
- INSERT new bookings (appointments, customers, vehicles, payments, reviews)
They can NO LONGER:
- Modify or delete services, add-ons, pricing rules, or business settings
- Mark review tokens as used
- Read other customers' personal information or vehicle records

## Notes
1. All policies use DROP IF EXISTS before CREATE to remain idempotent.
2. RLS remains enabled on all tables throughout.
3. No data is lost — only policy permissions change.
*/

-- ── add_ons: restrict writes to authenticated ──
DROP POLICY IF EXISTS "admin_delete_add_ons" ON add_ons;
CREATE POLICY "admin_delete_add_ons" ON add_ons FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_add_ons" ON add_ons;
CREATE POLICY "admin_insert_add_ons" ON add_ons FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_add_ons" ON add_ons;
CREATE POLICY "admin_update_add_ons" ON add_ons FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── business_settings: restrict UPDATE to authenticated ──
DROP POLICY IF EXISTS "admin_update_business_settings" ON business_settings;
CREATE POLICY "admin_update_business_settings" ON business_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── pricing_rules: restrict writes to authenticated ──
DROP POLICY IF EXISTS "admin_delete_pricing_rules" ON pricing_rules;
CREATE POLICY "admin_delete_pricing_rules" ON pricing_rules FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_pricing_rules" ON pricing_rules;
CREATE POLICY "admin_insert_pricing_rules" ON pricing_rules FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_pricing_rules" ON pricing_rules;
CREATE POLICY "admin_update_pricing_rules" ON pricing_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── services: restrict writes to authenticated ──
DROP POLICY IF EXISTS "admin_delete_services" ON services;
CREATE POLICY "admin_delete_services" ON services FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_services" ON services;
CREATE POLICY "admin_insert_services" ON services FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_services" ON services;
CREATE POLICY "admin_update_services" ON services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── review_tokens: restrict UPDATE to authenticated ──
DROP POLICY IF EXISTS "admin_update_review_tokens" ON review_tokens;
CREATE POLICY "admin_update_review_tokens" ON review_tokens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── customers: restrict SELECT to authenticated (PII) ──
DROP POLICY IF EXISTS "public_read_customers" ON customers;
DROP POLICY IF EXISTS "anon_read_customers" ON customers;
CREATE POLICY "admin_read_customers_select" ON customers FOR SELECT TO authenticated USING (true);

-- ── vehicles: restrict SELECT to authenticated (PII) ──
DROP POLICY IF EXISTS "public_read_vehicles" ON vehicles;
DROP POLICY IF EXISTS "anon_read_vehicles" ON vehicles;
CREATE POLICY "admin_read_vehicles_select" ON vehicles FOR SELECT TO authenticated USING (true);
