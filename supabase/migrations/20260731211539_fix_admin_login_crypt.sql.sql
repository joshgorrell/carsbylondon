/*
# Fix admin login function — use pgcrypto crypt with explicit schema

1. Changes
- Replaces admin_login to use pg_catalog.crypt() explicitly, since the function's search_path doesn't include pg_crypto's schema.
*/

DROP FUNCTION IF EXISTS admin_login(text, text);

CREATE OR REPLACE FUNCTION admin_login(input_email text, input_password text)
RETURNS TABLE(user_id uuid, matches boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_catalog
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE email = input_email LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, FALSE;
    RETURN;
  END IF;
  RETURN QUERY SELECT v_user.id, (public.crypt(input_password, v_user.encrypted_password) = v_user.encrypted_password);
END;
$$;