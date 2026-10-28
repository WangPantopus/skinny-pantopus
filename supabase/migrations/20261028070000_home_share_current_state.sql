-- Backwards compatible: yes. A disputed Home cannot issue or serve guest or
-- scoped links. Keep exact-issuer revocation and all existing share contracts.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.home_external_share_context(p_home_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_access jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_actor_id IS NULL OR NOT EXISTS(SELECT FROM public."Home" WHERE id=p_home_id
    AND home_status NOT IN ('merged','archived') AND security_state NOT IN ('frozen','frozen_silent','disputed')
    AND NOT coalesce(lockdown_enabled,false)) THEN RETURN '{"permissions":[]}'::jsonb; END IF;
  IF EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id
    AND (age_band IN ('child','teen') OR start_at>v_now OR end_at<=v_now
      OR access_start_at>v_now OR access_end_at<=v_now)) THEN RETURN '{"permissions":[]}'::jsonb; END IF;
  v_access:=public.home_effective_access(p_home_id,p_actor_id);
  IF v_access->>'is_owner'='true'
    AND EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_actor_id AND owner_status IN ('revoked','disputed'))
    AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_actor_id AND owner_status='verified') THEN RETURN '{"permissions":[]}'::jsonb; END IF;
  RETURN v_access;
END $$;

REVOKE ALL ON FUNCTION public.home_external_share_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_external_share_context(uuid,uuid) TO service_role;
