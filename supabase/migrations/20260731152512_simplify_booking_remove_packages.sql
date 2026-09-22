/*
# Simplify Booking — Remove Packages, Multi-Service Support

1. Overview
   Removes the "packages" concept entirely. Appointments now store selected
   services as a JSONB snapshot array. Customer onboarding is simplified:
   only first name and phone are required (email and last name become optional).
   Motorcycle pricing rules are removed.

2. Changes to appointments
   - Add `services` jsonb NOT NULL DEFAULT '[]' — snapshot of selected services
     (e.g. [{id, slug, name, base_price}]).
   - Make `package_id` nullable and drop the foreign key constraint to packages,
     then drop the packages table.

3. Changes to customers
   - Make `last_name` nullable (only first_name + phone required).
   - Make `email` nullable.

4. Data cleanup
   - Delete pricing_rules rows for any motorcycle-related pricing class.
   - Drop the packages table and its indexes.

5. Security
   - No RLS policy changes. Existing public insert on appointments and
     customers continues to allow anon-key booking.
*/

-- appointments: add services snapshot column
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '[]'::jsonb;

-- appointments: drop package_id FK + column
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_package_id_fkey;
ALTER TABLE appointments
  ALTER COLUMN package_id DROP NOT NULL;

-- customers: make last_name and email optional
ALTER TABLE customers ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;

-- remove motorcycle pricing rules if any exist
DELETE FROM pricing_rules WHERE pricing_class ILIKE '%motorcycle%';

-- drop packages table (and its indexes)
DROP INDEX IF EXISTS idx_packages_service_id;
DROP TABLE IF EXISTS packages;
