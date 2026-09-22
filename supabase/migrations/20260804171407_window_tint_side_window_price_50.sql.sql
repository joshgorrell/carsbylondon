/*
# Window Tint — Update Side Window Default Price to $50

## Purpose
Increase the default per-window price for side windows from $25 to $50.

## Changes
1. `pricing_rules` table (modified rows):
   - For all rows where `service = 'window_tint'`:
     - `side_window_price` → 5000 cents ($50 per window)

## Security
- No RLS or policy changes — data-only update.
*/

UPDATE pricing_rules
SET side_window_price = 5000
WHERE service = 'window_tint';