-- Backwards compatible: yes. Read-only own-review history under current Home
-- reviewer authority. No receipt/occupancy backfill or command changes.
SET LOCAL lock_timeout='5s';
CREATE INDEX "HomeResidencyReviewReceipt_own_history_idx"
  ON public."HomeResidencyReviewReceipt"(home_id,actor_user_id,created_at DESC,id DESC);

-- Preserve original result values; these four keys were written by the original
-- receipt migration. Missing/corrupt data is unavailable, never invented history.
CREATE FUNCTION public.home_residency_review_history_item(r public."HomeResidencyReviewReceipt")
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN jsonb_typeof(r.result)='object'
    AND r.result ?& ARRAY['status','reviewed_at','occupancy_id','role_base']
    AND jsonb_typeof(r.result->'status')='string'
    AND r.result->>'status'=CASE WHEN r.action='approve' THEN 'verified' ELSE 'rejected' END
    AND jsonb_typeof(r.result->'reviewed_at')='string'
    AND (r.result->>'reviewed_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'
    AND CASE WHEN r.action='reject' THEN r.result->'occupancy_id'='null'::jsonb AND r.result->'role_base'='null'::jsonb
      ELSE jsonb_typeof(r.result->'occupancy_id')='string'
        AND (r.result->>'occupancy_id') ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        AND (r.result->'role_base'='null'::jsonb OR (jsonb_typeof(r.result->'role_base')='string'
          AND r.result->>'role_base' IN ('owner','admin','manager','member','restricted_member','guest','lease_resident','service_provider'))) END
    THEN jsonb_build_object('decision',jsonb_build_object(
      'id',r.id,'home_id',r.home_id,'claim_id',r.claim_id,'actor_id',r.actor_user_id,
      'action',r.action,'created_at',to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'legacy_request',r.legacy_request,'result',jsonb_build_object(
        'status',r.result->'status','reviewed_at',r.result->'reviewed_at',
        'occupancy_id',r.result->'occupancy_id','role_base',r.result->'role_base')),
      'current',jsonb_build_object('claim_status',c.status,
        'applicant_lookup','current_claim_reference','applicant',
          (SELECT jsonb_build_object('id',u.id,'username',u.username,'name',NULL)
            FROM public."User" u WHERE u.id=c.user_id),
        'household_access','not_checked')) ELSE NULL END
  FROM public."HomeResidencyClaim" c WHERE c.id=r.claim_id AND c.home_id=r.home_id;
$$;

CREATE FUNCTION public.list_home_residency_review_history(p_home_id uuid,p_actor_id uuid,
  p_after_id uuid DEFAULT NULL,p_after_created_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE ids uuid[]; r public."HomeResidencyReviewReceipt"%ROWTYPE;
  items jsonb:='[]'::jsonb; item jsonb; cursor jsonb:=NULL; n integer:=0;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL THEN
    RETURN '{"ok":false,"code":"RESIDENCY_HISTORY_INVALID","status":400}'::jsonb; END IF;
  IF (p_after_id IS NULL)<>(p_after_created_at IS NULL) OR (p_after_created_at IS NOT NULL AND NOT isfinite(p_after_created_at)) THEN
    RETURN '{"ok":false,"code":"RESIDENCY_HISTORY_CURSOR_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_residency_review_scope(p_home_id) THEN
    RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  -- Lock the owned anchor and projected rows/profiles before the authority clock.
  IF p_after_id IS NOT NULL THEN PERFORM id FROM public."HomeResidencyReviewReceipt"
    WHERE id=p_after_id AND home_id=p_home_id AND actor_user_id=p_actor_id FOR SHARE; END IF;
  SELECT coalesce(array_agg(x.id ORDER BY x.created_at DESC,x.id DESC),'{}'::uuid[]) INTO ids FROM (
    SELECT h.id,h.created_at FROM public."HomeResidencyReviewReceipt" h
    WHERE h.home_id=p_home_id AND h.actor_user_id=p_actor_id
      AND (p_after_id IS NULL OR (h.created_at,h.id)<(p_after_created_at,p_after_id))
    ORDER BY h.created_at DESC,h.id DESC LIMIT 21 FOR SHARE) x;
  PERFORM u.id FROM public."User" u WHERE u.id IN (
    SELECT c.user_id FROM public."HomeResidencyClaim" c JOIN public."HomeResidencyReviewReceipt" h ON h.claim_id=c.id
    WHERE h.id=ANY(ids) AND h.home_id=p_home_id AND h.actor_user_id=p_actor_id) ORDER BY u.id FOR SHARE;
  IF NOT public.home_residency_review_authority(p_home_id,p_actor_id) THEN
    RETURN '{"ok":false,"code":"MEMBERS_MANAGE_REQUIRED","status":403}'::jsonb; END IF;
  IF p_after_id IS NOT NULL AND NOT EXISTS(SELECT FROM public."HomeResidencyReviewReceipt"
    WHERE id=p_after_id AND home_id=p_home_id AND actor_user_id=p_actor_id AND created_at=p_after_created_at) THEN
    RETURN '{"ok":false,"code":"RESIDENCY_HISTORY_CURSOR_INVALID","status":400}'::jsonb; END IF;
  FOR r IN SELECT * FROM public."HomeResidencyReviewReceipt" WHERE id=ANY(ids) AND home_id=p_home_id AND actor_user_id=p_actor_id
    ORDER BY created_at DESC,id DESC LOOP
    n:=n+1; IF n>20 THEN EXIT; END IF;
    item:=public.home_residency_review_history_item(r);
    IF item IS NULL OR NOT isfinite(r.created_at) THEN
      RETURN '{"ok":false,"code":"RESIDENCY_HISTORY_UNAVAILABLE","status":503}'::jsonb; END IF;
    items:=items||jsonb_build_array(item);
    IF n=20 AND cardinality(ids)>20 THEN cursor:=jsonb_build_object(
      'version',1,'actor_id',p_actor_id,'home_id',p_home_id,'id',r.id,
      'created_at',to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')); END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'actor_id',p_actor_id,'items',items,'next_cursor',cursor);
END;
$$;

CREATE FUNCTION public.get_home_residency_review_history(p_home_id uuid,p_actor_id uuid,p_receipt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r public."HomeResidencyReviewReceipt"%ROWTYPE; item jsonb;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_receipt_id IS NULL THEN
    RETURN '{"ok":false,"code":"RESIDENCY_HISTORY_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_residency_review_scope(p_home_id) THEN
    RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO r FROM public."HomeResidencyReviewReceipt"
    WHERE id=p_receipt_id AND home_id=p_home_id AND actor_user_id=p_actor_id FOR SHARE;
  PERFORM u.id FROM public."User" u JOIN public."HomeResidencyClaim" c ON c.user_id=u.id
    WHERE c.id=r.claim_id AND c.home_id=p_home_id FOR SHARE OF u;
  IF NOT public.home_residency_review_authority(p_home_id,p_actor_id) THEN
    RETURN '{"ok":false,"code":"MEMBERS_MANAGE_REQUIRED","status":403}'::jsonb; END IF;
  IF r.id IS NULL THEN RETURN '{"ok":false,"code":"RESIDENCY_HISTORY_NOT_FOUND","status":404}'::jsonb; END IF;
  item:=public.home_residency_review_history_item(r);
  IF item IS NULL OR NOT isfinite(r.created_at) THEN
    RETURN '{"ok":false,"code":"RESIDENCY_HISTORY_UNAVAILABLE","status":503}'::jsonb; END IF;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'actor_id',p_actor_id,'item',item);
END;
$$;
REVOKE ALL ON FUNCTION public.home_residency_review_history_item(public."HomeResidencyReviewReceipt"),
  public.list_home_residency_review_history(uuid,uuid,uuid,timestamptz),
  public.get_home_residency_review_history(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
-- Hosted/local default privileges can grant service_role every new function.
-- Only the authority-checked entry points may call this projection helper.
REVOKE ALL ON FUNCTION public.home_residency_review_history_item(public."HomeResidencyReviewReceipt") FROM service_role;
GRANT EXECUTE ON FUNCTION public.list_home_residency_review_history(uuid,uuid,uuid,timestamptz),
  public.get_home_residency_review_history(uuid,uuid,uuid) TO service_role;
