/*
# Add payment_tokens table for customer self-serve payment links

## Purpose
Allows London to generate a unique payment link for any appointment and send it to the customer.
The customer clicks the link, sees their balance, and pays with a card on the public /pay page.

## New Tables
- `payment_tokens`
  - `id` (uuid, primary key) — the token used in the URL
  - `appointment_id` (uuid, FK to appointments) — which booking this link pays toward
  - `amount` (integer, in cents) — the amount requested for payment
  - `used` (boolean, default false) — whether this token has been consumed
  - `created_at` (timestamptz) — when the link was generated
  - `used_at` (timestamptz, nullable) — when the payment was completed
  - `customer_name` (text) — for display on the payment page
  - `customer_email` (text) — for sending the link email
  - `vehicle` (text) — for display on the payment page
  - `services` (text) — for display on the payment page

## Security
- RLS enabled, anon + authenticated can read and insert (single-tenant no-auth app pattern).
- Update restricted to anon + authenticated (edge function uses service role key which bypasses RLS).
*/

CREATE TABLE IF NOT EXISTS payment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid REFERENCES appointments(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz,
  customer_name text DEFAULT '',
  customer_email text DEFAULT '',
  vehicle text DEFAULT '',
  services text DEFAULT ''
);

ALTER TABLE payment_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_payment_tokens" ON payment_tokens;
CREATE POLICY "anon_select_payment_tokens" ON payment_tokens
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_payment_tokens" ON payment_tokens;
CREATE POLICY "anon_insert_payment_tokens" ON payment_tokens
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_payment_tokens" ON payment_tokens;
CREATE POLICY "anon_update_payment_tokens" ON payment_tokens
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_payment_tokens" ON payment_tokens;
CREATE POLICY "anon_delete_payment_tokens" ON payment_tokens
  FOR DELETE TO anon, authenticated USING (true);
