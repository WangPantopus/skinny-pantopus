-- Backwards compatible: yes. Replaces one internal policy helper; no table,
-- column or data change, and its grants are restated unchanged.
-- A household member (HomeOccupancy.verification_source = 'household': an
-- accepted invitation or a household-reviewed residency claim) has household
-- access but no address proof (F3b, 20261004104000). This admission check
-- predates that column and treated every verified occupancy as already proven,
-- so a household member could never request the postcard that upgrades them to
-- 'address' (verify_home_postcard_current already performs that upgrade).
-- Only that check changes: household-sourced verification no longer blocks a
-- request, status read or dispatch; address and legacy verification still do.
-- Latest permitted source: supabase/migrations/20260911050000_home_postcard_current_recovery.sql:25
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.home_postcard_current_context(p_home_id uuid,p_actor_id uuid,p_confirmation boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  r public."HomeResidencyClaim"%ROWTYPE; u public."User"%ROWTYPE;
  t timestamptz:=clock_timestamp(); v_role text; v_age public.home_age_band;
  v_authorities boolean;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_confirmation IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  SELECT * INTO u FROM public."User" WHERE id=p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCOUNT_UNAVAILABLE','status',403); END IF;
  IF h.security_state IN ('frozen','frozen_silent','disputed') OR h.home_status IN ('archived','merged') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_HOME_UNAVAILABLE','status',403); END IF;
  SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_RESIDENCY_REQUEST_REQUIRED','status',409); END IF;
  SELECT * INTO r FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_actor_id;
  v_role:=coalesce(o.role_base::text,CASE o.role
    WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
    WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member' WHEN 'member' THEN 'member'
    WHEN 'caregiver' THEN 'restricted_member' ELSE o.role END);
  IF h.owner_id=p_actor_id OR v_role IN ('owner','admin','manager','property_manager')
    OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409); END IF;
  IF v_role IS NULL OR v_role NOT IN ('member','lease_resident','restricted_member')
    OR o.is_active IS DISTINCT FROM true OR o.end_at IS NOT NULL
    OR o.start_at>t OR o.access_start_at>t OR o.access_end_at<=t
    OR o.verification_status IS NULL OR o.verification_status NOT IN
      ('verified','unverified','pending','pending_approval','pending_doc','pending_postcard','provisional_bootstrap','provisional')
    OR r.status='rejected' THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
  -- Household consent (an accepted invitation or a household-reviewed claim)
  -- is not address proof (F3b), so it must not block the postcard that adds it.
  IF NOT p_confirmation AND o.verification_source IS DISTINCT FROM 'household'
    AND (o.verification_status IN ('verified','provisional') OR r.status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REVIEW_ALREADY_RECORDED','status',409); END IF;
  IF o.verification_status NOT IN ('verified','provisional') AND
    (o.verified_at IS NOT NULL OR o.verification_expires_at IS NOT NULL OR r.status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
  -- Preserve a stricter saved band and tighten it for a currently known minor.
  -- Physical-address proof cannot loosen an existing age restriction.
  v_age:=o.age_band;
  IF u.date_of_birth>(t AT TIME ZONE 'UTC')::date-interval '13 years' THEN v_age:='child';
  ELSIF u.date_of_birth>(t AT TIME ZONE 'UTC')::date-interval '18 years' AND v_age IS DISTINCT FROM 'child' THEN v_age:='teen'; END IF;
  SELECT EXISTS(SELECT FROM (
    SELECT user_id AS candidate FROM public."HomeOccupancy" WHERE home_id=p_home_id
    UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
    UNION SELECT h.owner_id
  ) candidates WHERE candidate IS NOT NULL AND candidate<>p_actor_id
    AND public.home_residency_review_authority(p_home_id,candidate)) INTO v_authorities;
  RETURN jsonb_build_object('ok',true,'age_band',v_age,'has_authorities',v_authorities,
    'already_verified',o.verification_status='verified','occupancy_id',o.id,'claim_id',r.id);
END;
$$;

REVOKE ALL ON FUNCTION public.home_postcard_current_context(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_postcard_current_context(uuid,uuid,boolean) TO service_role;
