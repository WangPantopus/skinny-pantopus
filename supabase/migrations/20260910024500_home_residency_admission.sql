-- Backwards compatible: yes. Existing manager attach and residency-review APIs
-- retain their response shapes; stale/reactivated authority now needs a separate
-- lifecycle flow. No role defaults or existing membership rows are migrated.
SET LOCAL lock_timeout = '5s';

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."HomeResidencyClaim" FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.review_home_residency(
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
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,'residency_claim_rejected','HomeResidencyClaim',v_claim_id,
        jsonb_build_object('user_id',v_target_id));
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
      'pending_doc','pending_postcard','provisional_bootstrap')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL)) THEN
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
        WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
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
        verification_status='verified',verified_at=v_now,
        verification_expires_at=v_now+make_interval(days=>p_validity_days),updated_at=v_now
        WHERE id=v_target.id RETURNING * INTO v_target;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,
        start_at,added_by_user_id,verification_status,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
      VALUES(p_home_id,v_target_id,v_role::text,v_role,NULL,true,now(),p_actor_id,'verified',v_now,
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
REVOKE ALL ON FUNCTION public.review_home_residency(uuid,uuid,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_home_residency(uuid,uuid,text,jsonb,integer) TO service_role;
