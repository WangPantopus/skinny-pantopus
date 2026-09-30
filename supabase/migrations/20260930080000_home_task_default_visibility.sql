-- Backwards compatible: yes. Adds one wrapper function; no table, column or row
-- changes. The deployed backend calls public.mutate_home_record by name and
-- keeps working unchanged. Deploy order does not matter.
--
-- Home settings let an owner choose "Default Visibility for New Items", but a
-- task created without a visibility was always stored `members`, so a Home set
-- to Managers still showed every new task to every member. A new task that
-- names no visibility now takes a Managers or Sensitive default, stepping down
-- (sensitive -> managers -> members) to the most restrictive level its creator
-- and its own assignee and viewers can all see, since the existing create
-- refuses a task one of them couldn't read. An explicit visibility always wins;
-- any other default, and a private-setup Home, keep `members`. The wrapper takes
-- the Home lock the existing mutator takes first, so the default and access it
-- reads are the ones the create is checked against. Every other call passes
-- through unchanged to the existing mutator, which keeps all validation,
-- locking and audit. The task-receipt hash is computed on the caller's payload
-- before this runs, so retries are unaffected.
SET LOCAL lock_timeout='5s';

ALTER FUNCTION public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid)
  RENAME TO mutate_home_record_before_default_visibility;
REVOKE ALL ON FUNCTION public.mutate_home_record_before_default_visibility(uuid,uuid,text,text,uuid,jsonb,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.mutate_home_record(p_home_id uuid,p_actor_id uuid,p_kind text,p_action text,
  p_record_id uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}',p_source_mail_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_payload jsonb:=p_payload; c jsonb; v_steps text[]; v_step text; v_targets uuid[];
  v_target uuid; v_ok boolean;
BEGIN
  IF p_kind='task' AND p_action='create' AND jsonb_typeof(p_payload)='object' AND NOT p_payload ? 'visibility' THEN
    IF public.lock_home_record_scope(p_home_id) THEN
      SELECT CASE default_visibility WHEN 'sensitive' THEN ARRAY['sensitive','managers']
        WHEN 'managers' THEN ARRAY['managers'] END INTO v_steps FROM public."Home" WHERE id=p_home_id;
    END IF;
    IF v_steps IS NOT NULL THEN
      -- Malformed assignee/viewer values are left for the existing validation to refuse.
      BEGIN
        v_targets:=array_remove(ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_payload->'viewer_user_ids')='array'
          THEN p_payload->'viewer_user_ids' ELSE '[]'::jsonb END))::uuid[]||(p_payload->>'assigned_to')::uuid,NULL);
      EXCEPTION WHEN OTHERS THEN v_targets:=NULL;
      END;
      c:=public.home_record_context(p_home_id,p_actor_id);
      IF v_targets IS NOT NULL AND c->>'private'='false' THEN
        FOREACH v_step IN ARRAY v_steps LOOP
          v_ok:=public.home_record_visible(c,'task',p_actor_id,v_step::public.home_record_visibility);
          FOREACH v_target IN ARRAY v_targets LOOP
            EXIT WHEN NOT v_ok;
            v_ok:=public.home_record_recipient(p_home_id,v_target,'task',v_step::public.home_record_visibility);
          END LOOP;
          IF v_ok THEN v_payload:=v_payload||jsonb_build_object('visibility',v_step); EXIT; END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;
  RETURN public.mutate_home_record_before_default_visibility(p_home_id,p_actor_id,p_kind,p_action,p_record_id,
    v_payload,p_source_mail_id);
END $$;
REVOKE ALL ON FUNCTION public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid) TO service_role;
