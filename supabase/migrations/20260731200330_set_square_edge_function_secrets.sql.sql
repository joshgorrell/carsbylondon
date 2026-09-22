/*
# Set Square edge function secrets

Sets SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID as edge function secrets
so the `square` edge function can call the Square Payments API.
*/

SELECT vault.create_secret(
  'EAAAlyiy86x3WxwGjX1Ee3uLUIZaSupOgGnQj0Mlzi782QfbQvZlxRb8NXQwEapW',
  'SQUARE_ACCESS_TOKEN',
  'Square API access token for the square edge function'
);

SELECT vault.create_secret(
  'LT60BCJX4D9H8',
  'SQUARE_LOCATION_ID',
  'Square location ID for the square edge function'
);
