-- Backwards compatible: yes. Explicit opt-in Home task publication through
-- ordinary Gig creation. Private source identity never enters public Gig columns.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."HomeTaskGigReceipt" (
  home_id uuid NOT NULL REFERENCES public."Home"(id),
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  task_id uuid NOT NULL UNIQUE,
  gig_id uuid NOT NULL UNIQUE,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(home_id,actor_user_id,request_id)
);
ALTER TABLE public."HomeTaskGigReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."HomeTaskGigReceipt" FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public."HomeTaskGigReceipt" TO service_role;

CREATE FUNCTION public.get_home_task_gig_publication(p_home_id uuid,p_actor_id uuid,p_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; t public."HomeTask"; linked uuid; manageable boolean;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_task_id IS NULL THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  -- Same Home -> authority -> mail -> task order as all Home task operations.
  r:=public.get_home_records(p_home_id,p_actor_id,'task',p_task_id);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  SELECT * INTO t FROM public."HomeTask" WHERE id=p_task_id AND home_id=p_home_id;
  -- Publication requires an ordinary authorized adult membership. The narrow
  -- private-setup exception is deliberately not a public posting permission.
  PERFORM id FROM auth.users WHERE id=p_actor_id FOR SHARE;
  manageable:=r->'records'->0->'capabilities'->>'can_edit'='true'
    AND public.home_record_context(p_home_id,p_actor_id)->>'private'='false'
    AND EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id AND age_band='adult')
    AND EXISTS(SELECT FROM auth.users WHERE id=p_actor_id AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until<=clock_timestamp()));
  IF manageable IS DISTINCT FROM true THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_WRITE_DENIED","status":403}'::jsonb; END IF;
  SELECT gig_id INTO linked FROM public."HomeTaskGigReceipt" WHERE task_id=p_task_id;
  linked:=coalesce(linked,t.converted_to_gig_id,t.linked_gig_id);
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'task_id',p_task_id,
    'task_updated_at',t.updated_at,'gig_id',linked,
    'can_publish',linked IS NULL AND t.status='open' AND t.assigned_to IS NULL
      AND NOT EXISTS(SELECT FROM public."HomeTaskRecurrence" WHERE source_task_id=t.id AND state='active'));
END $$;

CREATE FUNCTION public.publish_home_task_gig(p_home_id uuid,p_actor_id uuid,p_task_id uuid,p_request_id uuid,
  p_expected_updated_at timestamptz,p_command jsonb,p_gig jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; t public."HomeTask"; g public."Gig"; receipt public."HomeTaskGigReceipt";
  h text; replayed boolean; source jsonb;
BEGIN
  IF p_request_id IS NULL OR NOT isfinite(p_expected_updated_at) OR p_expected_updated_at IS NULL
    OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR jsonb_typeof(p_gig) IS DISTINCT FROM 'object' THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  source:=p_command->'home_task_source';
  IF source->>'home_id' IS DISTINCT FROM p_home_id::text OR source->>'task_id' IS DISTINCT FROM p_task_id::text
    OR source->>'request_id' IS DISTINCT FROM p_request_id::text OR source->'reviewed' IS DISTINCT FROM 'true'::jsonb
    OR (source->>'expected_updated_at')::timestamptz IS DISTINCT FROM p_expected_updated_at THEN
    RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
  r:=public.get_home_task_gig_publication(p_home_id,p_actor_id,p_task_id);
  IF r->>'ok' IS DISTINCT FROM 'true' THEN RETURN r; END IF;
  SELECT * INTO t FROM public."HomeTask" WHERE id=p_task_id AND home_id=p_home_id FOR UPDATE;
  h:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  SELECT * INTO receipt FROM public."HomeTaskGigReceipt" WHERE home_id=p_home_id
    AND actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  replayed:=FOUND;
  IF replayed THEN
    IF receipt.task_id<>p_task_id OR receipt.request_hash<>h THEN
      RETURN '{"ok":false,"code":"HOME_TASK_GIG_CONFLICT","status":409}'::jsonb; END IF;
    -- Never update the Gig on replay: preserve cancellation, price changes,
    -- assignment, payment and completion that happened after publication.
    SELECT * INTO g FROM public."Gig" WHERE id=receipt.gig_id AND user_id=p_actor_id FOR SHARE;
    IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_TASK_GIG_RETIRED","status":409}'::jsonb; END IF;
  ELSE
    IF r->>'gig_id' IS NOT NULL THEN RETURN '{"ok":false,"code":"HOME_TASK_GIG_LINKED","status":409}'::jsonb; END IF;
    IF r->>'can_publish' IS DISTINCT FROM 'true' THEN
      RETURN '{"ok":false,"code":"HOME_TASK_GIG_NOT_READY","status":409}'::jsonb; END IF;
    IF t.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RETURN '{"ok":false,"code":"HOME_TASK_GIG_STALE","status":409}'::jsonb; END IF;
    -- Prepared only by the same Joi-validated ordinary Gig creation route.
    -- Explicit columns below exclude arbitrary payment/assignment/status fields.
    SELECT * INTO g FROM jsonb_populate_record(NULL::public."Gig",p_gig);
    IF g.user_id IS DISTINCT FROM p_actor_id OR g.created_by IS DISTINCT FROM p_actor_id
      OR g.beneficiary_user_id IS NOT NULL OR g.status IS DISTINCT FROM 'open'
      OR g.origin_home_id IS NOT NULL OR g.source_type IS NOT NULL OR g.source_id IS NOT NULL
      OR g.origin_mode IS NULL OR g.origin_mode NOT IN ('address','current')
      OR g.reveal_policy IS NULL OR g.reveal_policy NOT IN ('after_assignment','never_public')
      OR char_length(btrim(g.title))<5 OR char_length(btrim(g.description))<10
      OR g.price IS NULL OR g.price<0 OR g.exact_location IS NULL
      OR (g.deadline IS NOT NULL AND g.deadline<=clock_timestamp()) THEN
      RETURN '{"ok":false,"code":"HOME_RECORD_INVALID","status":400}'::jsonb; END IF;
    IF jsonb_typeof(g.items)='string' THEN g.items:=(g.items#>>'{}')::jsonb; END IF;
    INSERT INTO public."Gig"(
    title,description,price,category,deadline,estimated_duration,
    attachments,user_id,created_by,beneficiary_user_id,status,cancellation_policy,
    scheduled_start,location_precision,reveal_policy,visibility_scope,radius_miles,is_urgent,
    tags,ref_listing_id,items,source_type,source_id,schedule_type,
    pay_type,time_window_start,time_window_end,source_flow,engagement_mode,task_format,
    special_instructions,access_notes,required_tools,language_preference,preferred_helper_id,pickup_address,
    pickup_notes,dropoff_address,dropoff_notes,delivery_proof_required,requires_license,license_type,
    requires_insurance,deposit_required,deposit_amount,scope_description,task_archetype,starts_asap,
    response_window_minutes,care_details,logistics_details,remote_details,urgent_details,event_details,
    origin_mode,origin_home_id,origin_place_id,exact_address,exact_city,exact_state,
    exact_zip,exact_location,approx_location,geocode_provider,geocode_mode,geocode_accuracy,
    geocode_place_id,geocode_source_flow,geocode_created_at)
    VALUES(
    g.title,g.description,g.price,g.category,g.deadline,g.estimated_duration,
    g.attachments,g.user_id,g.created_by,g.beneficiary_user_id,g.status,g.cancellation_policy,
    g.scheduled_start,g.location_precision,g.reveal_policy,g.visibility_scope,g.radius_miles,g.is_urgent,
    g.tags,g.ref_listing_id,g.items,g.source_type,g.source_id,g.schedule_type,
    g.pay_type,g.time_window_start,g.time_window_end,g.source_flow,g.engagement_mode,g.task_format,
    g.special_instructions,g.access_notes,g.required_tools,g.language_preference,g.preferred_helper_id,g.pickup_address,
    g.pickup_notes,g.dropoff_address,g.dropoff_notes,g.delivery_proof_required,g.requires_license,g.license_type,
    g.requires_insurance,g.deposit_required,g.deposit_amount,g.scope_description,g.task_archetype,g.starts_asap,
    g.response_window_minutes,g.care_details,g.logistics_details,g.remote_details,g.urgent_details,g.event_details,
    g.origin_mode,g.origin_home_id,g.origin_place_id,g.exact_address,g.exact_city,g.exact_state,
    g.exact_zip,g.exact_location,g.approx_location,g.geocode_provider,g.geocode_mode,g.geocode_accuracy,
    g.geocode_place_id,g.geocode_source_flow,g.geocode_created_at) RETURNING * INTO g;
    INSERT INTO public."HomeTaskGigReceipt"(home_id,actor_user_id,request_id,task_id,gig_id,request_hash)
      VALUES(p_home_id,p_actor_id,p_request_id,p_task_id,g.id,h) RETURNING * INTO receipt;
    UPDATE public."HomeTask" SET converted_to_gig_id=g.id,updated_at=clock_timestamp() WHERE id=t.id;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,'home_task_gig_published','HomeTask',t.id,
        jsonb_build_object('gig_id',g.id,'request_id',p_request_id));
  END IF;
  RETURN jsonb_build_object('ok',true,'replayed',replayed,'gig',to_jsonb(g),
    'receipt',jsonb_build_object('home_id',p_home_id,'actor_id',p_actor_id,'task_id',p_task_id,
      'request_id',receipt.request_id,'gig_id',receipt.gig_id,'request_hash',receipt.request_hash,'created_at',receipt.created_at));
END $$;
REVOKE ALL ON FUNCTION public.get_home_task_gig_publication(uuid,uuid,uuid),
  public.publish_home_task_gig(uuid,uuid,uuid,uuid,timestamptz,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_task_gig_publication(uuid,uuid,uuid),
  public.publish_home_task_gig(uuid,uuid,uuid,uuid,timestamptz,jsonb,jsonb) TO service_role;

-- Keep the explicit Home dependency policy intact and extend it with immutable
-- publication history. Deleting a task/Gig cannot erase its original receipt.
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
