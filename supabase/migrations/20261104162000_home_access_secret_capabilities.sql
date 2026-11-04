-- Backwards compatible: yes. Add capabilities to the existing secret read;
-- retain its rows, read refusals, locks and write policy. No new tables or grants.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.get_home_access_secrets(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE v_context jsonb; v_rows jsonb; v_visibilities jsonb;
BEGIN
  IF NOT public.lock_home_secret_scope(p_home_id) THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  v_context:=public.home_secret_context(p_home_id,p_actor_id);
  IF v_context->>'allowed'<>'true' OR NOT ((v_context->'permissions') ?| ARRAY['access.view_wifi','access.view_codes']) THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_SECRET_ACCESS_DENIED','status',403); END IF;
  SELECT coalesce(jsonb_agg((to_jsonb(s)-'secret_value') || jsonb_build_object(
    'secret_value',coalesce(v.secret_value,''),'has_secret',coalesce(v.secret_value<>'',false)) ORDER BY s.label,s.id),'[]'::jsonb)
    INTO v_rows FROM public."HomeAccessSecret" s LEFT JOIN public."HomeAccessSecretValue" v ON v.access_secret_id=s.id
    WHERE s.home_id=p_home_id AND public.home_secret_can(v_context,p_actor_id,s.created_by,s.access_type,s.visibility,false);

  -- Use the mutation's visibility predicate with the same locked context.
  -- Writes are type-independent; a new private-setup record belongs to its creator.
  SELECT coalesce(jsonb_agg(candidate.visibility::text ORDER BY candidate.ordinality),'[]'::jsonb)
    INTO v_visibilities
    FROM unnest(enum_range(NULL::public.home_record_visibility)) WITH ORDINALITY AS candidate(visibility,ordinality)
    WHERE public.home_secret_can(v_context,p_actor_id,p_actor_id,'wifi',candidate.visibility,true);
  RETURN jsonb_build_object('ok',true,'secrets',v_rows,
    'can_manage',jsonb_array_length(v_visibilities)>0,'allowed_visibilities',v_visibilities);
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_access_secrets(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_access_secrets(uuid,uuid) TO service_role;
