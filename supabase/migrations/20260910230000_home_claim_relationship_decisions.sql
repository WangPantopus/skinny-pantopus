-- Backwards compatible: yes. Existing decline/flag requests retain their API
-- shape. New clients may bind an explicit request UUID and displayed snapshot.
-- No memberships, ownership proofs, evidence verdicts or role defaults change.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."HomeClaimRelationshipReceipt" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL REFERENCES public."Home"(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public."HomeOwnershipClaim"(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  action text NOT NULL CHECK(action IN ('decline_relationship','flag_unknown_person')),
  legacy_request boolean NOT NULL,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  review_token text NOT NULL CHECK(review_token ~ '^[a-f0-9]{64}$'),
  note text CHECK(length(note)<=1000),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(home_id,claim_id,actor_user_id,request_id)
);
ALTER TABLE public."HomeClaimRelationshipReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeClaimRelationshipReceipt" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeClaimRelationshipReceipt" TO service_role;

CREATE FUNCTION public.home_claim_relationship_result(r public."HomeClaimRelationshipReceipt",
  c public."HomeOwnershipClaim",p_replayed boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('ok',true,'homeId',r.home_id,'claimId',r.claim_id,'claimantId',c.claimant_user_id,
    'action',r.action,'replayed',p_replayed,'receipt',jsonb_build_object('id',r.id,'home_id',r.home_id,
      'claim_id',r.claim_id,'actor_id',r.actor_user_id,'request_id',r.request_id,'action',r.action,
      'request_hash',r.request_hash,'review_token',r.review_token,'legacy_request',r.legacy_request,
      'result',r.result,'created_at',r.created_at),
    'claim',jsonb_build_object('id',c.id,'state',c.state,'claim_phase_v2',c.claim_phase_v2,
      'routing_classification',c.routing_classification,'challenge_state',c.challenge_state,
      'claim_strength',c.claim_strength,'review_token',public.home_claim_review_snapshot(c)),
    'home_resolution_state',(SELECT household_resolution_state FROM public."Home" WHERE id=r.home_id));
$$;

CREATE FUNCTION public.decide_home_claim_relationship(p_home_id uuid,p_claim_id uuid,p_actor_id uuid,p_action text,
  p_note text DEFAULT NULL,p_request_id uuid DEFAULT NULL,p_review_token text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeOwnershipClaim"%ROWTYPE; h public."Home"%ROWTYPE;
  r public."HomeClaimRelationshipReceipt"%ROWTYPE; v_request uuid; v_legacy boolean;
  v_note text:=nullif(btrim(p_note),''); v_hash text; v_snapshot text; v_payload jsonb;
  v_strength public.claim_strength; v_qualified boolean:=false; v_result jsonb;
  v_verified boolean; v_challenged boolean; v_active integer; v_resolution public.household_resolution_state;
BEGIN
  IF p_home_id IS NULL OR p_claim_id IS NULL OR p_actor_id IS NULL OR p_action IS NULL
    OR p_action NOT IN ('decline_relationship','flag_unknown_person') OR length(p_note)>1000
    OR (p_request_id IS NULL)<>(p_review_token IS NULL)
    OR (p_review_token IS NOT NULL AND p_review_token !~ '^[a-f0-9]{64}$') THEN
    RETURN '{"ok":false,"code":"CLAIM_RELATIONSHIP_INVALID","status":400}'::jsonb;
  END IF;
  IF NOT public.lock_home_claim_scope(p_home_id) THEN
    RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  SELECT * INTO c FROM public."HomeOwnershipClaim" WHERE id=p_claim_id AND home_id=p_home_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"CLAIM_NOT_FOUND","status":404}'::jsonb; END IF;
  -- Receipt recovery needs today's authority too. No private bootstrap/admin
  -- bypass, old owner pointer or revoked membership can recover this result.
  IF public.home_claim_review_authority(p_home_id,p_actor_id,false) IS DISTINCT FROM true
    OR h.home_status IN ('merged','archived') OR h.security_state IN ('frozen','frozen_silent','disputed') THEN
    RETURN '{"ok":false,"code":"CLAIM_REVIEW_DENIED","status":403}'::jsonb; END IF;
  IF c.claimant_user_id=p_actor_id THEN
    RETURN '{"ok":false,"code":"CLAIM_SELF_REVIEW_FORBIDDEN","status":403}'::jsonb; END IF;

  v_legacy:=p_request_id IS NULL;
  v_payload:=jsonb_build_object('home_id',p_home_id,'claim_id',p_claim_id,'actor_id',p_actor_id,
    'action',p_action,'note',v_note,'review_token',p_review_token);
  v_hash:=encode(sha256(convert_to(v_payload::text,'UTF8')),'hex');
  -- Old clients have no durable command ID. The identical actor/claim/action/
  -- note is one historical intent; retry only acknowledges it, even if the
  -- claim later changes. A new intentional decision uses UUID + fresh snapshot.
  v_request:=coalesce(p_request_id,md5('home-claim-relationship-v1:'||v_payload::text)::uuid);
  SELECT * INTO r FROM public."HomeClaimRelationshipReceipt" WHERE home_id=p_home_id AND claim_id=p_claim_id
    AND actor_user_id=p_actor_id AND request_id=v_request;
  IF FOUND THEN
    IF r.request_hash<>v_hash OR r.legacy_request<>v_legacy THEN
      RETURN '{"ok":false,"code":"CLAIM_RELATIONSHIP_REQUEST_CHANGED","status":409}'::jsonb; END IF;
    RETURN public.home_claim_relationship_result(r,c,true);
  END IF;
  IF NOT public.home_claim_is_active(c) OR c.expires_at<=clock_timestamp() THEN
    RETURN '{"ok":false,"code":"CLAIM_NOT_ELIGIBLE","status":409}'::jsonb; END IF;
  IF c.state='disputed' OR c.claim_phase_v2='challenged' OR c.challenge_state='challenged' THEN
    RETURN '{"ok":false,"code":"CLAIM_CHALLENGE_REVIEW_REQUIRED","status":409}'::jsonb; END IF;
  v_snapshot:=public.home_claim_review_snapshot(c);
  IF NOT v_legacy AND p_review_token<>v_snapshot THEN
    RETURN '{"ok":false,"code":"CLAIM_REVIEW_CHANGED","status":409}'::jsonb; END IF;

  IF p_action='flag_unknown_person' THEN
    -- A filename, pending upload or legacy status label never establishes a
    -- property dispute. Reuse the trusted evidence/inspection predicate while
    -- the entire Home claim/evidence authority scope is locked.
    SELECT (CASE WHEN c.claim_type='resident' THEN CASE WHEN bool_or(e.evidence_type IN ('utility_bill','lease'))
        THEN 'resident_standard' END
      WHEN bool_or(e.evidence_type IN ('deed','title_match')) THEN 'owner_legal'
      WHEN bool_or(e.evidence_type IN ('closing_disclosure','escrow_attestation')) THEN 'owner_strong'
      WHEN bool_or(e.evidence_type='tax_bill') THEN 'owner_standard' END)::public.claim_strength
      INTO v_strength FROM public."HomeVerificationEvidence" e WHERE e.claim_id=p_claim_id
        AND public.home_claim_review_verified_evidence(e);
    v_qualified:=coalesce(v_strength IN ('owner_strong','owner_legal'),false);
    UPDATE public."HomeOwnershipClaim" SET routing_classification='challenge_claim',claim_strength=v_strength,
      claim_phase_v2=CASE WHEN v_qualified THEN 'challenged'::public.claim_phase_v2 ELSE claim_phase_v2 END,
      challenge_state=CASE WHEN v_qualified THEN 'challenged'::public.claim_challenge_state ELSE challenge_state END,
      updated_at=clock_timestamp() WHERE id=p_claim_id RETURNING * INTO c;
    SELECT EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND owner_status='verified') INTO v_verified;
    SELECT count(*) FILTER(WHERE public.home_claim_is_active(candidate)),
      coalesce(bool_or(candidate.merged_into_claim_id IS NULL AND candidate.routing_classification='challenge_claim'
        AND candidate.claim_strength IN ('owner_strong','owner_legal')
        AND (candidate.claim_phase_v2='challenged' OR candidate.challenge_state='challenged')
        AND public.home_claim_is_active(candidate)),false)
      INTO v_active,v_challenged FROM public."HomeOwnershipClaim" candidate WHERE home_id=p_home_id;
    v_resolution:=(CASE WHEN v_verified AND v_challenged THEN 'disputed' WHEN v_verified THEN 'verified_household'
      WHEN v_active>1 THEN 'contested' WHEN v_active=1 THEN 'pending_single_claim' ELSE 'unclaimed' END)::public.household_resolution_state;
    UPDATE public."Home" SET household_resolution_state=v_resolution,household_resolution_updated_at=clock_timestamp(),
      updated_at=clock_timestamp() WHERE id=p_home_id;
  END IF;
  -- Decline only records the decision: it does not reject the claim, revoke an
  -- invitation, change evidence or activate/remove any membership or owner.
  v_result:=jsonb_build_object('state',c.state,'claim_phase_v2',c.claim_phase_v2,
    'routing_classification',c.routing_classification,'challenge_state',c.challenge_state,
    'claim_strength',c.claim_strength,'qualifies_for_dispute',v_qualified);
  INSERT INTO public."HomeClaimRelationshipReceipt"(home_id,claim_id,actor_user_id,request_id,action,
    legacy_request,request_hash,review_token,note,result)
    VALUES(p_home_id,p_claim_id,p_actor_id,v_request,p_action,v_legacy,v_hash,v_snapshot,v_note,v_result) RETURNING * INTO r;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,CASE p_action WHEN 'decline_relationship' THEN 'OWNERSHIP_CLAIM_RELATIONSHIP_DECLINED'
      ELSE 'OWNERSHIP_CLAIM_RELATIONSHIP_FLAGGED' END,'HomeOwnershipClaim',p_claim_id,
      jsonb_build_object('receipt_id',r.id,'request_id',v_request,'legacy_request',v_legacy,
        'note',v_note,'qualifies_for_dispute',v_qualified,'challenge_strength',v_strength));
  RETURN public.home_claim_relationship_result(r,c,false);
END $$;

REVOKE ALL ON FUNCTION public.home_claim_relationship_result(public."HomeClaimRelationshipReceipt",public."HomeOwnershipClaim",boolean),
  public.decide_home_claim_relationship(uuid,uuid,uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_claim_relationship_result(public."HomeClaimRelationshipReceipt",public."HomeOwnershipClaim",boolean),
  public.decide_home_claim_relationship(uuid,uuid,uuid,text,text,uuid,text) TO service_role;

-- Relationship decisions are established household history, never private setup.
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

  -- Only protected task uploads have a proved retirement journey below.
  -- Documents, evidence and every legacy File remain independent blockers.
  IF EXISTS (SELECT FROM public."File" f WHERE home_id = p_home_id
    AND NOT public.home_task_media_file_bound(f))
    OR EXISTS (SELECT FROM public."HomeDocument" WHERE home_id = p_home_id)
    OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE (home_id=p_home_id
      OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
      AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=m.id AND i.id=m.private_upload_id
        AND i.home_id=p_home_id AND i.task_id=m.task_id AND i.state='ready'))
    OR EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.original_home_id=p_home_id)
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
      OR EXISTS (SELECT FROM public."HomeClaimRelationshipReceipt" WHERE home_id=p_home_id)
      OR EXISTS (SELECT FROM public."HomeClaimReviewReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_user_id AND receipt.action='withdraw' AND receipt.private_setup
          AND NOT receipt.platform_admin AND EXISTS(SELECT FROM public."HomeOwnershipClaim" c
            WHERE c.id=receipt.claim_id AND c.home_id=p_home_id
              AND public.home_claim_own_private_withdrawal(c,p_user_id))))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrence" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_user_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskRecurrenceCommand" s WHERE s.home_id=p_home_id
        AND NOT (s.actor_user_id=p_user_id AND s.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskCreateReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_user_id AND receipt.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskAssignmentDelivery" d WHERE d.home_id=p_home_id)
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
      OR EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_task_media_own_setup(i,p_user_id))
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
  -- Deleting the Home cannot bypass a current task/source/sensitive deny.
  IF EXISTS(SELECT FROM public."HomeTask" t WHERE t.home_id=p_home_id
    AND EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id AND i.original_task_id=t.id)
    AND (public.home_task_readable(t,p_user_id) IS DISTINCT FROM true
      OR NOT coalesce((public.home_record_context(p_home_id,p_user_id)->'permissions' ? 'tasks.manage')
        OR (t.created_by=p_user_id AND public.home_record_context(p_home_id,p_user_id)->'permissions' ? 'tasks.edit'),false))) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  IF EXISTS(SELECT FROM public."HomeTaskGigReceipt" WHERE home_id=p_home_id) THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ESTABLISHED_HOUSEHOLD','deleted',false);
  END IF;
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETE_ALLOWED','deleted',false);
END;
$$;
