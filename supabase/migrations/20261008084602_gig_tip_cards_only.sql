-- Backwards compatible: yes. Replaces one function body and restates its privileges (unchanged); no tables, columns or data change.
-- New tips are charged to cards only (Apple Pay, Google Pay and Link ride on cards), like invoice and task
-- payments since a9cc43631: without payment_method_types the tip's PaymentIntent offered every method the
-- Stripe dashboard enables (Klarna, Cash App Pay, Amazon Pay, crypto). Tips whose provider payload was
-- frozen before this migration keep it; backend/stripe/gigTipProof.js accepts both shapes.
SET LOCAL lock_timeout='5s';

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
   'payment_method_types',jsonb_build_array('card'),
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

REVOKE ALL ON FUNCTION public.prepare_gig_tip_provider(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_gig_tip_provider(uuid,uuid,uuid,text) TO service_role;
