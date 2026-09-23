-- Backwards compatible: yes. Existing tables, rows, grants and receipts are kept.
-- Founder decision P04/P05 (2026-09-23): a poster no-show (the 25% no-show fee)
-- or a poster late cancel before Start Work (the gig_stop_terms policy fee) is paid
-- from the existing manual-capture hold. Only the fee is captured and Stripe
-- releases the rest; the worker is credited floor(fee*amount_to_payee/amount_total)
-- after the normal cooling-off. There is no new table: fee evidence lives on the
-- existing Payment row (metadata.gig_fee) and the existing stop request/receipt.
-- The stop command gains the 'fee' financial action. Worker-initiated actions stay
-- fee-free. Provider calls remain in the service; SQL records exact provider proof.
-- Applied functions are extended by CREATE OR REPLACE with their signatures and
-- privileges unchanged; no applied migration or historical row is rewritten.
-- Deploy this migration before the matching backend and clients.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."GigStopRequest" DROP CONSTRAINT "GigStopRequest_financial_action_check";
ALTER TABLE public."GigStopRequest" ADD CONSTRAINT "GigStopRequest_financial_action_check"
 CHECK(financial_action IN ('none','release','refund','fee'));

-- Exact provider proof that only the fee was captured from this payment's hold
-- and that the provider released the remainder (no refund object is created).
CREATE FUNCTION public.gig_fee_capture_proof(p public."Payment",p_fee integer,v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(p_fee>0 AND p_fee<p.amount_total
 AND v->>'id'=p.stripe_payment_intent_id AND v->>'status'='succeeded' AND v->>'customer'=p.stripe_customer_id
 AND v->'amount'=to_jsonb(p.amount_total) AND v->>'currency'='usd' AND v->>'capture_method'='manual'
 AND v->>'payer_id'=p.payer_id::text AND v->>'payee_id'=p.payee_id::text AND v->>'gig_id'=p.gig_id::text
 AND (v->>'acceptance_attempt_id') IS NOT DISTINCT FROM (p.metadata->>'acceptance_attempt_id')
 AND v->'amount_received'=to_jsonb(p_fee) AND v->'amount_capturable'='0'::jsonb
 AND v->>'charge_id' ~ '^ch_[a-zA-Z0-9]+$' AND v->'charge_amount'=to_jsonb(p.amount_total)
 AND v->'amount_captured'=to_jsonb(p_fee) AND v->'charge_captured'='true'::jsonb
 AND v->'charge_refunded'='false'::jsonb AND v->'charge_amount_refunded'='0'::jsonb
 AND jsonb_typeof(v->'charge_disputed')='boolean',false)
$$;

-- One Payment write for both fee kinds. Callers hold the Gig then Payment locks
-- and have already verified the proof; only definer functions may call it.
CREATE FUNCTION public.record_gig_fee_payment(p_payment_id uuid,p_kind text,p_fee integer,p_request_id uuid,p_proof jsonb)
RETURNS public."Payment" LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment";
BEGIN
 UPDATE public."Payment" SET payment_status='captured_hold',stripe_charge_id=p_proof->>'charge_id',
  captured_at=coalesce(captured_at,clock_timestamp()),cooling_off_ends_at=coalesce(cooling_off_ends_at,clock_timestamp()+interval '48 hours'),
  payment_succeeded_at=coalesce(payment_succeeded_at,clock_timestamp()),
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('gig_fee',coalesce(metadata->'gig_fee','{}'::jsonb)||jsonb_build_object(
   'version',1,'kind',p_kind,'state','captured','fee_cents',p_fee,'released_cents',amount_total-p_fee,
   'charge_id',p_proof->>'charge_id','request_id',p_request_id,'captured_at',clock_timestamp())),
  updated_at=clock_timestamp()
 WHERE id=p_payment_id RETURNING * INTO p;
 RETURN p;
END $$;

-- Poster no-show, step 1: reserve the capture before the provider call. The
-- capture_pending state keeps a hold release, a stop request, Start Work and the
-- full-capture webhook path away while the provider outcome is unknown.
CREATE FUNCTION public.prepare_gig_fee_capture(p_gig_id uuid,p_actor_id uuid,p_fee_cents integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"; p public."Payment"; fee jsonb;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p_actor_id IS NULL OR g.accepted_by IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=g.payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','PAYMENT_REVIEW'); END IF;
 fee:=p.metadata->'gig_fee';
 IF fee IS NOT NULL THEN
  -- A retried report resumes only its own reservation or recorded outcome.
  IF fee->>'kind' IS DISTINCT FROM 'poster_no_show' OR fee->>'actor_id' IS DISTINCT FROM p_actor_id::text
   OR fee->>'fee_cents' IS DISTINCT FROM p_fee_cents::text THEN RETURN jsonb_build_object('error','FEE_CHANGED'); END IF;
  RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'reused',true);
 END IF;
 IF g.status IS DISTINCT FROM 'assigned' OR g.started_at IS NOT NULL OR g.worker_completed_at IS NOT NULL
  OR g.owner_confirmed_at IS NOT NULL OR g.accepted_at IS NULL OR g.accepted_at>clock_timestamp()-interval '24 hours' THEN
  RETURN jsonb_build_object('error','NOT_ELIGIBLE'); END IF;
 IF EXISTS(SELECT FROM public."GigStopRequest" WHERE gig_id=g.id AND state<>'completed') THEN RETURN jsonb_build_object('error','STOP_ACTIVE'); END IF;
 -- No capturable hold (never authorized, or already released/expired): the
 -- report proceeds and nothing is charged.
 IF p.payment_status IN ('none','setup_pending','ready_to_authorize','authorize_pending','authorization_failed','canceled')
  AND p.gig_id IS NOT DISTINCT FROM g.id AND p.payer_id IS NOT DISTINCT FROM g.user_id AND p.payee_id IS NOT DISTINCT FROM g.accepted_by
  AND p.captured_at IS NULL AND coalesce(p.capture_attempts,0)=0 AND coalesce(p.refunded_amount,0)=0 AND p.dispute_id IS NULL
  AND NOT EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action')) THEN
  RETURN jsonb_build_object('error','NO_HOLD'); END IF;
 IF p.gig_id IS DISTINCT FROM g.id OR p.payer_id IS DISTINCT FROM g.user_id OR p.payee_id IS DISTINCT FROM g.accepted_by
  OR p.payment_type IS DISTINCT FROM 'gig_payment' OR lower(p.currency) IS DISTINCT FROM 'usd'
  OR p.amount_total IS DISTINCT FROM round(g.price*100)::bigint OR p.amount_total<50
  OR p.payment_status IS DISTINCT FROM 'authorized' OR p.stripe_payment_intent_id IS NULL OR p.stripe_customer_id IS NULL
  OR p.captured_at IS NOT NULL OR coalesce(p.capture_attempts,0)<>0 OR coalesce(p.refunded_amount,0)<>0
  OR p.dispute_id IS NOT NULL OR p.stripe_transfer_id IS NOT NULL OR p.gig_completion_original IS NOT NULL
  OR EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income'))
  OR EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
  OR EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
  OR EXISTS(SELECT FROM public."GigAuthorizationExpiry" WHERE payment_id=p.id AND kind='cancel' AND state='pending')
  OR EXISTS(SELECT FROM public."GigLegacyAuthorization" WHERE payment_id=p.id AND NOT superseded AND (lease_until>clock_timestamp() OR cancel_requested)) THEN
  RETURN jsonb_build_object('error','PAYMENT_REVIEW'); END IF;
 -- The route computes the existing noShowFee (25%, rounded to cents); it can
 -- differ from exact integer math only by float rounding at a half cent.
 IF p_fee_cents IS NULL OR p_fee_cents<=0 OR p_fee_cents>=p.amount_total OR abs(p_fee_cents::bigint*4-p.amount_total)>4 THEN
  RETURN jsonb_build_object('error','INVALID_FEE'); END IF;
 UPDATE public."Payment" SET payment_status='capture_pending',capture_attempts=coalesce(capture_attempts,0)+1,
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('gig_fee',jsonb_build_object('version',1,'kind','poster_no_show',
   'state','pending','fee_cents',p_fee_cents,'released_cents',p.amount_total-p_fee_cents,'actor_id',p_actor_id,
   'request_id',gen_random_uuid(),'requested_at',clock_timestamp())),updated_at=clock_timestamp()
 WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=g.id RETURNING * INTO g;
 RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'reused',false);
END $$;

-- Poster no-show, step 2: record the exact provider outcome and cancel the task
-- in one transaction. A replay returns the recorded outcome and never re-records.
-- A canceled (expired or released) hold is recorded as not charged.
CREATE FUNCTION public.record_gig_fee_capture(p_payment_id uuid,p_actor_id uuid,p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE target_gig uuid; g public."Gig"; p public."Payment"; fee jsonb; fee_cents integer; charged boolean;
BEGIN
 SELECT gig_id INTO target_gig FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=target_gig FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 fee:=p.metadata->'gig_fee';
 IF g.id IS NULL OR p.gig_id IS DISTINCT FROM g.id OR fee IS NULL OR fee->>'kind' IS DISTINCT FROM 'poster_no_show'
  OR p_actor_id IS NULL OR fee->>'actor_id' IS DISTINCT FROM p_actor_id::text OR p.payee_id IS DISTINCT FROM p_actor_id
  OR g.payment_id IS DISTINCT FROM p.id OR g.accepted_by IS DISTINCT FROM p.payee_id OR g.user_id IS DISTINCT FROM p.payer_id THEN
  RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF fee->>'state' IN ('captured','not_charged') THEN
  RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'reused',true); END IF;
 fee_cents:=(fee->>'fee_cents')::integer;
 IF fee->>'state' IS DISTINCT FROM 'pending' OR p.payment_status IS DISTINCT FROM 'capture_pending'
  OR g.status IS DISTINCT FROM 'assigned' OR g.started_at IS NOT NULL OR g.worker_completed_at IS NOT NULL OR g.owner_confirmed_at IS NOT NULL
  OR p.dispute_id IS NOT NULL OR coalesce(p.refunded_amount,0)<>0 THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF public.gig_fee_capture_proof(p,fee_cents,p_proof) THEN charged:=true;
 ELSIF public.gig_stop_release_proof(p,p_proof) THEN charged:=false;
 ELSE RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 IF charged THEN
  p:=public.record_gig_fee_payment(p.id,'poster_no_show',fee_cents,(fee->>'request_id')::uuid,p_proof);
 ELSE
  UPDATE public."Payment" SET payment_status='canceled',metadata=jsonb_set(metadata,'{gig_fee}',fee||jsonb_build_object(
   'state','not_charged','reason','HOLD_UNAVAILABLE','fee_cents',0,'released_cents',amount_total,'recorded_at',clock_timestamp())),
   updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 END IF;
 UPDATE public."Gig" SET status='cancelled',cancelled_at=clock_timestamp(),cancelled_by=p_actor_id,cancellation_reason='no_show_poster',
  cancellation_zone=3,cancellation_fee=CASE WHEN charged THEN fee_cents/100.0 ELSE 0 END,payment_status=p.payment_status,
  updated_at=clock_timestamp() WHERE id=g.id RETURNING * INTO g;
 -- The report route's existing reliability rule, applied once with the transition
 -- so a lost reply or a retry can neither skip nor repeat it.
 UPDATE public."User" SET no_show_count=coalesce(no_show_count,0)+1,
  reliability_score=greatest(0,100-(coalesce(no_show_count,0)+1)*15-coalesce(late_cancel_count,0)*5)
 WHERE id=g.user_id;
 RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'reused',false);
END $$;

-- Owner cancel after the grace period, before Start Work, on a live authorized
-- hold: the policy fee is charged from that hold. Worker cancels stay in review.
CREATE OR REPLACE FUNCTION public.read_gig_stop_preview(p_gig_id uuid,p_actor_id uuid,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"; p public."Payment"; t jsonb; reason text; financial text:='none'; active uuid;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF NOT public.gig_stop_actor_allowed(g,p_actor_id,p_action) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=g.payment_id FOR UPDATE;
 PERFORM 1 FROM public."GigBid" WHERE gig_id=g.id AND status='accepted' ORDER BY id FOR UPDATE;
 t:=public.gig_stop_terms(g,p_action);
 SELECT id INTO active FROM public."GigStopRequest" WHERE gig_id=g.id AND state<>'completed';
 IF active IS NOT NULL THEN reason:='STOP_ACTIVE';
 ELSIF g.started_at IS NOT NULL OR g.status NOT IN ('open','assigned') OR g.worker_completed_at IS NOT NULL OR g.owner_confirmed_at IS NOT NULL THEN reason:='STARTED_POLICY_REVIEW';
 ELSIF g.status='open' AND (p_action NOT IN ('cancel','close') OR g.accepted_by IS NOT NULL OR g.payment_id IS NOT NULL
  OR EXISTS(SELECT FROM public."Payment" x WHERE x.gig_id=g.id AND NOT EXISTS(SELECT FROM public."GigStopRequest" s WHERE s.payment_id=x.id AND s.state='completed'))
  OR EXISTS(SELECT FROM public."GigPaymentAcceptance" WHERE gig_id=g.id AND state IN ('initializing','pending','canceling'))
  OR EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND status IN ('accepted','pending_payment'))) THEN reason:='PAYMENT_REVIEW';
 ELSIF g.status='assigned' AND (p_action='close' OR g.accepted_by IS NULL
  OR (SELECT count(*) FROM public."GigBid" WHERE gig_id=g.id AND status='accepted')>1
  OR EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND status='accepted' AND user_id IS DISTINCT FROM g.accepted_by)) THEN reason:='ASSIGNMENT_CHANGED';
 ELSIF (t->>'policyFeeCents')::integer<>0 AND (p_action IS DISTINCT FROM 'cancel' OR g.status IS DISTINCT FROM 'assigned'
  OR NOT coalesce(public.gig_stop_owner_allowed(g.user_id,p_actor_id),false) OR p.id IS NULL
  OR p.payment_status IS DISTINCT FROM 'authorized' OR p.stripe_payment_intent_id IS NULL) THEN reason:='FEE_POLICY_REVIEW';
 ELSIF g.payment_id IS NULL AND (g.status='assigned' AND g.price<>0) THEN reason:='PAYMENT_REVIEW';
 ELSIF g.payment_id IS NOT NULL THEN
  IF p.id IS NULL OR p.gig_id IS DISTINCT FROM g.id OR p.payer_id IS DISTINCT FROM g.user_id OR p.payee_id IS DISTINCT FROM g.accepted_by
   OR p.payment_type IS DISTINCT FROM 'gig_payment' OR lower(p.currency) IS DISTINCT FROM 'usd' OR p.amount_total IS DISTINCT FROM round(g.price*100)::bigint
   OR p.amount_total<50 OR p.dispute_id IS NOT NULL OR p.payment_status='disputed'
   OR p.stripe_transfer_id IS NOT NULL OR (p.transfer_status IS NOT NULL AND p.transfer_status<>'pending')
   OR p.escrow_released_at IS NOT NULL OR p.escrow_released_by IS NOT NULL OR p.transfer_completed_at IS NOT NULL
   OR p.stripe_transfer_reversal_id IS NOT NULL OR EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income'))
   OR EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
   OR EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
   OR EXISTS(SELECT FROM public."GigAuthorizationExpiry" WHERE payment_id=p.id AND kind='cancel' AND state='pending')
   OR EXISTS(SELECT FROM public."GigLegacyAuthorization" WHERE payment_id=p.id AND NOT superseded AND (lease_until>clock_timestamp() OR cancel_requested)) THEN reason:='PAYMENT_REVIEW';
  ELSIF p.payment_status IN ('captured_hold','transfer_scheduled','refunded_partial') THEN
   IF p_action<>'cancel' OR p.captured_at IS NULL OR p.stripe_charge_id IS NULL THEN reason:='CAPTURED_POLICY_REVIEW'; ELSE financial:='refund'; END IF;
  ELSIF p.captured_at IS NOT NULL OR coalesce(p.capture_attempts,0)<>0 OR coalesce(p.refunded_amount,0)<>0
    OR p.payment_status NOT IN ('none','setup_pending','ready_to_authorize','authorize_pending','authorization_failed','authorized','canceled') THEN reason:='PAYMENT_REVIEW';
  ELSIF p.stripe_payment_intent_id IS NOT NULL THEN
   financial:=CASE WHEN (t->>'policyFeeCents')::integer>0 THEN 'fee' ELSE 'release' END;
  ELSIF p.payment_status IS DISTINCT FROM 'ready_to_authorize' OR p.payment_attempted_at IS NOT NULL
   OR EXISTS(SELECT FROM public."GigLegacyAuthorization" WHERE payment_id=p.id AND (requested_at IS NOT NULL OR intent_id IS NOT NULL))
   THEN reason:='PROVIDER_OUTCOME_UNKNOWN';
  END IF;
 END IF;
 RETURN jsonb_build_object('gig',to_jsonb(g),'payment',CASE WHEN p.id IS NULL THEN NULL ELSE to_jsonb(p) END,
 'terms',t,'eligible',reason IS NULL,'unavailableReason',reason,'financialAction',financial,'activeRequestId',active);
END $$;

-- A fee request's provider evidence is either the exact fee capture or, when
-- the hold is no longer capturable, the exact zero-capture release.
CREATE OR REPLACE FUNCTION public.record_gig_stop_evidence(p_request_id uuid,p_proof jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r public."GigStopRequest"; p public."Payment";
BEGIN
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM public."Gig" WHERE id=r.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=r.payment_id FOR UPDATE;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.financial_action NOT IN ('release','fee') OR public.gig_stop_payment_snapshot(p) IS DISTINCT FROM r.payment_snapshot
  OR (r.financial_action='release' AND NOT public.gig_stop_release_proof(p,p_proof))
  OR (r.financial_action='fee' AND NOT (public.gig_fee_capture_proof(p,(r.terms->>'policyFeeCents')::integer,p_proof)
   OR public.gig_stop_release_proof(p,p_proof))) THEN RETURN false; END IF;
 UPDATE public."GigStopRequest" SET provider_receipt=p_proof WHERE id=r.id;
 RETURN true;
END $$;

-- The charged fee is shown only to the worker and the owner side, never to
-- other bidders who also receive the existing cancellation notice.
CREATE OR REPLACE FUNCTION public.materialize_gig_stop_notices(p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public."GigStopRequest"; recipient uuid; event_id uuid; n public."Notification"; kind text; fee_line text:='';
BEGIN
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.state IS DISTINCT FROM 'completed' OR r.receipt IS NULL THEN RAISE EXCEPTION 'Completed stop receipt required' USING ERRCODE='23514'; END IF;
 kind:=CASE WHEN r.action='worker_release' THEN 'worker_cant_make_it' WHEN r.action='reopen_bidding' THEN
  CASE WHEN r.rollback_mode='payment_setup_aborted' THEN 'bid_reopened' ELSE 'bid_rejected' END ELSE 'gig_cancelled' END;
 IF r.receipt->>'financialStatus'='fee_charged' THEN
  fee_line:=' Cancellation fee $'||to_char((r.receipt->>'feeCents')::integer/100.0,'FM9999999990.00')||' charged · $'
   ||to_char((r.receipt->>'releasedCents')::integer/100.0,'FM9999999990.00')||' released.';
 END IF;
 FOREACH recipient IN ARRAY r.notification_recipients LOOP
  event_id:=NULL;
  INSERT INTO public."GigStopDelivery"(request_id,user_id) VALUES(r.id,recipient) ON CONFLICT DO NOTHING RETURNING id INTO event_id;
  IF event_id IS NULL THEN CONTINUE; END IF;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,idempotency_key)
  VALUES(recipient,kind,CASE WHEN r.action IN ('cancel','close') THEN 'Task cancelled' ELSE 'Task bidding reopened' END,
   CASE WHEN r.action IN ('cancel','close') THEN 'This task was cancelled before work started.'
    ||CASE WHEN fee_line<>'' AND (recipient=(r.terms->>'workerId')::uuid OR recipient=(r.terms->>'ownerId')::uuid
     OR coalesce(public.paid_gig_actor_allowed((r.terms->>'ownerId')::uuid,recipient),false)) THEN fee_line ELSE '' END
   WHEN r.rollback_mode='payment_setup_aborted' THEN 'Payment setup was stopped. The accepted bid is pending again.'
   ELSE 'The assignment ended before work started. This task is open for new bids.' END,
   'ℹ️','/gigs/'||r.gig_id,jsonb_build_object('gig_id',r.gig_id,'stop_request_id',r.id),'gig-stop:'||r.id||':'||recipient) RETURNING * INTO n;
  UPDATE public."GigStopDelivery" SET notification_id=n.id,notification_snapshot=public.gig_expiry_note_snapshot(n) WHERE id=event_id;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.finish_gig_stop(p_request_id uuid,p_actor_id uuid,p_proof jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; r public."GigStopRequest"; g public."Gig"; p public."Payment"; refund public."PaymentRefundRequest"; final_receipt jsonb; recipients uuid[];
 fee_cents integer:=0; fee_charged boolean:=false;
BEGIN
 d:=public.check_gig_stop_current(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.state='completed' THEN RETURN d; END IF;
 SELECT * INTO g FROM jsonb_populate_record(NULL::public."Gig",d->'gig');
 SELECT * INTO p FROM jsonb_populate_record(NULL::public."Payment",nullif(d->'payment','null'::jsonb));
 IF r.financial_action='release' AND NOT public.gig_stop_release_proof(p,p_proof) THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 IF r.financial_action='fee' THEN
  fee_cents:=(r.terms->>'policyFeeCents')::integer;
  IF p.id IS NOT NULL AND public.gig_fee_capture_proof(p,fee_cents,p_proof) THEN fee_charged:=true;
  ELSIF p.id IS NULL OR NOT public.gig_stop_release_proof(p,p_proof) THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 END IF;
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
 IF fee_charged THEN
  p:=public.record_gig_fee_payment(p.id,'late_cancel',fee_cents,r.id,p_proof);
 ELSIF p.id IS NOT NULL AND r.financial_action='fee' THEN
  -- The hold expired or was released before capture: nothing is charged.
  UPDATE public."Payment" SET payment_status='canceled',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('gig_fee',jsonb_build_object(
   'version',1,'kind','late_cancel','state','not_charged','reason','HOLD_UNAVAILABLE','fee_cents',0,'released_cents',amount_total,
   'request_id',r.id,'recorded_at',clock_timestamp())),updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 ELSIF p.id IS NOT NULL AND r.financial_action IN ('release','none') THEN
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
   cancellation_zone=CASE WHEN r.terms->>'gigStatus'='assigned' THEN 1 ELSE 0 END,cancellation_fee=CASE WHEN fee_charged THEN fee_cents/100.0 ELSE 0 END,
   payment_status=coalesce(p.payment_status,'none'),updated_at=clock_timestamp() WHERE id=g.id RETURNING * INTO g;
 END IF;
 final_receipt:=jsonb_build_object('requestId',r.id,'gigId',g.id,'paymentId',r.payment_id,'ownerId',r.terms->'ownerId',
  'workerId',r.terms->'workerId','amountCents',r.terms->'amountCents','currency','usd','action',r.action,'gigStatus',g.status,
  'financialStatus',CASE WHEN fee_charged THEN 'fee_charged' WHEN r.financial_action IN ('release','fee') THEN 'released'
   WHEN r.financial_action='refund' THEN 'refunded' ELSE 'none' END)
  ||CASE WHEN r.financial_action='fee' THEN jsonb_build_object('feeStatus',CASE WHEN fee_charged THEN 'charged' ELSE 'not_charged' END,
   'feeCents',CASE WHEN fee_charged THEN fee_cents ELSE 0 END,
   'releasedCents',(r.terms->>'amountCents')::integer-CASE WHEN fee_charged THEN fee_cents ELSE 0 END)
   ||CASE WHEN fee_charged THEN '{}'::jsonb ELSE jsonb_build_object('feeReason','HOLD_UNAVAILABLE') END ELSE '{}'::jsonb END;
 UPDATE public."GigStopRequest" SET state='completed',completed_at=clock_timestamp(),receipt=final_receipt,
  provider_receipt=p_proof,notification_recipients=recipients,lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=r.id;
 PERFORM public.materialize_gig_stop_notices(r.id);
 PERFORM set_config('app.gig_stop_receipt','off',true);
 RETURN public.read_gig_stop_request(g.id,p_actor_id,r.id);
END $$;

-- A charged fee belongs to the worker by policy. Its payer cannot refund it
-- in the app; support and the existing dispute path remain available.
CREATE OR REPLACE FUNCTION public.reserve_payment_refund(p_payment_id uuid,p_request_key text,p_actor_id uuid,p_actor_mode text,
 p_amount integer,p_reason text,p_description text,p_expected jsonb,p_operation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r public."GigStopRequest"; d jsonb;
BEGIN
 IF p_actor_mode='payer' AND EXISTS(SELECT FROM public."Payment" WHERE id=p_payment_id AND metadata->'gig_fee'->>'state'='captured') THEN
  RETURN jsonb_build_object('error','SUPPORT_REQUIRED','reason','GIG_FEE'); END IF;
 SELECT * INTO r FROM public."GigStopRequest" WHERE payment_id=p_payment_id AND state<>'completed';
 IF FOUND THEN
  d:=public.check_gig_stop_current(r.id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
  IF r.id::text IS DISTINCT FROM p_request_key OR r.financial_action<>'refund' OR r.state<>'pending'
   OR p_actor_mode IS DISTINCT FROM 'policy' OR p_operation IS DISTINCT FROM 'refund' OR p_amount IS NOT NULL
   OR p_reason IS DISTINCT FROM 'requested_by_customer' OR p_description IS NOT NULL THEN
   RETURN jsonb_build_object('error','STOP_REQUEST_CHANGED'); END IF;
 END IF;
 RETURN public.reserve_payment_refund_before_stop_fence(p_payment_id,p_request_key,p_actor_id,p_actor_mode,p_amount,p_reason,p_description,p_expected,p_operation);
END $$;

-- Cancelled-task fee settlement. Mirrors settle_paid_gig_wallet_income: the same
-- Gig->Payment lock order, cooling-off, dispute (active or lost), refund and
-- exact-capture fences, one gig_income credit per payment ('gig_income:<id>'),
-- one PaymentWalletSettlement and the existing payout deliveries and notices.
CREATE FUNCTION public.settle_gig_fee_wallet_income(p_payment_id uuid,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE target_gig uuid; p public."Payment"; g public."Gig"; s public."PaymentWalletSettlement"; tx public."WalletTransaction";
 fee jsonb; fee_cents integer; net integer; recipient record; event_id uuid; note_id uuid;
BEGIN
 SELECT gig_id INTO target_gig FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF target_gig IS NOT NULL THEN PERFORM 1 FROM public."Gig" WHERE id=target_gig FOR UPDATE; END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.gig_id IS DISTINCT FROM target_gig OR public.refund_payment_snapshot(p) IS DISTINCT FROM p_expected THEN
  RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 SELECT * INTO s FROM public."PaymentWalletSettlement" WHERE payment_id=p.id FOR UPDATE;
 IF FOUND THEN
  IF s.frozen_payment IS DISTINCT FROM public.refund_payment_snapshot(p) THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
  IF s.wallet_transaction_id IS NOT NULL AND NOT EXISTS(SELECT FROM public."WalletTransaction" t JOIN public."Wallet" w ON w.id=t.wallet_id WHERE t.id=s.wallet_transaction_id
   AND t.payment_id=p.id AND t.user_id=p.payee_id AND t.counterparty_id=p.payer_id AND t.gig_id=p.gig_id
   AND t.amount=s.amount_cents AND t.direction='credit' AND t.type='gig_income' AND w.user_id=p.payee_id AND lower(w.currency)='usd') THEN
   RETURN jsonb_build_object('error','SETTLEMENT_PROOF_REQUIRED'); END IF;
  RETURN jsonb_build_object('payment',to_jsonb(p),'settlement',to_jsonb(s),'reused',true);
 END IF;
 fee:=p.metadata->'gig_fee';
 IF jsonb_typeof(fee) IS DISTINCT FROM 'object' OR fee->>'state' IS DISTINCT FROM 'captured'
  OR fee->>'kind' IS NULL OR fee->>'kind' NOT IN ('poster_no_show','late_cancel')
  OR jsonb_typeof(fee->'fee_cents') IS DISTINCT FROM 'number' OR jsonb_typeof(fee->'released_cents') IS DISTINCT FROM 'number' THEN
  RETURN jsonb_build_object('error','FEE_PROOF_REQUIRED'); END IF;
 fee_cents:=(fee->>'fee_cents')::integer;
 IF p.payment_type IS DISTINCT FROM 'gig_payment' OR p.gig_id IS NULL OR p.captured_at IS NULL
  OR p.stripe_charge_id IS NULL OR p.stripe_customer_id IS NULL OR p.stripe_payment_intent_id IS NULL
  OR lower(p.currency) IS DISTINCT FROM 'usd' OR p.amount_total<50 OR p.amount_to_payee<0 OR p.amount_to_payee>p.amount_total
  OR fee_cents<=0 OR fee_cents>=p.amount_total OR (fee->>'released_cents')::integer IS DISTINCT FROM p.amount_total-fee_cents
  OR fee->>'charge_id' IS DISTINCT FROM p.stripe_charge_id THEN
  RETURN jsonb_build_object('error','CAPTURE_PROOF_REQUIRED'); END IF;
 IF p.payment_status IS DISTINCT FROM 'captured_hold' OR (p.dispute_id IS NOT NULL AND p.dispute_status IS DISTINCT FROM 'won')
  OR p.stripe_transfer_id IS NOT NULL THEN RETURN jsonb_build_object('error','PAYMENT_STATE'); END IF;
 IF coalesce(p.cooling_off_ends_at,p.captured_at+interval '48 hours')>clock_timestamp() THEN RETURN jsonb_build_object('error','COOLING_OFF'); END IF;
 IF EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
  OR EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status IN ('pending','requires_action')) THEN
  RETURN jsonb_build_object('error','REFUND_ACTIVE'); END IF;
 IF coalesce(p.refunded_amount,0)<>0 OR EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status='succeeded') THEN
  RETURN jsonb_build_object('error','REFUND_PROOF_REQUIRED'); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id;
 IF g.id IS NULL OR g.payment_id IS DISTINCT FROM p.id OR g.user_id IS DISTINCT FROM p.payer_id OR g.accepted_by IS DISTINCT FROM p.payee_id
  OR g.status IS DISTINCT FROM 'cancelled' OR g.started_at IS NOT NULL OR round(g.price*100)::bigint IS DISTINCT FROM p.amount_total
  OR round(coalesce(g.cancellation_fee,0)*100)::integer IS DISTINCT FROM fee_cents THEN
  RETURN jsonb_build_object('error','GIG_TERMS_CHANGED'); END IF;
 IF p.transfer_status='wallet_credited' OR EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p.id
  AND type IN ('gig_income','tip_income') AND direction='credit') THEN RETURN jsonb_build_object('error','SETTLEMENT_PROOF_REQUIRED'); END IF;
 -- The worker share of a fee uses the same proportional split as a task payment.
 net:=floor(fee_cents::numeric*p.amount_to_payee/p.amount_total);
 IF net>0 THEN
  tx:=public.wallet_credit_before_refund_fence(p.payee_id,net,'gig_income',
   CASE WHEN fee->>'kind'='poster_no_show' THEN 'Income from no-show fee' ELSE 'Income from cancellation fee' END,
   p.id,p.gig_id,p.payer_id,NULL,('gig_income:'||p.id)::varchar,
   jsonb_build_object('verified_wallet_settlement',true,'refund_basis_cents',0,'gig_fee_cents',fee_cents,'gig_fee_kind',fee->>'kind'));
  IF tx.payment_id IS DISTINCT FROM p.id OR tx.user_id IS DISTINCT FROM p.payee_id OR tx.counterparty_id IS DISTINCT FROM p.payer_id
   OR tx.gig_id IS DISTINCT FROM p.gig_id OR tx.amount IS DISTINCT FROM net OR tx.direction<>'credit' OR tx.type<>'gig_income'
   OR NOT EXISTS(SELECT FROM public."Wallet" WHERE id=tx.wallet_id AND user_id=p.payee_id AND lower(currency)='usd') THEN
   RAISE EXCEPTION 'Wallet settlement receipt mismatch' USING ERRCODE='40001'; END IF;
 END IF;
 INSERT INTO public."PaymentWalletSettlement"(payment_id,wallet_transaction_id,frozen_payment,amount_cents,refund_basis_cents,currency,status)
 VALUES(p.id,tx.id,public.refund_payment_snapshot(p),net,0,'usd',CASE WHEN net>0 THEN 'credited' ELSE 'no_earnings' END) RETURNING * INTO s;
 IF net>0 THEN
  FOR recipient IN SELECT p.payee_id AS user_id,'payout_sent'::text AS kind
    UNION ALL SELECT p.payer_id,'payment_completed' LOOP
   INSERT INTO public."PaymentWalletDelivery"(settlement_id,user_id,kind)
    VALUES(s.id,recipient.user_id,recipient.kind) RETURNING id INTO event_id;
   INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,idempotency_key)
    VALUES(recipient.user_id,recipient.kind,
     CASE WHEN recipient.kind='payout_sent' THEN '$'||to_char(net/100.0,'FM9999999990.00')||' credited to your wallet'
      ELSE 'Worker earnings credited' END,
     CASE WHEN recipient.kind='payout_sent' THEN 'Your gig earnings were credited to your Pantopus wallet. Open your wallet for its current balance and withdrawal options.'
      ELSE '$'||to_char(net/100.0,'FM9999999990.00')||' was credited to the worker’s Pantopus wallet. This is the worker share after applicable fees and refunds.' END,
     CASE WHEN recipient.kind='payout_sent' THEN '💰' ELSE '✅' END,
     CASE WHEN recipient.kind='payout_sent' THEN '/app/wallet' ELSE '/gigs/'||p.gig_id END,
     jsonb_build_object('gig_id',p.gig_id,'payment_id',p.id,'wallet_settlement_id',s.id,
      'amount',net,'amount_cents',net,'currency','usd'),
     'wallet-settlement:'||s.id||':'||recipient.kind) RETURNING id INTO note_id;
   UPDATE public."PaymentWalletDelivery" SET notification_id=note_id WHERE id=event_id;
  END LOOP;
 END IF;
 UPDATE public."Payment" SET payment_status='transferred',transfer_status=CASE WHEN net>0 THEN 'wallet_credited' ELSE transfer_status END,
  transfer_completed_at=coalesce(transfer_completed_at,clock_timestamp()),updated_at=clock_timestamp()
 WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=p.gig_id AND payment_id=p.id;
 RETURN jsonb_build_object('payment',to_jsonb(p),'settlement',to_jsonb(s),'reused',false);
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND p.proname IN ('gig_fee_capture_proof','prepare_gig_fee_capture','record_gig_fee_capture','settle_gig_fee_wallet_income',
  'read_gig_stop_preview','record_gig_stop_evidence','materialize_gig_stop_notices','finish_gig_stop','reserve_payment_refund') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
-- Only the definer transactions above may write a fee capture receipt.
REVOKE ALL ON FUNCTION public.record_gig_fee_payment(uuid,text,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
