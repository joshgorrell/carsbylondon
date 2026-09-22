/*
# Remove Motorcycle Pricing Class

1. Overview
   Motorcycles are no longer serviced. Removes all motorcycle pricing rules
   and vehicle mappings from the database so the admin pricing manager no
   longer shows motorcycle rows and customers cannot be mapped to it.

2. Data Changes
   - pricing_rules: DELETE all rows where pricing_class = 'motorcycle'.
     This removes the 4 motorcycle pricing rules (window_tint, ceramic_coating,
     paint_protection_film, detailing) seeded in migration 002.
   - vehicle_mappings: DELETE all rows where pricing_class = 'motorcycle'.
     No motorcycle vehicle mappings were seeded, but this is safe and idempotent.

3. Security
   No schema, RLS, or policy changes. Only data rows are removed.

4. Notes
   - No columns or tables are dropped — only data rows.
   - The frontend has already been updated to remove 'motorcycle' from the
     VehicleClass and PricingClass types, the booking vehicle selector, the
     NHTSA class mapping, and the admin Pricing Rules class list.
   - Idempotent: re-running deletes zero rows if motorcycle data is already gone.
*/

DELETE FROM pricing_rules WHERE pricing_class = 'motorcycle';
DELETE FROM vehicle_mappings WHERE pricing_class = 'motorcycle';
