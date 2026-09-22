ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS port_window_price integer NOT NULL DEFAULT 2500;

UPDATE business_settings SET port_window_price = 2500 WHERE id = 1;