/*
# Vehicle-Class Pricing Adjustments

1. Overview
   Corrects the seed pricing_rules so that vehicle classes actually differ in price,
   matching customer expectations. Previously coupe and sedan shared identical
   pricing for window tinting; this update makes coupe less expensive than sedan
   (fewer windows), and ensures a sensible ordering across all classes.

2. Modified Tables
   - `pricing_rules` — UPDATE base_price for selected (service, pricing_class) rows.
     No schema changes. No columns added or removed.

3. Pricing changes (amounts in cents)
   Window Tint:
     - coupe:      44900  (was 49900) — fewer windows than a sedan
     - sedan:      49900  (unchanged)
     - mid_suv:    59900  (unchanged)
     - large_suv:  69900  (unchanged)
     - truck:      54900  (was 59900) — standard cab has fewer windows than mid SUV
     - van:        69900  (unchanged)
     - motorcycle: 29900  (unchanged)
   Ceramic Coating:
     - coupe:      74900  (was 79900) — smaller surface area than sedan
     - truck:      94900  (was 99900) — align between sedan and mid_suv
   Paint Protection Film:
     - coupe:      139900 (was 149900) — smaller front area than sedan
     - truck:      189900 (was 199900) — align between sedan and mid_suv
   Detailing:
     - coupe:      29900  (was 34900) — smaller interior than sedan

4. Security
   No RLS or policy changes.

5. Notes
   - Only base_price is adjusted; deposit and duration remain as-is.
   - Idempotent: uses UPDATE with WHERE clauses keyed on (service, pricing_class).
   - The admin can further adjust any of these via the Pricing Rules manager.
*/

UPDATE pricing_rules SET base_price = 44900 WHERE service = 'window_tint' AND pricing_class = 'coupe';
UPDATE pricing_rules SET base_price = 54900 WHERE service = 'window_tint' AND pricing_class = 'truck';

UPDATE pricing_rules SET base_price = 74900 WHERE service = 'ceramic_coating' AND pricing_class = 'coupe';
UPDATE pricing_rules SET base_price = 94900 WHERE service = 'ceramic_coating' AND pricing_class = 'truck';

UPDATE pricing_rules SET base_price = 139900 WHERE service = 'paint_protection_film' AND pricing_class = 'coupe';
UPDATE pricing_rules SET base_price = 189900 WHERE service = 'paint_protection_film' AND pricing_class = 'truck';

UPDATE pricing_rules SET base_price = 29900 WHERE service = 'detailing' AND pricing_class = 'coupe';
