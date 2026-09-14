-- Backwards compatible: yes. The deployed app can keep using its existing writes.
-- Reuse the existing lease, invite, resident,
-- occupancy and audit tables; no data rewrite or replacement tenancy schema.
-- Separate REST writes could activate a lease without membership and could not
-- safely recover a lost response. The lease's service-only metadata holds the
-- completed decision, bound to the existing membership generation.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.decide_home_lease(
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
  v_latest_lease_id uuid; v_latest_lease_state text;
BEGIN
  IF p_actor_id IS NULL OR p_action NOT IN ('approve','deny','accept','end','move_out','cancel','request') OR p_action IS NULL
    OR p_validity_days IS NULL OR p_validity_days<1 OR p_validity_days>36500
    OR p_dates IS NULL OR jsonb_typeof(p_dates)<>'object' THEN
    RETURN jsonb_build_object('success',false,'error','Invalid lease decision');
  END IF;
  IF p_action='request' THEN
    v_home_id:=p_home_id;
  ELSIF p_action='accept' THEN
    SELECT home_id INTO v_home_id FROM public."HomeLeaseInvite" WHERE token_hash=p_token_hash;
  ELSE
    SELECT home_id INTO v_home_id FROM public."HomeLease" WHERE id=p_lease_id;
  END IF;
  IF v_home_id IS NULL OR NOT public.lock_home_invitation_scope(v_home_id) THEN
    RETURN jsonb_build_object('success',false,'status',404,'error',CASE WHEN p_action='request' THEN 'Home not found' ELSE 'Lease or invite not found' END);
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
  ELSE
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
  IF p_action IN ('approve','accept','request') AND v_home.address_id IS NOT NULL THEN
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
        start_at,end_at,access_start_at,access_end_at,added_by_user_id,verification_status,
        verified_at,verification_expires_at,can_manage_home,can_manage_access,can_manage_finance,
        can_manage_tasks,can_view_sensitive,updated_at)
      VALUES(v_home_id,v_tenant_id,v_role::text,v_role,true,v_start,v_end,v_start,v_end,p_actor_id,
        'verified',v_now,v_now+make_interval(days=>p_validity_days),false,false,false,
        'tasks.edit'=ANY(v_permissions) OR 'tasks.manage'=ANY(v_permissions),
        'sensitive.view'=ANY(v_permissions),v_now)
      ON CONFLICT(home_id,user_id) DO UPDATE SET role=EXCLUDED.role,role_base=EXCLUDED.role_base,
        is_active=true,start_at=EXCLUDED.start_at,end_at=EXCLUDED.end_at,
        access_start_at=EXCLUDED.access_start_at,access_end_at=EXCLUDED.access_end_at,
        added_by_user_id=EXCLUDED.added_by_user_id,verification_status='verified',
        verified_at=EXCLUDED.verified_at,verification_expires_at=EXCLUDED.verification_expires_at,
        can_manage_home=false,can_manage_access=false,can_manage_finance=false,
        can_manage_tasks=EXCLUDED.can_manage_tasks,can_view_sensitive=EXCLUDED.can_view_sensitive,updated_at=v_now
      RETURNING * INTO v_occupancy;
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
REVOKE ALL ON FUNCTION public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer,uuid,text,jsonb) TO service_role;
