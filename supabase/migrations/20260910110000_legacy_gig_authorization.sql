-- Backwards compatible: yes. Historical payments are untouched until explicitly
-- recovered. Each provider authorization keeps its original terms and identity.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."GigLegacyAuthorization" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL REFERENCES public."Payment"(id) ON DELETE RESTRICT,
 snapshot jsonb NOT NULL,
 intent_id text UNIQUE,
 adopted boolean NOT NULL,
 off_session boolean NOT NULL,
 provider_status text,
 superseded boolean NOT NULL DEFAULT false,
 cancel_requested boolean NOT NULL DEFAULT false,
 lease_id uuid, lease_until timestamptz,
 requested_at timestamptz,
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX gig_legacy_authorization_current ON public."GigLegacyAuthorization"(payment_id) WHERE NOT superseded;
ALTER TABLE public."GigLegacyAuthorization" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."GigLegacyAuthorization" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."GigLegacyAuthorization" TO service_role;

CREATE FUNCTION public.legacy_gig_authorization_snapshot(p public."Payment") RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('payment_id',p.id,'payment_type',p.payment_type,'gig_id',p.gig_id,'payer_id',p.payer_id,'payee_id',p.payee_id,
 'amount',p.amount_total,'subtotal',p.amount_subtotal,'fee',p.amount_platform_fee,'net',p.amount_to_payee,
 'processing_fee',p.amount_processing_fee,'currency',lower(p.currency),'customer',p.stripe_customer_id,
 'saved_method',p.stripe_payment_method_id,'setup_intent',p.stripe_setup_intent_id,'acceptance_attempt_id',p.metadata->>'acceptance_attempt_id')
$$;

-- Lock the same assigned Gig then Payment for every reservation/lease/receipt.
-- Service-only scheduler access is explicit; client actor authority is current.
CREATE FUNCTION public.read_legacy_gig_authorization(p_gig_id uuid,p_actor_id uuid,p_scheduler boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"%ROWTYPE; p public."Payment"%ROWTYPE; a public."GigLegacyAuthorization"%ROWTYPE;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF NOT coalesce(p_scheduler,false) AND NOT public.paid_gig_actor_allowed(g.user_id,p_actor_id) THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=g.payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.metadata->>'acceptance_attempt_id' IS NOT NULL THEN RETURN jsonb_build_object('error','BID_RECOVERY'); END IF;
 IF g.status IS DISTINCT FROM 'assigned' OR g.accepted_by IS NULL OR p.gig_id IS DISTINCT FROM g.id
  OR p.payer_id IS DISTINCT FROM g.user_id OR p.payee_id IS DISTINCT FROM g.accepted_by
  OR p.amount_total IS DISTINCT FROM round(g.price*100)::bigint OR p.amount_total<50
  OR p.payment_type IS DISTINCT FROM 'gig_payment' OR lower(p.currency) IS DISTINCT FROM 'usd'
  OR p.stripe_customer_id IS NULL OR p.captured_at IS NOT NULL OR coalesce(p.capture_attempts,0)>0
  OR p.dispute_id IS NOT NULL OR coalesce(p.refunded_amount,0)<>0 OR p.stripe_transfer_id IS NOT NULL
  OR p.payment_status NOT IN ('ready_to_authorize','authorize_pending','authorization_failed','authorized','canceled')
  OR EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
  THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF p_scheduler AND (g.scheduled_start IS NULL OR g.scheduled_start>clock_timestamp()+interval '24 hours') THEN
  RETURN jsonb_build_object('error','NOT_DUE'); END IF;
 SELECT * INTO a FROM public."GigLegacyAuthorization" WHERE payment_id=p.id AND NOT superseded FOR UPDATE;
 IF FOUND AND (a.snapshot IS DISTINCT FROM public.legacy_gig_authorization_snapshot(p)
   OR (a.intent_id IS NOT NULL AND a.intent_id IS DISTINCT FROM p.stripe_payment_intent_id)) THEN
  RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 RETURN jsonb_build_object('payment',to_jsonb(p),'gig',to_jsonb(g),'attempt',CASE WHEN a.id IS NULL THEN NULL ELSE to_jsonb(a) END);
END $$;

CREATE FUNCTION public.begin_legacy_gig_authorization(p_gig_id uuid,p_actor_id uuid,p_scheduler boolean DEFAULT false,p_replace boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; p public."Payment"%ROWTYPE; a public."GigLegacyAuthorization"%ROWTYPE;
BEGIN
 d:=public.read_legacy_gig_authorization(p_gig_id,p_actor_id,p_scheduler);
 IF d ? 'error' THEN RETURN d; END IF;
 SELECT * INTO p FROM jsonb_populate_record(NULL::public."Payment",d->'payment');
 SELECT * INTO a FROM jsonb_populate_record(NULL::public."GigLegacyAuthorization",nullif(d->'attempt','null'::jsonb));
 IF a.id IS NOT NULL AND NOT p_replace THEN RETURN d; END IF;
 IF p_replace THEN
  IF a.id IS NULL OR a.provider_status IS DISTINCT FROM 'canceled' OR a.verified_at IS NULL
   OR a.cancel_requested OR a.intent_id IS DISTINCT FROM p.stripe_payment_intent_id OR a.lease_until>clock_timestamp() THEN
   RETURN jsonb_build_object('error','TERMINAL_PROOF_REQUIRED'); END IF;
  UPDATE public."GigLegacyAuthorization" SET superseded=true WHERE id=a.id;
 END IF;
 INSERT INTO public."GigLegacyAuthorization"(payment_id,snapshot,intent_id,adopted,off_session)
 VALUES(p.id,public.legacy_gig_authorization_snapshot(p),CASE WHEN p_replace THEN NULL ELSE p.stripe_payment_intent_id END,
  NOT p_replace AND p.stripe_payment_intent_id IS NOT NULL,p_scheduler) RETURNING * INTO a;
 RETURN jsonb_set(d,'{attempt}',to_jsonb(a));
END $$;

CREATE FUNCTION public.claim_legacy_gig_authorization(p_gig_id uuid,p_actor_id uuid,p_attempt_id uuid,p_scheduler boolean DEFAULT false,p_cancel boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; a public."GigLegacyAuthorization"%ROWTYPE;
BEGIN
 d:=public.read_legacy_gig_authorization(p_gig_id,p_actor_id,p_scheduler);
 IF d ? 'error' THEN RETURN d; END IF;
 SELECT * INTO a FROM jsonb_populate_record(NULL::public."GigLegacyAuthorization",nullif(d->'attempt','null'::jsonb));
 IF a.id IS NULL OR a.id IS DISTINCT FROM p_attempt_id THEN RETURN jsonb_build_object('error','ATTEMPT_CHANGED'); END IF;
 IF a.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('error','BUSY'); END IF;
 -- Absence from provider listing is never permission to outlive its key cache.
 IF p_cancel THEN
  IF NOT p_scheduler OR (d->'gig'->>'scheduled_start')::timestamptz>clock_timestamp()+interval '2 hours'
   OR a.intent_id IS NULL OR (a.provider_status NOT IN ('requires_action','requires_payment_method','requires_confirmation')
    AND NOT (a.cancel_requested AND a.provider_status='requires_capture'))
   THEN RETURN jsonb_build_object('error','CHECK_REQUIRED'); END IF;
 ELSE
  IF a.cancel_requested THEN RETURN jsonb_build_object('error','CANCEL_PENDING'); END IF;
  IF a.intent_id IS NULL AND (d->'gig'->>'scheduled_start')::timestamptz>clock_timestamp()+interval '24 hours' THEN
   RETURN jsonb_build_object('error','NOT_DUE'); END IF;
  IF a.intent_id IS NULL AND a.requested_at IS NULL AND d->'payment'->>'stripe_payment_intent_id' IS NULL
   AND (d->'payment'->>'payment_status' IS DISTINCT FROM 'ready_to_authorize'
     OR d->'payment'->>'payment_attempted_at' IS NOT NULL) THEN RETURN jsonb_build_object('error','NEEDS_REVIEW'); END IF;
  IF a.requested_at<clock_timestamp()-interval '10 minutes' THEN RETURN jsonb_build_object('error','NEEDS_REVIEW'); END IF;
  IF a.provider_status IS NOT NULL AND a.provider_status<>'requires_confirmation' THEN RETURN jsonb_build_object('error','CHECK_REQUIRED'); END IF;
  IF p_scheduler AND (d->'payment'->>'stripe_payment_method_id' IS NULL OR NOT a.off_session) THEN RETURN jsonb_build_object('error','CHECK_REQUIRED'); END IF;
 END IF;
 UPDATE public."GigLegacyAuthorization" SET lease_id=gen_random_uuid(),lease_until=clock_timestamp()+interval '60 seconds',
 requested_at=coalesce(requested_at,clock_timestamp()),cancel_requested=cancel_requested OR p_cancel WHERE id=a.id RETURNING * INTO a;
 RETURN jsonb_set(d,'{attempt}',to_jsonb(a));
END $$;

CREATE FUNCTION public.finish_legacy_gig_auto_cancel(p_gig_id uuid,p_attempt_id uuid,p_verified_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; g public."Gig"%ROWTYPE; a public."GigLegacyAuthorization"%ROWTYPE;
BEGIN
 d:=public.read_legacy_gig_authorization(p_gig_id,NULL,true);
 IF d ? 'error' THEN RETURN d; END IF;
 SELECT * INTO a FROM jsonb_populate_record(NULL::public."GigLegacyAuthorization",nullif(d->'attempt','null'::jsonb));
 SELECT * INTO g FROM jsonb_populate_record(NULL::public."Gig",d->'gig');
 IF a.id IS NULL OR a.id IS DISTINCT FROM p_attempt_id OR a.provider_status IS DISTINCT FROM 'canceled'
  OR a.verified_at IS DISTINCT FROM p_verified_at OR a.intent_id IS NULL
  OR g.scheduled_start>clock_timestamp()+interval '2 hours' THEN RETURN jsonb_build_object('error','CHECK_REQUIRED'); END IF;
 UPDATE public."Gig" SET status='cancelled',cancelled_at=clock_timestamp(),cancellation_reason='payment_authorization_failed',
  cancellation_zone=1,cancellation_fee=0,payment_status='canceled',updated_at=clock_timestamp() WHERE id=g.id RETURNING * INTO g;
 RETURN jsonb_build_object('gig',to_jsonb(g),'cancelled',true);
END $$;

CREATE FUNCTION public.record_legacy_gig_authorization(p_gig_id uuid,p_actor_id uuid,p_attempt_id uuid,p_expected_verified_at timestamptz,p_proof jsonb,p_scheduler boolean DEFAULT false,p_lease_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE d jsonb; a public."GigLegacyAuthorization"%ROWTYPE; p public."Payment"%ROWTYPE; next_status text;
BEGIN
 d:=public.read_legacy_gig_authorization(p_gig_id,p_actor_id,p_scheduler);
 IF d ? 'error' THEN RETURN d; END IF;
 SELECT * INTO a FROM jsonb_populate_record(NULL::public."GigLegacyAuthorization",nullif(d->'attempt','null'::jsonb));
 SELECT * INTO p FROM jsonb_populate_record(NULL::public."Payment",d->'payment');
 IF a.id IS NULL OR a.id IS DISTINCT FROM p_attempt_id OR a.verified_at IS DISTINCT FROM p_expected_verified_at OR p_proof->>'id' IS NULL
  OR (a.intent_id IS NOT NULL AND a.intent_id IS DISTINCT FROM p_proof->>'id')
  OR (NOT a.adopted AND p_proof->>'attempt_id' IS DISTINCT FROM a.id::text
   AND NOT (coalesce(p_proof->>'discovered_legacy','false')='true' AND a.requested_at IS NULL AND p.stripe_payment_intent_id IS NULL))
  OR p_proof->>'customer' IS DISTINCT FROM p.stripe_customer_id
  OR p_proof->>'capture_method' IS DISTINCT FROM 'manual' OR p_proof->>'currency' IS DISTINCT FROM 'usd'
  OR p_proof->>'amount' IS DISTINCT FROM p.amount_total::text
  OR p_proof->>'payer_id' IS DISTINCT FROM p.payer_id::text OR p_proof->>'payee_id' IS DISTINCT FROM p.payee_id::text
  OR p_proof->>'gig_id' IS DISTINCT FROM p.gig_id::text
  OR p_proof->>'status' NOT IN ('requires_payment_method','requires_confirmation','requires_action','requires_capture','processing','canceled')
  OR p_proof->>'status' IS NULL
  OR (p_proof->>'status'='requires_capture' AND p_proof->>'amount_capturable' IS DISTINCT FROM p.amount_total::text)
  THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 next_status:=CASE WHEN p_proof->>'status'='canceled' THEN 'canceled'
  WHEN a.cancel_requested THEN 'authorization_failed'
  WHEN p_proof->>'status'='requires_capture' THEN 'authorized'
  WHEN a.off_session AND p_proof->>'status' IN ('requires_payment_method','requires_action') THEN 'authorization_failed'
  ELSE 'authorize_pending' END;
 PERFORM set_config('app.legacy_authorization_receipt','on',true);
 UPDATE public."Payment" SET stripe_payment_intent_id=p_proof->>'id',payment_status=next_status,
  payment_attempted_at=coalesce(payment_attempted_at,clock_timestamp()),
  authorization_expires_at=CASE WHEN next_status='authorized' THEN coalesce(authorization_expires_at,clock_timestamp()+interval '7 days') ELSE NULL END,
  payment_succeeded_at=CASE WHEN next_status='authorized' THEN coalesce(payment_succeeded_at,clock_timestamp()) ELSE payment_succeeded_at END,
  off_session_auth_required=next_status='authorization_failed',updated_at=clock_timestamp()
 WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=p.gig_id AND payment_id=p.id AND payment_status IS DISTINCT FROM p.payment_status;
 UPDATE public."GigLegacyAuthorization" SET intent_id=p_proof->>'id',adopted=adopted OR coalesce((p_proof->>'discovered_legacy')::boolean,false),provider_status=p_proof->>'status',verified_at=clock_timestamp(),
  lease_id=CASE WHEN lease_id=p_lease_id THEN NULL ELSE lease_id END,
  lease_until=CASE WHEN lease_id=p_lease_id THEN NULL ELSE lease_until END WHERE id=a.id RETURNING * INTO a;
 PERFORM set_config('app.legacy_authorization_receipt','off',true);
 RETURN jsonb_build_object('payment',to_jsonb(p),'attempt',to_jsonb(a),'gig',d->'gig');
END $$;

CREATE FUNCTION public.freeze_legacy_gig_authorization() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT FROM public."GigLegacyAuthorization" WHERE payment_id=OLD.id)
  AND (public.legacy_gig_authorization_snapshot(NEW) IS DISTINCT FROM public.legacy_gig_authorization_snapshot(OLD)
   OR (NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
    AND current_setting('app.legacy_authorization_receipt',true) IS DISTINCT FROM 'on')) THEN
  RAISE EXCEPTION 'Historical authorization terms require the protected receipt' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER freeze_legacy_gig_authorization BEFORE UPDATE ON public."Payment" FOR EACH ROW EXECUTE FUNCTION public.freeze_legacy_gig_authorization();

-- Cancellation and worker start serialize on Gig, then Payment/operation. A
-- late SDK confirmation cannot start work while an admitted cancellation is
-- still in flight or has an unknown provider outcome.
CREATE FUNCTION public.guard_legacy_gig_start() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 IF OLD.status='assigned' AND (NEW.status IN ('in_progress','completed') OR NEW.started_at IS DISTINCT FROM OLD.started_at) THEN
  PERFORM 1 FROM public."Payment" WHERE id=OLD.payment_id FOR SHARE;
  PERFORM 1 FROM public."GigLegacyAuthorization" WHERE payment_id=OLD.payment_id AND NOT superseded AND cancel_requested FOR SHARE;
  IF FOUND THEN RAISE EXCEPTION 'Authorization cancellation must finish before work can start' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_legacy_gig_start BEFORE UPDATE ON public."Gig" FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_gig_start();
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('legacy_gig_authorization_snapshot','read_legacy_gig_authorization',
 'begin_legacy_gig_authorization','claim_legacy_gig_authorization','record_legacy_gig_authorization','finish_legacy_gig_auto_cancel','freeze_legacy_gig_authorization','guard_legacy_gig_start') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
 END LOOP;
END $$;
