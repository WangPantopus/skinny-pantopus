-- Backwards compatible: yes. Retains the existing removal contract and grants;
-- old pending targeted invitations end with membership. Fresh invitations and
-- completed removal receipts keep their existing behavior.
BEGIN;
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.apply_home_member_removal(p_home_id uuid,p_actor_id uuid,p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; o public."HomeOccupancy"%ROWTYPE; t timestamptz; terminal boolean;
  changed boolean:=false; n integer; notify_ids uuid[]:='{}'::uuid[];
BEGIN
  r:=public.home_member_removal_context(p_home_id,p_actor_id,p_target_id);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  SELECT * INTO STRICT o FROM public."HomeOccupancy" WHERE id=(r->>'occupancy_id')::uuid;
  terminal:=(r->>'terminal')::boolean;t:=clock_timestamp();
  -- This marker concerns the completed membership removal, not the absence of
  -- later separately issued access. A retry must never sweep those later rows.
  IF NOT terminal THEN
    UPDATE public."HomeOccupancy" SET is_active=false,end_at=CASE WHEN end_at IS NULL OR NOT isfinite(end_at) THEN t ELSE least(end_at,t) END,
      verification_status=CASE WHEN p_actor_id=p_target_id THEN 'moved_out' ELSE 'inactive' END,
      can_manage_home=false,can_manage_access=false,can_manage_finance=false,
      can_manage_tasks=false,can_view_sensitive=false,updated_at=t WHERE id=o.id;
    changed:=true;
    -- A pending invitation from the previous membership must not admit the removed
    -- person again. All invitation writes use the same Home lock held by the
    -- removal context. A later invitation survives retries of this removal.
    UPDATE public."HomeInvite" i SET status='revoked'
      WHERE i.home_id=p_home_id AND i.status='pending' AND (
        i.invitee_user_id=p_target_id OR (i.invitee_user_id IS NULL AND EXISTS (
          SELECT FROM auth.users u WHERE u.id=p_target_id AND u.email_confirmed_at IS NOT NULL
            AND lower(btrim(u.email))=lower(btrim(i.invitee_email)))));
    DELETE FROM public."HomePermissionOverride" WHERE home_id=p_home_id AND user_id=p_target_id;
    UPDATE public."HomeScopedGrant" SET end_at=t,updated_at=t
      WHERE home_id=p_home_id AND grantee_user_id=p_target_id AND (end_at IS NULL OR end_at>t);
    UPDATE public."ResidencyLetter" SET status='revoked',revoked_at=t,revoke_reason='residency_ended'
      WHERE home_id=p_home_id AND user_id=p_target_id AND status='issued';
  END IF;
  IF p_actor_id=p_target_id AND (r->>'ownership_cleanup')::boolean THEN
    IF (r->>'stale_pointer')::boolean THEN
      UPDATE public."Home" SET owner_id=NULL,updated_at=t WHERE id=p_home_id AND owner_id=p_target_id;
      GET DIAGNOSTICS n=ROW_COUNT;changed:=changed OR n>0;
    END IF;
    UPDATE public."HomeOwner" SET owner_status='revoked',updated_at=t
      WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id
        AND NOT is_primary_owner AND owner_status IS DISTINCT FROM 'revoked';
    GET DIAGNOSTICS n=ROW_COUNT;changed:=changed OR n>0;
    IF NOT EXISTS(SELECT FROM (
      SELECT user_id FROM public."HomeOccupancy" WHERE home_id=p_home_id
      UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND owner_status='verified'
      UNION SELECT owner_id FROM public."Home" WHERE id=p_home_id AND owner_id IS NOT NULL
    ) remaining WHERE public.home_has_role_at_least(p_home_id,'manager',remaining.user_id)
      AND NOT EXISTS(SELECT FROM public."HomeOccupancy" x WHERE x.home_id=p_home_id AND x.user_id=remaining.user_id
        AND (x.start_at>t OR x.end_at<=t OR x.access_start_at>t OR x.access_end_at<=t))) THEN
      UPDATE public."Home" SET vacancy_at=t,updated_at=t WHERE id=p_home_id AND vacancy_at IS NULL;
      GET DIAGNOSTICS n=ROW_COUNT;changed:=changed OR n>0;
    END IF;
  END IF;
  IF changed THEN
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,'member_remove','HomeOccupancy',o.id,
        jsonb_build_object('user_id',p_target_id,'role_base',NULL,'preset_key',NULL,'permission',NULL,'allowed',NULL));
    IF NOT terminal AND p_actor_id=p_target_id AND o.is_active THEN
      SELECT coalesce(array_agg(user_id),'{}'::uuid[]) INTO notify_ids FROM public."HomeOccupancy"
        WHERE home_id=p_home_id AND user_id<>p_target_id AND public.home_is_active_member(p_home_id,user_id)
          AND (start_at IS NULL OR start_at<=t) AND (end_at IS NULL OR end_at>t)
          AND (access_start_at IS NULL OR access_start_at<=t) AND (access_end_at IS NULL OR access_end_at>t);
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'code','MEMBER_UPDATED','role_base',NULL,'preset_key',NULL,'permission',NULL,'allowed',NULL,
    'changed',changed,'completed_at',CASE WHEN changed THEN t ELSE NULL END,'occupancy_id',o.id,
    'notify_user_ids',notify_ids,'reconciled_stale_occupancy',p_actor_id=p_target_id AND NOT o.is_active);
END $$;

REVOKE ALL ON FUNCTION public.apply_home_member_removal(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_home_member_removal(uuid,uuid,uuid) TO service_role;

-- An invitation starts when its row is issued, after admission takes the Home
-- lock, not when a transaction that may wait behind removal began.
ALTER TABLE public."HomeInvite" ALTER COLUMN created_at SET DEFAULT clock_timestamp();

CREATE OR REPLACE FUNCTION public.act_on_home_invitation(p_invite_id uuid,p_token text,p_actor_id uuid,
  p_action text,p_validity_days integer DEFAULT 365) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_invite public."HomeInvite"%ROWTYPE; v_home public."Home"%ROWTYPE;
  v_occupancy public."HomeOccupancy"%ROWTYPE; v_inviter public."User"%ROWTYPE;
  v_policy jsonb; v_target_policy jsonb; v_permissions jsonb; v_hash text; v_count integer;
  v_now timestamptz; v_recipient boolean; v_open boolean; v_permission public.home_permission; v_source text;
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
  -- Bind renewal to a new invitation even if an email-bound invitation could
  -- not be matched to this account when removal ran (for example, the account
  -- changed its email and later changed it back). Open links retain the existing
  -- distinction between voluntary move-out and household removal below.
  IF NOT v_open AND EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id
    AND user_id=p_actor_id AND is_active=false AND v_invite.created_at<=end_at) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_ALREADY_USED','status',409); END IF;
  v_policy:=public.home_invite_policy(coalesce(v_invite.proposed_role_base::text,v_invite.proposed_role),
    CASE WHEN v_invite.proposed_preset_key LIKE 'access_request:%' THEN NULL ELSE v_invite.proposed_preset_key END);
  IF v_policy IS NULL OR (v_invite.admission_policy IS NOT NULL AND v_invite.admission_policy IS DISTINCT FROM v_policy) THEN
    RETURN jsonb_build_object('ok',false,'code','INVITE_POLICY_CHANGED','status',409); END IF;
  v_target_policy:=public.home_invite_target_policy(v_invite.home_id,v_invite.invited_by,p_actor_id,
    v_policy,v_invite.access_start_at,v_invite.access_end_at);
  IF v_target_policy->>'ok'<>'true' THEN RETURN v_target_policy; END IF;
  -- An invitation from someone whose own access is only a claim (no proof, not an owner) passes on that claim,
  -- not household trust: the new member is as unproven as the household that let them in.
  v_source:=CASE WHEN EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id
      AND user_id=v_invite.invited_by AND verification_source='claim')
    AND public.home_invite_authority(v_invite.home_id,v_invite.invited_by)->>'is_owner' IS DISTINCT FROM 'true'
    THEN 'claim' ELSE 'household' END;
  IF v_target_policy->>'existing_verified'='true' THEN
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
  ELSE
    SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
    -- A link anyone can open is not the household inviting this person back. A membership that ended
    -- any other way than leaving (removed by the household, suspended) returns only through an
    -- invitation addressed to that person (account or email) or an approved request. Someone who left
    -- on their own may use the link, as they may also apply again by themselves.
    IF FOUND AND v_target_policy->>'renewal'='true' AND v_open
      AND v_occupancy.verification_status IS DISTINCT FROM 'moved_out' THEN
      RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409); END IF;
    IF FOUND AND v_target_policy->>'renewal'='true' THEN
      -- Restore an ended membership as a new one (see home_invite_target_policy): nothing from the
      -- earlier membership comes back, including address verification and permission overrides.
      DELETE FROM public."HomePermissionOverride" WHERE home_id=v_invite.home_id AND user_id=p_actor_id;
      UPDATE public."HomeOccupancy" SET role=v_policy->>'role_base',role_base=(v_policy->>'role_base')::public.home_role_base,
        age_band=(v_target_policy->>'age_band')::public.home_age_band,is_active=true,start_at=now(),end_at=NULL,
        access_start_at=(v_target_policy->>'access_start_at')::timestamptz,
        access_end_at=(v_target_policy->>'access_end_at')::timestamptz,added_by_user_id=v_invite.invited_by,
        verification_status='verified',verification_source=v_source,verified_at=v_now,
        verification_expires_at=v_now+make_interval(days=>p_validity_days),
        challenge_window_started_at=NULL,challenge_window_ends_at=NULL,can_manage_home=false,can_manage_access=false,
        can_manage_finance=false,can_manage_tasks=false,can_view_sensitive=false,
        updated_at=v_now WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    ELSIF FOUND THEN
      UPDATE public."HomeOccupancy" SET role=v_policy->>'role_base',role_base=(v_policy->>'role_base')::public.home_role_base,
        age_band=(v_target_policy->>'age_band')::public.home_age_band,
        access_start_at=(v_target_policy->>'access_start_at')::timestamptz,
        access_end_at=(v_target_policy->>'access_end_at')::timestamptz,
        verification_status='verified',verification_source=CASE WHEN verification_source='address' OR (verification_status='verified' AND verification_source='legacy') THEN verification_source ELSE v_source END,verified_at=v_now,verification_expires_at=v_now+make_interval(days=>p_validity_days),
        updated_at=v_now WHERE id=v_occupancy.id RETURNING * INTO v_occupancy;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,
        access_start_at,access_end_at,added_by_user_id,verification_status,verification_source,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
        VALUES(v_invite.home_id,p_actor_id,v_policy->>'role_base',(v_policy->>'role_base')::public.home_role_base,
          (v_target_policy->>'age_band')::public.home_age_band,true,now(),
          (v_target_policy->>'access_start_at')::timestamptz,(v_target_policy->>'access_end_at')::timestamptz,
          v_invite.invited_by,'verified',v_source,v_now,v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
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

REVOKE ALL ON FUNCTION public.act_on_home_invitation(uuid,text,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_home_invitation(uuid,text,uuid,text,integer) TO service_role;

-- Repair invitations that already predate an ended membership. Lock each Home
-- first, matching admission/removal, and recheck the current membership after
-- waiting. Do not revoke a fresh invitation issued after the membership ended.
DO $$ DECLARE h uuid; BEGIN
  FOR h IN SELECT DISTINCT i.home_id FROM public."HomeInvite" i
    JOIN public."HomeOccupancy" o ON o.home_id=i.home_id
    LEFT JOIN auth.users u ON u.id=o.user_id
    WHERE i.status='pending' AND o.is_active=false AND i.created_at<=o.end_at
      AND (i.invitee_user_id=o.user_id OR (i.invitee_user_id IS NULL AND u.email_confirmed_at IS NOT NULL
        AND lower(btrim(u.email))=lower(btrim(i.invitee_email))))
    ORDER BY i.home_id
  LOOP
    PERFORM id FROM public."Home" WHERE id=h FOR UPDATE;
    UPDATE public."HomeInvite" i SET status='revoked'
      WHERE i.home_id=h AND i.status='pending' AND EXISTS (
        SELECT FROM public."HomeOccupancy" o LEFT JOIN auth.users u ON u.id=o.user_id
        WHERE o.home_id=h AND o.is_active=false AND i.created_at<=o.end_at
          AND (i.invitee_user_id=o.user_id OR (i.invitee_user_id IS NULL AND u.email_confirmed_at IS NOT NULL
            AND lower(btrim(u.email))=lower(btrim(i.invitee_email)))));
  END LOOP;
END $$;
COMMIT;
