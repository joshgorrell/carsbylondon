/*
# Add required flag to add_ons

1. Changes
   - Adds a `required` boolean column (default false) to `add_ons`.
     When true, the customer must select at least one add-on in this
     group before they can continue booking.
   - Marks "Interior Detail" and "Exterior detail" under Detailing as required=true.
   - Marks "Tint Removal" under Window Tint as required=true.
   - Inserts a new "No existing tint" add-on (price $0, required=true) under
     Window Tint so customers can explicitly confirm they have no old film
     to remove — giving you a complete yes/no answer for every booking.

2. No RLS changes needed — existing policies cover the new column.
*/

ALTER TABLE add_ons
  ADD COLUMN IF NOT EXISTS required boolean NOT NULL DEFAULT false;

-- Mark Detailing add-ons as required
UPDATE add_ons
SET required = true
WHERE name IN ('Interior Detail', 'Exterior detail')
  AND service_id = (SELECT id FROM services WHERE slug = 'detailing');

-- Mark Tint Removal as required
UPDATE add_ons
SET required = true
WHERE name = 'Tint Removal'
  AND service_id = (SELECT id FROM services WHERE slug = 'window_tint');

-- Add "No existing tint" at $0 required for Window Tint
INSERT INTO add_ons (service_id, name, price, description, required)
SELECT
  id,
  'No existing tint',
  0,
  'No old film — ready for fresh installation.',
  true
FROM services
WHERE slug = 'window_tint'
ON CONFLICT DO NOTHING;
