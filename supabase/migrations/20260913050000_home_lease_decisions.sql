-- Backwards compatible API repair. Reuse the existing lease, invite, resident,
-- occupancy and audit tables; no data rewrite or replacement tenancy schema.
-- Separate REST writes could activate a lease without membership and could not
-- safely recover a lost response. The lease's service-only metadata holds the
-- completed decision, bound to the existing membership generation.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.decide_home_lease(
  p_action text, p_actor_id uuid, p_lease_id uuid DEFAULT NULL,
  p_authority_id uuid DEFAULT NULL, p_token_hash text DEFAULT NULL,
  p_user_email text DEFAULT NULL, p_dates jsonb DEFAULT '{}',
  p_reason text DEFAULT NULL, p_validity_days integer DEFAULT 730
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
BEGIN
  IF p_actor_id IS NULL OR p_action NOT IN ('approve','deny','accept') OR p_action IS NULL
    OR p_validity_days IS NULL OR p_validity_days<1 OR p_validity_days>36500
    OR p_dates IS NULL OR jsonb_typeof(p_dates)<>'object' THEN
    RETURN jsonb_build_object('success',false,'error','Invalid lease decision');
  END IF;
  IF p_action='accept' THEN
    SELECT home_id INTO v_home_id FROM public."HomeLeaseInvite" WHERE token_hash=p_token_hash;
  ELSE
    SELECT home_id INTO v_home_id FROM public."HomeLease" WHERE id=p_lease_id;
  END IF;
  IF v_home_id IS NULL OR NOT public.lock_home_invitation_scope(v_home_id) THEN
    RETURN jsonb_build_object('success',false,'error','Lease or invite not found');
  END IF;
  -- Match the existing Home mutation lock order. Re-read proofs after waiting;
  -- authority revocation and competing lease decisions serialize on these rows.
  PERFORM id FROM public."HomeAuthority" WHERE home_id=v_home_id ORDER BY id FOR UPDATE;
  IF p_action='accept' THEN
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
  IF v_authority.id IS NULL THEN
    RETURN jsonb_build_object('success',false,'error','Current verified authority required');
  END IF;
  IF p_action<>'accept' THEN
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
  IF p_action='accept' THEN
    SELECT * INTO v_lease FROM public."HomeLease" WHERE home_id=v_home_id
      AND metadata->>'invite_id'=v_invite.id::text ORDER BY id LIMIT 1 FOR UPDATE;
  ELSE
    SELECT * INTO v_lease FROM public."HomeLease" WHERE id=p_lease_id AND home_id=v_home_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Lease not found'); END IF;
  END IF;
  v_now:=clock_timestamp();
  SELECT * INTO v_home FROM public."Home" WHERE id=v_home_id;
  IF v_home.security_state IN ('frozen','frozen_silent') OR v_home.home_status IN ('merged','archived') THEN
    RETURN jsonb_build_object('success',false,'error','This home is unavailable for lease decisions');
  END IF;
  v_tenant_id:=CASE WHEN p_action='accept' THEN p_actor_id ELSE v_lease.primary_resident_user_id END;
  SELECT * INTO v_occupancy FROM public."HomeOccupancy" WHERE home_id=v_home_id AND user_id=v_tenant_id;
  v_intent:=jsonb_build_object('action',p_action,'actor_id',p_actor_id,'authority_id',v_authority.id,
    'dates',p_dates,'reason',p_reason);
  v_receipt:=v_lease.metadata->'landlord_decision';
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
        'intent',v_intent,'occupancy_id',v_occupancy.id,'membership_version',v_occupancy.membership_version)),
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
REVOKE ALL ON FUNCTION public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.decide_home_lease(text,uuid,uuid,uuid,text,text,jsonb,text,integer) TO service_role;
