-- Backwards compatible: yes. Redefines one read-only status function with the same signature
-- and grants; no table, column or data change.
-- The postcard status shows only postcards requested during the person's current membership.
--
-- Someone who left a Home and applied again, or a former member the household invited back,
-- starts a new membership (its start_at is reset). The status kept showing the latest postcard
-- from the earlier membership, so a returning applicant saw "Address verified by mail" above the
-- form for the postcard they still had to request. A postcard requested before the current
-- membership started now belongs to the earlier one and is no longer the current status. The
-- postcard rows themselves are unchanged.
--
-- Same signature and service-only grants; grants are restated below.

CREATE OR REPLACE FUNCTION public.get_home_postcard_current_status(p_home_id uuid,p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."HomePostcardCode"%ROWTYPE; c public."HomePostcardRequestCommand"%ROWTYPE;
  h public."Home"%ROWTYPE; context jsonb; request_context jsonb; t timestamptz;
  a jsonb; v_matches boolean:=false; v_pending boolean:=false; v_delivery text;
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


REVOKE ALL ON FUNCTION public.get_home_postcard_current_status(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_postcard_current_status(uuid,uuid) TO service_role;
