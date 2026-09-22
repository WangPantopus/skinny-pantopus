-- Backwards compatible: yes. Historical Payment, Refund and wallet rows are
-- preserved. HTTP service operations retain access; direct client financial
-- writes and SECURITY DEFINER wallet mutations are intentionally closed.
-- Provider calls remain in the service. SQL stores frozen operations and only
-- accepts provider evidence through service-only transaction functions.
SET LOCAL lock_timeout='5s';

CREATE TABLE public."PaymentRefundRequest" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_key text NOT NULL UNIQUE,
 payment_id uuid NOT NULL REFERENCES public."Payment"(id) ON DELETE RESTRICT,
 actor_id uuid REFERENCES public."User"(id) ON DELETE RESTRICT,
 actor_mode text NOT NULL CHECK(actor_mode IN ('payer','admin','policy')),
 requested_amount integer,
 amount_cents integer NOT NULL CHECK(amount_cents>0),
 currency text NOT NULL CHECK(currency='usd'),
 reason text NOT NULL,
 description text,
 operation text NOT NULL CHECK(operation IN ('refund','release')),
 frozen_payment jsonb NOT NULL,
 previous_status text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','requires_action','succeeded','failed','canceled')),
 provider_refund_id text UNIQUE,
 provider_status text,
 provider_started_at timestamptz,
 lease_token uuid,
 lease_until timestamptz,
 reversal_status text NOT NULL DEFAULT 'not_required' CHECK(reversal_status IN ('not_required','pending','succeeded','debt')),
 reversed_amount integer NOT NULL DEFAULT 0 CHECK(reversed_amount>=0),
 provider_reversal_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_refund_request_active ON public."PaymentRefundRequest"(payment_id)
 WHERE status IN ('pending','requires_action');
CREATE TABLE public."PaymentRefundReceipt" (
 provider_refund_id text PRIMARY KEY,
 payment_id uuid NOT NULL REFERENCES public."Payment"(id) ON DELETE RESTRICT,
 request_id uuid UNIQUE REFERENCES public."PaymentRefundRequest"(id) ON DELETE RESTRICT,
 intent_id text NOT NULL,
 charge_id text NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>0),
 currency text NOT NULL CHECK(currency='usd'),
 status text NOT NULL CHECK(status IN ('pending','requires_action','succeeded','failed','canceled')),
 provider_created_at timestamptz NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_refund_receipt_payment ON public."PaymentRefundReceipt"(payment_id);
CREATE TABLE public."PaymentRefundRecovery" (
 payment_id uuid PRIMARY KEY REFERENCES public."Payment"(id) ON DELETE RESTRICT,
 target_amount integer NOT NULL CHECK(target_amount>=0),
 recovered_amount integer NOT NULL DEFAULT 0 CHECK(recovered_amount>=0),
 debt_amount integer NOT NULL DEFAULT 0 CHECK(debt_amount>=0),
 kind text NOT NULL CHECK(kind IN ('wallet','stripe_transfer')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public."PaymentRefundRecovery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PaymentRefundRecovery" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."PaymentRefundRecovery" TO service_role;

ALTER TABLE public."PaymentRefundRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentRefundReceipt" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PaymentRefundRequest",public."PaymentRefundReceipt" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."PaymentRefundRequest",public."PaymentRefundReceipt" TO service_role;

-- A caller could previously manufacture a succeeded Refund for another payer.
-- Keep existing involved-party reads but require service proof for every write.
REVOKE ALL ON public."Refund",public."Wallet",public."WalletTransaction" FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public."Refund",public."Wallet",public."WalletTransaction" TO authenticated;
DROP POLICY IF EXISTS "Users can create refund requests" ON public."Refund";
ALTER TABLE public."Refund" DROP CONSTRAINT "Refund_refund_status_check";
ALTER TABLE public."Refund" ADD CONSTRAINT "Refund_refund_status_check"
 CHECK(refund_status IN ('pending','requires_action','succeeded','failed','canceled'));
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('get_or_create_wallet','wallet_credit','wallet_debit','wallet_transfer') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;

CREATE FUNCTION public.refund_payment_snapshot(p public."Payment") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('id',p.id,'payer_id',p.payer_id,'payee_id',p.payee_id,'gig_id',p.gig_id,
  'payment_type',p.payment_type,'amount_total',p.amount_total,'amount_to_payee',p.amount_to_payee,
  'currency',lower(p.currency),'intent_id',p.stripe_payment_intent_id,'charge_id',p.stripe_charge_id,
  'customer_id',p.stripe_customer_id,'transfer_id',p.stripe_transfer_id)
$$;
CREATE FUNCTION public.refund_actor_allowed(p_payer uuid,p_actor uuid,p_mode text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE p_mode WHEN 'payer' THEN p_actor=p_payer
  WHEN 'admin' THEN EXISTS(SELECT FROM public."User" WHERE id=p_actor AND role='admin')
  -- Policy operations are issued only by existing service cancellation flows.
  WHEN 'policy' THEN p_actor IS NULL OR EXISTS(SELECT FROM public."User" WHERE id=p_actor)
  ELSE false END
$$;

CREATE FUNCTION public.reserve_payment_refund(p_payment_id uuid,p_request_key text,p_actor_id uuid,p_actor_mode text,
 p_amount integer,p_reason text,p_description text,p_expected jsonb,p_operation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; r public."PaymentRefundRequest"; active public."PaymentRefundRequest";
 remaining integer; credited boolean;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT coalesce(public.refund_actor_allowed(p.payer_id,p_actor_id,p_actor_mode),false) THEN
  RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 SELECT * INTO r FROM public."PaymentRefundRequest" WHERE request_key=p_request_key FOR UPDATE;
 IF FOUND THEN
  IF r.payment_id<>p.id OR r.actor_id IS DISTINCT FROM p_actor_id OR r.actor_mode<>p_actor_mode
   OR r.requested_amount IS DISTINCT FROM p_amount OR r.reason<>p_reason
   OR r.description IS DISTINCT FROM p_description THEN RETURN jsonb_build_object('error','REQUEST_CONFLICT'); END IF;
  RETURN jsonb_build_object('request',to_jsonb(r),'payment',to_jsonb(p),'reused',true);
 END IF;
 IF public.refund_payment_snapshot(p) IS DISTINCT FROM p_expected THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF p_request_key IS NULL OR length(p_request_key)>200 OR length(p_request_key)<1
  OR p_reason NOT IN ('duplicate','fraudulent','requested_by_customer','work_not_completed','other')
  OR lower(p.currency)<>'usd' OR p.amount_total<50 OR p_amount<=0
  OR p.amount_to_payee<0 OR p.amount_to_payee>p.amount_total
  OR coalesce(p.refunded_amount,0)<0 OR coalesce(p.refunded_amount,0)>p.amount_total THEN
  RETURN jsonb_build_object('error','INVALID_TERMS'); END IF;
 SELECT * INTO active FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action') FOR UPDATE;
 IF FOUND THEN RETURN jsonb_build_object('error','REFUND_ACTIVE','request',to_jsonb(active)); END IF;
 IF EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status IN ('pending','requires_action')) THEN
  RETURN jsonb_build_object('error','PROVIDER_REFUND_PENDING'); END IF;
 IF p.dispute_id IS NOT NULL OR p.payment_status='disputed' THEN RETURN jsonb_build_object('error','DISPUTED'); END IF;
 SELECT EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income')) INTO credited;
 IF p_actor_mode='payer' AND (credited OR p.stripe_transfer_id IS NOT NULL OR p.payment_status IN ('transfer_pending','transferred')) THEN
  RETURN jsonb_build_object('error','SUPPORT_REQUIRED'); END IF;
 IF p_operation='release' THEN
  IF p.payment_status NOT IN ('authorized','authorize_pending') OR coalesce(p.capture_attempts,0)>0 THEN
   RETURN jsonb_build_object('error','CAPTURE_IN_PROGRESS'); END IF;
  remaining:=p.amount_total;
 ELSIF p_operation='refund' THEN
  IF p.payment_status NOT IN ('captured_hold','transfer_scheduled','refunded_partial','transferred','transfer_pending') THEN
   RETURN jsonb_build_object('error','PAYMENT_STATE'); END IF;
  IF p.payment_status='transfer_pending' AND p.stripe_transfer_id IS NULL AND NOT credited THEN
   RETURN jsonb_build_object('error','TRANSFER_UNKNOWN'); END IF;
  remaining:=p.amount_total-coalesce(p.refunded_amount,0);
  IF p_amount IS NOT NULL THEN remaining:=p_amount; END IF;
  IF remaining<=0 OR remaining>p.amount_total-coalesce(p.refunded_amount,0) THEN RETURN jsonb_build_object('error','AMOUNT_EXCEEDED'); END IF;
 ELSE RETURN jsonb_build_object('error','INVALID_OPERATION'); END IF;
 INSERT INTO public."PaymentRefundRequest"(id,request_key,payment_id,actor_id,actor_mode,requested_amount,amount_cents,
  currency,reason,description,operation,frozen_payment,previous_status,reversal_status)
 VALUES(p_request_key::uuid,p_request_key,p.id,p_actor_id,p_actor_mode,p_amount,remaining,'usd',p_reason,p_description,p_operation,
  p_expected,p.payment_status,CASE WHEN credited OR p.stripe_transfer_id IS NOT NULL THEN 'pending' ELSE 'not_required' END)
 RETURNING * INTO r;
 UPDATE public."Payment" SET payment_status='refund_pending',refund_reason=p_reason,updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=p.gig_id AND payment_id=p.id;
 RETURN jsonb_build_object('request',to_jsonb(r),'payment',to_jsonb(p),'reused',false);
END $$;

CREATE FUNCTION public.claim_payment_refund(p_request_id uuid,p_actor_id uuid,p_actor_mode text,p_lease_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; r public."PaymentRefundRequest"; v_payment_id uuid;
BEGIN
 SELECT x.payment_id INTO v_payment_id FROM public."PaymentRefundRequest" x WHERE id=p_request_id;
 SELECT * INTO p FROM public."Payment" WHERE id=v_payment_id FOR UPDATE;
 SELECT * INTO r FROM public."PaymentRefundRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.id IS NULL THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 PERFORM 1 FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT coalesce(public.refund_actor_allowed(p.payer_id,p_actor_id,p_actor_mode),false)
  OR r.actor_id IS DISTINCT FROM p_actor_id OR r.actor_mode<>p_actor_mode THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF r.frozen_payment IS DISTINCT FROM public.refund_payment_snapshot(p) THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF p.dispute_id IS NOT NULL OR p.payment_status='disputed' THEN RETURN jsonb_build_object('error','DISPUTED'); END IF;
 IF p.payment_status IS DISTINCT FROM 'refund_pending' AND r.status='pending' THEN RETURN jsonb_build_object('error','PAYMENT_STATE'); END IF;
 IF r.status<>'pending' THEN RETURN jsonb_build_object('request',to_jsonb(r),'claimed',false); END IF;
 IF r.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('request',to_jsonb(r),'claimed',false); END IF;
 UPDATE public."PaymentRefundRequest" SET provider_started_at=coalesce(provider_started_at,clock_timestamp()),
  lease_token=p_lease_token,lease_until=clock_timestamp()+interval '1 minute',updated_at=clock_timestamp()
 WHERE id=r.id RETURNING * INTO r;
 RETURN jsonb_build_object('request',to_jsonb(r),'claimed',true);
END $$;

-- Remaining receipt and wallet transaction functions are defined below.

CREATE FUNCTION public.record_payment_refund_receipts(p_payment_id uuid,p_expected jsonb,p_receipts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; item jsonb; old_receipt public."PaymentRefundReceipt"; r public."PaymentRefundRequest";
 old_refund public."Refund"; request_id uuid; total_success bigint; total_pending bigint; next_status text; restore_status text;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF public.refund_payment_snapshot(p) IS DISTINCT FROM p_expected THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF jsonb_typeof(p_receipts)<>'array' THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_receipts) LOOP
  IF item->>'id' IS NULL OR item->>'intentId' IS DISTINCT FROM p.stripe_payment_intent_id
   OR item->>'chargeId' IS DISTINCT FROM p.stripe_charge_id OR lower(item->>'currency') IS DISTINCT FROM lower(p.currency)
   OR (item->>'amountCents')::bigint<=0 OR (item->>'amountCents')::bigint>p.amount_total
   OR item->>'status' NOT IN ('pending','requires_action','succeeded','failed','canceled') THEN
   RAISE EXCEPTION 'Refund evidence does not match the exact payment' USING ERRCODE='40001'; END IF;
  request_id:=nullif(item->>'requestId','')::uuid;
  IF request_id IS NOT NULL THEN
   SELECT * INTO r FROM public."PaymentRefundRequest" WHERE id=request_id FOR UPDATE;
   IF NOT FOUND OR r.payment_id<>p.id OR r.amount_cents<>(item->>'amountCents')::integer OR r.operation<>'refund'
    OR r.frozen_payment IS DISTINCT FROM public.refund_payment_snapshot(p)
    OR (r.provider_refund_id IS NOT NULL AND r.provider_refund_id<>item->>'id') THEN
    RAISE EXCEPTION 'Refund request evidence does not match' USING ERRCODE='40001'; END IF;
  END IF;
  SELECT * INTO old_receipt FROM public."PaymentRefundReceipt" WHERE provider_refund_id=item->>'id' FOR UPDATE;
  IF FOUND THEN
   IF old_receipt.payment_id<>p.id OR old_receipt.amount_cents<>(item->>'amountCents')::integer
    OR old_receipt.currency<>lower(item->>'currency') OR old_receipt.intent_id<>item->>'intentId'
    OR old_receipt.charge_id<>item->>'chargeId' OR old_receipt.request_id IS DISTINCT FROM request_id THEN
    RAISE EXCEPTION 'Refund receipt cannot be rebound' USING ERRCODE='40001'; END IF;
   -- A stale pending event cannot undo a final, already verified receipt.
   IF old_receipt.status IN ('succeeded','failed','canceled') AND old_receipt.status<>item->>'status' THEN CONTINUE; END IF;
  END IF;
  INSERT INTO public."PaymentRefundReceipt"(provider_refund_id,payment_id,request_id,intent_id,charge_id,
   amount_cents,currency,status,provider_created_at,verified_at)
  VALUES(item->>'id',p.id,request_id,item->>'intentId',item->>'chargeId',(item->>'amountCents')::integer,
   lower(item->>'currency'),item->>'status',(item->>'createdAt')::timestamptz,clock_timestamp())
  ON CONFLICT(provider_refund_id) DO UPDATE SET status=EXCLUDED.status,verified_at=EXCLUDED.verified_at;
  SELECT * INTO old_refund FROM public."Refund" WHERE stripe_refund_id=item->>'id' FOR UPDATE;
  IF FOUND AND (old_refund.payment_id<>p.id OR old_refund.amount<>(item->>'amountCents')::integer
   OR lower(old_refund.currency)<>lower(item->>'currency')) THEN
   RAISE EXCEPTION 'Historical refund requires reconciliation' USING ERRCODE='40001'; END IF;
  IF NOT FOUND THEN
   INSERT INTO public."Refund"(payment_id,stripe_refund_id,amount,currency,reason,description,refund_status,initiated_by,
    metadata,refund_succeeded_at)
   VALUES(p.id,item->>'id',(item->>'amountCents')::integer,upper(item->>'currency'),
    CASE WHEN request_id IS NOT NULL THEN r.reason ELSE 'other' END,
    CASE WHEN request_id IS NOT NULL THEN r.description ELSE 'Provider-verified refund' END,item->>'status',
    coalesce(CASE WHEN request_id IS NOT NULL THEN r.actor_id END,p.payer_id),
    jsonb_build_object('verified_receipt',true,'refund_request_id',request_id),
    CASE WHEN item->>'status'='succeeded' THEN clock_timestamp() END);
  ELSE
   UPDATE public."Refund" SET refund_status=item->>'status',
    refund_succeeded_at=CASE WHEN item->>'status'='succeeded' THEN coalesce(refund_succeeded_at,clock_timestamp()) END
   WHERE id=old_refund.id;
  END IF;
  IF request_id IS NOT NULL THEN
   UPDATE public."PaymentRefundRequest" SET provider_refund_id=item->>'id',provider_status=item->>'status',status=item->>'status',
    lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=request_id;
  END IF;
 END LOOP;
 SELECT coalesce(sum(amount_cents) FILTER(WHERE status='succeeded'),0),
  coalesce(sum(amount_cents) FILTER(WHERE status IN ('pending','requires_action')),0)
 INTO total_success,total_pending FROM public."PaymentRefundReceipt" WHERE payment_id=p.id;
 IF total_success>p.amount_total OR total_success+total_pending>p.amount_total OR total_success<coalesce(p.refunded_amount,0) THEN
  RAISE EXCEPTION 'Refund accounting requires reconciliation' USING ERRCODE='40001'; END IF;
 SELECT x.previous_status INTO restore_status FROM public."PaymentRefundRequest" x WHERE x.payment_id=p.id ORDER BY x.created_at DESC,x.id DESC LIMIT 1;
 next_status:=p.payment_status;
 IF p.payment_status<>'disputed' THEN
  IF total_success=p.amount_total THEN next_status:='refunded_full';
  ELSIF total_pending>0 OR EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action')) THEN
   next_status:='refund_pending';
  ELSIF total_success>0 THEN next_status:='refunded_partial';
  ELSIF p.payment_status='refund_pending' THEN
   next_status:=coalesce(restore_status,CASE WHEN p.stripe_transfer_id IS NOT NULL OR EXISTS(
    SELECT FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income')) THEN 'transferred' ELSE 'captured_hold' END);
  END IF;
 END IF;
 UPDATE public."Payment" SET refunded_amount=total_success,payment_status=next_status,updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=p.gig_id AND payment_id=p.id;
 PERFORM public.settle_payment_refund_wallet(p.id);
 RETURN jsonb_build_object('payment',to_jsonb(p));
END $$;

CREATE FUNCTION public.record_payment_refund_release(p_request_id uuid,p_expected jsonb,p_intent_id text,p_provider_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; r public."PaymentRefundRequest"; v_payment_id uuid;
BEGIN
 SELECT x.payment_id INTO v_payment_id FROM public."PaymentRefundRequest" x WHERE id=p_request_id;
 SELECT * INTO p FROM public."Payment" WHERE id=v_payment_id FOR UPDATE;
 SELECT * INTO r FROM public."PaymentRefundRequest" WHERE id=p_request_id FOR UPDATE;
 IF r.id IS NULL THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF r.operation<>'release' OR r.frozen_payment IS DISTINCT FROM p_expected OR public.refund_payment_snapshot(p) IS DISTINCT FROM p_expected
  OR p_intent_id IS DISTINCT FROM p.stripe_payment_intent_id OR p_provider_status<>'canceled'
  OR p.payment_status NOT IN ('refund_pending','canceled') THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 UPDATE public."PaymentRefundRequest" SET status='succeeded',provider_status='canceled',lease_token=NULL,lease_until=NULL,
  updated_at=clock_timestamp() WHERE id=r.id RETURNING * INTO r;
 UPDATE public."Payment" SET payment_status='canceled',updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=p.gig_id AND payment_id=p.id;
 RETURN jsonb_build_object('request',to_jsonb(r),'payment',to_jsonb(p));
END $$;

-- Customer refund success and payee recovery are separate facts. Wallet
-- recovery is atomic. Historical Connect transfers remain an explicit debt for
-- support; this function never invents a successful provider reversal.
CREATE FUNCTION public.settle_payment_refund_wallet(p_payment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; recovery public."PaymentRefundRecovery"; w public."Wallet";
 target integer; paid integer; owed integer; tx public."WalletTransaction"; credit public."WalletTransaction";
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO credit FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income')
  AND direction='credit' AND user_id=p.payee_id AND amount=p.amount_to_payee ORDER BY created_at LIMIT 1;
 IF credit.id IS NULL AND p.stripe_transfer_id IS NULL THEN RETURN jsonb_build_object('required',false); END IF;
 target:=floor(coalesce(p.refunded_amount,0)::numeric*p.amount_to_payee/p.amount_total);
 SELECT * INTO recovery FROM public."PaymentRefundRecovery" WHERE payment_id=p.id FOR UPDATE;
 paid:=coalesce(recovery.recovered_amount,0);
 IF target<paid THEN RAISE EXCEPTION 'Refund recovery amount cannot regress' USING ERRCODE='40001'; END IF;
 owed:=target-paid;
 IF p.stripe_transfer_id IS NULL AND owed>0 THEN
  SELECT * INTO w FROM public."Wallet" WHERE id=credit.wallet_id AND user_id=p.payee_id FOR UPDATE;
  IF w.id IS NOT NULL AND NOT w.frozen AND w.balance>=owed THEN
   tx:=public.wallet_debit(p.payee_id,owed,'adjustment','Refund recovery',p.id,p.gig_id,p.payer_id,NULL,
    ('refund-wallet:'||p.id||':'||target)::varchar,jsonb_build_object('verified_refund_recovery',true));
   IF tx.direction<>'debit' OR tx.amount<>owed OR tx.payment_id IS DISTINCT FROM p.id OR tx.user_id<>p.payee_id THEN
    RAISE EXCEPTION 'Wallet refund recovery receipt mismatch' USING ERRCODE='40001'; END IF;
   paid:=paid+owed; owed:=0;
  END IF;
 END IF;
 INSERT INTO public."PaymentRefundRecovery"(payment_id,target_amount,recovered_amount,debt_amount,kind)
 VALUES(p.id,target,paid,owed,CASE WHEN p.stripe_transfer_id IS NOT NULL THEN 'stripe_transfer' ELSE 'wallet' END)
 ON CONFLICT(payment_id) DO UPDATE SET target_amount=EXCLUDED.target_amount,recovered_amount=EXCLUDED.recovered_amount,
  debt_amount=EXCLUDED.debt_amount,updated_at=clock_timestamp();
 UPDATE public."PaymentRefundRequest" SET reversal_status=CASE WHEN owed>0 THEN 'debt' ELSE 'succeeded' END,
  updated_at=clock_timestamp() WHERE payment_id=p.id AND operation='refund' AND status='succeeded';
 RETURN jsonb_build_object('target',target,'recovered',paid,'debt',owed);
END $$;

-- Complete or reset only the exact wallet release under the same Payment lock
-- used by refunds. Unknown Stripe transfer outcomes are never reset to retry.
CREATE FUNCTION public.reconcile_payment_wallet_release(p_payment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; credited boolean;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.payment_status NOT IN ('transfer_scheduled','transfer_pending') THEN RETURN jsonb_build_object('payment',to_jsonb(p),'changed',false); END IF;
 IF p.dispute_id IS NOT NULL OR coalesce(p.refunded_amount,0)>0 OR EXISTS(SELECT FROM public."PaymentRefundRequest"
  WHERE payment_id=p.id AND status IN ('pending','requires_action')) THEN RETURN jsonb_build_object('error','REFUND_OR_DISPUTE'); END IF;
 SELECT EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p.id AND user_id=p.payee_id AND direction='credit'
  AND type IN ('gig_income','tip_income') AND amount=p.amount_to_payee) INTO credited;
 IF NOT credited AND (p.payment_status='transfer_pending' OR p.stripe_transfer_id IS NOT NULL) THEN RETURN jsonb_build_object('error','TRANSFER_UNKNOWN'); END IF;
 UPDATE public."Payment" SET payment_status=CASE WHEN credited THEN 'transferred' ELSE 'captured_hold' END,
  transfer_status=CASE WHEN credited THEN 'wallet_credited' ELSE transfer_status END,
  transfer_completed_at=CASE WHEN credited THEN coalesce(transfer_completed_at,clock_timestamp()) ELSE transfer_completed_at END,
  updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=p.gig_id AND payment_id=p.id;
 RETURN jsonb_build_object('payment',to_jsonb(p),'changed',true);
END $$;

CREATE FUNCTION public.freeze_pending_refund_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF (public.refund_payment_snapshot(NEW) IS DISTINCT FROM public.refund_payment_snapshot(OLD)
   OR (OLD.payment_status='refund_pending' AND NEW.payment_status IS DISTINCT FROM OLD.payment_status
    AND NEW.payment_status IS DISTINCT FROM 'disputed'))
  AND EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=OLD.id AND status IN ('pending','requires_action')) THEN
  RAISE EXCEPTION 'Refund payment terms are frozen' USING ERRCODE='40001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER freeze_pending_refund_payment BEFORE UPDATE ON public."Payment"
 FOR EACH ROW EXECUTE FUNCTION public.freeze_pending_refund_payment();

-- Preserve the existing wallet implementation behind a service-only wrapper.
-- Income credit and refund reservation acquire Payment before Wallet, so a
-- stale scheduled release cannot credit a payee after refund has been reserved.
ALTER FUNCTION public.wallet_credit(uuid,bigint,character varying,text,uuid,uuid,uuid,character varying,character varying,jsonb)
 RENAME TO wallet_credit_before_refund_fence;
CREATE FUNCTION public.wallet_credit(p_user_id uuid,p_amount bigint,p_type character varying,p_description text DEFAULT NULL,
 p_payment_id uuid DEFAULT NULL,p_gig_id uuid DEFAULT NULL,p_counterparty_id uuid DEFAULT NULL,
 p_stripe_pi_id character varying DEFAULT NULL,p_idempotency_key character varying DEFAULT NULL,p_metadata jsonb DEFAULT '{}')
RETURNS public."WalletTransaction" LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; tx public."WalletTransaction";
BEGIN
 IF p_type IN ('gig_income','tip_income') AND p_payment_id IS NOT NULL THEN
  SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR p.payee_id IS DISTINCT FROM p_user_id OR p.payer_id IS DISTINCT FROM p_counterparty_id
   OR p.gig_id IS DISTINCT FROM p_gig_id OR p.amount_to_payee IS DISTINCT FROM p_amount OR p_amount<=0 THEN
   RAISE EXCEPTION 'Wallet income does not match payment' USING ERRCODE='40001'; END IF;
  SELECT * INTO tx FROM public."WalletTransaction" WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
   IF tx.payment_id IS DISTINCT FROM p_payment_id OR tx.user_id IS DISTINCT FROM p_user_id OR tx.amount IS DISTINCT FROM p_amount
    OR tx.type IS DISTINCT FROM p_type OR tx.direction<>'credit' THEN
    RAISE EXCEPTION 'Wallet income receipt does not match' USING ERRCODE='40001'; END IF;
   RETURN tx;
  END IF;
  IF p.payment_status NOT IN ('captured_hold','transfer_scheduled') OR p.dispute_id IS NOT NULL OR coalesce(p.refunded_amount,0)<>0
   OR EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
   OR EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status IN ('pending','requires_action','succeeded')) THEN
   RAISE EXCEPTION 'Payment cannot be released while refund or dispute is active' USING ERRCODE='40001'; END IF;
 END IF;
 RETURN public.wallet_credit_before_refund_fence(p_user_id,p_amount,p_type,p_description,p_payment_id,p_gig_id,p_counterparty_id,
  p_stripe_pi_id,p_idempotency_key,p_metadata);
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('refund_payment_snapshot','refund_actor_allowed','reserve_payment_refund',
  'claim_payment_refund','record_payment_refund_receipts','record_payment_refund_release','freeze_pending_refund_payment',
  'wallet_credit','wallet_credit_before_refund_fence','settle_payment_refund_wallet','reconcile_payment_wallet_release') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
