/*
# Allow anon SELECT on customers and vehicles

1. Why
   - The booking flow inserts a customer row then immediately calls
     `.insert({...}).select().single()` to retrieve the new row's id.
   - PostgREST needs a SELECT policy to return the inserted row. The
     `customers` table only had a SELECT policy for `authenticated`
     (the admin), so an anon-key guest booking got "new row violates
     row-level security policy for table customers" on the read-back.
   - Same fix applied to `vehicles` for the same booking-flow pattern.

2. Security
   - Adds a SELECT policy for `anon, authenticated` on `customers` and
     `vehicles`. This is a single-tenant booking app with no sign-in;
     guests must be able to read back the rows they just inserted.
   - INSERT/UPDATE/DELETE policies are unchanged (insert still open to
     anon, update/delete still admin-only).
*/

-- customers: allow anon + authenticated to SELECT (read-back after insert)
DROP POLICY IF EXISTS "public_read_customers" ON customers;
CREATE POLICY "public_read_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

-- vehicles: allow anon + authenticated to SELECT (read-back after insert)
DROP POLICY IF EXISTS "public_read_vehicles" ON vehicles;
CREATE POLICY "public_read_vehicles" ON vehicles FOR SELECT
  TO anon, authenticated USING (true);
