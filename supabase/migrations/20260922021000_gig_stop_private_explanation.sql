-- Backwards compatible: yes. Keep an Other explanation in the existing private
-- GigStopRequest reason; the public task timeline receives only its category.
-- Existing enum reasons, immutable retries and financial proof are unchanged.
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.finish_gig_stop(p_request_id uuid,p_actor_id uuid,p_proof jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; r public."GigStopRequest"; g public."Gig"; p public."Payment"; refund public."PaymentRefundRequest"; final_receipt jsonb; recipients uuid[];
BEGIN
 d:=public.check_gig_stop_current(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.state='completed' THEN RETURN d; END IF;
 SELECT * INTO g FROM jsonb_populate_record(NULL::public."Gig",d->'gig');
 SELECT * INTO p FROM jsonb_populate_record(NULL::public."Payment",nullif(d->'payment','null'::jsonb));
 IF r.financial_action='release' AND NOT public.gig_stop_release_proof(p,p_proof) THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 IF r.financial_action='refund' THEN
  SELECT * INTO refund FROM public."PaymentRefundRequest" WHERE id=r.id AND payment_id=p.id FOR UPDATE;
  IF refund.status IN ('failed','canceled') THEN
   UPDATE public."GigStopRequest" SET state='needs_review',last_error='REFUND_FAILED',lease_id=NULL,lease_until=NULL WHERE id=r.id;
   RETURN public.read_gig_stop_request(g.id,p_actor_id,r.id);
  END IF;
  IF refund.status IS DISTINCT FROM 'succeeded' OR refund.actor_id IS DISTINCT FROM r.actor_id OR refund.actor_mode<>'policy'
   OR refund.operation<>'refund' OR refund.requested_amount IS NOT NULL OR refund.reason<>'requested_by_customer'
   OR refund.frozen_payment IS DISTINCT FROM public.refund_payment_snapshot(p)
   OR p.payment_status IS DISTINCT FROM 'refunded_full' OR p.refunded_amount IS DISTINCT FROM p.amount_total
   OR NOT EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE request_id=r.id AND payment_id=p.id AND status='succeeded'
    AND provider_refund_id=refund.provider_refund_id AND intent_id=p.stripe_payment_intent_id AND charge_id=p.stripe_charge_id AND amount_cents=refund.amount_cents)
   THEN RETURN d; END IF;
 END IF;
 IF r.financial_action='none' AND p.id IS NOT NULL AND (p.stripe_payment_intent_id IS NOT NULL OR p.payment_status<>'ready_to_authorize'
  OR p.payment_attempted_at IS NOT NULL OR p.captured_at IS NOT NULL OR coalesce(p.capture_attempts,0)<>0) THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 PERFORM set_config('app.gig_stop_receipt','on',true);
 SELECT coalesce(array_agg(DISTINCT who),'{}'::uuid[]) INTO recipients FROM (
  SELECT (r.terms->>'workerId')::uuid AS who UNION SELECT g.user_id
  UNION SELECT user_id FROM public."BusinessTeam" WHERE business_user_id=g.user_id AND is_active AND public.paid_gig_actor_allowed(g.user_id,user_id)
  UNION SELECT user_id FROM public."GigBid" WHERE gig_id=g.id AND status IN ('pending','countered') AND r.action IN ('cancel','close')
 ) people WHERE who IS NOT NULL AND who<>r.actor_id;
 IF p.id IS NOT NULL AND r.financial_action IN ('release','none') THEN
  UPDATE public."Payment" SET payment_status='canceled',updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 END IF;
 IF r.action IN ('reopen_bidding','worker_release') THEN
  UPDATE public."GigBid" SET status=CASE WHEN r.rollback_mode='payment_setup_aborted' THEN 'pending' ELSE 'rejected' END,
   updated_at=clock_timestamp() WHERE id=(r.terms->>'acceptedBidId')::uuid AND gig_id=g.id AND user_id=g.accepted_by AND status='accepted';
  UPDATE public."Gig" SET status='open',accepted_by=NULL,accepted_at=NULL,payment_id=NULL,payment_status='none',
   worker_ack_status=NULL,worker_ack_eta_minutes=NULL,worker_ack_note=NULL,worker_ack_updated_at=NULL,
   last_worker_reminder_at=NULL,auto_reminder_count=0,updated_at=clock_timestamp() WHERE id=g.id RETURNING * INTO g;
 ELSE
  UPDATE public."GigBid" SET status='rejected',updated_at=clock_timestamp() WHERE gig_id=g.id AND status IN ('pending','countered');
  UPDATE public."Gig" SET status='cancelled',cancelled_at=clock_timestamp(),cancelled_by=r.actor_id,cancellation_reason=CASE WHEN r.reason LIKE 'other: %' THEN 'other' ELSE r.reason END,
   cancellation_zone=CASE WHEN r.terms->>'gigStatus'='assigned' THEN 1 ELSE 0 END,cancellation_fee=0,
   payment_status=coalesce(p.payment_status,'none'),updated_at=clock_timestamp() WHERE id=g.id RETURNING * INTO g;
 END IF;
 final_receipt:=jsonb_build_object('requestId',r.id,'gigId',g.id,'paymentId',r.payment_id,'ownerId',r.terms->'ownerId',
  'workerId',r.terms->'workerId','amountCents',r.terms->'amountCents','currency','usd','action',r.action,'gigStatus',g.status,
  'financialStatus',CASE r.financial_action WHEN 'release' THEN 'released' WHEN 'refund' THEN 'refunded' ELSE 'none' END);
 UPDATE public."GigStopRequest" SET state='completed',completed_at=clock_timestamp(),receipt=final_receipt,
  provider_receipt=p_proof,notification_recipients=recipients,lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=r.id;
 PERFORM public.materialize_gig_stop_notices(r.id);
 PERFORM set_config('app.gig_stop_receipt','off',true);
 RETURN public.read_gig_stop_request(g.id,p_actor_id,r.id);
END $$;

