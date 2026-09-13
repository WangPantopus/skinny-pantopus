-- Backwards compatible: yes. Adds a service-only reader function without changing
-- existing tables, records, permissions or RPCs used by the deployed app.
-- The pending-queue envelope is retained; no claim/receipt/role backfill.
-- Current claim descriptions are not immutable review history or access proof.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.list_home_current_residency_claims(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE claims jsonb;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL THEN
    RETURN '{"ok":false,"code":"RESIDENCY_CLAIMS_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_residency_review_scope(p_home_id) THEN
    RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  -- Admission/review and Home authority rows are already locked. Profile reads
  -- can also wait: acquire every projected profile lock before the fresh clock.
  PERFORM u.id FROM public."User" u WHERE u.id IN (
    SELECT c.user_id FROM public."HomeResidencyClaim" c
      WHERE c.home_id=p_home_id AND c.status='pending') ORDER BY u.id FOR SHARE;
  IF NOT public.home_residency_review_authority(p_home_id,p_actor_id) THEN
    RETURN '{"ok":false,"code":"MEMBERS_MANAGE_REQUIRED","status":403}'::jsonb; END IF;
  IF EXISTS(SELECT FROM public."HomeResidencyClaim" c
    WHERE c.home_id=p_home_id AND c.status='pending' AND c.created_at IS NOT NULL AND NOT isfinite(c.created_at)) THEN
    RETURN '{"ok":false,"code":"RESIDENCY_CLAIMS_UNAVAILABLE","status":503}'::jsonb; END IF;
  -- Complete pending collection, no hidden truncation. Read only the safe public
  -- username; account/legal name, address, locality and evidence never enter it.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'home_id',c.home_id,'user_id',c.user_id,'status','pending',
    'created_at',to_char(c.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'claimed_role',public.home_residency_role_family(c.claimed_role),
    'claimant',(SELECT jsonb_build_object('id',u.id,'username',u.username,'name',NULL)
      FROM public."User" u WHERE u.id=c.user_id)) ORDER BY c.created_at DESC NULLS LAST,c.id DESC),'[]'::jsonb)
    INTO claims FROM public."HomeResidencyClaim" c WHERE c.home_id=p_home_id AND c.status='pending';
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'actor_id',p_actor_id,'claims',claims);
END;
$$;
REVOKE ALL ON FUNCTION public.list_home_current_residency_claims(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_home_current_residency_claims(uuid,uuid) TO service_role;
