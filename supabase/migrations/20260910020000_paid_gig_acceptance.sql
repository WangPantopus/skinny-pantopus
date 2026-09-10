-- Backwards compatible: yes. Existing HTTP API service writes and involved-party
-- reads are retained. Direct client financial mutations are intentionally closed.
-- Paid-gig checkout is a durable service operation. No provider calls run in SQL.
-- Existing financial records are retained; pending legacy checkouts require
-- explicit reconciliation rather than silently creating a second authorization.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."GigPaymentAcceptance" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 gig_id uuid NOT NULL REFERENCES public."Gig"(id) ON DELETE RESTRICT,
 bid_id uuid NOT NULL REFERENCES public."GigBid"(id) ON DELETE RESTRICT,
 payer_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 payee_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 amount integer NOT NULL CHECK(amount>=50),
 currency text NOT NULL DEFAULT 'usd' CHECK(currency='usd'),
 payment_id uuid UNIQUE REFERENCES public."Payment"(id) ON DELETE RESTRICT,
 state text NOT NULL CHECK(state IN ('initializing','pending','canceling','canceled','accepted')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX gig_payment_acceptance_active ON public."GigPaymentAcceptance"(gig_id)
 WHERE state IN ('initializing','pending','canceling');
ALTER TABLE public."GigPaymentAcceptance" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."GigPaymentAcceptance" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."GigPaymentAcceptance" TO service_role;
REVOKE TRUNCATE,REFERENCES,TRIGGER ON public."Gig",public."GigBid" FROM PUBLIC,anon,authenticated;
-- A payer/payee must never be able to manufacture provider evidence/status.
REVOKE ALL ON public."Payment" FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public."Payment" TO authenticated;
DROP POLICY IF EXISTS payment_insert_as_payer ON public."Payment";
DROP POLICY IF EXISTS payment_update_involved ON public."Payment";

CREATE FUNCTION public.protect_gig_payment_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN RETURN NEW; END IF;
 IF (TG_OP='INSERT' AND (NEW.payment_id IS NOT NULL OR NEW.accepted_by IS NOT NULL
     OR NEW.status IS DISTINCT FROM 'open' OR NEW.payment_status IS DISTINCT FROM 'none'
     OR NEW.started_at IS NOT NULL OR NEW.worker_completed_at IS NOT NULL OR NEW.owner_confirmed_at IS NOT NULL))
  OR (TG_OP='UPDATE' AND (
     ROW(NEW.payment_id,NEW.payment_status,NEW.accepted_by,NEW.accepted_at,NEW.status,
         NEW.started_at,NEW.worker_completed_at,NEW.owner_confirmed_at)
     IS DISTINCT FROM ROW(OLD.payment_id,OLD.payment_status,OLD.accepted_by,OLD.accepted_at,OLD.status,
         OLD.started_at,OLD.worker_completed_at,OLD.owner_confirmed_at)
     OR NEW.price IS DISTINCT FROM OLD.price)) THEN
  RAISE EXCEPTION 'Gig payment and lifecycle fields are service managed' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.protect_bid_payment_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IN ('postgres','supabase_admin','service_role') THEN RETURN NEW; END IF;
 IF (TG_OP='INSERT' AND (NEW.status IN ('pending_payment','accepted')
      OR NEW.pending_payment_intent_id IS NOT NULL OR NEW.pending_payment_expires_at IS NOT NULL))
  OR (TG_OP='UPDATE' AND (NEW.gig_id IS DISTINCT FROM OLD.gig_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.pending_payment_intent_id IS DISTINCT FROM OLD.pending_payment_intent_id
      OR NEW.pending_payment_expires_at IS DISTINCT FROM OLD.pending_payment_expires_at
      OR NEW.status IN ('pending_payment','accepted') OR OLD.status IN ('pending_payment','accepted'))) THEN
  RAISE EXCEPTION 'Bid payment and acceptance fields are service managed' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_gig_payment_fields BEFORE INSERT OR UPDATE ON public."Gig"
 FOR EACH ROW EXECUTE FUNCTION public.protect_gig_payment_fields();
CREATE TRIGGER protect_bid_payment_fields BEFORE INSERT OR UPDATE ON public."GigBid"
 FOR EACH ROW EXECUTE FUNCTION public.protect_bid_payment_fields();
REVOKE ALL ON FUNCTION public.protect_gig_payment_fields() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_gig_payment_fields() TO service_role;
REVOKE ALL ON FUNCTION public.protect_bid_payment_fields() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.protect_bid_payment_fields() TO service_role;

-- Service API siblings also honor a checkout reservation. A stale bid edit,
-- counter, withdrawal, close or cancellation cannot change its frozen terms.
CREATE FUNCTION public.freeze_active_gig_checkout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT FROM public."GigPaymentAcceptance" WHERE gig_id=OLD.id AND state IN ('initializing','pending','canceling'))
  AND (TG_OP='DELETE' OR ROW(NEW.user_id,NEW.price,NEW.status,NEW.accepted_by,NEW.payment_id)
     IS DISTINCT FROM ROW(OLD.user_id,OLD.price,OLD.status,OLD.accepted_by,OLD.payment_id)) THEN
  RAISE EXCEPTION 'Abort the active payment checkout before changing this gig' USING ERRCODE='40001'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE FUNCTION public.freeze_active_bid_checkout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT FROM public."GigPaymentAcceptance" WHERE bid_id=OLD.id AND state IN ('initializing','pending','canceling'))
  AND OLD.status='pending_payment'
  AND (TG_OP='DELETE' OR ROW(NEW.gig_id,NEW.user_id,NEW.bid_amount,NEW.status)
     IS DISTINCT FROM ROW(OLD.gig_id,OLD.user_id,OLD.bid_amount,OLD.status)) THEN
  RAISE EXCEPTION 'Abort the active payment checkout before changing this bid' USING ERRCODE='40001'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER freeze_active_gig_checkout BEFORE UPDATE OR DELETE ON public."Gig"
 FOR EACH ROW EXECUTE FUNCTION public.freeze_active_gig_checkout();
CREATE TRIGGER freeze_active_bid_checkout BEFORE UPDATE OR DELETE ON public."GigBid"
 FOR EACH ROW EXECUTE FUNCTION public.freeze_active_bid_checkout();
REVOKE ALL ON FUNCTION public.freeze_active_gig_checkout(),public.freeze_active_bid_checkout() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_active_gig_checkout(),public.freeze_active_bid_checkout() TO service_role;

-- Route authorization resolves personal/business gigs.manage, then passes the
-- exact durable payer. These RPCs are not exposed to end-user database roles.
CREATE FUNCTION public.begin_paid_gig_acceptance(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; b public."GigBid"%ROWTYPE; a public."GigPaymentAcceptance"%ROWTYPE;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND OR g.user_id IS DISTINCT FROM p_payer_id THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO b FROM public."GigBid" WHERE id=p_bid_id AND gig_id=g.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE gig_id=g.id AND state IN ('initializing','pending','canceling') FOR UPDATE;
 IF FOUND THEN
  IF a.bid_id<>b.id OR a.state='canceling' THEN RETURN jsonb_build_object('error','CONFLICT'); END IF;
  IF g.status IS DISTINCT FROM 'open' OR b.status<>'pending_payment' OR a.payer_id<>g.user_id OR a.payee_id<>b.user_id
     OR a.amount<>round(b.bid_amount*100)::integer THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
  RETURN jsonb_build_object('attempt',to_jsonb(a),'reused',true);
 END IF;
 IF g.status IS DISTINCT FROM 'open' OR b.status NOT IN ('pending','countered') OR b.user_id=g.user_id
    OR b.bid_amount<0.50 OR (b.expires_at IS NOT NULL AND b.expires_at<=clock_timestamp())
    OR EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND status='pending_payment') THEN
  RETURN jsonb_build_object('error','CONFLICT'); END IF;
 INSERT INTO public."GigPaymentAcceptance"(gig_id,bid_id,payer_id,payee_id,amount,state)
 VALUES(g.id,b.id,g.user_id,b.user_id,round(b.bid_amount*100)::integer,'initializing') RETURNING * INTO a;
 UPDATE public."GigBid" SET status='pending_payment',pending_payment_expires_at=clock_timestamp()+interval '10 minutes',
   pending_payment_intent_id=NULL,updated_at=now() WHERE id=b.id;
 RETURN jsonb_build_object('attempt',to_jsonb(a),'reused',false);
END $$;

-- Free bids share the same Gig lock so they cannot overtake a paid checkout.
CREATE FUNCTION public.accept_free_gig_bid(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; b public."GigBid"%ROWTYPE;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND OR g.user_id IS DISTINCT FROM p_payer_id THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO b FROM public."GigBid" WHERE id=p_bid_id AND gig_id=g.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF g.status IS DISTINCT FROM 'open' OR b.status NOT IN ('pending','countered') OR b.bid_amount<>0 OR b.user_id=g.user_id
  OR (b.expires_at IS NOT NULL AND b.expires_at<=clock_timestamp())
  OR EXISTS(SELECT FROM public."GigPaymentAcceptance" WHERE gig_id=g.id AND state IN ('initializing','pending','canceling'))
  OR EXISTS(SELECT FROM public."GigBid" WHERE gig_id=g.id AND status='pending_payment') THEN
 RETURN jsonb_build_object('error','CONFLICT'); END IF;
 UPDATE public."GigBid" SET status='accepted',updated_at=now() WHERE id=b.id RETURNING * INTO b;
 UPDATE public."Gig" SET status='assigned',accepted_by=b.user_id,accepted_at=now(),price=0,updated_at=now()
 WHERE id=g.id RETURNING * INTO g;
 RETURN jsonb_build_object('gig',to_jsonb(g),'bid',to_jsonb(b));
END $$;

CREATE FUNCTION public.bind_paid_gig_acceptance(p_attempt_id uuid,p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE a public."GigPaymentAcceptance"%ROWTYPE; g public."Gig"%ROWTYPE; b public."GigBid"%ROWTYPE; p public."Payment"%ROWTYPE;
BEGIN
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE id=p_attempt_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=a.gig_id FOR UPDATE;
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE id=p_attempt_id FOR UPDATE;
 SELECT * INTO b FROM public."GigBid" WHERE id=a.bid_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND OR a.state NOT IN ('initializing','pending') OR g.status IS DISTINCT FROM 'open' OR b.status<>'pending_payment'
  OR a.payer_id<>g.user_id OR a.payee_id<>b.user_id OR a.amount<>round(b.bid_amount*100)::integer
  OR p.gig_id IS DISTINCT FROM a.gig_id OR p.payer_id<>a.payer_id OR p.payee_id<>a.payee_id
  OR p.amount_total<>a.amount OR lower(p.currency) IS DISTINCT FROM a.currency OR p.payment_type IS DISTINCT FROM 'gig_payment'
  OR p.stripe_customer_id IS NULL OR p.stripe_payment_intent_id IS NULL
  OR p.metadata->>'acceptance_attempt_id' IS DISTINCT FROM a.id::text
  OR (a.payment_id IS NOT NULL AND a.payment_id<>p.id) THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 UPDATE public."GigPaymentAcceptance" SET payment_id=p.id,state='pending',updated_at=now() WHERE id=a.id RETURNING * INTO a;
 UPDATE public."GigBid" SET pending_payment_intent_id=p.id::text,updated_at=now() WHERE id=b.id;
 RETURN jsonb_build_object('attempt',to_jsonb(a));
END $$;

CREATE FUNCTION public.finalize_paid_gig_acceptance(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid,p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; b public."GigBid"%ROWTYPE; a public."GigPaymentAcceptance"%ROWTYPE; p public."Payment"%ROWTYPE;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND OR g.user_id IS DISTINCT FROM p_payer_id THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO b FROM public."GigBid" WHERE id=p_bid_id AND gig_id=g.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE gig_id=g.id AND bid_id=b.id AND payment_id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF a.state='accepted' AND g.payment_id=a.payment_id AND g.accepted_by=a.payee_id AND b.status='accepted' THEN
  RETURN jsonb_build_object('gig',to_jsonb(g),'bid',to_jsonb(b),'reused',true); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND OR g.status IS DISTINCT FROM 'open' OR b.status<>'pending_payment' OR a.state<>'pending'
  OR b.pending_payment_intent_id IS DISTINCT FROM p.id::text OR a.payer_id<>g.user_id OR a.payee_id<>b.user_id
  OR a.amount<>round(b.bid_amount*100)::integer OR p.gig_id IS DISTINCT FROM g.id OR p.payer_id<>g.user_id
  OR p.payee_id<>b.user_id OR p.amount_total<>a.amount OR lower(p.currency) IS DISTINCT FROM 'usd'
  OR p.payment_type IS DISTINCT FROM 'gig_payment' OR p.payment_status IS DISTINCT FROM 'authorized' OR coalesce(p.refunded_amount,0)<>0
  OR p.metadata->>'acceptance_attempt_id' IS DISTINCT FROM a.id::text
  OR p.authorization_expires_at IS NULL OR p.authorization_expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('error','PAYMENT_NOT_AUTHORIZED'); END IF;
 UPDATE public."GigPaymentAcceptance" SET state='accepted',updated_at=now() WHERE id=a.id;
 UPDATE public."GigBid" SET status='accepted',pending_payment_expires_at=NULL,pending_payment_intent_id=NULL,
  updated_at=now() WHERE id=b.id RETURNING * INTO b;
 UPDATE public."Gig" SET status='assigned',accepted_by=a.payee_id,accepted_at=now(),price=a.amount/100.0,
  payment_id=p.id,payment_status=p.payment_status,updated_at=now() WHERE id=g.id RETURNING * INTO g;
 RETURN jsonb_build_object('gig',to_jsonb(g),'bid',to_jsonb(b),'reused',false);
END $$;

CREATE FUNCTION public.cancel_paid_gig_acceptance(p_gig_id uuid,p_bid_id uuid,p_payer_id uuid,p_complete boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; b public."GigBid"%ROWTYPE; a public."GigPaymentAcceptance"%ROWTYPE; p public."Payment"%ROWTYPE;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND OR g.user_id IS DISTINCT FROM p_payer_id THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO b FROM public."GigBid" WHERE id=p_bid_id AND gig_id=g.id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO a FROM public."GigPaymentAcceptance" WHERE gig_id=g.id AND bid_id=b.id
  ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','CONFLICT'); END IF;
 IF a.state='canceled' AND b.status='pending' THEN RETURN jsonb_build_object('bid',to_jsonb(b),'reused',true); END IF;
 IF g.status IS DISTINCT FROM 'open' OR b.status<>'pending_payment' OR a.state NOT IN ('pending','canceling') OR a.payment_id IS NULL THEN
  RETURN jsonb_build_object('error','CONFLICT'); END IF;
 IF NOT p_complete THEN
  UPDATE public."GigPaymentAcceptance" SET state='canceling',updated_at=now() WHERE id=a.id RETURNING * INTO a;
  RETURN jsonb_build_object('attempt',to_jsonb(a)); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=a.payment_id FOR UPDATE;
 IF NOT FOUND OR p.payment_status IS DISTINCT FROM 'canceled' OR p.gig_id IS DISTINCT FROM g.id OR p.payer_id<>g.user_id
  OR p.payee_id<>a.payee_id OR p.metadata->>'acceptance_attempt_id' IS DISTINCT FROM a.id::text THEN
  RETURN jsonb_build_object('error','CANCELLATION_NOT_CONFIRMED'); END IF;
 UPDATE public."GigPaymentAcceptance" SET state='canceled',updated_at=now() WHERE id=a.id;
 UPDATE public."GigBid" SET status='pending',pending_payment_intent_id=NULL,pending_payment_expires_at=NULL,
  updated_at=now() WHERE id=b.id RETURNING * INTO b;
 RETURN jsonb_build_object('bid',to_jsonb(b),'reused',false);
END $$;

CREATE FUNCTION public.prepare_paid_gig_capture(p_payment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"%ROWTYPE; g public."Gig"%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF g.id IS NULL OR g.payment_id IS DISTINCT FROM p.id OR g.user_id<>p.payer_id OR g.accepted_by IS DISTINCT FROM p.payee_id
  OR round(g.price*100)::integer<>p.amount_total OR p.payment_type IS DISTINCT FROM 'gig_payment'
  OR g.status IS DISTINCT FROM 'completed' OR g.worker_completed_at IS NULL OR coalesce(p.refunded_amount,0)<>0 THEN
  RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 IF p.payment_status='captured_hold' THEN RETURN jsonb_build_object('payment',to_jsonb(p),'reused',true); END IF;
 IF p.payment_status IS NULL OR p.payment_status NOT IN ('authorized','capture_pending') OR p.capture_attempts>=5 THEN
  RETURN jsonb_build_object('error','CAPTURE_NOT_READY'); END IF;
 UPDATE public."Payment" SET payment_status='capture_pending',capture_attempts=capture_attempts+1,updated_at=now()
 WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status='capture_pending',updated_at=now() WHERE id=g.id;
 RETURN jsonb_build_object('payment',to_jsonb(p),'reused',false);
END $$;

CREATE FUNCTION public.record_paid_gig_capture(p_payment_id uuid,p_intent_id text,p_charge_id text,p_amount integer,p_customer_id text,p_currency text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"%ROWTYPE; g public."Gig"%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF g.id IS NULL OR g.payment_id IS DISTINCT FROM p.id OR g.user_id<>p.payer_id OR g.accepted_by IS DISTINCT FROM p.payee_id
  OR round(g.price*100)::integer<>p.amount_total OR p.payment_type IS DISTINCT FROM 'gig_payment' OR g.status IS DISTINCT FROM 'completed'
  OR g.worker_completed_at IS NULL OR coalesce(p.refunded_amount,0)<>0
  OR p_intent_id IS NULL OR p_customer_id IS NULL OR p_currency IS DISTINCT FROM 'usd'
  OR p.stripe_payment_intent_id IS DISTINCT FROM p_intent_id OR p.stripe_customer_id IS DISTINCT FROM p_customer_id
  OR p.amount_total IS DISTINCT FROM p_amount OR lower(p.currency) IS DISTINCT FROM p_currency
  OR p_charge_id IS NULL OR p_charge_id !~ '^ch_[A-Za-z0-9]+$'
  OR p.payment_status IS NULL OR p.payment_status NOT IN ('authorized','capture_pending','captured_hold') THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 IF p.payment_status='captured_hold' AND p.captured_at IS NOT NULL AND p.stripe_charge_id=p_charge_id THEN
  RETURN jsonb_build_object('payment',to_jsonb(p),'reused',true); END IF;
 UPDATE public."Payment" SET payment_status='captured_hold',stripe_charge_id=p_charge_id,captured_at=coalesce(captured_at,now()),
  cooling_off_ends_at=coalesce(cooling_off_ends_at,now()+interval '48 hours'),payment_succeeded_at=coalesce(payment_succeeded_at,now()),
  updated_at=now() WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=now() WHERE id=g.id;
 RETURN jsonb_build_object('payment',to_jsonb(p),'reused',false);
END $$;

DO $$ DECLARE fn regprocedure; BEGIN
 FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('begin_paid_gig_acceptance','accept_free_gig_bid','bind_paid_gig_acceptance',
   'finalize_paid_gig_acceptance','cancel_paid_gig_acceptance','prepare_paid_gig_capture','record_paid_gig_capture') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn);
 END LOOP;
END $$;
