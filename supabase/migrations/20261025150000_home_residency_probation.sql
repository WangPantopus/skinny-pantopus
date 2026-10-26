-- Backwards compatible: yes. Adds one allowed value to HomeOccupancy.verification_source, one switched-off
-- FeatureFlag row, two new service-only functions, and forward replacements of four existing functions with the
-- same signatures and grants. Only admit_home_residency_probation creates a 'probation' occupancy, only the backend
-- job calls it, and it creates none while home_residency_probation is off (its default), so the replaced functions
-- behave exactly as before for every existing row (the reviewer's projection only gains the verification_source
-- field), and resolve_home_probation_dispute only acts on the review cases probation disputes open.
--
-- Home claims plan, PR 4: probation join (plan "when-users-claim-an-streamed-willow", approved by the founder on
-- 2026-10-25 together with 7-day probation for unanswered join requests, for residents only and never for
-- ownership, behind a flag that ships off until the founder has tested it; for residents this reverses April
-- decision D13, "no approval because review is slow").
-- A household-review request that nobody has answered for 7 days is admitted on probation: the existing
-- provisional state, with source 'probation' and the existing challenge window (7 days, or 14 for a medium
-- address watch). A request already unanswered for more than 30 days stays pending instead (decided 2026-10-26
-- for the backlog the flag would otherwise sweep on its first run: probation months later would surprise both the
-- person and the household); the household can still answer it and the person can still verify by mail. A high
-- address watch holds the request until it's proven. Waiting alone never opens the household's records:
-- home_effective_access and getUserAccess admit only verified rows, and the mail and Plans trust lists leave
-- 'probation' out. Probation ends only when a reviewer says yes (verified, household), when the
-- person proves the address (the postcard review window, then the existing promotion), or with a no: a
-- reviewer's denial or a challenge in the window suspends them ('suspended_challenged'). Time never promotes a
-- probationer: promote_home_postcard_review still needs a postcard proved in the window.
-- After a no, asking again is refused (MEMBERSHIP_RENEWAL_REQUIRED). The way back is proof: a suspended
-- probationer may still request a postcard, and proving it opens a dispute in the Pantopus review queue
-- (AddressReviewCase, trigger probation_dispute) instead of restoring access; the no stands until Pantopus decides
-- (resolve_home_probation_dispute): approving restores the membership (founder decision 2026-10-26), rejecting is
-- final for this probation, and dismissing lets them send proof again.
--
-- Latest permitted sources (bodies copied unchanged except the lines commented below):
--   review_home_residency           supabase/migrations/20261004104000_home_verification_source.sql:222
--   verify_home_postcard_current    supabase/migrations/20261004104000_home_verification_source.sql:603
--   home_postcard_current_context   supabase/migrations/20261025120000_home_instant_claim.sql:150
--   home_residency_review_current   supabase/migrations/20260910233000_home_residency_review_receipts.sql:73
SET LOCAL lock_timeout='5s';

ALTER TABLE public."HomeOccupancy" DROP CONSTRAINT "HomeOccupancy_verification_source_check";
ALTER TABLE public."HomeOccupancy" ADD CONSTRAINT "HomeOccupancy_verification_source_check"
  CHECK (verification_source IN ('address','household','legacy','claim','probation')) NOT VALID;
ALTER TABLE public."HomeOccupancy" VALIDATE CONSTRAINT "HomeOccupancy_verification_source_check";
COMMENT ON COLUMN public."HomeOccupancy".verification_source IS
  'Origin of residency trust: address proof, household consent, retained legacy verification, a claim (an instant claim at an address with no household, or an invitation from someone whose own access is a claim), or probation (a household-review request nobody answered in 7 days; provisional, no household records). Status/access/expiry still apply.';

-- Off: it ships off, and the founder turns it on after testing (POST /api/admin/feature-flags/home_residency_probation
-- with {"enabled_globally": true}). Turning it off again stops new probation at once; people already on probation
-- stay until a reviewer, a proof or a challenge decides.
INSERT INTO public."FeatureFlag" (flag_name, enabled_globally, enabled_for_internal_team, beta_user_ids, description)
VALUES ('home_residency_probation', false, false, ARRAY[]::uuid[],
  'Probation join: a household-review request nobody answered in 7 days becomes probation (provisional, no household records) until a reviewer decides or the address is proven. Off by default; the founder turns it on after testing. Turn it off to stop new probation.')
ON CONFLICT (flag_name) DO NOTHING;

-- Admits one unanswered household-review request on probation (backend/jobs/processClaimWindows.js). Residency
-- requests are renter or household requests only, so this never touches ownership; anyone with an owner record is
-- refused. The request must still be pending and unreviewed, unchanged for p_wait_days but saved less than
-- p_max_age_days ago (an older one stays pending), with the fresh pending membership the request created and no
-- challenge window. An open address-watch case about this person at this Home, or about the Home itself, holds it.
-- p_window_days (7, or 14 for a medium address watch) is the window in which a reviewer can challenge. Returns when
-- the request was saved and the household's current reviewers, who are told.
CREATE FUNCTION public.admit_home_residency_probation(p_home_id uuid,p_actor_id uuid,p_claim_id uuid,
  p_wait_days integer,p_window_days integer,p_max_age_days integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; r public."HomeResidencyClaim"%ROWTYPE;
  t timestamptz; v_reviewers uuid[];
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_claim_id IS NULL OR p_wait_days IS NULL OR p_wait_days NOT BETWEEN 1 AND 90
    OR p_window_days IS NULL OR p_window_days NOT BETWEEN 7 AND 90
    OR p_max_age_days IS NULL OR p_max_age_days<=p_wait_days OR p_max_age_days>365 THEN
    RETURN '{"ok":false,"code":"PROBATION_INVALID","status":400}'::jsonb; END IF;
  IF NOT EXISTS(SELECT FROM public."FeatureFlag" f WHERE f.flag_name='home_residency_probation'
      AND (f.enabled_globally OR p_actor_id=ANY(coalesce(f.beta_user_ids,'{}'::uuid[])))) THEN
    RETURN '{"ok":false,"code":"PROBATION_OFF","status":404}'::jsonb; END IF;
  IF NOT public.lock_home_residency_review_scope(p_home_id) THEN
    RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  t:=clock_timestamp();
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  SELECT * INTO r FROM public."HomeResidencyClaim" WHERE id=p_claim_id AND home_id=p_home_id AND user_id=p_actor_id;
  SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF r.id IS NULL OR r.status IS DISTINCT FROM 'pending' OR r.cold_start_mode IS NOT NULL OR r.reviewed_by IS NOT NULL
    OR r.updated_at>t-make_interval(days=>p_wait_days) OR r.updated_at<=t-make_interval(days=>p_max_age_days)
    OR public.home_residency_role_family(r.claimed_role) IS NULL
    OR o.id IS NULL OR o.is_active IS DISTINCT FROM true OR o.verification_status IS DISTINCT FROM 'pending_approval'
    OR o.role_base IS DISTINCT FROM 'restricted_member' OR o.end_at IS NOT NULL OR o.start_at>t
    OR o.access_start_at>t OR o.access_end_at<=t OR o.verified_at IS NOT NULL OR o.verification_expires_at IS NOT NULL
    OR o.challenge_window_started_at IS NOT NULL OR o.challenge_window_ends_at IS NOT NULL
    OR h.owner_id=p_actor_id OR h.security_state IN ('frozen','frozen_silent','disputed') OR h.home_status IN ('archived','merged')
    OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id) THEN
    RETURN '{"ok":true,"admitted":false}'::jsonb; END IF;
  IF EXISTS(SELECT FROM public."AddressReviewCase" WHERE home_id=p_home_id AND (user_id=p_actor_id OR user_id IS NULL)
      AND trigger='address_watch' AND status IN ('open','in_review')) THEN
    RETURN '{"ok":true,"admitted":false,"held":true}'::jsonb; END IF;
  UPDATE public."HomeOccupancy" SET verification_status='provisional',verification_source='probation',
    can_manage_home=false,can_manage_access=false,can_manage_finance=false,can_manage_tasks=false,can_view_sensitive=false,
    challenge_window_started_at=t,challenge_window_ends_at=t+make_interval(days=>p_window_days),updated_at=t
    WHERE id=o.id RETURNING * INTO o;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'RESIDENCY_PROBATION_STARTED','HomeOccupancy',o.id,jsonb_build_object('claim_id',r.id,
      'request_saved_at',r.updated_at,'challenge_window_ends_at',o.challenge_window_ends_at));
  SELECT coalesce(array_agg(candidate ORDER BY candidate),'{}'::uuid[]) INTO v_reviewers FROM (
    SELECT user_id AS candidate FROM public."HomeOccupancy" WHERE home_id=p_home_id
    UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
    UNION SELECT h.owner_id
  ) c WHERE candidate IS NOT NULL AND candidate<>p_actor_id AND public.home_residency_review_authority(p_home_id,candidate);
  RETURN jsonb_build_object('ok',true,'admitted',true,'home_id',p_home_id,'user_id',p_actor_id,'occupancy_id',o.id,
    'claim_id',r.id,'request_saved_at',r.updated_at,'challenge_window_ends_at',o.challenge_window_ends_at,
    'reviewer_ids',to_jsonb(v_reviewers));
END $$;
REVOKE ALL ON FUNCTION public.admit_home_residency_probation(uuid,uuid,uuid,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admit_home_residency_probation(uuid,uuid,uuid,integer,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.review_home_residency(
  p_home_id uuid, p_actor_id uuid, p_action text, p_payload jsonb DEFAULT '{}',
  p_validity_days integer DEFAULT 365)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout = '5s' AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_claim public."HomeResidencyClaim"%ROWTYPE;
  v_target public."HomeOccupancy"%ROWTYPE; v_user public."User"%ROWTYPE;
  v_actor jsonb; v_access jsonb; v_actor_role public.home_role_base;
  v_role public.home_role_base; v_old_role public.home_role_base;
  v_actor_permissions text[]; v_permissions text[];
  v_target_id uuid; v_claim_id uuid; v_has_target boolean;
  v_now timestamptz; v_replay boolean := false; v_existing_verified boolean := false;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_action IS NULL
    OR p_action NOT IN ('attach','approve','reject')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650
    OR EXISTS (SELECT FROM jsonb_object_keys(p_payload) k
      WHERE k NOT IN ('target_id','claim_id','role','reason'))
    OR (p_action='attach' AND (NOT p_payload ? 'target_id'
      OR p_payload ?| ARRAY['claim_id','role','reason']))
    OR (p_action<>'attach' AND (NOT p_payload ? 'claim_id' OR p_payload ? 'target_id'))
    OR (p_action='approve' AND p_payload ? 'reason')
    OR (p_action='reject' AND p_payload ? 'role') THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ADMISSION_REQUEST','status',400);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  -- Match member-authority lock order. Admission cannot race a removal, a role
  -- change, an explicit deny, a preset change or an ownership transition.
  LOCK TABLE public."HomeRolePermission", public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM user_id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  IF p_action='attach' THEN
    v_target_id := (p_payload->>'target_id')::uuid;
  ELSE
    v_claim_id := (p_payload->>'claim_id')::uuid;
    SELECT * INTO v_claim FROM public."HomeResidencyClaim"
      WHERE id=v_claim_id AND home_id=p_home_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_FOUND','status',404); END IF;
    v_target_id := v_claim.user_id;
  END IF;
  -- Recalculate after every potentially blocking lock, rather than admitting
  -- an actor whose access expired while this transaction waited.
  v_now := clock_timestamp();
  v_actor := public.home_effective_access(p_home_id,p_actor_id);
  IF v_home.security_state IN ('frozen','frozen_silent') OR v_home.home_status IN ('merged','archived')
    OR NOT (v_actor->'permissions') ? 'members.manage'
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id
      AND (start_at>v_now OR end_at<=v_now OR access_start_at>v_now OR access_end_at<=v_now))
    OR (v_actor->>'is_owner'='true'
      AND EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status IN ('revoked','disputed'))
      AND NOT EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status='verified')) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  IF v_target_id IS NULL OR v_target_id=p_actor_id THEN
    RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403);
  END IF;
  SELECT * INTO v_user FROM public."User" WHERE id=v_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','USER_NOT_FOUND','status',404); END IF;
  IF p_action='reject' THEN
    IF v_claim.status='rejected' AND v_claim.reviewed_by=p_actor_id THEN
      RETURN jsonb_build_object('ok',true,'code','CLAIM_REJECTED','replayed',true,'target_id',v_target_id);
    END IF;
    IF v_claim.status IS DISTINCT FROM 'pending' THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_PENDING','status',409);
    END IF;
    IF length(p_payload->>'reason')>2000 THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_ADMISSION_REQUEST','status',400);
    END IF;
    UPDATE public."HomeResidencyClaim" SET status='rejected',reviewed_by=p_actor_id,
      reviewed_at=v_now,review_note=nullif(p_payload->>'reason',''),updated_at=v_now WHERE id=v_claim_id;
    -- Home claims PR 4: a reviewer's no ends probation. The probationer is suspended the way a challenge
    -- suspends someone; proof of the address is their way back.
    UPDATE public."HomeOccupancy" SET is_active=false,verification_status='suspended_challenged',updated_at=v_now
      WHERE home_id=p_home_id AND user_id=v_target_id AND is_active AND verification_status='provisional'
        AND verification_source='probation';
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,'residency_claim_rejected','HomeResidencyClaim',v_claim_id,
        jsonb_build_object('user_id',v_target_id,'probation_suspended',FOUND));
    RETURN jsonb_build_object('ok',true,'code','CLAIM_REJECTED','replayed',false,'target_id',v_target_id);
  END IF;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=v_target_id;
  v_has_target := FOUND;
  v_old_role := v_target.role_base;
  IF v_old_role IS NULL THEN
    v_old_role := CASE v_target.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
      WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
      WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
      WHEN 'member' THEN 'member' WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
  END IF;
  IF v_home.owner_id=v_target_id OR v_old_role='owner'
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=v_target_id) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409);
  END IF;
  IF v_has_target AND (v_target.is_active IS DISTINCT FROM true OR v_old_role IS NULL
    OR v_target.end_at<=v_now OR v_target.access_end_at<=v_now
    OR (v_target.start_at IS NOT NULL AND v_target.end_at<=v_target.start_at)
    OR (v_target.access_start_at IS NOT NULL AND v_target.access_end_at<=v_target.access_start_at)
    OR greatest(v_target.start_at,v_target.access_start_at)>=least(v_target.end_at,v_target.access_end_at)
    OR v_target.verification_status IS NULL
    OR v_target.verification_status NOT IN ('verified','unverified','pending','pending_approval',
      'pending_doc','pending_postcard','provisional_bootstrap','provisional')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL)) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409);
  END IF;
  -- A recorded postal code leaves the claim pending during household review.
  -- Admit only that coherent provisional window, never a stale/partial grant.
  -- Home claims PR 4: probation has no postcard. A reviewer's yes is one way out of it, so a coherent probation
  -- (a challenge window and no verification dates) is admitted like a pending request.
  IF v_has_target AND v_target.verification_status='provisional' AND v_target.verification_source='probation'
    AND (v_target.verification_expires_at IS NOT NULL OR v_target.challenge_window_started_at IS NULL
      OR v_target.challenge_window_ends_at IS NULL) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409);
  END IF;
  IF v_has_target AND v_target.verification_status='provisional' AND v_target.verification_source<>'probation' AND (
    v_target.verification_expires_at IS NOT NULL
    OR v_target.challenge_window_started_at IS NULL OR v_target.challenge_window_started_at>v_now
    OR v_target.challenge_window_ends_at IS NULL
    OR v_target.challenge_window_ends_at<v_target.challenge_window_started_at+interval '7 days'
    OR coalesce(v_home.country,'US')<>'US'
    OR NOT EXISTS(SELECT FROM public."HomePostcardCode" p WHERE p.home_id=p_home_id AND p.user_id=v_target_id
      AND p.status='verified' AND p.verified_at>=v_target.challenge_window_started_at AND p.verified_at<=v_target.challenge_window_ends_at
      AND p.destination=jsonb_build_object('address',v_home.address,'address2',v_home.address2,
        'city',v_home.city,'state',v_home.state,'zipcode',v_home.zipcode))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409);
  END IF;
  v_existing_verified := v_has_target AND v_target.verification_status='verified';
  IF p_action='approve' AND v_claim.status IS DISTINCT FROM 'pending' THEN
    -- Exact retry returns current membership only. It cannot reapply an old
    -- role, renew dates or reactivate someone removed after the first approval.
    IF v_claim.status='verified' AND v_claim.reviewed_by=p_actor_id AND v_existing_verified THEN
      v_replay := true;
    ELSE
      RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_PENDING','status',409);
    END IF;
  END IF;
  IF v_existing_verified THEN
    -- Existing verified members keep their role, age, dates, denies, metadata
    -- and legacy projections. Use the separate authority endpoint to edit them.
    v_role := v_old_role;
    v_replay := v_replay OR p_action='attach';
  ELSE
    IF p_action='attach' THEN
      v_role := coalesce(v_old_role,'member');
    ELSE
      v_role := CASE coalesce(p_payload->>'role',v_claim.claimed_role,'member')
        WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
        WHEN 'lease_resident' THEN 'lease_resident' WHEN 'member' THEN 'member'
        WHEN 'household' THEN 'member' WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
        WHEN 'caregiver' THEN 'restricted_member' WHEN 'restricted_member' THEN 'restricted_member'
        WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
    END IF;
    IF v_role IS NULL OR v_role IN ('owner','admin','manager') THEN
      RETURN jsonb_build_object('ok',false,'code','RESIDENCY_ROLE_FORBIDDEN','status',403);
    END IF;
    v_actor_role := (v_actor->>'effective_role_base')::public.home_role_base;
    IF (v_actor_role<>'owner' AND (public.home_role_rank(v_role)>=public.home_role_rank(v_actor_role)
      OR (v_has_target AND public.home_role_rank(v_old_role)>=public.home_role_rank(v_actor_role))))
      OR (v_target.age_band='child' AND public.home_role_rank(v_role)>20)
      OR (v_target.age_band='teen' AND public.home_role_rank(v_role)>30) THEN
      RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403);
    END IF;
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_permissions;
    -- Activation makes all existing grants effective, so compare the complete
    -- future permission set, not only a role-change delta. Denies are retained.
    v_permissions := public.home_member_policy_permissions(p_home_id,v_target_id,v_role,v_target.age_band);
    IF EXISTS (SELECT FROM unnest(v_permissions) permission WHERE NOT permission=ANY(v_actor_permissions)) THEN
      RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403);
    END IF;
    IF v_has_target THEN
      UPDATE public."HomeOccupancy" SET role=v_role::text,role_base=v_role,
        verification_status='verified',verification_source=CASE WHEN verification_source='address' OR (verification_status='verified' AND verification_source='legacy') THEN verification_source ELSE 'household' END,verified_at=v_now,
        verification_expires_at=v_now+make_interval(days=>p_validity_days),updated_at=v_now
        WHERE id=v_target.id RETURNING * INTO v_target;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,
        start_at,added_by_user_id,verification_status,verification_source,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
      VALUES(p_home_id,v_target_id,v_role::text,v_role,NULL,true,now(),p_actor_id,'verified','household',v_now,
        v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
      RETURNING * INTO v_target;
    END IF;
    -- The permission resolver uses transaction time for reads. Project flags
    -- with the decision clock so a schedule reached during a lock wait does
    -- not leave stale flags; future access still projects no capability.
    v_access := jsonb_build_object('permissions',CASE
      WHEN (v_target.start_at IS NULL OR v_target.start_at<=v_now)
        AND (v_target.access_start_at IS NULL OR v_target.access_start_at<=v_now)
      THEN to_jsonb(v_permissions) ELSE '[]'::jsonb END);
    UPDATE public."HomeOccupancy" SET
      can_manage_home=(v_access->'permissions') ? 'home.edit',
      can_manage_access=(v_access->'permissions') ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=(v_access->'permissions') ? 'finance.manage',
      can_manage_tasks=(v_access->'permissions') ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=(v_access->'permissions') ? 'sensitive.view'
      WHERE id=v_target.id RETURNING * INTO v_target;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=p_home_id AND vacancy_at IS NOT NULL;
  END IF;
  IF p_action='approve' AND NOT v_replay THEN
    UPDATE public."HomeResidencyClaim" SET status='verified',reviewed_by=p_actor_id,
      reviewed_at=v_now,updated_at=v_now WHERE id=v_claim_id;
  END IF;
  IF NOT v_replay THEN
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,CASE WHEN p_action='approve' THEN 'residency_claim_approved' ELSE 'member_attached' END,
        'HomeOccupancy',v_target.id,jsonb_build_object('user_id',v_target_id,'claim_id',v_claim_id,
          'role_base',v_role,'existing_verified',v_existing_verified));
  END IF;
  RETURN jsonb_build_object('ok',true,'code','MEMBERSHIP_CONFIRMED','replayed',v_replay,
    'occupancy',to_jsonb(v_target),'target_id',v_target_id,
    'user',jsonb_build_object('id',v_target_id,'username',v_user.username,'name',v_user.name),
    'home_label',coalesce(v_home.name,v_home.address,'your home'));
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_home_postcard_current(
 p_home_id uuid,p_actor_id uuid,p_postcard_id uuid,p_request_id uuid,p_submitted_hash text,p_validity_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomePostcardVerificationCommand"%ROWTYPE; p public."HomePostcardCode"%ROWTYPE;
 h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; r public."HomeResidencyClaim"%ROWTYPE;
 context jsonb; policy jsonb; intent text; t timestamptz; age public.home_age_band;
 code text; status integer; remaining integer; v_status text; v_recorded timestamptz;
 v_challenge timestamptz; v_existing boolean:=false; v_case uuid;
BEGIN
 IF p_home_id IS NULL OR p_actor_id IS NULL OR p_postcard_id IS NULL OR p_request_id IS NULL
   OR p_submitted_hash IS NULL OR p_submitted_hash !~ '^[a-f0-9]{64}$'
   OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_INVALID','status',400); END IF;
 intent:=encode(sha256(convert_to(jsonb_build_object('home_id',p_home_id,'postcard_id',p_postcard_id,
   'submitted_hash',p_submitted_hash)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:user:'||p_actor_id::text,0));
 PERFORM id FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCOUNT_UNAVAILABLE','status',403); END IF;
 SELECT * INTO c FROM public."HomePostcardVerificationCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
   IF c.home_id<>p_home_id OR c.postcard_id<>p_postcard_id OR (c.intent_hash IS NOT NULL AND c.intent_hash<>intent) THEN
     RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_CONFLICT','status',409); END IF;
   -- Historical result only. No replay renews dates, spends another guess,
   -- restores membership, resets a challenge window or rechecks private Home data.
   RETURN public.home_postcard_verification_projection(c)||jsonb_build_object('replayed',true);
 END IF;
 INSERT INTO public."HomePostcardVerificationCommand"(actor_user_id,request_id,home_id,postcard_id,intent_hash,state)
   VALUES(p_actor_id,p_request_id,p_home_id,p_postcard_id,intent,'pending') RETURNING * INTO c;
 <<validate_code>>
 BEGIN
   IF NOT public.lock_home_postcard_current_scope(p_home_id,p_actor_id) THEN
     code:='HOME_NOT_FOUND';status:=404;EXIT validate_code; END IF;
   t:=clock_timestamp();
   SELECT * INTO p FROM public."HomePostcardCode" WHERE id=p_postcard_id AND home_id=p_home_id AND user_id=p_actor_id;
   IF NOT FOUND THEN code:='POSTCARD_NO_LONGER_AVAILABLE';status:=404;EXIT validate_code; END IF;
   context:=public.home_postcard_current_context(p_home_id,p_actor_id,true);
   IF context->>'ok' IS DISTINCT FROM 'true' THEN code:=context->>'code';status:=(context->>'status')::integer;EXIT validate_code; END IF;
   SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
   IF p.destination IS DISTINCT FROM jsonb_build_object('address',h.address,'address2',h.address2,'city',h.city,'state',h.state,'zipcode',h.zipcode)
     OR coalesce(h.country,'US')<>'US' THEN
     code:='POSTCARD_ADDRESS_CHANGED';status:=409;EXIT validate_code; END IF;
   SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
   SELECT * INTO r FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_actor_id;
   age:=(context->>'age_band')::public.home_age_band;
   IF p.status='verified' THEN
     IF p.code_hash IS DISTINCT FROM p_submitted_hash OR o.verification_status NOT IN ('verified','provisional') OR p.verified_at IS NULL THEN
       code:='POSTCARD_NO_LONGER_AVAILABLE';status:=409;EXIT validate_code; END IF;
     v_existing:=true;v_status:=o.verification_status;v_recorded:=p.verified_at;
     v_challenge:=CASE WHEN v_status='provisional' THEN o.challenge_window_ends_at END;
     EXIT validate_code;
   END IF;
   IF p.attempts>=5 THEN code:='POSTCARD_LOCKED';status:=429;EXIT validate_code; END IF;
   IF p.status='expired' OR p.expires_at<=t THEN code:='POSTCARD_EXPIRED';status:=410;EXIT validate_code; END IF;
   IF p.status<>'pending' OR p.dispatch_status='rejected' THEN code:='POSTCARD_NO_LONGER_AVAILABLE';status:=409;EXIT validate_code; END IF;
   IF p.dispatch_status='pending' AND EXISTS(SELECT FROM public."HomePostcardRequestCommand"
     WHERE home_id=p_home_id AND actor_user_id=p_actor_id AND postcard_id=p.id AND code_key_id IS NOT NULL) THEN
     code:='POSTCARD_NOT_DISPATCHED';status:=409;EXIT validate_code; END IF;
   IF p.code_hash IS DISTINCT FROM p_submitted_hash THEN
     remaining:=4-p.attempts;
     UPDATE public."HomePostcardCode" SET attempts=attempts+1,
       status=CASE WHEN attempts+1>=5 THEN 'expired' ELSE public."HomePostcardCode".status END,updated_at=t WHERE id=p.id;
     code:='POSTCARD_WRONG_CODE';status:=400;EXIT validate_code;
   END IF;
   IF context->>'dispute'='true' THEN
     -- Home claims PR 4: the household turned this probationer down, so proof doesn't bring them back. It opens a
     -- dispute in the Pantopus review queue (AddressReviewCase, trigger probation_dispute) and the household's no
     -- stands until Pantopus decides. The code is used up and the membership is left exactly as it is.
     UPDATE public."HomePostcardCode" SET status='verified',verified_at=t,attempts=attempts+1,updated_at=t WHERE id=p.id;
     INSERT INTO public."AddressReviewCase"(home_id,user_id,verdict_status,reasons,trigger,status)
       VALUES(p_home_id,p_actor_id,'PROBATION_DISPUTED',jsonb_build_array(jsonb_build_object('code','PROBATION_DISPUTED',
         'claim_id',r.id,'postcard_id',p.id)),'probation_dispute','open') RETURNING id INTO v_case;
     INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
       VALUES(p_home_id,p_actor_id,'RESIDENCY_PROBATION_DISPUTED','HomeOccupancy',o.id,
         jsonb_build_object('postcard_id',p.id,'request_id',p_request_id,'review_case_id',v_case));
     code:='POSTCARD_DISPUTE_RECORDED';status:=409;EXIT validate_code;
   END IF;
   IF o.verification_status='provisional' AND o.verification_source='probation' THEN
     -- Home claims PR 4: proof during probation starts the postcard review a newcomer at a Home with reviewers
     -- gets, from now (source 'address' below). The existing promotion completes it after the window, and a
     -- reviewer can still challenge in it.
     v_status:='provisional';v_challenge:=t+interval '7 days';
     UPDATE public."HomeOccupancy" SET age_band=age,challenge_window_started_at=t,challenge_window_ends_at=v_challenge,
       updated_at=t WHERE id=o.id;
   ELSIF o.verification_status IN ('verified','provisional') THEN
     -- Independent membership/review already exists. Consume only the code;
     -- preserve its age, role, dates, challenge and every permission projection.
     v_status:=o.verification_status;
     v_challenge:=CASE WHEN v_status='provisional' THEN o.challenge_window_ends_at END;
   ELSE
     -- A partial/old challenge cannot be silently restarted by another card.
     IF o.challenge_window_started_at IS NOT NULL OR o.challenge_window_ends_at IS NOT NULL THEN
       code:='POSTCARD_ACCESS_REVIEW_REQUIRED';status:=409;EXIT validate_code; END IF;
     IF context->>'has_authorities'='true' THEN
       v_status:='provisional';v_challenge:=t+interval '7 days';
       UPDATE public."HomeOccupancy" SET role_base='restricted_member',age_band=age,
         verification_status='provisional',verification_source='address',can_manage_home=false,can_manage_access=false,can_manage_finance=false,
         can_manage_tasks=false,can_view_sensitive=false,challenge_window_started_at=t,challenge_window_ends_at=v_challenge,
         updated_at=t WHERE id=o.id;
     ELSE
       policy:=public.home_postcard_verified_policy(p_home_id,p_actor_id,age);
       IF policy->>'ok' IS DISTINCT FROM 'true' THEN code:=policy->>'code';status:=(policy->>'status')::integer;EXIT validate_code; END IF;
       v_status:='verified';
       UPDATE public."HomeOccupancy" SET role=policy->>'role_base',role_base=(policy->>'role_base')::public.home_role_base,
         age_band=age,verification_status='verified',verification_source='address',verified_at=t,verification_expires_at=t+make_interval(days=>p_validity_days),
         can_manage_home=policy->'permissions' ? 'home.edit',
         can_manage_access=policy->'permissions' ?| ARRAY['access.manage','members.manage'],
         can_manage_finance=policy->'permissions' ? 'finance.manage',
         can_manage_tasks=policy->'permissions' ?| ARRAY['tasks.edit','tasks.manage'],
         can_view_sensitive=policy->'permissions' ? 'sensitive.view',updated_at=t WHERE id=o.id;
       UPDATE public."Home" SET vacancy_at=NULL,updated_at=t WHERE id=p_home_id AND vacancy_at IS NOT NULL;
     END IF;
   END IF;
   v_recorded:=t;
   UPDATE public."HomePostcardCode" SET status='verified',verified_at=t,attempts=attempts+1,updated_at=t WHERE id=p.id;
   -- Address proof during a challenge is not a household decision. Keep the
   -- pending claim reviewable by a current authority until review/promotion.
   IF r.id IS NOT NULL AND r.status='pending' AND v_status='verified' THEN
     UPDATE public."HomeResidencyClaim" SET status='verified',review_note='Verified via postcard code',reviewed_at=t,updated_at=t WHERE id=r.id;
   END IF;
 END validate_code;
 IF code IS NOT NULL THEN
   UPDATE public."HomePostcardVerificationCommand" SET state='rejected',error_code=code,error_status=status,
     attempts_remaining=remaining,updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
   RETURN public.home_postcard_verification_projection(c)||jsonb_build_object('replayed',false);
 END IF;
 -- A separately proved postcard upgrades provenance without renewing
 -- membership, role, dates, challenge or permissions.
 UPDATE public."HomeOccupancy" SET verification_source='address' WHERE id=o.id AND verification_source IS DISTINCT FROM 'address';
 IF NOT v_existing THEN
   INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
     VALUES(p_home_id,p_actor_id,'POSTCARD_CODE_VERIFIED','HomePostcardCode',p.id,
       jsonb_build_object('request_id',p_request_id,'verification_status',v_status,'challenge_window_ends_at',v_challenge));
 END IF;
 UPDATE public."HomePostcardVerificationCommand" SET state='completed',verification_status=v_status,
   recorded_at=v_recorded,challenge_window_ends_at=v_challenge,updated_at=clock_timestamp()
   WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
 RETURN public.home_postcard_verification_projection(c)||jsonb_build_object('replayed',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.home_postcard_current_context(p_home_id uuid,p_actor_id uuid,p_confirmation boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  r public."HomeResidencyClaim"%ROWTYPE; u public."User"%ROWTYPE;
  t timestamptz:=clock_timestamp(); v_role text; v_age public.home_age_band;
  v_authorities boolean; v_dispute boolean;
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
  -- A pending ownership claim no longer blocks address proof (founder decision,
  -- 2026-10-06): the claimant can verify they live here while the claim waits.
  -- Verified, disputed and revoked ownership still uses the ownership flow.
  IF h.owner_id=p_actor_id OR v_role IN ('owner','admin','manager','property_manager')
    OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id
      AND owner_status IS DISTINCT FROM 'pending') THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409); END IF;
  -- Home claims PR 4: a probationer the household turned down (a reviewer's no, or a challenge in the window) can't
  -- come back by asking again. Proof of the address is their way back, and it becomes a dispute in the Pantopus
  -- review queue (verify_home_postcard_current) instead of restoring access, one open dispute at a time.
  v_dispute:=coalesce(o.is_active IS FALSE AND o.verification_status='suspended_challenged'
    AND o.verification_source='probation',false);
  IF v_role IS NULL OR v_role NOT IN ('member','lease_resident','restricted_member')
    OR (o.is_active IS DISTINCT FROM true AND NOT v_dispute) OR o.end_at IS NOT NULL
    OR o.start_at>t OR o.access_start_at>t OR o.access_end_at<=t
    OR o.verification_status IS NULL OR (o.verification_status NOT IN
      ('verified','unverified','pending','pending_approval','pending_doc','pending_postcard','provisional_bootstrap','provisional')
      AND NOT v_dispute)
    OR (r.status='rejected' AND NOT v_dispute) THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
  -- Only this probation's disputes count (its challenge window started when it began). Pantopus's rejection is final.
  IF v_dispute AND EXISTS(SELECT FROM public."AddressReviewCase" WHERE home_id=p_home_id AND user_id=p_actor_id
      AND trigger='probation_dispute' AND status IN ('open','in_review')
      AND created_at>=coalesce(o.challenge_window_started_at,'-infinity')) THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_DISPUTE_IN_REVIEW','status',409); END IF;
  IF v_dispute AND EXISTS(SELECT FROM public."AddressReviewCase" WHERE home_id=p_home_id AND user_id=p_actor_id
      AND trigger='probation_dispute' AND status='rejected' AND created_at>=coalesce(o.challenge_window_started_at,'-infinity')) THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_DISPUTE_DECLINED','status',409); END IF;
  -- Household consent (an accepted invitation or a household-reviewed claim)
  -- is not address proof (F3b), so it must not block the postcard that adds it.
  -- Neither is an instant claim at an address with no household ('claim'), nor probation (home claims PR 4):
  -- proving the address is one of the ways out of it.
  IF NOT p_confirmation AND o.verification_source NOT IN ('household','claim','probation')
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
    'already_verified',o.verification_status='verified','occupancy_id',o.id,'claim_id',r.id,'dispute',v_dispute);
END;
$$;

-- Pantopus decides a probation dispute (backend/routes/adminAddressReview.js -> homeProbationDisputeService; founder
-- decision 2026-10-26: approving restores the membership). Approved: the person proved the address and Pantopus
-- sides with them, so they come back as a resident verified by mail (source 'address', the role and permissions a
-- postcard proof gives: home_postcard_verified_policy) and their request is marked verified; if their membership or
-- the Home changed meanwhile, or the proof no longer matches the address, nothing changes
-- (PROBATION_DISPUTE_CHANGED) and the case stays open to reject or dismiss. Rejected: the household's no stands
-- and is final (home_postcard_current_context refuses another dispute postcard in this probation). Dismissed:
-- closed without a decision; they can send proof again. Returns who to tell; audit rows have no actor.
CREATE FUNCTION public.resolve_home_probation_dispute(p_case_id uuid,p_reviewer_id uuid,p_outcome text,p_note text,
  p_validity_days integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."AddressReviewCase"%ROWTYPE; h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  p public."HomePostcardCode"%ROWTYPE; u public."User"%ROWTYPE; t timestamptz; v_disputed boolean;
  v_postcard uuid; v_age public.home_age_band; policy jsonb; v_reviewers uuid[];
BEGIN
  IF p_case_id IS NULL OR p_reviewer_id IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('approved','rejected','dismissed')
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
    RETURN '{"ok":false,"code":"PROBATION_DISPUTE_INVALID","status":400}'::jsonb; END IF;
  SELECT * INTO c FROM public."AddressReviewCase" WHERE id=p_case_id;
  IF NOT FOUND OR c.trigger IS DISTINCT FROM 'probation_dispute' OR c.home_id IS NULL OR c.user_id IS NULL THEN
    RETURN '{"ok":true,"handled":false}'::jsonb; END IF;
  -- The membership lock order every residency decision takes, then the case.
  IF NOT public.lock_home_residency_review_scope(c.home_id) THEN
    RETURN '{"ok":false,"code":"PROBATION_DISPUTE_CHANGED","status":409}'::jsonb; END IF;
  SELECT * INTO c FROM public."AddressReviewCase" WHERE id=p_case_id FOR UPDATE;
  IF c.status NOT IN ('open','in_review') THEN
    RETURN '{"ok":false,"code":"REVIEW_CASE_RESOLVED","status":409}'::jsonb; END IF;
  t:=clock_timestamp();
  SELECT * INTO h FROM public."Home" WHERE id=c.home_id;
  SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=c.home_id AND user_id=c.user_id;
  SELECT * INTO u FROM public."User" WHERE id=c.user_id;
  v_disputed:=coalesce(o.is_active IS FALSE AND o.verification_status='suspended_challenged'
    AND o.verification_source='probation' AND o.end_at IS NULL,false);
  IF p_outcome='approved' THEN
    SELECT (e->>'postcard_id')::uuid INTO v_postcard FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.reasons)='array'
      THEN c.reasons ELSE '[]'::jsonb END) e WHERE e->>'code'='PROBATION_DISPUTED' AND e->>'postcard_id' ~ '^[0-9a-f-]{36}$' LIMIT 1;
    SELECT * INTO p FROM public."HomePostcardCode" WHERE id=v_postcard AND home_id=c.home_id AND user_id=c.user_id;
    IF NOT v_disputed OR u.id IS NULL OR o.start_at>t OR o.access_start_at>t OR o.access_end_at<=t
      OR coalesce(o.role_base::text,'') NOT IN ('member','lease_resident','restricted_member')
      OR h.security_state IN ('frozen','frozen_silent','disputed') OR h.home_status IN ('archived','merged')
      OR h.owner_id=c.user_id OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=c.home_id AND subject_type='user'
        AND subject_id=c.user_id)
      OR p.id IS NULL OR p.status IS DISTINCT FROM 'verified' OR coalesce(h.country,'US')<>'US'
      OR p.destination IS DISTINCT FROM jsonb_build_object('address',h.address,'address2',h.address2,'city',h.city,
        'state',h.state,'zipcode',h.zipcode) THEN
      RETURN '{"ok":false,"code":"PROBATION_DISPUTE_CHANGED","status":409}'::jsonb; END IF;
    -- The age band a postcard proof would set (home_postcard_current_context): a stricter saved band stays.
    v_age:=o.age_band;
    IF u.date_of_birth>(t AT TIME ZONE 'UTC')::date-interval '13 years' THEN v_age:='child';
    ELSIF u.date_of_birth>(t AT TIME ZONE 'UTC')::date-interval '18 years' AND v_age IS DISTINCT FROM 'child' THEN v_age:='teen'; END IF;
    policy:=public.home_postcard_verified_policy(c.home_id,c.user_id,v_age);
    IF policy->>'ok' IS DISTINCT FROM 'true' THEN
      RETURN '{"ok":false,"code":"PROBATION_DISPUTE_CHANGED","status":409}'::jsonb; END IF;
  END IF;
  UPDATE public."AddressReviewCase" SET status=p_outcome,resolved_by=p_reviewer_id,resolved_at=t,resolution_note=p_note,
    updated_at=t WHERE id=c.id;
  IF p_outcome='approved' THEN
    UPDATE public."HomeOccupancy" SET is_active=true,role=policy->>'role_base',role_base=(policy->>'role_base')::public.home_role_base,
      age_band=v_age,verification_status='verified',verification_source='address',verified_at=t,
      verification_expires_at=t+make_interval(days=>p_validity_days),
      can_manage_home=policy->'permissions' ? 'home.edit',can_manage_access=policy->'permissions' ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=policy->'permissions' ? 'finance.manage',can_manage_tasks=policy->'permissions' ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=policy->'permissions' ? 'sensitive.view',updated_at=t WHERE id=o.id;
    UPDATE public."HomeResidencyClaim" SET status='verified',reviewed_by=NULL,reviewed_at=t,
      review_note='Verified by mail; Pantopus review restored this membership',updated_at=t
      WHERE home_id=c.home_id AND user_id=c.user_id;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=t WHERE id=c.home_id AND vacancy_at IS NOT NULL;
    SELECT coalesce(array_agg(candidate ORDER BY candidate),'{}'::uuid[]) INTO v_reviewers FROM (
      SELECT user_id AS candidate FROM public."HomeOccupancy" WHERE home_id=c.home_id
      UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=c.home_id AND subject_type='user'
      UNION SELECT h.owner_id
    ) x WHERE candidate IS NOT NULL AND candidate<>c.user_id AND public.home_residency_review_authority(c.home_id,candidate);
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(c.home_id,NULL,CASE p_outcome WHEN 'approved' THEN 'RESIDENCY_PROBATION_DISPUTE_UPHELD'
      WHEN 'rejected' THEN 'RESIDENCY_PROBATION_DISPUTE_DECLINED' ELSE 'RESIDENCY_PROBATION_DISPUTE_DISMISSED' END,
      'AddressReviewCase',c.id,jsonb_build_object('user_id',c.user_id,'reviewed',true,
        'role_base',CASE WHEN p_outcome='approved' THEN policy->>'role_base' END));
  RETURN jsonb_build_object('ok',true,'handled',true,'home_id',c.home_id,'user_id',c.user_id,
    'outcome',CASE WHEN p_outcome='approved' THEN 'restored' WHEN p_outcome='rejected' AND v_disputed THEN 'declined'
      WHEN p_outcome='rejected' THEN 'moot' ELSE 'dismissed' END,
    'home_label',coalesce(h.name,h.address,'your home'),'reviewer_ids',to_jsonb(coalesce(v_reviewers,'{}'::uuid[])));
END $$;
REVOKE ALL ON FUNCTION public.resolve_home_probation_dispute(uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_home_probation_dispute(uuid,uuid,text,text,integer) TO service_role;

-- Home claims PR 4: the reviewer's view of the requester's access now says where it came from, so a review of
-- someone on probation can say that a no ends their membership.
CREATE OR REPLACE FUNCTION public.home_residency_review_current(c public."HomeResidencyClaim") RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('claim',jsonb_build_object('id',c.id,'home_id',c.home_id,'user_id',c.user_id,
    'status',c.status,'claimed_role',c.claimed_role,'claimed_address',c.claimed_address,
    'reviewed_by',c.reviewed_by,'reviewed_at',c.reviewed_at,'review_note',c.review_note,
    'created_at',c.created_at,'updated_at',c.updated_at,'review_token',public.home_residency_review_snapshot(c)),
    'occupancy',(SELECT jsonb_build_object('id',o.id,'user_id',o.user_id,'role',o.role,'role_base',o.role_base,
      'age_band',o.age_band,'is_active',o.is_active,'verification_status',o.verification_status,
      'verification_source',o.verification_source,
      'start_at',o.start_at,'end_at',o.end_at,'access_start_at',o.access_start_at,'access_end_at',o.access_end_at,
      'verified_at',o.verified_at,'verification_expires_at',o.verification_expires_at)
      FROM public."HomeOccupancy" o WHERE home_id=c.home_id AND user_id=c.user_id));
$$;
-- The replaced functions keep their service-only grants; restated here.
REVOKE ALL ON FUNCTION public.review_home_residency(uuid,uuid,text,jsonb,integer),
  public.verify_home_postcard_current(uuid,uuid,uuid,uuid,text,integer),
  public.home_postcard_current_context(uuid,uuid,boolean),
  public.home_residency_review_current(public."HomeResidencyClaim") FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_home_residency(uuid,uuid,text,jsonb,integer),
  public.verify_home_postcard_current(uuid,uuid,uuid,uuid,text,integer),
  public.home_postcard_current_context(uuid,uuid,boolean),
  public.home_residency_review_current(public."HomeResidencyClaim") TO service_role;
