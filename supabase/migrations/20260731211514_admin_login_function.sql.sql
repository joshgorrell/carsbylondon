/*
# Admin login function

1. Security
- Replaces the simpler verify function with one that returns user id + match status.
- SECURITY DEFINER so it can read from auth.users (which is not accessible to anon/authenticated roles).
- Returns a table with user_id (uuid) and matches (boolean).
*/

DROP FUNCTION IF EXISTS verify_admin_password(text, text);
DROP FUNCTION IF EXISTS admin_login(text, text);

CREATE OR REPLACE FUNCTION admin_login(input_email text, input_password text)
RETURNS TABLE(user_id uuid, matches boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM auth.users WHERE email = input_email LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, FALSE;
    RETURN;
  END IF;
  RETURN QUERY SELECT v_user.id, (crypt(input_password, v_user.encrypted_password) = v_user.encrypted_password);
END;
$$;