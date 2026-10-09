-- Backwards compatible: yes. Adds one service-only function; no table, column or existing
-- function changes.
-- A refund or a lost payment dispute that found too little in the payee's wallet leaves what is
-- still owed in PaymentRefundRecovery.debt_amount (kind 'wallet'): settle_payment_refund_wallet
-- debits only when the whole amount is there, and nothing collected the rest. Founder decision
-- 2026-10-09 (before live Stripe keys): the payee's next income pays it off before anything is
-- withdrawable. This pays open wallet debts from the wallet's balance, oldest first and partly
-- when that is all there is, and returns what is still owed.
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.collect_wallet_refund_debts(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; w public."Wallet"; take bigint; collected bigint:=0; remaining bigint:=0; cleared integer:=0;
 tx public."WalletTransaction";
BEGIN
 IF p_user_id IS NULL THEN RETURN jsonb_build_object('error','USER_REQUIRED'); END IF;
 -- settle_payment_refund_wallet's lock order: the payments, their recovery rows, then the wallet.
 PERFORM 1 FROM public."Payment" p
  WHERE p.payee_id=p_user_id AND EXISTS(SELECT FROM public."PaymentRefundRecovery" rr
   WHERE rr.payment_id=p.id AND rr.kind='wallet' AND rr.debt_amount>0)
  ORDER BY p.id FOR UPDATE;
 PERFORM 1 FROM public."PaymentRefundRecovery" rr
  WHERE rr.kind='wallet' AND rr.debt_amount>0
   AND rr.payment_id IN (SELECT id FROM public."Payment" WHERE payee_id=p_user_id)
  ORDER BY rr.payment_id FOR UPDATE;
 SELECT * INTO w FROM public."Wallet" WHERE user_id=p_user_id AND lower(currency)='usd' FOR UPDATE;
 FOR r IN SELECT rr.payment_id, rr.recovered_amount, rr.debt_amount, p.gig_id, p.payer_id
   FROM public."PaymentRefundRecovery" rr JOIN public."Payment" p ON p.id=rr.payment_id
   WHERE p.payee_id=p_user_id AND rr.kind='wallet' AND rr.debt_amount>0
   ORDER BY p.created_at, rr.payment_id LOOP
  take:=CASE WHEN w.id IS NULL OR w.frozen THEN 0 ELSE least(r.debt_amount::bigint, greatest(w.balance, 0)) END;
  IF take>0 THEN
   -- The key names the amount recovered after this debit, so each collection is its own ledger row.
   tx:=public.wallet_debit(p_user_id,take,'adjustment','Paid toward a refunded or disputed payment',
    r.payment_id,r.gig_id,r.payer_id,NULL,
    ('refund-debt:'||r.payment_id||':'||(r.recovered_amount+take))::varchar,
    jsonb_build_object('verified_refund_recovery',true,'refund_debt_collection',true,'debt_before_cents',r.debt_amount));
   IF tx.direction<>'debit' OR tx.amount<>take OR tx.payment_id IS DISTINCT FROM r.payment_id OR tx.user_id<>p_user_id THEN
    RAISE EXCEPTION 'Debt collection receipt mismatch' USING ERRCODE='40001'; END IF;
   UPDATE public."PaymentRefundRecovery" SET recovered_amount=recovered_amount+take::integer,
    debt_amount=debt_amount-take::integer, updated_at=clock_timestamp()
   WHERE payment_id=r.payment_id;
   w.balance:=w.balance-take;
   collected:=collected+take;
   IF take=r.debt_amount THEN
    cleared:=cleared+1;
    UPDATE public."PaymentRefundRequest" SET reversal_status='succeeded',updated_at=clock_timestamp()
    WHERE payment_id=r.payment_id AND operation='refund' AND status='succeeded' AND reversal_status='debt';
   END IF;
  END IF;
  remaining:=remaining+(r.debt_amount-take);
 END LOOP;
 RETURN jsonb_build_object('collected',collected,'remaining',remaining,'cleared',cleared);
END $$;

REVOKE ALL ON FUNCTION public.collect_wallet_refund_debts(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.collect_wallet_refund_debts(uuid) TO service_role;
