/*
# Window Tint — Remove Base Price, Set Default Scope Prices

## Purpose
Window tinting has no meaningful "base price" since the total is entirely
driven by which windows the customer selects. This migration zeros out the
base_price for all window_tint pricing rules and sets consistent default
prices for the per-scope columns across all vehicle classes.

## Changes
1. `pricing_rules` table (modified rows):
   - For all rows where `service = 'window_tint'`:
     - `base_price` → 0 (no flat base charge)
     - `front_windshield_price` → 10000 cents ($100)
     - `rear_glass_price` → 10000 cents ($100)
     - `side_window_price` → 2500 cents ($25 per window)

## Security
- No RLS or policy changes — this is a data-only update.
- No schema changes — no columns added, removed, or renamed.

## Notes
- Existing values are overwritten with the defaults above.
- The admin can still adjust any per-class price afterward via the pricing rules panel.
*/

UPDATE pricing_rules
SET base_price = 0,
    front_windshield_price = 10000,
    rear_glass_price = 10000,
    side_window_price = 2500
WHERE service = 'window_tint';