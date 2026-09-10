BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
INSERT INTO auth.users(id,email) SELECT ('aae10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'paid-gig-contract-'||n||'@example.invalid' FROM generate_series(1,4) n;
INSERT INTO public."User"(id,email,username,name,stripe_customer_id) SELECT id,email,'paid_gig_contract_'||right(id::text,1),
 'Paid gig contract','cus_contract'||right(id::text,1) FROM auth.users WHERE id::text LIKE 'aae10000-%';
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price) VALUES
 ('aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000001','aae10000-0000-4000-8000-000000000001','Contract one','Synthetic contract',20),
 ('aae10000-0000-4000-8000-000000000102','aae10000-0000-4000-8000-000000000004','aae10000-0000-4000-8000-000000000004','Foreign contract','Synthetic contract',20);
INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount) VALUES
 ('aae10000-0000-4000-8000-000000000201','aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000002',12.50),
 ('aae10000-0000-4000-8000-000000000202','aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000003',13.50);
INSERT INTO public."GigBid"(id,gig_id,user_id,bid_amount,expires_at) VALUES
 ('aae10000-0000-4000-8000-000000000203','aae10000-0000-4000-8000-000000000102','aae10000-0000-4000-8000-000000000002',0,clock_timestamp()-interval '1 minute');
DO $$ BEGIN
 IF public.accept_free_gig_bid('aae10000-0000-4000-8000-000000000102','aae10000-0000-4000-8000-000000000203',
 'aae10000-0000-4000-8000-000000000004')->>'error' IS DISTINCT FROM 'CONFLICT' THEN RAISE EXCEPTION 'Expired free bid accepted'; END IF;
END $$;
CREATE TEMP TABLE paid_gig_contract_state(attempt_id uuid,payment_id uuid);
GRANT ALL ON paid_gig_contract_state TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE a jsonb; r jsonb; u uuid:='aae10000-0000-4000-8000-000000000001'; g uuid:='aae10000-0000-4000-8000-000000000101';
 b uuid:='aae10000-0000-4000-8000-000000000201'; p uuid:='aae10000-0000-4000-8000-000000000301';
BEGIN
 IF public.begin_paid_gig_acceptance(g,b,'aae10000-0000-4000-8000-000000000004')->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Foreign payer admitted'; END IF;
 IF public.begin_paid_gig_acceptance('aae10000-0000-4000-8000-000000000102',b,'aae10000-0000-4000-8000-000000000004')->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Cross-gig bid admitted'; END IF;
 a:=public.begin_paid_gig_acceptance(g,b,u)->'attempt';
 IF a->>'amount' IS DISTINCT FROM '1250' OR a->>'state' IS DISTINCT FROM 'initializing' THEN RAISE EXCEPTION 'Agreed bid terms not reserved'; END IF;
 r:=public.begin_paid_gig_acceptance(g,b,u);
 IF r->'attempt'->>'id' IS DISTINCT FROM a->>'id' OR r->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Retry changed operation identity'; END IF;
 IF public.begin_paid_gig_acceptance(g,'aae10000-0000-4000-8000-000000000202',u)->>'error' IS DISTINCT FROM 'CONFLICT' THEN
 RAISE EXCEPTION 'Different bid bypassed reservation'; END IF;
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 stripe_customer_id,stripe_payment_intent_id,payment_status,metadata)
 VALUES(p,g,u,'aae10000-0000-4000-8000-000000000002',1250,1250,188,1062,'cus_contract1','pi_contract1','authorize_pending',
 jsonb_build_object('acceptance_attempt_id',a->>'id'));
 INSERT INTO paid_gig_contract_state VALUES((a->>'id')::uuid,p);
 -- Wrong amount cannot bind a real payment; neither the bid nor attempt changes.
 UPDATE public."Payment" SET amount_total=1200 WHERE id=p;
 IF public.bind_paid_gig_acceptance((a->>'id')::uuid,p)->>'error' IS DISTINCT FROM 'TERMS_CHANGED' THEN RAISE EXCEPTION 'Wrong amount bound'; END IF;
 IF (SELECT payment_id FROM public."GigPaymentAcceptance" WHERE id=(a->>'id')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'Failed bind mutated attempt'; END IF;
 UPDATE public."Payment" SET amount_total=1250 WHERE id=p;
 r:=public.bind_paid_gig_acceptance((a->>'id')::uuid,p);
 IF r->'attempt'->>'payment_id' IS DISTINCT FROM p::text THEN RAISE EXCEPTION 'Valid binding failed'; END IF;
 IF public.finalize_paid_gig_acceptance(g,b,u,p)->>'error' IS DISTINCT FROM 'PAYMENT_NOT_AUTHORIZED' THEN RAISE EXCEPTION 'Unproven payment assigned'; END IF;
 IF (SELECT status FROM public."Gig" WHERE id=g)<>'open' OR (SELECT status FROM public."GigBid" WHERE id=b)<>'pending_payment' THEN
 RAISE EXCEPTION 'Denied assignment changed rows'; END IF;
 UPDATE public."Payment" SET payment_status=NULL,authorization_expires_at=now()+interval '1 day' WHERE id=p;
 IF public.finalize_paid_gig_acceptance(g,b,u,p)->>'error' IS DISTINCT FROM 'PAYMENT_NOT_AUTHORIZED' THEN RAISE EXCEPTION 'Null payment state assigned'; END IF;
 UPDATE public."Payment" SET payment_status='authorized' WHERE id=p;
 BEGIN UPDATE public."Gig" SET status=NULL WHERE id=g;
 RAISE EXCEPTION 'Active checkout gig changed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN UPDATE public."GigBid" SET bid_amount=1 WHERE id=b;
 RAISE EXCEPTION 'Active checkout bid changed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
RESET ROLE;
-- Force the second half of finalization to fail: the first Bid write must roll back.
CREATE FUNCTION pg_temp.fail_paid_gig_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.id='aae10000-0000-4000-8000-000000000101' AND NEW.status='assigned' THEN
 RAISE EXCEPTION 'contract forced assignment failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER paid_gig_contract_failure BEFORE UPDATE ON public."Gig" FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_paid_gig_assignment();
SET LOCAL ROLE service_role;
DO $$ BEGIN
 BEGIN
 PERFORM public.finalize_paid_gig_acceptance('aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000201',
 'aae10000-0000-4000-8000-000000000001','aae10000-0000-4000-8000-000000000301');
 RAISE EXCEPTION 'Forced assignment did not fail';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'contract forced assignment failure' THEN RAISE; END IF; END;
 IF (SELECT status FROM public."GigBid" WHERE id='aae10000-0000-4000-8000-000000000201')<>'pending_payment'
 OR (SELECT state FROM public."GigPaymentAcceptance" WHERE id=(SELECT attempt_id FROM paid_gig_contract_state))<>'pending' THEN
 RAISE EXCEPTION 'Partial assignment survived transaction failure'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER paid_gig_contract_failure ON public."Gig";
SET LOCAL ROLE service_role;
DO $$
DECLARE a uuid; p uuid; r jsonb; receipt jsonb;
 g uuid:='aae10000-0000-4000-8000-000000000101'; b uuid:='aae10000-0000-4000-8000-000000000201'; u uuid:='aae10000-0000-4000-8000-000000000001';
BEGIN
 SELECT attempt_id,payment_id INTO a,p FROM paid_gig_contract_state;
 IF public.cancel_paid_gig_acceptance('aae10000-0000-4000-8000-000000000102',b,'aae10000-0000-4000-8000-000000000004')->>'error' IS DISTINCT FROM 'NOT_FOUND' THEN
 RAISE EXCEPTION 'Owner of another gig canceled pending bid'; END IF;
 -- Cancellation fence wins over finalization, but an unknown cancellation keeps references.
 PERFORM public.cancel_paid_gig_acceptance(g,b,u);
 IF public.finalize_paid_gig_acceptance(g,b,u,p)->>'error' IS DISTINCT FROM 'PAYMENT_NOT_AUTHORIZED' THEN RAISE EXCEPTION 'Finalized during cancellation'; END IF;
 IF public.cancel_paid_gig_acceptance(g,b,u,true)->>'error' IS DISTINCT FROM 'CANCELLATION_NOT_CONFIRMED' THEN RAISE EXCEPTION 'Cleared unknown cancellation'; END IF;
 IF (SELECT pending_payment_intent_id FROM public."GigBid" WHERE id=b) IS DISTINCT FROM p::text THEN RAISE EXCEPTION 'Lost cancel identity'; END IF;
 UPDATE public."Payment" SET payment_status='canceled' WHERE id=p;
 PERFORM public.cancel_paid_gig_acceptance(g,b,u,true);
 IF public.cancel_paid_gig_acceptance(g,b,u,true)->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Cancellation retry failed'; END IF;
 -- Retry after proved cancellation gets a fresh operation; old records stay intact.
 r:=public.begin_paid_gig_acceptance(g,b,u); a:=(r->'attempt'->>'id')::uuid;
 IF a=(SELECT attempt_id FROM paid_gig_contract_state) THEN RAISE EXCEPTION 'Reused canceled provider operation'; END IF;
 p:='aae10000-0000-4000-8000-000000000302';
 INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 stripe_customer_id,stripe_payment_intent_id,payment_status,authorization_expires_at,metadata)
 VALUES(p,g,u,'aae10000-0000-4000-8000-000000000002',1250,1250,188,1062,'cus_contract1','pi_contract2','authorized',now()+interval '1 day',jsonb_build_object('acceptance_attempt_id',a));
 PERFORM public.bind_paid_gig_acceptance(a,p);
 r:=public.finalize_paid_gig_acceptance(g,b,u,p);
 IF r->'gig'->>'status' IS DISTINCT FROM 'assigned' OR r->'gig'->>'price' IS DISTINCT FROM '12.50' THEN RAISE EXCEPTION 'Valid paid assignment failed: %',r; END IF;
 IF public.finalize_paid_gig_acceptance(g,b,u,p)->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Lost-response assignment retry failed'; END IF;
 IF public.prepare_paid_gig_capture(p)->>'error' IS DISTINCT FROM 'TERMS_CHANGED' THEN RAISE EXCEPTION 'Capture before worker completion admitted'; END IF;
 UPDATE public."Gig" SET status='completed',worker_completed_at=now() WHERE id=g;
 r:=public.prepare_paid_gig_capture(p);
 IF r->'payment'->>'payment_status' IS DISTINCT FROM 'capture_pending' THEN RAISE EXCEPTION 'Capture not durably prepared'; END IF;
 IF public.record_paid_gig_capture(p,'pi_foreign','ch_contract',1250,'cus_contract1','usd')->>'error' IS DISTINCT FROM 'TERMS_CHANGED'
 OR public.record_paid_gig_capture(p,'pi_contract2','ch_contract',1200,'cus_contract1','usd')->>'error' IS DISTINCT FROM 'TERMS_CHANGED'
 OR public.record_paid_gig_capture(p,'pi_contract2','ch_contract',1250,'cus_foreign','usd')->>'error' IS DISTINCT FROM 'TERMS_CHANGED' THEN
 RAISE EXCEPTION 'Mismatched provider capture proof accepted'; END IF;
 r:=public.record_paid_gig_capture(p,'pi_contract2','ch_contract',1250,'cus_contract1','usd');
 receipt:=r->'payment';
 IF receipt->>'payment_status' IS DISTINCT FROM 'captured_hold' OR receipt->>'captured_at' IS NULL THEN RAISE EXCEPTION 'Missing captured receipt'; END IF;
 r:=public.record_paid_gig_capture(p,'pi_contract2','ch_contract',1250,'cus_contract1','usd');
 IF r->>'reused' IS DISTINCT FROM 'true' OR r->'payment' IS DISTINCT FROM receipt THEN RAISE EXCEPTION 'Retry changed capture receipt/cooling-off deadline'; END IF;
 IF (SELECT count(*) FROM public."Payment" WHERE gig_id=g)<>2 OR (SELECT count(*) FROM public."GigPaymentAcceptance" WHERE gig_id=g)<>2 THEN
 RAISE EXCEPTION 'Prior canceled financial records were lost'; END IF;
END $$;
RESET ROLE;
-- Real unprivileged roles retain involved reads but cannot manufacture proof.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public."Payment" WHERE gig_id='aae10000-0000-4000-8000-000000000101')<>2 THEN RAISE EXCEPTION 'Payer lost financial reads'; END IF;
 BEGIN UPDATE public."Payment" SET payment_status='authorized' WHERE id='aae10000-0000-4000-8000-000000000302';
 RAISE EXCEPTION 'Payer forged status'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public."Payment" WHERE id='aae10000-0000-4000-8000-000000000302';
 RAISE EXCEPTION 'Payer deleted receipt'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN TRUNCATE public."Payment" CASCADE; RAISE EXCEPTION 'Payer truncated finances'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public."Gig" SET description='Owner retains ordinary content edits' WHERE id='aae10000-0000-4000-8000-000000000101';
 BEGIN UPDATE public."Gig" SET payment_id=NULL WHERE id='aae10000-0000-4000-8000-000000000101';
 RAISE EXCEPTION 'Client unlinked payment'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.begin_paid_gig_acceptance('aae10000-0000-4000-8000-000000000101','aae10000-0000-4000-8000-000000000201','aae10000-0000-4000-8000-000000000001');
 RAISE EXCEPTION 'Client invoked service admission'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public."Payment" WHERE gig_id='aae10000-0000-4000-8000-000000000101')<>2 THEN RAISE EXCEPTION 'Payee lost financial reads'; END IF;
 BEGIN UPDATE public."Payment" SET amount_total=1 WHERE id='aae10000-0000-4000-8000-000000000302';
 RAISE EXCEPTION 'Payee forged amount'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','aae10000-0000-4000-8000-000000000004',true);
DO $$ BEGIN
 IF EXISTS(SELECT FROM public."Payment" WHERE gig_id='aae10000-0000-4000-8000-000000000101') THEN RAISE EXCEPTION 'Foreign actor read payment'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE r text; fn regprocedure; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  IF has_table_privilege(r,'public."Payment"','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'Client retained financial mutation privileges'; END IF;
  FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
   AND p.proname IN ('begin_paid_gig_acceptance','accept_free_gig_bid','bind_paid_gig_acceptance','finalize_paid_gig_acceptance',
    'cancel_paid_gig_acceptance','prepare_paid_gig_capture','record_paid_gig_capture') LOOP
   IF has_function_privilege(r,fn,'EXECUTE') THEN RAISE EXCEPTION 'Client acquired service RPC'; END IF;
  END LOOP;
 END LOOP;
END $$;
ROLLBACK;
