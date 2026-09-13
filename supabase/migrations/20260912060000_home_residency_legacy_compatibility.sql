-- Backwards compatible: yes. Legacy residency submission now shares atomic
-- admission policy with protected commands. Existing claims, occupancies, proofs,
-- policy defaults and migration ledger are not backfilled or rewritten.
-- Legacy callers supply neither a request UUID nor a reviewed address snapshot.
-- Saving admission requests no postcard or paid-provider delivery. The legacy
-- service can attempt a generic reviewer notice after the admission commits.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.home_residency_role_family(p_role text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT CASE p_role WHEN 'renter' THEN 'renter' WHEN 'tenant' THEN 'renter'
    WHEN 'lease_resident' THEN 'renter' WHEN 'member' THEN 'household' WHEN 'household' THEN 'household'
    WHEN 'family' THEN 'household' WHEN 'roommate' THEN 'household' ELSE NULL END;
$$;

-- Internal shared admission: a non-null request ID belongs only to the protected
-- wrapper. Null means a legacy current-state request, with no fabricated receipt.
CREATE FUNCTION public.save_home_residency_admission(p_home_id uuid,p_actor_id uuid,p_claimed_role text,
  p_claimed_address text,p_expected_address jsonb,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h public."Home"%ROWTYPE; r public."HomeResidencyClaim"%ROWTYPE;
  o public."HomeOccupancy"%ROWTYPE; u public."User"%ROWTYPE;
  v_role text; v_save_role text; v_claim_address text; v_route text; v_age public.home_age_band; v_now timestamptz;
  v_error text; v_status integer; v_candidates uuid[]; v_authorities uuid[];
  v_existing boolean; v_claimed text; v_created boolean; v_changed boolean:=false;
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
    IF v_existing AND (o.is_active IS DISTINCT FROM true OR o.end_at IS NOT NULL
      OR o.start_at>v_now OR o.access_start_at>v_now OR o.access_end_at<=v_now
      OR o.verification_status IS NULL OR o.verification_status NOT IN
        ('verified','unverified','pending','pending_approval','pending_doc','pending_postcard','provisional_bootstrap')) THEN
      v_error:='MEMBERSHIP_RENEWAL_REQUIRED'; v_status:=409; EXIT validate_admission; END IF;
    IF o.verification_status='verified' OR r.status='verified' THEN
      v_error:='RESIDENCY_ALREADY_VERIFIED'; v_status:=409; EXIT validate_admission; END IF;
    IF v_existing AND (o.verified_at IS NOT NULL OR o.verification_expires_at IS NOT NULL) THEN
      v_error:='MEMBERSHIP_RENEWAL_REQUIRED'; v_status:=409; EXIT validate_admission; END IF;
    v_claimed:=public.home_residency_role_family(r.claimed_role);
    IF r.id IS NOT NULL AND (r.status NOT IN ('pending','rejected') OR v_claimed IS NULL
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
  ELSIF r.status='rejected' THEN
    v_changed:=true;
    -- A fresh application cannot revive a code from before the rejected review.
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
  IF NOT v_existing THEN
    v_age:=CASE WHEN u.date_of_birth>current_date-interval '13 years' THEN 'child'::public.home_age_band
      WHEN u.date_of_birth>current_date-interval '18 years' THEN 'teen'::public.home_age_band
      WHEN u.date_of_birth IS NOT NULL THEN 'adult'::public.home_age_band END;
    INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,
      can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
      VALUES(p_home_id,p_actor_id,CASE WHEN v_role='renter' THEN 'tenant' ELSE 'member' END,
        CASE WHEN v_route='self_bootstrap' THEN CASE WHEN v_role='renter' THEN 'lease_resident' ELSE 'member' END
          ELSE 'restricted_member' END::public.home_role_base,v_age,true,
        CASE WHEN v_route='self_bootstrap' THEN 'provisional_bootstrap'
          WHEN v_route='household_review' THEN 'pending_approval' ELSE 'pending_postcard' END,
        false,false,false,v_route='self_bootstrap' AND v_age IS DISTINCT FROM 'child',false) RETURNING * INTO o;
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

CREATE OR REPLACE FUNCTION public.submit_home_residency(p_home_id uuid,p_actor_id uuid,p_request_id uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeResidencySubmissionCommand"%ROWTYPE;
  v_hash text; v_role text; v_admission jsonb;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL
    OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object' THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  IF EXISTS(SELECT FROM jsonb_object_keys(p_intent) k WHERE k NOT IN ('claimed_role','address'))
    OR jsonb_typeof(p_intent->'claimed_role') IS DISTINCT FROM 'string'
    OR p_intent->>'claimed_role' NOT IN ('renter','household') THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  IF jsonb_typeof(p_intent->'address') IS DISTINCT FROM 'object' THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  IF EXISTS(SELECT FROM jsonb_object_keys(p_intent->'address') k WHERE k NOT IN ('line1','line2','city','state','postal_code','country'))
    OR EXISTS(SELECT FROM (VALUES('line1',255),('line2',255),('city',100),('state',50),('postal_code',20),('country',100)) f(k,max_length)
      WHERE jsonb_typeof(p_intent->'address'->k) IS DISTINCT FROM 'string'
        OR length(p_intent->'address'->>k)>max_length OR (k<>'line2' AND btrim(p_intent->'address'->>k)='')) THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  v_role:=p_intent->>'claimed_role';
  v_hash:=encode(sha256(convert_to(p_intent::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('home-residency-submit:'||p_actor_id::text,0));
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"RESIDENCY_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeResidencySubmissionCommand"
    WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF c.home_id<>p_home_id OR (c.intent_hash IS NOT NULL AND c.intent_hash<>v_hash) THEN
      RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_CONFLICT","status":409}'::jsonb; END IF;
    RETURN public.home_residency_submission_projection(c)||'{"replayed":true}'::jsonb;
  END IF;
  INSERT INTO public."HomeResidencySubmissionCommand"(actor_user_id,request_id,home_id,intent_hash,state)
    VALUES(p_actor_id,p_request_id,p_home_id,v_hash,'pending') RETURNING * INTO c;

  v_admission:=public.save_home_residency_admission(p_home_id,p_actor_id,v_role,NULL,p_intent->'address',p_request_id);
  IF v_admission->>'ok' IS DISTINCT FROM 'true' THEN
    UPDATE public."HomeResidencySubmissionCommand" SET state='rejected',error_code=v_admission->>'code',
      error_status=(v_admission->>'status')::integer,updated_at=clock_timestamp()
      WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
    RETURN public.home_residency_submission_projection(c);
  END IF;
  UPDATE public."HomeResidencySubmissionCommand" SET state='completed',claim_id=(v_admission->'claim'->>'id')::uuid,
    occupancy_id=(v_admission->>'occupancy_id')::uuid,claimed_role=v_role,routing=v_admission->>'routing',updated_at=clock_timestamp()
    WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  RETURN public.home_residency_submission_projection(c)||'{"replayed":false}'::jsonb;
END $$;

CREATE FUNCTION public.submit_legacy_home_residency(p_home_id uuid,p_actor_id uuid,p_intent jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE v_role text;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object' THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  IF EXISTS(SELECT FROM jsonb_object_keys(p_intent)k WHERE k NOT IN ('claimed_role','claimed_address'))
    OR (p_intent ? 'claimed_role' AND jsonb_typeof(p_intent->'claimed_role') NOT IN ('string','null'))
    OR (p_intent ? 'claimed_address' AND jsonb_typeof(p_intent->'claimed_address') NOT IN ('string','null'))
    OR length(p_intent->>'claimed_address')>1000 THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  v_role:=nullif(btrim(p_intent->>'claimed_role'),'');
  IF v_role IN ('owner','admin','manager','property_manager') THEN
    RETURN '{"ok":false,"code":"OWNERSHIP_FLOW_REQUIRED","status":409}'::jsonb; END IF;
  IF v_role IS NOT NULL AND public.home_residency_role_family(v_role) IS NULL THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  RETURN public.save_home_residency_admission(p_home_id,p_actor_id,v_role,p_intent->>'claimed_address',NULL,NULL);
END $$;

-- A post-commit notification is optional and carries no private profile/address.
-- Current authority and claim generation are rechecked before selecting recipients.
CREATE FUNCTION public.get_legacy_home_residency_reviewers(p_home_id uuid,p_actor_id uuid,p_claim_id uuid,
  p_claim_updated_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE h public."Home"%ROWTYPE; r public."HomeResidencyClaim"%ROWTYPE; v_reviewers uuid[]:='{}'::uuid[];
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_claim_id IS NULL OR p_claim_updated_at IS NULL THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  IF public.lock_home_residency_review_scope(p_home_id) THEN
    SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
    SELECT * INTO r FROM public."HomeResidencyClaim" WHERE id=p_claim_id AND home_id=p_home_id AND user_id=p_actor_id
      AND status='pending' AND updated_at=p_claim_updated_at;
    IF FOUND AND coalesce(r.cold_start_mode,'household_review')='household_review' THEN
      SELECT coalesce(array_agg(candidate ORDER BY candidate),'{}'::uuid[]) INTO v_reviewers FROM (
        SELECT user_id candidate FROM public."HomeOccupancy" WHERE home_id=p_home_id
        UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        UNION SELECT h.owner_id
      ) c WHERE candidate IS NOT NULL AND candidate<>p_actor_id
        AND public.home_residency_review_authority(p_home_id,candidate);
    END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'actor_id',p_actor_id,'claim_id',p_claim_id,'reviewer_ids',v_reviewers);
END $$;

REVOKE ALL ON FUNCTION public.home_residency_role_family(text),
  public.save_home_residency_admission(uuid,uuid,text,text,jsonb,uuid),
  public.submit_legacy_home_residency(uuid,uuid,jsonb),
  public.get_legacy_home_residency_reviewers(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_residency_role_family(text),
  public.save_home_residency_admission(uuid,uuid,text,text,jsonb,uuid),
  public.submit_legacy_home_residency(uuid,uuid,jsonb),
  public.get_legacy_home_residency_reviewers(uuid,uuid,uuid,timestamptz) TO service_role;

-- Actual accepted-source HTTP baseline confirmed that role-omitted approval
-- rejected a canonical household claim. Add only this residential alias; retain
-- the accepted current-authority, age, postal, receipt and membership guards.
CREATE OR REPLACE FUNCTION public.review_home_residency(
  p_home_id uuid, p_actor_id uuid, p_action text, p_payload jsonb DEFAULT '{}',
  p_validity_days integer DEFAULT 365)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
SET lock_timeout = '5s' AS $$
DECLARE
  v_home public."Home"%ROWTYPE; v_claim public."HomeResidencyClaim"%ROWTYPE;
  v_target public."HomeOccupancy"%ROWTYPE; v_user public."User"%ROWTYPE;
  v_actor jsonb; v_access jsonb; v_actor_role public.home_role_base;
  v_role public.home_role_base; v_old_role public.home_role_base;
  v_actor_permissions text[]; v_permissions text[];
  v_target_id uuid; v_claim_id uuid; v_has_target boolean;
  v_now timestamptz; v_replay boolean := false; v_existing_verified boolean := false;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_action IS NULL
    OR p_action NOT IN ('attach','approve','reject')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR p_validity_days IS NULL OR p_validity_days NOT BETWEEN 1 AND 3650
    OR EXISTS (SELECT FROM jsonb_object_keys(p_payload) k
      WHERE k NOT IN ('target_id','claim_id','role','reason'))
    OR (p_action='attach' AND (NOT p_payload ? 'target_id'
      OR p_payload ?| ARRAY['claim_id','role','reason']))
    OR (p_action<>'attach' AND (NOT p_payload ? 'claim_id' OR p_payload ? 'target_id'))
    OR (p_action='approve' AND p_payload ? 'reason')
    OR (p_action='reject' AND p_payload ? 'role') THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID_ADMISSION_REQUEST','status',400);
  END IF;
  SELECT * INTO v_home FROM public."Home" WHERE id=p_home_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  -- Match member-authority lock order. Admission cannot race a removal, a role
  -- change, an explicit deny, a preset change or an ownership transition.
  LOCK TABLE public."HomeRolePermission", public."HomeRolePreset" IN SHARE MODE;
  PERFORM id FROM public."HomeOccupancy" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM id FROM public."HomeOwner" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  PERFORM user_id FROM public."HomePermissionOverride" WHERE home_id=p_home_id ORDER BY user_id,permission FOR UPDATE;
  IF p_action='attach' THEN
    v_target_id := (p_payload->>'target_id')::uuid;
  ELSE
    v_claim_id := (p_payload->>'claim_id')::uuid;
    SELECT * INTO v_claim FROM public."HomeResidencyClaim"
      WHERE id=v_claim_id AND home_id=p_home_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_FOUND','status',404); END IF;
    v_target_id := v_claim.user_id;
  END IF;
  -- Recalculate after every potentially blocking lock, rather than admitting
  -- an actor whose access expired while this transaction waited.
  v_now := clock_timestamp();
  v_actor := public.home_effective_access(p_home_id,p_actor_id);
  IF v_home.security_state IN ('frozen','frozen_silent') OR v_home.home_status IN ('merged','archived')
    OR NOT (v_actor->'permissions') ? 'members.manage'
    OR EXISTS (SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id
      AND (start_at>v_now OR end_at<=v_now OR access_start_at>v_now OR access_end_at<=v_now))
    OR (v_actor->>'is_owner'='true'
      AND EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status IN ('revoked','disputed'))
      AND NOT EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
        AND subject_id=p_actor_id AND owner_status='verified')) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERS_MANAGE_REQUIRED','status',403);
  END IF;
  IF v_target_id IS NULL OR v_target_id=p_actor_id THEN
    RETURN jsonb_build_object('ok',false,'code','SELF_ADMISSION_FORBIDDEN','status',403);
  END IF;
  SELECT * INTO v_user FROM public."User" WHERE id=v_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','USER_NOT_FOUND','status',404); END IF;
  IF p_action='reject' THEN
    IF v_claim.status='rejected' AND v_claim.reviewed_by=p_actor_id THEN
      RETURN jsonb_build_object('ok',true,'code','CLAIM_REJECTED','replayed',true,'target_id',v_target_id);
    END IF;
    IF v_claim.status IS DISTINCT FROM 'pending' THEN
      RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_PENDING','status',409);
    END IF;
    IF length(p_payload->>'reason')>2000 THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID_ADMISSION_REQUEST','status',400);
    END IF;
    UPDATE public."HomeResidencyClaim" SET status='rejected',reviewed_by=p_actor_id,
      reviewed_at=v_now,review_note=nullif(p_payload->>'reason',''),updated_at=v_now WHERE id=v_claim_id;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,'residency_claim_rejected','HomeResidencyClaim',v_claim_id,
        jsonb_build_object('user_id',v_target_id));
    RETURN jsonb_build_object('ok',true,'code','CLAIM_REJECTED','replayed',false,'target_id',v_target_id);
  END IF;
  SELECT * INTO v_target FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=v_target_id;
  v_has_target := FOUND;
  v_old_role := v_target.role_base;
  IF v_old_role IS NULL THEN
    v_old_role := CASE v_target.role
      WHEN 'owner' THEN 'owner' WHEN 'admin' THEN 'admin' WHEN 'manager' THEN 'manager'
      WHEN 'property_manager' THEN 'manager' WHEN 'tenant' THEN 'lease_resident'
      WHEN 'renter' THEN 'lease_resident' WHEN 'lease_resident' THEN 'lease_resident'
      WHEN 'member' THEN 'member' WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
      WHEN 'restricted_member' THEN 'restricted_member' WHEN 'caregiver' THEN 'restricted_member'
      WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
  END IF;
  IF v_home.owner_id=v_target_id OR v_old_role='owner'
    OR EXISTS (SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
      AND subject_id=v_target_id) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409);
  END IF;
  IF v_has_target AND (v_target.is_active IS DISTINCT FROM true OR v_old_role IS NULL
    OR v_target.end_at<=v_now OR v_target.access_end_at<=v_now
    OR (v_target.start_at IS NOT NULL AND v_target.end_at<=v_target.start_at)
    OR (v_target.access_start_at IS NOT NULL AND v_target.access_end_at<=v_target.access_start_at)
    OR greatest(v_target.start_at,v_target.access_start_at)>=least(v_target.end_at,v_target.access_end_at)
    OR v_target.verification_status IS NULL
    OR v_target.verification_status NOT IN ('verified','unverified','pending','pending_approval',
      'pending_doc','pending_postcard','provisional_bootstrap','provisional')
    OR (v_target.verification_status<>'verified' AND v_target.verified_at IS NOT NULL)) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409);
  END IF;
  -- A recorded postal code leaves the claim pending during household review.
  -- Admit only that coherent provisional window, never a stale/partial grant.
  IF v_has_target AND v_target.verification_status='provisional' AND (
    v_target.verification_expires_at IS NOT NULL
    OR v_target.challenge_window_started_at IS NULL OR v_target.challenge_window_started_at>v_now
    OR v_target.challenge_window_ends_at IS NULL
    OR v_target.challenge_window_ends_at<v_target.challenge_window_started_at+interval '7 days'
    OR coalesce(v_home.country,'US')<>'US'
    OR NOT EXISTS(SELECT FROM public."HomePostcardCode" p WHERE p.home_id=p_home_id AND p.user_id=v_target_id
      AND p.status='verified' AND p.verified_at>=v_target.challenge_window_started_at AND p.verified_at<=v_target.challenge_window_ends_at
      AND p.destination=jsonb_build_object('address',v_home.address,'address2',v_home.address2,
        'city',v_home.city,'state',v_home.state,'zipcode',v_home.zipcode))) THEN
    RETURN jsonb_build_object('ok',false,'code','MEMBERSHIP_RENEWAL_REQUIRED','status',409);
  END IF;
  v_existing_verified := v_has_target AND v_target.verification_status='verified';
  IF p_action='approve' AND v_claim.status IS DISTINCT FROM 'pending' THEN
    -- Exact retry returns current membership only. It cannot reapply an old
    -- role, renew dates or reactivate someone removed after the first approval.
    IF v_claim.status='verified' AND v_claim.reviewed_by=p_actor_id AND v_existing_verified THEN
      v_replay := true;
    ELSE
      RETURN jsonb_build_object('ok',false,'code','CLAIM_NOT_PENDING','status',409);
    END IF;
  END IF;
  IF v_existing_verified THEN
    -- Existing verified members keep their role, age, dates, denies, metadata
    -- and legacy projections. Use the separate authority endpoint to edit them.
    v_role := v_old_role;
    v_replay := v_replay OR p_action='attach';
  ELSE
    IF p_action='attach' THEN
      v_role := coalesce(v_old_role,'member');
    ELSE
      v_role := CASE coalesce(p_payload->>'role',v_claim.claimed_role,'member')
        WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
        WHEN 'lease_resident' THEN 'lease_resident' WHEN 'member' THEN 'member'
        WHEN 'household' THEN 'member' WHEN 'family' THEN 'member' WHEN 'roommate' THEN 'member'
        WHEN 'caregiver' THEN 'restricted_member' WHEN 'restricted_member' THEN 'restricted_member'
        WHEN 'guest' THEN 'guest' WHEN 'service_provider' THEN 'service_provider' ELSE NULL END::public.home_role_base;
    END IF;
    IF v_role IS NULL OR v_role IN ('owner','admin','manager') THEN
      RETURN jsonb_build_object('ok',false,'code','RESIDENCY_ROLE_FORBIDDEN','status',403);
    END IF;
    v_actor_role := (v_actor->>'effective_role_base')::public.home_role_base;
    IF (v_actor_role<>'owner' AND (public.home_role_rank(v_role)>=public.home_role_rank(v_actor_role)
      OR (v_has_target AND public.home_role_rank(v_old_role)>=public.home_role_rank(v_actor_role))))
      OR (v_target.age_band='child' AND public.home_role_rank(v_role)>20)
      OR (v_target.age_band='teen' AND public.home_role_rank(v_role)>30) THEN
      RETURN jsonb_build_object('ok',false,'code','PROPOSED_ROLE_FORBIDDEN','status',403);
    END IF;
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_actor->'permissions')) INTO v_actor_permissions;
    -- Activation makes all existing grants effective, so compare the complete
    -- future permission set, not only a role-change delta. Denies are retained.
    v_permissions := public.home_member_policy_permissions(p_home_id,v_target_id,v_role,v_target.age_band);
    IF EXISTS (SELECT FROM unnest(v_permissions) permission WHERE NOT permission=ANY(v_actor_permissions)) THEN
      RETURN jsonb_build_object('ok',false,'code','PERMISSION_DELEGATION_FORBIDDEN','status',403);
    END IF;
    IF v_has_target THEN
      UPDATE public."HomeOccupancy" SET role=v_role::text,role_base=v_role,
        verification_status='verified',verified_at=v_now,
        verification_expires_at=v_now+make_interval(days=>p_validity_days),updated_at=v_now
        WHERE id=v_target.id RETURNING * INTO v_target;
    ELSE
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,
        start_at,added_by_user_id,verification_status,verified_at,verification_expires_at,
        can_manage_home,can_manage_access,can_manage_finance,can_manage_tasks,can_view_sensitive)
      VALUES(p_home_id,v_target_id,v_role::text,v_role,NULL,true,now(),p_actor_id,'verified',v_now,
        v_now+make_interval(days=>p_validity_days),false,false,false,false,false)
      RETURNING * INTO v_target;
    END IF;
    -- The permission resolver uses transaction time for reads. Project flags
    -- with the decision clock so a schedule reached during a lock wait does
    -- not leave stale flags; future access still projects no capability.
    v_access := jsonb_build_object('permissions',CASE
      WHEN (v_target.start_at IS NULL OR v_target.start_at<=v_now)
        AND (v_target.access_start_at IS NULL OR v_target.access_start_at<=v_now)
      THEN to_jsonb(v_permissions) ELSE '[]'::jsonb END);
    UPDATE public."HomeOccupancy" SET
      can_manage_home=(v_access->'permissions') ? 'home.edit',
      can_manage_access=(v_access->'permissions') ?| ARRAY['access.manage','members.manage'],
      can_manage_finance=(v_access->'permissions') ? 'finance.manage',
      can_manage_tasks=(v_access->'permissions') ?| ARRAY['tasks.edit','tasks.manage'],
      can_view_sensitive=(v_access->'permissions') ? 'sensitive.view'
      WHERE id=v_target.id RETURNING * INTO v_target;
    UPDATE public."Home" SET vacancy_at=NULL,updated_at=v_now WHERE id=p_home_id AND vacancy_at IS NOT NULL;
  END IF;
  IF p_action='approve' AND NOT v_replay THEN
    UPDATE public."HomeResidencyClaim" SET status='verified',reviewed_by=p_actor_id,
      reviewed_at=v_now,updated_at=v_now WHERE id=v_claim_id;
  END IF;
  IF NOT v_replay THEN
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(p_home_id,p_actor_id,CASE WHEN p_action='approve' THEN 'residency_claim_approved' ELSE 'member_attached' END,
        'HomeOccupancy',v_target.id,jsonb_build_object('user_id',v_target_id,'claim_id',v_claim_id,
          'role_base',v_role,'existing_verified',v_existing_verified));
  END IF;
  RETURN jsonb_build_object('ok',true,'code','MEMBERSHIP_CONFIRMED','replayed',v_replay,
    'occupancy',to_jsonb(v_target),'target_id',v_target_id,
    'user',jsonb_build_object('id',v_target_id,'username',v_user.username,'name',v_user.name),
    'home_label',coalesce(v_home.name,v_home.address,'your home'));
END;
$$;
