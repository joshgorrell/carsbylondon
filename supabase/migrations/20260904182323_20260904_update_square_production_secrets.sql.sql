/*
# Update Square edge function secrets to production credentials

Swaps the sandbox Square access token and location ID for production ones.
Uses vault.create_secret with the overwrite argument to replace existing secrets.
*/

DO $$
BEGIN
  -- Delete existing secrets then recreate with production values
  DELETE FROM vault.secrets WHERE name IN ('SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID');
END
$$;

SELECT vault.create_secret(
  'EAAAl0yqKkGuerZY5YBpPwMW0MNX8_FZMe9GCWGi3-FRSslR5bcZBXORe5QE0fL0',
  'SQUARE_ACCESS_TOKEN',
  'Square production API access token for the square edge function'
);

SELECT vault.create_secret(
  'LJQHX7GF',
  'SQUARE_LOCATION_ID',
  'Square production location ID for the square edge function'
);