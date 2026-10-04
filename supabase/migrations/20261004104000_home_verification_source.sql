-- Backwards compatible: yes. Adds provenance to existing occupancy rows and
-- an optional task-update result key; old clients and household permissions
-- keep their current contract. Apply before the matching backend source gates.
-- Founder pilot WP6, reserved version 20261004104000. Applied history is immutable;
-- the latest permitted functions below are retained with only provenance writes
-- and the existing task wrapper's atomic transition result. No new table/outbox.
-- Held 20260926100000 source is excluded; this is not an applied-definition audit.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."HomeOccupancy" ADD COLUMN verification_source text NOT NULL DEFAULT 'legacy'
  CHECK (verification_source IN ('address','household','legacy'));
COMMENT ON COLUMN public."HomeOccupancy".verification_source IS
  'Origin of residency trust: address proof, household consent, or retained legacy verification. Status/access/expiry still apply.';

-- Provenance alone does not change membership authority or retire an existing
-- lease/removal receipt. Preserve the original trigger, excluding only this field.
-- Latest permitted source: supabase/migrations/20260913010000_home_member_removal_recovery.sql:9
CREATE OR REPLACE FUNCTION public.version_home_membership() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.membership_version:=gen_random_uuid();
  ELSIF (to_jsonb(NEW)-ARRAY['membership_version','updated_at','density_milestone_seen','verification_source'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['membership_version','updated_at','density_milestone_seen','verification_source']) THEN
    NEW.membership_version:=gen_random_uuid();
  ELSE NEW.membership_version:=OLD.membership_version;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.version_home_membership() FROM PUBLIC,anon,authenticated;

-- Latest permitted trigger: application_baseline.sql:25037. Keep all original
-- timestamp behavior except a change to provenance alone. No global helper edit.
DROP TRIGGER trg_homeocc_updated_at ON public."HomeOccupancy";
CREATE TRIGGER trg_homeocc_updated_at BEFORE UPDATE ON public."HomeOccupancy" FOR EACH ROW
  WHEN (OLD.verification_source IS NOT DISTINCT FROM NEW.verification_source
    OR (to_jsonb(OLD)-'verification_source') IS DISTINCT FROM (to_jsonb(NEW)-'verification_source'))
  EXECUTE FUNCTION public.touch_updated_at();

-- Address proof wins. Every proof/admission is bound to this same Home and user;
-- an ID check, a different household's evidence or a mutable email is not proof.
WITH occupancy_sources AS (
 SELECT o.id,CASE
  WHEN EXISTS(SELECT FROM public."HomePostcardCode" p WHERE p.home_id=o.home_id AND p.user_id=o.user_id
    AND p.status='verified' AND p.verified_at IS NOT NULL)
    OR EXISTS(SELECT FROM public."HomeOwnershipClaim" c WHERE c.home_id=o.home_id AND c.claimant_user_id=o.user_id
      AND c.state='approved' AND (
        EXISTS(SELECT FROM public."HomeClaimReviewReceipt" r WHERE r.home_id=c.home_id AND r.claim_id=c.id
          AND r.action='approve' AND r.result->>'ok'='true')
        OR (c.reviewed_by IS NOT NULL AND EXISTS(SELECT FROM public."HomeVerificationEvidence" e WHERE e.claim_id=c.id
          AND e.status='verified' AND e.evidence_type IN ('deed','closing_disclosure','tax_bill','utility_bill','lease','escrow_attestation','title_match')))))
    OR EXISTS(SELECT FROM public."HomeLease" l WHERE l.home_id=o.home_id AND l.approved_by_subject_id IS NOT NULL
      AND l.state IN ('active','ended') AND (l.primary_resident_user_id=o.user_id
        OR EXISTS(SELECT FROM public."HomeLeaseResident" lr WHERE lr.lease_id=l.id AND lr.user_id=o.user_id)))
    OR EXISTS(SELECT FROM public."MailVerificationJob" j JOIN public."AddressVerificationAttempt" a ON a.id=j.attempt_id
      WHERE a.user_id=o.user_id AND a.method='mail_code' AND a.status='verified'
        AND j.metadata->>'confirmed_home_id'=o.home_id::text AND j.metadata->>'confirmed_occupancy_id'=o.id::text)
    THEN 'address'
  WHEN EXISTS(SELECT FROM public."HomeInvite" i WHERE i.home_id=o.home_id AND i.status='accepted'
      AND (i.accepted_by_user_id=o.user_id OR (i.accepted_by_user_id IS NULL AND i.invitee_user_id=o.user_id)))
    OR EXISTS(SELECT FROM public."HomeResidencyClaim" r WHERE r.home_id=o.home_id AND r.user_id=o.user_id
      AND r.status='verified' AND r.reviewed_by IS NOT NULL) THEN 'household'
  ELSE 'legacy' END AS source
 FROM public."HomeOccupancy" o
)
UPDATE public."HomeOccupancy" o SET verification_source=s.source
 FROM occupancy_sources s WHERE o.id=s.id AND o.verification_source IS DISTINCT FROM s.source;

-- Latest permitted source: supabase/migrations/20260912040000_home_invitation_sender_recovery.sql:278
CREATE OR REPLACE FUNCTION public.act_on_home_invitation(p_invite_id uuid,p_token text,p_actor_id uuid,
  p_action text,p_validity_days integer DEFAULT 365) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_invite public."HomeInvite"%ROWTYPE; v_home public."Home"%ROWTYPE;
  v_occupancy public."HomeOccupancy"%ROWTYPE; v_inviter public."User"%ROWTYPE;
  v_policy jsonb; v_target_policy jsonb; v_permissions jsonb; v_hash text; v_count integer;
  v_now timestamptz; v_recipient boolean; v_open boolean; v_permission public.home_permission;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('preview','accept','decline')
    OR (p_invite_id IS NULL)=(p_token IS NULL) OR (p_action<>'preview' AND p_actor_id IS NULL)
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 OR length(p_token)>512 THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_INVALID','status',400); END IF;
  IF p_token IS NOT NULL THEN v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex'); END IF;
  SELECT count(*) INTO v_count FROM public."HomeInvite" WHERE
    (p_invite_id IS NOT NULL AND id=p_invite_id) OR (p_token IS NOT NULL AND
      (token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash)));
  IF v_count=0 THEN RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  IF v_count<>1 THEN RETURN jsonb_build_object('ok',false,'code','INVITE_UNAVAILABLE','status',503); END IF;
  SELECT * INTO v_invite FROM public."HomeInvite" WHERE
    (p_invite_id IS NOT NULL AND id=p_invite_id) OR (p_token IS NOT NULL AND
      (token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash)));
  IF NOT public.lock_home_invitation_scope(v_invite.home_id) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  -- Recheck the exact token after locking, including legacy hash-null fallback.
  SELECT * INTO v_invite FROM public."HomeInvite" WHERE id=v_invite.id AND
    (p_token IS NULL OR token_hash=v_hash OR (token_hash IS NULL AND token=p_token) OR id IN (SELECT invitation_id FROM public."HomeInvitationCapability" WHERE token_hash=v_hash));
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','INVITE_NOT_FOUND','status',404); END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=v_invite.home_id;
  -- Serialize confirmation/email changes with email-bound redemption. The
  -- application never substitutes a mutable public-profile email here.
  IF v_invite.invitee_user_id IS NULL AND v_invite.invitee_email IS NOT NULL AND p_actor_id IS NOT NULL THEN
    PERFORM id FROM auth.users WHERE id=p_actor_id FOR SHARE;
  END IF;
  v_now:=clock_timestamp();
  v_recipient:=public.home_invite_is_recipient(v_invite,p_actor_id);
  v_open:=v_invite.is_open_invite IS TRUE AND v_invite.invitee_user_id IS NULL AND v_invite.invitee_email IS NULL;
  IF p_action='decline' THEN
    IF NOT coalesce(v_recipient,false)
      AND public.home_invite_authority(v_invite.home_id,p_actor_id) IS NULL THEN
      -- Declining an open link is this viewer's decision, not authority to
      -- revoke the invitation for every other potential recipient.
      IF v_open AND p_token IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
      RETURN jsonb_build_object('ok',false,'code','INVITE_EMAIL_MISMATCH','status',403); END IF;
    IF v_invite.status='revoked' THEN RETURN jsonb_build_object('ok',true,'replayed',true); END IF;
    IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
    UPDATE public."HomeInvite" SET status='revoked' WHERE id=v_invite.id;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(v_invite.home_id,p_actor_id,'HOME_INVITE_REVOKED','HomeInvite',v_invite.id,'{}');
    RETURN jsonb_build_object('ok',true,'replayed',false);
  END IF;
  IF p_action='accept' AND NOT coalesce(v_recipient,false) AND NOT (v_open AND p_token IS NOT NULL) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_EMAIL_MISMATCH','status',403); END IF;
  IF p_action='preview' AND (v_invite.status<>'pending' OR v_invite.expires_at<=v_now) THEN
    RETURN jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',v_invite.id,
      'status',CASE WHEN v_invite.status='pending' THEN 'expired' ELSE v_invite.status END),
      'expired',v_invite.status='expired' OR (v_invite.status='pending' AND v_invite.expires_at<=v_now),
      'alreadyUsed',v_invite.status='accepted'); END IF;
  IF p_action='accept' AND v_invite.status='accepted' THEN
    -- A committed admission is independent of its former inviter. An exact
    -- winner retry may return only their current occupancy, never reapply it.
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    IF v_invite.accepted_by_user_id=p_actor_id AND v_occupancy.is_active IS TRUE
      AND v_occupancy.verification_status='verified'
      AND coalesce(v_occupancy.role_base,public.home_invite_role(v_occupancy.role)) IS NOT NULL
      AND (v_occupancy.end_at IS NULL OR v_occupancy.end_at>v_now)
      AND (v_occupancy.access_end_at IS NULL OR v_occupancy.access_end_at>v_now) THEN
      RETURN jsonb_build_object('ok',true,'replayed',true,'homeId',v_invite.home_id,'occupancy',to_jsonb(v_occupancy)); END IF;
    RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409);
  END IF;
  IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
  IF v_invite.expires_at<=v_now THEN RETURN jsonb_build_object('ok',false,'code','INVITE_EXPIRED','status',410); END IF;
  IF public.home_invite_authority(v_invite.home_id,v_invite.invited_by) IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','INVITER_ACCESS_CHANGED','status',403); END IF;
  IF p_action='preview' THEN
    SELECT * INTO v_inviter FROM public."User" WHERE id=v_invite.invited_by;
    RETURN jsonb_build_object('ok',true,'invitation',jsonb_build_object('id',v_invite.id,'status',v_invite.status,
      'proposed_role',v_invite.proposed_role,'invitee_email',v_invite.invitee_email,'invitee_user_id',v_invite.invitee_user_id,
      'created_at',v_invite.created_at,'expires_at',v_invite.expires_at,
      'access_start_at',v_invite.access_start_at,'access_end_at',v_invite.access_end_at),
      'home',jsonb_build_object('id',v_home.id,'name',coalesce(v_home.name,'A Home'),
        'city',concat_ws(', ',v_home.city,v_home.state),'home_type',v_home.home_type),
      'inviter',jsonb_build_object('name',coalesce(v_inviter.name,v_inviter.first_name,v_inviter.username,'Someone'),
        'username',v_inviter.username,'profilePicture',v_inviter.profile_picture_url));
  END IF;
  IF p_actor_id=v_invite.invited_by THEN
    RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
  IF v_invite.proposed_preset_key LIKE 'claim_merge:%' THEN
    -- Dedicated ownership enrollment remains a distinct service. Never let a
    -- disabled feature flag fall through to ordinary owner-template creation.
    RETURN jsonb_build_object('ok',true,'kind','claim_merge','invitation',to_jsonb(v_invite)); END IF;
  IF v_invite.source_request_id IS NOT NULL AND NOT EXISTS(
    SELECT FROM public."HomeHouseholdAccessRequest" WHERE id=v_invite.source_request_id
      AND home_id=v_invite.home_id AND requester_user_id=p_actor_id AND status='approved'
      AND resolved_by=v_invite.invited_by
      AND CASE requested_identity WHEN 'resident' THEN 'lease_resident' WHEN 'guest' THEN 'guest'
        WHEN 'household_member' THEN 'member' ELSE 'owner' END=v_invite.proposed_role_base::text) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_SOURCE_CHANGED','status',409); END IF;
  v_policy:=public.home_invite_policy(coalesce(v_invite.proposed_role_base::text,v_invite.proposed_role),
    CASE WHEN v_invite.proposed_preset_key LIKE 'access_request:%' THEN NULL ELSE v_invite.proposed_preset_key END);
  IF v_policy IS NULL OR (v_invite.admission_policy IS NOT NULL AND v_invite.admission_policy IS DISTINCT FROM v_policy) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_POLICY_CHANGED','status',409); END IF;
  v_target_policy:=public.home_invite_target_policy(v_invite.home_id,v_invite.invited_by,p_actor_id,
    v_policy,v_invite.access_start_at,v_invite.access_end_at);
  IF v_target_policy->>'ok'<>'true' THEN RETURN v_target_policy; END IF;
  IF v_target_policy->>'existing_verified'='true' THEN
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
  ELSE
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    IF FOUND THEN
      UPDATE public."HomeOccupancy" SET role=v_policy->>'role_base',role_base=(v_policy->>'role_base')::public.home_role_base,
        age_band=(v_target_policy->>'age_band')::public.home_age_band,
        access_start_at=(v_target_policy->>'access_start_at')::timestamptz,
        access_end_at=(v_target_policy->>'access_end_at')::timestamptz,
        verification_status='verified',verification_source=CASE WHEN verification_source='address' OR (verification_status='verified' AND verification_source='legacy') THEN verification_source ELSE 'household' END,verified_at=v_now,verification_expires_at=v_now+make_interval(days=>p_validity_days),
        updated_at=v_now WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,
        access_start_at,access_end_at,added_by_user_id,verification_status,verification_source,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
        VALUES(v_invite.home_id,p_actor_id,v_policy->>'role_base',(v_policy->>'role_base')::public.home_role_base,
          (v_target_policy->>'age_band')::public.home_age_band,true,now(),
          (v_target_policy->>'access_start_at')::timestamptz,(v_target_policy->>'access_end_at')::timestamptz,
          v_invite.invited_by,'verified','household',v_now,v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
        RETURNING * INTO v_occupancy;
    END IF;
    FOR v_permission IN SELECT jsonb_array_elements_text(v_policy->'grant_perms')::public.home_permission LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(v_invite.home_id,p_actor_id,v_permission,true,v_invite.invited_by)
        ON CONFLICT(home_id,user_id,permission) DO NOTHING;
    END LOOP;
    FOR v_permission IN SELECT jsonb_array_elements_text(v_policy->'deny_perms')::public.home_permission LOOP
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed,created_by)
        VALUES(v_invite.home_id,p_actor_id,v_permission,false,v_invite.invited_by)
        ON CONFLICT(home_id,user_id,permission) DO UPDATE SET allowed=false,created_by=v_invite.invited_by,updated_at=v_now;
    END LOOP;
    v_permissions:=CASE WHEN (v_occupancy.start_at IS NULL OR v_occupancy.start_at<=v_now)
      AND (v_occupancy.access_start_at IS NULL OR v_occupancy.access_start_at<=v_now)
      THEN v_target_policy->'permissions' ELSE '[]'::jsonb END;
    UPDATE public."HomeOccupancy" SET can_manage_home=v_permissions ? 'home.edit',
      can_manage_access=v_permissions ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=v_permissions ? 'finance.manage',can_manage_tasks=v_permissions ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=v_permissions ? 'sensitive.view' WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=v_invite.home_id AND vacancy_at IS NOT NULL;
  END IF;
  UPDATE public."HomeInvite" SET status='accepted',accepted_by_user_id=p_actor_id,accepted_at=v_now WHERE id=v_invite.id;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(v_invite.home_id,p_actor_id,'HOME_INVITE_ACCEPTED','HomeInvite',v_invite.id,
      jsonb_build_object('inviter_id',v_invite.invited_by,'occupancy_id',v_occupancy.id));
  RETURN jsonb_build_object('ok',true,'replayed',false,'homeId',v_invite.home_id,'occupancy',to_jsonb(v_occupancy),
    'inviter_id',v_invite.invited_by,'home_label',coalesce(v_home.name,'A home'));
END $$;

-- Latest permitted source: supabase/migrations/20260912060000_home_residency_legacy_compatibility.sql:272
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
      'pending_doc','pending_postcard','provisional_bootstrap','provisional')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL)) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409);
  END IF;
  -- A recorded postal code leaves the claim pending during household review.
  -- Admit only that coherent provisional window, never a stale/partial grant.
  IF v_has_target AND v_target.verification_status='provisional' AND (
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

-- Latest permitted source: supabase/migrations/20260910045000_home_claim_merge_transactions.sql:100
CREATE OR REPLACE FUNCTION public.mutate_home_claim_invitation(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,p_action text,
  p_invitation_id uuid DEFAULT NULL,p_token text DEFAULT NULL,p_note text DEFAULT NULL,p_validity_days integer DEFAULT 365)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_home public."Home"%ROWTYPE; v_claim public."HomeOwnershipClaim"%ROWTYPE; v_invite public."HomeInvite"%ROWTYPE;
  v_occ public."HomeOccupancy"%ROWTYPE; v_owner public."HomeOwner"%ROWTYPE; v_user public."User"%ROWTYPE;
  v_policy jsonb; v_target jsonb; v_role public.home_role_base; v_legacy_role text;
  v_now timestamptz; v_hash text; v_inviter uuid; v_merged_claim uuid; v_resolution public.household_resolution_state;
  v_phase public.claim_phase_v2; v_terminal public.claim_terminal_reason; v_permissions jsonb;
  v_replayed boolean:=false; v_active_claims integer; v_verified boolean; v_challenged boolean;
BEGIN
  IF p_actor_id IS NULL OR p_claim_id IS NULL OR p_action IS NULL OR p_action NOT IN ('issue','accept')
    OR p_validity_days IS NULL OR p_validity_days<1 OR p_validity_days>3650 OR length(p_note)>1000
    OR (p_action='issue' AND (p_invitation_id IS NOT NULL OR p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$'))
    OR (p_action='accept' AND (p_token IS NOT NULL OR p_note IS NOT NULL)) THEN
    RETURN jsonb_build_object('ok',false,'code','CLAIM_MERGE_INVALID','status',400); END IF;
  IF NOT public.lock_home_claim_scope(p_home_id) THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id;
  SELECT * INTO v_claim FROM public."HomeOwnershipClaim" WHERE id=p_claim_id AND home_id=p_home_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_FOUND','status',404); END IF;
  IF p_action='accept' AND v_claim.claimant_user_id<>p_actor_id THEN
    RETURN jsonb_build_object('ok',false,'code','CLAIM_RECIPIENT_MISMATCH','status',403); END IF;
  v_now:=clock_timestamp();
  v_policy:=public.home_claim_invitation_policy(v_claim); v_role:=(v_policy->>'role_base')::public.home_role_base;
  v_legacy_role:=CASE v_role WHEN 'lease_resident' THEN 'renter' ELSE v_role::text END;
  SELECT * INTO v_user FROM public."User" WHERE id=p_actor_id;
  IF NOT FOUND OR v_policy IS NULL THEN RETURN jsonb_build_object('ok',false,'code','CLAIM_MERGE_INVALID','status',400); END IF;
  IF p_action='issue' THEN
    v_inviter:=p_actor_id;
    v_target:=public.home_claim_invitation_target(p_home_id,v_inviter,v_claim.claimant_user_id,v_role);
    IF v_target->>'ok'<>'true' THEN RETURN v_target; END IF;
    IF NOT public.home_claim_is_active(v_claim) OR v_claim.expires_at<=v_now THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_ELIGIBLE','status',409); END IF;
    SELECT * INTO v_invite FROM public."HomeInvite" WHERE home_id=p_home_id
      AND proposed_preset_key='claim_merge:'||p_claim_id AND invitee_user_id=v_claim.claimant_user_id
      AND status='pending' ORDER BY created_at DESC,id LIMIT 1;
    IF FOUND AND v_invite.expires_at>v_now AND v_invite.invited_by=p_actor_id
      AND v_invite.proposed_role_base=v_role AND public.home_invite_role(v_invite.proposed_role)=v_role
      AND v_invite.admission_policy=v_policy AND v_invite.is_open_invite IS FALSE
      AND v_invite.access_start_at IS NULL AND v_invite.access_end_at IS NULL
      AND (SELECT count(*) FROM public."HomeInvite" WHERE home_id=p_home_id
        AND proposed_preset_key='claim_merge:'||p_claim_id AND invitee_user_id=v_claim.claimant_user_id AND status='pending')=1 THEN
      v_replayed:=true;
    ELSE
      -- Explicit reissue retires only pending invitations bound to this exact
      -- claim/claimant. Never repair a token in place with a more powerful role.
      UPDATE public."HomeInvite" SET status='revoked' WHERE home_id=p_home_id
        AND proposed_preset_key='claim_merge:'||p_claim_id AND invitee_user_id=v_claim.claimant_user_id AND status='pending';
      v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
      INSERT INTO public."HomeInvite"(home_id,invited_by,invitee_user_id,proposed_role,proposed_role_base,
        proposed_preset_key,token,token_hash,expires_at,admission_policy,is_open_invite)
        VALUES(p_home_id,p_actor_id,v_claim.claimant_user_id,v_legacy_role,v_role,'claim_merge:'||p_claim_id,
          v_hash,v_hash,least(v_now+interval '7 days',v_claim.expires_at),v_policy,false) RETURNING * INTO v_invite;
      UPDATE public."HomeOwnershipClaim" SET routing_classification='merge_candidate',updated_at=v_now WHERE id=p_claim_id;
      INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
        VALUES(p_home_id,p_actor_id,'OWNERSHIP_CLAIM_RELATIONSHIP_INVITED','HomeOwnershipClaim',p_claim_id,
          jsonb_build_object('note',p_note,'invitation_id',v_invite.id,'proposed_role_base',v_role));
    END IF;
    RETURN jsonb_build_object('ok',true,'homeId',p_home_id,'claimId',p_claim_id,'replayed',v_replayed,
      'invitation',to_jsonb(v_invite)-ARRAY['token','token_hash','admission_policy'],
      'token',CASE WHEN v_replayed THEN NULL ELSE p_token END,'actor_name',coalesce(v_user.name,v_user.first_name,v_user.username,'Someone'),
      'home_label',coalesce(v_home.name,'A home'));
  END IF;

  SELECT * INTO v_invite FROM public."HomeInvite" WHERE home_id=p_home_id
    AND proposed_preset_key='claim_merge:'||p_claim_id AND invitee_user_id=p_actor_id
    AND (p_invitation_id IS NULL OR id=p_invitation_id)
    AND (p_invitation_id IS NOT NULL OR status IN ('pending','accepted'))
    ORDER BY created_at DESC,id LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','CLAIM_INVITE_NOT_FOUND','status',404); END IF;
  IF v_invite.status='accepted' THEN
    SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
    IF v_occ.id IS NULL OR v_invite.accepted_by_user_id IS DISTINCT FROM p_actor_id OR v_claim.state<>'approved'
      OR v_claim.terminal_reason IS DISTINCT FROM (CASE WHEN v_role='owner' THEN 'none' ELSE 'merged_via_invite' END)::public.claim_terminal_reason
      OR v_claim.claim_phase_v2 IS DISTINCT FROM (CASE WHEN v_role='owner' THEN 'verified' ELSE 'merged_into_household' END)::public.claim_phase_v2
      OR v_invite.proposed_role_base IS DISTINCT FROM v_role
      OR NOT public.home_is_active_member(p_home_id,p_actor_id)
      OR v_occ.start_at>v_now OR v_occ.end_at<=v_now OR v_occ.access_start_at>v_now OR v_occ.access_end_at<=v_now
      OR v_home.security_state IN ('frozen','frozen_silent') OR v_home.home_status IN ('merged','archived')
      OR (v_role='owner' AND (NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
        AND subject_type='user' AND subject_id=p_actor_id AND owner_status='verified')
        OR v_occ.age_band IN ('child','teen'))) THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_INVITE_ALREADY_USED','status',409); END IF;
    v_replayed:=true;
  ELSE
    IF v_invite.status<>'pending' THEN RETURN jsonb_build_object('ok',false,'code','CLAIM_INVITE_ALREADY_USED','status',409); END IF;
    IF v_invite.expires_at IS NULL OR v_invite.expires_at<=v_now THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_INVITE_EXPIRED','status',410); END IF;
    IF NOT public.home_claim_is_active(v_claim) OR v_claim.expires_at<=v_now THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_ELIGIBLE','status',409); END IF;
    IF v_invite.admission_policy IS DISTINCT FROM v_policy OR v_invite.proposed_role_base IS DISTINCT FROM v_role
      OR public.home_invite_role(v_invite.proposed_role) IS DISTINCT FROM v_role OR v_invite.is_open_invite IS DISTINCT FROM false
      OR v_invite.access_start_at IS NOT NULL OR v_invite.access_end_at IS NOT NULL THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_INVITE_CHANGED','status',409); END IF;
    v_target:=public.home_claim_invitation_target(p_home_id,v_invite.invited_by,p_actor_id,v_role);
    IF v_target->>'ok'<>'true' THEN RETURN v_target; END IF;
    SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
    IF v_occ.start_at>v_now OR v_occ.access_start_at>v_now THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_ACCESS_NOT_STARTED','status',409); END IF;
    -- Historical evidence can confirm a legacy not-started identity, but a
    -- current explicit failure cannot be undone by an older successful row.
    IF v_claim.identity_status='failed' OR (v_claim.identity_status<>'verified' AND NOT EXISTS(
      SELECT FROM public."HomeVerificationEvidence" WHERE claim_id=p_claim_id AND evidence_type='idv' AND status='verified')) THEN
      RETURN jsonb_build_object('ok',false,'code','IDENTITY_CONFIRMATION_REQUIRED','status',409); END IF;
    IF v_role='owner' THEN
      SELECT * INTO v_owner FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status<>'revoked';
      IF NOT FOUND THEN
        INSERT INTO public."HomeOwner"(home_id,subject_type,subject_id,owner_status,is_primary_owner,added_via,verification_tier)
          VALUES(p_home_id,'user',p_actor_id,'verified',false,'claim','weak');
      ELSIF v_owner.owner_status='pending' THEN
        UPDATE public."HomeOwner" SET owner_status='verified',updated_at=v_now WHERE id=v_owner.id;
      END IF;
      -- Co-owner consent never reallocates or revokes the incumbent primary.
      UPDATE public."Home" SET ownership_state=CASE WHEN ownership_state='disputed' THEN ownership_state
        ELSE 'owner_verified' END,updated_at=v_now WHERE id=p_home_id;
    END IF;
    SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
    IF FOUND THEN
      UPDATE public."HomeOccupancy" SET role=v_legacy_role,role_base=v_role,verification_status='verified',verification_source=CASE WHEN verification_source='address' OR (verification_status='verified' AND verification_source='legacy') THEN verification_source ELSE 'household' END,
        verified_at=CASE WHEN verification_status='verified' THEN verified_at ELSE v_now END,
        verification_expires_at=CASE WHEN verification_status='verified' THEN verification_expires_at
          ELSE v_now+make_interval(days=>p_validity_days) END,updated_at=v_now WHERE id=v_occ.id RETURNING * INTO v_occ;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,added_by_user_id,
        verification_status,verification_source,verified_at,verification_expires_at,can_manage_home,can_manage_finance,
        can_manage_access,can_manage_tasks,can_view_sensitive)
        VALUES(p_home_id,p_actor_id,v_legacy_role,v_role,NULL,true,v_now,v_invite.invited_by,'verified','household',v_now,
          v_now+make_interval(days=>p_validity_days),false,false,false,false,false) RETURNING * INTO v_occ;
    END IF;
    v_permissions:=CASE WHEN (v_occ.start_at IS NULL OR v_occ.start_at<=v_now)
      AND (v_occ.access_start_at IS NULL OR v_occ.access_start_at<=v_now) THEN v_target->'permissions' ELSE '[]'::jsonb END;
    UPDATE public."HomeOccupancy" SET can_manage_home=v_permissions ? 'home.edit',
      can_manage_finance=v_permissions ? 'finance.manage',can_manage_access=v_permissions ?| ARRAY['access.manage','members.manage'],
      can_manage_tasks=v_permissions ?| ARRAY['tasks.edit','tasks.manage'],can_view_sensitive=v_permissions ? 'sensitive.view'
      WHERE id=v_occ.id RETURNING * INTO v_occ;
    IF v_role<>'owner' THEN
      SELECT id INTO v_merged_claim FROM public."HomeOwnershipClaim" WHERE home_id=p_home_id
        AND claimant_user_id=v_invite.invited_by AND state='approved' AND claim_phase_v2 IS NOT DISTINCT FROM 'verified'
        AND terminal_reason='none' AND merged_into_claim_id IS NULL ORDER BY created_at DESC,id LIMIT 1;
    END IF;
    v_phase:=(CASE WHEN v_role='owner' THEN 'verified' ELSE 'merged_into_household' END)::public.claim_phase_v2;
    v_terminal:=(CASE WHEN v_role='owner' THEN 'none' ELSE 'merged_via_invite' END)::public.claim_terminal_reason;
    UPDATE public."HomeOwnershipClaim" SET state='approved',claim_phase_v2=v_phase,terminal_reason=v_terminal,
      challenge_state='none',routing_classification='merge_candidate',merged_into_claim_id=v_merged_claim,updated_at=v_now
      WHERE id=p_claim_id RETURNING * INTO v_claim;
    UPDATE public."HomeInvite" SET status='accepted',accepted_by_user_id=p_actor_id,accepted_at=v_now WHERE id=v_invite.id;
    SELECT count(*) FILTER(WHERE public.home_claim_is_active(c)),coalesce(bool_or(c.merged_into_claim_id IS NULL
      AND (c.claim_phase_v2='challenged' OR c.state='disputed' OR c.challenge_state='challenged')),false)
      INTO v_active_claims,v_challenged FROM public."HomeOwnershipClaim"c WHERE home_id=p_home_id;
    SELECT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND owner_status='verified') INTO v_verified;
    v_resolution:=(CASE WHEN v_verified AND v_challenged THEN 'disputed' WHEN v_verified THEN 'verified_household'
      WHEN v_active_claims>1 THEN 'contested' WHEN v_active_claims=1 THEN 'pending_single_claim' ELSE 'unclaimed' END)::public.household_resolution_state;
    UPDATE public."Home" SET household_resolution_state=v_resolution,household_resolution_updated_at=v_now,
      vacancy_at=NULL,updated_at=v_now WHERE id=p_home_id RETURNING * INTO v_home;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,CASE WHEN v_role='owner' THEN 'OWNERSHIP_CLAIM_OWNER_INVITE_ACCEPTED'
        ELSE 'OWNERSHIP_CLAIM_MERGED' END,'HomeOwnershipClaim',p_claim_id,
        jsonb_build_object('invite_id',v_invite.id,'merged_into_claim_id',v_merged_claim,'accepted_role_base',v_role,'occupancy_id',v_occ.id));
  END IF;
  RETURN jsonb_build_object('ok',true,'homeId',p_home_id,'claimId',p_claim_id,'replayed',v_replayed,
    'invitation',jsonb_build_object('id',v_invite.id),'occupancy',to_jsonb(v_occ),'acceptedRoleBase',v_role,
    'acceptedAsOwner',v_role='owner','claimPhaseV2',v_claim.claim_phase_v2,'terminalReason',v_claim.terminal_reason,
    'mergedIntoClaimId',v_claim.merged_into_claim_id,'homeResolutionState',v_home.household_resolution_state,
    'inviter_id',v_invite.invited_by,'actor_name',coalesce(v_user.name,v_user.first_name,v_user.username,'Someone'),
    'home_label',coalesce(v_home.name,'A home'));
END $$;

-- Latest permitted source: supabase/migrations/20260912010000_home_postcard_verification_recovery.sql:102
CREATE OR REPLACE FUNCTION public.verify_home_postcard_current(
 p_home_id uuid,p_actor_id uuid,p_postcard_id uuid,p_request_id uuid,p_submitted_hash text,p_validity_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomePostcardVerificationCommand"%ROWTYPE; p public."HomePostcardCode"%ROWTYPE;
 h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; r public."HomeResidencyClaim"%ROWTYPE;
 context jsonb; policy jsonb; intent text; t timestamptz; age public.home_age_band;
 code text; status integer; remaining integer; v_status text; v_recorded timestamptz;
 v_challenge timestamptz; v_existing boolean:=false;
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
   IF o.verification_status IN ('verified','provisional') THEN
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

-- Latest permitted source: supabase/migrations/20260912010000_home_postcard_verification_recovery.sql:231
CREATE OR REPLACE FUNCTION public.promote_home_postcard_review(p_home_id uuid,p_actor_id uuid,p_occupancy_id uuid,p_validity_days integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE o public."HomeOccupancy"%ROWTYPE; h public."Home"%ROWTYPE; p public."HomePostcardCode"%ROWTYPE;
 context jsonb; policy jsonb; age public.home_age_band; t timestamptz;
BEGIN
 IF p_home_id IS NULL OR p_actor_id IS NULL OR p_occupancy_id IS NULL OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_VERIFICATION_INVALID','status',400); END IF;
 IF NOT public.lock_home_postcard_current_scope(p_home_id,p_actor_id) THEN
   RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
 t:=clock_timestamp();
 SELECT * INTO o FROM public."HomeOccupancy" WHERE id=p_occupancy_id AND home_id=p_home_id AND user_id=p_actor_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
 IF o.verification_status<>'provisional' THEN RETURN jsonb_build_object('ok',true,'promoted',false); END IF;
 context:=public.home_postcard_current_context(p_home_id,p_actor_id,true);
 IF context->>'ok' IS DISTINCT FROM 'true' THEN RETURN context; END IF;
 IF o.verified_at IS NOT NULL OR o.verification_expires_at IS NOT NULL
   OR o.challenge_window_started_at IS NULL OR o.challenge_window_ends_at IS NULL
   OR o.challenge_window_ends_at<o.challenge_window_started_at+interval '7 days' THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
 IF o.challenge_window_ends_at>t THEN RETURN jsonb_build_object('ok',true,'promoted',false); END IF;
 SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
 SELECT * INTO p FROM public."HomePostcardCode" WHERE home_id=p_home_id AND user_id=p_actor_id AND status='verified'
   AND verified_at>=o.challenge_window_started_at AND verified_at<=o.challenge_window_ends_at
   ORDER BY verified_at DESC,id DESC LIMIT 1;
 IF NOT FOUND OR p.destination IS DISTINCT FROM jsonb_build_object('address',h.address,'address2',h.address2,
   'city',h.city,'state',h.state,'zipcode',h.zipcode) OR coalesce(h.country,'US')<>'US' THEN
   RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
 age:=(context->>'age_band')::public.home_age_band;
 policy:=public.home_postcard_verified_policy(p_home_id,p_actor_id,age);
 IF policy->>'ok' IS DISTINCT FROM 'true' THEN RETURN policy; END IF;
 UPDATE public."HomeOccupancy" SET role=policy->>'role_base',role_base=(policy->>'role_base')::public.home_role_base,
   age_band=age,verification_status='verified',verification_source='address',verified_at=t,verification_expires_at=t+make_interval(days=>p_validity_days),
   can_manage_home=policy->'permissions' ? 'home.edit',can_manage_access=policy->'permissions' ?| ARRAY['access.manage','members.manage'],
   can_manage_finance=policy->'permissions' ? 'finance.manage',can_manage_tasks=policy->'permissions' ?| ARRAY['tasks.edit','tasks.manage'],
   can_view_sensitive=policy->'permissions' ? 'sensitive.view',updated_at=t WHERE id=o.id;
 UPDATE public."HomeResidencyClaim" SET status='verified',review_note='Postcard review window completed',reviewed_at=t,updated_at=t
   WHERE home_id=p_home_id AND user_id=p_actor_id AND status='pending';
 UPDATE public."Home" SET vacancy_at=NULL,updated_at=t WHERE id=p_home_id AND vacancy_at IS NOT NULL;
 INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
   VALUES(p_home_id,p_actor_id,'CHALLENGE_WINDOW_EXPIRED_PROMOTED','HomeOccupancy',o.id,
     jsonb_build_object('postcard_id',p.id,'verification_status','verified','role_base',policy->>'role_base'));
 RETURN jsonb_build_object('ok',true,'promoted',true,'home_id',p_home_id,'user_id',p_actor_id,'occupancy_id',p_occupancy_id);
END;
$$;

-- Latest permitted source: supabase/migrations/20260910080000_home_claim_review_transactions.sql:162
CREATE OR REPLACE FUNCTION public.mutate_home_claim_review(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,p_action text,
  p_review_token text DEFAULT NULL,p_note text DEFAULT NULL,p_platform_admin boolean DEFAULT false,p_validity_days integer DEFAULT 365)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h uuid; c public."HomeOwnershipClaim"%ROWTYPE; v_home public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  v_owner public."HomeOwner"%ROWTYPE; v_role public.home_role_base; v_legacy text; v_target jsonb;
  v_now timestamptz; v_state public.ownership_claim_state; v_phase public.claim_phase_v2;
  v_receipt public."HomeClaimReviewReceipt"%ROWTYPE; v_result jsonb; v_ownership jsonb; v_before_snapshot text;
  v_strength public.claim_strength; v_proof boolean; v_identity boolean; v_primary boolean:=false; v_private boolean:=false;
BEGIN
  IF p_actor_id IS NULL OR p_action IS NULL OR p_action NOT IN ('approve','reject','flag','request_more_info','withdraw','authorize_evidence')
    OR p_platform_admin IS NULL OR length(p_note)>1000 OR p_validity_days IS NULL OR p_validity_days<1 OR p_validity_days>3650 THEN
    RETURN '{"ok":false,"code":"CLAIM_REVIEW_INVALID","status":400}'::jsonb; END IF;
  SELECT home_id INTO h FROM public."HomeOwnershipClaim" WHERE id=p_claim_id;
  IF h IS NULL OR (p_home_id IS NOT NULL AND p_home_id<>h) THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  IF NOT public.lock_home_claim_scope(h) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id AND home_id=h;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=h;
  v_now:=clock_timestamp();
  IF p_action IN ('withdraw','authorize_evidence') THEN
    IF c.claimant_user_id<>p_actor_id OR p_platform_admin THEN
      RETURN '{"ok":false,"code":"CLAIM_RECIPIENT_MISMATCH","status":403}'::jsonb; END IF;
    IF p_action='withdraw' AND c.state='revoked' AND c.claim_phase_v2='withdrawn' AND c.terminal_reason='withdrawn_by_user' THEN
      RETURN jsonb_build_object('ok',true,'homeId',h,'claimId',p_claim_id,'action',p_action,'state',c.state,
        'withdrawn',true,'deleted',false,'replayed',true); END IF;
  ELSE
    IF public.home_claim_review_authority(h,p_actor_id,p_platform_admin) IS DISTINCT FROM true THEN
      RETURN '{"ok":false,"code":"CLAIM_REVIEW_DENIED","status":403}'::jsonb; END IF;
    IF c.claimant_user_id=p_actor_id THEN RETURN '{"ok":false,"code":"CLAIM_SELF_REVIEW_FORBIDDEN","status":403}'::jsonb; END IF;
  END IF;
  v_now:=clock_timestamp();
  -- A lost response may acknowledge the exact same operation, but never
  -- reapply authority or accept a changed claim/evidence/member/proof result.
  IF p_action IN ('approve','reject','flag','request_more_info') AND p_review_token IS NOT NULL THEN
    SELECT * INTO v_receipt FROM public."HomeClaimReviewReceipt" WHERE home_id=h AND claim_id=p_claim_id
      AND actor_user_id=p_actor_id AND action=p_action AND platform_admin=p_platform_admin AND review_token=p_review_token;
    IF FOUND THEN
      IF v_home.home_status IN ('merged','archived') OR v_home.security_state IN ('frozen','frozen_silent','disputed')
        OR p_note IS DISTINCT FROM v_receipt.note
        OR public.home_claim_review_snapshot(c) IS DISTINCT FROM v_receipt.result_snapshot THEN
        RETURN '{"ok":false,"code":"CLAIM_REVIEW_CHANGED","status":409}'::jsonb; END IF;
      IF p_action='approve' THEN
        v_role:=(CASE c.claim_type WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'resident' THEN 'lease_resident' END)::public.home_role_base;
        v_target:=public.home_claim_review_target(h,p_actor_id,c.claimant_user_id,v_role,p_platform_admin);
        IF v_target->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_target; END IF;
        SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=h AND user_id=c.claimant_user_id;
        SELECT jsonb_build_object('primary_user_id',v_home.owner_id,'proofs',coalesce(jsonb_agg(to_jsonb(owner_row) ORDER BY owner_row.id),'[]'))
          INTO v_ownership FROM public."HomeOwner" owner_row WHERE home_id=h AND subject_type='user' AND subject_id=c.claimant_user_id;
        IF c.state<>'approved' OR c.claim_phase_v2<>'verified' OR o.verification_status IS DISTINCT FROM 'verified'
          OR to_jsonb(o) IS DISTINCT FROM (CASE WHEN v_receipt.occupancy_snapshot ? 'verification_source'
            THEN v_receipt.occupancy_snapshot ELSE v_receipt.occupancy_snapshot
              ||jsonb_build_object('verification_source',o.verification_source) END)
          OR v_target->'permissions' IS DISTINCT FROM v_receipt.permissions_snapshot
          OR v_ownership IS DISTINCT FROM v_receipt.ownership_snapshot
          OR (v_role='owner' AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND subject_type='user'
            AND subject_id=c.claimant_user_id AND owner_status='verified')) THEN
          RETURN '{"ok":false,"code":"CLAIM_REVIEW_CHANGED","status":409}'::jsonb; END IF;
      END IF;
      RETURN v_receipt.result||jsonb_build_object('replayed',true);
    END IF;
  END IF;
  -- A disputed incumbent/challenger needs the dedicated dispute lifecycle.
  -- No ordinary review clears a freeze, revokes another owner or resolves it.
  IF c.state='disputed' OR c.claim_phase_v2='challenged' OR c.challenge_state='challenged'
    OR c.routing_classification='challenge_claim' THEN
    RETURN '{"ok":false,"code":"CLAIM_CHALLENGE_REVIEW_REQUIRED","status":409}'::jsonb; END IF;
  IF c.state='approved' OR c.claim_phase_v2 IN ('verified','merged_into_household') OR c.merged_into_claim_id IS NOT NULL
    OR (c.terminal_reason<>'none' AND NOT (p_action='withdraw' AND c.state='rejected' AND c.terminal_reason='rejected_review'))
    OR (p_action<>'withdraw' AND (NOT public.home_claim_is_active(c) OR c.expires_at<=v_now)) THEN
    RETURN '{"ok":false,"code":"CLAIM_NOT_ELIGIBLE","status":409}'::jsonb; END IF;
  IF p_action='authorize_evidence' THEN
    RETURN '{"ok":false,"code":"CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED","status":409}'::jsonb;
  END IF;
  IF p_action='withdraw' THEN
    -- Retain claim/evidence/proof history. Never purge an untrusted object or
    -- revoke unrelated pending proof, occupancy or the primary Home pointer.
    v_private:=coalesce((public.home_secret_context(h,p_actor_id)->>'private')::boolean,false);
    v_before_snapshot:=public.home_claim_review_snapshot(c);
    UPDATE public."HomeOwnershipClaim" SET state='revoked',claim_phase_v2='withdrawn',terminal_reason='withdrawn_by_user',
      updated_at=v_now WHERE id=p_claim_id RETURNING * INTO c;
    UPDATE public."HomeInvite" SET status='revoked' WHERE home_id=h AND proposed_preset_key='claim_merge:'||p_claim_id
      AND invitee_user_id=p_actor_id AND status='pending';
    PERFORM public.reconcile_home_claim_review(h);
    v_result:=jsonb_build_object('ok',true,'homeId',h,'claimId',p_claim_id,'action',p_action,'state',c.state,
      'withdrawn',true,'deleted',false,'replayed',false);
    INSERT INTO public."HomeClaimReviewReceipt"(home_id,claim_id,actor_user_id,action,platform_admin,private_setup,
      review_token,result_snapshot,result) VALUES(h,p_claim_id,p_actor_id,'withdraw',false,v_private,
        v_before_snapshot,public.home_claim_review_snapshot(c),v_result);
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(h,p_actor_id,'OWNERSHIP_CLAIM_WITHDRAWN','HomeOwnershipClaim',p_claim_id,
        jsonb_build_object('retained_evidence',true,'private_setup',v_private));
    RETURN v_result;
  END IF;
  IF v_home.home_status IN ('merged','archived') OR v_home.security_state IN ('frozen','frozen_silent','disputed') THEN
    RETURN '{"ok":false,"code":"CLAIM_REVIEW_DENIED","status":403}'::jsonb; END IF;
  IF c.state NOT IN ('submitted','pending_review','pending_challenge_window','needs_more_info') THEN
    RETURN '{"ok":false,"code":"CLAIM_NOT_ELIGIBLE","status":409}'::jsonb; END IF;
  IF p_review_token IS NULL OR p_review_token !~ '^[a-f0-9]{64}$'
    OR p_review_token<>public.home_claim_review_snapshot(c) THEN
    RETURN '{"ok":false,"code":"CLAIM_REVIEW_CHANGED","status":409}'::jsonb; END IF;
  IF p_action='approve' THEN
    v_role:=(CASE c.claim_type WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'resident' THEN 'lease_resident' END)::public.home_role_base;
    v_target:=public.home_claim_review_target(h,p_actor_id,c.claimant_user_id,v_role,p_platform_admin);
    IF v_target->>'ok'<>'true' THEN RETURN v_target; END IF;
    SELECT coalesce(bool_or(e.evidence_type='idv'),false),coalesce(bool_or(e.evidence_type IN
      ('deed','closing_disclosure','tax_bill','escrow_attestation','title_match')
      OR (c.claim_type='resident' AND e.evidence_type IN ('utility_bill','lease'))),false)
      INTO v_identity,v_proof FROM public."HomeVerificationEvidence" e WHERE claim_id=p_claim_id
        AND public.home_claim_review_verified_evidence(e);
    IF c.identity_status='failed' OR (c.identity_status<>'verified' AND NOT v_identity) THEN
      RETURN '{"ok":false,"code":"IDENTITY_CONFIRMATION_REQUIRED","status":409}'::jsonb; END IF;
    IF NOT v_proof THEN RETURN '{"ok":false,"code":"CLAIM_VERIFIED_EVIDENCE_REQUIRED","status":409}'::jsonb; END IF;
    v_strength:=(CASE WHEN c.claim_type='resident' THEN 'resident_standard' WHEN EXISTS(SELECT FROM public."HomeVerificationEvidence" e
      WHERE claim_id=p_claim_id AND public.home_claim_review_verified_evidence(e) AND e.evidence_type IN ('title_match','escrow_attestation'))
      THEN 'owner_strong' ELSE 'owner_standard' END)::public.claim_strength;
    v_legacy:=CASE v_role WHEN 'lease_resident' THEN 'renter' ELSE v_role::text END;
    IF v_role='owner' THEN
      SELECT * INTO v_owner FROM public."HomeOwner" WHERE home_id=h AND subject_type='user' AND subject_id=c.claimant_user_id AND owner_status<>'revoked';
      -- Only an unowned first Home may acquire a primary pointer. Existing
      -- primary proof/pointer is never replaced by approval of another claim.
      v_primary:=(v_home.owner_id IS NULL OR v_home.owner_id=c.claimant_user_id)
        AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND owner_status='verified' AND (subject_type<>'user' OR subject_id<>c.claimant_user_id));
      IF v_owner.id IS NULL THEN
        INSERT INTO public."HomeOwner"(home_id,subject_type,subject_id,owner_status,is_primary_owner,added_via,verification_tier)
          VALUES(h,'user',c.claimant_user_id,'verified',v_primary,'claim',(CASE v_strength WHEN 'owner_strong' THEN 'strong' ELSE 'standard' END)::public.owner_verification_tier);
      ELSIF v_owner.owner_status='pending' THEN
        UPDATE public."HomeOwner" SET owner_status='verified',is_primary_owner=CASE WHEN v_primary THEN true ELSE is_primary_owner END,
          verification_tier=(CASE v_strength WHEN 'owner_strong' THEN 'strong' ELSE 'standard' END)::public.owner_verification_tier,updated_at=v_now WHERE id=v_owner.id;
      END IF;
      UPDATE public."Home" SET owner_id=CASE WHEN owner_id IS NULL AND v_primary THEN c.claimant_user_id ELSE owner_id END,
        ownership_state='owner_verified',security_state=CASE WHEN security_state='normal' AND v_primary THEN 'claim_window'::public.home_security_state ELSE security_state END,
        claim_window_ends_at=CASE WHEN security_state='normal' AND v_primary THEN v_now+interval '14 days' ELSE claim_window_ends_at END,updated_at=v_now WHERE id=h;
    END IF;
    SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=h AND user_id=c.claimant_user_id;
    IF FOUND THEN
      UPDATE public."HomeOccupancy" SET role=v_legacy,role_base=v_role,verification_status='verified',verification_source='address',
        verified_at=CASE WHEN verification_status='verified' THEN verified_at ELSE v_now END,
        verification_expires_at=CASE WHEN verification_status='verified' THEN verification_expires_at ELSE v_now+make_interval(days=>p_validity_days) END,
        updated_at=v_now WHERE id=o.id RETURNING * INTO o;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,added_by_user_id,
        verification_status,verification_source,verified_at,verification_expires_at,can_manage_home,can_manage_finance,can_manage_access,can_manage_tasks,can_view_sensitive)
        VALUES(h,c.claimant_user_id,v_legacy,v_role,NULL,true,v_now,p_actor_id,'verified','address',v_now,v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
        RETURNING * INTO o;
    END IF;
    UPDATE public."HomeOccupancy" SET can_manage_home=v_target->'permissions' ? 'home.edit',
      can_manage_finance=v_target->'permissions' ? 'finance.manage',can_manage_access=v_target->'permissions' ?| ARRAY['access.manage','members.manage'],
      can_manage_tasks=v_target->'permissions' ?| ARRAY['tasks.edit','tasks.manage'],can_view_sensitive=v_target->'permissions' ? 'sensitive.view'
      WHERE id=o.id RETURNING * INTO o;
    v_state:='approved'; v_phase:='verified';
  ELSIF p_action='reject' THEN v_state:='rejected'; v_phase:='rejected';
  ELSE v_state:=CASE WHEN p_action='flag' THEN 'pending_review'::public.ownership_claim_state ELSE 'needs_more_info'::public.ownership_claim_state END;
    v_phase:='under_review';
  END IF;
  UPDATE public."HomeOwnershipClaim" SET state=v_state,claim_phase_v2=v_phase,
    terminal_reason=CASE WHEN p_action='reject' THEN 'rejected_review'::public.claim_terminal_reason ELSE 'none'::public.claim_terminal_reason END,
    reviewed_by=p_actor_id,reviewed_at=v_now,review_note=p_note,claim_strength=coalesce(v_strength,claim_strength),updated_at=v_now WHERE id=p_claim_id;
  IF p_action IN ('approve','reject') THEN
    UPDATE public."HomeInvite" SET status='revoked' WHERE home_id=h AND proposed_preset_key='claim_merge:'||p_claim_id
      AND invitee_user_id=c.claimant_user_id AND status='pending';
  END IF;
  PERFORM public.reconcile_home_claim_review(h);
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id;
  v_result:=jsonb_build_object('ok',true,'homeId',h,'claimId',p_claim_id,'claimantId',c.claimant_user_id,'action',p_action,
    'state',v_state,'newState',v_state,'replayed',false,'occupancy',CASE WHEN o.id IS NOT NULL THEN to_jsonb(o) ELSE NULL END,
    'evidence_purged',0);
  IF p_action='approve' THEN
    SELECT jsonb_build_object('primary_user_id',(SELECT owner_id FROM public."Home" WHERE id=h),
      'proofs',coalesce(jsonb_agg(to_jsonb(owner_row) ORDER BY owner_row.id),'[]')) INTO v_ownership
      FROM public."HomeOwner" owner_row WHERE home_id=h AND subject_type='user' AND subject_id=c.claimant_user_id;
  END IF;
  INSERT INTO public."HomeClaimReviewReceipt"(home_id,claim_id,actor_user_id,action,platform_admin,review_token,note,
    result_snapshot,occupancy_snapshot,permissions_snapshot,ownership_snapshot,result)
    VALUES(h,p_claim_id,p_actor_id,p_action,p_platform_admin,p_review_token,p_note,public.home_claim_review_snapshot(c),
      CASE WHEN o.id IS NOT NULL THEN to_jsonb(o) END,CASE WHEN p_action='approve' THEN v_target->'permissions' END,v_ownership,v_result);
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(h,p_actor_id,'OWNERSHIP_CLAIM_REVIEWED','HomeOwnershipClaim',p_claim_id,
      jsonb_build_object('action',p_action,'new_state',v_state,'review_token',p_review_token,'platform_admin',p_platform_admin,
        'claim_type',c.claim_type,'occupancy_id',o.id,'retained_evidence',true));
  RETURN v_result;
END $$;

-- Latest permitted source: supabase/migrations/20260913050000_home_lease_decisions.sql:9
CREATE OR REPLACE FUNCTION public.decide_home_lease(
  p_action text, p_actor_id uuid, p_lease_id uuid DEFAULT NULL,
  p_authority_id uuid DEFAULT NULL, p_token_hash text DEFAULT NULL,
  p_user_email text DEFAULT NULL, p_dates jsonb DEFAULT '{}',
  p_reason text DEFAULT NULL, p_validity_days integer DEFAULT 730,
  p_home_id uuid DEFAULT NULL, p_message text DEFAULT NULL,
  p_request_context jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE
  v_home_id uuid; v_tenant_id uuid; v_now timestamptz;
  v_home public."Home"%ROWTYPE; v_lease public."HomeLease"%ROWTYPE;
  v_invite public."HomeLeaseInvite"%ROWTYPE; v_authority public."HomeAuthority"%ROWTYPE;
  v_occupancy public."HomeOccupancy"%ROWTYPE;
  v_receipt jsonb; v_intent jsonb; v_current boolean; v_actor_allowed boolean;
  v_start timestamptz; v_end timestamptz; v_role public.home_role_base;
  v_permissions text[];
  v_resident_actor boolean:=false; v_target_id uuid; v_detach_ids uuid[]:='{}';
  v_end_receipt jsonb; v_other_lease boolean; v_departure jsonb; v_removal jsonb;
  v_resident public."HomeLeaseResident"%ROWTYPE; v_co_departure boolean:=false;
  v_latest_lease_id uuid; v_latest_lease_state text; v_invitee_email text;
BEGIN
  IF p_actor_id IS NULL OR p_action NOT IN ('approve','deny','accept','end','move_out','cancel','request','invite') OR p_action IS NULL
    OR p_validity_days IS NULL OR p_validity_days<1 OR p_validity_days>36500
    OR p_dates IS NULL OR jsonb_typeof(p_dates)<>'object' THEN
    RETURN jsonb_build_object('success',false,'error','Invalid lease decision');
  END IF;
  IF p_action IN ('request','invite') THEN
    v_home_id:=p_home_id;
  ELSIF p_action='accept' THEN
    SELECT home_id INTO v_home_id FROM public."HomeLeaseInvite" WHERE token_hash=p_token_hash;
  ELSE
    SELECT home_id INTO v_home_id FROM public."HomeLease" WHERE id=p_lease_id;
  END IF;
  IF v_home_id IS NULL OR NOT public.lock_home_invitation_scope(v_home_id) THEN
    RETURN jsonb_build_object('success',false,'status',404,'error',CASE WHEN p_action IN ('request','invite') THEN 'Home not found' ELSE 'Lease or invite not found' END);
  END IF;
  -- Match the existing Home mutation lock order. Re-read proofs after waiting;
  -- authority revocation and competing lease decisions serialize on these rows.
  PERFORM id FROM public."HomeAuthority" WHERE home_id=v_home_id ORDER BY id FOR UPDATE;
  IF p_action IN ('end','move_out','cancel') THEN
    SELECT * INTO v_lease FROM public."HomeLease" WHERE id=p_lease_id AND home_id=v_home_id FOR UPDATE;
    PERFORM user_id FROM public."HomeLeaseResident" WHERE lease_id=p_lease_id ORDER BY user_id FOR UPDATE;
    SELECT * INTO v_resident FROM public."HomeLeaseResident" WHERE lease_id=p_lease_id AND user_id=p_actor_id;
    v_departure:=v_lease.metadata->'resident_departures'->p_actor_id::text;
    v_resident_actor:=v_lease.primary_resident_user_id=p_actor_id OR
      (p_action='move_out' AND (v_resident.id IS NOT NULL OR v_departure IS NOT NULL));
    v_co_departure:=p_action='move_out' AND v_lease.primary_resident_user_id IS DISTINCT FROM p_actor_id;
    IF p_action='cancel' AND (v_lease.primary_resident_user_id IS DISTINCT FROM p_actor_id OR v_lease.source<>'tenant_request') THEN
      RETURN jsonb_build_object('success',false,'status',403,'error','Only the requesting tenant can cancel this request');
    END IF;
    IF p_action='move_out' AND NOT coalesce(v_resident_actor,false) THEN
      RETURN jsonb_build_object('success',false,'error','Only a lease resident can move out','status',403);
    END IF;
  END IF;
  IF p_action='request' THEN
    SELECT * INTO v_authority FROM public."HomeAuthority" WHERE home_id=v_home_id AND status='verified' ORDER BY id LIMIT 1;
  ELSIF p_action='accept' THEN
    SELECT * INTO v_invite FROM public."HomeLeaseInvite"
      WHERE token_hash=p_token_hash AND home_id=v_home_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Invite not found'); END IF;
    IF (v_invite.invitee_user_id IS NOT NULL AND v_invite.invitee_user_id<>p_actor_id)
      OR (v_invite.invitee_email IS NOT NULL
        AND lower(trim(v_invite.invitee_email))<>lower(trim(coalesce(p_user_email,'')))) THEN
      RETURN jsonb_build_object('success',false,'error','This invitation was sent to a different email address');
    END IF;
    SELECT * INTO v_authority FROM public."HomeAuthority" WHERE home_id=v_home_id
      AND subject_type=v_invite.landlord_subject_type AND subject_id=v_invite.landlord_subject_id
      AND status='verified' ORDER BY id LIMIT 1;
  ELSE
    SELECT * INTO v_authority FROM public."HomeAuthority"
      WHERE id=p_authority_id AND home_id=v_home_id AND status='verified';
  END IF;
  IF v_authority.id IS NULL AND NOT coalesce(v_resident_actor,false) THEN
    IF p_action='request' THEN RETURN jsonb_build_object('success',false,'status',400,
      'error','This property has no verified landlord. Cannot submit a lease request.'); END IF;
    RETURN jsonb_build_object('success',false,'error','Current verified authority required','status',403);
  END IF;
  IF p_action NOT IN ('accept','request') AND NOT coalesce(v_resident_actor,false) THEN
    v_actor_allowed:=v_authority.subject_type='user' AND v_authority.subject_id=p_actor_id;
    IF v_authority.subject_type='business' THEN
      -- Same two business paths as authorityResolution.js, with their binding
      -- and active-seat/team proof locked through commit.
      PERFORM s.id FROM public."BusinessSeat" s JOIN public."SeatBinding" b ON b.seat_id=s.id
        WHERE b.user_id=p_actor_id AND s.business_user_id=v_authority.subject_id AND s.is_active
        ORDER BY s.id FOR UPDATE OF s,b;
      v_actor_allowed:=FOUND;
      IF NOT v_actor_allowed THEN
        PERFORM id FROM public."BusinessTeam" WHERE user_id=p_actor_id
          AND business_user_id=v_authority.subject_id AND is_active ORDER BY id FOR UPDATE;
        v_actor_allowed:=FOUND;
      END IF;
    END IF;
    IF NOT coalesce(v_actor_allowed,false) THEN
      RETURN jsonb_build_object('success',false,'error','Current actor does not hold this authority');
    END IF;
  END IF;
  IF p_action='request' THEN
    SELECT * INTO v_lease FROM public."HomeLease" WHERE home_id=v_home_id
      AND primary_resident_user_id=p_actor_id AND (state='pending' OR (state='active' AND (end_at IS NULL OR end_at>clock_timestamp())))
      ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
  ELSIF p_action='accept' THEN
    SELECT * INTO v_lease FROM public."HomeLease" WHERE home_id=v_home_id
      AND metadata->>'invite_id'=v_invite.id::text ORDER BY id LIMIT 1 FOR UPDATE;
  ELSIF p_action<>'invite' THEN
    SELECT * INTO v_lease FROM public."HomeLease" WHERE id=p_lease_id AND home_id=v_home_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Lease not found'); END IF;
  END IF;
  v_now:=clock_timestamp();
  SELECT * INTO v_home FROM public."Home" WHERE id=v_home_id;
  IF p_action='cancel' THEN
    IF v_lease.state='canceled' AND v_lease.metadata->'tenant_cancellation'->>'actor_id'=p_actor_id::text THEN
      RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'replayed',true);
    END IF;
    IF v_lease.state<>'pending' THEN
      RETURN jsonb_build_object('success',false,'status',409,'error','This request has already been decided. Refresh its status.');
    END IF;
    UPDATE public."HomeLease" SET state='canceled',updated_at=v_now,
      metadata=coalesce(metadata,'{}')||jsonb_build_object('tenant_cancellation',
        jsonb_build_object('actor_id',p_actor_id,'completed_at',v_now)) WHERE id=v_lease.id RETURNING * INTO v_lease;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id)
      VALUES(v_home_id,p_actor_id,'LEASE_REQUEST_CANCELED','HomeLease',v_lease.id);
    RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'replayed',false);
  END IF;
  IF p_action IN ('approve','accept','request','invite') AND v_home.home_type='multi_unit' THEN
    RETURN jsonb_build_object('success',false,'error','This is a multi-unit building. A unit number is required.');
  END IF;
  IF p_action IN ('approve','accept','request','invite') AND v_home.address_id IS NOT NULL THEN
    PERFORM id FROM public."HomeAddress" WHERE id=v_home.address_id FOR SHARE;
    v_now:=clock_timestamp();
    -- Keep the existing occupancy gateway's unresolved-unit boundary. Verified
    -- landlord authority does not turn a building-only address into a unit.
    IF EXISTS(SELECT FROM public."HomeAddress" WHERE id=v_home.address_id
      AND building_type='multi_unit' AND missing_secondary_flag) THEN
      RETURN jsonb_build_object('success',false,'error','This is a multi-unit building. A unit number is required.');
    END IF;
  END IF;
  IF (v_home.security_state IN ('frozen','frozen_silent')
    AND NOT (p_action IN ('end','move_out') AND coalesce(v_resident_actor,false)))
    OR v_home.home_status IN ('merged','archived') THEN
    RETURN jsonb_build_object('success',false,'error','This home is unavailable for lease decisions');
  END IF;
  IF p_action='invite' THEN
    v_invitee_email:=lower(trim(p_user_email));
    IF coalesce(v_invitee_email,'')='' OR length(v_invitee_email)>320
      OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' OR p_dates->>'start_at' IS NULL THEN
      RETURN jsonb_build_object('success',false,'status',400,'error','Invalid invitation details');
    END IF;
    BEGIN
      v_start:=(p_dates->>'start_at')::timestamptz; v_end:=(p_dates->>'end_at')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RETURN jsonb_build_object('success',false,'status',400,'error','Lease dates must be valid dates');
    END;
    IF NOT isfinite(v_start) OR (v_end IS NOT NULL AND NOT isfinite(v_end)) OR v_end<=v_start THEN
      RETURN jsonb_build_object('success',false,'status',400,'error','End date must be after the start date and must not have expired');
    END IF;
    -- A caller-retained random proof lets a lost creation reply recover the same
    -- existing invite. The hash lock also prevents reuse across different Homes.
    PERFORM pg_advisory_xact_lock(hashtextextended('home-lease-invite:'||p_token_hash,0));
    SELECT * INTO v_invite FROM public."HomeLeaseInvite" WHERE token_hash=p_token_hash ORDER BY id LIMIT 1;
    IF FOUND THEN
      IF v_invite.home_id<>v_home_id OR v_invite.landlord_subject_type<>v_authority.subject_type
        OR v_invite.landlord_subject_id<>v_authority.subject_id OR lower(trim(v_invite.invitee_email)) IS DISTINCT FROM v_invitee_email
        OR v_invite.proposed_start IS DISTINCT FROM v_start OR v_invite.proposed_end IS DISTINCT FROM v_end THEN
        RETURN jsonb_build_object('success',false,'status',409,'error','This invitation proof belongs to different details. Retry the original invitation.');
      END IF;
      IF v_invite.status NOT IN ('pending','accepted') OR (v_invite.status='pending' AND v_invite.expires_at<=clock_timestamp()) THEN
        RETURN jsonb_build_object('success',false,'status',410,'error','This invitation is closed or expired');
      END IF;
      RETURN jsonb_build_object('success',true,'invite',to_jsonb(v_invite),'replayed',true);
    END IF;
    IF v_end<=clock_timestamp() THEN
      RETURN jsonb_build_object('success',false,'status',400,'error','End date must not have expired');
    END IF;
    IF EXISTS(SELECT FROM public."HomeLeaseInvite" WHERE home_id=v_home_id
      AND lower(trim(invitee_email))=v_invitee_email AND status='pending' AND expires_at>clock_timestamp()) THEN
      RETURN jsonb_build_object('success',false,'status',409,'error','Pending invite already exists for this email');
    END IF;
    SELECT id INTO v_tenant_id FROM public."User" WHERE email=v_invitee_email LIMIT 1;
    v_now:=clock_timestamp();
    INSERT INTO public."HomeLeaseInvite"(home_id,landlord_subject_type,landlord_subject_id,invitee_email,invitee_user_id,
      token_hash,proposed_start,proposed_end,status,expires_at,created_at,updated_at)
    VALUES(v_home_id,v_authority.subject_type,v_authority.subject_id,v_invitee_email,v_tenant_id,
      p_token_hash,v_start,v_end,'pending',v_now+make_interval(days=>p_validity_days),v_now,v_now) RETURNING * INTO v_invite;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(v_home_id,p_actor_id,'TENANT_INVITED','HomeLeaseInvite',v_invite.id,
        jsonb_build_object('invitee_email',v_invitee_email,'proposed_start',v_start,'proposed_end',v_end));
    RETURN jsonb_build_object('success',true,'invite',to_jsonb(v_invite),'replayed',false,
      'home',jsonb_build_object('id',v_home_id,'name',v_home.name));
  END IF;
  IF p_action='request' THEN
    -- A status read binds a new submission to the actor's latest existing lease.
    -- A delayed original cannot recreate a request after its retry was canceled.
    -- Keep older clients compatible; new clients must send the observed context.
    IF p_request_context IS NOT NULL THEN
      SELECT id,state INTO v_latest_lease_id,v_latest_lease_state FROM public."HomeLease"
        WHERE home_id=v_home_id AND primary_resident_user_id=p_actor_id
        ORDER BY created_at DESC,id DESC LIMIT 1;
      IF p_request_context IS DISTINCT FROM jsonb_build_object(
        'home_id',v_home_id,'actor_id',p_actor_id,'lease_id',v_latest_lease_id,'lease_state',v_latest_lease_state) THEN
        RETURN jsonb_build_object('success',false,'status',409,
          'error','Your lease request status changed. Check its current status before submitting again.');
      END IF;
    END IF;
    -- The same Home lock serializes preflight and insert with both another
    -- submission and a landlord decision. No replacement request table/index
    -- or cleanup of ambiguous historical duplicates is necessary.
    IF v_lease.id IS NOT NULL THEN
      RETURN jsonb_build_object('success',false,'status',409,'error',
        CASE WHEN v_lease.state='pending' THEN 'You already have a pending request for this home'
          ELSE 'You already have an active lease at this home' END);
    END IF;
    IF length(p_message)>1000 THEN RETURN jsonb_build_object('success',false,'status',400,'error','Request message is too long'); END IF;
    BEGIN
      v_start:=coalesce((p_dates->>'start_at')::timestamptz,v_now);
      v_end:=(p_dates->>'end_at')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RETURN jsonb_build_object('success',false,'status',400,'error','Lease dates must be valid dates');
    END;
    IF NOT isfinite(v_start) OR (v_end IS NOT NULL AND NOT isfinite(v_end)) OR v_end<=v_start OR v_end<=v_now THEN
      RETURN jsonb_build_object('success',false,'status',400,'error','End date must be after the start date and must not have expired');
    END IF;
    INSERT INTO public."HomeLease"(home_id,primary_resident_user_id,start_at,end_at,state,source,metadata,created_at)
      VALUES(v_home_id,p_actor_id,v_start,v_end,'pending','tenant_request',jsonb_build_object('message',nullif(trim(p_message),'')),v_now)
      RETURNING * INTO v_lease;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(v_home_id,p_actor_id,'TENANT_REQUEST_SUBMITTED','HomeLease',v_lease.id,
        jsonb_build_object('source','tenant_request','message',nullif(trim(p_message),'')));
    RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'replayed',false,
      'authority',jsonb_build_object('subject_type',v_authority.subject_type,'subject_id',v_authority.subject_id));
  END IF;
  v_tenant_id:=CASE WHEN p_action='accept' THEN p_actor_id ELSE v_lease.primary_resident_user_id END;
  SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_home_id AND user_id=v_tenant_id;
  v_intent:=jsonb_build_object('action',p_action,'actor_id',p_actor_id,'authority_id',v_authority.id,
    'dates',p_dates,'reason',p_reason);
  v_receipt:=v_lease.metadata->'landlord_decision';
  IF p_action IN ('end','move_out') THEN
    v_end_receipt:=v_lease.metadata->'landlord_end';
    IF p_action='move_out' AND v_departure IS NOT NULL THEN
      SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_home_id AND user_id=p_actor_id;
      IF (v_co_departure AND v_resident.id IS NOT NULL)
        OR (v_occupancy.is_active AND (v_departure->>'occupancy_id' IS DISTINCT FROM v_occupancy.id::text
          OR v_departure->>'membership_version' IS DISTINCT FROM v_occupancy.membership_version::text)) THEN
        RETURN jsonb_build_object('success',false,'status',409,'error','Membership changed after move-out. Review your current home membership.');
      END IF;
      RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'replayed',true);
    END IF;
    IF p_action='end' AND v_lease.state='ended' AND v_end_receipt IS NOT NULL THEN
      RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'replayed',true);
    END IF;
    IF v_lease.state<>'active' AND NOT (p_action='move_out' AND v_lease.state='ended') THEN
      RETURN jsonb_build_object('success',false,'error','Cannot end: lease is '||v_lease.state);
    END IF;
    -- Validate all affected residents before any write. A co-resident's departure
    -- affects only that person; it cannot terminate the primary resident's lease.
    IF NOT v_co_departure AND v_lease.state='active' THEN
      FOR v_target_id IN SELECT v_lease.primary_resident_user_id UNION
        SELECT user_id FROM public."HomeLeaseResident" WHERE lease_id=v_lease.id LOOP
        IF p_action='move_out' AND v_target_id=p_actor_id THEN CONTINUE; END IF;
        SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_home_id AND user_id=v_target_id;
        IF v_occupancy.id IS NULL OR NOT v_occupancy.is_active THEN CONTINUE; END IF;
        IF v_home.owner_id=v_target_id OR v_occupancy.role_base='owner' OR EXISTS
          (SELECT FROM public."HomeOwner" WHERE home_id=v_home_id AND subject_type='user'
            AND subject_id=v_target_id AND owner_status='verified') THEN CONTINUE; END IF;
        IF v_target_id=v_lease.primary_resident_user_id AND v_receipt ? 'owns_membership' THEN
          IF v_receipt->>'owns_membership'='false'
            OR v_receipt->>'occupancy_id' IS DISTINCT FROM v_occupancy.id::text
            OR v_receipt->>'membership_version' IS DISTINCT FROM v_occupancy.membership_version::text THEN CONTINUE; END IF;
        ELSE
          -- Historical lease roles lack a generation binding. Preserve other
          -- household roles, and require explicit review for ambiguous access.
          IF coalesce(v_occupancy.role_base::text,v_occupancy.role) NOT IN ('lease_resident','tenant','renter') THEN CONTINUE; END IF;
          RETURN jsonb_build_object('success',false,'error','Historical lease membership requires review before ending access');
        END IF;
        SELECT EXISTS(SELECT FROM public."HomeLease" other WHERE other.home_id=v_home_id
          AND other.id<>v_lease.id AND other.state='active' AND (other.end_at IS NULL OR other.end_at>v_now)
          AND (other.primary_resident_user_id=v_target_id OR EXISTS(SELECT FROM public."HomeLeaseResident" lr
            WHERE lr.lease_id=other.id AND lr.user_id=v_target_id))) INTO v_other_lease;
        IF v_other_lease THEN
          RETURN jsonb_build_object('success',false,'error','Overlapping lease membership requires review before ending access');
        END IF;
        v_detach_ids:=array_append(v_detach_ids,v_occupancy.id);
      END LOOP;
    END IF;
    IF p_action='move_out' THEN
      SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_home_id AND user_id=p_actor_id;
      IF v_occupancy.id IS NOT NULL THEN
        -- Explicit self-departure uses the already accepted removal policy,
        -- including ownership transfer, scoped grants and residency letters.
        v_removal:=public.apply_home_member_removal(v_home_id,p_actor_id,p_actor_id);
        IF v_removal->>'ok' IS DISTINCT FROM 'true' THEN
          RETURN jsonb_build_object('success',false,'status',coalesce((v_removal->>'status')::integer,400),
            'error',CASE WHEN v_removal->>'code'='TRANSFER_REQUIRED' THEN 'Transfer home ownership before moving out.'
              ELSE 'Could not remove your home membership. Review your current home membership.' END);
        END IF;
        SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_home_id AND user_id=p_actor_id;
      END IF;
      v_now:=clock_timestamp();
      v_departure:=jsonb_build_object('completed_at',v_now,'reason',p_reason,'resident_id',v_resident.id,
        'occupancy_id',v_occupancy.id,'membership_version',v_occupancy.membership_version);
      UPDATE public."HomeLease" SET metadata=coalesce(metadata,'{}')||jsonb_build_object('resident_departures',
        coalesce(metadata->'resident_departures','{}')||jsonb_build_object(p_actor_id::text,v_departure)),updated_at=v_now
        WHERE id=v_lease.id RETURNING * INTO v_lease;
      IF v_co_departure THEN
        DELETE FROM public."HomeLeaseResident" WHERE id=v_resident.id;
      END IF;
      INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,before_data,metadata)
        VALUES(v_home_id,p_actor_id,'TENANT_MOVE_OUT','HomeLease',v_lease.id,to_jsonb(v_resident),
          jsonb_build_object('reason',p_reason,'initiated_by','tenant','occupancy_id',v_occupancy.id));
    END IF;
    IF NOT v_co_departure AND v_lease.state='active' THEN
      FOR v_occupancy IN SELECT * FROM public."HomeOccupancy" WHERE id=ANY(v_detach_ids) LOOP
        UPDATE public."HomeOccupancy" SET is_active=false,end_at=least(coalesce(end_at,v_now),v_now),
          access_end_at=least(coalesce(access_end_at,v_now),v_now),verification_status='inactive',
          can_manage_home=false,can_manage_access=false,can_manage_finance=false,
          can_manage_tasks=false,can_view_sensitive=false,updated_at=v_now WHERE id=v_occupancy.id;
        DELETE FROM public."HomePermissionOverride" WHERE home_id=v_home_id AND user_id=v_occupancy.user_id;
        UPDATE public."HomeScopedGrant" SET end_at=v_now,updated_at=v_now
          WHERE home_id=v_home_id AND grantee_user_id=v_occupancy.user_id AND (end_at IS NULL OR end_at>v_now);
        UPDATE public."ResidencyLetter" SET status='revoked',revoked_at=v_now,revoke_reason='residency_ended'
          WHERE home_id=v_home_id AND user_id=v_occupancy.user_id AND status='issued';
        INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
          VALUES(v_home_id,p_actor_id,'OCCUPANCY_DETACHED','HomeOccupancy',v_occupancy.id,
            jsonb_build_object('lease_id',v_lease.id,'reason','lease_ended'));
      END LOOP;
      UPDATE public."HomeLease" SET state='ended',end_at=v_now,updated_at=v_now,
        metadata=coalesce(metadata,'{}')||jsonb_build_object('landlord_end',jsonb_build_object(
          'actor_id',p_actor_id,'action',p_action,'reason',p_reason,'completed_at',v_now,'detached_occupancy_ids',v_detach_ids))
        WHERE id=v_lease.id RETURNING * INTO v_lease;
      INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
        VALUES(v_home_id,p_actor_id,'LEASE_ENDED','HomeLease',v_lease.id,
          jsonb_build_object('tenant_user_id',v_tenant_id,'initiated_by',p_actor_id));
    END IF;
    RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'replayed',false);
  END IF;
  IF v_receipt IS NOT NULL THEN
    IF v_receipt->'intent' IS DISTINCT FROM v_intent THEN
      RETURN jsonb_build_object('success',false,'error','Lease already has a different completed decision');
    END IF;
    IF p_action='deny' AND v_lease.state='canceled' THEN
      RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'replayed',true);
    END IF;
    -- A receipt is a read, never permission to resurrect or rewrite membership.
    -- Future-start membership is replayable, but expired/removed/replaced is not.
    IF v_lease.state<>'active' OR (p_action='accept' AND v_invite.status<>'accepted')
      OR v_occupancy.id IS NULL OR NOT v_occupancy.is_active
      OR v_occupancy.verification_status<>'verified'
      OR v_receipt->>'occupancy_id' IS DISTINCT FROM v_occupancy.id::text
      OR v_receipt->>'membership_version' IS DISTINCT FROM v_occupancy.membership_version::text
      OR v_lease.end_at<=v_now OR v_occupancy.end_at<=v_now OR v_occupancy.access_end_at<=v_now THEN
      RETURN jsonb_build_object('success',false,'error','Lease completed; current membership requires a new review');
    END IF;
    RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'occupancy',to_jsonb(v_occupancy),'replayed',true);
  END IF;
  IF p_action='accept' THEN
    IF v_invite.status<>'pending' OR v_lease.id IS NOT NULL THEN
      RETURN jsonb_build_object('success',false,'error','Invite already completed; current membership requires a new review');
    END IF;
    IF v_invite.expires_at<=v_now THEN
      RETURN jsonb_build_object('success',false,'error','Invite has expired');
    END IF;
    v_start:=coalesce(v_invite.proposed_start,v_now); v_end:=v_invite.proposed_end;
  ELSE
    IF v_lease.state<>'pending' THEN
      RETURN jsonb_build_object('success',false,'error','Cannot decide: lease is '||v_lease.state);
    END IF;
    BEGIN
      v_start:=CASE WHEN p_dates ? 'start_at' THEN (p_dates->>'start_at')::timestamptz ELSE v_lease.start_at END;
      v_end:=CASE WHEN p_dates ? 'end_at' THEN (p_dates->>'end_at')::timestamptz ELSE v_lease.end_at END;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RETURN jsonb_build_object('success',false,'error','Lease dates must be valid dates');
    END;
  END IF;
  IF p_action IN ('approve','accept') AND v_occupancy.is_active AND EXISTS
    (SELECT FROM public."HomeLease" other WHERE other.home_id=v_home_id AND other.id IS DISTINCT FROM v_lease.id
      AND other.state='active' AND (other.end_at IS NULL OR other.end_at>v_now)
      AND other.metadata->'landlord_decision'->>'owns_membership'='true'
      AND other.metadata->'landlord_decision'->>'occupancy_id'=v_occupancy.id::text
      AND other.metadata->'landlord_decision'->>'membership_version'=v_occupancy.membership_version::text) THEN
    RETURN jsonb_build_object('success',false,'error','An existing active lease must be resolved before another lease grants access');
  END IF;
  IF p_action='deny' THEN
    UPDATE public."HomeLease" SET state='canceled',updated_at=v_now,
      metadata=coalesce(metadata,'{}')||jsonb_build_object('denial_reason',p_reason,
        'landlord_decision',jsonb_build_object('intent',v_intent)) WHERE id=v_lease.id RETURNING * INTO v_lease;
  ELSE
    IF v_start IS NULL OR NOT isfinite(v_start) OR (v_end IS NOT NULL AND NOT isfinite(v_end)) THEN
      RETURN jsonb_build_object('success',false,'error','Lease dates must be valid dates');
    END IF;
    IF v_end<=v_start THEN RETURN jsonb_build_object('success',false,'error','End date must be after start date'); END IF;
    IF v_end<=v_now THEN RETURN jsonb_build_object('success',false,'error','Lease has expired'); END IF;
    v_current:=coalesce(v_occupancy.is_active AND v_occupancy.verification_status='verified'
      AND public.home_invite_role(coalesce(v_occupancy.role_base::text,v_occupancy.role)) IS NOT NULL
      AND (v_occupancy.start_at IS NULL OR v_occupancy.start_at<=v_now)
      AND (v_occupancy.access_start_at IS NULL OR v_occupancy.access_start_at<=v_now)
      AND (v_occupancy.end_at IS NULL OR v_occupancy.end_at>v_now)
      AND (v_occupancy.access_end_at IS NULL OR v_occupancy.access_end_at>v_now),false);
    IF NOT v_current THEN
      IF v_home.owner_id=v_tenant_id OR v_occupancy.role_base='owner' OR EXISTS
        (SELECT FROM public."HomeOwner" WHERE home_id=v_home_id AND subject_type='user'
          AND subject_id=v_tenant_id AND owner_status='verified') THEN
        RETURN jsonb_build_object('success',false,'error','Existing ownership requires a separate review');
      END IF;
      -- Fresh proof admits only lease residency. Old elevated grants must not
      -- return with an expired/removed membership; explicit denies remain.
      DELETE FROM public."HomePermissionOverride" WHERE home_id=v_home_id AND user_id=v_tenant_id AND allowed;
      v_role:=CASE v_occupancy.age_band WHEN 'child' THEN 'restricted_member'
        WHEN 'teen' THEN 'member' ELSE 'lease_resident' END::public.home_role_base;
      v_permissions:=public.home_member_policy_permissions(v_home_id,v_tenant_id,v_role,v_occupancy.age_band);
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,
        start_at,end_at,access_start_at,access_end_at,added_by_user_id,verification_status,verification_source,
        verified_at,verification_expires_at,can_manage_home,can_manage_access,can_manage_finance,
        can_manage_tasks,can_view_sensitive,updated_at)
      VALUES(v_home_id,v_tenant_id,v_role::text,v_role,true,v_start,v_end,v_start,v_end,p_actor_id,
        'verified','address',v_now,v_now+make_interval(days=>p_validity_days),false,false,false,
        'tasks.edit'=ANY(v_permissions) OR 'tasks.manage'=ANY(v_permissions),
        'sensitive.view'=ANY(v_permissions),v_now)
      ON CONFLICT(home_id,user_id) DO UPDATE SET role=EXCLUDED.role,role_base=EXCLUDED.role_base,
        is_active=true,start_at=EXCLUDED.start_at,end_at=EXCLUDED.end_at,
        access_start_at=EXCLUDED.access_start_at,access_end_at=EXCLUDED.access_end_at,
        added_by_user_id=EXCLUDED.added_by_user_id,verification_status='verified',verification_source='address',
        verified_at=EXCLUDED.verified_at,verification_expires_at=EXCLUDED.verification_expires_at,
        can_manage_home=false,can_manage_access=false,can_manage_finance=false,
        can_manage_tasks=EXCLUDED.can_manage_tasks,can_view_sensitive=EXCLUDED.can_view_sensitive,updated_at=v_now
      RETURNING * INTO v_occupancy;
    END IF;
    -- A newly approved lease is address proof even for a current household
    -- member; preserve their existing membership and permission projections.
    IF v_current AND v_occupancy.verification_source IS DISTINCT FROM 'address' THEN
      UPDATE public."HomeOccupancy" SET verification_source='address' WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    END IF;
    IF p_action='accept' THEN
      INSERT INTO public."HomeLease"(home_id,primary_resident_user_id,start_at,end_at,state,source,
        approved_by_subject_type,approved_by_subject_id,metadata)
      VALUES(v_home_id,v_tenant_id,v_start,v_end,'active','landlord_invite',v_authority.subject_type,
        v_authority.subject_id,jsonb_build_object('invite_id',v_invite.id)) RETURNING * INTO v_lease;
      UPDATE public."HomeLeaseInvite" SET status='accepted',invitee_user_id=p_actor_id,updated_at=v_now WHERE id=v_invite.id;
    END IF;
    INSERT INTO public."HomeLeaseResident"(lease_id,user_id) VALUES(v_lease.id,v_tenant_id) ON CONFLICT(lease_id,user_id) DO NOTHING;
    UPDATE public."HomeLease" SET state='active',start_at=v_start,end_at=v_end,
      approved_by_subject_type=v_authority.subject_type,approved_by_subject_id=v_authority.subject_id,
      metadata=coalesce(metadata,'{}')||jsonb_build_object('landlord_decision',jsonb_build_object(
        'intent',v_intent,'occupancy_id',v_occupancy.id,'membership_version',v_occupancy.membership_version,
        'owns_membership',NOT v_current)),
      updated_at=v_now WHERE id=v_lease.id RETURNING * INTO v_lease;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=v_home_id AND vacancy_at IS NOT NULL AND v_start<=v_now;
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(v_home_id,p_actor_id,CASE p_action WHEN 'accept' THEN 'LEASE_INVITE_ACCEPTED'
      WHEN 'approve' THEN 'LEASE_APPROVED' ELSE 'LEASE_DENIED' END,'HomeLease',v_lease.id,
      jsonb_build_object('authority_id',v_authority.id,'tenant_user_id',v_tenant_id,'invite_id',v_invite.id,'reason',p_reason));
  RETURN jsonb_build_object('success',true,'lease',to_jsonb(v_lease),'occupancy',
    CASE WHEN p_action='deny' THEN NULL ELSE to_jsonb(v_occupancy) END,'replayed',false);
END $$;

-- Latest permitted source: supabase/migrations/20260909194500_home_postcard_confirmation.sql:4
CREATE OR REPLACE FUNCTION public.confirm_home_postcard(
  p_home_id uuid, p_user_id uuid, p_submitted_hash text, p_templates jsonb, p_validity_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE
 v_card public."HomePostcardCode"%ROWTYPE; v_home public."Home"%ROWTYPE;
 v_occ public."HomeOccupancy"%ROWTYPE; v_claim public."HomeResidencyClaim"%ROWTYPE;
 v_template jsonb; v_status text; v_has_authorities boolean; v_existing boolean;
BEGIN
 IF p_home_id IS NULL OR p_user_id IS NULL OR p_submitted_hash IS NULL
 OR p_submitted_hash !~ '^[0-9a-f]{64}$' OR p_templates IS NULL
 OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
 RAISE EXCEPTION 'Invalid postcard confirmation' USING ERRCODE='22023'; END IF;
 -- Same per-Home lock as admission. Row locks make guesses, successful retries
 -- and occupancy/proof writes one transaction, never read-then-increment guesses.
 PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:home:' || p_home_id::text,0));
 SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NO_POSTCARD'); END IF;
 SELECT * INTO v_card FROM public."HomePostcardCode" WHERE home_id=p_home_id AND user_id=p_user_id
 AND status IN ('pending','verified','expired')
 ORDER BY (status='pending') DESC,requested_at DESC,(code_hash=p_submitted_hash) DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NO_POSTCARD'); END IF;
 SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_user_id FOR UPDATE;
 v_existing := FOUND;
 SELECT * INTO v_claim FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_user_id
 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF v_home.security_state IN ('frozen','frozen_silent') OR v_claim.status='rejected' OR (v_existing AND (v_occ.is_active IS DISTINCT FROM true OR v_occ.end_at IS NOT NULL
 OR v_occ.access_end_at<=now() OR v_occ.access_start_at>now()
 OR v_occ.verification_status IN ('suspended','suspended_challenged','inactive','moved_out'))) THEN
 RETURN jsonb_build_object('error','ACCESS_REVOKED'); END IF;
 IF v_card.destination IS NOT NULL AND v_card.destination IS DISTINCT FROM jsonb_build_object(
 'address',v_home.address,'address2',v_home.address2,'city',v_home.city,'state',v_home.state,'zipcode',v_home.zipcode) THEN
 RETURN jsonb_build_object('error','ADDRESS_CHANGED'); END IF;

 IF v_card.status='verified' THEN
  IF v_card.code_hash IS DISTINCT FROM p_submitted_hash OR NOT v_existing THEN
   RETURN jsonb_build_object('error','NO_POSTCARD');
  END IF;
  -- A retry observes current access; it never restores a removed row, resets a
  -- challenge clock, extends verification age, or re-grants privileges.
  RETURN jsonb_build_object('reused',true,'postcard_id',v_card.id,'occupancy',to_jsonb(v_occ));
 END IF;
 IF v_card.attempts>=5 THEN RETURN jsonb_build_object('error','LOCKED'); END IF;
 IF v_card.status='expired' OR v_card.expires_at<=now() THEN
  UPDATE public."HomePostcardCode" SET status='expired',updated_at=now() WHERE id=v_card.id;
  RETURN jsonb_build_object('error','EXPIRED');
 END IF;
 IF v_card.code_hash IS DISTINCT FROM p_submitted_hash THEN
  UPDATE public."HomePostcardCode" SET attempts=attempts+1,
   status=CASE WHEN attempts+1>=5 THEN 'expired' ELSE status END,updated_at=now() WHERE id=v_card.id;
  RETURN jsonb_build_object('error','WRONG_CODE','attempts_remaining',4-v_card.attempts);
 END IF;

 -- Existing verified membership is independently granted; a postcard neither
 -- promotes nor downgrades it. Pending/self-claimed owner roles are never trusted.
 IF NOT (v_existing AND v_occ.verification_status='verified') THEN
  SELECT (v_home.owner_id IS NOT NULL AND v_home.owner_id<>p_user_id)
   OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND owner_status='verified' AND subject_id<>p_user_id)
   OR EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND is_active=true
   AND user_id<>p_user_id AND role_base IN ('owner','admin','manager')) INTO v_has_authorities;
  v_status := CASE WHEN v_has_authorities THEN 'provisional' ELSE 'verified' END;
  v_template := p_templates->CASE WHEN v_has_authorities THEN 'provisional'
   WHEN v_occ.age_band='child' THEN 'child' WHEN v_occ.age_band='teen' THEN 'teen' ELSE 'adult' END;
  -- Templates originate in applyOccupancyTemplate(dryRun), the shared IAM
  -- policy. This transaction additionally caps every mail grant at member.
  IF v_template IS NULL OR v_template->>'role_base' IS DISTINCT FROM
   (CASE WHEN v_has_authorities THEN 'restricted_member' ELSE 'member' END)
   OR (v_template->>'can_manage_home')::boolean IS DISTINCT FROM false
   OR (v_template->>'can_manage_access')::boolean IS DISTINCT FROM false
   OR (v_template->>'can_manage_finance')::boolean IS DISTINCT FROM false
   OR (v_template->>'can_manage_tasks')::boolean IS NULL OR (v_template->>'can_view_sensitive')::boolean IS NULL
   OR (v_has_authorities AND ((v_template->>'can_manage_tasks')::boolean OR (v_template->>'can_view_sensitive')::boolean))
   OR (v_occ.age_band IN ('child','teen') AND (v_template->>'can_view_sensitive')::boolean) THEN
   RAISE EXCEPTION 'Invalid postcard occupancy template' USING ERRCODE='22023';
  END IF;
  INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,is_active,verification_status,verification_source,
    can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive,
    verified_at,verification_expires_at,challenge_window_started_at,challenge_window_ends_at)
   VALUES (p_home_id,p_user_id,'member',(v_template->>'role_base')::public.home_role_base,true,v_status,'address',
    false,false,false,(v_template->>'can_manage_tasks')::boolean,(v_template->>'can_view_sensitive')::boolean,
    CASE WHEN NOT v_has_authorities THEN now() END,
    CASE WHEN NOT v_has_authorities THEN now()+p_validity_days*interval '1 day' END,
    CASE WHEN v_has_authorities THEN now() END,CASE WHEN v_has_authorities THEN now()+interval '7 days' END)
   ON CONFLICT (home_id,user_id) DO UPDATE SET role=excluded.role,role_base=excluded.role_base,
    verification_status=excluded.verification_status,verification_source=excluded.verification_source,can_manage_home=false,can_manage_access=false,can_manage_finance=false,
    can_manage_tasks=excluded.can_manage_tasks,can_view_sensitive=excluded.can_view_sensitive,
    verified_at=excluded.verified_at,verification_expires_at=excluded.verification_expires_at,
    challenge_window_started_at=excluded.challenge_window_started_at,challenge_window_ends_at=excluded.challenge_window_ends_at,
    updated_at=now()
   RETURNING * INTO v_occ;
 END IF;
 IF v_occ.verification_source IS DISTINCT FROM 'address' THEN
  UPDATE public."HomeOccupancy" SET verification_source='address' WHERE id=v_occ.id RETURNING * INTO v_occ;
 END IF;
 UPDATE public."HomePostcardCode" SET status='verified',verified_at=now(),attempts=attempts+1,updated_at=now() WHERE id=v_card.id;
 IF v_claim.id IS NOT NULL AND v_claim.status='pending' THEN
  UPDATE public."HomeResidencyClaim" SET status='verified',review_note='Verified via postcard code',reviewed_at=now(),updated_at=now()
   WHERE id=v_claim.id;
 END IF;
 IF v_occ.verification_status='verified' THEN
  UPDATE public."Home" SET vacancy_at=NULL,updated_at=now() WHERE id=p_home_id AND vacancy_at IS NOT NULL;
 END IF;
 INSERT INTO public."HomeAuditLog" (home_id,actor_user_id,action,target_type,target_id,metadata)
  VALUES (p_home_id,p_user_id,'POSTCARD_CODE_VERIFIED','HomePostcardCode',v_card.id,
   jsonb_build_object('verification_status',v_occ.verification_status,'role_base',v_occ.role_base,
    'challenge_window',v_occ.challenge_window_ends_at));
 RETURN jsonb_build_object('reused',false,'postcard_id',v_card.id,'occupancy',to_jsonb(v_occ));
END $$;

-- Latest permitted source: supabase/migrations/20260909204500_mail_verification_confirmation.sql:12
CREATE OR REPLACE FUNCTION public.confirm_mail_verification(
 p_attempt_id uuid,p_user_id uuid,p_submitted_hash text,p_templates jsonb,p_validity_days integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE
 a public."AddressVerificationAttempt"%ROWTYPE; t public."AddressVerificationToken"%ROWTYPE;
 j public."MailVerificationJob"%ROWTYPE; adr public."HomeAddress"%ROWTYPE;
 h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; c public."AddressClaim"%ROWTYPE;
 d jsonb; current_d jsonb; ids uuid[]; selected_home_id uuid; unit_key text; template jsonb;
 existing boolean; already_consumed boolean; has_destination boolean;
BEGIN
 IF p_attempt_id IS NULL OR p_user_id IS NULL OR p_submitted_hash IS NULL
 OR p_submitted_hash !~ '^[0-9a-f]{64}$' OR p_templates IS NULL
 OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650 THEN
  RAISE EXCEPTION 'Invalid mail confirmation' USING ERRCODE='22023';
 END IF;
 SELECT * INTO a FROM public."AddressVerificationAttempt"
  WHERE id=p_attempt_id AND user_id=p_user_id AND method='mail_code' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF a.status='locked' THEN RETURN jsonb_build_object('error','LOCKED'); END IF;
 IF a.status='expired' THEN RETURN jsonb_build_object('error','EXPIRED'); END IF;
 IF a.status NOT IN ('created','sent','delivered_unknown','verified') THEN RETURN jsonb_build_object('error','INACTIVE'); END IF;
 SELECT * INTO t FROM public."AddressVerificationToken" WHERE attempt_id=a.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 already_consumed := a.status='verified' AND t.used_at IS NOT NULL;
 IF NOT already_consumed AND (t.used_at IS NOT NULL OR a.status='verified') THEN
  RETURN jsonb_build_object('error','INCONSISTENT_PROOF');
 END IF;
 IF NOT already_consumed AND t.attempt_count>=t.max_attempts THEN
  UPDATE public."AddressVerificationAttempt" SET status='locked',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('error','LOCKED');
 END IF;
 IF NOT already_consumed AND a.expires_at<=now() THEN
  UPDATE public."AddressVerificationAttempt" SET status='expired',updated_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('error','EXPIRED');
 END IF;
 IF t.code_hash IS DISTINCT FROM p_submitted_hash THEN
  IF already_consumed THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
  IF a.expires_at<=now() THEN
   UPDATE public."AddressVerificationAttempt" SET status='expired',updated_at=now() WHERE id=a.id;
   RETURN jsonb_build_object('error','EXPIRED');
  END IF;
  UPDATE public."AddressVerificationToken" SET attempt_count=attempt_count+1 WHERE id=t.id;
  IF t.attempt_count+1>=t.max_attempts THEN
   UPDATE public."AddressVerificationAttempt" SET status='locked',updated_at=now() WHERE id=a.id;
   RETURN jsonb_build_object('error','LOCKED');
  END IF;
  RETURN jsonb_build_object('error','WRONG_CODE','attempts_remaining',t.max_attempts-t.attempt_count-1);
 END IF;
 SELECT * INTO j FROM public."MailVerificationJob" WHERE attempt_id=a.id
  ORDER BY coalesce((metadata->>'resend_number')::integer,0) DESC,created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 -- A completed retry only observes its original membership. Legacy consumed
 -- proofs without completion metadata can recover only before proof expiry.
 IF a.expires_at<=now() AND (NOT already_consumed OR j.metadata->>'confirmed_occupancy_id' IS NULL) THEN
  IF NOT already_consumed THEN UPDATE public."AddressVerificationAttempt" SET status='expired',updated_at=now() WHERE id=a.id; END IF;
  RETURN jsonb_build_object('error','EXPIRED');
 END IF;
 SELECT * INTO adr FROM public."HomeAddress" WHERE id=a.address_id FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','ADDRESS_CHANGED'); END IF;
 IF nullif(btrim(adr.address_line2_norm),'') IS NOT NULL AND nullif(btrim(j.metadata->>'unit'),'') IS NOT NULL
 AND public.mail_address_unit_key(adr.address_line2_norm)<>public.mail_address_unit_key(j.metadata->>'unit') THEN
  RETURN jsonb_build_object('error','ADDRESS_CHANGED');
 END IF;
 current_d:=jsonb_build_object('line1',adr.address_line1_norm,
  'line2',coalesce(nullif(btrim(adr.address_line2_norm),''),nullif(btrim(j.metadata->>'unit'),'')),
  'city',adr.city_norm,'state',adr.state,'zip',adr.postal_code);
 has_destination:=jsonb_typeof(j.metadata->'destination')='object';
 IF has_destination THEN d:=j.metadata->'destination';
 ELSIF current_d->>'line2' IS NULL AND adr.building_type IS DISTINCT FROM 'multi_unit'
 AND adr.missing_secondary_flag IS DISTINCT FROM true THEN d:=current_d;
 ELSE RETURN jsonb_build_object('error','UNBOUND_DESTINATION'); END IF;
 IF EXISTS(SELECT FROM unnest(ARRAY['line1','city','state','zip']) k
  WHERE public.mail_address_text_key(d->>k)<>public.mail_address_text_key(current_d->>k))
 OR public.mail_address_unit_key(d->>'line2')<>public.mail_address_unit_key(current_d->>'line2') THEN
  RETURN jsonb_build_object('error','ADDRESS_CHANGED');
 END IF;
 IF has_destination IS DISTINCT FROM true AND (SELECT count(*) FROM public."Home" WHERE address_id=a.address_id)<>1 THEN
  RETURN jsonb_build_object('error','UNBOUND_DESTINATION');
 END IF;
 unit_key:=public.mail_address_unit_key(d->>'line2');
 SELECT array_agg(id ORDER BY id) INTO ids FROM public."Home"
  WHERE address_id=a.address_id
   AND public.mail_address_unit_key(coalesce(nullif(btrim(address2),''),adr.address_line2_norm))=unit_key;
 IF coalesce(cardinality(ids),0)<>1 THEN RETURN jsonb_build_object('error','AMBIGUOUS_HOME'); END IF;
 selected_home_id:=ids[1];
 -- Share the native postcard Home lock; the row lock also blocks ordinary
 -- address edits and access transitions while confirmation commits.
 PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:home:'||selected_home_id::text,0));
 SELECT * INTO h FROM public."Home" WHERE id=selected_home_id FOR UPDATE;
 IF NOT FOUND OR h.address_id IS DISTINCT FROM a.address_id
 OR public.mail_address_text_key(h.address)<>public.mail_address_text_key(d->>'line1')
 OR public.mail_address_text_key(h.city)<>public.mail_address_text_key(d->>'city')
 OR public.mail_address_text_key(h.state)<>public.mail_address_text_key(d->>'state')
 OR public.mail_address_text_key(h.zipcode)<>public.mail_address_text_key(d->>'zip')
 OR public.mail_address_unit_key(coalesce(nullif(btrim(h.address2),''),adr.address_line2_norm))<>unit_key THEN
  RETURN jsonb_build_object('error','ADDRESS_CHANGED');
 END IF;
 -- Home address edits need not replace address_id. Compare the locked Home's
 -- fields above as well as the canonical address, so that link cannot move
 -- mailed proof to a different street, city, state or postal code.
 -- The Home row lock blocks new foreign-key inserts, but not promotions or
 -- reactivations of existing owner/occupancy rows. Lock even pending/inactive
 -- rows before reading authority; a preceding transition must finish first.
 PERFORM 1 FROM public."HomeOwner" WHERE "HomeOwner".home_id=h.id ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public."HomeOccupancy" WHERE "HomeOccupancy".home_id=h.id ORDER BY id FOR UPDATE;
 SELECT * INTO o FROM public."HomeOccupancy" WHERE "HomeOccupancy".home_id=h.id AND user_id=p_user_id FOR UPDATE;
 existing:=FOUND;
 SELECT * INTO c FROM public."AddressClaim" WHERE user_id=p_user_id AND address_id=a.address_id
  AND public.mail_address_unit_key(coalesce(nullif(btrim(unit_number),''),adr.address_line2_norm))=unit_key
  ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF h.security_state IN ('frozen','frozen_silent') OR c.claim_status='rejected'
 OR (existing AND (o.is_active IS DISTINCT FROM true OR o.end_at IS NOT NULL
 OR o.access_start_at>now() OR o.access_end_at<=now()
 OR o.verification_status IN ('suspended','suspended_challenged','inactive','moved_out'))) THEN
  RETURN jsonb_build_object('error','ACCESS_REVOKED');
 END IF;
 IF already_consumed AND j.metadata->>'confirmed_occupancy_id' IS NOT NULL THEN
  IF NOT existing OR o.verification_status IS DISTINCT FROM 'verified'
  OR o.id::text IS DISTINCT FROM j.metadata->>'confirmed_occupancy_id'
  OR h.id::text IS DISTINCT FROM j.metadata->>'confirmed_home_id' THEN
   RETURN jsonb_build_object('error','ACCESS_REVOKED');
  END IF;
  RETURN jsonb_build_object('reused',true,'occupancy',to_jsonb(o));
 END IF;
 -- Admission sends occupied households to their existing residents. Recheck
 -- here if another resident/authority arrived after the postcard was sent.
 IF NOT (existing AND o.verification_status='verified') THEN
  IF (h.owner_id IS NOT NULL AND h.owner_id<>p_user_id)
  OR EXISTS(SELECT FROM public."HomeOwner" WHERE "HomeOwner".home_id=h.id AND owner_status='verified' AND subject_id<>p_user_id)
  OR EXISTS(SELECT FROM public."HomeOccupancy" WHERE "HomeOccupancy".home_id=h.id AND user_id<>p_user_id AND is_active=true) THEN
   RETURN jsonb_build_object('error','HOME_OCCUPIED');
  END IF;
  template:=p_templates->CASE WHEN o.age_band='child' THEN 'child' WHEN o.age_band='teen' THEN 'teen' ELSE 'adult' END;
  IF template IS NULL OR template->>'role_base' IS DISTINCT FROM 'member'
  OR (template->>'can_manage_home')::boolean IS DISTINCT FROM false
  OR (template->>'can_manage_access')::boolean IS DISTINCT FROM false
  OR (template->>'can_manage_finance')::boolean IS DISTINCT FROM false
  OR (template->>'can_manage_tasks')::boolean IS NULL OR (template->>'can_view_sensitive')::boolean IS NULL
  OR (o.age_band='child' AND (template->>'can_manage_tasks')::boolean)
  OR (o.age_band IN ('child','teen') AND (template->>'can_view_sensitive')::boolean) THEN
   RAISE EXCEPTION 'Invalid mail membership template' USING ERRCODE='22023';
  END IF;
  INSERT INTO public."HomeOccupancy" (home_id,user_id,role,role_base,is_active,verification_status,verification_source,
   can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive,verified_at,verification_expires_at)
  VALUES (h.id,p_user_id,'member','member',true,'verified','address',false,false,false,
   (template->>'can_manage_tasks')::boolean,(template->>'can_view_sensitive')::boolean,now(),now()+p_validity_days*interval '1 day')
  ON CONFLICT (home_id,user_id) DO UPDATE SET
   role=excluded.role,role_base=excluded.role_base,verification_status=excluded.verification_status,verification_source=excluded.verification_source,
   can_manage_home=false,can_manage_access=false,can_manage_finance=false,
   can_manage_tasks=excluded.can_manage_tasks,can_view_sensitive=excluded.can_view_sensitive,
   verified_at=excluded.verified_at,verification_expires_at=excluded.verification_expires_at,updated_at=now()
  RETURNING * INTO o;
 END IF;
 IF o.verification_source IS DISTINCT FROM 'address' THEN
  UPDATE public."HomeOccupancy" SET verification_source='address' WHERE id=o.id RETURNING * INTO o;
 END IF;
 UPDATE public."AddressVerificationAttempt" SET status='verified',updated_at=now() WHERE id=a.id;
 UPDATE public."AddressVerificationToken" SET used_at=coalesce(used_at,now()),
  attempt_count=attempt_count+CASE WHEN already_consumed THEN 0 ELSE 1 END WHERE id=t.id;
 UPDATE public."AddressClaim" SET claim_status='verified',verification_method='mail_code',updated_at=now()
  WHERE user_id=p_user_id AND address_id=a.address_id AND claim_status='pending'
  AND public.mail_address_unit_key(coalesce(nullif(btrim(unit_number),''),adr.address_line2_norm))=unit_key;
 UPDATE public."MailVerificationJob" SET metadata=metadata||jsonb_build_object('confirmed_home_id',h.id,'confirmed_occupancy_id',o.id),updated_at=now() WHERE id=j.id;
 UPDATE public."Home" SET vacancy_at=NULL,updated_at=now() WHERE id=h.id AND vacancy_at IS NOT NULL;
 INSERT INTO public."HomeAuditLog" (home_id,actor_user_id,action,target_type,target_id,metadata)
  VALUES(h.id,p_user_id,'MAIL_CODE_VERIFIED','AddressVerificationAttempt',a.id,
   jsonb_build_object('verification_status',o.verification_status,'role_base',o.role_base));
 RETURN jsonb_build_object('reused',false,'occupancy',to_jsonb(o));
END $$;

-- Latest permitted source: supabase/migrations/20260930080000_home_task_default_visibility.sql:25
CREATE OR REPLACE FUNCTION public.mutate_home_record(p_home_id uuid,p_actor_id uuid,p_kind text,p_action text,
  p_record_id uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}',p_source_mail_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_payload jsonb:=p_payload; c jsonb; v_steps text[]; v_step text; v_targets uuid[];
  v_target uuid; v_ok boolean; v_before_status text; v_result jsonb;
BEGIN
  -- Supported task writers take this same Home lock before the preserved
  -- source-Mail/task locks. Capture the transition under that serialization.
  IF p_kind='task' AND p_action='update' AND p_payload->>'status'='done' THEN
    IF NOT public.lock_home_record_scope(p_home_id) THEN
      RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
    SELECT status INTO v_before_status FROM public."HomeTask" WHERE home_id=p_home_id AND id=p_record_id;
  END IF;
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
  v_result:=public.mutate_home_record_before_default_visibility(p_home_id,p_actor_id,p_kind,p_action,p_record_id,
    v_payload,p_source_mail_id);
  IF p_kind='task' AND p_action='update' AND p_payload->>'status'='done' AND v_result->>'ok'='true' THEN
    RETURN v_result||jsonb_build_object('task_completed',v_before_status IS NOT NULL
      AND v_before_status<>'done' AND v_result->'record'->>'status'='done'
      AND public.home_task_readable(jsonb_populate_record(NULL::public."HomeTask",v_result->'record'),
        (v_result->'record'->>'created_by')::uuid));
  END IF;
  RETURN v_result;
END $$;

-- Same service-only signatures and ACLs as the preserved definitions. Wrapper
-- internal grants/renames from prior migrations are unchanged.
REVOKE ALL ON FUNCTION public.act_on_home_invitation(uuid,text,uuid,text,integer),
 public.review_home_residency(uuid,uuid,text,jsonb,integer),
 public.mutate_home_claim_invitation(uuid,uuid,uuid,text,uuid,text,text,integer),
 public.verify_home_postcard_current(uuid,uuid,uuid,uuid,text,integer),
 public.promote_home_postcard_review(uuid,uuid,uuid,integer),
 public.mutate_home_claim_review(uuid,uuid,uuid,text,text,text,boolean,integer),
 public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer,uuid,text,jsonb),
 public.confirm_home_postcard(uuid,uuid,text,jsonb,integer),
 public.confirm_mail_verification(uuid,uuid,text,jsonb,integer),
 public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_home_invitation(uuid,text,uuid,text,integer),
 public.review_home_residency(uuid,uuid,text,jsonb,integer),
 public.mutate_home_claim_invitation(uuid,uuid,uuid,text,uuid,text,text,integer),
 public.verify_home_postcard_current(uuid,uuid,uuid,uuid,text,integer),
 public.promote_home_postcard_review(uuid,uuid,uuid,integer),
 public.mutate_home_claim_review(uuid,uuid,uuid,text,text,text,boolean,integer),
 public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer,uuid,text,jsonb),
 public.confirm_home_postcard(uuid,uuid,text,jsonb,integer),
 public.confirm_mail_verification(uuid,uuid,text,jsonb,integer),
 public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid) TO service_role;
