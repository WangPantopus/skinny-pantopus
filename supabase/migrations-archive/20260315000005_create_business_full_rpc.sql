-- Migration: create_business_full RPC
-- Wraps create_business_transaction and optionally adds a location + hours
-- in a single atomic transaction. Used by the refactored creation wizard.

CREATE OR REPLACE FUNCTION "public"."create_business_full"(
  p_username text,
  p_name text,
  p_email text,
  p_business_type text,
  p_categories text[],
  p_description text,
  p_public_phone text,
  p_website text,
  p_actor_user_id uuid,
  -- Optional location fields
  p_location_address text DEFAULT NULL,
  p_location_city text DEFAULT NULL,
  p_location_state text DEFAULT NULL,
  p_location_zipcode text DEFAULT NULL,
  p_location_country text DEFAULT 'US',
  p_location_label text DEFAULT 'Main',
  -- Optional hours (JSON array)
  p_hours jsonb DEFAULT NULL
) RETURNS json
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_biz_user_id uuid;
  v_location_id uuid;
  v_hour jsonb;
BEGIN
  -- Step 1: Create User + BusinessProfile + BusinessTeam + BusinessPrivate + default page
  -- (reuse the existing create_business_transaction logic inline)
  INSERT INTO "User" (username, name, email, account_type)
  VALUES (p_username, p_name, p_email, 'business')
  RETURNING id INTO v_biz_user_id;

  INSERT INTO "BusinessProfile" (
    business_user_id, business_type, categories,
    description, public_email, public_phone, website
  ) VALUES (
    v_biz_user_id, p_business_type, p_categories,
    p_description, p_email, p_public_phone, p_website
  );

  INSERT INTO "BusinessTeam" (business_user_id, user_id, role_base, title, joined_at)
  VALUES (v_biz_user_id, p_actor_user_id, 'owner'::"public"."business_role_base", 'Owner', now());

  INSERT INTO "BusinessPrivate" (business_user_id)
  VALUES (v_biz_user_id);

  INSERT INTO "BusinessPage" (business_user_id, slug, title, is_default, show_in_nav, nav_order)
  VALUES (v_biz_user_id, 'overview', 'Overview', true, true, 0);

  -- Step 2: Optionally create location
  IF p_location_address IS NOT NULL AND p_location_city IS NOT NULL THEN
    INSERT INTO "BusinessLocation" (
      business_user_id, label, is_primary, address, city, state, zipcode, country
    ) VALUES (
      v_biz_user_id, p_location_label, true,
      p_location_address, p_location_city,
      p_location_state, p_location_zipcode, p_location_country
    )
    RETURNING id INTO v_location_id;

    -- Update primary_location_id on profile
    UPDATE "BusinessProfile"
    SET primary_location_id = v_location_id
    WHERE business_user_id = v_biz_user_id;

    -- Step 3: Optionally set hours for this location
    IF p_hours IS NOT NULL AND v_location_id IS NOT NULL THEN
      FOR v_hour IN SELECT * FROM jsonb_array_elements(p_hours)
      LOOP
        INSERT INTO "BusinessHours" (
          location_id, day_of_week, open_time, close_time, is_closed
        ) VALUES (
          v_location_id,
          (v_hour->>'day_of_week')::integer,
          CASE WHEN (v_hour->>'is_closed')::boolean THEN NULL ELSE (v_hour->>'open_time')::time END,
          CASE WHEN (v_hour->>'is_closed')::boolean THEN NULL ELSE (v_hour->>'close_time')::time END,
          COALESCE((v_hour->>'is_closed')::boolean, false)
        );
      END LOOP;
    END IF;
  END IF;

  RETURN json_build_object(
    'business_user_id', v_biz_user_id,
    'location_id', v_location_id
  );
END;
$$;

ALTER FUNCTION "public"."create_business_full"(
  text, text, text, text, text[], text, text, text, uuid,
  text, text, text, text, text, text, jsonb
) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."create_business_full"(
  text, text, text, text, text[], text, text, text, uuid,
  text, text, text, text, text, text, jsonb
) TO "anon";
GRANT ALL ON FUNCTION "public"."create_business_full"(
  text, text, text, text, text[], text, text, text, uuid,
  text, text, text, text, text, text, jsonb
) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_business_full"(
  text, text, text, text, text[], text, text, text, uuid,
  text, text, text, text, text, text, jsonb
) TO "service_role";
