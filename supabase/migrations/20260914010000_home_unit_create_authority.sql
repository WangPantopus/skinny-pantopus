-- Backwards compatible: yes. Existing individual Home commands are unchanged.
-- Forward-only update of the existing Home-create function for the building's
-- unit tools. No table or relationship is created. Original migration bytes stay
-- immutable so databases with prior history receive the same final function.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.commit_home_create_command(p_actor_id uuid,p_request_id uuid,p_lease_id uuid,
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
  v_bulk_parent public."Home"%ROWTYPE; v_bulk_allowed boolean;
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
  IF p_intent ? 'bulk_parent_home_id' THEN
    -- Unit labels are not ownership evidence. Recheck the selected building's
    -- current authority before its private unit setup, under the existing locks.
    IF jsonb_typeof(p_intent->'bulk_parent_home_id') IS DISTINCT FROM 'string'
      OR (p_intent->>'bulk_parent_home_id') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      OR p_intent->>'role' IS DISTINCT FROM 'property_manager' OR h.home_type IS DISTINCT FROM 'apartment'
      OR nullif(btrim(h.address2),'') IS NULL THEN
      RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,'HOME_CREATE_PARENT_UNAVAILABLE',403); END IF;
    IF NOT public.lock_home_invitation_scope((p_intent->>'bulk_parent_home_id')::uuid) THEN
      RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,'HOME_CREATE_PARENT_UNAVAILABLE',403); END IF;
    SELECT * INTO v_bulk_parent FROM public."Home" WHERE id=(p_intent->>'bulk_parent_home_id')::uuid;
    IF v_bulk_parent.home_status IS DISTINCT FROM 'active' OR v_bulk_parent.security_state IS DISTINCT FROM 'normal'
      OR v_bulk_parent.home_type IS DISTINCT FROM 'multi_unit' OR nullif(btrim(v_bulk_parent.address2),'') IS NOT NULL
      OR v_bulk_parent.address_id IS NULL OR lower(btrim(v_bulk_parent.address)) IS DISTINCT FROM lower(btrim(h.address))
      OR lower(btrim(v_bulk_parent.city)) IS DISTINCT FROM lower(btrim(h.city)) OR lower(btrim(v_bulk_parent.state)) IS DISTINCT FROM lower(btrim(h.state))
      OR v_bulk_parent.zipcode IS DISTINCT FROM h.zipcode OR lower(coalesce(v_bulk_parent.country,'US'))<>lower(coalesce(h.country,'US')) THEN
      RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,'HOME_CREATE_PARENT_UNAVAILABLE',403); END IF;
    PERFORM id FROM public."HomeAuthority" WHERE home_id=v_bulk_parent.id ORDER BY id FOR UPDATE;
    v_bulk_allowed:=EXISTS(SELECT FROM public."HomeAuthority" WHERE home_id=v_bulk_parent.id AND status='verified'
      AND subject_type='user' AND subject_id=p_actor_id);
    IF NOT v_bulk_allowed THEN
      PERFORM s.id FROM public."BusinessSeat" s JOIN public."SeatBinding" b ON b.seat_id=s.id
        WHERE b.user_id=p_actor_id AND s.is_active AND EXISTS(SELECT FROM public."HomeAuthority" au
          WHERE au.home_id=v_bulk_parent.id AND au.status='verified' AND au.subject_type='business' AND au.subject_id=s.business_user_id)
        ORDER BY s.id FOR UPDATE OF s,b;
      v_bulk_allowed:=FOUND;
      IF NOT v_bulk_allowed THEN
        PERFORM id FROM public."BusinessTeam" t WHERE t.user_id=p_actor_id AND t.is_active
          AND EXISTS(SELECT FROM public."HomeAuthority" au WHERE au.home_id=v_bulk_parent.id AND au.status='verified'
            AND au.subject_type='business' AND au.subject_id=t.business_user_id) ORDER BY id FOR UPDATE;
        v_bulk_allowed:=FOUND;
      END IF;
    END IF;
    IF NOT v_bulk_allowed THEN
      RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,'HOME_CREATE_PARENT_UNAVAILABLE',403); END IF;
  END IF;
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
    IF v_bulk_parent.id IS NOT NULL AND v_parent IS DISTINCT FROM v_bulk_parent.id THEN
      RETURN public.finish_home_create_attempt(p_actor_id,p_request_id,p_lease_id,'HOME_CREATE_PARENT_UNAVAILABLE',403); END IF;
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

COMMIT;
