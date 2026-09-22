/*
# Vehicle Cache Table

1. Overview
   Adds a `vehicle_cache` table to cache NHTSA vPIC API responses so we don't
   re-fetch years/makes/models/trims on every booking. The API is free but slow,
   and caching guarantees fast lookups and a fallback if the API is down.

2. New Table
   - `vehicle_cache`
     - `key` (text, primary key) — e.g. "years", "makes_2024", "models_2024_tesla"
     - `value` (jsonb) — the cached array of strings
     - `updated_at` (timestamptz)

3. Security
   - RLS enabled.
   - Public read + insert + update (anon, authenticated) so the anon-key frontend
     can read and write cache entries during booking. This is intentionally shared
     cache data — no sensitive info is stored here.
*/

CREATE TABLE IF NOT EXISTS vehicle_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vehicle_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_vehicle_cache" ON vehicle_cache;
CREATE POLICY "public_read_vehicle_cache" ON vehicle_cache FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_vehicle_cache" ON vehicle_cache;
CREATE POLICY "public_insert_vehicle_cache" ON vehicle_cache FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_vehicle_cache" ON vehicle_cache;
CREATE POLICY "public_update_vehicle_cache" ON vehicle_cache FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
