-- Backwards compatible: yes. Additive service-only residency submission commands.
-- No existing claim, membership, permission, date or migration ledger is rewritten.
-- Claim submission records the next verification step; it does not assert postal
-- delivery, verified residency or ownership. Provider delivery remains a separate command.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."HomeResidencySubmissionCommand" (
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  home_id uuid NOT NULL,
  intent_hash text CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK(state IN ('pending','completed','rejected','cancelled')),
  claim_id uuid,
  occupancy_id uuid,
  claimed_role text CHECK(claimed_role IN ('renter','household')),
  routing text CHECK(routing IN ('household_review','self_bootstrap','external_postcard','stale_authority_postcard')),
  error_code text,
  error_status integer,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id),
  CHECK(intent_hash IS NOT NULL OR state='cancelled'),
  CHECK((state='completed')=(claim_id IS NOT NULL AND occupancy_id IS NOT NULL AND claimed_role IS NOT NULL AND routing IS NOT NULL)),
  CHECK((state='rejected')=(error_code IS NOT NULL AND error_status IS NOT NULL)),
  CHECK((error_code IS NULL)=(error_status IS NULL)),
  CHECK(error_status IS NULL OR error_status IN (400,403,404,409,422)),
  CHECK(error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{1,79}$')
);
-- Like HomeCreateCommand, historical identity survives deletion without retaining
-- addresses, request bodies, occupant details or postal secrets. It grants no access.
ALTER TABLE public."HomeResidencySubmissionCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomeResidencySubmissionCommand" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomeResidencySubmissionCommand" TO service_role;

CREATE FUNCTION public.home_residency_submission_projection(c public."HomeResidencySubmissionCommand")
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('ok',true,'state',c.state,'home_id',c.home_id,
    'command',jsonb_build_object('actor_id',c.actor_user_id,'request_id',c.request_id,
      'created_at',c.created_at,'updated_at',c.updated_at),
    'claim_id',c.claim_id,'occupancy_id',c.occupancy_id,'claimed_role',c.claimed_role,
    'routing',c.routing,'code',c.error_code,'status',c.error_status);
$$;

CREATE FUNCTION public.get_home_residency_submission(p_home_id uuid,p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeResidencySubmissionCommand"%ROWTYPE;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"RESIDENCY_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeResidencySubmissionCommand"
    WHERE actor_user_id=p_actor_id AND request_id=p_request_id AND home_id=p_home_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_NOT_FOUND","status":404}'::jsonb; END IF;
  RETURN public.home_residency_submission_projection(c);
END $$;

CREATE FUNCTION public.cancel_home_residency_submission(p_home_id uuid,p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeResidencySubmissionCommand"%ROWTYPE;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_INVALID","status":400}'::jsonb; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-residency-submit:'||p_actor_id::text,0));
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"RESIDENCY_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeResidencySubmissionCommand"
    WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND AND c.home_id<>p_home_id THEN
    RETURN '{"ok":false,"code":"RESIDENCY_SUBMISSION_CONFLICT","status":409}'::jsonb; END IF;
  IF NOT FOUND THEN
    INSERT INTO public."HomeResidencySubmissionCommand"(actor_user_id,request_id,home_id,state)
      VALUES(p_actor_id,p_request_id,p_home_id,'cancelled') RETURNING * INTO c;
  END IF;
  -- Submission is a single transaction; no externally visible pending worker
  -- can commit after this cancellation tombstone. A committed result wins.
  RETURN public.home_residency_submission_projection(c);
END $$;

CREATE FUNCTION public.submit_home_residency(p_home_id uuid,p_actor_id uuid,p_request_id uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE
  c public."HomeResidencySubmissionCommand"%ROWTYPE; h public."Home"%ROWTYPE;
  r public."HomeResidencyClaim"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE; u public."User"%ROWTYPE;
  v_hash text; v_role text; v_route text; v_age public.home_age_band; v_now timestamptz;
  v_error text; v_status integer; v_candidates uuid[]; v_authorities uuid[];
  v_existing boolean; v_claimed text;
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
  SELECT * INTO u FROM public."User" WHERE id=p_actor_id FOR SHARE;
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
    IF p_intent->'address' IS DISTINCT FROM jsonb_build_object('line1',h.address,'line2',coalesce(h.address2,''),
      'city',h.city,'state',h.state,'postal_code',h.zipcode,'country',coalesce(h.country,'US')) THEN
      v_error:='RESIDENCY_ADDRESS_CHANGED'; v_status:=409; EXIT validate_admission; END IF;
    SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
    v_existing:=FOUND;
    SELECT * INTO r FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_actor_id;
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
    v_claimed:=CASE r.claimed_role WHEN 'renter' THEN 'renter' WHEN 'tenant' THEN 'renter'
      WHEN 'lease_resident' THEN 'renter' WHEN 'member' THEN 'household' WHEN 'household' THEN 'household'
      WHEN 'family' THEN 'household' WHEN 'roommate' THEN 'household' ELSE NULL END;
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
    UPDATE public."HomeResidencySubmissionCommand" SET state='rejected',error_code=v_error,error_status=v_status,
      updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
    RETURN public.home_residency_submission_projection(c);
  END IF;

  -- Required writes, audit and receipt share one transaction. Any constraint,
  -- trigger or result-write failure rolls back every one of them.
  IF r.id IS NULL THEN
    INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_address,claimed_role,status,cold_start_mode)
      VALUES(p_home_id,p_actor_id,concat_ws(', ',h.address,nullif(h.address2,'')),v_role,'pending',
        CASE WHEN v_route='household_review' THEN NULL ELSE v_route END) RETURNING * INTO r;
  ELSIF r.status='rejected' THEN
    -- A fresh application cannot revive a code from before the rejected review.
    -- Retain the evidence/dispatch receipt; only retire its admission capability.
    UPDATE public."HomePostcardCode" SET status='cancelled',updated_at=clock_timestamp()
      WHERE home_id=p_home_id AND user_id=p_actor_id AND status='pending';
    UPDATE public."HomeResidencyClaim" SET status='pending',claimed_role=v_role,
      claimed_address=concat_ws(', ',h.address,nullif(h.address2,'')),reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,
      cold_start_mode=CASE WHEN v_route='household_review' THEN NULL ELSE v_route END,
      postcard_auto_routed=false,postcard_code_id=NULL,updated_at=clock_timestamp()
      WHERE id=r.id RETURNING * INTO r;
  ELSIF NOT v_existing THEN
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
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'residency_submission_saved','HomeResidencyClaim',r.id,
      jsonb_build_object('request_id',p_request_id,'claimed_role',v_role,'routing',v_route,'occupancy_id',o.id));
  UPDATE public."HomeResidencySubmissionCommand" SET state='completed',claim_id=r.id,occupancy_id=o.id,
    claimed_role=v_role,routing=v_route,updated_at=clock_timestamp()
    WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  RETURN public.home_residency_submission_projection(c)||'{"replayed":false}'::jsonb;
END $$;

REVOKE ALL ON FUNCTION public.home_residency_submission_projection(public."HomeResidencySubmissionCommand") FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_home_residency_submission(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cancel_home_residency_submission(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_home_residency(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_residency_submission_projection(public."HomeResidencySubmissionCommand") TO service_role;
GRANT EXECUTE ON FUNCTION public.get_home_residency_submission(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_home_residency_submission(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_home_residency(uuid,uuid,uuid,jsonb) TO service_role;
