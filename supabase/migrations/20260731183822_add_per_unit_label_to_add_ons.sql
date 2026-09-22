ALTER TABLE add_ons ADD COLUMN IF NOT EXISTS per_unit_label text DEFAULT NULL;

UPDATE add_ons SET per_unit_label = 'window' WHERE name = 'Tint Removal';
