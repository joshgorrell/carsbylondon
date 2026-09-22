DO $$
BEGIN
  DELETE FROM vault.secrets WHERE name = 'SQUARE_LOCATION_ID';
END
$$;

SELECT vault.create_secret(
  'LJQHX7GFSJ950',
  'SQUARE_LOCATION_ID',
  'Square production location ID (full) for the square edge function'
);