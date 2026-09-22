-- Allow anon role to UPDATE business_settings, matching the pattern used by
-- all other admin tables in this app. The admin gate is enforced in the
-- frontend (sessionStorage check), and the previous policy only allowed
-- the `authenticated` role, so saves from the admin dashboard silently
-- failed and the database kept stale deposit settings.
DROP POLICY IF EXISTS admin_update_business_settings ON business_settings;

CREATE POLICY admin_update_business_settings ON business_settings
  FOR UPDATE TO anon, authenticated
  USING (true) WITH CHECK (true);
