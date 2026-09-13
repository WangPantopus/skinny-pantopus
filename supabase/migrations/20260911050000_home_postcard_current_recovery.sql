-- Backwards compatible: yes. Additive current postal-command helpers.
-- Historical proof, dispatch receipts, membership and dates are preserved.
-- Current clients must keep postal intent separate from delivery and access.
SET LOCAL lock_timeout='5s';

-- Postal commands and confirmation share the established Home review lock
-- scope. Actor serialization also keeps the per-user postal budget atomic.
CREATE FUNCTION public.lock_home_postcard_current_scope(p_home_id uuid,p_actor_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:user:'||p_actor_id::text,0));
  PERFORM id FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:home:'||p_home_id::text,0));
  IF NOT public.lock_home_residency_review_scope(p_home_id) THEN RETURN false; END IF;
  PERFORM id FROM public."HomePostcardCode" WHERE home_id=p_home_id ORDER BY id FOR UPDATE;
  RETURN true;
END;
$$;

-- Internal policy only. Call after locking the scope; this function does not
-- expose Home fields or confer current household access to its caller.
CREATE FUNCTION public.home_postcard_current_context(p_home_id uuid,p_actor_id uuid,p_confirmation boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  h public."Home"%ROWTYPE; o public."HomeOccupancy"%ROWTYPE;
  r public."HomeResidencyClaim"%ROWTYPE; u public."User"%ROWTYPE;
  t timestamptz:=clock_timestamp(); v_role text; v_age public.home_age_band;
  v_authorities boolean;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_confirmation IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  SELECT * INTO u FROM public."User" WHERE id=p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCOUNT_UNAVAILABLE','status',403); END IF;
  IF h.security_state IN ('frozen','frozen_silent','disputed') OR h.home_status IN ('archived','merged') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_HOME_UNAVAILABLE','status',403); END IF;
  SELECT * INTO o FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_RESIDENCY_REQUEST_REQUIRED','status',409); END IF;
  SELECT * INTO r FROM public."HomeResidencyClaim" WHERE home_id=p_home_id AND user_id=p_actor_id;
  v_role:=coalesce(o.role_base::text,CASE o.role
    WHEN 'tenant' THEN 'lease_resident' WHEN 'renter' THEN 'lease_resident'
    WHEN 'roommate' THEN 'member' WHEN 'family' THEN 'member' WHEN 'member' THEN 'member'
    WHEN 'caregiver' THEN 'restricted_member' ELSE o.role END);
  IF h.owner_id=p_actor_id OR v_role IN ('owner','admin','manager','property_manager')
    OR EXISTS(SELECT FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user' AND subject_id=p_actor_id) THEN
    RETURN jsonb_build_object('ok',false,'code','OWNERSHIP_FLOW_REQUIRED','status',409); END IF;
  IF v_role IS NULL OR v_role NOT IN ('member','lease_resident','restricted_member')
    OR o.is_active IS DISTINCT FROM true OR o.end_at IS NOT NULL
    OR o.start_at>t OR o.access_start_at>t OR o.access_end_at<=t
    OR o.verification_status IS NULL OR o.verification_status NOT IN
      ('verified','unverified','pending','pending_approval','pending_doc','pending_postcard','provisional_bootstrap','provisional')
    OR r.status='rejected' THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
  IF NOT p_confirmation AND (o.verification_status IN ('verified','provisional') OR r.status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REVIEW_ALREADY_RECORDED','status',409); END IF;
  IF o.verification_status NOT IN ('verified','provisional') AND
    (o.verified_at IS NOT NULL OR o.verification_expires_at IS NOT NULL OR r.status='verified') THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCESS_REVIEW_REQUIRED','status',409); END IF;
  -- Preserve a stricter saved band and tighten it for a currently known minor.
  -- Physical-address proof cannot loosen an existing age restriction.
  v_age:=o.age_band;
  IF u.date_of_birth>(t AT TIME ZONE 'UTC')::date-interval '13 years' THEN v_age:='child';
  ELSIF u.date_of_birth>(t AT TIME ZONE 'UTC')::date-interval '18 years' AND v_age IS DISTINCT FROM 'child' THEN v_age:='teen'; END IF;
  SELECT EXISTS(SELECT FROM (
    SELECT user_id AS candidate FROM public."HomeOccupancy" WHERE home_id=p_home_id
    UNION SELECT subject_id FROM public."HomeOwner" WHERE home_id=p_home_id AND subject_type='user'
    UNION SELECT h.owner_id
  ) candidates WHERE candidate IS NOT NULL AND candidate<>p_actor_id
    AND public.home_residency_review_authority(p_home_id,candidate)) INTO v_authorities;
  RETURN jsonb_build_object('ok',true,'age_band',v_age,'has_authorities',v_authorities,
    'already_verified',o.verification_status='verified','occupancy_id',o.id,'claim_id',r.id);
END;
$$;

REVOKE ALL ON FUNCTION public.lock_home_postcard_current_scope(uuid,uuid),
  public.home_postcard_current_context(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_home_postcard_current_scope(uuid,uuid),
  public.home_postcard_current_context(uuid,uuid,boolean) TO service_role;

CREATE TABLE public."HomePostcardRequestCommand" (
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  home_id uuid NOT NULL,
  intent_hash text CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK(state IN ('pending','completed','rejected','cancelled')),
  postcard_id uuid,
  code_key_id text,
  error_code text,
  error_status integer,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_user_id,request_id),
  CHECK(intent_hash IS NOT NULL OR state='cancelled'),
  CHECK((state='completed')=(postcard_id IS NOT NULL)),
  CHECK((state='rejected')=(error_code IS NOT NULL AND error_status IS NOT NULL)),
  CHECK((error_code IS NULL)=(error_status IS NULL)),
  CHECK(code_key_id IS NULL OR (state='completed' AND code_key_id ~ '^[a-zA-Z0-9_-]{1,40}$')),
  CHECK(error_status IS NULL OR error_status IN (400,403,404,409,422,429)),
  CHECK(error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{1,79}$')
);
-- Historical command identity survives deletion. It retains neither address
-- text nor codes and cannot authorize a new postal dispatch or Home access.
CREATE INDEX home_postcard_request_command_card_idx ON public."HomePostcardRequestCommand"(postcard_id) WHERE postcard_id IS NOT NULL;
ALTER TABLE public."HomePostcardRequestCommand" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."HomePostcardRequestCommand" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."HomePostcardRequestCommand" TO service_role;

CREATE FUNCTION public.home_postcard_request_projection(c public."HomePostcardRequestCommand")
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT jsonb_build_object('ok',true,'state',c.state,'home_id',c.home_id,
    'command',jsonb_build_object('actor_id',c.actor_user_id,'request_id',c.request_id,
      'created_at',c.created_at,'updated_at',c.updated_at),
    'postcard_id',c.postcard_id,'code',c.error_code,'status',c.error_status);
$$;

CREATE FUNCTION public.get_home_postcard_request(p_home_id uuid,p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomePostcardRequestCommand"%ROWTYPE;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  SELECT * INTO c FROM public."HomePostcardRequestCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_NOT_FOUND','status',404); END IF;
  IF c.home_id<>p_home_id THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_CONFLICT','status',409); END IF;
  RETURN public.home_postcard_request_projection(c);
END;
$$;

CREATE FUNCTION public.cancel_home_postcard_request(p_home_id uuid,p_actor_id uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomePostcardRequestCommand"%ROWTYPE;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:user:'||p_actor_id::text,0));
  PERFORM id FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCOUNT_UNAVAILABLE','status',403); END IF;
  SELECT * INTO c FROM public."HomePostcardRequestCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF c.home_id<>p_home_id THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_CONFLICT','status',409); END IF;
    -- A completed admission can already be in transport. Its retained outcome
    -- is not a promise that an in-flight postcard can be recalled.
    RETURN public.home_postcard_request_projection(c);
  END IF;
  INSERT INTO public."HomePostcardRequestCommand"(actor_user_id,request_id,home_id,state)
    VALUES(p_actor_id,p_request_id,p_home_id,'cancelled') RETURNING * INTO c;
  RETURN public.home_postcard_request_projection(c);
END;
$$;

REVOKE ALL ON FUNCTION public.home_postcard_request_projection(public."HomePostcardRequestCommand"),
  public.get_home_postcard_request(uuid,uuid,uuid),public.cancel_home_postcard_request(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_postcard_request_projection(public."HomePostcardRequestCommand"),
  public.get_home_postcard_request(uuid,uuid,uuid),public.cancel_home_postcard_request(uuid,uuid,uuid) TO service_role;

CREATE FUNCTION public.valid_home_postcard_address(p_address jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN jsonb_typeof(p_address)='object' THEN
    (SELECT count(*)=6 AND bool_and(k IN ('line1','line2','city','state','postal_code','country')
      AND jsonb_typeof(v)='string' AND length(v#>>'{}')<=CASE k WHEN 'line1' THEN 255 WHEN 'line2' THEN 255
        WHEN 'city' THEN 100 WHEN 'state' THEN 50 WHEN 'postal_code' THEN 20 ELSE 100 END
      AND (k='line2' OR length(trim(v#>>'{}'))>0)) FROM jsonb_each(p_address) fields(k,v))
    ELSE false END;
$$;

-- Private worker material. HTTP projections must omit the destination, hash and
-- key identifier. Merely reading this record never claims a dispatch.
CREATE FUNCTION public.home_postcard_request_work(c public."HomePostcardRequestCommand")
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.home_postcard_request_projection(c)||jsonb_build_object('code_key_id',c.code_key_id,
    'postcard',(SELECT to_jsonb(p) FROM public."HomePostcardCode" p
      WHERE p.id=c.postcard_id AND p.home_id=c.home_id AND p.user_id=c.actor_user_id));
$$;

CREATE FUNCTION public.begin_home_postcard_request(
  p_home_id uuid,p_actor_id uuid,p_request_id uuid,p_address jsonb,
  p_candidate_id uuid,p_code_hash text,p_code_key_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE
  c public."HomePostcardRequestCommand"%ROWTYPE; p public."HomePostcardCode"%ROWTYPE;
  h public."Home"%ROWTYPE; context jsonb; v_hash text; v_destination jsonb;
  v_code text; v_status integer; v_key text; t timestamptz;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL
    OR public.valid_home_postcard_address(p_address) IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  v_hash:=encode(sha256(convert_to(jsonb_build_object('home_id',p_home_id,'address',p_address)::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended('home-postcard:user:'||p_actor_id::text,0));
  PERFORM id FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_ACCOUNT_UNAVAILABLE','status',403); END IF;
  SELECT * INTO c FROM public."HomePostcardRequestCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF c.home_id<>p_home_id OR (c.intent_hash IS NOT NULL AND c.intent_hash<>v_hash) THEN
      RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_CONFLICT','status',409); END IF;
    RETURN public.home_postcard_request_work(c)||jsonb_build_object('replayed',true);
  END IF;
  IF p_candidate_id IS NULL OR p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$'
    OR p_code_key_id IS NULL OR p_code_key_id !~ '^[a-zA-Z0-9_-]{1,40}$' THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_CODE_KEY_UNAVAILABLE','status',503); END IF;
  INSERT INTO public."HomePostcardRequestCommand"(actor_user_id,request_id,home_id,intent_hash,state)
    VALUES(p_actor_id,p_request_id,p_home_id,v_hash,'pending') RETURNING * INTO c;
  <<validate_request>>
  BEGIN
    IF NOT public.lock_home_postcard_current_scope(p_home_id,p_actor_id) THEN
      v_code:='HOME_NOT_FOUND';v_status:=404;EXIT validate_request; END IF;
    t:=clock_timestamp();
    context:=public.home_postcard_current_context(p_home_id,p_actor_id,false);
    IF context->>'ok' IS DISTINCT FROM 'true' THEN
      v_code:=context->>'code';v_status:=(context->>'status')::integer;EXIT validate_request; END IF;
    SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
    IF p_address IS DISTINCT FROM jsonb_build_object('line1',h.address,'line2',coalesce(h.address2,''),
      'city',h.city,'state',h.state,'postal_code',h.zipcode,'country',coalesce(h.country,'US')) THEN
      v_code:='POSTCARD_ADDRESS_CHANGED';v_status:=409;EXIT validate_request; END IF;
    IF p_address->>'country'<>'US' THEN
      v_code:='POSTCARD_COUNTRY_UNAVAILABLE';v_status:=422;EXIT validate_request; END IF;
    v_destination:=jsonb_build_object('address',h.address,'address2',h.address2,'city',h.city,'state',h.state,'zipcode',h.zipcode);
    SELECT * INTO p FROM public."HomePostcardCode" WHERE home_id=p_home_id AND user_id=p_actor_id
      AND status='pending' AND expires_at>t;
    IF FOUND AND p.destination=v_destination AND p.attempts<5 AND p.dispatch_status IS DISTINCT FROM 'rejected' THEN
      -- A legacy pending proof has no recoverable key identifier. It remains
      -- an uncertain legacy request; a new command must not rotate or resend it.
      SELECT min(code_key_id) INTO v_key FROM public."HomePostcardRequestCommand"
        WHERE actor_user_id=p_actor_id AND home_id=p_home_id AND postcard_id=p.id;
    ELSE
      -- Enforce budgets before any retirement. A refused request changes no
      -- prior proof, destination or dispatch receipt.
      IF (SELECT count(*) FROM public."HomePostcardCode" WHERE home_id=p_home_id AND status='pending'
        AND expires_at>t AND user_id<>p_actor_id)>=2 THEN
        v_code:='POSTCARD_ADDRESS_LIMIT';v_status:=429;EXIT validate_request; END IF;
      IF (SELECT count(*) FROM public."HomePostcardCode" WHERE user_id=p_actor_id AND requested_at>t-interval '1 hour')>=3 THEN
        v_code:='POSTCARD_USER_LIMIT';v_status:=429;EXIT validate_request; END IF;
      UPDATE public."HomePostcardCode" SET status='expired',updated_at=t
        WHERE home_id=p_home_id AND status='pending' AND expires_at<=t;
      -- An explicitly reconfirmed new address retires an incompatible old code,
      -- while retaining the old mail's immutable destination and dispatch proof.
      UPDATE public."HomePostcardCode" SET status='cancelled',updated_at=t
        WHERE home_id=p_home_id AND user_id=p_actor_id AND status='pending';
      INSERT INTO public."HomePostcardCode"(id,home_id,user_id,code_hash,dispatch_status,destination,requested_at,expires_at,created_at,updated_at)
        VALUES(p_candidate_id,p_home_id,p_actor_id,p_code_hash,'pending',v_destination,t,t+interval '30 days',t,t)
        RETURNING * INTO p;
      v_key:=p_code_key_id;
    END IF;
  END validate_request;
  IF v_code IS NOT NULL THEN
    UPDATE public."HomePostcardRequestCommand" SET state='rejected',error_code=v_code,error_status=v_status,
      updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
    RETURN public.home_postcard_request_projection(c)||jsonb_build_object('replayed',false);
  END IF;
  INSERT INTO public."HomeAuditLog"(home_id,actor_user_id,action,target_type,target_id,metadata)
    VALUES(p_home_id,p_actor_id,'POSTCARD_REQUEST_SAVED','HomePostcardCode',p.id,jsonb_build_object('request_id',p_request_id));
  UPDATE public."HomePostcardRequestCommand" SET state='completed',postcard_id=p.id,code_key_id=v_key,
    updated_at=clock_timestamp() WHERE actor_user_id=p_actor_id AND request_id=p_request_id RETURNING * INTO c;
  RETURN public.home_postcard_request_work(c)||jsonb_build_object('replayed',false);
END;
$$;

REVOKE ALL ON FUNCTION public.valid_home_postcard_address(jsonb),
  public.home_postcard_request_work(public."HomePostcardRequestCommand"),
  public.begin_home_postcard_request(uuid,uuid,uuid,jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.valid_home_postcard_address(jsonb),
  public.home_postcard_request_work(public."HomePostcardRequestCommand"),
  public.begin_home_postcard_request(uuid,uuid,uuid,jsonb,uuid,text,text) TO service_role;

-- Return only a mailing address that this actor explicitly confirmed in a
-- completed command. A legacy destination or the Home's current private address
-- is never used as a substitute for that historical input.
CREATE FUNCTION public.home_postcard_confirmed_address(c public."HomePostcardRequestCommand")
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."HomePostcardCode"%ROWTYPE; a jsonb;
BEGIN
  IF c.state IS DISTINCT FROM 'completed' THEN RETURN NULL; END IF;
  SELECT * INTO p FROM public."HomePostcardCode" WHERE id=c.postcard_id AND home_id=c.home_id AND user_id=c.actor_user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  a:=jsonb_build_object('line1',p.destination->>'address','line2',coalesce(p.destination->>'address2',''),
    'city',p.destination->>'city','state',p.destination->>'state','postal_code',p.destination->>'zipcode','country','US');
  IF public.valid_home_postcard_address(a) IS DISTINCT FROM true OR c.intent_hash IS DISTINCT FROM
    encode(sha256(convert_to(jsonb_build_object('home_id',c.home_id,'address',a)::text,'UTF8')),'hex') THEN RETURN NULL; END IF;
  RETURN a;
END;
$$;

CREATE FUNCTION public.get_home_postcard_current_status(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."HomePostcardCode"%ROWTYPE; c public."HomePostcardRequestCommand"%ROWTYPE;
  h public."Home"%ROWTYPE; context jsonb; request_context jsonb; t timestamptz;
  a jsonb; v_matches boolean:=false; v_pending boolean:=false; v_delivery text;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  PERFORM public.lock_home_postcard_current_scope(p_home_id,p_actor_id);
  t:=clock_timestamp();
  SELECT * INTO p FROM public."HomePostcardCode" WHERE home_id=p_home_id AND user_id=p_actor_id ORDER BY requested_at DESC,id DESC LIMIT 1;
  IF p.id IS NULL AND NOT EXISTS(SELECT FROM public."HomeOccupancy" WHERE home_id=p_home_id AND user_id=p_actor_id) THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_RESIDENCY_REQUEST_REQUIRED','status',404); END IF;
  context:=public.home_postcard_current_context(p_home_id,p_actor_id,true);
  request_context:=public.home_postcard_current_context(p_home_id,p_actor_id,false);
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF p.id IS NOT NULL THEN
    SELECT * INTO c FROM public."HomePostcardRequestCommand" WHERE home_id=p_home_id AND actor_user_id=p_actor_id
      AND postcard_id=p.id AND state='completed' ORDER BY created_at,request_id LIMIT 1;
    a:=public.home_postcard_confirmed_address(c);
    v_matches:=h.id IS NOT NULL AND p.destination=jsonb_build_object('address',h.address,'address2',h.address2,
      'city',h.city,'state',h.state,'zipcode',h.zipcode) AND coalesce(h.country,'US')='US';
    v_pending:=p.status='pending' AND p.expires_at>t AND p.attempts<5 AND p.dispatch_status IS DISTINCT FROM 'rejected';
    v_delivery:=CASE WHEN p.dispatch_status='accepted' AND p.vendor_job_id IS NOT NULL THEN 'accepted'
      WHEN p.dispatch_status='rejected' THEN 'rejected'
      WHEN p.dispatch_status='pending' AND c.code_key_id IS NOT NULL THEN 'not_started'
      ELSE 'unknown' END;
  END IF;
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'actor_id',p_actor_id,'checked_at',t,
    'can_request',request_context->>'ok'='true' AND NOT (v_pending AND coalesce(v_matches,false)),
    'can_verify',coalesce(context->>'ok'='true' AND v_pending AND coalesce(v_matches,false) AND v_delivery IN ('accepted','unknown'),false),
    'can_resume',coalesce(request_context->>'ok'='true' AND v_pending AND coalesce(v_matches,false)
      AND v_delivery='not_started' AND a IS NOT NULL,false),
    'restriction',CASE WHEN context->>'ok'<>'true' THEN context->>'code'
      WHEN p.id IS NOT NULL AND NOT coalesce(v_matches,false) THEN 'POSTCARD_ADDRESS_CHANGED'
      WHEN p.status='pending' AND p.expires_at<=t THEN 'POSTCARD_EXPIRED'
      WHEN p.status='pending' AND p.attempts>=5 THEN 'POSTCARD_LOCKED'
      ELSE request_context->>'code' END,
    'request',CASE WHEN a IS NOT NULL THEN public.home_postcard_request_projection(c)||jsonb_build_object('address',a) ELSE NULL END,
    'postcard',CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('id',p.id,'requested_at',p.requested_at,'expires_at',p.expires_at,
      'status',CASE WHEN p.status='pending' AND p.expires_at<=t THEN 'expired' ELSE p.status END,
      'delivery',v_delivery,'attempts_remaining',greatest(0,5-p.attempts)) ELSE NULL END);
END;
$$;

-- Only this successful claim permits a provider call. A repeated or unknown
-- dispatch never regains that permission, including after a process restart.
CREATE FUNCTION public.claim_home_postcard_current_dispatch(
  p_home_id uuid,p_actor_id uuid,p_request_id uuid,p_postcard_id uuid,p_code_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE c public."HomePostcardRequestCommand"%ROWTYPE; p public."HomePostcardCode"%ROWTYPE;
  h public."Home"%ROWTYPE; context jsonb; a jsonb; t timestamptz;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL OR p_postcard_id IS NULL
    OR p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  IF NOT public.lock_home_postcard_current_scope(p_home_id,p_actor_id) THEN
    RETURN jsonb_build_object('ok',false,'code','HOME_NOT_FOUND','status',404); END IF;
  t:=clock_timestamp();
  SELECT * INTO c FROM public."HomePostcardRequestCommand" WHERE actor_user_id=p_actor_id AND request_id=p_request_id;
  IF NOT FOUND OR c.home_id<>p_home_id OR c.postcard_id IS DISTINCT FROM p_postcard_id OR c.state<>'completed' THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_CONFLICT','status',409); END IF;
  SELECT * INTO p FROM public."HomePostcardCode" WHERE id=p_postcard_id AND home_id=p_home_id AND user_id=p_actor_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_NO_LONGER_AVAILABLE','status',409); END IF;
  -- Preserve known/unknown transport outcomes even when current access changes.
  IF p.dispatch_status<>'pending' THEN RETURN jsonb_build_object('ok',true,'claimed',false); END IF;
  context:=public.home_postcard_current_context(p_home_id,p_actor_id,false);
  IF context->>'ok' IS DISTINCT FROM 'true' THEN RETURN context; END IF;
  IF p.status<>'pending' OR p.expires_at<=t THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_NO_LONGER_AVAILABLE','status',409); END IF;
  a:=public.home_postcard_confirmed_address(c);
  SELECT * INTO h FROM public."Home" WHERE id=p_home_id;
  IF a IS NULL OR a IS DISTINCT FROM jsonb_build_object('line1',h.address,'line2',coalesce(h.address2,''),
    'city',h.city,'state',h.state,'postal_code',h.zipcode,'country',coalesce(h.country,'US')) THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_ADDRESS_CHANGED','status',409); END IF;
  IF c.code_key_id IS NULL OR p.code_hash IS DISTINCT FROM p_code_hash THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_CODE_KEY_UNAVAILABLE','status',503); END IF;
  UPDATE public."HomePostcardCode" SET dispatch_status='dispatching',updated_at=t WHERE id=p.id RETURNING * INTO p;
  RETURN jsonb_build_object('ok',true,'claimed',true,'postcard',to_jsonb(p));
END;
$$;

REVOKE ALL ON FUNCTION public.home_postcard_confirmed_address(public."HomePostcardRequestCommand"),
  public.get_home_postcard_current_status(uuid,uuid),
  public.claim_home_postcard_current_dispatch(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_postcard_confirmed_address(public."HomePostcardRequestCommand"),
  public.get_home_postcard_current_status(uuid,uuid),
  public.claim_home_postcard_current_dispatch(uuid,uuid,uuid,uuid,text) TO service_role;

CREATE FUNCTION public.record_home_postcard_current_dispatch(
  p_home_id uuid,p_actor_id uuid,p_postcard_id uuid,p_outcome text,p_vendor_job_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."HomePostcardCode"%ROWTYPE;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL OR p_postcard_id IS NULL
    OR p_outcome IS NULL OR p_outcome NOT IN ('accepted','delivery_unknown','rejected')
    OR (p_outcome='accepted' AND (p_vendor_job_id IS NULL OR length(p_vendor_job_id) NOT BETWEEN 1 AND 200))
    OR (p_outcome<>'accepted' AND p_vendor_job_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  SELECT * INTO p FROM public."HomePostcardCode" WHERE id=p_postcard_id AND home_id=p_home_id AND user_id=p_actor_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','POSTCARD_NO_LONGER_AVAILABLE','status',409); END IF;
  -- A signed webhook may have won the receipt race. Never overwrite its known
  -- outcome, or undo a later proof retirement/verification while saving transport.
  IF p.dispatch_status='dispatching' THEN
    UPDATE public."HomePostcardCode" SET dispatch_status=p_outcome,vendor_job_id=p_vendor_job_id,
      status=CASE WHEN p_outcome='rejected' AND status='pending' THEN 'cancelled' ELSE status END,
      updated_at=clock_timestamp() WHERE id=p.id;
  END IF;
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.record_home_postcard_current_dispatch(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_home_postcard_current_dispatch(uuid,uuid,uuid,text,text) TO service_role;
