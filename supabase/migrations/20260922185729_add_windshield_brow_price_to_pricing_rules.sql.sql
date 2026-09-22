ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS windshield_brow_price integer NOT NULL DEFAULT 5000;

UPDATE pricing_rules SET windshield_brow_price = 5000 WHERE service = 'window_tint';