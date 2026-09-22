-- Backwards compatible: yes. Add one service-only RPC; existing routes/functions
-- and records are unchanged until the backend adopts it. Roll back the backend
-- without removing committed confirmations or notices; no data rewrite is needed.
-- Complete the existing confirmation writes together. Existing capture functions
-- only commit payment proof; no existing RPC groups these Gig/User/Bid/Notice writes.
-- No historical confirmations are backfilled or replayed, and no table is added.
CREATE FUNCTION public.confirm_gig_completion(
 p_gig_id uuid,p_actor_id uuid,p_expected jsonb,p_satisfaction integer,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; p public."Payment"%ROWTYPE;
 n public."Notification"%ROWTYPE; recipient uuid; notices jsonb:='[]'::jsonb;
 event_id uuid:=gen_random_uuid(); confirmed_at timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF NOT coalesce(public.paid_gig_actor_allowed(g.user_id,p_actor_id),false) THEN
  RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF p_expected IS NULL OR NOT (p_expected ?& ARRAY['user_id','accepted_by','price','payment_id',
   'accepted_at','started_at','worker_completed_at'])
  OR g.status IS DISTINCT FROM 'completed' OR g.worker_completed_at IS NULL
  OR ROW(g.user_id,g.accepted_by,g.price,g.payment_id,g.accepted_at,g.started_at,g.worker_completed_at)
   IS DISTINCT FROM ROW((p_expected->>'user_id')::uuid,(p_expected->>'accepted_by')::uuid,
    (p_expected->>'price')::numeric,(p_expected->>'payment_id')::uuid,
    (p_expected->>'accepted_at')::timestamptz,(p_expected->>'started_at')::timestamptz,
    (p_expected->>'worker_completed_at')::timestamptz) THEN
  RETURN jsonb_build_object('error','COMPLETION_CHANGED'); END IF;
 -- A concurrent/retried receipt never increments again or recreates read/deleted notices.
 IF g.owner_confirmed_at IS NOT NULL THEN
  RETURN jsonb_build_object('gig',to_jsonb(g),'notifications','[]'::jsonb,'reused',true); END IF;
 IF g.price IS NULL OR g.price<0 OR (g.price>0 AND g.payment_id IS NULL) THEN
  RETURN jsonb_build_object('error','PAYMENT_NOT_CAPTURED'); END IF;
 IF g.payment_id IS NOT NULL THEN
  SELECT * INTO p FROM public."Payment" WHERE id=g.payment_id FOR UPDATE;
  IF NOT FOUND OR p.gig_id IS DISTINCT FROM g.id OR p.payer_id IS DISTINCT FROM g.user_id
   OR p.payee_id IS DISTINCT FROM g.accepted_by OR p.payment_type IS DISTINCT FROM 'gig_payment'
   OR p.amount_total IS DISTINCT FROM round(g.price*100)::bigint OR lower(p.currency) IS DISTINCT FROM 'usd'
   OR p.payment_status IS DISTINCT FROM 'captured_hold' OR p.captured_at IS NULL
   OR p.stripe_payment_intent_id IS NULL OR p.stripe_charge_id IS NULL
   OR coalesce(p.refunded_amount,0)<>0 OR p.dispute_id IS NOT NULL THEN
   RETURN jsonb_build_object('error','PAYMENT_NOT_CAPTURED'); END IF;
 END IF;
 UPDATE public."Gig" SET owner_confirmed_at=confirmed_at,updated_at=confirmed_at,
  owner_confirmation_note=left(p_note,1000),
  owner_satisfaction=CASE WHEN p_satisfaction IS NULL THEN NULL ELSE least(5,greatest(1,p_satisfaction)) END
  WHERE id=g.id RETURNING * INTO g;
 IF g.accepted_by IS NOT NULL THEN
  UPDATE public."User" SET gigs_completed=coalesce(gigs_completed,0)+1 WHERE id=g.accepted_by;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completion worker unavailable'; END IF;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context_type,context,idempotency_key)
  VALUES(g.accepted_by,'gig_confirmed','Gig "'||coalesce(nullif(g.title,''),'completed gig')||'" confirmed!',
   'The gig owner confirmed your work is complete. Great job!','🎉','/gigs/'||g.id,
   jsonb_build_object('gig_id',g.id),'personal','personal','gig-confirmation:'||event_id||':'||g.accepted_by)
  RETURNING * INTO n;
  notices:=notices||jsonb_build_array(to_jsonb(n));
 END IF;
 -- UPDATE RETURNING chooses only the bids this transaction actually closes.
 FOR recipient IN WITH closed AS (
  UPDATE public."GigBid" SET status='rejected',updated_at=confirmed_at
  WHERE gig_id=g.id AND status IN ('pending','countered') RETURNING user_id
 ) SELECT DISTINCT user_id FROM closed ORDER BY user_id LOOP
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,context_type,context,idempotency_key)
  VALUES(recipient,'bid_rejected','"'||coalesce(nullif(g.title,''),'a gig')||'" has been completed',
   'The gig "'||coalesce(nullif(g.title,''),'a gig')||'" has been completed by another worker. Your bid is now closed.',
   '✅','/gigs/'||g.id,jsonb_build_object('gig_id',g.id,'reason','gig_completed'),
   'personal','personal','gig-completion-bid:'||event_id||':'||recipient) RETURNING * INTO n;
  notices:=notices||jsonb_build_array(to_jsonb(n));
 END LOOP;
 RETURN jsonb_build_object('gig',to_jsonb(g),'notifications',notices,'reused',false);
END $$;
REVOKE ALL ON FUNCTION public.confirm_gig_completion(uuid,uuid,jsonb,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_gig_completion(uuid,uuid,jsonb,integer,text) TO service_role;
