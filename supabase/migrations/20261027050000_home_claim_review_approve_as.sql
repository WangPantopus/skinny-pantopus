-- Backwards compatible: yes. Replaces mutate_home_claim_review with the same body plus two optional trailing
-- parameters that default to today's behavior; every existing positional or named call keeps its meaning. The old
-- eight-argument signature is dropped in the same transaction so PostgREST never sees two candidates for one call.
-- The deployed backend never sends the new parameters.
--
-- Founder request 2026-10-26: approve a home claim from the admin review page as the role the platform admin picks,
-- and let the admin attest that they confirmed the claimant's identity, so approvals no longer need SQL.
--   p_role               platform admin approvals only; NULL keeps the role the claim type gives (owner -> owner,
--                        admin -> admin, resident -> lease_resident). One of the seven household roles.
--   p_identity_confirmed platform admin approvals only; counts as identity confirmation and records it on the claim
--                        (identity_status 'verified'), the receipt and the audit row. A 'failed' identity still refuses.
-- Proof is still required. A chosen owner or admin role still needs ownership proof; any other chosen role also
-- accepts a utility bill or lease, as a resident claim always has.
-- An owner claim made while adding a Home leaves a pending, never-verified owner row. Approving that claim as a
-- non-owner removes that row (its snapshot goes to the audit row): a revoked row would refuse every later
-- ownership review of this person here. A verified, disputed or revoked owner, or the Home's primary pointer,
-- still refuses a non-owner role (OWNERSHIP_REVIEW_REQUIRED).
-- Latest permitted source: supabase/migrations/20261004104000_home_verification_source.sql:770
SET LOCAL lock_timeout='5s';

DROP FUNCTION public.mutate_home_claim_review(uuid,uuid,uuid,text,text,text,boolean,integer);

CREATE FUNCTION public.mutate_home_claim_review(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,p_action text,
  p_review_token text DEFAULT NULL,p_note text DEFAULT NULL,p_platform_admin boolean DEFAULT false,p_validity_days integer DEFAULT 365,
  p_role public.home_role_base DEFAULT NULL,p_identity_confirmed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h uuid; c public."HomeOwnershipClaim"%ROWTYPE; v_home public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  v_owner public."HomeOwner"%ROWTYPE; v_role public.home_role_base; v_legacy text; v_target jsonb;
  v_now timestamptz; v_state public.ownership_claim_state; v_phase public.claim_phase_v2;
  v_receipt public."HomeClaimReviewReceipt"%ROWTYPE; v_result jsonb; v_ownership jsonb; v_before_snapshot text;
  v_strength public.claim_strength; v_proof boolean; v_identity boolean; v_primary boolean:=false; v_private boolean:=false;
  v_resident_proof boolean; v_pending_owner public."HomeOwner"%ROWTYPE; v_retired_owner jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_action IS NULL OR p_action NOT IN ('approve','reject','flag','request_more_info','withdraw','authorize_evidence')
    OR p_platform_admin IS NULL OR length(p_note)>1000 OR p_validity_days IS NULL OR p_validity_days<1 OR p_validity_days>3650
    OR p_identity_confirmed IS NULL
    -- Only a platform admin approving may choose the role or attest identity.
    OR ((p_role IS NOT NULL OR p_identity_confirmed) AND NOT (p_platform_admin AND p_action='approve'))
    OR p_role NOT IN ('owner','admin','manager','member','lease_resident','restricted_member','guest') THEN
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
        v_role:=coalesce(p_role,(CASE c.claim_type WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'resident' THEN 'lease_resident' END)::public.home_role_base);
        v_target:=public.home_claim_review_target(h,p_actor_id,c.claimant_user_id,v_role,p_platform_admin);
        IF v_target->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_target; END IF;
        SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=h AND user_id=c.claimant_user_id;
        SELECT jsonb_build_object('primary_user_id',v_home.owner_id,'proofs',coalesce(jsonb_agg(to_jsonb(owner_row) ORDER BY owner_row.id),'[]'))
          INTO v_ownership FROM public."HomeOwner" owner_row WHERE home_id=h AND subject_type='user' AND subject_id=c.claimant_user_id;
        IF c.state<>'approved' OR c.claim_phase_v2<>'verified' OR o.verification_status IS DISTINCT FROM 'verified'
          OR o.role_base IS DISTINCT FROM v_role
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
    v_role:=coalesce(p_role,(CASE c.claim_type WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'resident' THEN 'lease_resident' END)::public.home_role_base);
    -- An owner claim made while adding the Home left a pending owner row that an admin-chosen non-owner role
    -- replaces. Check the role with that row out of the way, then put it back until every check has passed.
    IF p_role IS NOT NULL AND v_role<>'owner' AND v_home.owner_id IS DISTINCT FROM c.claimant_user_id THEN
      SELECT * INTO v_pending_owner FROM public."HomeOwner" WHERE home_id=h AND subject_type='user'
        AND subject_id=c.claimant_user_id AND owner_status='pending' AND added_via='claim';
      IF v_pending_owner.id IS NOT NULL AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=h AND subject_type='user'
        AND subject_id=c.claimant_user_id AND id<>v_pending_owner.id) THEN
        BEGIN
          DELETE FROM public."HomeOwner" WHERE id=v_pending_owner.id;
          v_target:=public.home_claim_review_target(h,p_actor_id,c.claimant_user_id,v_role,p_platform_admin);
          RAISE EXCEPTION USING ERRCODE='PCR00';
        EXCEPTION WHEN SQLSTATE 'PCR00' THEN NULL;
        END;
      ELSE v_pending_owner:=NULL;
      END IF;
    END IF;
    IF v_pending_owner.id IS NULL THEN
      v_target:=public.home_claim_review_target(h,p_actor_id,c.claimant_user_id,v_role,p_platform_admin);
    END IF;
    IF v_target->>'ok'<>'true' THEN RETURN v_target; END IF;
    -- A chosen owner or admin role needs ownership proof; any other chosen role, like a resident claim, also
    -- accepts a utility bill or lease.
    v_resident_proof:=CASE WHEN p_role IS NULL THEN c.claim_type='resident' ELSE v_role NOT IN ('owner','admin') END;
    SELECT coalesce(bool_or(e.evidence_type='idv'),false),coalesce(bool_or(e.evidence_type IN
      ('deed','closing_disclosure','tax_bill','escrow_attestation','title_match')
      OR (v_resident_proof AND e.evidence_type IN ('utility_bill','lease'))),false)
      INTO v_identity,v_proof FROM public."HomeVerificationEvidence" e WHERE claim_id=p_claim_id
        AND public.home_claim_review_verified_evidence(e);
    IF c.identity_status='failed' OR (c.identity_status<>'verified' AND NOT v_identity AND NOT p_identity_confirmed) THEN
      RETURN '{"ok":false,"code":"IDENTITY_CONFIRMATION_REQUIRED","status":409}'::jsonb; END IF;
    IF NOT v_proof THEN RETURN '{"ok":false,"code":"CLAIM_VERIFIED_EVIDENCE_REQUIRED","status":409}'::jsonb; END IF;
    IF v_pending_owner.id IS NOT NULL THEN
      v_retired_owner:=to_jsonb(v_pending_owner);
      DELETE FROM public."HomeOwner" WHERE id=v_pending_owner.id;
    END IF;
    v_strength:=(CASE WHEN v_resident_proof THEN 'resident_standard' WHEN EXISTS(SELECT FROM public."HomeVerificationEvidence" e
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
    reviewed_by=p_actor_id,reviewed_at=v_now,review_note=p_note,claim_strength=coalesce(v_strength,claim_strength),
    identity_status=CASE WHEN p_identity_confirmed THEN 'verified'::public.identity_status ELSE identity_status END,
    updated_at=v_now WHERE id=p_claim_id;
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
        'claim_type',c.claim_type,'occupancy_id',o.id,'retained_evidence',true)
      ||CASE WHEN p_action='approve' THEN jsonb_build_object('role_base',v_role,'role_chosen_by_admin',p_role IS NOT NULL,
        'identity_confirmed_by_admin',p_identity_confirmed) ELSE '{}'::jsonb END
      ||CASE WHEN v_retired_owner IS NOT NULL THEN jsonb_build_object('removed_pending_owner',v_retired_owner) ELSE '{}'::jsonb END);
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.mutate_home_claim_review(uuid,uuid,uuid,text,text,text,boolean,integer,public.home_role_base,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_claim_review(uuid,uuid,uuid,text,text,text,boolean,integer,public.home_role_base,boolean)
  TO service_role;
