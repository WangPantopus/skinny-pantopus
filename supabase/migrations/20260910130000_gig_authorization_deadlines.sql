-- Backwards compatible: yes. Existing rows are preserved; no guessed deadline backfill.
-- Matching runtime must supply current exact Charge capture_before with requires_capture proof.
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.record_legacy_gig_authorization(p_gig_id uuid,p_actor_id uuid,p_attempt_id uuid,p_expected_verified_at timestamptz,p_proof jsonb,p_scheduler boolean DEFAULT false,p_lease_id uuid DEFAULT NULL)
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
 IF p_proof->>'status'='requires_capture' THEN
  IF jsonb_typeof(p_proof->'capture_before') IS DISTINCT FROM 'number'
   OR (p_proof->>'capture_before') !~ '^[0-9]{1,12}$'
   OR (p_proof->>'capture_before')::numeric>253402300799
   OR (p_proof->>'charge_id') IS NULL OR (p_proof->>'charge_id') !~ '^ch_[a-zA-Z0-9]+$' THEN
   RETURN jsonb_build_object('error','INVALID_PROOF'); END IF;
  IF to_timestamp((p_proof->>'capture_before')::double precision)<=clock_timestamp() THEN
   RETURN jsonb_build_object('error','AUTHORIZATION_EXPIRED'); END IF;
 END IF;
 next_status:=CASE WHEN p_proof->>'status'='canceled' THEN 'canceled'
  WHEN a.cancel_requested THEN 'authorization_failed'
  WHEN p_proof->>'status'='requires_capture' THEN 'authorized'
  WHEN a.off_session AND p_proof->>'status' IN ('requires_payment_method','requires_action') THEN 'authorization_failed'
  ELSE 'authorize_pending' END;
 PERFORM set_config('app.legacy_authorization_receipt','on',true);
 UPDATE public."Payment" SET stripe_payment_intent_id=p_proof->>'id',payment_status=next_status,
  payment_attempted_at=coalesce(payment_attempted_at,clock_timestamp()),
  authorization_expires_at=CASE WHEN p_proof->>'status'='requires_capture' THEN to_timestamp((p_proof->>'capture_before')::double precision) ELSE NULL END,
  stripe_charge_id=CASE WHEN p_proof->>'status'='requires_capture' THEN p_proof->>'charge_id' ELSE stripe_charge_id END,
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

REVOKE ALL ON FUNCTION public.record_legacy_gig_authorization(uuid,uuid,uuid,timestamptz,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_legacy_gig_authorization(uuid,uuid,uuid,timestamptz,jsonb,boolean,uuid) TO service_role;
