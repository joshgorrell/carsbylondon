CREATE OR REPLACE FUNCTION public.get_vault_secret(secret_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = secret_name LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_vault_secret(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(text) TO service_role;
