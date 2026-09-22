/*
# By Appointment Only Hours + Flat Deposit Support

1. Overview
   Business hours are now "By Appointment Only" every day of the week.
   Adds support for a flat-amount deposit (e.g. a non-refundable $25.00 booking
   fee that is applied toward the customer's final bill) as an alternative to
   the existing percentage-based deposit. The admin chooses which mode is
   active from the Settings panel.

2. Modified Tables
   - business_settings
     - All seven hours_* columns now default to 'By Appointment Only'.
     - New column: deposit_type text NOT NULL DEFAULT 'percentage'
       (valid values: 'percentage' | 'flat'). Controls how the booking deposit
       is calculated.
     - New column: flat_deposit_amount int NOT NULL DEFAULT 2500
       (amount in cents used when deposit_type = 'flat'; 2500 = $25.00).
     - Existing deposit_percentage column is unchanged and still used when
       deposit_type = 'percentage'.

3. Data Updates
   - Updates the singleton row (id=1) so every hours_* field reads
     'By Appointment Only'. Existing rows are updated in place; no data is
     lost. Any future rows created by the DEFAULT clause also get the new
     appointment-only default.

4. Security
   - No new tables. RLS is already enabled on business_settings and the
     existing public-read / admin-update policies cover the new columns
     automatically (they are column-agnostic). No policy changes needed.

5. Notes
   - Prices are stored as integer cents, so flat_deposit_amount = 2500
     represents $25.00.
   - The flat deposit is non-refundable and is applied to the customer's
     final bill (balance_due = total_price - flat_deposit_amount).
   - The booking calendar treats 'By Appointment Only' as an open scheduling
     window (default 9:00 AM - 6:00 PM) so customers can still pick a time.
     Only 'Closed' disables a day entirely.
*/

-- Add deposit mode + flat amount columns if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'deposit_type'
  ) THEN
    ALTER TABLE business_settings
      ADD COLUMN deposit_type text NOT NULL DEFAULT 'percentage';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'business_settings' AND column_name = 'flat_deposit_amount'
  ) THEN
    ALTER TABLE business_settings
      ADD COLUMN flat_deposit_amount int NOT NULL DEFAULT 2500;
  END IF;
END $$;

-- Switch hours defaults to "By Appointment Only" for any future rows
ALTER TABLE business_settings
  ALTER COLUMN hours_monday    SET DEFAULT 'By Appointment Only',
  ALTER COLUMN hours_tuesday    SET DEFAULT 'By Appointment Only',
  ALTER COLUMN hours_wednesday  SET DEFAULT 'By Appointment Only',
  ALTER COLUMN hours_thursday   SET DEFAULT 'By Appointment Only',
  ALTER COLUMN hours_friday     SET DEFAULT 'By Appointment Only',
  ALTER COLUMN hours_saturday   SET DEFAULT 'By Appointment Only',
  ALTER COLUMN hours_sunday     SET DEFAULT 'By Appointment Only';

-- Update the existing singleton row so all hours read "By Appointment Only"
UPDATE business_settings
SET hours_monday    = 'By Appointment Only',
    hours_tuesday    = 'By Appointment Only',
    hours_wednesday  = 'By Appointment Only',
    hours_thursday   = 'By Appointment Only',
    hours_friday     = 'By Appointment Only',
    hours_saturday   = 'By Appointment Only',
    hours_sunday     = 'By Appointment Only'
WHERE id = 1;
