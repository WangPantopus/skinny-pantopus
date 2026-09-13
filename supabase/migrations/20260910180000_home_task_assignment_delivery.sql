-- Backwards compatible: yes. Existing tasks and notices are not backfilled.
-- Task, audit, original creation receipt, Notification and delivery identity
-- commit together. Provider transport always happens outside the transaction.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."HomeTaskAssignmentDelivery" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id uuid NOT NULL REFERENCES public."Home"(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  user_id uuid NOT NULL CHECK(user_id<>actor_id),
  notification_id uuid UNIQUE REFERENCES public."Notification"(id) ON DELETE SET NULL,
  notification_snapshot jsonb NOT NULL,
  push_allowed_at_assignment boolean NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','done','suppressed')),
  lease_id uuid, lease_until timestamptz,
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  last_error text
);
CREATE INDEX home_task_assignment_delivery_task ON public."HomeTaskAssignmentDelivery"(task_id,home_id);
CREATE INDEX home_task_assignment_delivery_due ON public."HomeTaskAssignmentDelivery"(retry_at,created_at,id) WHERE state='pending';
CREATE INDEX home_task_assignment_delivery_lease ON public."HomeTaskAssignmentDelivery"(lease_until,created_at,id) WHERE state='processing';
ALTER TABLE public."HomeTaskAssignmentDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeTaskAssignmentDelivery" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeTaskAssignmentDelivery" TO service_role;

CREATE FUNCTION public.home_task_assignment_note_snapshot(n public."Notification") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('id',n.id,'user_id',n.user_id,'type',n.type,'title',n.title,
    'body',n.body,'icon',n.icon,'link',n.link,'metadata',n.metadata,
    'context',n.context,'context_type',n.context_type,'context_id',n.context_id)
$$;

-- Changing assignment invalidates every older pending delivery, including an
-- A -> B -> A change. Deletion/completion also stops queued old assignments.
-- This trigger covers protected media deletion and service maintenance writes.
CREATE FUNCTION public.retire_home_task_assignment_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  -- During Home's cascading deletion its row is already gone. The outbox's
  -- own Home FK will delete these deliveries; updating them here would recheck
  -- a missing parent before that second cascade has run.
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT FROM public."Home" WHERE id=OLD.home_id) THEN RETURN OLD; END IF;
  IF TG_OP='DELETE' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.status NOT IN ('open','in_progress') THEN
    UPDATE public."HomeTaskAssignmentDelivery" SET state='suppressed',completed_at=clock_timestamp(),
      lease_id=NULL,lease_until=NULL,last_error=NULL
      WHERE home_id=OLD.home_id AND task_id=OLD.id AND state IN ('pending','processing');
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER retire_home_task_assignment_delivery BEFORE UPDATE OR DELETE ON public."HomeTask"
  FOR EACH ROW EXECUTE FUNCTION public.retire_home_task_assignment_delivery();

-- Keep the established authorization/validation/audit implementation unchanged.
-- Its private name is callable only from the new protected public boundary.
ALTER FUNCTION public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid)
  RENAME TO mutate_home_record_before_assignment_delivery;
REVOKE ALL ON FUNCTION public.mutate_home_record_before_assignment_delivery(uuid,uuid,text,text,uuid,jsonb,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.mutate_home_record(p_home_id uuid,p_actor_id uuid,p_kind text,p_action text,
  p_record_id uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}',p_source_mail_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r jsonb; before_assignee uuid; t public."HomeTask"; n public."Notification";
  push_allowed boolean; event_id uuid;
BEGIN
  IF p_kind='task' AND p_action IN ('create','update') THEN
    IF NOT public.lock_home_record_scope(p_home_id) THEN
      RETURN '{"ok":false,"code":"HOME_NOT_FOUND","status":404}'::jsonb; END IF;
    -- Home lock serializes all supported task writers. The preserved mutator
    -- then obtains source-Mail and task locks in their original order.
    SELECT assigned_to INTO before_assignee FROM public."HomeTask"
      WHERE home_id=p_home_id AND id=p_record_id;
  END IF;
  r:=public.mutate_home_record_before_assignment_delivery(p_home_id,p_actor_id,p_kind,p_action,p_record_id,p_payload,p_source_mail_id);
  IF r->>'ok' IS DISTINCT FROM 'true' OR r->>'replayed'='true' OR p_kind<>'task'
    OR p_action NOT IN ('create','update') THEN RETURN r; END IF;
  SELECT * INTO t FROM public."HomeTask" WHERE home_id=p_home_id AND id=(r->'record'->>'id')::uuid;
  IF t.id IS NULL OR t.assigned_to IS NULL OR t.assigned_to=p_actor_id
    OR t.status NOT IN ('open','in_progress')
    OR (p_action='update' AND t.assigned_to IS NOT DISTINCT FROM before_assignee) THEN RETURN r; END IF;
  -- Current recipient access and assignment have already been locked/validated
  -- by the original mutator. A private first-use Home permits only self assignment.
  IF NOT public.home_task_readable(t,t.assigned_to) THEN
    RAISE EXCEPTION 'Task notification recipient changed' USING ERRCODE='40001'; END IF;
  SELECT coalesce((SELECT push_notifications FROM public."MailPreferences" WHERE user_id=t.assigned_to),false)
    AND coalesce((SELECT home_reminders_enabled FROM public."UserNotificationPreferences" WHERE user_id=t.assigned_to),true)
    INTO push_allowed;
  event_id:=gen_random_uuid();
  -- Notification text deliberately contains no task title, Home address, mail
  -- content or actor name. Only the authorized task read exposes private details.
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context,context_type)
    VALUES(t.assigned_to,'task_assigned','A Home task was assigned to you',
      'Open Pantopus to view the current task details.','📋',
      '/app/homes/'||p_home_id||'/dashboard?tab=tasks',
      jsonb_build_object('home_id',p_home_id,'task_id',t.id,'assignment_event_id',event_id),
      'personal','personal') RETURNING * INTO n;
  INSERT INTO public."HomeTaskAssignmentDelivery"(id,home_id,task_id,actor_id,user_id,notification_id,
    notification_snapshot,push_allowed_at_assignment)
    VALUES(event_id,p_home_id,t.id,p_actor_id,t.assigned_to,n.id,public.home_task_assignment_note_snapshot(n),push_allowed);
  RETURN r;
END $$;

CREATE FUNCTION public.claim_home_task_assignment_delivery() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public."HomeTaskAssignmentDelivery";
BEGIN
  SELECT * INTO d FROM public."HomeTaskAssignmentDelivery"
    WHERE (state='pending' AND retry_at<=clock_timestamp()) OR (state='processing' AND lease_until<=clock_timestamp())
    ORDER BY retry_at,created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public."HomeTaskAssignmentDelivery" SET state='processing',lease_id=gen_random_uuid(),
    lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1 WHERE id=d.id RETURNING * INTO d;
  RETURN jsonb_build_object('id',d.id,'lease_id',d.lease_id);
END $$;

CREATE FUNCTION public.read_home_task_assignment_delivery(p_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d public."HomeTaskAssignmentDelivery"; n public."Notification"; r jsonb; eligible boolean;
BEGIN
  -- Preliminary routing read takes no delivery lock. The existing read acquires
  -- Home/authority -> source-Mail -> task before the final delivery lock, matching
  -- assignment changes and their invalidation trigger without a lock inversion.
  SELECT * INTO d FROM public."HomeTaskAssignmentDelivery" WHERE id=p_id;
  IF NOT FOUND THEN RETURN '{"lease_lost":true}'::jsonb; END IF;
  r:=public.get_home_records(d.home_id,d.user_id,'task',d.task_id);
  -- Notification deletion takes its row before the delivery FK's SET NULL.
  -- Match that order, then bind the captured row to the final leased delivery.
  SELECT * INTO n FROM public."Notification" WHERE id=d.notification_id FOR SHARE;
  SELECT * INTO d FROM public."HomeTaskAssignmentDelivery" WHERE id=p_id AND lease_id=p_lease_id
    AND state='processing' AND lease_until>clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"lease_lost":true}'::jsonb; END IF;
  eligible:=r->>'ok'='true' AND r->'records'->0->>'assigned_to'=d.user_id::text
    AND r->'records'->0->>'status' IN ('open','in_progress')
    AND n.id IS NOT NULL AND n.id=d.notification_id AND n.user_id=d.user_id
    AND public.home_task_assignment_note_snapshot(n)=d.notification_snapshot;
  RETURN jsonb_build_object('eligible',coalesce(eligible,false),'push_allowed_at_assignment',d.push_allowed_at_assignment,
    'notification',CASE WHEN eligible THEN to_jsonb(n) ELSE NULL END);
END $$;

CREATE FUNCTION public.finish_home_task_assignment_delivery(p_id uuid,p_lease_id uuid,p_outcome text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('done','suppressed','retry') THEN RETURN false; END IF;
  UPDATE public."HomeTaskAssignmentDelivery" SET state=CASE WHEN p_outcome='retry' THEN 'pending' ELSE p_outcome END,
    retry_at=clock_timestamp()+make_interval(secs=>least(3600,30*least(greatest(attempts,1),120))),
    lease_id=NULL,lease_until=NULL,last_error=CASE WHEN p_outcome='retry' THEN 'DELIVERY_UNRESOLVED' END,
    completed_at=CASE WHEN p_outcome='retry' THEN NULL ELSE clock_timestamp() END
    WHERE id=p_id AND lease_id=p_lease_id AND state='processing' AND lease_until>clock_timestamp();
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.home_task_assignment_note_snapshot(public."Notification"),
  public.retire_home_task_assignment_delivery(),
  public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid),
  public.claim_home_task_assignment_delivery(),public.read_home_task_assignment_delivery(uuid,uuid),
  public.finish_home_task_assignment_delivery(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_home_record(uuid,uuid,text,text,uuid,jsonb,uuid),
  public.claim_home_task_assignment_delivery(),public.read_home_task_assignment_delivery(uuid,uuid),
  public.finish_home_task_assignment_delivery(uuid,uuid,text) TO service_role;

-- Assignment to another household member is never private first-use data.
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
      OR EXISTS (SELECT FROM public."HomeTaskCreateReceipt" receipt WHERE receipt.home_id=p_home_id
        AND NOT (receipt.actor_user_id=p_actor_id AND receipt.private_setup))
      OR EXISTS (SELECT FROM public."HomeTaskAssignmentDelivery" d WHERE d.home_id=p_home_id)
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
      OR EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_claim_evidence_own_setup(i,p_actor_id))
      OR EXISTS (SELECT FROM public."File" f WHERE f.home_id=p_home_id AND (
        f.user_id<>p_actor_id OR (NOT EXISTS (SELECT FROM public."HomeVerificationEvidence" e
          JOIN public."HomeOwnershipClaim" c ON c.id=e.claim_id WHERE c.home_id=p_home_id
            AND c.claimant_user_id=p_actor_id AND (c.state IN ('draft','submitted')
              OR public.home_claim_own_private_withdrawal(c,p_actor_id))
            AND c.reviewed_by IS NULL AND c.reviewed_at IS NULL AND e.storage_ref=f.file_path)
          AND NOT EXISTS(SELECT FROM public."HomeClaimEvidenceIntent" i WHERE i.id=f.id AND i.home_id=p_home_id
            AND f.metadata=jsonb_build_object('storage_contract','home_claim_evidence_v1','upload_id',i.id)
            AND public.home_claim_evidence_own_setup(i,p_actor_id))
          AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=f.id AND i.home_id=p_home_id
            AND f.metadata=jsonb_build_object('storage_contract','home_task_media_v1','upload_id',i.id)
            AND public.home_task_media_own_setup(i,p_actor_id)))))
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
      OR EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.original_home_id=p_home_id
        AND NOT public.home_task_media_own_setup(i,p_actor_id))
      OR EXISTS (SELECT FROM public."HomeTaskMedia" m WHERE (home_id = p_home_id
        OR EXISTS(SELECT FROM public."HomeTask" t WHERE t.id=m.task_id AND t.home_id=p_home_id))
        AND NOT EXISTS(SELECT FROM public."HomeTaskMediaIntent" i WHERE i.id=m.private_upload_id AND i.id=m.id
          AND i.home_id=p_home_id AND i.task_id=m.task_id AND public.home_task_media_own_setup(i,p_actor_id)))
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

-- Assignment to another household member is never private first-use data.
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
  RETURN jsonb_build_object('allowed',true,'code','HOME_DELETE_ALLOWED','deleted',false);
END;
$$;
