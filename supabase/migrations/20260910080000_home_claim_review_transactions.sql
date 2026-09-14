-- Backwards compatible: yes. Existing endpoints remain; reviews require the
-- displayed snapshot, withdrawal retains history, and legacy evidence objects
-- require private re-upload. No default roles, evidence or ownership migrate.
SET LOCAL lock_timeout='5s';
-- Pending owner rows must not bypass effective review permission or reveal
-- retained legacy object URLs through direct table SELECT.
REVOKE SELECT ON public."HomeOwnershipClaim",public."HomeVerificationEvidence" FROM PUBLIC,anon,authenticated;

-- Durable operation receipts are server-authored. Existing HomeAuditLog has
-- legacy client INSERT policies, so its metadata is not receipt provenance.
CREATE TABLE public."HomeClaimReviewReceipt" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL REFERENCES public."Home"(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public."HomeOwnershipClaim"(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('approve','reject','flag','request_more_info','withdraw')),
  platform_admin boolean NOT NULL,
  private_setup boolean NOT NULL DEFAULT false,
  note text,
  review_token text NOT NULL CHECK(review_token ~ '^[a-f0-9]{64}$'),
  result_snapshot text NOT NULL CHECK(result_snapshot ~ '^[a-f0-9]{64}$'),
  occupancy_snapshot jsonb,
  permissions_snapshot jsonb,
  ownership_snapshot jsonb,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(home_id,claim_id,actor_user_id,action,platform_admin,review_token)
);
ALTER TABLE public."HomeClaimReviewReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."HomeClaimReviewReceipt" FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public."HomeClaimReviewReceipt" TO service_role;

CREATE FUNCTION public.home_claim_review_snapshot(p_claim public."HomeOwnershipClaim") RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT encode(sha256(convert_to(jsonb_build_object('claim',to_jsonb(p_claim),
    'evidence',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id)
      FROM public."HomeVerificationEvidence" e WHERE e.claim_id=p_claim.id),'[]'::jsonb))::text,'UTF8')),'hex');
$$;

-- Until the private upload contract lands, caller-supplied manual refs and
-- metadata are never a verified document or an object we may fetch/delete.
-- Existing provider evidence must already be verified by its trusted gateway.
CREATE FUNCTION public.home_claim_review_verified_evidence(e public."HomeVerificationEvidence") RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT coalesce(e.status='verified' AND e.storage_ref IS NULL
    AND NOT coalesce(e.metadata ?| ARRAY['file_url','storage_ref','storage_path','storage_contract'],false)
    AND ((e.provider='stripe_identity' AND e.evidence_type='idv')
      OR (e.provider IN ('attom','corelogic') AND e.evidence_type='title_match'
        AND e.metadata->>'matched'='true' AND CASE WHEN jsonb_typeof(e.metadata->'confidence')='number'
          THEN (e.metadata->>'confidence')::numeric BETWEEN 70 AND 100 ELSE false END)),false);
$$;

CREATE FUNCTION public.home_claim_review_authority(p_home_id uuid,p_actor_id uuid,p_platform_admin boolean)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_occ public."HomeOccupancy"%ROWTYPE; v_access jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_actor_id IS NULL OR p_platform_admin IS NULL THEN RETURN false; END IF;
  -- The platform route is an explicit authority, never a JWT/cache-only bypass.
  SELECT role INTO v_role FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_now:=clock_timestamp();
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF v_occ.id IS NOT NULL AND (coalesce(v_occ.role_base,public.home_invite_role(v_occ.role)) IS NULL
    OR (v_occ.verification_status<>'verified' AND v_occ.verified_at IS NOT NULL) OR v_occ.age_band IN ('child','teen') OR v_occ.is_active IS DISTINCT FROM true
    OR v_occ.start_at>v_now OR v_occ.end_at<=v_now OR v_occ.access_start_at>v_now OR v_occ.access_end_at<=v_now
    OR v_occ.verification_status IS NULL OR v_occ.verification_status NOT IN
      ('verified','unverified','pending','pending_doc','pending_postcard','pending_approval','provisional_bootstrap')) THEN RETURN false; END IF;
  IF EXISTS(SELECT FROM public."HomePermissionOverride" WHERE home_id=p_home_id AND user_id=p_actor_id
    AND permission='ownership.manage' AND NOT allowed) OR (
      EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id
        AND owner_status IN ('revoked','disputed')) AND NOT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
          AND subject_type='user' AND subject_id=p_actor_id AND owner_status='verified')) THEN RETURN false; END IF;
  IF p_platform_admin THEN RETURN coalesce(v_role='admin',false); END IF;
  v_access:=public.home_claim_invitation_authority(p_home_id,p_actor_id,false);
  RETURN coalesce(v_access->>'ok'='true',false);
END $$;

CREATE FUNCTION public.get_home_claim_review(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,p_platform_admin boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeOwnershipClaim"%ROWTYPE; h uuid; v_evidence jsonb; v_home jsonb; v_user jsonb;
BEGIN
  SELECT home_id INTO h FROM public."HomeOwnershipClaim" WHERE id=p_claim_id;
  IF h IS NULL OR (p_home_id IS NOT NULL AND p_home_id<>h) THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  IF NOT public.lock_home_claim_scope(h) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id AND home_id=h;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  IF public.home_claim_review_authority(h,p_actor_id,p_platform_admin) IS DISTINCT FROM true THEN
    RETURN '{"ok":false,"code":"CLAIM_REVIEW_DENIED","status":403}'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'evidence_type',e.evidence_type,'provider',e.provider,
    'status',e.status,'created_at',e.created_at,'storage_ref',NULL,'file_url',NULL,'file_name',NULL,
    'file_size',NULL,'mime_type',NULL,'available',false,'availability_code',
      CASE WHEN e.storage_ref IS NOT NULL OR e.metadata ? 'file_url' THEN 'CLAIM_EVIDENCE_PRIVATE_REUPLOAD_REQUIRED'
        ELSE 'CLAIM_EVIDENCE_METADATA_ONLY' END,
    'eligible_for_review',public.home_claim_review_verified_evidence(e)) ORDER BY e.created_at DESC,e.id),'[]')
    INTO v_evidence FROM public."HomeVerificationEvidence" e WHERE claim_id=p_claim_id;
  SELECT jsonb_build_object('id',id,'address',address,'city',city,'state',state,'zipcode',zipcode,'name',name,
    'home_type',home_type,'security_state',security_state,'tenure_mode',tenure_mode) INTO v_home FROM public."Home" WHERE id=h;
  SELECT jsonb_build_object('id',id,'username',username,'name',name,'email',email,'created_at',created_at,
    'profile_picture_url',profile_picture_url) INTO v_user FROM public."User" WHERE id=c.claimant_user_id;
  RETURN jsonb_build_object('ok',true,'homeId',h,'claimId',p_claim_id,
    'claim',to_jsonb(c)||jsonb_build_object('review_token',public.home_claim_review_snapshot(c),'evidence',v_evidence),
    'home',v_home,'claimant',v_user,'evidence',v_evidence);
END $$;

CREATE FUNCTION public.home_claim_review_target(p_home_id uuid,p_actor_id uuid,p_target_id uuid,
  p_role public.home_role_base,p_platform_admin boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o public."HomeOccupancy"%ROWTYPE; v_old_role public.home_role_base; v_now timestamptz:=clock_timestamp();
  v_target jsonb; v_permissions text[];
BEGIN
  IF p_actor_id=p_target_id THEN RETURN '{"ok":false,"code":"CLAIM_SELF_REVIEW_FORBIDDEN","status":403}'::jsonb; END IF;
  IF NOT p_platform_admin THEN
    v_target:=public.home_claim_invitation_target(p_home_id,p_actor_id,p_target_id,p_role);
    IF v_target->>'ok'<>'true' THEN RETURN v_target; END IF;
  END IF;
  SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_target_id;
  v_old_role:=coalesce(o.role_base,public.home_invite_role(o.role));
  IF o.id IS NOT NULL AND (o.is_active IS DISTINCT FROM true OR v_old_role IS NULL
    OR o.verification_status IS NULL OR o.verification_status NOT IN
      ('verified','unverified','pending','pending_doc','pending_postcard','pending_approval','provisional_bootstrap')
    OR (o.verification_status<>'verified' AND o.verified_at IS NOT NULL)
    OR o.end_at<=v_now OR o.access_end_at<=v_now
    OR greatest(o.start_at,o.access_start_at)>=least(o.end_at,o.access_end_at)) THEN
    RETURN '{"ok":false,"code":"MEMBERSHIP_RENEWAL_REQUIRED","status":409}'::jsonb; END IF;
  IF o.start_at>v_now OR o.access_start_at>v_now THEN
    RETURN '{"ok":false,"code":"CLAIM_ACCESS_NOT_STARTED","status":409}'::jsonb; END IF;
  IF (o.age_band='child' AND public.home_role_rank(p_role)>20)
    OR (o.age_band='teen' AND public.home_role_rank(p_role)>30) THEN
    RETURN '{"ok":false,"code":"PROPOSED_ROLE_FORBIDDEN","status":403}'::jsonb; END IF;
  IF EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id
      AND owner_status IN ('revoked','disputed'))
    OR (p_role='owner' AND EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=p_target_id AND owner_status='pending' AND is_primary_owner) AND (
        EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND owner_id IS NOT NULL AND owner_id<>p_target_id)
        OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND owner_status='verified'
          AND (subject_type<>'user' OR subject_id<>p_target_id))))
    OR (p_role<>'owner' AND (v_old_role='owner'
      OR EXISTS(SELECT FROM public."Home" WHERE id=p_home_id AND owner_id=p_target_id)
      OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_target_id)))
    OR (p_role<>'owner' AND o.id IS NOT NULL AND public.home_role_rank(p_role)<public.home_role_rank(v_old_role)) THEN
    RETURN '{"ok":false,"code":"OWNERSHIP_REVIEW_REQUIRED","status":409}'::jsonb; END IF;
  v_permissions:=public.home_member_policy_permissions(p_home_id,p_target_id,p_role,o.age_band);
  RETURN jsonb_build_object('ok',true,'permissions',v_permissions);
END $$;

CREATE FUNCTION public.reconcile_home_claim_review(p_home_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_active integer; v_challenged boolean; v_verified boolean; v_resolution public.household_resolution_state;
BEGIN
  SELECT count(*) FILTER(WHERE public.home_claim_is_active(c)),coalesce(bool_or(c.merged_into_claim_id IS NULL
    AND (c.claim_phase_v2='challenged' OR c.state='disputed' OR c.challenge_state='challenged')),false)
    INTO v_active,v_challenged FROM public."HomeOwnershipClaim" c WHERE home_id=p_home_id;
  SELECT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND owner_status='verified') INTO v_verified;
  v_resolution:=(CASE WHEN v_verified AND v_challenged THEN 'disputed' WHEN v_verified THEN 'verified_household'
    WHEN v_active>1 THEN 'contested' WHEN v_active=1 THEN 'pending_single_claim' ELSE 'unclaimed' END)::public.household_resolution_state;
  UPDATE public."Home" SET household_resolution_state=v_resolution,household_resolution_updated_at=clock_timestamp(),
    ownership_state=CASE WHEN ownership_state='disputed' THEN ownership_state WHEN v_verified THEN 'owner_verified'::public.home_ownership_state
      WHEN v_active=0 THEN 'unclaimed'::public.home_ownership_state ELSE ownership_state END,updated_at=clock_timestamp()
    WHERE id=p_home_id;
END $$;

CREATE FUNCTION public.mutate_home_claim_review(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,p_action text,
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
          OR to_jsonb(o) IS DISTINCT FROM v_receipt.occupancy_snapshot
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
      UPDATE public."HomeOccupancy" SET role=v_legacy,role_base=v_role,verification_status='verified',
        verified_at=CASE WHEN verification_status='verified' THEN verified_at ELSE v_now END,
        verification_expires_at=CASE WHEN verification_status='verified' THEN verification_expires_at ELSE v_now+make_interval(days=>p_validity_days) END,
        updated_at=v_now WHERE id=o.id RETURNING * INTO o;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,start_at,added_by_user_id,
        verification_status,verified_at,verification_expires_at,can_manage_home,can_manage_finance,can_manage_access,can_manage_tasks,can_view_sensitive)
        VALUES(h,c.claimant_user_id,v_legacy,v_role,NULL,true,v_now,p_actor_id,'verified',v_now,v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
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

REVOKE ALL ON FUNCTION public.home_claim_review_snapshot(public."HomeOwnershipClaim"),
  public.home_claim_review_verified_evidence(public."HomeVerificationEvidence"),public.home_claim_review_authority(uuid,uuid,boolean),
  public.get_home_claim_review(uuid,uuid,uuid,boolean),public.home_claim_review_target(uuid,uuid,uuid,public.home_role_base,boolean),
  public.reconcile_home_claim_review(uuid),public.mutate_home_claim_review(uuid,uuid,uuid,text,text,text,boolean,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_claim_review(uuid,uuid,uuid,boolean),
  public.mutate_home_claim_review(uuid,uuid,uuid,text,text,text,boolean,integer) TO service_role;

-- An own, previously private setup claim may be withdrawn without losing own
-- Wi-Fi/pickup/task setup. Retained evidence still blocks destructive deletion.
CREATE FUNCTION public.home_claim_own_private_withdrawal(c public."HomeOwnershipClaim",u uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(c.claimant_user_id=u AND c.state='revoked' AND c.claim_phase_v2='withdrawn'
    AND c.terminal_reason='withdrawn_by_user' AND c.reviewed_by IS NULL AND c.reviewed_at IS NULL
    AND c.merged_into_claim_id IS NULL AND EXISTS(SELECT FROM public."HomeClaimReviewReceipt" receipt
      WHERE receipt.home_id=c.home_id AND receipt.actor_user_id=u AND receipt.action='withdraw'
        AND receipt.claim_id=c.id AND receipt.private_setup AND NOT receipt.platform_admin),false);
$$;
REVOKE ALL ON FUNCTION public.home_claim_own_private_withdrawal(public."HomeOwnershipClaim",uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.home_secret_context(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_now timestamptz:=clock_timestamp();
  v_permissions text[]; v_denied constant jsonb:='{"allowed":false,"private":false,"permissions":[]}'::jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RETURN v_denied; END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND OR v_home.security_state IN ('frozen','frozen_silent') THEN RETURN v_denied; END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true OR v_occ.age_band IN ('child','teen')
    OR v_occ.start_at>v_now OR v_occ.end_at<=v_now OR v_occ.access_start_at>v_now OR v_occ.access_end_at<=v_now) THEN
    RETURN v_denied;
  END IF;
  v_access:=public.home_effective_access(p_home_id,p_actor_id);
  IF v_access->>'is_owner'='true' AND EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id
    AND o.subject_type='user' AND o.subject_id=p_actor_id AND o.owner_status IN ('revoked','disputed'))
    AND NOT EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id=p_home_id AND o.subject_type='user'
      AND o.subject_id=p_actor_id AND o.owner_status='verified') THEN RETURN v_denied; END IF;
  IF v_access->>'has_access'='true' THEN
    RETURN jsonb_build_object('allowed',true,'private',false,'permissions',v_access->'permissions',
      'role',v_access->>'effective_role_base');
  END IF;
  v_role:=coalesce(v_occ.role_base,CASE v_occ.role
    WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
    WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
    WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
    WHEN 'member' THEN 'member' WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
    WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
    WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base);
  IF v_home.created_by_user_id IS DISTINCT FROM p_actor_id
    OR (v_home.owner_id IS NOT NULL AND v_home.owner_id<>p_actor_id)
    OR v_occ.id IS NULL OR v_role IS NULL OR v_occ.verified_at IS NOT NULL
    OR v_occ.verification_status IS NULL OR v_occ.verification_status NOT IN ('pending_doc','provisional_bootstrap')
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id<>p_actor_id)
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id
      AND (subject_type<>'user' OR subject_id<>p_actor_id OR owner_status<>'pending')) THEN RETURN v_denied; END IF;
  -- Explicit private setup allowlist, separate from destructive deletion.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE home_id = p_home_id
        AND (claimant_user_id <> p_actor_id OR (state NOT IN ('draft','submitted')
          AND NOT public.home_claim_own_private_withdrawal(c,p_actor_id)) OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_actor_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_actor_id))))
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_actor_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_actor_id)
          OR public.home_record_own_setup_audit(a,p_actor_id)
          OR (a.action='OWNERSHIP_CLAIM_WITHDRAWN' AND a.target_type='HomeOwnershipClaim'
            AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c WHERE c.id=a.target_id
              AND c.home_id=p_home_id AND public.home_claim_own_private_withdrawal(c,p_actor_id)))
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_actor_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_actor_id OR created_by IS DISTINCT FROM p_actor_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_actor_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_actor_id)
      OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id=p_home_id)
      OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id=p_home_id)
      -- Own pending verification evidence does not confer shared-document access
      -- and does not make the creator lose access to their own Wi-Fi setup.
      OR EXISTS (SELECT FROM public."File" f WHERE f.home_id=p_home_id AND (
        f.user_id<>p_actor_id OR NOT EXISTS (SELECT FROM public."HomeVerificationEvidence" e
          JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id WHERE c.home_id=p_home_id
            AND c.claimant_user_id=p_actor_id AND (c.state IN ('draft','submitted')
              OR public.home_claim_own_private_withdrawal(c,p_actor_id))
            AND c.reviewed_by IS NULL AND c.reviewed_at IS NULL AND e.storage_ref=f.file_path)))
      OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id
        JOIN public."File" f ON f.file_path=e.storage_ref WHERE c.home_id=p_home_id
          AND (f.user_id<>p_actor_id OR (f.home_id IS NOT NULL AND f.home_id<>p_home_id)))
      OR EXISTS (SELECT FROM public."Activity" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AddressReviewCase" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AttomPropertyCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockFounder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockInvite" WHERE sender_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Booking" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BusinessProfileView" WHERE viewer_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ChatRoom" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."EventType" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."FridgeCard" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAsset" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuthority" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBill" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBusinessLink" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" e WHERE home_id = p_home_id
        AND (NOT public.home_event_private_setup(e,p_actor_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_actor_id)))
      OR EXISTS (SELECT FROM public."HomeDevice" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeDispute" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEmergency" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEstateFields" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeGuestPass" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeHouseholdAccessRequest" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeIssue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLeaseInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLease" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceLog" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePet" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePostcardCode" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivacy" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivateData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePublicData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeQuorumAction" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRecordWatch" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRentReport" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeReputation" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResource" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRvStatus" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeScopedGrant" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_actor_id))
      OR EXISTS (SELECT FROM public."HomeVendor" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeVerification" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Home" WHERE parent_home_id = p_home_id OR canonical_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ListingInventorySlot" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Listing" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailAlias" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailDayItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailPartySession" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailRoutingQueue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Mail" WHERE address_home_id = p_home_id OR address_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MessageTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."NeighborMessage" WHERE sender_home_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Post" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."PropertyIntelligenceCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyLetter" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SavedTaskTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingPoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingWorkflow" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SupportTrain" WHERE recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."VaultFolder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Gig" WHERE origin_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Payment" WHERE home_id = p_home_id) THEN
      RETURN v_denied;
    END IF;
  SELECT coalesce(array_agg(p::text),'{}'::text[]) INTO v_permissions
    FROM unnest(ARRAY['access.view_wifi','access.view_codes','access.manage']::public.home_permission[]) p
    WHERE NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
      AND o.user_id=p_actor_id AND o.permission=p AND NOT o.allowed)
    AND NOT EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base=v_role AND r.permission=p AND NOT r.allowed
      AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id=p_home_id
        AND o.user_id=p_actor_id AND o.permission=p AND o.allowed));
  RETURN jsonb_build_object('allowed',true,'private',true,'permissions',v_permissions,'role',v_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.home_delete_eligibility(p_home_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_occ public."HomeOccupancy"%ROWTYPE;
  v_access jsonb; v_role public.home_role_base; v_primary boolean; v_private boolean := false;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id = p_home_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_NOT_FOUND','deleted',false);
  END IF;
  -- Destructive authority must not revive through an older Home.owner_id when
  -- the caller's ownership is disputed or revoked without a current verified
  -- record. Historical revoked rows may coexist with a legitimate reverified
  -- owner because the canonical uniqueness constraint excludes revoked rows.
  IF EXISTS (SELECT FROM public."HomeOwner" o WHERE o.home_id = p_home_id
    AND o.subject_type = 'user' AND o.subject_id = p_user_id
    AND (o.owner_status = 'disputed' OR (o.owner_status = 'revoked' AND NOT EXISTS (
      SELECT FROM public."HomeOwner" current_owner WHERE current_owner.home_id = p_home_id
        AND current_owner.subject_type = 'user' AND current_owner.subject_id = p_user_id
        AND current_owner.owner_status = 'verified')))) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  SELECT * INTO v_occ FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id = p_user_id;
  -- This read-only RPC is VOLATILE deliberately: current time after lock waits
  -- fences an access window that ended while the transaction was waiting.
  -- Eligibility is advisory; the deletion RPC locks/rechecks before mutation.
  -- NULL age retains the existing adult compatibility.
  IF v_home.security_state IN ('frozen','frozen_silent') OR
    (v_occ.id IS NOT NULL AND (v_occ.is_active IS DISTINCT FROM true
      OR v_occ.age_band IN ('child','teen')
      OR v_occ.start_at > v_now OR v_occ.end_at <= v_now
      OR v_occ.access_start_at > v_now OR v_occ.access_end_at <= v_now)) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  v_primary := coalesce(v_home.owner_id = p_user_id, false) OR EXISTS (
    SELECT FROM public."HomeOwner" WHERE home_id = p_home_id AND subject_type = 'user'
      AND subject_id = p_user_id AND owner_status = 'verified' AND is_primary_owner);
  v_access := public.home_effective_access(p_home_id,p_user_id);
  IF v_primary AND coalesce((v_access->>'has_access')::boolean,false)
    AND coalesce((v_access->>'is_owner')::boolean,false) THEN
    IF NOT (v_access->'permissions' ?& ARRAY['home.edit','security.manage']) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
    END IF;
  ELSE
    -- This is removal of an exact creator's unfinished private setup. It is
    -- never generic provisional membership or authority over a household.
    v_role := coalesce(v_occ.role_base, CASE v_occ.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin'
      WHEN 'manager' THEN 'manager' WHEN 'property_manager' THEN 'manager'
      WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
      WHEN 'lease_resident' THEN 'lease_resident' WHEN 'member' THEN 'member'
      WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider'
      ELSE NULL END::public.home_role_base);
    IF v_home.created_by_user_id IS DISTINCT FROM p_user_id
      OR (v_home.owner_id IS NOT NULL AND v_home.owner_id <> p_user_id)
      OR v_occ.id IS NULL OR v_role IS NULL
      OR v_occ.verified_at IS NOT NULL
      OR v_occ.verification_status IS NULL
      OR v_occ.verification_status NOT IN ('provisional_bootstrap','pending_doc')
      OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id = p_home_id AND user_id <> p_user_id)
      OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id = p_home_id
        AND (subject_type <> 'user' OR subject_id <> p_user_id OR owner_status <> 'pending')) THEN
      RETURN jsonb_build_object('allowed',false,'code','DELETE_HOME_NOT_PRIMARY','deleted',false);
    END IF;
    IF EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
      AND user_id = p_user_id AND permission IN ('home.edit','security.manage') AND NOT allowed)
      OR EXISTS (SELECT FROM public."HomeRolePermission" r WHERE r.role_base = v_role
        AND r.permission IN ('home.edit','security.manage') AND NOT r.allowed
        AND NOT EXISTS (SELECT FROM public."HomePermissionOverride" o WHERE o.home_id = p_home_id
          AND o.user_id = p_user_id AND o.permission = r.permission AND o.allowed)) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
    END IF;
    v_private := true;
  END IF;

  -- File.home_id cascades on Home deletion. That would destroy quota/upload
  -- tombstones and the metadata needed to remove external bytes. Do not bypass
  -- protect_home_document_record/file, unlink them, or pretend cleanup happened.
  IF EXISTS (SELECT FROM public."File" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE home_id=p_home_id
      OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
    OR EXISTS (SELECT FROM public."HomeVerificationEvidence" e JOIN public."HomeOwnershipClaim" c
      ON c.id = e.claim_id WHERE c.home_id = p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_STORAGE_CLEANUP_REQUIRED','deleted',false);
  END IF;
  IF EXISTS (SELECT FROM public."CommunityMailItem" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeMapPin" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."VacationHold" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."MailDeliveryIntent" WHERE intended_home_id = p_home_id)
    OR EXISTS (SELECT FROM public."NeighborEndorsement" WHERE endorser_home_id = p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_LINKED_DATA','deleted',false);
  END IF;

  IF v_private THEN
    -- Explicit setup allowlist matches POST /homes: the caller's occupancy,
    -- pending owner + unreviewed claim, its audit, preferences and own WiFi.
    -- Own Unlisted progress and pickup rules are also private first-use data.
    -- Any other relation is conservatively a household/established-data fence,
    -- even if its creator happens to be this caller. No dynamic table scan.
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE home_id = p_home_id
        AND (claimant_user_id <> p_user_id OR (state NOT IN ('draft','submitted')
          AND NOT public.home_claim_own_private_withdrawal(c,p_user_id)) OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_user_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_user_id))))
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_user_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
          OR public.home_secret_own_setup_audit(a,p_user_id)
          OR public.home_record_own_setup_audit(a,p_user_id)
          OR (a.action='OWNERSHIP_CLAIM_WITHDRAWN' AND a.target_type='HomeOwnershipClaim'
            AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c WHERE c.id=a.target_id
              AND c.home_id=p_home_id AND public.home_claim_own_private_withdrawal(c,p_user_id)))
          OR (a.action = 'OWNERSHIP_CLAIM_SUBMITTED' AND a.target_type = 'HomeOwnershipClaim'
            AND EXISTS (SELECT FROM public."HomeOwnershipClaim" c WHERE c.id = a.target_id
              AND c.home_id = p_home_id AND c.claimant_user_id = p_user_id)),false)))
      OR EXISTS (SELECT FROM public."HomeAccessSecret" WHERE home_id = p_home_id AND created_by IS DISTINCT FROM p_user_id)
      OR EXISTS (SELECT FROM public."HomePermissionOverride" WHERE home_id = p_home_id
        AND (user_id <> p_user_id OR created_by IS DISTINCT FROM p_user_id))
      OR EXISTS (SELECT FROM public."UnlistedRemoval" WHERE home_id = p_home_id AND user_id <> p_user_id)
      OR EXISTS (SELECT FROM public."AddressCalendarRule" WHERE scope_type = 'home'
        AND public.home_calendar_scope_id(scope_key) = p_home_id AND created_by IS DISTINCT FROM p_user_id)
      OR EXISTS (SELECT FROM public."Activity" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AddressReviewCase" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."AttomPropertyCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockFounder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BlockInvite" WHERE sender_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BookingPage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Booking" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."BusinessProfileView" WHERE viewer_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ChatRoom" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."EventType" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."FridgeCard" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAsset" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuthority" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBill" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeBusinessLink" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" e WHERE home_id = p_home_id
        AND (NOT public.home_event_private_setup(e,p_user_id)
          OR EXISTS (SELECT FROM public."HomeCalendarEventAttendee" a WHERE a.event_id=e.id AND a.user_id<>p_user_id)))
      OR EXISTS (SELECT FROM public."HomeDevice" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeDispute" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEmergency" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeEstateFields" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeGuestPass" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeHouseholdAccessRequest" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeIssue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLeaseInvite" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeLease" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceLog" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMaintenanceTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePackage" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePet" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePostcardCode" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivacy" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePrivateData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomePublicData" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeQuorumAction" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRecordWatch" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRentReport" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeReputation" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeResource" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeRvStatus" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeScopedGrant" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeShareReadReceipt" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSeasonalChecklistItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSubscription" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeSystem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
      OR EXISTS (SELECT FROM public."HomeTask" t WHERE home_id = p_home_id
        AND NOT public.home_task_private_setup(t,p_user_id))
      OR EXISTS (SELECT FROM public."HomeVendor" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeVerification" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Home" WHERE parent_home_id = p_home_id OR canonical_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ListingInventorySlot" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Listing" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailAlias" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailDayItem" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailPartySession" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MailRoutingQueue" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Mail" WHERE address_home_id = p_home_id OR address_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."MessageTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."NeighborMessage" WHERE sender_home_id = p_home_id OR recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Post" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."PropertyIntelligenceCache" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyClaim" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."ResidencyLetter" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SavedTaskTemplate" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingPoll" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SchedulingWorkflow" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."SupportTrain" WHERE recipient_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."VaultFolder" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Gig" WHERE origin_home_id = p_home_id)
      OR EXISTS (SELECT FROM public."Payment" WHERE home_id = p_home_id) THEN
      RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ESTABLISHED_HOUSEHOLD','deleted',false);
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETE_ALLOWED','deleted',false);
END;
$$;

-- A late public-record provider response cannot append evidence or overwrite a
-- claim after a competing review/withdrawal/acceptance. This service-only
-- gateway records provider facts; it does not activate disputed ownership.
CREATE FUNCTION public.record_home_claim_provider_evidence(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,
  p_provider text,p_matched boolean,p_confidence numeric,p_details jsonb DEFAULT NULL,p_apn text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeOwnershipClaim"%ROWTYPE; e public."HomeVerificationEvidence"%ROWTYPE; v_status text;
BEGIN
  IF p_provider IS NULL OR p_provider NOT IN ('attom','corelogic') OR p_matched IS NULL
    OR p_confidence IS NULL OR p_confidence<0 OR p_confidence>100 OR length(p_apn)>250
    OR pg_column_size(p_details)>65536 THEN RETURN '{"ok":false,"code":"CLAIM_REVIEW_INVALID","status":400}'::jsonb; END IF;
  IF NOT public.lock_home_claim_scope(p_home_id) THEN RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id AND home_id=p_home_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  IF c.claimant_user_id IS DISTINCT FROM p_actor_id THEN RETURN '{"ok":false,"code":"CLAIM_RECIPIENT_MISMATCH","status":403}'::jsonb; END IF;
  IF c.method IS DISTINCT FROM 'property_data_match' OR NOT public.home_claim_is_active(c) OR c.expires_at<=clock_timestamp()
    OR c.claim_phase_v2='challenged' OR c.challenge_state='challenged' OR c.routing_classification='challenge_claim' THEN
    RETURN '{"ok":false,"code":"CLAIM_NOT_ELIGIBLE","status":409}'::jsonb; END IF;
  v_status:=CASE WHEN p_matched AND p_confidence>=70 THEN 'verified' ELSE 'pending' END;
  INSERT INTO public."HomeVerificationEvidence"(claim_id,evidence_type,provider,status,metadata)
    VALUES(p_claim_id,'title_match',p_provider,v_status,jsonb_build_object('confidence',p_confidence,'matched',p_matched,'details',p_details,'apn',p_apn)) RETURNING * INTO e;
  IF v_status='verified' THEN
    UPDATE public."HomeOwnershipClaim" SET claim_strength=CASE WHEN claim_type='resident' THEN 'resident_standard'::public.claim_strength
      ELSE 'owner_strong'::public.claim_strength END,updated_at=clock_timestamp() WHERE id=p_claim_id;
  END IF;
  RETURN jsonb_build_object('ok',true,'homeId',p_home_id,'claimId',p_claim_id,'evidenceId',e.id);
END $$;
REVOKE ALL ON FUNCTION public.record_home_claim_provider_evidence(uuid,uuid,uuid,text,boolean,numeric,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_home_claim_provider_evidence(uuid,uuid,uuid,text,boolean,numeric,jsonb,text) TO service_role;
