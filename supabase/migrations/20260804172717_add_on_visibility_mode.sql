/*
# Add visibility mode to add-ons

1. Changes to `add_ons` table
   - Add `visibility` column (text, NOT NULL, default 'service').
     Values:
       'service'     — shown only when the add-on's specific service is selected (current behavior)
       'qualifying'  — shown only after the customer answers a qualifying question "yes"
                       (e.g. tint removal add-ons that appear when the customer says they need old tint removed)
       'always'      — shown regardless of which services the customer selects (general optional extras)
   - Make `service_id` nullable so 'always' add-ons don't need a fake service assignment.
     For 'always' add-ons, service_id will be NULL.
     For 'service' and 'qualifying' add-ons, service_id remains required and points to the owning service.
   - Add a CHECK constraint to enforce valid visibility values.

2. Backfill existing add-ons
   - Any add-on whose `per_unit_label` = 'window' is reclassified as 'qualifying'
     (these are the tint-removal add-ons that should only appear after the customer answers the
     tint-removal qualifying question with "yes").
   - All other existing add-ons stay at the default 'service' visibility.

3. Security
   - No RLS policy changes. The existing policies on add_ons already allow anon read and
     authenticated CRUD, and those continue to apply regardless of the new column.

4. Important notes
   - The CHECK constraint is added via a DO block so it is idempotent.
   - service_id is altered to nullable with a DO block so re-running is safe.
   - The FK constraint is dropped and re-added via DO blocks for idempotency.
*/

-- Add visibility column with default
ALTER TABLE add_ons
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'service';

-- Backfill: tint-removal add-ons (per_unit_label = 'window') become 'qualifying'
UPDATE add_ons SET visibility = 'qualifying' WHERE per_unit_label = 'window' AND visibility = 'service';

-- Add CHECK constraint for valid visibility values (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'add_ons_visibility_check'
  ) THEN
    ALTER TABLE add_ons
      ADD CONSTRAINT add_ons_visibility_check
      CHECK (visibility IN ('service', 'qualifying', 'always'));
  END IF;
END $$;

-- Make service_id nullable so 'always' add-ons can have NULL service_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'add_ons'::regclass
      AND attname = 'service_id'
      AND attnotnull = true
  ) THEN
    ALTER TABLE add_ons ALTER COLUMN service_id DROP NOT NULL;
  END IF;
END $$;

-- Drop the existing NOT NULL FK and re-add a nullable one (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'add_ons' AND constraint_name = 'add_ons_service_id_fkey'
  ) THEN
    ALTER TABLE add_ons DROP CONSTRAINT add_ons_service_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'add_ons' AND constraint_name = 'add_ons_service_id_fkey'
  ) THEN
    ALTER TABLE add_ons
      ADD CONSTRAINT add_ons_service_id_fkey
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
  END IF;
END $$;