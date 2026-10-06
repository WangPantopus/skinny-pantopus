-- Backwards compatible: yes. Redefines two internal invitation functions with the same
-- signatures and grants; no table, column or data change.
-- A household can invite back someone whose membership ended (they left or were removed).
--
-- Until now every invitation path refused an ended HomeOccupancy row with MEMBERSHIP_RENEWAL_REQUIRED,
-- so a person who tapped "Leave" by mistake, or was removed in error, could never be invited back:
-- the owner's send failed after review. A fresh invitation is the household's explicit consent, so it
-- now admits the person again on its own terms only. The self-service paths (Add Home, postcard,
-- residency and ownership claims) are unchanged and still refuse an ended row.
--
-- Both functions keep their signatures and service-only grants; grants are restated below.

CREATE OR REPLACE FUNCTION public.home_invite_target_policy(p_home_id uuid,p_inviter_id uuid,p_target_id uuid,
  p_policy jsonb,p_start_at timestamptz,p_end_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor jsonb; v_target public."HomeOccupancy"%ROWTYPE; v_has_target boolean; v_ended boolean;
  v_role public.home_role_base; v_old_role public.home_role_base; v_age public.home_age_band;
  v_permissions text[]; v_actor_permissions text[]; v_now timestamptz:=clock_timestamp();
  v_start timestamptz; v_end timestamptz;
BEGIN
  v_actor:=public.home_invite_authority(p_home_id,p_inviter_id);
  IF v_actor IS NULL THEN RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403); END IF;
  IF p_target_id=p_inviter_id THEN RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403); END IF;
  IF p_policy IS NULL THEN RETURN jsonb_build_object('ok',false,'code','INVITE_POLICY_INVALID','status',400); END IF;
  v_role:=(p_policy->>'role_base')::public.home_role_base;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  v_has_target:=FOUND;
  -- A membership that ended (the person left or was removed) is history, not current access. Only the
  -- household's fresh invitation (or an approved request to join, which becomes one) admits them again,
  -- and only on the new invitation's terms: its role and dates, household verification, and none of the
  -- old row's dates, permissions or address proof. Self-service paths (Add Home, postcard, claims) still
  -- refuse an ended row with MEMBERSHIP_RENEWAL_REQUIRED.
  v_ended:=v_has_target AND v_target.is_active IS DISTINCT FROM true;
  v_old_role:=coalesce(v_target.role_base,public.home_invite_role(v_target.role));
  IF EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND owner_id=p_target_id)
    OR v_old_role='owner' OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND subject_type='user' AND subject_id=p_target_id) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409); END IF;
  v_age:=CASE WHEN v_target.age_band='child' OR p_policy->>'age_ceiling'='child'
    THEN 'child'::public.home_age_band ELSE v_target.age_band END;
  v_start:=CASE WHEN v_ended THEN p_start_at ELSE greatest(v_target.start_at,v_target.access_start_at,p_start_at) END;
  v_end:=CASE WHEN v_ended THEN p_end_at ELSE least(v_target.end_at,v_target.access_end_at,p_end_at) END;
  IF v_end<=v_now OR v_start>=v_end OR (v_has_target AND NOT v_ended AND (
    v_old_role IS NULL
    OR v_target.verification_status IS NULL OR v_target.verification_status NOT IN
      ('verified','unverified','pending','pending_doc','pending_postcard','pending_approval','provisional_bootstrap')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409); END IF;
  IF v_has_target AND NOT v_ended AND v_target.verification_status='verified' THEN
    RETURN jsonb_build_object('ok',true,'existing_verified',true,'occupancy',to_jsonb(v_target)); END IF;
  IF v_role='owner' OR (v_actor->>'is_owner'<>'true' AND (
    public.home_role_rank(v_role)>=public.home_role_rank((v_actor->>'effective_role_base')::public.home_role_base)
    OR (v_has_target AND NOT v_ended AND public.home_role_rank(v_old_role)>=public.home_role_rank((v_actor->>'effective_role_base')::public.home_role_base))))
    OR (v_age='child' AND public.home_role_rank(v_role)>20)
    OR (v_age='teen' AND public.home_role_rank(v_role)>30) THEN
    RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403); END IF;
  v_permissions:=public.home_member_policy_permissions(p_home_id,p_target_id,v_role,v_age,p_policy->>'preset_key');
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_permissions;
  IF EXISTS(SELECT FROM unnest(v_permissions) p WHERE NOT p=ANY(v_actor_permissions))
    OR EXISTS(SELECT FROM jsonb_array_elements_text(p_policy->'grant_perms') p
      WHERE NOT p=ANY(v_actor_permissions) OR NOT public.home_authority_age_allows(v_age,p::public.home_permission)) THEN
    RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403); END IF;
  RETURN jsonb_build_object('ok',true,'existing_verified',false,'renewal',v_ended,'role_base',v_role,'age_band',v_age,
    'access_start_at',CASE WHEN v_ended THEN p_start_at ELSE greatest(v_target.access_start_at,p_start_at) END,
    'access_end_at',CASE WHEN v_ended THEN p_end_at ELSE least(v_target.access_end_at,p_end_at) END,'permissions',v_permissions);
END $$;

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
    IF FOUND AND v_target_policy->>'renewal'='true' THEN
      -- Restore an ended membership as a new one (see home_invite_target_policy): nothing from the
      -- earlier membership comes back, including address verification and permission overrides.
      DELETE FROM public."HomePermissionOverride" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
      UPDATE public."HomeOccupancy" SET role=v_policy->>'role_base',role_base=(v_policy->>'role_base')::public.home_role_base,
        age_band=(v_target_policy->>'age_band')::public.home_age_band,is_active=true,start_at=now(),end_at=NULL,
        access_start_at=(v_target_policy->>'access_start_at')::timestamptz,
        access_end_at=(v_target_policy->>'access_end_at')::timestamptz,added_by_user_id=v_invite.invited_by,
        verification_status='verified',verification_source='household',verified_at=v_now,
        verification_expires_at=v_now+make_interval(days=>p_validity_days),
        challenge_window_started_at=NULL,challenge_window_ends_at=NULL,can_manage_home=false,can_manage_access=false,
        can_manage_finance=false,can_manage_tasks=false,can_view_sensitive=false,
        updated_at=v_now WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    ELSIF FOUND THEN
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

REVOKE ALL ON FUNCTION public.home_invite_target_policy(uuid,uuid,uuid,jsonb,timestamptz,timestamptz),
  public.act_on_home_invitation(uuid,text,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_invite_target_policy(uuid,uuid,uuid,jsonb,timestamptz,timestamptz),
  public.act_on_home_invitation(uuid,text,uuid,text,integer) TO service_role;
