-- Backwards compatible: yes. Preserve the one-row-per-Home preference schema.
-- New application preferences default to no bill sharing, with no legacy opt-in.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."HomePreference" ADD COLUMN settings jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(settings)='object');
REVOKE ALL ON public."HomePreference" FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.update_home_settings(p_home_id uuid,p_actor_id uuid,p_fields jsonb,p_preferences jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE context jsonb; prefs jsonb:=p_preferences; k text; v jsonb;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object'
    OR jsonb_typeof(prefs) IS DISTINCT FROM 'object' OR octet_length(prefs::text)>16384
    OR (p_fields='{}' AND prefs='{}') THEN
    RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb;
  END IF;
  FOR k,v IN SELECT * FROM jsonb_each(p_fields) LOOP
    IF k NOT IN('trash_day','house_rules','local_tips','guest_welcome_message','entry_instructions',
      'parking_instructions','default_visibility','default_guest_pass_hours') THEN
      RETURN '{"ok":false,"code":"HOME_SETTINGS_INVALID"}'::jsonb;
    END IF;
    IF k='default_guest_pass_hours' THEN
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
  context:=public.home_record_context(p_home_id,p_actor_id);
  IF context->>'allowed' IS DISTINCT FROM 'true' OR context->>'private'='true' OR NOT context->'permissions' ? 'home.edit' THEN
    RETURN '{"ok":false,"code":"HOME_SETTINGS_DENIED"}'::jsonb;
  END IF;
  IF p_fields<>'{}' THEN
    UPDATE public."Home" SET
      trash_day=CASE WHEN p_fields ? 'trash_day' THEN p_fields->>'trash_day' ELSE trash_day END,
      house_rules=CASE WHEN p_fields ? 'house_rules' THEN p_fields->>'house_rules' ELSE house_rules END,
      local_tips=CASE WHEN p_fields ? 'local_tips' THEN p_fields->>'local_tips' ELSE local_tips END,
      guest_welcome_message=CASE WHEN p_fields ? 'guest_welcome_message' THEN p_fields->>'guest_welcome_message' ELSE guest_welcome_message END,
      entry_instructions=CASE WHEN p_fields ? 'entry_instructions' THEN p_fields->>'entry_instructions' ELSE entry_instructions END,
      parking_instructions=CASE WHEN p_fields ? 'parking_instructions' THEN p_fields->>'parking_instructions' ELSE parking_instructions END,
      default_visibility=CASE WHEN p_fields ? 'default_visibility' THEN (p_fields->>'default_visibility')::public.home_record_visibility ELSE default_visibility END,
      default_guest_pass_hours=CASE WHEN p_fields ? 'default_guest_pass_hours' THEN (p_fields->>'default_guest_pass_hours')::integer ELSE default_guest_pass_hours END
    WHERE id=p_home_id;
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
