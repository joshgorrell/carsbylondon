-- Convert duration from minutes to hours (decimal)
ALTER TABLE pricing_rules
  ALTER COLUMN duration TYPE numeric(4,1) USING ROUND(duration / 60.0, 1);