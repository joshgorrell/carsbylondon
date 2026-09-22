/*
# Remove tint removal yes/no add-ons (handled in UI instead)

## Summary
The "No tint removal needed" and "Tint removal needed" add-ons were created as
radio-style required selections, but the tint removal yes/no choice is better
handled as UI state in the booking flow. This migration removes those two
add-ons, keeping only the per-window removal price add-ons.

## Changes
- Deletes "No tint removal needed" and "Tint removal needed" from add_ons.
- Keeps "Remove old tint (front/rear)" and "Remove old tint (sides)" which
  hold the per-window removal prices ($50 and $25).
*/

DELETE FROM add_ons
  WHERE service_id = '76c47aa5-a4b9-4f49-ae58-5c9b91f867eb'
  AND name IN ('No tint removal needed', 'Tint removal needed');