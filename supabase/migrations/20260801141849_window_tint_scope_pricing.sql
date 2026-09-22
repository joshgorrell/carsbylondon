/*
# Window Tint Scope-Based Pricing

## Summary
Restructures Window Tint pricing from a single flat base_price per vehicle class
to a per-glass pricing model. Customers now select which glass pieces they want
tinted (front windshield, rear glass, side windows) and each has its own price
stored in the pricing_rules table. Also adds a required tint-removal yes/no flow
with per-window removal pricing.

## Changes to `pricing_rules` table
1. Adds three new columns:
   - `front_windshield_price` (integer, default 0) — price to tint the front windshield for this vehicle class
   - `rear_glass_price` (integer, default 0) — price to tint the rear glass for this vehicle class
   - `side_window_price` (integer, default 0) — price per side window for this vehicle class
2. Sets `base_price` to 0 for all `window_tint` rules — pricing now comes from the per-glass columns.
   Other services (detailing) keep their existing base_price.

## Changes to `add_ons` table
1. Removes the old "No existing tint" required add-on and the old tint removal add-ons.
2. Adds two new required tint-removal add-ons (radio-style, customer picks one):
   - "No tint removal needed" — price 0, required, no per-unit label
   - "Tint removal needed" — price 0, required, no per-unit label
   (These act as the yes/no gate. When "yes" is selected, the per-window removal
   options below become visible.)
3. Adds two new optional tint-removal add-ons (per-window, visible when removal is needed):
   - "Remove old tint (front/rear)" — $50/window, per_unit_label = "window"
   - "Remove old tint (sides)" — $25/window, per_unit_label = "window"

## Important Notes
- The per-glass prices (front_windshield_price, rear_glass_price, side_window_price)
  are all initialized to 0. The business owner must enter the actual prices via
  the admin catalog Pricing Rules panel.
- Tint removal per-window prices ($50 front/rear, $25 sides) are set directly in
  the add_ons table and can be edited via the admin catalog Add-ons panel.
- Existing optional add-ons (Windshield Brow, Windshield Tint) are preserved as optional extras.
*/

-- Add per-glass pricing columns to pricing_rules
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS front_windshield_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rear_glass_price integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS side_window_price integer NOT NULL DEFAULT 0;

-- Set base_price to 0 for all window_tint rules (pricing now comes from per-glass columns)
UPDATE pricing_rules SET base_price = 0 WHERE service = 'window_tint';

-- Remove old tint-removal add-ons and the "No existing tint" required add-on
-- (service_id for window_tint = 76c47aa5-a4b9-4f49-ae58-5c9b91f867eb)
DELETE FROM add_ons
  WHERE service_id = '76c47aa5-a4b9-4f49-ae58-5c9b91f867eb'
  AND name IN (
    'No existing tint',
    'Tint Removal (Front, Rear windshield)',
    'Tint Removal (Sides)'
  );

-- Add required tint-removal yes/no add-ons (radio-style)
INSERT INTO add_ons (service_id, name, price, description, required, per_unit_label)
VALUES
  ('76c47aa5-a4b9-4f49-ae58-5c9b91f867eb', 'No tint removal needed', 0, 'Select this if your windows do not have existing tint that needs removing.', true, null),
  ('76c47aa5-a4b9-4f49-ae58-5c9b91f867eb', 'Tint removal needed', 0, 'Select this if old tint needs to be removed before applying new tint. Additional per-window charges apply.', true, null)
ON CONFLICT DO NOTHING;

-- Add optional per-window tint removal add-ons (visible when "Tint removal needed" is selected)
INSERT INTO add_ons (service_id, name, price, description, required, per_unit_label)
VALUES
  ('76c47aa5-a4b9-4f49-ae58-5c9b91f867eb', 'Remove old tint (front/rear)', 5000, 'Removal of old tint from front windshield or rear glass. $50 per window.', false, 'window'),
  ('76c47aa5-a4b9-4f49-ae58-5c9b91f867eb', 'Remove old tint (sides)', 2500, 'Removal of old tint from side windows. $25 per window.', false, 'window')
ON CONFLICT DO NOTHING;