BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('aaf50000-0000-4000-8000-000000000001','wallet-settle-payer@example.invalid'),
 ('aaf50000-0000-4000-8000-000000000002','wallet-settle-worker@example.invalid'),
 ('aaf50000-0000-4000-8000-000000000003','wallet-settle-admin@example.invalid');
INSERT INTO public."User"(id,email,username,name,role) SELECT id,email,'wallet_settle_'||right(id::text,1),'Wallet settlement',
 CASE WHEN right(id::text,1)='3' THEN 'admin' ELSE 'user' END FROM auth.users WHERE id::text LIKE 'aaf50000-%';
INSERT INTO public."Gig"(id,user_id,created_by,title,description,price,status,accepted_by,worker_completed_at,owner_confirmed_at)
SELECT ('aaf50000-0000-4000-8000-00000000010'||i)::uuid,'aaf50000-0000-4000-8000-000000000001',
'aaf50000-0000-4000-8000-000000000001','Wallet settle','Synthetic',10,'completed','aaf50000-0000-4000-8000-000000000002',now()-interval '3 days',now()-interval '3 days'
FROM generate_series(1,5) i;
INSERT INTO public."Payment"(id,gig_id,payer_id,payee_id,amount_total,amount_subtotal,amount_platform_fee,amount_to_payee,
 stripe_customer_id,stripe_payment_intent_id,stripe_charge_id,payment_status,captured_at,cooling_off_ends_at)
SELECT ('aaf50000-0000-4000-8000-00000000030'||i)::uuid,('aaf50000-0000-4000-8000-00000000010'||i)::uuid,
'aaf50000-0000-4000-8000-000000000001','aaf50000-0000-4000-8000-000000000002',1000,1000,150,850,
'cus_settle','pi_settle'||i,'ch_settle'||i,'captured_hold',now()-interval '3 days',now()-interval '1 day'
FROM generate_series(1,5) i;
UPDATE public."Gig" g SET payment_id=p.id FROM public."Payment" p WHERE p.gig_id=g.id AND g.id::text LIKE 'aaf50000-%';
CREATE FUNCTION pg_temp.wallet_settle(p uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.settle_paid_gig_wallet_income(p,public.refund_payment_snapshot(x)) FROM public."Payment" x WHERE id=p
$$;
CREATE FUNCTION pg_temp.wallet_refund(p uuid,r uuid,amount integer,ref text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT public.record_payment_refund_receipts(p,public.refund_payment_snapshot(x),jsonb_build_array(jsonb_build_object(
 'id',ref,'intentId',x.stripe_payment_intent_id,'chargeId',x.stripe_charge_id,'currency','usd','amountCents',amount,
 'status','succeeded','requestId',r,'createdAt',now()))) FROM public."Payment" x WHERE id=p
$$;
SET LOCAL ROLE service_role;
DO $$ DECLARE p uuid:='aaf50000-0000-4000-8000-000000000301'; r uuid:='aaf50000-0000-4000-8000-000000000401';
 admin uuid:='aaf50000-0000-4000-8000-000000000003'; x jsonb; frozen jsonb; BEGIN
 PERFORM pg_temp.wallet_refund(p,NULL,300,'re_before_settle');
 x:=pg_temp.wallet_settle(p);
 IF x->'settlement'->>'amount_cents'<>'595' OR x->'settlement'->>'refund_basis_cents'<>'300' THEN RAISE EXCEPTION 'Wrong residual credit: %',x; END IF;
 IF x->'payment'->>'payment_status'<>'refunded_partial' OR x->'payment'->>'amount_to_payee'<>'850' THEN RAISE EXCEPTION 'Original terms or refund status changed'; END IF;
 IF pg_temp.wallet_settle(p)->>'reused' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Duplicate wallet settlement'; END IF;
 SELECT public.refund_payment_snapshot(t) INTO frozen FROM public."Payment" t WHERE id=p;
 IF public.reserve_payment_refund(p,r::text,'aaf50000-0000-4000-8000-000000000001','payer',200,'other',NULL,frozen,'refund')->>'error'
 IS DISTINCT FROM 'SUPPORT_REQUIRED' THEN RAISE EXCEPTION 'Residual credit left payer entitlement'; END IF;
 PERFORM public.reserve_payment_refund(p,r::text,admin,'admin',200,'other',NULL,frozen,'refund');
 PERFORM pg_temp.wallet_refund(p,r,200,'re_after_settle');
 IF (SELECT balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002')<>425 THEN RAISE EXCEPTION 'Earlier refund deducted twice'; END IF;
 IF (SELECT recovered_amount FROM public."PaymentRefundRecovery" WHERE payment_id=p)<>170 THEN RAISE EXCEPTION 'Wrong incremental recovery'; END IF;
 PERFORM pg_temp.wallet_refund(p,r,200,'re_after_settle');
 PERFORM public.reserve_payment_refund(p,'aaf50000-0000-4000-8000-000000000402',admin,'admin',NULL,'other',NULL,frozen,'refund');
 PERFORM pg_temp.wallet_refund(p,'aaf50000-0000-4000-8000-000000000402',500,'re_full_after_settle');
 IF (SELECT balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002')<>0
 OR (SELECT recovered_amount FROM public."PaymentRefundRecovery" WHERE payment_id=p)<>595 THEN RAISE EXCEPTION 'Full recovery did not sum to original residual credit'; END IF;
 BEGIN UPDATE public."Payment" SET amount_to_payee=900 WHERE id=p; RAISE EXCEPTION 'Settled allocation changed'; EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;
DO $$ DECLARE p uuid:='aaf50000-0000-4000-8000-000000000302'; x jsonb; BEGIN
 UPDATE public."Payment" SET cooling_off_ends_at=now()+interval '1 day' WHERE id=p;
 IF pg_temp.wallet_settle(p)->>'error' IS DISTINCT FROM 'COOLING_OFF' THEN RAISE EXCEPTION 'Early settlement'; END IF;
 UPDATE public."Payment" SET cooling_off_ends_at=now()-interval '1 day' WHERE id=p;
 UPDATE public."Gig" SET owner_confirmed_at=NULL WHERE payment_id=p;
 IF pg_temp.wallet_settle(p)->>'error' IS DISTINCT FROM 'GIG_TERMS_CHANGED' THEN RAISE EXCEPTION 'Unconfirmed work paid'; END IF;
 UPDATE public."Gig" SET owner_confirmed_at=now()-interval '3 days' WHERE payment_id=p;
 UPDATE public."Payment" SET dispute_id='dp_settle' WHERE id=p;
 IF pg_temp.wallet_settle(p)->>'error' IS DISTINCT FROM 'PAYMENT_STATE' THEN RAISE EXCEPTION 'Dispute paid'; END IF;
 UPDATE public."Payment" SET dispute_id=NULL WHERE id=p;
 PERFORM pg_temp.wallet_refund(p,NULL,1000,'re_zero_settle');
 x:=pg_temp.wallet_settle(p);
 IF x->'settlement'->>'status'<>'no_earnings' OR x->'settlement'->>'amount_cents'<>'0'
 OR EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p) THEN RAISE EXCEPTION 'Zero residual created wallet money'; END IF;
END $$;
-- Legacy exact full income adopts basis zero; ambiguous/contradictory legacy
-- credits remain untouched instead of being interpreted as another payout.
DO $$ DECLARE p uuid:='aaf50000-0000-4000-8000-000000000303'; x jsonb; BEGIN
 PERFORM public.wallet_credit('aaf50000-0000-4000-8000-000000000002',850,'gig_income',NULL,p,
 'aaf50000-0000-4000-8000-000000000103','aaf50000-0000-4000-8000-000000000001',NULL,'legacy-settle');
 x:=pg_temp.wallet_settle(p);
 IF x->'settlement'->>'refund_basis_cents'<>'0' OR x->'settlement'->>'amount_cents'<>'850' THEN RAISE EXCEPTION 'Legacy basis incorrect'; END IF;
 IF (SELECT count(*) FROM public."WalletTransaction" WHERE payment_id=p)<>1 THEN RAISE EXCEPTION 'Legacy credit duplicated'; END IF;
END $$;
DO $$ DECLARE p uuid:='aaf50000-0000-4000-8000-000000000305'; frozen jsonb; x jsonb; before_balance bigint; BEGIN
 SELECT public.refund_payment_snapshot(t) INTO frozen FROM public."Payment" t WHERE id=p;
 IF public.settle_paid_gig_wallet_income(p,jsonb_set(frozen,'{payer_id}','"foreign"'))->>'error' IS DISTINCT FROM 'TERMS_CHANGED' THEN
 RAISE EXCEPTION 'Stale payer proof admitted'; END IF;
 PERFORM public.reserve_payment_refund(p,'aaf50000-0000-4000-8000-000000000405',
 'aaf50000-0000-4000-8000-000000000001','payer',50,'other',NULL,frozen,'refund');
 IF pg_temp.wallet_settle(p)->>'error' NOT IN ('PAYMENT_STATE','REFUND_ACTIVE') THEN RAISE EXCEPTION 'Active refund released money'; END IF;
 DELETE FROM public."PaymentRefundRequest" WHERE payment_id=p;
 UPDATE public."Payment" SET payment_status='captured_hold',amount_total=101,amount_subtotal=101,amount_platform_fee=1,amount_to_payee=100 WHERE id=p;
 UPDATE public."Gig" SET price=1.01 WHERE payment_id=p;
 PERFORM pg_temp.wallet_refund(p,NULL,50,'re_round_before');
 x:=pg_temp.wallet_settle(p);
 IF x->'settlement'->>'amount_cents'<>'51' OR x->'settlement'->>'refund_basis_cents'<>'50' THEN RAISE EXCEPTION 'Residual cent rounding wrong'; END IF;
 SELECT balance INTO before_balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002';
 UPDATE public."Wallet" SET frozen=true WHERE user_id='aaf50000-0000-4000-8000-000000000002';
 PERFORM pg_temp.wallet_refund(p,NULL,51,'re_round_after');
 IF (SELECT debt_amount FROM public."PaymentRefundRecovery" WHERE payment_id=p)<>51
 OR (SELECT balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002')<>before_balance THEN RAISE EXCEPTION 'Frozen wallet debited or debt lost'; END IF;
 UPDATE public."Wallet" SET frozen=false WHERE user_id='aaf50000-0000-4000-8000-000000000002';
 PERFORM public.settle_payment_refund_wallet(p);
 IF (SELECT recovered_amount FROM public."PaymentRefundRecovery" WHERE payment_id=p)<>51
 OR (SELECT debt_amount FROM public."PaymentRefundRecovery" WHERE payment_id=p)<>0 THEN RAISE EXCEPTION 'Incremental debt did not recover'; END IF;
END $$;
-- A non-USD wallet cannot receive a USD residual credit. Validation after the
-- preserved primitive must roll back its balance and income row together.
DO $$ DECLARE p uuid:='aaf50000-0000-4000-8000-000000000304'; before_balance bigint; BEGIN
 SELECT balance INTO before_balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002';
 UPDATE public."Wallet" SET currency='EUR' WHERE user_id='aaf50000-0000-4000-8000-000000000002';
 BEGIN PERFORM pg_temp.wallet_settle(p); RAISE EXCEPTION 'EUR wallet credited'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p)
 OR EXISTS(SELECT FROM public."PaymentWalletSettlement" WHERE payment_id=p)
 OR (SELECT balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002')<>before_balance THEN RAISE EXCEPTION 'Wrong wallet credit survived rollback'; END IF;
 UPDATE public."Wallet" SET currency='USD' WHERE user_id='aaf50000-0000-4000-8000-000000000002';
 -- Legacy credit corruption must not be silently selected as debit authority.
 PERFORM public.wallet_credit('aaf50000-0000-4000-8000-000000000002',850,'gig_income',NULL,p,
 'aaf50000-0000-4000-8000-000000000104','aaf50000-0000-4000-8000-000000000001',NULL,'legacy-malformed-settle');
 SELECT balance INTO before_balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002';
 UPDATE public."WalletTransaction" SET counterparty_id='aaf50000-0000-4000-8000-000000000003' WHERE payment_id=p;
 BEGIN PERFORM pg_temp.wallet_refund(p,NULL,200,'re_malformed_legacy'); RAISE EXCEPTION 'Malformed credit authorized debit'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p)
 OR (SELECT balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002')<>before_balance THEN RAISE EXCEPTION 'Malformed legacy recovery committed'; END IF;
 UPDATE public."WalletTransaction" SET counterparty_id='aaf50000-0000-4000-8000-000000000001' WHERE payment_id=p;
 PERFORM public.wallet_credit_before_refund_fence('aaf50000-0000-4000-8000-000000000002',850,'gig_income',NULL,p,
 'aaf50000-0000-4000-8000-000000000104','aaf50000-0000-4000-8000-000000000001',NULL,'legacy-duplicate-settle');
 BEGIN PERFORM pg_temp.wallet_refund(p,NULL,200,'re_duplicate_legacy'); RAISE EXCEPTION 'Duplicate credit authorized debit'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p)
 OR EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p AND direction='debit') THEN RAISE EXCEPTION 'Duplicate legacy recovery committed'; END IF;
 -- Restore only the synthetic legacy rows so the next failure-injection case
 -- remains an actual new-credit path with no pre-existing income.
 DELETE FROM public."WalletTransaction" WHERE payment_id=p;
 UPDATE public."Wallet" SET balance=balance-1700,lifetime_received=lifetime_received-1700 WHERE user_id='aaf50000-0000-4000-8000-000000000002';
END $$;
RESET ROLE;
CREATE FUNCTION pg_temp.wallet_settle_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.payment_id='aaf50000-0000-4000-8000-000000000304' THEN RAISE EXCEPTION 'forced settlement failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER wallet_settle_contract_fail BEFORE INSERT ON public."PaymentWalletSettlement" FOR EACH ROW EXECUTE FUNCTION pg_temp.wallet_settle_fail();
SET LOCAL ROLE service_role;
DO $$ DECLARE before_balance bigint; BEGIN
 SELECT balance INTO before_balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002';
 BEGIN PERFORM pg_temp.wallet_settle('aaf50000-0000-4000-8000-000000000304'); RAISE EXCEPTION 'Failure not injected';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced settlement failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id='aaf50000-0000-4000-8000-000000000304')
 OR (SELECT balance FROM public."Wallet" WHERE user_id='aaf50000-0000-4000-8000-000000000002')<>before_balance THEN
 RAISE EXCEPTION 'Partial wallet credit survived receipt failure'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER wallet_settle_contract_fail ON public."PaymentWalletSettlement";
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.settle_paid_gig_wallet_income('aaf50000-0000-4000-8000-000000000305','{}');
 RAISE EXCEPTION 'Client settled income'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN SELECT * FROM public."PaymentWalletSettlement"; RAISE EXCEPTION 'Client read frozen internal terms'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
