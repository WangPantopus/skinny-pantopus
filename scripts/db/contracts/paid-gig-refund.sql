-- Real service/anonymous/authenticated roles; every fixture rolls back.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('aaf10000-0000-4000-8000-000000000001','refund-payer@example.invalid'),
 ('aaf10000-0000-4000-8000-000000000002','refund-worker@example.invalid'),
 ('aaf10000-0000-4000-8000-000000000003','refund-admin@example.invalid');
INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'refund_'||right(id::text,1),'Refund contract',
 CASE WHEN right(id::text,1)='3' THEN 'admin' ELSE 'user' END FROM auth.users WHERE id::text LIKE 'aaf10000-%';
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price) VALUES
 ('aaf10000-0000-4000-8000-000000000101','aaf10000-0000-4000-8000-000000000001','aaf10000-0000-4000-8000-000000000001','Refund contract','Synthetic',10);
INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 stripe_customer_id,stripe_payment_intent_id,stripe_charge_id,payment_status,captured_at) SELECT
 ('aaf10000-0000-4000-8000-00000000030'||i)::uuid,'aaf10000-0000-4000-8000-000000000101',
 'aaf10000-0000-4000-8000-000000000001','aaf10000-0000-4000-8000-000000000002',1000,1000,150,850,
 'cus_refund','pi_refund'||i,'ch_refund'||i,'captured_hold',now() FROM generate_series(1,5) i;
UPDATE public."Gig" SET payment_id='aaf10000-0000-4000-8000-000000000301' WHERE id='aaf10000-0000-4000-8000-000000000101';
CREATE FUNCTION pg_temp.refund_reserve(p uuid,r uuid,a uuid,mode text,amount integer DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.reserve_payment_refund(p,r::text,a,mode,amount,'requested_by_customer',NULL,
 public.refund_payment_snapshot(x),'refund') FROM public."Payment" x WHERE x.id=p
$$;
CREATE FUNCTION pg_temp.refund_record(p uuid,r uuid,amount integer,status text,ref text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.record_payment_refund_receipts(p,public.refund_payment_snapshot(x),jsonb_build_array(jsonb_build_object(
 'id',ref,'intentId',x.stripe_payment_intent_id,'chargeId',x.stripe_charge_id,'currency','usd','amountCents',amount,
 'status',status,'requestId',r,'createdAt',now()))) FROM public."Payment" x WHERE x.id=p
$$;
SET LOCAL ROLE service_role;
DO $$ DECLARE p uuid:='aaf10000-0000-4000-8000-000000000301'; r uuid:='aaf10000-0000-4000-8000-000000000401';
 payer uuid:='aaf10000-0000-4000-8000-000000000001'; worker uuid:='aaf10000-0000-4000-8000-000000000002'; x jsonb;
BEGIN
 IF pg_temp.refund_reserve(p,r,worker,'payer',300)->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Foreign payer admitted'; END IF;
 x:=pg_temp.refund_reserve(p,r,payer,'payer',300);
 IF x->'request'->>'amount_cents'<>'300' OR x->'request'->>'id'<>r::text THEN RAISE EXCEPTION 'Frozen partial amount lost'; END IF;
 IF pg_temp.refund_reserve(p,r,payer,'payer',300)->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Retry duplicated'; END IF;
 IF pg_temp.refund_reserve(p,r,payer,'payer',400)->>'error' IS DISTINCT FROM 'REQUEST_CONFLICT' THEN RAISE EXCEPTION 'Changed retry accepted'; END IF;
 IF pg_temp.refund_reserve(p,'aaf10000-0000-4000-8000-000000000402',payer,'payer',200)->>'error' IS DISTINCT FROM 'REFUND_ACTIVE' THEN RAISE EXCEPTION 'Concurrent refund admitted'; END IF;
 BEGIN UPDATE public."Payment" SET amount_total=1200 WHERE id=p; RAISE EXCEPTION 'Frozen amount changed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN UPDATE public."Payment" SET payment_status='transferred' WHERE id=p; RAISE EXCEPTION 'Stale webhook replaced pending refund'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM public.wallet_credit(worker,850,'gig_income',NULL,p,'aaf10000-0000-4000-8000-000000000101',payer,NULL,'refundblocked');
 RAISE EXCEPTION 'Refund allowed wallet release'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 PERFORM pg_temp.refund_record(p,r,300,'pending','re_contract1');
 IF (SELECT refunded_amount FROM public."Payment" WHERE id=p)<>0 THEN RAISE EXCEPTION 'Pending refund counted as returned'; END IF;
 PERFORM pg_temp.refund_record(p,r,300,'requires_action','re_contract1');
 IF (SELECT payment_status FROM public."Payment" WHERE id=p)<>'refund_pending' THEN RAISE EXCEPTION 'Action refund completed'; END IF;
 PERFORM pg_temp.refund_record(p,r,300,'succeeded','re_contract1');
 PERFORM pg_temp.refund_record(p,r,300,'pending','re_contract1');
 IF (SELECT refunded_amount FROM public."Payment" WHERE id=p)<>300 OR (SELECT payment_status FROM public."Payment" WHERE id=p)<>'refunded_partial' THEN RAISE EXCEPTION 'Final refund regressed'; END IF;
 x:=pg_temp.refund_reserve(p,'aaf10000-0000-4000-8000-000000000402',payer,'payer');
 IF x->'request'->>'amount_cents'<>'700' THEN RAISE EXCEPTION 'Default failed to use remaining'; END IF;
 PERFORM pg_temp.refund_record(p,'aaf10000-0000-4000-8000-000000000402',700,'succeeded','re_contract2');
 IF (SELECT refunded_amount FROM public."Payment" WHERE id=p)<>1000 OR (SELECT payment_status FROM public."Gig" WHERE payment_id=p)<>'refunded_full' THEN RAISE EXCEPTION 'Full refund accounting wrong'; END IF;
 IF pg_temp.refund_reserve(p,r,payer,'payer',300)->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Terminal retry lost receipt'; END IF;
 BEGIN PERFORM pg_temp.refund_record('aaf10000-0000-4000-8000-000000000302',NULL,300,'succeeded','re_contract1');
 RAISE EXCEPTION 'Receipt moved between payments'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
-- Wallet income is recovered exactly once; payer loses self-service entitlement
-- as soon as credit commits, even before the asynchronous status update.
DO $$ DECLARE p uuid:='aaf10000-0000-4000-8000-000000000302'; payer uuid:='aaf10000-0000-4000-8000-000000000001';
 worker uuid:='aaf10000-0000-4000-8000-000000000002'; admin uuid:='aaf10000-0000-4000-8000-000000000003';
 r uuid:='aaf10000-0000-4000-8000-000000000403';
BEGIN
 PERFORM public.wallet_credit(worker,850,'gig_income',NULL,p,'aaf10000-0000-4000-8000-000000000101',payer,NULL,'refundwalletcredit');
 IF pg_temp.refund_reserve(p,r,payer,'payer',500)->>'error' IS DISTINCT FROM 'SUPPORT_REQUIRED' THEN RAISE EXCEPTION 'Credited payer refund admitted'; END IF;
 PERFORM pg_temp.refund_reserve(p,r,admin,'admin',500);
 UPDATE public."User" SET role='user' WHERE id=admin;
 IF public.claim_payment_refund(r,admin,'admin',gen_random_uuid())->>'error' IS DISTINCT FROM 'FORBIDDEN' THEN RAISE EXCEPTION 'Revoked admin admitted'; END IF;
 UPDATE public."User" SET role='admin' WHERE id=admin;
 PERFORM pg_temp.refund_record(p,r,500,'succeeded','re_wallet');
 PERFORM pg_temp.refund_record(p,r,500,'succeeded','re_wallet');
 IF (SELECT balance FROM public."Wallet" WHERE user_id=worker)<>425 THEN RAISE EXCEPTION 'Wallet recovery not exact/idempotent'; END IF;
 IF (SELECT count(*) FROM public."WalletTransaction" WHERE payment_id=p AND direction='debit')<>1 THEN RAISE EXCEPTION 'Recovery duplicated'; END IF;
END $$;
-- A failure during compatibility-row persistence must roll back proof, request,
-- Payment and Gig together. Historical rows are not accepted as provider proof.
RESET ROLE;
CREATE FUNCTION pg_temp.refund_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.stripe_refund_id='re_force_failure' THEN RAISE EXCEPTION 'forced refund failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER refund_contract_fail BEFORE INSERT ON public."Refund" FOR EACH ROW EXECUTE FUNCTION pg_temp.refund_fail();
SET LOCAL ROLE service_role;
DO $$ DECLARE p uuid:='aaf10000-0000-4000-8000-000000000303'; r uuid:='aaf10000-0000-4000-8000-000000000404'; BEGIN
 PERFORM pg_temp.refund_reserve(p,r,'aaf10000-0000-4000-8000-000000000001','payer',200);
 BEGIN PERFORM pg_temp.refund_record(p,r,200,'succeeded','re_force_failure'); RAISE EXCEPTION 'Failure injection ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced refund failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE provider_refund_id='re_force_failure')
 OR (SELECT refunded_amount FROM public."Payment" WHERE id=p)<>0
 OR (SELECT status FROM public."PaymentRefundRequest" WHERE id=r)<>'pending' THEN RAISE EXCEPTION 'Partial receipt survived'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER refund_contract_fail ON public."Refund";
SET LOCAL ROLE service_role;
DO $$ DECLARE p uuid:='aaf10000-0000-4000-8000-000000000303'; r uuid:='aaf10000-0000-4000-8000-000000000404'; BEGIN
 UPDATE public."Payment" SET payment_status='disputed',dispute_id='dp_refund_contract' WHERE id=p;
 IF public.claim_payment_refund(r,'aaf10000-0000-4000-8000-000000000001','payer',gen_random_uuid())->>'error' IS DISTINCT FROM 'DISPUTED' THEN
 RAISE EXCEPTION 'Dispute admitted a new provider mutation'; END IF;
 PERFORM pg_temp.refund_record(p,r,200,'succeeded','re_proved_during_dispute');
 IF (SELECT payment_status FROM public."Payment" WHERE id=p)<>'disputed' OR (SELECT refunded_amount FROM public."Payment" WHERE id=p)<>200 THEN
 RAISE EXCEPTION 'Exact receipt lost or dispute erased'; END IF;
END $$;
RESET ROLE;

-- A hold release never adds to returned captured money.
SET LOCAL ROLE service_role;
DO $$ DECLARE p public."Payment"; r uuid:='aaf10000-0000-4000-8000-000000000405'; x jsonb; BEGIN
 UPDATE public."Payment" SET payment_status='authorized',captured_at=NULL,stripe_charge_id=NULL,capture_attempts=0
 WHERE id='aaf10000-0000-4000-8000-000000000304' RETURNING * INTO p;
 x:=public.reserve_payment_refund(p.id,r::text,p.payer_id,'payer',NULL,'other',NULL,public.refund_payment_snapshot(p),'release');
 IF x->'request'->>'operation'<>'release' THEN RAISE EXCEPTION 'Release not reserved'; END IF;
 x:=public.record_payment_refund_release(r,public.refund_payment_snapshot(p),p.stripe_payment_intent_id,'canceled');
 IF x->'request'->>'status'<>'succeeded' OR x->'payment'->>'payment_status'<>'canceled'
 OR (x->'payment'->>'refunded_amount')::int<>0 THEN RAISE EXCEPTION 'Hold release reported money returned'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaf10000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public."Refund")<>4 THEN RAISE EXCEPTION 'Payer receipt reads lost'; END IF;
 BEGIN INSERT INTO public."Refund"(payment_id,amount,initiated_by,refund_status) VALUES
 ('aaf10000-0000-4000-8000-000000000301',100,'aaf10000-0000-4000-8000-000000000001','succeeded');
 RAISE EXCEPTION 'Client forged refund'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.wallet_credit('aaf10000-0000-4000-8000-000000000001',100,'gig_income');
 RAISE EXCEPTION 'Client manufactured wallet income'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.settle_payment_refund_wallet('aaf10000-0000-4000-8000-000000000301');
 RAISE EXCEPTION 'Client settled refund'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public."PaymentRefundRequest"; RAISE EXCEPTION 'Client accessed request internals'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.get_or_create_wallet('aaf10000-0000-4000-8000-000000000001');
 RAISE EXCEPTION 'Anon mutated wallet'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
