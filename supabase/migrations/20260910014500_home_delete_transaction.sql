-- Backwards compatible: yes. Add service-only deletion RPCs; existing rows and
-- storage tombstones are preserved. New NOT VALID FKs fence future attachments
-- without rewriting or certifying any historical orphan records.
SET LOCAL lock_timeout = '5s';

-- These UUID references lacked an FK. RESTRICT deliberately keeps linked mail
-- and map records intact; their retirement is a separate operation.
ALTER TABLE public."CommunityMailItem" ADD CONSTRAINT community_mail_home_delete_guard
  FOREIGN KEY (home_id) REFERENCES public."Home"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public."HomeMapPin" ADD CONSTRAINT home_map_pin_home_delete_guard
  FOREIGN KEY (home_id) REFERENCES public."Home"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public."VacationHold" ADD CONSTRAINT vacation_hold_home_delete_guard
  FOREIGN KEY (home_id) REFERENCES public."Home"(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public."MailDeliveryIntent" ADD CONSTRAINT mail_delivery_intent_home_delete_guard
  FOREIGN KEY (intended_home_id) REFERENCES public."Home"(id) ON DELETE RESTRICT NOT VALID;

-- Calendar scope_key is polymorphic text. Parse only Home keys; non-Home
-- state/city/county rules keep their existing format and behavior.
CREATE FUNCTION public.home_calendar_scope_id(p_scope_key text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
BEGIN
  RETURN p_scope_key::uuid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.home_calendar_scope_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_calendar_scope_id(text) TO service_role;

CREATE FUNCTION public.fence_home_calendar_attachment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_home_id uuid;
BEGIN
  IF NEW.scope_type = 'home' THEN
    v_home_id := public.home_calendar_scope_id(NEW.scope_key);
    PERFORM id FROM public."Home" WHERE id = v_home_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Home calendar scope must reference an existing Home' USING ERRCODE = '23503';
    END IF;
    NEW.scope_key := v_home_id::text;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.fence_home_calendar_attachment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER fence_home_calendar_attachment
BEFORE INSERT OR UPDATE ON public."AddressCalendarRule"
FOR EACH ROW EXECUTE FUNCTION public.fence_home_calendar_attachment();

CREATE FUNCTION public.home_delete_eligibility(p_home_id uuid, p_user_id uuid)
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
    IF EXISTS (SELECT FROM public."HomeOwnershipClaim" WHERE home_id = p_home_id
        AND (claimant_user_id <> p_user_id OR state NOT IN ('draft','submitted') OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL OR merged_into_claim_id IS NOT NULL))
      OR EXISTS (SELECT FROM public."HomeOwnershipClaim" foreign_claim JOIN public."HomeOwnershipClaim" own_claim
        ON foreign_claim.merged_into_claim_id = own_claim.id WHERE own_claim.home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeAuditLog" a WHERE a.home_id = p_home_id AND (
        a.actor_user_id IS DISTINCT FROM p_user_id OR NOT coalesce(
          (a.action = 'OCCUPANCY_TEMPLATE_APPLIED' AND a.target_type = 'HomeOccupancy'
            AND a.target_id = v_occ.id
            AND a.metadata->>'verification_status' IN ('provisional_bootstrap','pending_doc'))
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
      OR EXISTS (SELECT FROM public."HomeCalendarEvent" WHERE home_id = p_home_id)
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
      OR EXISTS (SELECT FROM public."HomeTaskMedia" WHERE home_id = p_home_id)
      OR EXISTS (SELECT FROM public."HomeTask" WHERE home_id = p_home_id)
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
REVOKE ALL ON FUNCTION public.home_delete_eligibility(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.home_delete_eligibility(uuid,uuid) TO service_role;

CREATE FUNCTION public.delete_home_authorized(p_home_id uuid,p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout = '5s' AS $$
DECLARE v_eligibility jsonb;
BEGIN
  IF p_home_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_ACCESS_DENIED','deleted',false);
  END IF;
  -- Parent key lock fences new FK attachments; current authority rows also
  -- lock so a concurrent revocation/deny settles before the final decision.
  PERFORM id FROM public."Home" WHERE id = p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false,'code','HOME_NOT_FOUND','deleted',false); END IF;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomePermissionOverride" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  LOCK TABLE public."HomeRolePermission" IN SHARE MODE;
  PERFORM id FROM public."HomeOwnershipClaim" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeAuditLog" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeAccessSecret" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."UnlistedRemoval" WHERE home_id = p_home_id ORDER BY id FOR UPDATE;
  -- This polymorphic relation has no FK. The same bounded table lock used by
  -- pickup mutation protects historical rows, including author changes; its
  -- new trigger additionally rejects an insert after the Home is deleted.
  LOCK TABLE public."AddressCalendarRule" IN SHARE ROW EXCLUSIVE MODE;
  v_eligibility := public.home_delete_eligibility(p_home_id,p_user_id);
  IF v_eligibility->>'allowed' IS DISTINCT FROM 'true' THEN RETURN v_eligibility; END IF;
  UPDATE public."Payment" SET home_id = NULL WHERE home_id = p_home_id;
  DELETE FROM public."AddressCalendarRule" WHERE scope_type = 'home'
    AND public.home_calendar_scope_id(scope_key) = p_home_id;
  DELETE FROM public."Home" WHERE id = p_home_id;
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETED','deleted',true);
EXCEPTION
  -- PL/pgSQL's exception block rolls back every write above, including Payment
  -- unlink and schedule removal. Do not return provider/schema error details.
  WHEN lock_not_available OR serialization_failure OR deadlock_detected THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_RETRY','deleted',false);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('allowed',false,'code','HOME_DELETE_FAILED','deleted',false);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_home_authorized(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_home_authorized(uuid,uuid) TO service_role;

-- A direct owner DELETE bypassed age, status, explicit deny, and storage
-- retirement. Include the known hosted policy name without assuming its body.
DROP POLICY IF EXISTS home_delete_owner ON public."Home";
DROP POLICY IF EXISTS home_delete_authorized ON public."Home";
REVOKE DELETE ON TABLE public."Home" FROM PUBLIC, anon, authenticated;
