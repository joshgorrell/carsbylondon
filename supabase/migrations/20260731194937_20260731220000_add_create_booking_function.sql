/*
# Add create_booking SECURITY DEFINER function

## Summary
The customer booking flow needs to create customer, vehicle, appointment, and
payment records in one atomic operation. After the RLS lockdown removed anon
SELECT on customers/vehicles (which hold PII), the `.insert().select().single()`
pattern broke because anon can no longer read back the rows it just inserted.

This function runs as its owner (bypassing RLS) and creates all four records in
a single transaction, returning the appointment ID. The anon role only needs
EXECUTE on this function — no direct table access beyond the INSERT policies
that are already in place.

## Security
- SECURITY DEFINER: runs as owner, bypasses RLS
- SET search_path = public: prevents search_path hijacking
- EXECUTE granted to anon + authenticated: public booking flow
- Server-side validation: email format, phone length, year range, required fields
- All IDs are generated internally — caller cannot forge customer_id or vehicle_id
*/

CREATE OR REPLACE FUNCTION create_booking(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_year integer,
  p_make text,
  p_model text,
  p_vehicle_class text,
  p_services jsonb,
  p_add_ons jsonb DEFAULT '[]'::jsonb,
  p_total_price integer DEFAULT 0,
  p_deposit_amount integer DEFAULT 0,
  p_balance_due integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_appointment_id uuid;
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
  IF p_vehicle_class IS NULL OR btrim(p_vehicle_class) = '' THEN
    RAISE EXCEPTION 'Vehicle class is required';
  END IF;
  IF p_services IS NULL OR jsonb_array_length(p_services) = 0 THEN
    RAISE EXCEPTION 'At least one service is required';
  END IF;
  IF p_total_price < 0 OR p_deposit_amount < 0 OR p_balance_due < 0 THEN
    RAISE EXCEPTION 'Invalid pricing';
  END IF;

  -- Create customer
  INSERT INTO customers (first_name, last_name, email, phone)
  VALUES (p_first_name, NULLIF(p_last_name, ''), p_email, p_phone)
  RETURNING id INTO v_customer_id;

  -- Create vehicle
  INSERT INTO vehicles (customer_id, year, make, model, trim, vehicle_class, body_style)
  VALUES (v_customer_id, p_year, p_make, p_model, NULL, p_vehicle_class, NULL)
  RETURNING id INTO v_vehicle_id;

  -- Create appointment
  INSERT INTO appointments (
    customer_id, vehicle_id, package_id, services, add_ons,
    appointment_date, status, deposit_paid,
    total_price, deposit_amount, balance_due
  )
  VALUES (
    v_customer_id, v_vehicle_id, NULL, p_services, p_add_ons,
    NULL, 'pending', false,
    p_total_price, p_deposit_amount, p_balance_due
  )
  RETURNING id INTO v_appointment_id;

  -- Create pending payment record
  INSERT INTO payments (appointment_id, amount, status)
  VALUES (v_appointment_id, p_deposit_amount, 'pending');

  RETURN v_appointment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_booking FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_booking TO anon, authenticated;
