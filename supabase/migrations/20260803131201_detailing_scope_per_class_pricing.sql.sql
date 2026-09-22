/*
# Detailing Scope — Per-Vehicle-Class Interior & Exterior Pricing

1. Overview
   Converts the Detailing service from a single flat base_price to a scope-based
   model where customers pick Interior, Exterior, or both — each priced per
   vehicle class, exactly like the existing window-tint scope pattern.

2. Changes to pricing_rules
   - Adds `interior_price` (int, default 0) — price for Interior Detail scope.
   - Adds `exterior_price` (int, default 0) — price for Exterior Detail scope.
   - Sets `base_price = 0` for all existing detailing rows so customers are
     charged only for the scope(s) they select, not a base fee on top.
   - Seeds interior_price and exterior_price for all six detailing pricing
     classes (sedan, coupe, mid_suv, large_suv, truck, van).

3. Add-ons cleanup
   - Deletes the "Interior Detail" and "Exterior detail" add-on rows for the
     detailing service. These were $0 placeholder scope selectors; they are
     now replaced by the pricing-rules-based scope selection in the booking
     page (mirroring how window tint scope works). The other two detailing
     add-ons (Carpet shampooing, Wax) remain as optional extras.

4. Security
   - No policy changes. The new columns inherit the existing public-read /
     admin-write RLS policies already on pricing_rules.

5. Notes
   - Prices are in cents (e.g. 19900 = $199.00).
   - Idempotent: uses IF NOT EXISTS for column adds and DO blocks for data updates.
*/

-- Add interior_price and exterior_price columns
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS interior_price int NOT NULL DEFAULT 0;
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS exterior_price int NOT NULL DEFAULT 0;

-- Set base_price = 0 for all detailing rows (price now comes from scope columns)
UPDATE pricing_rules SET base_price = 0 WHERE service = 'detailing';

-- Seed interior/exterior prices per pricing class for detailing
DO $$ BEGIN
  UPDATE pricing_rules SET interior_price = 19900, exterior_price = 19900
    WHERE service = 'detailing' AND pricing_class = 'sedan';
  UPDATE pricing_rules SET interior_price = 19900, exterior_price = 19900
    WHERE service = 'detailing' AND pricing_class = 'coupe';
  UPDATE pricing_rules SET interior_price = 24900, exterior_price = 24900
    WHERE service = 'detailing' AND pricing_class = 'mid_suv';
  UPDATE pricing_rules SET interior_price = 29900, exterior_price = 29900
    WHERE service = 'detailing' AND pricing_class = 'large_suv';
  UPDATE pricing_rules SET interior_price = 24900, exterior_price = 24900
    WHERE service = 'detailing' AND pricing_class = 'truck';
  UPDATE pricing_rules SET interior_price = 29900, exterior_price = 29900
    WHERE service = 'detailing' AND pricing_class = 'van';
END $$;

-- Remove the Interior/Exterior scope add-ons (replaced by pricing-rules-based scope)
DELETE FROM add_ons
  WHERE service_id = (SELECT id FROM services WHERE slug = 'detailing')
  AND name IN ('Interior Detail', 'Exterior detail');
