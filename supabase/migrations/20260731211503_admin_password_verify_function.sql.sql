/*
# Admin password verification function

1. Security
- Creates a SECURITY DEFINER function that verifies a password against a bcrypt hash.
- Used by the admin-auth edge function to verify admin login.
- Returns true if the password matches the stored hash, false otherwise.
*/

CREATE OR REPLACE FUNCTION verify_admin_password(input_password text, stored_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN crypt(input_password, stored_hash) = stored_hash;
END;
$$;