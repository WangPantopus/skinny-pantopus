-- Recoverable Home onboarding. Reserve original intent before provider work;
-- fence delayed workers and retain outcome identities after Home deletion.
-- Backwards compatible: yes. Additive service-only commands do not rewrite
-- existing Homes, duplicate addresses, grants or historical migration ledgers.
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."HomeCreateCommand" (
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  intent_hash text CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK(state IN ('pending','completed','rejected','cancelled')),
  lease_id uuid,
  lease_expires_at timestamptz,
  home_id uuid,
  ownership_claim_id uuid,
  creator_role text CHECK(creator_role IN ('owner','renter','household','property_manager')),
  access_secret_ids uuid[] NOT NULL DEFAULT '{}',
  error_code text,
  error_status integer,
  conflict_home_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id),
  CHECK((state='completed')=(home_id IS NOT NULL)),
  CHECK((state='completed')=(creator_role IS NOT NULL)),
  CHECK((lease_id IS NULL)=(lease_expires_at IS NULL)),
  CHECK(lease_id IS NULL OR state='pending'),
  CHECK(intent_hash IS NOT NULL OR state='cancelled'),
  CHECK((error_code IS NULL)=(error_status IS NULL)),
  CHECK((state='rejected')=(error_code IS NOT NULL AND error_status IS NOT NULL)),
  CHECK(conflict_home_id IS NULL OR (state='rejected' AND error_code='HOME_ALREADY_EXISTS')),
  CHECK(error_status IS NULL OR error_status IN (400,403,404,409,422)),
  CHECK(error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{1,79}$')
);
-- Deliberately no Home/claim/access-record FK: deletion must not erase the
-- original outcome or turn a retry into another creation. No request body,
-- address, access code or provider result is retained in this table.
ALTER TABLE public."HomeCreateCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."HomeCreateCommand" FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public."HomeCreateCommand" TO service_role;

CREATE FUNCTION public.home_create_command_projection(c public."HomeCreateCommand")
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('ok',true,'state',c.state,
    'command',jsonb_build_object('actor_id',c.actor_user_id,'request_id',c.request_id,
      'created_at',c.created_at,'updated_at',c.updated_at),
    'home_id',c.home_id,'ownership_claim_id',c.ownership_claim_id,
    'role',c.creator_role,
    'access_secret_ids',to_jsonb(c.access_secret_ids),
    'code',c.error_code,'status',c.error_status,'conflict_home_id',c.conflict_home_id);
$$;

CREATE FUNCTION public.begin_home_create_command(p_actor_id uuid,p_request_id uuid,p_intent jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeCreateCommand"%ROWTYPE; v_hash text; v_now timestamptz;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object' THEN
    RETURN '{"ok":false,"code":"HOME_CREATE_INVALID","status":400}'::jsonb; END IF;
  v_hash:=encode(sha256(convert_to(p_intent::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('home-create-actor:'||p_actor_id::text,0));
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_CREATE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeCreateCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    -- Cancellation may arrive before a delayed POST has reserved its intent.
    IF c.intent_hash IS NOT NULL AND c.intent_hash<>v_hash THEN
      RETURN '{"ok":false,"code":"HOME_CREATE_INTENT_CONFLICT","status":409}'::jsonb; END IF;
    IF c.state<>'pending' THEN RETURN public.home_create_command_projection(c); END IF;
    IF c.lease_expires_at>clock_timestamp() THEN
      RETURN public.home_create_command_projection(c)||'{"working":true}'::jsonb; END IF;
  ELSE
    INSERT INTO public."HomeCreateCommand"(actor_user_id,request_id,intent_hash,state)
      VALUES(p_actor_id,p_request_id,v_hash,'pending') RETURNING * INTO c;
  END IF;
  v_now:=clock_timestamp();
  UPDATE public."HomeCreateCommand" SET lease_id=gen_random_uuid(),
    lease_expires_at=v_now+interval '120 seconds',updated_at=v_now
    WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  -- The lease stays between backend and database. API clients only receive
  -- the safe command projection and can retry the same immutable intent.
  RETURN public.home_create_command_projection(c)||jsonb_build_object('worker_lease_id',c.lease_id);
END $$;

CREATE FUNCTION public.get_home_create_command(p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeCreateCommand"%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RETURN '{"ok":false,"code":"HOME_CREATE_INVALID","status":400}'::jsonb; END IF;
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_CREATE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeCreateCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_CREATE_COMMAND_NOT_FOUND","status":404}'::jsonb; END IF;
  RETURN public.home_create_command_projection(c);
END $$;

CREATE FUNCTION public.cancel_home_create_command(p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeCreateCommand"%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RETURN '{"ok":false,"code":"HOME_CREATE_INVALID","status":400}'::jsonb; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-create-actor:'||p_actor_id::text,0));
  PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_CREATE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeCreateCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public."HomeCreateCommand"(actor_user_id,request_id,state)
      VALUES(p_actor_id,p_request_id,'cancelled') RETURNING * INTO c;
  ELSIF c.state='pending' THEN
    UPDATE public."HomeCreateCommand" SET state='cancelled',lease_id=NULL,
      lease_expires_at=NULL,updated_at=clock_timestamp()
      WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  END IF;
  -- A committed outcome wins a race with Cancel; do not claim it was undone.
  RETURN public.home_create_command_projection(c);
END $$;

CREATE FUNCTION public.finish_home_create_attempt(p_actor_id uuid,p_request_id uuid,p_lease_id uuid,
  p_code text DEFAULT NULL,p_status integer DEFAULT NULL,p_conflict_home_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomeCreateCommand"%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL OR p_lease_id IS NULL
    OR ((p_code IS NULL)<>(p_status IS NULL))
    OR (p_code IS NOT NULL AND (p_code !~ '^[A-Z][A-Z0-9_]{1,79}$' OR p_status NOT IN (400,403,404,409,422)))
    OR (p_conflict_home_id IS NOT NULL AND p_code IS DISTINCT FROM 'HOME_ALREADY_EXISTS') THEN
    RETURN '{"ok":false,"code":"HOME_CREATE_INVALID","status":400}'::jsonb; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-create-actor:'||p_actor_id::text,0));
  SELECT * INTO c FROM public."HomeCreateCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_CREATE_COMMAND_NOT_FOUND","status":404}'::jsonb; END IF;
  IF c.state<>'pending' OR c.lease_id IS DISTINCT FROM p_lease_id OR c.lease_expires_at<=clock_timestamp() THEN
    RETURN public.home_create_command_projection(c)||'{"worker_retired":true}'::jsonb; END IF;
  UPDATE public."HomeCreateCommand" SET state=CASE WHEN p_code IS NULL THEN 'pending' ELSE 'rejected' END,
    lease_id=NULL,lease_expires_at=NULL,error_code=p_code,error_status=p_status,
    conflict_home_id=p_conflict_home_id,updated_at=clock_timestamp()
    WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  -- A transient provider/database failure releases work for an exact retry.
  -- Only an authoritative rejection permits editing into a new command.
  RETURN public.home_create_command_projection(c);
END $$;

REVOKE ALL ON FUNCTION public.home_create_command_projection(public."HomeCreateCommand"),
  public.begin_home_create_command(uuid,uuid,jsonb),public.get_home_create_command(uuid,uuid),
  public.cancel_home_create_command(uuid,uuid),public.finish_home_create_attempt(uuid,uuid,uuid,text,integer,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_create_command_projection(public."HomeCreateCommand"),
  public.begin_home_create_command(uuid,uuid,jsonb),public.get_home_create_command(uuid,uuid),
  public.cancel_home_create_command(uuid,uuid),public.finish_home_create_attempt(uuid,uuid,uuid,text,integer,uuid)
  TO service_role;

-- The only application Home insert is POST /homes. It delegates the complete
-- setup here; provider work happens outside this short transaction. Historical
-- duplicate Homes remain untouched and are treated as an admission conflict.
CREATE FUNCTION public.commit_home_create_command(p_actor_id uuid,p_request_id uuid,p_lease_id uuid,
  p_intent jsonb,p_home jsonb,p_canonical_address jsonb,p_templates jsonb,p_step_up jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE
  c public."HomeCreateCommand"%ROWTYPE; h public."Home"%ROWTYPE;
  a public."HomeAddress"%ROWTYPE; expected_address public."HomeAddress"%ROWTYPE;
  u public."User"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  v_age public.home_age_band; v_role text; v_base text; v_status text; v_template jsonb;
  v_conflict uuid; v_parent uuid; v_claim uuid; v_secret jsonb; v_secret_result jsonb;
  v_secrets uuid[]:=ARRAY[]::uuid[]; v_code text; v_error_status text; v_now timestamptz;
  v_risk integer:=5; v_count integer; v_rejections integer; v_step public."AddressVerificationAttempt"%ROWTYPE;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL OR p_lease_id IS NULL
    OR jsonb_typeof(p_intent) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_home) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_canonical_address) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_templates) IS DISTINCT FROM 'object' THEN
    RETURN '{"ok":false,"code":"HOME_CREATE_INVALID","status":400}'::jsonb; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-create-actor:'||p_actor_id::text,0));
  SELECT * INTO u FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_CREATE_ACCOUNT_UNAVAILABLE","status":403}'::jsonb; END IF;
  SELECT * INTO c FROM public."HomeCreateCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"HOME_CREATE_COMMAND_NOT_FOUND","status":404}'::jsonb; END IF;
  IF c.intent_hash IS NOT NULL AND c.intent_hash<>encode(sha256(convert_to(p_intent::text,'UTF8')),'hex') THEN
    RETURN '{"ok":false,"code":"HOME_CREATE_INTENT_CONFLICT","status":409}'::jsonb; END IF;
  IF c.state<>'pending' OR c.lease_id IS DISTINCT FROM p_lease_id OR c.lease_expires_at<=clock_timestamp() THEN
    RETURN public.home_create_command_projection(c)||'{"worker_retired":true}'::jsonb; END IF;

  -- Casting a prepared row is only for type validation. The INSERT below lists
  -- every writable column and preserves all other database defaults.
  h:=jsonb_populate_record(NULL::public."Home",p_home);
  expected_address:=jsonb_populate_record(NULL::public."HomeAddress",p_canonical_address);
  IF h.address_id IS NULL OR h.address_hash IS NULL OR h.address_hash !~ '^[a-f0-9]{64}$'
    OR expected_address.id IS DISTINCT FROM h.address_id THEN
    RAISE EXCEPTION 'Invalid prepared Home address' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-create-address:'||h.address_hash,0));
  SELECT * INTO a FROM public."HomeAddress" WHERE id=h.address_id FOR SHARE;
  IF NOT FOUND OR a IS DISTINCT FROM expected_address THEN
    -- The provider/canonical decision changed while this worker was running.
    -- Keep the original command retryable, with no Home or authority writes.
    RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id)
      ||'{"retryable":true,"code":"HOME_CREATE_ADDRESS_CHANGED"}'::jsonb; END IF;
  IF h.address_hash IS DISTINCT FROM a.address_hash OR h.address IS DISTINCT FROM a.address_line1_norm
    OR coalesce(h.address2,'')<>coalesce(a.address_line2_norm,'') OR h.city IS DISTINCT FROM a.city_norm
    OR h.state IS DISTINCT FROM a.state OR h.zipcode IS DISTINCT FROM a.postal_code THEN
    RAISE EXCEPTION 'Invalid prepared Home identity' USING ERRCODE='22023'; END IF;
  SELECT id INTO v_conflict FROM public."Home" WHERE home_status='active' AND (
    address_hash=h.address_hash OR address_id=h.address_id OR (
      lower(btrim(address))=lower(btrim(h.address)) AND lower(btrim(coalesce(address2,'')))=lower(btrim(coalesce(h.address2,'')))
      AND lower(btrim(city))=lower(btrim(h.city)) AND lower(btrim(state))=lower(btrim(h.state))
      AND btrim(zipcode)=btrim(h.zipcode) AND lower(coalesce(country,'US'))=lower(coalesce(h.country,'US'))))
    ORDER BY created_at,id LIMIT 1;
  IF FOUND THEN RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,
    'HOME_ALREADY_EXISTS',409,v_conflict); END IF;
  IF p_step_up IS NOT NULL THEN
    SELECT * INTO v_step FROM public."AddressVerificationAttempt" WHERE id=(p_step_up->>'id')::uuid FOR SHARE;
    IF NOT FOUND OR v_step.user_id<>p_actor_id OR v_step.address_id<>h.address_id
      OR v_step.method<>'mail_code' OR v_step.status<>'verified'
      OR (p_step_up->>'max_age_days')::integer NOT BETWEEN 1 AND 3650
      OR coalesce(v_step.updated_at,v_step.created_at)<clock_timestamp()-((p_step_up->>'max_age_days')::integer)*interval '1 day' THEN
      RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,'ADDRESS_STEP_UP_REQUIRED',422); END IF;
  END IF;
  v_role:=coalesce(p_intent->>'role',CASE WHEN p_intent->>'is_owner'='true' THEN 'owner' ELSE 'household' END);
  IF v_role NOT IN ('owner','renter','household','property_manager')
    OR (p_intent ? 'is_owner' AND (p_intent->>'is_owner')::boolean IS DISTINCT FROM (v_role='owner')) THEN
    RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,'HOME_CREATE_ROLE_INVALID',400); END IF;
  -- Account DOB, when present, must not disappear from a newly created
  -- occupancy. Null retains the existing historical age compatibility policy.
  v_age:=CASE WHEN u.date_of_birth>current_date-interval '13 years' THEN 'child'::public.home_age_band
    WHEN u.date_of_birth>current_date-interval '18 years' THEN 'teen'::public.home_age_band
    WHEN u.date_of_birth IS NOT NULL THEN 'adult'::public.home_age_band END;
  v_status:=CASE WHEN v_role='owner' THEN 'pending_doc' ELSE 'provisional_bootstrap' END;
  v_base:=CASE v_role WHEN 'owner' THEN 'restricted_member' WHEN 'renter' THEN 'lease_resident'
    WHEN 'property_manager' THEN 'manager' ELSE 'member' END;
  v_template:=p_templates->coalesce(v_age::text,'adult');
  -- Templates come from applyOccupancyTemplate(dryRun); enforce the maximum
  -- permitted self-asserted capabilities independently at the commit boundary.
  IF v_template->>'role_base' IS DISTINCT FROM v_base OR v_template->>'verification_status' IS DISTINCT FROM v_status
    OR (v_template->>'is_active')::boolean IS DISTINCT FROM true
    OR (v_template->>'can_manage_home')::boolean IS DISTINCT FROM false
    OR (v_template->>'can_manage_access')::boolean IS DISTINCT FROM false
    OR (v_template->>'can_manage_finance')::boolean IS DISTINCT FROM false
    OR (v_template->>'can_view_sensitive')::boolean IS DISTINCT FROM false
    OR (v_template->>'can_manage_tasks')::boolean IS DISTINCT FROM (v_role<>'owner' AND v_age IS DISTINCT FROM 'child') THEN
    RAISE EXCEPTION 'Invalid Home creation occupancy template' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(coalesce(p_intent->'access_secrets','[]'))<>'array'
    OR jsonb_array_length(coalesce(p_intent->'access_secrets','[]'))>20 THEN
    RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,'HOME_SECRET_INVALID',400); END IF;
  -- Recheck after any lock waits; a retired worker cannot create resources.
  v_now:=clock_timestamp();
  IF c.lease_expires_at<=v_now THEN RETURN public.home_create_command_projection(c)||'{"worker_retired":true}'::jsonb; END IF;
  BEGIN
    IF nullif(btrim(h.address2),'') IS NOT NULL THEN
      SELECT id INTO v_parent FROM public."Home" WHERE home_status='active' AND nullif(btrim(address2),'') IS NULL
        AND lower(btrim(address))=lower(btrim(h.address)) AND lower(btrim(city))=lower(btrim(h.city))
        AND lower(btrim(state))=lower(btrim(h.state)) AND zipcode=h.zipcode
        AND lower(coalesce(country,'US'))=lower(coalesce(h.country,'US')) ORDER BY created_at,id LIMIT 1;
    END IF;
    INSERT INTO public."Home"(address,address2,city,state,zipcode,country,address_hash,address_id,owner_id,
      name,home_type,bedrooms,bathrooms,sq_ft,lot_sq_ft,year_built,move_in_date,is_owner,description,
      entry_instructions,parking_instructions,visibility,amenities,niche_data,created_by_user_id,tenure_mode,
      ownership_state,household_resolution_state,household_resolution_updated_at,parent_home_id,
      location,map_center_lat,map_center_lng,geocode_provider,geocode_mode,geocode_accuracy,
      geocode_place_id,geocode_source_flow,geocode_created_at)
    VALUES(h.address,h.address2,h.city,h.state,h.zipcode,coalesce(h.country,'US'),h.address_hash,h.address_id,NULL,
      h.name,coalesce(h.home_type,'house'),h.bedrooms,h.bathrooms,h.sq_ft,h.lot_sq_ft,h.year_built,h.move_in_date,v_role='owner',
      h.description,h.entry_instructions,h.parking_instructions,coalesce(h.visibility,'private'),coalesce(h.amenities,'{}'),
      coalesce(h.niche_data,'{}'),p_actor_id,(CASE WHEN v_role='owner' THEN 'owner_occupied' WHEN v_role='renter' THEN 'rental' ELSE 'unknown' END)::public.home_tenure_mode,
      (CASE WHEN v_role='owner' THEN 'claim_pending' ELSE 'unclaimed' END)::public.home_ownership_state,
      (CASE WHEN v_role='owner' THEN 'pending_single_claim' ELSE 'unclaimed' END)::public.household_resolution_state,v_now,v_parent,
      h.location,h.map_center_lat,h.map_center_lng,h.geocode_provider,h.geocode_mode,h.geocode_accuracy,
      h.geocode_place_id,h.geocode_source_flow,v_now) RETURNING * INTO h;
    INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,added_by_user_id,is_active,verification_status,
      can_manage_home,can_manage_access,can_manage_finance,can_view_sensitive,can_manage_tasks)
      VALUES(h.id,p_actor_id,v_base,v_base::public.home_role_base,v_age,p_actor_id,true,v_status,
        false,false,false,false,(v_template->>'can_manage_tasks')::boolean) RETURNING * INTO o;
    INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
      VALUES(h.id,p_actor_id,'OCCUPANCY_TEMPLATE_APPLIED','HomeOccupancy',o.id,
        jsonb_build_object('role_base',v_base,'verification_status',v_status,'age_band',v_age,
          'booleans',v_template-ARRAY['role_base','is_active','verification_status']));
    IF v_role='owner' THEN
      INSERT INTO public."HomeOwner"(home_id,subject_type,subject_id,owner_status,is_primary_owner,added_via,verification_tier)
        VALUES(h.id,'user',p_actor_id,'pending',true,'claim','weak');
      v_risk:=v_risk+CASE WHEN u.created_at>v_now-interval '1 day' THEN 40 WHEN u.created_at>v_now-interval '7 days' THEN 25
        WHEN u.created_at>v_now-interval '30 days' THEN 10 ELSE 0 END;
      SELECT count(*) FILTER(WHERE created_at>=v_now-interval '30 days'),count(*) FILTER(WHERE state='rejected')
        INTO v_count,v_rejections FROM public."HomeOwnershipClaim" WHERE claimant_user_id=p_actor_id;
      v_risk:=least(100,v_risk+CASE WHEN v_count>3 THEN 30 WHEN v_count>1 THEN 15 ELSE 0 END
        +CASE WHEN v_rejections>2 THEN 25 WHEN v_rejections>0 THEN 10 ELSE 0 END);
      INSERT INTO public."HomeOwnershipClaim"(home_id,claimant_user_id,claim_type,state,method,risk_score,
        claim_phase_v2,routing_classification,identity_status,terminal_reason,challenge_state)
        VALUES(h.id,p_actor_id,'owner','submitted','doc_upload',v_risk,'evidence_submitted','standalone_claim','not_started','none','none')
        RETURNING id INTO v_claim;
      INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
        VALUES(h.id,p_actor_id,'OWNERSHIP_CLAIM_SUBMITTED','HomeOwnershipClaim',v_claim,
          jsonb_build_object('method','doc_upload','claim_type','owner','risk_score',v_risk,'context','home_creation'));
    END IF;
    INSERT INTO public."HomePreference"(home_id) VALUES(h.id);
    IF nullif(p_intent->>'wifi_name','') IS NOT NULL OR nullif(p_intent->>'wifi_password','') IS NOT NULL THEN
      v_secret_result:=public.mutate_home_access_secret(h.id,p_actor_id,NULL,'bootstrap_wifi',jsonb_build_object(
        'access_type','wifi','label',coalesce(nullif(p_intent->>'wifi_name',''),'Home WiFi'),
        'secret_value',coalesce(p_intent->>'wifi_password',''),'visibility','members'));
      IF v_secret_result->>'ok' IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Home setup rejected' USING ERRCODE='PCH01',DETAIL=v_secret_result->>'code',HINT=v_secret_result->>'status'; END IF;
      v_secrets:=array_append(v_secrets,(v_secret_result->'secret'->>'id')::uuid);
    END IF;
    FOR v_secret IN SELECT value FROM jsonb_array_elements(coalesce(p_intent->'access_secrets','[]')) LOOP
      v_secret_result:=public.mutate_home_access_secret(h.id,p_actor_id,NULL,'create',v_secret);
      IF v_secret_result->>'ok' IS DISTINCT FROM 'true' THEN
        RAISE EXCEPTION 'Home setup rejected' USING ERRCODE='PCH01',DETAIL=v_secret_result->>'code',HINT=v_secret_result->>'status'; END IF;
      v_secrets:=array_append(v_secrets,(v_secret_result->'secret'->>'id')::uuid);
    END LOOP;
    UPDATE public."HomeCreateCommand" SET state='completed',home_id=h.id,ownership_claim_id=v_claim,creator_role=v_role,
      access_secret_ids=v_secrets,lease_id=NULL,lease_expires_at=NULL,updated_at=clock_timestamp()
      WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  EXCEPTION WHEN SQLSTATE 'PCH01' THEN
    -- The subtransaction rolls back every Home/setup row before recording the
    -- authoritative rejection. Unexpected SQL failures roll back the whole RPC.
    GET STACKED DIAGNOSTICS v_code=PG_EXCEPTION_DETAIL,v_error_status=PG_EXCEPTION_HINT;
    RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,v_code,v_error_status::integer);
  END;
  RETURN public.home_create_command_projection(c)||'{"committed_now":true}'::jsonb;
END $$;

REVOKE ALL ON FUNCTION public.commit_home_create_command(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_home_create_command(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb) TO service_role;
