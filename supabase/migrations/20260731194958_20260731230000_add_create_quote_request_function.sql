/*
# Add create_quote_request SECURITY DEFINER function

## Summary
The quote request form has the same problem as the booking flow: it inserts into
customers and vehicles using `.insert().select().single()`, which requires SELECT
permission that anon no longer has after the RLS lockdown.

This function creates the customer, vehicle, and appointment (quote) records in
one transaction, returning the appointment ID. The quote request stores the
customer's description in the appointment's `notes` field.

## Security
- SECURITY DEFINER: runs as owner, bypasses RLS
- SET search_path = public: prevents search_path hijacking
- EXECUTE granted to anon + authenticated: public quote flow
- Server-side validation: email format, phone length, year range, required fields
*/

CREATE OR REPLACE FUNCTION create_quote_request(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_year integer,
  p_make text,
  p_model text,
  p_description text,
  p_service_id text DEFAULT '',
  p_service_slug text DEFAULT 'quote',
  p_service_name text DEFAULT 'Quote Request'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_appointment_id uuid;
  v_services jsonb;
BEGIN
  -- Validate required fields
  IF p_first_name IS NULL OR btrim(p_first_name) = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  IF p_phone IS NULL OR length(regexp_replace(p_phone, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'A valid phone number is required';
  END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'A valid email is required';
  END IF;
  IF p_year IS NULL OR p_year < 1900 OR p_year > extract(year from now())::int + 2 THEN
    RAISE EXCEPTION 'A valid vehicle year is required';
  END IF;
  IF p_make IS NULL OR btrim(p_make) = '' OR p_model IS NULL OR btrim(p_model) = '' THEN
    RAISE EXCEPTION 'Vehicle make and model are required';
  END IF;
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RAISE EXCEPTION 'A description is required';
  END IF;

  -- Create customer
  INSERT INTO customers (first_name, last_name, email, phone)
  VALUES (p_first_name, NULLIF(p_last_name, ''), p_email, p_phone)
  RETURNING id INTO v_customer_id;

  -- Create vehicle (no vehicle class for quote requests)
  INSERT INTO vehicles (customer_id, year, make, model, trim, vehicle_class, body_style)
  VALUES (v_customer_id, p_year, p_make, p_model, NULL, NULL, NULL)
  RETURNING id INTO v_vehicle_id;

  -- Build services JSON
  v_services := jsonb_build_array(jsonb_build_object(
    'id', p_service_id,
    'slug', p_service_slug,
    'name', p_service_name
  ));

  -- Create appointment (quote request)
  INSERT INTO appointments (
    customer_id, vehicle_id, package_id, services, add_ons,
    appointment_date, status, deposit_paid,
    total_price, deposit_amount, balance_due, notes
  )
  VALUES (
    v_customer_id, v_vehicle_id, NULL, v_services, '[]'::jsonb,
    NULL, 'pending', false,
    0, 0, 0, p_description
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_quote_request FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_quote_request TO anon, authenticated;
