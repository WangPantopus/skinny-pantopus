-- Backwards compatible: yes. Adds a service-only cancellation RPC; existing callers,
-- tables, rows and grants remain available. Deploy migration before backend/web.
-- CREATE OR REPLACE also advances owned candidate databases that already applied
-- the unchanged private 228 prototype; never alter their existing ledger rows.
-- A booking must not become cancelled without durably recording its payment
-- decision. Separate PostgREST writes lost the refund on a queue failure.
-- Reuse Payment metadata and PaymentRefundRequest; no parallel queue or table.
CREATE OR REPLACE FUNCTION public.cancel_booking_with_refund(
 p_booking_id uuid, p_actor_id uuid, p_reason text, p_expected_updated_at timestamptz,
 p_payment_id uuid, p_expected_payment jsonb, p_refund_amount integer, p_decided_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE b public."Booking"; p public."Payment"; reserved jsonb; decision jsonb;
BEGIN
 -- Payment first, matching refund/capture serialization; recheck the binding
 -- after taking the booking lock instead of trusting the initial API read.
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','PAYMENT_NOT_FOUND'); END IF;
 SELECT * INTO b FROM public."Booking" WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF b.payment_id IS DISTINCT FROM p.id OR p.booking_id IS DISTINCT FROM b.id
  OR p.payment_type IS DISTINCT FROM 'booking_payment' OR p.gig_id IS NOT NULL THEN
  RETURN jsonb_build_object('error','PAYMENT_BINDING_CHANGED'); END IF;
 IF b.status='cancelled' THEN
  RETURN jsonb_build_object('booking',to_jsonb(b),'transitioned',false);
 END IF;
 IF b.status NOT IN ('pending','confirmed') OR b.updated_at IS DISTINCT FROM p_expected_updated_at
  OR public.refund_payment_snapshot(p) IS DISTINCT FROM p_expected_payment THEN
  RETURN jsonb_build_object('error','BOOKING_CHANGED'); END IF;
 IF p_refund_amount IS NULL OR p_refund_amount<0 OR p_refund_amount>p.amount_total
  OR p_decided_at IS NULL OR p_decided_at>clock_timestamp()+interval '5 seconds' THEN
  RETURN jsonb_build_object('error','INVALID_TERMS'); END IF;

 IF p_refund_amount>0 THEN
  reserved:=public.reserve_payment_refund(p.id,b.id::text,p_actor_id,'policy',
   p_refund_amount,'other',NULL,p_expected_payment,
   CASE WHEN p.payment_status IN ('authorized','authorize_pending') THEN 'release' ELSE 'refund' END);
  IF reserved ? 'error' THEN RETURN reserved; END IF;
 END IF;
 decision:=jsonb_build_object('booking_id',b.id,'decided_at',p_decided_at,
  'refund_amount_cents',p_refund_amount,'request_id',CASE WHEN p_refund_amount>0 THEN b.id ELSE NULL END);
 UPDATE public."Payment" SET metadata=coalesce(metadata,'{}'::jsonb)||
  jsonb_build_object('booking_cancellation',decision),updated_at=clock_timestamp() WHERE id=p.id;
 UPDATE public."Booking" SET status='cancelled',cancel_reason=p_reason,cancelled_by=p_actor_id,
  ics_sequence=coalesce(ics_sequence,0)+1,updated_at=clock_timestamp() WHERE id=b.id RETURNING * INTO b;
 RETURN jsonb_build_object('booking',to_jsonb(b),'transitioned',true);
END $$;
REVOKE ALL ON FUNCTION public.cancel_booking_with_refund(uuid,uuid,text,timestamptz,uuid,jsonb,integer,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_with_refund(uuid,uuid,text,timestamptz,uuid,jsonb,integer,timestamptz) TO service_role;
