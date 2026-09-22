-- Backwards compatible: yes. Existing rows and financial identities are retained.
-- Matching HTTP clients must send the new opening proof; unsafe legacy stop
-- commands intentionally fail before provider access. No provider calls in SQL.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."GigStopRequest" (
 id uuid PRIMARY KEY, gig_id uuid NOT NULL REFERENCES public."Gig"(id) ON DELETE RESTRICT,
 payment_id uuid REFERENCES public."Payment"(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 original_session_scope text NOT NULL CHECK(original_session_scope ~ '^[a-f0-9]{64}$'),
 action text NOT NULL CHECK(action IN ('cancel','reopen_bidding','worker_release','close')),
 reason text, rollback_mode text CHECK(rollback_mode='payment_setup_aborted'),
 terms jsonb NOT NULL, payment_snapshot jsonb,
 financial_action text NOT NULL CHECK(financial_action IN ('none','release','refund')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','needs_review','completed')),
 provider_receipt jsonb, receipt jsonb, notification_recipients uuid[], lease_id uuid, lease_until timestamptz,
 provider_started_at timestamptz, last_checked_at timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE UNIQUE INDEX gig_stop_request_active ON public."GigStopRequest"(gig_id) WHERE state<>'completed';
CREATE INDEX gig_stop_request_payment ON public."GigStopRequest"(payment_id);
CREATE INDEX gig_stop_request_due ON public."GigStopRequest"((coalesce(last_checked_at,created_at)),id) WHERE state='pending';
ALTER TABLE public."GigStopRequest" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."GigStopRequest" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."GigStopRequest" TO service_role;
CREATE TABLE public."GigStopDelivery" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES public."GigStopRequest"(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT, notification_id uuid REFERENCES public."Notification"(id) ON DELETE SET NULL,
 notification_snapshot jsonb, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','done','suppressed')),
 lease_id uuid,lease_until timestamptz,retry_at timestamptz NOT NULL DEFAULT now(),attempts integer NOT NULL DEFAULT 0,
 last_error text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz,UNIQUE(request_id,user_id)
);
ALTER TABLE public."GigStopDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."GigStopDelivery" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."GigStopDelivery" TO service_role;
CREATE INDEX gig_stop_delivery_due ON public."GigStopDelivery"(retry_at,created_at,id) WHERE state='pending';
CREATE INDEX gig_stop_delivery_lease ON public."GigStopDelivery"(lease_until,created_at,id) WHERE state='processing';

CREATE FUNCTION public.gig_stop_owner_allowed(p_owner uuid,p_actor uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 RETURN public.paid_gig_actor_allowed(p_owner,p_actor);
END $$;
CREATE FUNCTION public.gig_stop_actor_allowed(g public."Gig",p_actor uuid,p_action text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN p_action='worker_release' THEN coalesce(g.accepted_by=p_actor,false)
 WHEN p_action='cancel' THEN coalesce(g.accepted_by=p_actor,false) OR public.gig_stop_owner_allowed(g.user_id,p_actor)
 WHEN p_action IN ('close','reopen_bidding') THEN public.gig_stop_owner_allowed(g.user_id,p_actor) ELSE false END
$$;
CREATE FUNCTION public.gig_stop_terms(g public."Gig",p_action text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path=public,pg_temp AS $$
DECLARE policy text:=coalesce(g.cancellation_policy,'standard'); fee integer:=0; bid uuid;
BEGIN
 SELECT id INTO bid FROM public."GigBid" WHERE gig_id=g.id AND status='accepted' ORDER BY id LIMIT 1;
 IF p_action='cancel' AND g.status='assigned' AND policy<>'flexible' AND g.accepted_at IS NOT NULL
 AND g.accepted_at<=clock_timestamp()-(CASE WHEN policy='strict' THEN interval '10 minutes' ELSE interval '1 hour' END) THEN
  fee:=round(g.price*CASE WHEN policy='strict' THEN 10 ELSE 5 END)::integer;
 END IF;
 RETURN jsonb_build_object('gigId',g.id,'ownerId',g.user_id,'workerId',g.accepted_by,'paymentId',g.payment_id,
 'amountCents',round(g.price*100)::bigint,'currency','usd','gigStatus',g.status,'acceptedAt',g.accepted_at,
 'acceptedBidId',bid,'policy',policy,'policyFeeCents',fee);
END $$;
CREATE FUNCTION public.gig_stop_payment_snapshot(p public."Payment") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT public.gig_expiry_payment_snapshot(p)||jsonb_build_object('charge_id',p.stripe_charge_id,'transfer_id',p.stripe_transfer_id,
  'transfer_status',p.transfer_status,'escrow_released_at',p.escrow_released_at,'escrow_released_by',p.escrow_released_by,
  'transfer_completed_at',p.transfer_completed_at,'transfer_reversal_id',p.stripe_transfer_reversal_id)
$$;
CREATE FUNCTION public.read_gig_stop_preview(p_gig_id uuid,p_actor_id uuid,p_action text) RETURNS jsonb
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
 ELSIF (t->>'policyFeeCents')::integer<>0 THEN reason:='FEE_POLICY_REVIEW';
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
  ELSIF p.stripe_payment_intent_id IS NOT NULL THEN financial:='release';
  ELSIF p.payment_status IS DISTINCT FROM 'ready_to_authorize' OR p.payment_attempted_at IS NOT NULL
   OR EXISTS(SELECT FROM public."GigLegacyAuthorization" WHERE payment_id=p.id AND (requested_at IS NOT NULL OR intent_id IS NOT NULL))
   THEN reason:='PROVIDER_OUTCOME_UNKNOWN';
  END IF;
 END IF;
 RETURN jsonb_build_object('gig',to_jsonb(g),'payment',CASE WHEN p.id IS NULL THEN NULL ELSE to_jsonb(p) END,
 'terms',t,'eligible',reason IS NULL,'unavailableReason',reason,'financialAction',financial,'activeRequestId',active);
END $$;
CREATE FUNCTION public.read_gig_stop_request(p_gig_id uuid,p_actor_id uuid,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"; p public."Payment"; r public."GigStopRequest"; allowed boolean;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id AND gig_id=g.id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 allowed:=public.gig_stop_owner_allowed(g.user_id,p_actor_id) OR p_actor_id=(r.terms->>'workerId')::uuid;
 IF NOT coalesce(allowed,false) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=r.payment_id FOR UPDATE;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id FOR UPDATE;
 RETURN jsonb_build_object('request',to_jsonb(r),'gig',to_jsonb(g),'payment',CASE WHEN p.id IS NULL THEN NULL ELSE to_jsonb(p) END,
 'canRetry',r.actor_id=p_actor_id AND r.state='pending' AND public.gig_stop_actor_allowed(g,p_actor_id,r.action)
  AND (p.id IS NULL OR (p.dispute_id IS NULL AND p.payment_status<>'disputed')));
END $$;
CREATE FUNCTION public.begin_gig_stop(p_gig_id uuid,p_actor_id uuid,p_session_scope text,p_request_id uuid,p_action text,
 p_expected jsonb,p_reason text DEFAULT NULL,p_rollback_mode text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; r public."GigStopRequest"; g public."Gig"; p public."Payment";
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id;
 IF FOUND THEN
  IF r.gig_id<>g.id OR r.actor_id<>p_actor_id OR r.action IS DISTINCT FROM p_action OR r.terms IS DISTINCT FROM p_expected
   OR r.reason IS DISTINCT FROM p_reason OR r.rollback_mode IS DISTINCT FROM p_rollback_mode THEN RETURN jsonb_build_object('error','REQUEST_CONFLICT'); END IF;
  RETURN public.read_gig_stop_request(g.id,p_actor_id,r.id);
 END IF;
 IF p_session_scope IS NULL OR p_session_scope !~ '^[a-f0-9]{64}$' OR p_request_id IS NULL
  OR (p_rollback_mode IS NOT NULL AND (p_action<>'reopen_bidding' OR p_rollback_mode<>'payment_setup_aborted')) THEN RETURN jsonb_build_object('error','INVALID_TERMS'); END IF;
 d:=public.read_gig_stop_preview(g.id,p_actor_id,p_action);
 IF d ? 'error' THEN RETURN d; END IF;
 IF d->>'eligible'<>'true' THEN RETURN jsonb_build_object('error',d->>'unavailableReason','requestId',d->'activeRequestId'); END IF;
 -- Fresh clock after lock waits prevents crossing the grace boundary unnoticed.
 IF d->'terms' IS DISTINCT FROM p_expected THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 SELECT * INTO p FROM jsonb_populate_record(NULL::public."Payment",nullif(d->'payment','null'::jsonb));
 INSERT INTO public."GigStopRequest"(id,gig_id,payment_id,actor_id,original_session_scope,action,reason,rollback_mode,terms,payment_snapshot,financial_action)
 VALUES(p_request_id,g.id,p.id,p_actor_id,p_session_scope,p_action,p_reason,p_rollback_mode,p_expected,
 CASE WHEN p.id IS NULL THEN NULL ELSE public.gig_stop_payment_snapshot(p) END,d->>'financialAction') RETURNING * INTO r;
 -- Provider history must be reconciled before the effective remaining refund
 -- amount is frozen. The stop barrier already owns this exact request ID.
 RETURN public.read_gig_stop_request(g.id,p_actor_id,r.id);
END $$;

CREATE FUNCTION public.check_gig_stop_current(p_request_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; r public."GigStopRequest"; p public."Payment"; g public."Gig"; current_terms jsonb;
BEGIN
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 d:=public.read_gig_stop_request(r.gig_id,p_actor_id,r.id);
 IF d ? 'error' THEN RETURN d; END IF;
 SELECT * INTO r FROM jsonb_populate_record(NULL::public."GigStopRequest",d->'request');
 SELECT * INTO g FROM jsonb_populate_record(NULL::public."Gig",d->'gig');
 SELECT * INTO p FROM jsonb_populate_record(NULL::public."Payment",nullif(d->'payment','null'::jsonb));
 IF r.actor_id IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF r.state='completed' THEN RETURN d; END IF;
 IF NOT public.gig_stop_actor_allowed(g,p_actor_id,r.action) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 current_terms:=public.gig_stop_terms(g,r.action);
 -- The accepted zero-fee policy is frozen at reservation, not recalculated on retry.
 current_terms:=jsonb_set(current_terms,'{policyFeeCents}',r.terms->'policyFeeCents');
 IF current_terms IS DISTINCT FROM r.terms OR g.started_at IS NOT NULL OR g.worker_completed_at IS NOT NULL OR g.owner_confirmed_at IS NOT NULL
  OR (p.id IS NOT NULL AND public.gig_stop_payment_snapshot(p) IS DISTINCT FROM r.payment_snapshot) THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 IF p.dispute_id IS NOT NULL OR p.payment_status='disputed' THEN RETURN jsonb_build_object('error','DISPUTED'); END IF;
 IF EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income')) THEN
  RETURN jsonb_build_object('error','PAYMENT_REVIEW'); END IF;
 RETURN d;
END $$;
CREATE FUNCTION public.claim_gig_stop(p_request_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; r public."GigStopRequest";
BEGIN
 d:=public.check_gig_stop_current(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.state='completed' THEN RETURN d; END IF;
 IF r.state<>'pending' THEN RETURN jsonb_build_object('error','NEEDS_REVIEW'); END IF;
 IF r.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('error','BUSY'); END IF;
 UPDATE public."GigStopRequest" SET lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '1 minute',
 provider_started_at=coalesce(provider_started_at,clock_timestamp()) WHERE id=r.id RETURNING * INTO r;
 RETURN jsonb_set(d,'{request}',to_jsonb(r));
END $$;
CREATE FUNCTION public.release_gig_stop_lease(p_request_id uuid,p_lease_id uuid,p_error text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH changed AS (UPDATE public."GigStopRequest" SET lease_id=NULL,lease_until=NULL,last_error=left(p_error,100)
 WHERE id=p_request_id AND lease_id=p_lease_id AND state='pending' RETURNING 1) SELECT EXISTS(SELECT FROM changed)
$$;

CREATE FUNCTION public.gig_stop_release_proof(p public."Payment",v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce(v->>'id'=p.stripe_payment_intent_id AND v->>'status'='canceled' AND v->>'customer'=p.stripe_customer_id
 AND v->'amount'=to_jsonb(p.amount_total) AND v->>'currency'='usd' AND v->>'capture_method'='manual'
 AND v->>'payer_id'=p.payer_id::text AND v->>'payee_id'=p.payee_id::text AND v->>'gig_id'=p.gig_id::text
 AND (v->>'acceptance_attempt_id') IS NOT DISTINCT FROM (p.metadata->>'acceptance_attempt_id')
 AND v->'amount_received'='0'::jsonb AND v->'amount_capturable'='0'::jsonb
 AND ((v->'charge_id'='null'::jsonb AND v->'amount_captured'='0'::jsonb)
  OR (v->>'charge_id' ~ '^ch_[a-zA-Z0-9]+$' AND v->'amount_captured'='0'::jsonb AND v->'charge_captured'='false'::jsonb
    AND ((v->'charge_refunded'='false'::jsonb AND v->'charge_amount_refunded'='0'::jsonb)
      OR (v->'charge_refunded'='true'::jsonb AND v->'charge_amount_refunded'=to_jsonb(p.amount_total))))),false)
$$;
-- Financial evidence remains recordable if authority/dispute changes during
-- the provider call. This does not authorize a task mutation or another call.
CREATE FUNCTION public.record_gig_stop_evidence(p_request_id uuid,p_proof jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r public."GigStopRequest"; p public."Payment";
BEGIN
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM 1 FROM public."Gig" WHERE id=r.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=r.payment_id FOR UPDATE;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.financial_action<>'release' OR public.gig_stop_payment_snapshot(p) IS DISTINCT FROM r.payment_snapshot
  OR NOT public.gig_stop_release_proof(p,p_proof) THEN RETURN false; END IF;
 UPDATE public."GigStopRequest" SET provider_receipt=p_proof WHERE id=r.id;
 RETURN true;
END $$;
CREATE FUNCTION public.materialize_gig_stop_notices(p_request_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public."GigStopRequest"; recipient uuid; event_id uuid; n public."Notification"; kind text;
BEGIN
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.state IS DISTINCT FROM 'completed' OR r.receipt IS NULL THEN RAISE EXCEPTION 'Completed stop receipt required' USING ERRCODE='23514'; END IF;
 kind:=CASE WHEN r.action='worker_release' THEN 'worker_cant_make_it' WHEN r.action='reopen_bidding' THEN
  CASE WHEN r.rollback_mode='payment_setup_aborted' THEN 'bid_reopened' ELSE 'bid_rejected' END ELSE 'gig_cancelled' END;
 FOREACH recipient IN ARRAY r.notification_recipients LOOP
  event_id:=NULL;
  INSERT INTO public."GigStopDelivery"(request_id,user_id) VALUES(r.id,recipient) ON CONFLICT DO NOTHING RETURNING id INTO event_id;
  IF event_id IS NULL THEN CONTINUE; END IF;
  INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,idempotency_key)
  VALUES(recipient,kind,CASE WHEN r.action IN ('cancel','close') THEN 'Task cancelled' ELSE 'Task bidding reopened' END,
   CASE WHEN r.action IN ('cancel','close') THEN 'This task was cancelled before work started.'
   WHEN r.rollback_mode='payment_setup_aborted' THEN 'Payment setup was stopped. The accepted bid is pending again.'
   ELSE 'The assignment ended before work started. This task is open for new bids.' END,
   'ℹ️','/gigs/'||r.gig_id,jsonb_build_object('gig_id',r.gig_id,'stop_request_id',r.id),'gig-stop:'||r.id||':'||recipient) RETURNING * INTO n;
  UPDATE public."GigStopDelivery" SET notification_id=n.id,notification_snapshot=public.gig_expiry_note_snapshot(n) WHERE id=event_id;
 END LOOP;
END $$;
CREATE FUNCTION public.finish_gig_stop(p_request_id uuid,p_actor_id uuid,p_proof jsonb DEFAULT NULL) RETURNS jsonb
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
  UPDATE public."Gig" SET status='cancelled',cancelled_at=clock_timestamp(),cancelled_by=r.actor_id,cancellation_reason=r.reason,
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

CREATE FUNCTION public.claim_gig_stop_delivery() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d public."GigStopDelivery";
BEGIN
 SELECT * INTO d FROM public."GigStopDelivery" WHERE (state='pending' AND retry_at<=clock_timestamp()) OR (state='processing' AND lease_until<=clock_timestamp())
 ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public."GigStopDelivery" SET state='processing',lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1 WHERE id=d.id RETURNING * INTO d;
 RETURN to_jsonb(d);
END $$;
CREATE FUNCTION public.claim_gig_stop_reconciliation(p_limit integer DEFAULT 100) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 WITH due AS (SELECT id FROM public."GigStopRequest" WHERE state='pending'
  AND (last_checked_at IS NULL OR last_checked_at<=clock_timestamp()-interval '5 minutes')
  ORDER BY coalesce(last_checked_at,created_at),id LIMIT least(greatest(coalesce(p_limit,100),1),100) FOR UPDATE SKIP LOCKED),
 checked AS (UPDATE public."GigStopRequest" r SET last_checked_at=clock_timestamp() FROM due WHERE r.id=due.id RETURNING r.id,r.gig_id,r.actor_id)
 SELECT coalesce(jsonb_agg(to_jsonb(checked)),'[]'::jsonb) INTO result FROM checked;
 RETURN result;
END $$;
CREATE FUNCTION public.read_gig_stop_delivery(p_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d public."GigStopDelivery"; r public."GigStopRequest"; g public."Gig"; n public."Notification"; eligible boolean;
BEGIN
 SELECT * INTO d FROM public."GigStopDelivery" WHERE id=p_id AND lease_id=p_lease_id AND state='processing' AND lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 SELECT * INTO r FROM public."GigStopRequest" WHERE id=d.request_id;
 SELECT * INTO g FROM public."Gig" WHERE id=r.gig_id;
 SELECT * INTO n FROM public."Notification" WHERE id=d.notification_id;
 eligible:=r.state='completed' AND r.receipt IS NOT NULL AND n.id IS NOT NULL AND n.user_id=d.user_id
  AND public.gig_expiry_note_snapshot(n)=d.notification_snapshot AND g.user_id=(r.terms->>'ownerId')::uuid
  AND g.status=r.receipt->>'gigStatus' AND g.started_at IS NULL
  AND ((g.status='open' AND g.accepted_by IS NULL AND g.payment_id IS NULL) OR (g.status='cancelled' AND g.cancelled_by=r.actor_id))
  AND (d.user_id IN ((r.terms->>'ownerId')::uuid,(r.terms->>'workerId')::uuid)
   OR EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND user_id=d.user_id)
   OR public.paid_gig_actor_allowed(g.user_id,d.user_id));
 RETURN jsonb_build_object('eligible',coalesce(eligible,false),'notification',CASE WHEN eligible THEN to_jsonb(n) ELSE NULL END);
END $$;
CREATE FUNCTION public.finish_gig_stop_delivery(p_id uuid,p_lease_id uuid,p_outcome text,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('done','suppressed','retry') THEN RETURN false; END IF;
 UPDATE public."GigStopDelivery" SET state=CASE WHEN p_outcome='retry' THEN 'pending' ELSE p_outcome END,
 retry_at=clock_timestamp()+make_interval(secs=>least(3600,30*least(greatest(attempts,1),120))),lease_id=NULL,lease_until=NULL,last_error=left(p_error,100),
 completed_at=CASE WHEN p_outcome='retry' THEN NULL ELSE clock_timestamp() END
 WHERE id=p_id AND lease_id=p_lease_id AND state='processing' AND lease_until>clock_timestamp();
 RETURN FOUND;
END $$;
CREATE FUNCTION public.guard_gig_stop_gig() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_setting('app.gig_stop_receipt',true) IS DISTINCT FROM 'on' AND EXISTS(SELECT FROM public."GigStopRequest" WHERE gig_id=OLD.id AND state<>'completed')
 AND (TG_OP='DELETE' OR ROW(NEW.user_id,NEW.accepted_by,NEW.price,NEW.payment_id,NEW.status,NEW.started_at,NEW.accepted_at,NEW.cancellation_policy,NEW.worker_completed_at,NEW.owner_confirmed_at)
 IS DISTINCT FROM ROW(OLD.user_id,OLD.accepted_by,OLD.price,OLD.payment_id,OLD.status,OLD.started_at,OLD.accepted_at,OLD.cancellation_policy,OLD.worker_completed_at,OLD.owner_confirmed_at)) THEN
 RAISE EXCEPTION 'The saved stop request must finish first' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_stop_gig BEFORE UPDATE OR DELETE ON public."Gig" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_stop_gig();
CREATE FUNCTION public.guard_gig_stop_bid() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig";
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO g FROM public."Gig" WHERE id=NEW.gig_id FOR SHARE;
  IF current_setting('app.gig_stop_receipt',true) IS DISTINCT FROM 'on' AND
   (EXISTS(SELECT FROM public."GigStopRequest" WHERE gig_id=NEW.gig_id AND state<>'completed')
    OR (g.status='cancelled' AND EXISTS(SELECT FROM public."GigStopRequest" WHERE gig_id=NEW.gig_id AND state='completed')))
   THEN RAISE EXCEPTION 'The saved stop request closed bid admission' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF current_setting('app.gig_stop_receipt',true) IS DISTINCT FROM 'on' AND EXISTS(SELECT FROM public."GigStopRequest"
  WHERE gig_id=OLD.gig_id AND state<>'completed' AND (terms->>'acceptedBidId')::uuid=OLD.id)
 AND (TG_OP='DELETE' OR ROW(NEW.gig_id,NEW.user_id,NEW.status,NEW.bid_amount) IS DISTINCT FROM ROW(OLD.gig_id,OLD.user_id,OLD.status,OLD.bid_amount)) THEN
 RAISE EXCEPTION 'The saved stop request must finish first' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_stop_bid BEFORE INSERT OR UPDATE OR DELETE ON public."GigBid" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_stop_bid();
CREATE FUNCTION public.guard_gig_stop_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public."GigStopRequest";
BEGIN
 SELECT * INTO r FROM public."GigStopRequest" WHERE payment_id=OLD.id AND state<>'completed';
 IF FOUND AND current_setting('app.gig_stop_receipt',true) IS DISTINCT FROM 'on' AND
 (public.gig_stop_payment_snapshot(NEW) IS DISTINCT FROM public.gig_stop_payment_snapshot(OLD)
 OR NEW.captured_at IS DISTINCT FROM OLD.captured_at OR NEW.capture_attempts IS DISTINCT FROM OLD.capture_attempts
 OR (NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status IS DISTINCT FROM 'disputed'
  AND NOT (r.financial_action='refund' AND NEW.payment_status IN ('refund_pending','refunded_partial','refunded_full','captured_hold')))
 OR (NEW.refunded_amount IS DISTINCT FROM OLD.refunded_amount AND r.financial_action<>'refund')) THEN
 RAISE EXCEPTION 'The saved stop request must finish first' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_stop_payment BEFORE UPDATE ON public."Payment" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_stop_payment();
CREATE FUNCTION public.guard_gig_stop_authorization() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM public."Payment" WHERE id=NEW.payment_id FOR SHARE;
 IF EXISTS(SELECT FROM public."GigStopRequest" WHERE payment_id=NEW.payment_id AND state<>'completed') THEN
 RAISE EXCEPTION 'The saved stop request must finish first' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_stop_authorization BEFORE INSERT OR UPDATE ON public."GigLegacyAuthorization" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_stop_authorization();
CREATE TRIGGER guard_gig_stop_expiry BEFORE INSERT OR UPDATE ON public."GigAuthorizationExpiry" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_stop_authorization();
CREATE FUNCTION public.guard_gig_stop_acceptance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 PERFORM 1 FROM public."Gig" WHERE id=NEW.gig_id FOR SHARE;
 IF EXISTS(SELECT FROM public."GigStopRequest" WHERE gig_id=NEW.gig_id AND state<>'completed')
 AND (TG_OP='INSERT' OR ROW(NEW.state,NEW.payment_id,NEW.payer_id,NEW.payee_id,NEW.amount,NEW.bid_id,NEW.gig_id)
  IS DISTINCT FROM ROW(OLD.state,OLD.payment_id,OLD.payer_id,OLD.payee_id,OLD.amount,OLD.bid_id,OLD.gig_id)) THEN
 RAISE EXCEPTION 'The saved stop request must finish before checkout' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_stop_acceptance BEFORE INSERT OR UPDATE ON public."GigPaymentAcceptance" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_stop_acceptance();
-- Preserve the settlement/outbox transaction while admitting it in the same
-- Gig→Payment order as stop reservation. A stale settlement on an assigned
-- task must reach its existing denial without holding Payment against a stop
-- that already owns Gig. Recheck the unlocked lookup after both locks.
ALTER FUNCTION public.settle_paid_gig_wallet_income(uuid,jsonb) RENAME TO settle_paid_gig_wallet_income_before_stop_fence;
CREATE FUNCTION public.settle_paid_gig_wallet_income(p_payment_id uuid,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE target_gig uuid; p public."Payment";
BEGIN
 SELECT gig_id INTO target_gig FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF target_gig IS NOT NULL THEN PERFORM 1 FROM public."Gig" WHERE id=target_gig FOR UPDATE; END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.gig_id IS DISTINCT FROM target_gig THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 RETURN public.settle_paid_gig_wallet_income_before_stop_fence(p_payment_id,p_expected);
END $$;
-- The legacy public credit wrapper and protected residual settlement both call
-- this primitive. Lock Payment before the primitive can lock/create Wallet;
-- a ledger insert trigger would invert that order for its direct callers.
-- Existing income receipts remain readable, but no new income may slip between
-- stop reservation and provider-history discovery/refund reservation.
ALTER FUNCTION public.wallet_credit_before_refund_fence(uuid,bigint,character varying,text,uuid,uuid,uuid,character varying,character varying,jsonb)
 RENAME TO wallet_credit_before_gig_stop;
CREATE FUNCTION public.wallet_credit_before_refund_fence(p_user_id uuid,p_amount bigint,p_type character varying,p_description text DEFAULT NULL,
 p_payment_id uuid DEFAULT NULL,p_gig_id uuid DEFAULT NULL,p_counterparty_id uuid DEFAULT NULL,
 p_stripe_pi_id character varying DEFAULT NULL,p_idempotency_key character varying DEFAULT NULL,p_metadata jsonb DEFAULT '{}')
RETURNS public."WalletTransaction" LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE tx public."WalletTransaction";
BEGIN
 IF p_type IN ('gig_income','tip_income') AND p_payment_id IS NOT NULL THEN
  PERFORM 1 FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
  IF EXISTS(SELECT FROM public."GigStopRequest" WHERE payment_id=p_payment_id AND state<>'completed') THEN
   SELECT * INTO tx FROM public."WalletTransaction" WHERE idempotency_key=p_idempotency_key
    AND payment_id=p_payment_id AND user_id=p_user_id AND amount=p_amount AND type=p_type AND direction='credit'
    AND gig_id IS NOT DISTINCT FROM p_gig_id AND counterparty_id IS NOT DISTINCT FROM p_counterparty_id;
   IF FOUND THEN RETURN tx; END IF;
   RAISE EXCEPTION 'The saved stop request must finish before wallet income' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN public.wallet_credit_before_gig_stop(p_user_id,p_amount,p_type,p_description,p_payment_id,p_gig_id,p_counterparty_id,
  p_stripe_pi_id,p_idempotency_key,p_metadata);
END $$;
CREATE FUNCTION public.guard_gig_stop_refund() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public."GigStopRequest";
BEGIN
 SELECT * INTO r FROM public."GigStopRequest" WHERE payment_id=NEW.payment_id AND state<>'completed';
 IF FOUND AND (r.id<>NEW.id OR r.actor_id IS DISTINCT FROM NEW.actor_id OR r.financial_action<>'refund'
  OR NEW.actor_mode<>'policy' OR NEW.operation<>'refund' OR NEW.requested_amount IS NOT NULL OR NEW.reason<>'requested_by_customer') THEN
 RAISE EXCEPTION 'A different refund cannot replace the saved stop request' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_gig_stop_refund BEFORE INSERT OR UPDATE ON public."PaymentRefundRequest" FOR EACH ROW EXECUTE FUNCTION public.guard_gig_stop_refund();
ALTER FUNCTION public.reserve_payment_refund(uuid,text,uuid,text,integer,text,text,jsonb,text) RENAME TO reserve_payment_refund_before_stop_fence;
CREATE FUNCTION public.reserve_payment_refund(p_payment_id uuid,p_request_key text,p_actor_id uuid,p_actor_mode text,
 p_amount integer,p_reason text,p_description text,p_expected jsonb,p_operation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE r public."GigStopRequest"; d jsonb;
BEGIN
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
-- Existing webhooks/reconciliation still record financial truth. Stop-linked
-- receipt updates share Gig→Payment lock order without changing proof semantics.
ALTER FUNCTION public.record_payment_refund_receipts(uuid,jsonb,jsonb) RENAME TO record_payment_refund_receipts_before_stop_fence;
CREATE FUNCTION public.record_payment_refund_receipts(p_payment_id uuid,p_expected jsonb,p_receipts jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE target_gig uuid;
BEGIN
 SELECT gig_id INTO target_gig FROM public."GigStopRequest" WHERE payment_id=p_payment_id AND state<>'completed';
 IF FOUND THEN PERFORM 1 FROM public."Gig" WHERE id=target_gig FOR UPDATE; END IF;
 RETURN public.record_payment_refund_receipts_before_stop_fence(p_payment_id,p_expected,p_receipts);
END $$;
ALTER FUNCTION public.claim_payment_refund(uuid,uuid,text,uuid) RENAME TO claim_payment_refund_before_stop_fence;
CREATE FUNCTION public.claim_payment_refund(p_request_id uuid,p_actor_id uuid,p_actor_mode text,p_lease_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; refund public."PaymentRefundRequest";
BEGIN
 IF EXISTS(SELECT FROM public."GigStopRequest" WHERE id=p_request_id) THEN
  d:=public.check_gig_stop_current(p_request_id,p_actor_id);
  IF d ? 'error' THEN RETURN d; END IF;
  IF d->'request'->>'state'<>'pending' OR p_actor_mode<>'policy' THEN RETURN jsonb_build_object('error','NEEDS_REVIEW'); END IF;
  SELECT * INTO refund FROM public."PaymentRefundRequest" WHERE id=p_request_id FOR UPDATE;
  IF refund.provider_refund_id IS NULL AND refund.amount_cents>(d->'payment'->>'amount_total')::integer-coalesce((d->'payment'->>'refunded_amount')::integer,0) THEN
   UPDATE public."GigStopRequest" SET state='needs_review',last_error='REMAINING_AMOUNT_CHANGED' WHERE id=p_request_id;
   RETURN jsonb_build_object('error','REMAINING_AMOUNT_CHANGED'); END IF;
 END IF;
 RETURN public.claim_payment_refund_before_stop_fence(p_request_id,p_actor_id,p_actor_mode,p_lease_token);
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND (p.proname LIKE '%gig_stop%' OR p.proname IN ('claim_payment_refund','claim_payment_refund_before_stop_fence',
 'reserve_payment_refund','reserve_payment_refund_before_stop_fence','record_payment_refund_receipts','record_payment_refund_receipts_before_stop_fence',
 'wallet_credit_before_refund_fence','settle_paid_gig_wallet_income','settle_paid_gig_wallet_income_before_stop_fence')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
-- Only the definer wrapper may enter the preserved unfenced implementation.
REVOKE ALL ON FUNCTION public.wallet_credit_before_gig_stop(uuid,bigint,character varying,text,uuid,uuid,uuid,character varying,character varying,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.settle_paid_gig_wallet_income_before_stop_fence(uuid,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
