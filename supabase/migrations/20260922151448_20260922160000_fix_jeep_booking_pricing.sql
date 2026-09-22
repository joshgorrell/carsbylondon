/*
# Fix Jeep and SUV booking price validation

1. Purpose
- The booking form stores the vehicle category as `jeep` or `suv`.
- The pricing catalog stores both categories under the shared `mid_suv` pricing class.
- The booking function previously compared `pricing_rules.pricing_class` directly to the vehicle category, causing valid Jeep bookings to fail at submission.

2. Modified Function
- `public.create_booking`
- Adds a server-side pricing-class translation for `jeep` and `suv` to `mid_suv`.
- Continues storing the original vehicle category on the vehicle record.
- Continues calculating the final total, deposit, and balance from server-side catalog values rather than client-supplied amounts.

3. Security
- Preserves the existing `SECURITY DEFINER` function and fixed `search_path`.
- No tables, columns, rows, or RLS policies are removed or weakened.

4. Important Notes
- This is a non-destructive function replacement.
- Existing appointments and pricing rules are unchanged.
*/

CREATE OR REPLACE FUNCTION public.create_booking(
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
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_appointment_id uuid;
  v_elem jsonb;
  v_slug text;
  v_name text;
  v_rule pricing_rules;
  v_addon add_ons;
  v_qty integer;
  v_side_count integer;
  v_total integer := 0;
  v_deposit integer := 0;
  v_balance integer := 0;
  v_settings business_settings;
  v_services jsonb := '[]'::jsonb;
  v_add_ons jsonb := '[]'::jsonb;
  v_pricing_class text;
BEGIN
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
  IF p_services IS NULL OR jsonb_typeof(p_services) <> 'array' OR jsonb_array_length(p_services) = 0 THEN
    RAISE EXCEPTION 'At least one service is required';
  END IF;
  IF jsonb_array_length(p_services) > 20 THEN
    RAISE EXCEPTION 'Too many services selected';
  END IF;
  IF p_add_ons IS NULL OR jsonb_typeof(p_add_ons) <> 'array' THEN
    p_add_ons := '[]'::jsonb;
  END IF;
  IF jsonb_array_length(p_add_ons) > 50 THEN
    RAISE EXCEPTION 'Too many add-ons selected';
  END IF;

  v_pricing_class := CASE p_vehicle_class
    WHEN 'jeep' THEN 'mid_suv'
    WHEN 'suv' THEN 'mid_suv'
    ELSE p_vehicle_class
  END;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_services) LOOP
    SELECT s.slug, s.name INTO v_slug, v_name
    FROM services s
    WHERE s.id = (v_elem->>'id')::uuid AND s.active = true;

    IF v_slug IS NULL THEN
      RAISE EXCEPTION 'One of the selected services is unavailable';
    END IF;

    SELECT * INTO v_rule
    FROM pricing_rules pr
    WHERE pr.service = v_slug AND pr.pricing_class = v_pricing_class;

    IF v_rule.id IS NULL THEN
      RAISE EXCEPTION 'Pricing is unavailable for this vehicle and service';
    END IF;

    IF v_slug = 'window_tint' THEN
      v_side_count := COALESCE((v_elem->'tint_scope'->>'sideCount')::int, 0);
      IF v_side_count < 0 THEN v_side_count := 0; END IF;
      IF v_side_count > 20 THEN v_side_count := 20; END IF;

      IF COALESCE((v_elem->'tint_scope'->>'front')::boolean, false) THEN
        v_total := v_total + COALESCE(v_rule.front_windshield_price, 0);
      END IF;
      IF COALESCE((v_elem->'tint_scope'->>'rear')::boolean, false) THEN
        v_total := v_total + COALESCE(v_rule.rear_glass_price, 0);
      END IF;
      IF COALESCE((v_elem->'tint_scope'->>'sides')::boolean, false) THEN
        v_total := v_total + COALESCE(v_rule.side_window_price, 0) * v_side_count;
      END IF;

      v_services := v_services || jsonb_build_object(
        'id', v_elem->'id', 'slug', v_slug, 'name', v_name,
        'tint_scope', jsonb_build_object(
          'front', COALESCE((v_elem->'tint_scope'->>'front')::boolean, false),
          'rear', COALESCE((v_elem->'tint_scope'->>'rear')::boolean, false),
          'sides', COALESCE((v_elem->'tint_scope'->>'sides')::boolean, false),
          'sideCount', v_side_count
        ),
        'tint_removal', COALESCE(v_elem->'tint_removal', 'null'::jsonb)
      );
    ELSIF v_slug = 'detailing' THEN
      IF COALESCE((v_elem->'detail_scope'->>'interior')::boolean, false) THEN
        v_total := v_total + COALESCE(v_rule.interior_price, 0);
      END IF;
      IF COALESCE((v_elem->'detail_scope'->>'exterior')::boolean, false) THEN
        v_total := v_total + COALESCE(v_rule.exterior_price, 0);
      END IF;
      v_total := v_total + COALESCE(v_rule.base_price, 0);

      v_services := v_services || jsonb_build_object(
        'id', v_elem->'id', 'slug', v_slug, 'name', v_name,
        'detail_scope', jsonb_build_object(
          'interior', COALESCE((v_elem->'detail_scope'->>'interior')::boolean, false),
          'exterior', COALESCE((v_elem->'detail_scope'->>'exterior')::boolean, false)
        )
      );
    ELSE
      v_total := v_total + COALESCE(v_rule.base_price, 0);
      v_services := v_services || jsonb_build_object(
        'id', v_elem->'id', 'slug', v_slug, 'name', v_name
      );
    END IF;
  END LOOP;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_add_ons) LOOP
    SELECT * INTO v_addon FROM add_ons a WHERE a.id = (v_elem->>'id')::uuid;
    IF v_addon.id IS NULL THEN
      RAISE EXCEPTION 'One of the selected add-ons is unavailable';
    END IF;

    IF v_addon.per_unit_label IS NOT NULL THEN
      v_qty := COALESCE((v_elem->>'quantity')::int, 1);
      IF v_qty < 1 THEN v_qty := 1; END IF;
      IF v_qty > 20 THEN v_qty := 20; END IF;
    ELSE
      v_qty := 1;
    END IF;

    v_total := v_total + COALESCE(v_addon.price, 0) * v_qty;
    v_add_ons := v_add_ons || jsonb_build_object(
      'id', v_addon.id,
      'name', v_addon.name,
      'price', COALESCE(v_addon.price, 0) * v_qty
    ) || CASE WHEN v_addon.per_unit_label IS NOT NULL
      THEN jsonb_build_object('quantity', v_qty, 'per_unit_label', v_addon.per_unit_label)
      ELSE '{}'::jsonb END;
  END LOOP;

  IF v_total < 0 THEN
    v_total := 0;
  END IF;

  SELECT * INTO v_settings FROM business_settings WHERE id = 1;

  IF v_settings.deposit_type = 'flat' THEN
    v_deposit := GREATEST(COALESCE(v_settings.flat_deposit_amount, 0), 0);
  ELSIF v_total > 0 THEN
    v_deposit := round(v_total * (COALESCE(v_settings.deposit_percentage, 20)::numeric / 100))::int;
  ELSE
    v_deposit := 0;
  END IF;

  IF v_deposit > v_total THEN
    v_deposit := v_total;
  END IF;
  v_balance := GREATEST(v_total - v_deposit, 0);

  INSERT INTO customers (first_name, last_name, email, phone)
  VALUES (p_first_name, NULLIF(p_last_name, ''), p_email, p_phone)
  RETURNING id INTO v_customer_id;

  INSERT INTO vehicles (customer_id, year, make, model, trim, vehicle_class, body_style)
  VALUES (v_customer_id, p_year, p_make, p_model, NULL, p_vehicle_class, NULL)
  RETURNING id INTO v_vehicle_id;

  INSERT INTO appointments (
    customer_id, vehicle_id, package_id, services, add_ons,
    appointment_date, status, deposit_paid,
    total_price, deposit_amount, balance_due
  )
  VALUES (
    v_customer_id, v_vehicle_id, NULL, v_services, v_add_ons,
    NULL, 'pending', false,
    v_total, v_deposit, v_balance
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO payments (appointment_id, amount, status)
  VALUES (v_appointment_id, v_deposit, 'pending');

  RETURN v_appointment_id;
END;
$function$;
