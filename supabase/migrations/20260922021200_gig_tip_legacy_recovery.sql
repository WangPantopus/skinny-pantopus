-- Backwards compatible: yes. Extend the existing original-tip transaction for
-- proven historical Payment rows; no tables or columns are added. Forward function
-- updates preserve the already-rehearsed reservation migration and its history.
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.protect_gig_tip_original() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE before_original jsonb; after_original jsonb; privileged boolean; legacy boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN before_original:=OLD.metadata->'gig_tip_original_v1'; END IF;
 IF TG_OP<>'DELETE' THEN after_original:=NEW.metadata->'gig_tip_original_v1'; END IF;
 IF before_original IS NULL AND after_original IS NULL THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 privileged:=current_user IN ('postgres','service_role','supabase_admin')
  AND coalesce(current_setting('app.gig_tip_original',true),'')='on';
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain the original tip payment for recovery' USING ERRCODE='23514'; END IF;
 legacy:=after_original->>'source'='legacy';
 IF jsonb_typeof(after_original) IS DISTINCT FROM 'object' OR after_original->>'version' IS DISTINCT FROM '1'
  OR NEW.payment_type IS DISTINCT FROM 'tip' OR NEW.gig_id IS NULL
  OR NEW.amount_total IS NULL OR NEW.amount_total NOT BETWEEN 50 AND 99999999 OR lower(NEW.currency) IS DISTINCT FROM 'usd' OR (NOT coalesce(legacy,false) AND NEW.currency<>'usd')
  OR NEW.amount_processing_fee IS NULL OR NEW.amount_processing_fee<0
  OR NEW.amount_subtotal IS DISTINCT FROM NEW.amount_total OR NEW.tip_amount IS DISTINCT FROM NEW.amount_total
  OR NEW.amount_platform_fee IS DISTINCT FROM 0 OR NEW.amount_to_payee IS DISTINCT FROM NEW.amount_total
  OR coalesce(after_original->>'original_session_scope','') !~ '^[a-f0-9]{64}$'
  OR jsonb_typeof(after_original->'terms') IS DISTINCT FROM 'object'
  OR after_original->'terms'->>'gigId' IS DISTINCT FROM NEW.gig_id::text
  OR after_original->'terms'->>'payerId' IS DISTINCT FROM NEW.payer_id::text
  OR after_original->'terms'->>'payeeId' IS DISTINCT FROM NEW.payee_id::text
  OR (coalesce(legacy,false) AND after_original->'terms'->'ownerConfirmedAt' IS DISTINCT FROM 'null'::jsonb)
  OR (NOT coalesce(legacy,false) AND after_original->'terms'->>'ownerConfirmedAt' IS NULL)
  OR jsonb_typeof(after_original->'livemode') IS DISTINCT FROM 'boolean'
  OR (NOT coalesce(legacy,false) AND coalesce(after_original->>'stripe_account_id','') !~ '^acct_[a-zA-Z0-9]+$')
  OR (coalesce(legacy,false) AND (coalesce(NEW.stripe_payment_intent_id,'') !~ '^pi_[a-zA-Z0-9]+$'
    OR after_original->'payment_method_id' IS DISTINCT FROM 'null'::jsonb
    OR after_original ? 'provider_params' OR after_original ? 'provider_started_at'))
  OR coalesce(after_original->>'state','') NOT IN ('reserved','creating','pending','canceling','needs_review','succeeded','canceled')
  THEN RAISE EXCEPTION 'Invalid original tip payment' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NOT privileged THEN RAISE EXCEPTION 'Use the original tip transaction' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF before_original IS NULL THEN
  IF NOT privileged OR NOT coalesce(legacy,false)
   OR coalesce(current_setting('app.gig_tip_legacy_adoption',true),'')<>'on'
   OR (to_jsonb(NEW)-'metadata'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'metadata'-'updated_at')
   OR (NEW.metadata-'gig_tip_original_v1') IS DISTINCT FROM coalesce(OLD.metadata,'{}'::jsonb)
   THEN RAISE EXCEPTION 'Use verified existing tip adoption' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF ROW(NEW.id,NEW.payer_id,NEW.payee_id,NEW.gig_id,NEW.payment_type,NEW.amount_total,
   NEW.amount_subtotal,NEW.amount_platform_fee,NEW.amount_to_payee,NEW.amount_processing_fee,NEW.tip_amount,NEW.currency)
  IS DISTINCT FROM ROW(OLD.id,OLD.payer_id,OLD.payee_id,OLD.gig_id,OLD.payment_type,OLD.amount_total,
   OLD.amount_subtotal,OLD.amount_platform_fee,OLD.amount_to_payee,OLD.amount_processing_fee,OLD.tip_amount,OLD.currency)
  OR (after_original-'state'-'lease_id'-'lease_until'-'provider_started_at'-'provider_params'-'provider_status'-'last_error'-'receipt')
   IS DISTINCT FROM (before_original-'state'-'lease_id'-'lease_until'-'provider_started_at'-'provider_params'-'provider_status'-'last_error'-'receipt')
  OR (before_original->>'provider_started_at' IS NOT NULL AND after_original->'provider_started_at' IS DISTINCT FROM before_original->'provider_started_at')
  OR (before_original ? 'provider_params' AND after_original->'provider_params' IS DISTINCT FROM before_original->'provider_params')
  OR (before_original ? 'receipt' AND after_original->'receipt' IS DISTINCT FROM before_original->'receipt')
  OR (before_original->>'state' IN ('succeeded','canceled') AND after_original->>'state' IS DISTINCT FROM before_original->>'state')
  OR (OLD.payment_succeeded_at IS NOT NULL AND NEW.payment_succeeded_at IS DISTINCT FROM OLD.payment_succeeded_at)
  OR (OLD.captured_at IS NOT NULL AND NEW.captured_at IS DISTINCT FROM OLD.captured_at)
  OR (OLD.payment_succeeded_at IS NOT NULL AND OLD.stripe_charge_id IS NOT NULL
   AND NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id)
  OR (OLD.stripe_customer_id IS NOT NULL AND NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id)
  OR (OLD.stripe_payment_intent_id IS NOT NULL AND NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id)
  THEN RAISE EXCEPTION 'Original tip identity is immutable' USING ERRCODE='23514'; END IF;
 IF NOT privileged AND (after_original IS DISTINCT FROM before_original
  OR ROW(NEW.stripe_customer_id,NEW.stripe_payment_intent_id,NEW.stripe_charge_id,
    NEW.payment_succeeded_at,NEW.captured_at,NEW.payment_attempted_at)
   IS DISTINCT FROM ROW(OLD.stripe_customer_id,OLD.stripe_payment_intent_id,OLD.stripe_charge_id,
    OLD.payment_succeeded_at,OLD.captured_at,OLD.payment_attempted_at)
  OR (NEW.payment_status IS DISTINCT FROM OLD.payment_status AND before_original->>'state' IS DISTINCT FROM 'succeeded')) THEN
  RAISE EXCEPTION 'Use the original tip transaction' USING ERRCODE='42501'; END IF;
 IF before_original->>'state'='succeeded' AND coalesce(NEW.payment_status,'') NOT IN
  ('captured_hold','transfer_scheduled','transfer_pending','transferred','refund_pending','refunded_partial','refunded_full','disputed')
  THEN RAISE EXCEPTION 'A captured tip cannot be reopened' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;

-- Several historical payments may already be unresolved. Each keeps its own
-- identity; preview/reservation still blocks a new charge while any remains.
DROP INDEX public.payment_one_active_gig_tip;
CREATE UNIQUE INDEX payment_one_active_gig_tip ON public."Payment"(gig_id,payer_id)
 WHERE metadata ? 'gig_tip_original_v1'
 AND coalesce(metadata->'gig_tip_original_v1'->>'source','original')<>'legacy'
 AND metadata->'gig_tip_original_v1'->>'state' NOT IN ('succeeded','canceled');

CREATE OR REPLACE FUNCTION public.read_gig_tip_original(p_request_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment";
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.payer_id IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF p.payment_type IS DISTINCT FROM 'tip' THEN RETURN jsonb_build_object('error','LEGACY_REVIEW'); END IF;
 IF (p.metadata ? 'gig_tip_original_v1') IS DISTINCT FROM true THEN
  RETURN jsonb_build_object('error','LEGACY_REVIEW','payment',to_jsonb(p)); END IF;
 RETURN jsonb_build_object('payment',to_jsonb(p),'original',p.metadata->'gig_tip_original_v1');
END $$;

CREATE OR REPLACE FUNCTION public.prepare_gig_tip_provider(p_request_id uuid,p_actor_id uuid,p_lease_id uuid,p_customer_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; g public."Gig"; o jsonb; d jsonb; current_customer text;
BEGIN
 -- Use the same task-before-payment lock order as reservation.
 SELECT * INTO g FROM public."Gig" WHERE id=(SELECT gig_id FROM public."Payment" WHERE id=p_request_id) FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 d:=public.read_gig_tip_original(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 o:=d->'original';
 IF o->>'source'='legacy' THEN RETURN jsonb_build_object('error','LEGACY_CHECK_ONLY'); END IF;
 IF p_lease_id IS NULL OR o->>'lease_id' IS DISTINCT FROM p_lease_id::text
  OR coalesce((o->>'lease_until')::timestamptz,'-infinity')<=clock_timestamp()
  THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 IF o->>'state' IN ('succeeded','canceled') OR p.stripe_payment_intent_id IS NOT NULL
  THEN RETURN jsonb_build_object('error','PROVIDER_ALREADY_BOUND'); END IF;
 IF p_customer_id IS NULL OR p_customer_id !~ '^cus_[a-zA-Z0-9]+$'
  OR (p.stripe_customer_id IS NOT NULL AND p.stripe_customer_id IS DISTINCT FROM p_customer_id)
  THEN RETURN jsonb_build_object('error','CUSTOMER_CHANGED'); END IF;
 IF p.stripe_customer_id IS NULL THEN
  SELECT stripe_customer_id INTO current_customer FROM public."User" WHERE id=p_actor_id FOR SHARE;
  IF current_customer IS DISTINCT FROM p_customer_id THEN RETURN jsonb_build_object('error','CUSTOMER_CHANGED'); END IF;
 END IF;
 IF o->>'provider_started_at' IS NULL THEN
  IF g.status IS DISTINCT FROM 'completed' OR public.gig_tip_terms(g) IS DISTINCT FROM o->'terms'
   THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
  o:=o||jsonb_build_object('provider_started_at',clock_timestamp(),'provider_params',jsonb_build_object(
   'amount',p.amount_total,'currency',p.currency,'customer',p_customer_id,'capture_method','automatic','confirmation_method','automatic',
   'metadata',jsonb_build_object('payer_id',p.payer_id,'payee_id',p.payee_id,'gig_id',p.gig_id,'payment_type','tip',
    'platform_fee','0','payee_stripe_account',o->>'stripe_account_id','tip_request_id',p.id,'payment_id',p.id),
   'description','Pantopus Tip - Gig '||p.gig_id::text));
  IF o->>'payment_method_id' IS NOT NULL THEN
   o:=jsonb_set(o,'{provider_params}',(o->'provider_params')||jsonb_build_object('payment_method',o->>'payment_method_id','off_session',true,'confirm',true));
  END IF;
 ELSIF o->'provider_params' IS NULL OR (o->>'provider_started_at')::timestamptz<=clock_timestamp()-interval '23 hours' THEN
  RETURN jsonb_build_object('error','PROVIDER_OUTCOME_UNKNOWN');
 END IF;
 o:=o||jsonb_build_object('state','creating');
 PERFORM set_config('app.gig_tip_original','on',true);
 UPDATE public."Payment" SET stripe_customer_id=p_customer_id,metadata=jsonb_set(metadata,'{gig_tip_original_v1}',o),
  payment_attempted_at=coalesce(payment_attempted_at,(o->>'provider_started_at')::timestamptz) WHERE id=p.id;
 PERFORM set_config('app.gig_tip_original','off',true);
 RETURN public.read_gig_tip_original(p_request_id,p_actor_id);
END $$;

CREATE OR REPLACE FUNCTION public.cancel_unstarted_gig_tip(p_request_id uuid,p_actor_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; o jsonb; d jsonb; receipt jsonb;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 d:=public.read_gig_tip_original(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 o:=d->'original';
 IF o->>'source'='legacy' THEN RETURN jsonb_build_object('error','PROVIDER_OUTCOME_UNKNOWN'); END IF;
 IF o->>'state' IN ('succeeded','canceled') THEN RETURN d; END IF;
 IF p_lease_id IS NULL OR o->>'lease_id' IS DISTINCT FROM p_lease_id::text
  OR coalesce((o->>'lease_until')::timestamptz,'-infinity')<=clock_timestamp()
  THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 IF o->>'provider_started_at' IS NOT NULL OR p.stripe_payment_intent_id IS NOT NULL OR p.stripe_charge_id IS NOT NULL
  OR p.payment_succeeded_at IS NOT NULL OR p.captured_at IS NOT NULL OR p.payment_status IS DISTINCT FROM 'authorize_pending'
  THEN RETURN jsonb_build_object('error','PROVIDER_OUTCOME_UNKNOWN'); END IF;
 receipt:=jsonb_build_object('requestId',p.id,'paymentId',p.id,'gigId',p.gig_id,'payerId',p.payer_id,'payeeId',p.payee_id,
  'amountCents',p.amount_total,'currency',p.currency,'status','canceled','paymentIntentId',NULL,'chargeId',NULL,'amountChargedCents',0);
 o:=(o-'lease_id'-'lease_until')||jsonb_build_object('state','canceled','receipt',receipt);
 PERFORM set_config('app.gig_tip_original','on',true);
 UPDATE public."Payment" SET payment_status='canceled',metadata=jsonb_set(metadata,'{gig_tip_original_v1}',o) WHERE id=p.id;
 PERFORM set_config('app.gig_tip_original','off',true);
 RETURN public.read_gig_tip_original(p_request_id,p_actor_id);
END $$;

CREATE OR REPLACE FUNCTION public.record_gig_tip_original(p_request_id uuid,p_actor_id uuid,p_lease_id uuid,p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; o jsonb; d jsonb; status text; receipt jsonb; captured timestamptz; next_payment_status text; legacy boolean; historical_success boolean;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 d:=public.read_gig_tip_original(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 o:=d->'original';
 legacy:=coalesce(o->>'source'='legacy',false);
 IF o->>'state' IN ('succeeded','canceled') THEN RETURN d; END IF;
 IF p_lease_id IS NULL OR o->>'lease_id' IS DISTINCT FROM p_lease_id::text
  OR coalesce((o->>'lease_until')::timestamptz,'-infinity')<=clock_timestamp()
  THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 status:=p_proof->>'status';
 IF (NOT legacy AND o->>'provider_started_at' IS NULL) OR p.stripe_customer_id IS NULL
  OR jsonb_typeof(p_proof) IS DISTINCT FROM 'object'
  OR NOT coalesce(p_proof @> jsonb_build_object('customer',p.stripe_customer_id,'livemode',o->'livemode',
    'amount',p.amount_total,'currency',lower(p.currency),'confirmation_method','automatic','amount_capturable',0,
    'payer_id',p.payer_id,'payee_id',p.payee_id,'gig_id',p.gig_id,'payment_type','tip','platform_fee','0',
    'transfer_data',NULL,'on_behalf_of',NULL,'charge_transfer',NULL,'charge_destination',NULL,'charge_application_fee',NULL),false)
  OR (NOT legacy AND NOT coalesce(p_proof @> jsonb_build_object('request_id',p.id,'payment_id',p.id,
    'stripe_account_id',o->>'stripe_account_id'),false))
  OR (legacy AND NOT coalesce(p_proof @> '{"request_id":null,"payment_id":null}'::jsonb,false))
  OR coalesce(p_proof->>'id','') !~ '^pi_[a-zA-Z0-9]+$'
  OR (p.stripe_payment_intent_id IS NOT NULL AND p_proof->>'id' IS DISTINCT FROM p.stripe_payment_intent_id)
  OR coalesce(p_proof->>'capture_method','') NOT IN ('automatic','automatic_async')
  OR coalesce(status,'') NOT IN ('requires_payment_method','requires_confirmation','requires_action','processing','succeeded','canceled')
  OR p_proof->'application_fee_amount' IS NULL OR p_proof->'application_fee_amount' NOT IN ('null'::jsonb,'0'::jsonb)
  OR p_proof->'charge_application_fee_amount' IS NULL OR p_proof->'charge_application_fee_amount' NOT IN ('null'::jsonb,'0'::jsonb)
  OR jsonb_typeof(p_proof->'amount_received') IS DISTINCT FROM 'number'
  OR (p_proof->>'amount_received')::integer NOT BETWEEN 0 AND p.amount_total
  OR jsonb_typeof(p_proof->'charge_amount_refunded') IS DISTINCT FROM 'number'
  OR (p_proof->>'charge_amount_refunded')::integer NOT BETWEEN 0 AND p.amount_total
  OR jsonb_typeof(p_proof->'charge_amount_captured') IS DISTINCT FROM 'number'
  OR (p_proof->>'charge_amount_captured')::integer NOT BETWEEN 0 AND p.amount_total
  OR jsonb_typeof(p_proof->'charge_paid') IS DISTINCT FROM 'boolean'
  OR jsonb_typeof(p_proof->'charge_captured') IS DISTINCT FROM 'boolean'
  OR p_proof->'charge_id' IS NULL
  OR (p_proof->'charge_id'<>'null'::jsonb AND coalesce(p_proof->>'charge_id','') !~ '^ch_[a-zA-Z0-9]+$')
  OR jsonb_typeof(p_proof->'charge_disputed') IS DISTINCT FROM 'boolean'
  OR jsonb_typeof(p_proof->'charge_refunded') IS DISTINCT FROM 'boolean'
  THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 IF status='succeeded' THEN
  IF NOT coalesce(p_proof @> jsonb_build_object('amount_received',p.amount_total,'charge_paid',true,'charge_captured',true,
    'charge_amount_captured',p.amount_total),false)
   OR coalesce(p_proof->>'charge_id','') !~ '^ch_[a-zA-Z0-9]+$'
   OR jsonb_typeof(p_proof->'captured_at') IS DISTINCT FROM 'string'
   OR (p_proof->>'charge_refunded')::boolean IS DISTINCT FROM ((p_proof->>'charge_amount_refunded')::integer=p.amount_total)
   THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
  captured:=(p_proof->>'captured_at')::timestamptz;
  IF NOT isfinite(captured) THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 ELSIF status<>'processing' THEN
  IF NOT coalesce(p_proof @> '{"amount_received":0,"charge_captured":false,"charge_amount_captured":0}',false)
   THEN RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
 END IF;
 -- Historical financial records keep their status, capture time, cooldown,
 -- refund/dispute and transfer history. No current Gig or Connect identity is substituted.
 historical_success:=legacy AND p.payment_status IN ('captured_hold','transfer_scheduled','transfer_pending','transferred',
  'refund_pending','refunded_partial','refunded_full','disputed');
 IF historical_success THEN
  IF status<>'succeeded' OR (p.stripe_charge_id IS NOT NULL AND p.stripe_charge_id IS DISTINCT FROM p_proof->>'charge_id')
   THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 ELSIF legacy AND p.payment_status='canceled' THEN
  IF status<>'canceled' OR p.payment_succeeded_at IS NOT NULL OR p.captured_at IS NOT NULL
   THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 ELSIF p.payment_status IS DISTINCT FROM 'authorize_pending' OR p.payment_succeeded_at IS NOT NULL OR p.captured_at IS NOT NULL THEN
  RETURN jsonb_build_object('error','PAYMENT_CHANGED');
 END IF;
 IF legacy AND p.stripe_charge_id IS NOT NULL AND p.stripe_charge_id IS DISTINCT FROM p_proof->>'charge_id'
  THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF status IN ('succeeded','canceled') THEN
  receipt:=jsonb_build_object('requestId',p.id,'paymentId',p.id,'gigId',p.gig_id,'payerId',p.payer_id,'payeeId',p.payee_id,
    'amountCents',p.amount_total,'currency',lower(p.currency),'status',status,'paymentIntentId',p_proof->>'id',
    'chargeId',p_proof->'charge_id','amountChargedCents',CASE WHEN status='succeeded' THEN p.amount_total ELSE 0 END);
  o:=(o-'lease_id'-'lease_until')||jsonb_build_object('state',status,'receipt',receipt,'provider_status',status);
 ELSE
  o:=o||jsonb_build_object('state','pending','provider_status',status);
 END IF;
 next_payment_status:=CASE WHEN status='canceled' THEN 'canceled'
  WHEN status<>'succeeded' THEN 'authorize_pending'
  WHEN p_proof->>'charge_disputed'='true' THEN 'disputed'
  WHEN (p_proof->>'charge_amount_refunded')::integer=p.amount_total THEN 'refunded_full'
  WHEN (p_proof->>'charge_amount_refunded')::integer>0 THEN 'refunded_partial'
  ELSE 'captured_hold' END;
 PERFORM set_config('app.gig_tip_original','on',true);
 UPDATE public."Payment" SET stripe_payment_intent_id=p_proof->>'id',stripe_charge_id=p_proof->>'charge_id',
  stripe_payment_method_id=coalesce(p_proof->>'payment_method_id',stripe_payment_method_id),
  payment_status=CASE WHEN historical_success THEN p.payment_status ELSE next_payment_status END,
  payment_succeeded_at=coalesce(p.payment_succeeded_at,captured),captured_at=coalesce(p.captured_at,captured),
  cooling_off_ends_at=CASE WHEN historical_success THEN p.cooling_off_ends_at
   WHEN captured IS NULL THEN NULL ELSE captured+interval '48 hours' END,
  refunded_amount=CASE WHEN historical_success THEN p.refunded_amount ELSE (p_proof->>'charge_amount_refunded')::integer END,
  dispute_id=CASE WHEN historical_success THEN p.dispute_id ELSE p_proof->>'charge_dispute_id' END,
  metadata=jsonb_set(metadata,'{gig_tip_original_v1}',o) WHERE id=p.id;
 PERFORM set_config('app.gig_tip_original','off',true);
 RETURN public.read_gig_tip_original(p_request_id,p_actor_id);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_datetime_format OR datetime_field_overflow
 THEN RETURN jsonb_build_object('error','INVALID_PROOF');
END $$;

-- Fresh provider evidence is checked by gigTipProof before this service-only
-- function. The locked full-row snapshot prevents adopting a changed payment.
-- Adoption and its first matching receipt commit together or roll back together.
CREATE FUNCTION public.register_legacy_gig_tip(p_request_id uuid,p_actor_id uuid,p_session_scope text,
 p_livemode boolean,p_expected_payment jsonb,p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; o jsonb; d jsonb; lease uuid:=gen_random_uuid(); failure text;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.payer_id IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF p.metadata ? 'gig_tip_original_v1' THEN RETURN public.read_gig_tip_original(p_request_id,p_actor_id); END IF;
 IF p.payment_type IS DISTINCT FROM 'tip' OR to_jsonb(p) IS DISTINCT FROM p_expected_payment
  THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF p_livemode IS NULL OR coalesce(p_session_scope,'') !~ '^[a-f0-9]{64}$'
  OR coalesce(p.stripe_payment_intent_id,'') !~ '^pi_[a-zA-Z0-9]+$'
  THEN RETURN jsonb_build_object('error','PROVIDER_OUTCOME_UNKNOWN'); END IF;
 o:=jsonb_build_object('version',1,'source','legacy','state','pending','original_session_scope',p_session_scope,
  'terms',jsonb_build_object('gigId',p.gig_id,'payerId',p.payer_id,'payeeId',p.payee_id,'ownerConfirmedAt',NULL),
  'payment_method_id',NULL,'stripe_account_id',NULL,'livemode',p_livemode,
  'lease_id',lease,'lease_until',clock_timestamp()+interval '90 seconds');
 BEGIN
  PERFORM set_config('app.gig_tip_original','on',true);
  PERFORM set_config('app.gig_tip_legacy_adoption','on',true);
  UPDATE public."Payment" SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('gig_tip_original_v1',o) WHERE id=p.id;
  PERFORM set_config('app.gig_tip_legacy_adoption','off',true);
  PERFORM set_config('app.gig_tip_original','off',true);
  d:=public.record_gig_tip_original(p_request_id,p_actor_id,lease,p_proof);
  IF d ? 'error' THEN
   failure:=d->>'error'; RAISE EXCEPTION 'Legacy tip proof did not commit' USING ERRCODE='P0001';
  END IF;
  IF d->'original'->>'state' NOT IN ('succeeded','canceled') THEN
   d:=public.release_gig_tip_original(p_request_id,p_actor_id,lease);
   IF d ? 'error' THEN failure:=d->>'error'; RAISE EXCEPTION 'Legacy tip release failed' USING ERRCODE='P0001'; END IF;
  END IF;
 EXCEPTION WHEN check_violation OR raise_exception THEN
  RETURN jsonb_build_object('error',coalesce(failure,'INVALID_PROOF'));
 END;
 RETURN d;
END $$;
REVOKE ALL ON FUNCTION public.register_legacy_gig_tip(uuid,uuid,text,boolean,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_legacy_gig_tip(uuid,uuid,text,boolean,jsonb,jsonb) TO service_role;
