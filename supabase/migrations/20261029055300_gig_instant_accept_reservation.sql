-- Backwards compatible: yes. Reserve instant assignments and their payment together.
-- The owner's existing assigned-authorization flow owns all provider attempts.
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.reserve_instant_gig(
 p_gig_id uuid, p_helper_id uuid, p_updated_at timestamptz,
 p_customer_id text DEFAULT NULL, p_platform_fee integer DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"; p public."Payment"; amount_cents integer; reused boolean := false; auth_result jsonb;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('code','not_found'); END IF;
 IF g.engagement_mode <> 'instant_accept' OR g.engagement_mode IS NULL THEN
  RETURN jsonb_build_object('code','wrong_mode');
 END IF;
 IF public.paid_gig_actor_allowed(g.user_id,p_helper_id) THEN
  RETURN jsonb_build_object('code','self_accept');
 END IF;
 IF EXISTS (SELECT 1 FROM public."UserBlock" WHERE
   (blocker_user_id=g.user_id AND blocked_user_id=p_helper_id) OR
   (blocker_user_id=p_helper_id AND blocked_user_id=g.user_id)) THEN
  RETURN jsonb_build_object('code','blocked');
 END IF;
 IF g.status='assigned' AND g.accepted_by=p_helper_id THEN
  IF g.price > 0 THEN
   SELECT * INTO p FROM public."Payment" WHERE id=g.payment_id;
   IF NOT FOUND OR p.payee_id<>p_helper_id OR p.payer_id<>g.user_id
      OR p.metadata->>'instant_accept_v1' IS DISTINCT FROM 'true' THEN
    RETURN jsonb_build_object('code','assigned');
   END IF;
  END IF;
  reused := true;
 ELSE
  IF g.status<>'open' THEN RETURN jsonb_build_object('code','assigned'); END IF;
  IF g.updated_at IS DISTINCT FROM p_updated_at THEN RETURN jsonb_build_object('code','changed'); END IF;
  IF g.deadline <= now() THEN RETURN jsonb_build_object('code','expired'); END IF;
  IF g.payment_id IS NOT NULL OR g.accepted_by IS NOT NULL
     OR EXISTS (SELECT 1 FROM public."GigPaymentAcceptance" WHERE gig_id=g.id AND state IN ('initializing','pending','canceling'))
     OR EXISTS (SELECT 1 FROM public."Payment" WHERE gig_id=g.id AND payment_type='gig_payment'
                AND payment_status NOT IN ('canceled','refunded_full')) THEN
   RETURN jsonb_build_object('code','payment_pending');
  END IF;
  IF g.price IS NULL OR g.price<0 OR g.price>999999.99 OR g.price*100<>round(g.price*100) THEN
   RETURN jsonb_build_object('code','invalid_price');
  END IF;
  amount_cents := round(g.price*100)::integer;
  IF amount_cents>0 THEN
   IF amount_cents<50 OR p_platform_fee IS NULL OR p_platform_fee<0 OR p_platform_fee>amount_cents
      OR p_customer_id IS NULL OR NOT EXISTS (SELECT 1 FROM public."User" WHERE id=g.user_id AND stripe_customer_id=p_customer_id) THEN
    RETURN jsonb_build_object('code','payment_pending');
   END IF;
   IF NOT EXISTS (SELECT 1 FROM public."StripeAccount" WHERE user_id=p_helper_id AND details_submitted) THEN
    RETURN jsonb_build_object('code','payout_required');
   END IF;
   INSERT INTO public."Payment" (gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_to_payee,amount_platform_fee,currency,
     payment_type,payment_status,stripe_customer_id,home_id,metadata)
   VALUES (g.id,g.user_id,p_helper_id,amount_cents,amount_cents,amount_cents-p_platform_fee,p_platform_fee,'usd',
     'gig_payment','ready_to_authorize',p_customer_id,g.origin_home_id,jsonb_build_object('instant_accept_v1',true))
   RETURNING * INTO p;
  END IF;
  UPDATE public."Gig" SET status='assigned',accepted_by=p_helper_id,accepted_at=now(),
    payment_id=p.id,payment_status=CASE WHEN p.id IS NOT NULL THEN 'ready_to_authorize' ELSE NULL END,
    updated_at=now() WHERE id=g.id RETURNING * INTO g;
  -- Preserve on-session checkout even if the scheduler observes the reservation
  -- before the owner opens it. No saved card or off-session consent was provided.
  IF p.id IS NOT NULL THEN
   auth_result := public.begin_legacy_gig_authorization(g.id,g.user_id,false,false);
   IF auth_result ? 'error' THEN RAISE EXCEPTION 'Could not reserve owner authorization'; END IF;
  END IF;
 END IF;
 RETURN jsonb_build_object('reused',reused,'gig',jsonb_build_object(
   'id',g.id,'status',g.status,'accepted_by',g.accepted_by,'accepted_at',g.accepted_at,
   'title',g.title,'user_id',g.user_id,'price',g.price,'payment_id',g.payment_id,'payment_status',g.payment_status));
END $$;
REVOKE ALL ON FUNCTION public.reserve_instant_gig(uuid,uuid,timestamptz,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_instant_gig(uuid,uuid,timestamptz,text,integer) TO service_role;
