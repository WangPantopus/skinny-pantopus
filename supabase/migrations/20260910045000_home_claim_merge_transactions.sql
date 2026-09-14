-- Backwards compatible: yes. Existing claim invitation endpoints retain their
-- response shapes. Legacy claim invitations without a source/policy snapshot
-- require reissue; no identity, role defaults or existing memberships migrate.
SET LOCAL lock_timeout='5s';
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON
  public."HomeOwnershipClaim",public."HomeVerificationEvidence" FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.lock_home_claim_scope(p_home_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
  IF NOT public.lock_home_invitation_scope(p_home_id) THEN RETURN false; END IF;
  PERFORM id FROM public."HomeOwnershipClaim" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM e.id FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id
    WHERE c.home_id=p_home_id ORDER BY e.id FOR UPDATE OF e;
  RETURN true;
END $$;

CREATE FUNCTION public.home_claim_is_active(p_claim public."HomeOwnershipClaim") RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT p_claim.merged_into_claim_id IS NULL AND p_claim.terminal_reason='none'
    AND p_claim.state NOT IN ('approved','rejected','revoked') AND CASE WHEN p_claim.claim_phase_v2 IS NOT NULL
      THEN p_claim.claim_phase_v2 IN ('initiated','evidence_submitted','under_review','challenged')
      ELSE p_claim.state IN ('draft','submitted','needs_more_info','pending_review','pending_challenge_window') END;
$$;

CREATE FUNCTION public.home_claim_invitation_policy(p_claim public."HomeOwnershipClaim") RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role public.home_role_base; v_defaults jsonb;
BEGIN
  v_role:=CASE p_claim.claim_type WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin'
    WHEN 'resident' THEN 'lease_resident' ELSE NULL END::public.home_role_base;
  IF v_role IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('permission',permission,'allowed',allowed) ORDER BY permission),'[]')
    INTO v_defaults FROM public."HomeRolePermission" WHERE role_base=v_role;
  RETURN jsonb_build_object('version',1,'kind','claim_merge','claim_id',p_claim.id,
    'claimant_user_id',p_claim.claimant_user_id,'claim_type',p_claim.claim_type,'method',p_claim.method,'role_base',v_role,
    'role_defaults',v_defaults);
END $$;

CREATE FUNCTION public.home_claim_invitation_authority(p_home_id uuid,p_actor_id uuid,p_owner boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor jsonb;
BEGIN
  v_actor:=public.home_invite_authority(p_home_id,p_actor_id);
  IF v_actor IS NULL OR NOT (v_actor->'permissions') ? 'ownership.manage'
    OR (v_actor->>'effective_role_base') NOT IN ('owner','admin','manager') THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_MANAGE_REQUIRED','status',403); END IF;
  -- A role string alone cannot mint legal ownership. The historical primary
  -- pointer is compatible only in the complete absence of ownership history.
  IF p_owner AND (v_actor->>'is_owner' IS DISTINCT FROM 'true' OR NOT (
    EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_actor_id AND owner_status='verified') OR
    (EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND owner_id=p_actor_id)
      AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id)))) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNER_INVITE_AUTHORITY_REQUIRED','status',403); END IF;
  RETURN jsonb_build_object('ok',true,'access',v_actor);
END $$;

CREATE FUNCTION public.home_claim_invitation_target(p_home_id uuid,p_actor_id uuid,p_target_id uuid,p_role public.home_role_base)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_authority jsonb; v_actor jsonb; v_target public."HomeOccupancy"%ROWTYPE; v_has_target boolean;
  v_old_role public.home_role_base; v_permissions text[]; v_actor_permissions text[]; v_now timestamptz:=clock_timestamp();
BEGIN
  v_authority:=public.home_claim_invitation_authority(p_home_id,p_actor_id,p_role='owner');
  IF v_authority->>'ok'<>'true' THEN RETURN v_authority; END IF;
  v_actor:=v_authority->'access';
  IF p_actor_id=p_target_id THEN RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403); END IF;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  v_has_target:=FOUND; v_old_role:=coalesce(v_target.role_base,public.home_invite_role(v_target.role));
  IF v_has_target AND (v_target.is_active IS DISTINCT FROM true OR v_old_role IS NULL
    OR v_target.verification_status IS NULL OR v_target.verification_status NOT IN
      ('verified','unverified','pending','pending_doc','pending_postcard','pending_approval','provisional_bootstrap')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL)
    OR v_target.end_at<=v_now OR v_target.access_end_at<=v_now
    OR greatest(v_target.start_at,v_target.access_start_at)>=least(v_target.end_at,v_target.access_end_at)) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409); END IF;
  -- The distinct co-owner flow may promote a current adult household member,
  -- but must never restore revoked/disputed ownership or demote an owner.
  IF EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status IN ('revoked','disputed'))
    OR (p_role<>'owner' AND (v_old_role='owner'
      OR EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND owner_id=p_target_id)
      OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id)))
    OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status='pending' AND is_primary_owner) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_REVIEW_REQUIRED','status',409); END IF;
  IF (v_target.age_band='child' AND public.home_role_rank(p_role)>20)
    OR (v_target.age_band='teen' AND public.home_role_rank(p_role)>30)
    OR (v_actor->>'is_owner'<>'true' AND (public.home_role_rank(p_role)>=public.home_role_rank((v_actor->>'effective_role_base')::public.home_role_base)
      OR (v_has_target AND public.home_role_rank(v_old_role)>=public.home_role_rank((v_actor->>'effective_role_base')::public.home_role_base)))) THEN
    RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403); END IF;
  v_permissions:=public.home_member_policy_permissions(p_home_id,p_target_id,p_role,v_target.age_band);
  SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_permissions;
  IF EXISTS(SELECT FROM unnest(v_permissions) p WHERE NOT p=ANY(v_actor_permissions)) THEN
    RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403); END IF;
  RETURN jsonb_build_object('ok',true,'permissions',v_permissions);
END $$;

CREATE FUNCTION public.mutate_home_claim_invitation(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,p_action text,
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
      UPDATE public."HomeOccupancy" SET role=v_legacy_role,role_base=v_role,verification_status='verified',
        verified_at=CASE WHEN verification_status='verified' THEN verified_at ELSE v_now END,
        verification_expires_at=CASE WHEN verification_status='verified' THEN verification_expires_at
          ELSE v_now+make_interval(days=>p_validity_days) END,updated_at=v_now WHERE id=v_occ.id RETURNING * INTO v_occ;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,added_by_user_id,
        verification_status,verified_at,verification_expires_at,can_manage_home,can_manage_finance,
        can_manage_access,can_manage_tasks,can_view_sensitive)
        VALUES(p_home_id,p_actor_id,v_legacy_role,v_role,NULL,true,v_now,v_invite.invited_by,'verified',v_now,
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

REVOKE ALL ON FUNCTION public.lock_home_claim_scope(uuid),public.home_claim_is_active(public."HomeOwnershipClaim"),
  public.home_claim_invitation_policy(public."HomeOwnershipClaim"),public.home_claim_invitation_authority(uuid,uuid,boolean),
  public.home_claim_invitation_target(uuid,uuid,uuid,public.home_role_base),
  public.mutate_home_claim_invitation(uuid,uuid,uuid,text,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_claim_invitation(uuid,uuid,uuid,text,uuid,text,text,integer) TO service_role;
