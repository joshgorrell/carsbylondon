/*
# Final Payment Collection System

1. New Columns
- `payments.payment_type` (text, default 'deposit') — distinguishes deposit vs balance vs discount payments
- `payments.payment_method` (text, default 'square') — how payment was collected: square, cash, card_on_file, discount
- `customers.square_customer_id` (text, nullable) — Square customer profile ID for card-on-file
- `appointments.square_card_id` (text, nullable) — saved card ID from deposit for future balance charges

2. Security
- No new tables. Existing RLS policies on payments, customers, and appointments already cover these columns
  (admin has full CRUD, anon has insert on payments/customers/appointments).
- No policy changes needed since the new columns are accessed through existing table-level policies.
*/

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'deposit',
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'square';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS square_customer_id text;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS square_card_id text;