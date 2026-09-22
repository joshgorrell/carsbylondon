-- The admin panel uses a sessionStorage flag (not Supabase auth), so the client
-- is always the anon role. Open catalog write policies to anon so admin mutations work.

-- services
DROP POLICY IF EXISTS "admin_insert_services" ON services;
DROP POLICY IF EXISTS "admin_update_services" ON services;
DROP POLICY IF EXISTS "admin_delete_services" ON services;

CREATE POLICY "admin_insert_services" ON services FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin_update_services" ON services FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_services" ON services FOR DELETE TO anon, authenticated USING (true);

-- add_ons
DROP POLICY IF EXISTS "admin_insert_add_ons" ON add_ons;
DROP POLICY IF EXISTS "admin_update_add_ons" ON add_ons;
DROP POLICY IF EXISTS "admin_delete_add_ons" ON add_ons;

CREATE POLICY "admin_insert_add_ons" ON add_ons FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin_update_add_ons" ON add_ons FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_add_ons" ON add_ons FOR DELETE TO anon, authenticated USING (true);

-- pricing_rules
DROP POLICY IF EXISTS "admin_insert_pricing_rules" ON pricing_rules;
DROP POLICY IF EXISTS "admin_update_pricing_rules" ON pricing_rules;
DROP POLICY IF EXISTS "admin_delete_pricing_rules" ON pricing_rules;

CREATE POLICY "admin_insert_pricing_rules" ON pricing_rules FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin_update_pricing_rules" ON pricing_rules FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_delete_pricing_rules" ON pricing_rules FOR DELETE TO anon, authenticated USING (true);
