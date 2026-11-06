-- Backwards compatible: yes. Additive columns on the existing webhook event table, plus service-only
-- functions redefined with the same signatures and grants. No new table.
--
-- Delivery updates: LobWebhookEvent holds every printer's events in our own words (no payloads, no
-- addresses). processed_at lets a redelivered event through when its first worker died mid-way;
-- rows already here are done.
--
-- Returned cards: a returned, re-routed or failed card ends the attempt. The postcard status reads
-- that as one extra key, mail_state. Two cards back from a Home's address within 90 days stop a third.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."LobWebhookEvent"
  ADD COLUMN provider text NOT NULL DEFAULT 'lob',
  ADD COLUMN normalized_status text,
  ADD COLUMN occurred_at timestamptz,
  ADD COLUMN processed_at timestamptz;
UPDATE public."LobWebhookEvent" SET processed_at=received_at WHERE processed_at IS NULL;

-- Delivery updates only move forward. Anything ending a card outranks the rest.
CREATE FUNCTION public.mail_status_rank(p_status text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT CASE p_status
    WHEN 'created' THEN 1 WHEN 'rendered' THEN 2 WHEN 'mailed' THEN 3 WHEN 'in_transit' THEN 4
    WHEN 'in_local_area' THEN 5 WHEN 'out_for_delivery' THEN 6 WHEN 'delivered' THEN 7
    WHEN 'returned' THEN 8 WHEN 'rerouted' THEN 8 WHEN 'failed' THEN 8 WHEN 'canceled' THEN 8
    ELSE 0 END;
$$;

-- A new overload with the printer named, so another printer's receipts are accepted. Server code
-- from before this migration keeps calling the four-argument function, unchanged, during a release.
CREATE FUNCTION public.record_mail_verification_webhook(
  p_job_id uuid, p_vendor_job_id text, p_event_type text, p_vendor_status text, p_vendor text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
BEGIN
  IF p_job_id IS NULL OR nullif(p_vendor_job_id, '') IS NULL
    OR nullif(p_event_type, '') IS NULL OR length(p_event_type) > 100
    OR nullif(p_vendor_status, '') IS NULL OR length(p_vendor_status) > 50
    OR p_vendor IS NULL OR p_vendor !~ '^[a-z0-9_]{1,40}$' THEN
    RAISE EXCEPTION 'Invalid mail webhook status' USING ERRCODE = '22023';
  END IF;

  UPDATE public."MailVerificationJob"
  SET vendor_status = CASE WHEN public.mail_status_rank(p_vendor_status) >= public.mail_status_rank(vendor_status)
      THEN p_vendor_status ELSE vendor_status END,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_webhook_event', p_event_type, 'last_webhook_at', now()),
    updated_at = now()
  WHERE id = p_job_id AND vendor = p_vendor AND vendor_job_id = p_vendor_job_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mail_status_rank(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mail_status_rank(text) TO service_role;
REVOKE ALL ON FUNCTION public.record_mail_verification_webhook(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_mail_verification_webhook(uuid, text, text, text, text) TO service_role;

-- One address, by anyone in the Home. A card to an address since corrected doesn't count.
CREATE FUNCTION public.home_postcard_returned_too_often(p_home_id uuid,p_destination jsonb,p_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT count(*)>=2 FROM public."HomePostcardCode" WHERE home_id=p_home_id AND destination=p_destination
    AND mail_outcome IN ('returned','rerouted') AND requested_at>p_at-interval '90 days';
$$;
REVOKE ALL ON FUNCTION public.home_postcard_returned_too_often(uuid,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.home_postcard_returned_too_often(uuid,jsonb,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.begin_home_postcard_request(
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
      IF public.home_postcard_returned_too_often(p_home_id,v_destination,t) THEN
        v_code:='POSTCARD_RETURNED_LIMIT';v_status:=409;EXIT validate_request; END IF;
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

REVOKE ALL ON FUNCTION public.begin_home_postcard_request(uuid,uuid,uuid,jsonb,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_home_postcard_request(uuid,uuid,uuid,jsonb,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_home_postcard_current_status(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."HomePostcardCode"%ROWTYPE; c public."HomePostcardRequestCommand"%ROWTYPE;
  h public."Home"%ROWTYPE; context jsonb; request_context jsonb; t timestamptz;
  a jsonb; v_matches boolean:=false; v_pending boolean:=false; v_delivery text; v_mail_state text;
  v_returned_too_often boolean;
BEGIN
  IF p_home_id IS NULL OR p_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'code','POSTCARD_REQUEST_INVALID','status',400); END IF;
  PERFORM public.lock_home_postcard_current_scope(p_home_id,p_actor_id);
  t:=clock_timestamp();
  SELECT pc.* INTO p FROM public."HomePostcardCode" pc WHERE pc.home_id=p_home_id AND pc.user_id=p_actor_id
    AND NOT EXISTS(SELECT FROM public."HomeOccupancy" o WHERE o.home_id=p_home_id AND o.user_id=p_actor_id
      AND o.start_at>pc.requested_at)
    ORDER BY pc.requested_at DESC,pc.id DESC LIMIT 1;
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
    -- An extra key apps in the stores ignore. delivery and status keep their old words,
    -- because those apps refuse any other value; to them a returned card is a cancelled one.
    v_mail_state:=CASE
      WHEN p.status='cancelled' AND p.mail_outcome IN ('returned','rerouted','failed') THEN p.mail_outcome
      WHEN p.status='cancelled' AND p.dispatch_status='rejected' THEN 'failed'
      WHEN v_pending AND p.dispatch_status IN ('dispatching','delivery_unknown') AND p.vendor_job_id IS NULL
        THEN CASE WHEN p.updated_at>t-interval '15 minutes' THEN 'sending' ELSE 'delayed' END
      END;
  END IF;
  v_returned_too_often:=NOT (v_pending AND coalesce(v_matches,false)) AND h.id IS NOT NULL
    AND public.home_postcard_returned_too_often(p_home_id,jsonb_build_object('address',h.address,'address2',h.address2,
      'city',h.city,'state',h.state,'zipcode',h.zipcode),t);
  RETURN jsonb_build_object('ok',true,'home_id',p_home_id,'actor_id',p_actor_id,'checked_at',t,
    'can_request',request_context->>'ok'='true' AND NOT (v_pending AND coalesce(v_matches,false)) AND NOT coalesce(v_returned_too_often,false),
    'can_verify',coalesce(context->>'ok'='true' AND v_pending AND coalesce(v_matches,false) AND v_delivery IN ('accepted','unknown'),false),
    'can_resume',coalesce(request_context->>'ok'='true' AND v_pending AND coalesce(v_matches,false)
      AND v_delivery='not_started' AND a IS NOT NULL,false),
    'restriction',CASE WHEN context->>'ok'<>'true' THEN context->>'code'
      WHEN p.id IS NOT NULL AND NOT coalesce(v_matches,false) THEN 'POSTCARD_ADDRESS_CHANGED'
      WHEN p.status='pending' AND p.expires_at<=t THEN 'POSTCARD_EXPIRED'
      WHEN p.status='pending' AND p.attempts>=5 THEN 'POSTCARD_LOCKED'
      ELSE coalesce(request_context->>'code',CASE WHEN v_returned_too_often THEN 'POSTCARD_RETURNED_LIMIT' END) END,
    'request',CASE WHEN a IS NOT NULL THEN public.home_postcard_request_projection(c)||jsonb_build_object('address',a) ELSE NULL END,
    'postcard',CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('id',p.id,'requested_at',p.requested_at,'expires_at',p.expires_at,
      'status',CASE WHEN p.status='pending' AND p.expires_at<=t THEN 'expired' ELSE p.status END,
      'delivery',v_delivery,'attempts_remaining',greatest(0,5-p.attempts),'mail_state',v_mail_state) ELSE NULL END);
END;
$$;

REVOKE ALL ON FUNCTION public.get_home_postcard_current_status(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_postcard_current_status(uuid,uuid) TO service_role;
