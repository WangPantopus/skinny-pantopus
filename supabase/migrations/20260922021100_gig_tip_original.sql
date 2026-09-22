-- Backwards compatible: yes. Reserve an original tip in the existing Payment
-- row before provider work. Legacy rows and every existing screen are retained.
-- Only explicitly marked originals use this service-only transaction boundary.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.gig_tip_terms(g public."Gig") RETURNS jsonb
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('gigId',g.id,'payerId',g.user_id,'payeeId',g.accepted_by,'ownerConfirmedAt',g.owner_confirmed_at)
$$;

CREATE FUNCTION public.protect_gig_tip_original() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE before_original jsonb; after_original jsonb; privileged boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN before_original:=OLD.metadata->'gig_tip_original_v1'; END IF;
 IF TG_OP<>'DELETE' THEN after_original:=NEW.metadata->'gig_tip_original_v1'; END IF;
 IF before_original IS NULL AND after_original IS NULL THEN
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 privileged:=current_user IN ('postgres','service_role','supabase_admin')
  AND coalesce(current_setting('app.gig_tip_original',true),'')='on';
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain the original tip payment for recovery' USING ERRCODE='23514'; END IF;
 IF jsonb_typeof(after_original) IS DISTINCT FROM 'object' OR after_original->>'version' IS DISTINCT FROM '1'
  OR NEW.payment_type IS DISTINCT FROM 'tip' OR NEW.gig_id IS NULL
  OR NEW.amount_total IS NULL OR NEW.amount_total NOT BETWEEN 50 AND 99999999 OR NEW.currency IS DISTINCT FROM 'usd'
  OR NEW.amount_processing_fee IS NULL OR NEW.amount_processing_fee<0
  OR NEW.amount_subtotal IS DISTINCT FROM NEW.amount_total OR NEW.tip_amount IS DISTINCT FROM NEW.amount_total
  OR NEW.amount_platform_fee IS DISTINCT FROM 0 OR NEW.amount_to_payee IS DISTINCT FROM NEW.amount_total
  OR coalesce(after_original->>'original_session_scope','') !~ '^[a-f0-9]{64}$'
  OR jsonb_typeof(after_original->'terms') IS DISTINCT FROM 'object'
  OR after_original->'terms'->>'gigId' IS DISTINCT FROM NEW.gig_id::text
  OR after_original->'terms'->>'payerId' IS DISTINCT FROM NEW.payer_id::text
  OR after_original->'terms'->>'payeeId' IS DISTINCT FROM NEW.payee_id::text
  OR after_original->'terms'->>'ownerConfirmedAt' IS NULL
  OR jsonb_typeof(after_original->'livemode') IS DISTINCT FROM 'boolean'
  OR coalesce(after_original->>'stripe_account_id','') !~ '^acct_[a-zA-Z0-9]+$'
  OR coalesce(after_original->>'state','') NOT IN ('reserved','creating','pending','canceling','needs_review','succeeded','canceled')
  THEN RAISE EXCEPTION 'Invalid original tip payment' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NOT privileged THEN RAISE EXCEPTION 'Use the original tip transaction' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF before_original IS NULL OR ROW(NEW.id,NEW.payer_id,NEW.payee_id,NEW.gig_id,NEW.payment_type,NEW.amount_total,
   NEW.amount_subtotal,NEW.amount_platform_fee,NEW.amount_to_payee,NEW.amount_processing_fee,NEW.tip_amount,NEW.currency)
  IS DISTINCT FROM ROW(OLD.id,OLD.payer_id,OLD.payee_id,OLD.gig_id,OLD.payment_type,OLD.amount_total,
   OLD.amount_subtotal,OLD.amount_platform_fee,OLD.amount_to_payee,OLD.amount_processing_fee,OLD.tip_amount,OLD.currency)
  OR (after_original-'state'-'lease_id'-'lease_until'-'provider_started_at'-'provider_params'-'provider_status'-'last_error'-'receipt')
   IS DISTINCT FROM (before_original-'state'-'lease_id'-'lease_until'-'provider_started_at'-'provider_params'-'provider_status'-'last_error'-'receipt')
  OR (before_original->>'provider_started_at' IS NOT NULL AND after_original->'provider_started_at' IS DISTINCT FROM before_original->'provider_started_at')
  OR (before_original ? 'provider_params' AND after_original->'provider_params' IS DISTINCT FROM before_original->'provider_params')
  OR (before_original ? 'receipt' AND after_original->'receipt' IS DISTINCT FROM before_original->'receipt')
  OR (before_original->>'state' IN ('succeeded','canceled') AND after_original->>'state' IS DISTINCT FROM before_original->>'state')
  OR (OLD.payment_succeeded_at IS NOT NULL AND ROW(NEW.payment_succeeded_at,NEW.captured_at,NEW.stripe_charge_id)
   IS DISTINCT FROM ROW(OLD.payment_succeeded_at,OLD.captured_at,OLD.stripe_charge_id))
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
CREATE TRIGGER payment_gig_tip_original BEFORE INSERT OR UPDATE OR DELETE ON public."Payment"
 FOR EACH ROW EXECUTE FUNCTION public.protect_gig_tip_original();
CREATE UNIQUE INDEX payment_one_active_gig_tip ON public."Payment"(gig_id,payer_id)
 WHERE metadata ? 'gig_tip_original_v1' AND metadata->'gig_tip_original_v1'->>'state' NOT IN ('succeeded','canceled');

CREATE FUNCTION public.read_gig_tip_original(p_request_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment";
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.payer_id IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 IF p.payment_type IS DISTINCT FROM 'tip' OR (p.metadata ? 'gig_tip_original_v1') IS DISTINCT FROM true THEN RETURN jsonb_build_object('error','LEGACY_REVIEW'); END IF;
 RETURN jsonb_build_object('payment',to_jsonb(p),'original',p.metadata->'gig_tip_original_v1');
END $$;

CREATE FUNCTION public.preview_gig_tip(p_gig_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE g public."Gig"; active public."Payment"; used integer; unavailable text; result jsonb;
BEGIN
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF g.user_id IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 SELECT count(*) INTO used FROM public."Payment" WHERE gig_id=g.id AND payer_id=p_actor_id
  AND payment_type='tip' AND payment_succeeded_at IS NOT NULL;
 SELECT * INTO active FROM public."Payment" WHERE gig_id=g.id AND payer_id=p_actor_id AND payment_type='tip'
  AND payment_succeeded_at IS NULL
  AND coalesce(metadata->'gig_tip_original_v1'->>'state','')<>'canceled'
  ORDER BY created_at,id LIMIT 1;
 unavailable:=CASE WHEN active.id IS NOT NULL THEN CASE WHEN active.metadata ? 'gig_tip_original_v1' THEN 'TIP_ACTIVE' ELSE 'LEGACY_REVIEW' END
  WHEN g.status<>'completed' OR g.owner_confirmed_at IS NULL THEN 'NOT_CONFIRMED'
  WHEN g.accepted_by IS NULL OR g.accepted_by=p_actor_id THEN 'WORKER_UNAVAILABLE'
  WHEN used>=3 THEN 'TIP_LIMIT'
  WHEN (SELECT count(*) FROM public."StripeAccount" WHERE user_id=g.accepted_by AND stripe_account_id ~ '^acct_[a-zA-Z0-9]+$')<>1 THEN 'CONNECT_REQUIRED'
  ELSE NULL END;
 result:=jsonb_build_object('terms',public.gig_tip_terms(g),'eligible',unavailable IS NULL,'unavailableReason',unavailable,
  'activeRequestId',CASE WHEN active.metadata ? 'gig_tip_original_v1' THEN active.id ELSE NULL END,
  'legacyPaymentId',CASE WHEN (active.metadata ? 'gig_tip_original_v1') IS DISTINCT FROM true THEN active.id ELSE NULL END,
  'minimumAmountCents',50,'maximumAmountCents',99999999,'remainingTipSlots',greatest(0,3-used));
 RETURN result;
END $$;

CREATE FUNCTION public.reserve_gig_tip_original(p_gig_id uuid,p_actor_id uuid,p_session_scope text,p_request_id uuid,
 p_expected jsonb,p_amount integer,p_payment_method_id text,p_livemode boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE g public."Gig"; p public."Payment"; d jsonb; original jsonb; account_id text; customer_id text;
BEGIN
 IF p_request_id IS NULL OR p_amount IS NULL OR p_amount NOT BETWEEN 50 AND 99999999
  OR p_session_scope IS NULL OR p_session_scope !~ '^[a-f0-9]{64}$' OR p_livemode IS NULL
  OR (p_payment_method_id IS NOT NULL AND p_payment_method_id !~ '^pm_[a-zA-Z0-9]+$')
  THEN RETURN jsonb_build_object('error','INVALID_REQUEST'); END IF;
 -- Lock the task before checking slots and reserving. Every new original for
 -- this task observes the preceding winner; no provider call runs in SQL.
 SELECT * INTO g FROM public."Gig" WHERE id=p_gig_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id;
 IF FOUND THEN
  original:=p.metadata->'gig_tip_original_v1';
  IF p.payer_id IS DISTINCT FROM p_actor_id OR p.gig_id IS DISTINCT FROM p_gig_id
   OR p.payment_type IS DISTINCT FROM 'tip' OR original IS NULL OR p.amount_total IS DISTINCT FROM p_amount
   OR original->'terms' IS DISTINCT FROM p_expected OR original->>'payment_method_id' IS DISTINCT FROM p_payment_method_id
   OR original->'livemode' IS DISTINCT FROM to_jsonb(p_livemode)
   THEN RETURN jsonb_build_object('error','REQUEST_CONFLICT'); END IF;
  RETURN public.read_gig_tip_original(p_request_id,p_actor_id);
 END IF;
 d:=public.preview_gig_tip(p_gig_id,p_actor_id);
 IF d ? 'error' THEN RETURN d; END IF;
 IF d->'terms' IS DISTINCT FROM p_expected THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 IF d->>'eligible' IS DISTINCT FROM 'true' THEN RETURN jsonb_build_object('error',d->>'unavailableReason',
  'requestId',d->'activeRequestId','legacyPaymentId',d->'legacyPaymentId'); END IF;
 SELECT stripe_account_id INTO account_id FROM public."StripeAccount"
  WHERE user_id=g.accepted_by AND stripe_account_id ~ '^acct_[a-zA-Z0-9]+$' FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','CONNECT_REQUIRED'); END IF;
 SELECT stripe_customer_id INTO customer_id FROM public."User" WHERE id=p_actor_id FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','FORBIDDEN'); END IF;
 original:=jsonb_build_object('version',1,'terms',p_expected,'original_session_scope',p_session_scope,
  'payment_method_id',p_payment_method_id,'stripe_account_id',account_id,'livemode',p_livemode,'state','reserved');
 PERFORM set_config('app.gig_tip_original','on',true);
 INSERT INTO public."Payment"(id,payer_id,payee_id,gig_id,payment_type,payment_status,stripe_customer_id,
  amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,amount_processing_fee,tip_amount,currency,is_escrowed,metadata)
 VALUES(p_request_id,p_actor_id,g.accepted_by,g.id,'tip','authorize_pending',customer_id,p_amount,p_amount,0,p_amount,
  floor(p_amount::numeric*0.029)::integer+30,p_amount,'usd',true,jsonb_build_object('gig_tip_original_v1',original));
 PERFORM set_config('app.gig_tip_original','off',true);
 RETURN public.read_gig_tip_original(p_request_id,p_actor_id);
EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('error','REQUEST_CONFLICT');
END $$;

-- A bounded lease serializes provider work. Reads never acquire a lease or
-- establish that a timed-out provider create did not happen.
CREATE FUNCTION public.claim_gig_tip_original(p_request_id uuid,p_actor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; o jsonb; d jsonb;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 d:=public.read_gig_tip_original(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 o:=d->'original';
 IF o->>'state' IN ('succeeded','canceled') THEN RETURN d; END IF;
 IF (o->>'lease_until')::timestamptz>clock_timestamp() THEN RETURN jsonb_build_object('error','BUSY'); END IF;
 o:=o||jsonb_build_object('lease_id',gen_random_uuid(),'lease_until',clock_timestamp()+interval '90 seconds');
 PERFORM set_config('app.gig_tip_original','on',true);
 UPDATE public."Payment" SET metadata=jsonb_set(metadata,'{gig_tip_original_v1}',o) WHERE id=p.id;
 PERFORM set_config('app.gig_tip_original','off',true);
 RETURN public.read_gig_tip_original(p_request_id,p_actor_id);
END $$;

CREATE FUNCTION public.prepare_gig_tip_provider(p_request_id uuid,p_actor_id uuid,p_lease_id uuid,p_customer_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; g public."Gig"; o jsonb; d jsonb; current_customer text;
BEGIN
 -- Use the same task-before-payment lock order as reservation.
 SELECT * INTO g FROM public."Gig" WHERE id=(SELECT gig_id FROM public."Payment" WHERE id=p_request_id) FOR UPDATE;
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 d:=public.read_gig_tip_original(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 o:=d->'original';
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

CREATE FUNCTION public.release_gig_tip_original(p_request_id uuid,p_actor_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; o jsonb; d jsonb;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 d:=public.read_gig_tip_original(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 o:=d->'original';
 IF p_lease_id IS NULL OR o->>'lease_id' IS DISTINCT FROM p_lease_id::text THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 PERFORM set_config('app.gig_tip_original','on',true);
 UPDATE public."Payment" SET metadata=jsonb_set(metadata,'{gig_tip_original_v1}',o-'lease_id'-'lease_until') WHERE id=p.id;
 PERFORM set_config('app.gig_tip_original','off',true);
 RETURN public.read_gig_tip_original(p_request_id,p_actor_id);
END $$;

CREATE FUNCTION public.cancel_unstarted_gig_tip(p_request_id uuid,p_actor_id uuid,p_lease_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; o jsonb; d jsonb; receipt jsonb;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 d:=public.read_gig_tip_original(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 o:=d->'original';
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

-- The service passes freshly checked gigTipProof evidence. SQL binds that
-- evidence to this exact original and commits status plus receipt atomically.
CREATE FUNCTION public.record_gig_tip_original(p_request_id uuid,p_actor_id uuid,p_lease_id uuid,p_proof jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; o jsonb; d jsonb; status text; receipt jsonb; captured timestamptz; next_payment_status text;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_request_id FOR UPDATE;
 d:=public.read_gig_tip_original(p_request_id,p_actor_id); IF d ? 'error' THEN RETURN d; END IF;
 o:=d->'original';
 IF o->>'state' IN ('succeeded','canceled') THEN RETURN d; END IF;
 IF p_lease_id IS NULL OR o->>'lease_id' IS DISTINCT FROM p_lease_id::text
  OR coalesce((o->>'lease_until')::timestamptz,'-infinity')<=clock_timestamp()
  THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 status:=p_proof->>'status';
 IF o->>'provider_started_at' IS NULL OR p.stripe_customer_id IS NULL
  OR jsonb_typeof(p_proof) IS DISTINCT FROM 'object'
  OR NOT coalesce(p_proof @> jsonb_build_object('customer',p.stripe_customer_id,'livemode',o->'livemode',
    'amount',p.amount_total,'currency',p.currency,'confirmation_method','automatic','amount_capturable',0,
    'payer_id',p.payer_id,'payee_id',p.payee_id,'gig_id',p.gig_id,'payment_type','tip','platform_fee','0',
    'request_id',p.id,'payment_id',p.id,'stripe_account_id',o->>'stripe_account_id',
    'transfer_data',NULL,'on_behalf_of',NULL,'charge_transfer',NULL,'charge_destination',NULL,'charge_application_fee',NULL),false)
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
 -- Only the original pending payment may first become financially terminal.
 IF p.payment_status IS DISTINCT FROM 'authorize_pending' OR p.payment_succeeded_at IS NOT NULL OR p.captured_at IS NOT NULL
  THEN RETURN jsonb_build_object('error','PAYMENT_CHANGED'); END IF;
 IF status IN ('succeeded','canceled') THEN
  receipt:=jsonb_build_object('requestId',p.id,'paymentId',p.id,'gigId',p.gig_id,'payerId',p.payer_id,'payeeId',p.payee_id,
    'amountCents',p.amount_total,'currency',p.currency,'status',status,'paymentIntentId',p_proof->>'id',
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
  payment_status=next_payment_status,payment_succeeded_at=captured,captured_at=captured,
  cooling_off_ends_at=CASE WHEN captured IS NULL THEN NULL ELSE captured+interval '48 hours' END,
  refunded_amount=(p_proof->>'charge_amount_refunded')::integer,dispute_id=p_proof->>'charge_dispute_id',
  metadata=jsonb_set(metadata,'{gig_tip_original_v1}',o) WHERE id=p.id;
 PERFORM set_config('app.gig_tip_original','off',true);
 RETURN public.read_gig_tip_original(p_request_id,p_actor_id);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_datetime_format OR datetime_field_overflow
 THEN RETURN jsonb_build_object('error','INVALID_PROOF');
END $$;

REVOKE ALL ON FUNCTION public.gig_tip_terms(public."Gig"),public.protect_gig_tip_original(),
 public.read_gig_tip_original(uuid,uuid),public.preview_gig_tip(uuid,uuid),
 public.reserve_gig_tip_original(uuid,uuid,text,uuid,jsonb,integer,text,boolean),
 public.claim_gig_tip_original(uuid,uuid),public.prepare_gig_tip_provider(uuid,uuid,uuid,text),
 public.release_gig_tip_original(uuid,uuid,uuid),public.cancel_unstarted_gig_tip(uuid,uuid,uuid),
 public.record_gig_tip_original(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gig_tip_terms(public."Gig"),public.protect_gig_tip_original(),
 public.read_gig_tip_original(uuid,uuid),public.preview_gig_tip(uuid,uuid),
 public.reserve_gig_tip_original(uuid,uuid,text,uuid,jsonb,integer,text,boolean),
 public.claim_gig_tip_original(uuid,uuid),public.prepare_gig_tip_provider(uuid,uuid,uuid,text),
 public.release_gig_tip_original(uuid,uuid,uuid),public.cancel_unstarted_gig_tip(uuid,uuid,uuid),
 public.record_gig_tip_original(uuid,uuid,uuid,jsonb) TO service_role;
