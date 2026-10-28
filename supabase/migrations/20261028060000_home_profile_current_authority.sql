-- Backwards compatible: yes. Extend the existing settings RPC to accept the
-- profile editor's fields; existing callers and signature are unchanged.
-- A profile PATCH used to bypass current household state, return the entire
-- private Home row, and change address text without changing its identity.
-- Reuse the settings transaction's authority lock and audit. No new table.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.update_home_settings(p_home_id uuid,p_actor_id uuid,p_fields jsonb,p_preferences jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE context jsonb; prefs jsonb:=p_preferences; k text; v jsonb; h public."Home"%ROWTYPE;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object'
    OR jsonb_typeof(prefs) IS DISTINCT FROM 'object' OR octet_length(prefs::text)>16384
    OR (p_fields='{}' AND prefs='{}') THEN
    RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb;
  END IF;
  FOR k,v IN SELECT * FROM jsonb_each(p_fields) LOOP
    IF k NOT IN('name','home_type','trash_day','house_rules','local_tips','guest_welcome_message','entry_instructions',
      'parking_instructions','default_visibility','default_guest_pass_hours','description','visibility','bedrooms',
      'bathrooms','sq_ft','lot_sq_ft','year_built','move_in_date','is_owner','amenities','location',
      'address','unit_number','city','state','zip_code','country') THEN
      RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb;
    END IF;
    IF k='name' THEN
      -- Joi's existing profile name limit counts UTF-16 code units.
      IF jsonb_typeof(v) NOT IN('string','null') OR (
        SELECT coalesce(sum(CASE WHEN ascii(character)>65535 THEN 2 ELSE 1 END),0)
        FROM regexp_split_to_table(p_fields->>k,'') AS chars(character)
      )>120 THEN RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF k='home_type' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR p_fields->>k NOT IN(
        'house','apartment','condo','townhouse','studio','rv','mobile_home','trailer','multi_unit','other'
      ) THEN RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF k IN('bedrooms','bathrooms','sq_ft','lot_sq_ft','year_built') THEN
      IF jsonb_typeof(v)<>'null' THEN
        IF jsonb_typeof(v)<>'number' OR v::numeric<0 OR v::numeric>2147483647
          OR (k<>'bathrooms' AND v::numeric<>trunc(v::numeric))
          OR (k IN('bedrooms','bathrooms') AND v::numeric>99)
          OR (k='year_built' AND (v::numeric<1600 OR v::numeric>2100)) THEN
          RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb;
        END IF;
      END IF;
    ELSIF k='is_owner' THEN
      IF jsonb_typeof(v)<>'boolean' THEN RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF k='amenities' THEN
      IF jsonb_typeof(v)<>'object' THEN RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF k='visibility' THEN
      IF jsonb_typeof(v)<>'string' OR p_fields->>k NOT IN('private','members','public_preview') THEN
        RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF k='move_in_date' THEN
      IF jsonb_typeof(v) NOT IN('string','null') THEN RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
      BEGIN PERFORM nullif(p_fields->>k,'')::date;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb;
      END;
    ELSIF k='location' THEN
      IF jsonb_typeof(v)<>'object' OR jsonb_typeof(v->'latitude') IS DISTINCT FROM 'number'
        OR jsonb_typeof(v->'longitude') IS DISTINCT FROM 'number' THEN
        RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
      IF (v->>'latitude')::numeric NOT BETWEEN -90 AND 90 OR (v->>'longitude')::numeric NOT BETWEEN -180 AND 180 THEN
        RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF k='default_guest_pass_hours' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'number' OR v::text !~ '^[0-9]+$'
        OR v::numeric<1 OR v::numeric>8760 THEN RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF k='default_visibility' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR p_fields->>k NOT IN('public','members','managers','sensitive') THEN
        RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF jsonb_typeof(v) NOT IN('string','null') OR length(p_fields->>k)>10000 THEN
      RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb;
    END IF;
  END LOOP;
  FOR k,v IN SELECT * FROM jsonb_each(prefs) LOOP
    IF k='bill_benchmark_opt_in' THEN
      IF v IN('"true"'::jsonb,'"false"'::jsonb) THEN prefs:=jsonb_set(prefs,ARRAY[k],(prefs->>k)::jsonb);
      ELSIF jsonb_typeof(v) IS DISTINCT FROM 'boolean' THEN RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSIF k='notifications' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
      IF EXISTS(SELECT FROM jsonb_each(v) e WHERE e.key NOT IN('bills','tasks','mail','delivery','guest_pass') OR jsonb_typeof(e.value)<>'boolean') THEN
        RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb; END IF;
    ELSE RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb;
    END IF;
  END LOOP;
  IF NOT public.lock_home_record_scope(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND"}'::jsonb; END IF;
  PERFORM 1 FROM public."HomePreference" WHERE home_id=p_home_id FOR UPDATE;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF h.home_status IN('archived','merged') OR h.security_state IN('frozen','frozen_silent','disputed')
    OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_actor_id AND owner_status='disputed') THEN
    RETURN '{"ok":false,"code":"HOME_SETTINGS_DENIED"}'::jsonb;
  END IF;
  context:=public.home_record_context(p_home_id,p_actor_id);
  IF context->>'allowed' IS DISTINCT FROM 'true' OR context->>'private'='true'
    OR NOT context->'permissions' ?& ARRAY['home.view','home.edit'] THEN
    RETURN '{"ok":false,"code":"HOME_SETTINGS_DENIED"}'::jsonb;
  END IF;
  -- Address identity is bound to household records and verification. Old clients
  -- may echo it, but an edit must not move those records to a different address.
  FOR k,v IN SELECT * FROM jsonb_each(p_fields) LOOP
    IF k IN('address','unit_number','city','state','zip_code','country') AND
      btrim(coalesce(p_fields->>k,'')) IS DISTINCT FROM btrim(coalesce(to_jsonb(h)->>
        CASE k WHEN 'unit_number' THEN 'address2' WHEN 'zip_code' THEN 'zipcode' ELSE k END,'')) THEN
      RETURN '{"ok":false,"code":"HOME_ADDRESS_CHANGE_REQUIRED"}'::jsonb;
    END IF;
  END LOOP;
  IF p_fields<>'{}' THEN
    UPDATE public."Home" SET
      name=CASE WHEN p_fields ? 'name' THEN p_fields->>'name' ELSE name END,
      home_type=CASE WHEN p_fields ? 'home_type' THEN p_fields->>'home_type' ELSE home_type END,
      trash_day=CASE WHEN p_fields ? 'trash_day' THEN p_fields->>'trash_day' ELSE trash_day END,
      house_rules=CASE WHEN p_fields ? 'house_rules' THEN p_fields->>'house_rules' ELSE house_rules END,
      local_tips=CASE WHEN p_fields ? 'local_tips' THEN p_fields->>'local_tips' ELSE local_tips END,
      guest_welcome_message=CASE WHEN p_fields ? 'guest_welcome_message' THEN p_fields->>'guest_welcome_message' ELSE guest_welcome_message END,
      entry_instructions=CASE WHEN p_fields ? 'entry_instructions' THEN p_fields->>'entry_instructions' ELSE entry_instructions END,
      parking_instructions=CASE WHEN p_fields ? 'parking_instructions' THEN p_fields->>'parking_instructions' ELSE parking_instructions END,
      default_visibility=CASE WHEN p_fields ? 'default_visibility' THEN (p_fields->>'default_visibility')::public.home_record_visibility ELSE default_visibility END,
      default_guest_pass_hours=CASE WHEN p_fields ? 'default_guest_pass_hours' THEN (p_fields->>'default_guest_pass_hours')::integer ELSE default_guest_pass_hours END,
      description=CASE WHEN p_fields ? 'description' THEN p_fields->>'description' ELSE description END,
      visibility=CASE WHEN p_fields ? 'visibility' THEN p_fields->>'visibility' ELSE visibility END,
      bedrooms=CASE WHEN p_fields ? 'bedrooms' THEN (p_fields->>'bedrooms')::smallint ELSE bedrooms END,
      bathrooms=CASE WHEN p_fields ? 'bathrooms' THEN (p_fields->>'bathrooms')::numeric ELSE bathrooms END,
      sq_ft=CASE WHEN p_fields ? 'sq_ft' THEN (p_fields->>'sq_ft')::integer ELSE sq_ft END,
      lot_sq_ft=CASE WHEN p_fields ? 'lot_sq_ft' THEN (p_fields->>'lot_sq_ft')::integer ELSE lot_sq_ft END,
      year_built=CASE WHEN p_fields ? 'year_built' THEN (p_fields->>'year_built')::integer ELSE year_built END,
      move_in_date=CASE WHEN p_fields ? 'move_in_date' THEN nullif(p_fields->>'move_in_date','')::date ELSE move_in_date END,
      is_owner=CASE WHEN p_fields ? 'is_owner' THEN (p_fields->>'is_owner')::boolean ELSE is_owner END,
      amenities=CASE WHEN p_fields ? 'amenities' THEN p_fields->'amenities' ELSE amenities END
    WHERE id=p_home_id;
  END IF;
  -- Preserve the verified-coordinate overwrite guard under the same lock as
  -- authority. Client coordinates remain user-asserted, never verified.
  IF p_fields ? 'location' AND h.geocode_mode IS DISTINCT FROM 'verified' THEN
    UPDATE public."Home" SET location=format('POINT(%s %s)',p_fields->'location'->>'longitude',
      p_fields->'location'->>'latitude')::geography,
      geocode_provider='client',geocode_mode='user_asserted',geocode_accuracy='unknown',geocode_place_id=NULL,
      geocode_source_flow='home_edit',geocode_created_at=clock_timestamp() WHERE id=p_home_id;
  END IF;
  IF prefs<>'{}' THEN
    INSERT INTO public."HomePreference"(home_id,settings) VALUES(p_home_id,prefs)
      ON CONFLICT(home_id) DO UPDATE SET settings="HomePreference".settings||EXCLUDED.settings;
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'home_settings_updated','Home',p_home_id,
      jsonb_build_object('fields_updated',ARRAY(SELECT jsonb_object_keys(p_fields)),
        'preferences_updated',ARRAY(SELECT jsonb_object_keys(prefs))));
  RETURN '{"ok":true}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION public.update_home_settings(uuid,uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_home_settings(uuid,uuid,jsonb,jsonb) TO service_role;
