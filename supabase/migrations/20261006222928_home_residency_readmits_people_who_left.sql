-- Backwards compatible: yes. Redefines one internal admission function with the same
-- signature and grants; no table, column or data change.
-- Someone who left a Home themselves can apply for it again.
--
-- Leaving marks the membership 'moved_out' and ends it. Every self-service admission path then
-- refused that row with MEMBERSHIP_RENEWAL_REQUIRED, so a person who tapped Leave by mistake, or
-- moved back, could never add that Home again, and a sole member of a private setup had no one to
-- invite them. Their earlier row and decision are now reset to a fresh pending application and the
-- usual household review or postcard proof decides. A member the household removed ('inactive')
-- is still refused here; the household's invitation is the only way back for them.
--
-- Same signature and service-only grants; grants are restated below.

CREATE OR REPLACE FUNCTION public.save_home_residency_admission(p_home_id uuid,p_actor_id uuid,p_claimed_role text,
  p_claimed_address text,p_expected_address jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h public."Home"%ROWTYPE; r public."HomeResidencyClaim"%ROWTYPE;
  o public."HomeOccupancy"%ROWTYPE; u public."User"%ROWTYPE;
  v_role text; v_save_role text; v_claim_address text; v_route text; v_age public.home_age_band; v_now timestamptz;
  v_error text; v_status integer; v_candidates uuid[]; v_authorities uuid[];
  v_existing boolean; v_claimed text; v_created boolean; v_changed boolean:=false; v_returning boolean:=false;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR length(p_claimed_address)>1000
    OR (p_request_id IS NULL AND p_expected_address IS NOT NULL)
    OR (p_request_id IS NOT NULL AND (p_claimed_role IS NULL OR p_claimed_role NOT IN ('renter','household')
      OR jsonb_typeof(p_expected_address) IS DISTINCT FROM 'object' OR p_claimed_address IS NOT NULL)) THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-residency-submit:'||p_actor_id::text,0));
  SELECT * INTO u FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"RESIDENCY_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  <<validate_admission>>
  BEGIN
    IF NOT public.lock_home_residency_review_scope(p_home_id) THEN
      v_error:='HOME_NOT_FOUND'; v_status:=404; EXIT validate_admission; END IF;
    SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
    v_now:=clock_timestamp();
    IF h.security_state IN ('frozen','frozen_silent','disputed') OR h.home_status IN ('archived','merged') THEN
      v_error:='RESIDENCY_HOME_UNAVAILABLE'; v_status:=403; EXIT validate_admission; END IF;
    -- Compare the exact selected Home snapshot returned by check-address. This
    -- is a concurrency fence, not address normalization or deduplication. It
    -- supports legacy Homes without canonical IDs and never crosses apartments.
    IF p_request_id IS NOT NULL AND p_expected_address IS DISTINCT FROM jsonb_build_object('line1',h.address,'line2',coalesce(h.address2,''),
      'city',h.city,'state',h.state,'postal_code',h.zipcode,'country',coalesce(h.country,'US')) THEN
      v_error:='RESIDENCY_ADDRESS_CHANGED'; v_status:=409; EXIT validate_admission; END IF;
    SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
    v_existing:=FOUND;
    SELECT * INTO r FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_actor_id;
    -- The full (user_id,home_id) unique constraint guarantees one current row.
    -- Someone who left this Home themselves ('moved_out') applies again like anyone at the address:
    -- their ended membership and earlier decision are history and are reset below, and the same
    -- household review or postcard proof decides. A member the household removed ('inactive') still
    -- can't readmit themselves; only the household's invitation brings them back.
    v_returning:=v_existing AND o.is_active IS DISTINCT FROM true AND o.verification_status='moved_out';
    -- Omission is resolved here, after the shared locks, not by an HTTP pre-read.
    v_save_role:=CASE WHEN p_request_id IS NOT NULL THEN p_claimed_role
      ELSE coalesce(nullif(btrim(p_claimed_role),''),CASE WHEN r.id IS NULL THEN 'member' ELSE r.claimed_role END) END;
    v_role:=public.home_residency_role_family(v_save_role);
    IF v_role IS NULL THEN
      v_error:=CASE WHEN r.id IS NOT NULL AND nullif(btrim(p_claimed_role),'') IS NULL
        THEN 'RESIDENCY_EXISTING_REQUEST' ELSE 'RESIDENCY_SUBMISSION_INVALID' END;
      v_status:=CASE WHEN v_error='RESIDENCY_EXISTING_REQUEST' THEN 409 ELSE 400 END;
      EXIT validate_admission;
    END IF;
    -- A legacy address is an unreviewed assertion. It is never substituted for
    -- a caller-reviewed snapshot, and an existing pending assertion is immutable.
    IF p_request_id IS NULL AND r.status='pending' AND nullif(p_claimed_address,'') IS NOT NULL
      AND p_claimed_address IS DISTINCT FROM r.claimed_address THEN
      v_error:='RESIDENCY_EXISTING_REQUEST'; v_status:=409; EXIT validate_admission; END IF;
    v_claim_address:=CASE WHEN p_request_id IS NOT NULL THEN concat_ws(', ',h.address,nullif(h.address2,''))
      ELSE coalesce(nullif(p_claimed_address,''),r.claimed_address,h.address) END;

    IF h.owner_id=p_actor_id OR o.role_base IN ('owner','admin','manager')
      OR o.role IN ('owner','admin','manager','property_manager')
      OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id) THEN
      v_error:='OWNERSHIP_FLOW_REQUIRED'; v_status:=409; EXIT validate_admission; END IF;
    IF v_existing AND NOT v_returning AND (o.is_active IS DISTINCT FROM true OR o.end_at IS NOT NULL
      OR o.start_at>v_now OR o.access_start_at>v_now OR o.access_end_at<=v_now
      OR o.verification_status IS NULL OR o.verification_status NOT IN
        ('verified','unverified','pending','pending_approval','pending_doc','pending_postcard','provisional_bootstrap')) THEN
      v_error:='MEMBERSHIP_RENEWAL_REQUIRED'; v_status:=409; EXIT validate_admission; END IF;
    IF NOT v_returning AND (o.verification_status='verified' OR r.status='verified') THEN
      v_error:='RESIDENCY_ALREADY_VERIFIED'; v_status:=409; EXIT validate_admission; END IF;
    IF v_existing AND NOT v_returning AND (o.verified_at IS NOT NULL OR o.verification_expires_at IS NOT NULL) THEN
      v_error:='MEMBERSHIP_RENEWAL_REQUIRED'; v_status:=409; EXIT validate_admission; END IF;
    v_claimed:=public.home_residency_role_family(r.claimed_role);
    IF r.id IS NOT NULL AND NOT v_returning AND (r.status NOT IN ('pending','rejected') OR v_claimed IS NULL
      OR (r.status='pending' AND v_claimed<>v_role)) THEN
      v_error:='RESIDENCY_EXISTING_REQUEST'; v_status:=409; EXIT validate_admission; END IF;

    -- The same current policy used by prepared review includes owner records
    -- without occupancy, age ceilings, explicit denies and scheduled access.
    SELECT array_agg(DISTINCT candidate) INTO v_candidates FROM (
      SELECT user_id AS candidate FROM public."HomeOccupancy" WHERE home_id=p_home_id
      UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      UNION SELECT h.owner_id
    ) candidates WHERE candidate IS NOT NULL AND candidate<>p_actor_id;
    SELECT array_agg(candidate) INTO v_authorities FROM unnest(coalesce(v_candidates,'{}'::uuid[])) candidate
      WHERE public.home_residency_review_authority(p_home_id,candidate);
    IF cardinality(coalesce(v_authorities,'{}'::uuid[]))=0 THEN
      v_route:=CASE WHEN h.created_by_user_id=p_actor_id THEN 'self_bootstrap' ELSE 'external_postcard' END;
    ELSE
      -- Missing/unknown activity keeps human review; only known stale accounts
      -- select the existing postcard fallback. No provider is called here.
      v_route:=CASE WHEN NOT EXISTS(SELECT FROM unnest(v_authorities) a
        LEFT JOIN auth.users au ON au.id=a WHERE au.last_sign_in_at IS NULL OR au.last_sign_in_at>v_now-interval '30 days')
        THEN 'stale_authority_postcard' ELSE 'household_review' END;
    END IF;
  END validate_admission;
  IF v_error IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'code',v_error,'status',v_status);
  END IF;
  -- Required claim, occupancy and audit writes share this transaction. A constraint,
  -- trigger or result-write failure rolls back every one of them.
  v_created:=r.id IS NULL;
  IF r.id IS NULL THEN
    v_changed:=true;
    INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role,status,cold_start_mode)
      VALUES(p_home_id,p_actor_id,v_claim_address,v_save_role,'pending',
        CASE WHEN v_route='household_review' THEN NULL ELSE v_route END) RETURNING * INTO r;
  ELSIF r.status='rejected' OR v_returning THEN
    v_changed:=true;
    -- A fresh application cannot revive a code from before the rejected review (or the
    -- earlier membership of someone returning).
    -- Retain the evidence/dispatch receipt; only retire its admission capability.
    UPDATE public."HomePostcardCode" SET status='cancelled',updated_at=clock_timestamp()
      WHERE home_id=p_home_id AND user_id=p_actor_id AND status='pending';
    UPDATE public."HomeResidencyClaim" SET status='pending',claimed_role=v_save_role,
      claimed_address=v_claim_address,reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,
      cold_start_mode=CASE WHEN v_route='household_review' THEN NULL ELSE v_route END,
      postcard_auto_routed=false,postcard_code_id=NULL,updated_at=clock_timestamp()
      WHERE id=r.id RETURNING * INTO r;
  ELSIF NOT v_existing THEN
    v_changed:=true;
    -- Repair a historical stranded pending claim without altering a decision,
    -- existing occupancy, postcard identity or another pending role.
    UPDATE public."HomeResidencyClaim" SET cold_start_mode=CASE WHEN v_route='household_review' THEN NULL ELSE v_route END,
      updated_at=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
  ELSE
    -- A fresh duplicate command cannot re-route, re-template or renew dates.
    v_route:=coalesce(r.cold_start_mode,'household_review');
    IF v_route NOT IN ('household_review','self_bootstrap','external_postcard','stale_authority_postcard') THEN
      RAISE EXCEPTION 'Unknown existing residency routing' USING ERRCODE='22023'; END IF;
  END IF;
  IF NOT v_existing OR v_returning THEN
    v_age:=CASE WHEN u.date_of_birth>current_date-interval '13 years' THEN 'child'::public.home_age_band
      WHEN u.date_of_birth>current_date-interval '18 years' THEN 'teen'::public.home_age_band
      WHEN u.date_of_birth IS NOT NULL THEN 'adult'::public.home_age_band END;
  END IF;
  IF NOT v_existing THEN
    INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,
      can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
      VALUES(p_home_id,p_actor_id,CASE WHEN v_role='renter' THEN 'tenant' ELSE 'member' END,
        CASE WHEN v_route='self_bootstrap' THEN CASE WHEN v_role='renter' THEN 'lease_resident' ELSE 'member' END
          ELSE 'restricted_member' END::public.home_role_base,v_age,true,
        CASE WHEN v_route='self_bootstrap' THEN 'provisional_bootstrap'
          WHEN v_route='household_review' THEN 'pending_approval' ELSE 'pending_postcard' END,
        false,false,false,v_route='self_bootstrap' AND v_age IS DISTINCT FROM 'child',false) RETURNING * INTO o;
  ELSIF v_returning THEN
    -- The same fresh pending membership a first application creates; nothing from the earlier
    -- membership (dates, verification, permission overrides) carries over.
    DELETE FROM public."HomePermissionOverride" WHERE home_id=p_home_id AND user_id=p_actor_id;
    UPDATE public."HomeOccupancy" SET role=CASE WHEN v_role='renter' THEN 'tenant' ELSE 'member' END,
      role_base=(CASE WHEN v_route='self_bootstrap' THEN CASE WHEN v_role='renter' THEN 'lease_resident' ELSE 'member' END
        ELSE 'restricted_member' END)::public.home_role_base,age_band=v_age,is_active=true,start_at=now(),end_at=NULL,
      access_start_at=NULL,access_end_at=NULL,added_by_user_id=NULL,
      verification_status=CASE WHEN v_route='self_bootstrap' THEN 'provisional_bootstrap'
        WHEN v_route='household_review' THEN 'pending_approval' ELSE 'pending_postcard' END,
      verification_source=DEFAULT,verified_at=NULL,verification_expires_at=NULL,
      challenge_window_started_at=NULL,challenge_window_ends_at=NULL,
      can_manage_home=false,can_manage_access=false,can_manage_finance=false,
      can_manage_tasks=v_route='self_bootstrap' AND v_age IS DISTINCT FROM 'child',can_view_sensitive=false,
      updated_at=clock_timestamp() WHERE id=o.id RETURNING * INTO o;
  END IF;
  -- Protected fresh commands keep the accepted audit exactly. A legacy retry
  -- that merely reads the same pending admission causes no additional audit.
  IF p_request_id IS NOT NULL OR v_changed THEN
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,CASE WHEN p_request_id IS NULL THEN 'residency_legacy_submission_saved'
        ELSE 'residency_submission_saved' END,'HomeResidencyClaim',r.id,
        jsonb_build_object('claimed_role',v_role,'routing',v_route,'occupancy_id',o.id)
          ||CASE WHEN p_request_id IS NULL THEN '{"legacy_request":true}'::jsonb
            ELSE jsonb_build_object('request_id',p_request_id) END);
  END IF;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'actor_id',p_actor_id,'claim',to_jsonb(r),
    'occupancy_id',o.id,'claimed_role',v_role,'routing',v_route,'created',v_created,'reused',NOT v_changed);
END $$;

REVOKE ALL ON FUNCTION public.save_home_residency_admission(uuid,uuid,text,text,jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_home_residency_admission(uuid,uuid,text,text,jsonb,uuid) TO service_role;
