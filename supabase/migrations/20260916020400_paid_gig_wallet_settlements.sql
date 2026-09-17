-- Backwards compatible: yes. Existing financial rows are preserved. New paid
-- gig income uses one protected receipt; original amounts are never reduced.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."PaymentWalletSettlement" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 payment_id uuid NOT NULL UNIQUE REFERENCES public."Payment"(id) ON DELETE RESTRICT,
 wallet_transaction_id uuid UNIQUE REFERENCES public."WalletTransaction"(id) ON DELETE RESTRICT,
 frozen_payment jsonb NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents>=0),
 refund_basis_cents integer NOT NULL CHECK(refund_basis_cents>=0),
 currency text NOT NULL CHECK(currency='usd'),
 status text NOT NULL CHECK(status IN ('credited','no_earnings')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='credited' AND amount_cents>0 AND wallet_transaction_id IS NOT NULL)
   OR (status='no_earnings' AND amount_cents=0 AND wallet_transaction_id IS NULL))
);
ALTER TABLE public."PaymentWalletSettlement" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PaymentWalletSettlement" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."PaymentWalletSettlement" TO service_role;

CREATE FUNCTION public.settle_paid_gig_wallet_income(p_payment_id uuid,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; g public."Gig"; s public."PaymentWalletSettlement";
 tx public."WalletTransaction"; income public."WalletTransaction"; verified_total bigint; net integer; income_count integer;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF public.refund_payment_snapshot(p) IS DISTINCT FROM p_expected THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 SELECT * INTO s FROM public."PaymentWalletSettlement" WHERE payment_id=p.id FOR UPDATE;
 IF FOUND THEN
  IF s.frozen_payment IS DISTINCT FROM public.refund_payment_snapshot(p) THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
  IF s.wallet_transaction_id IS NOT NULL AND NOT EXISTS(SELECT FROM public."WalletTransaction" t JOIN public."Wallet" w ON w.id=t.wallet_id WHERE t.id=s.wallet_transaction_id
   AND t.payment_id=p.id AND t.user_id=p.payee_id AND t.counterparty_id=p.payer_id AND t.gig_id=p.gig_id
   AND t.amount=s.amount_cents AND t.direction='credit' AND t.type='gig_income' AND w.user_id=p.payee_id AND lower(w.currency)='usd') THEN RETURN jsonb_build_object('error','SETTLEMENT_PROOF_REQUIRED'); END IF;
  RETURN jsonb_build_object('payment',to_jsonb(p),'settlement',to_jsonb(s),'reused',true);
 END IF;
 IF p.payment_type IS DISTINCT FROM 'gig_payment' OR p.gig_id IS NULL OR p.captured_at IS NULL
  OR p.stripe_charge_id IS NULL OR p.stripe_customer_id IS NULL OR p.stripe_payment_intent_id IS NULL
  OR lower(p.currency) IS DISTINCT FROM 'usd' OR p.amount_total<50 OR p.amount_to_payee<0 OR p.amount_to_payee>p.amount_total THEN
  RETURN jsonb_build_object('error','CAPTURE_PROOF_REQUIRED'); END IF;
 IF p.payment_status NOT IN ('captured_hold','transfer_scheduled','refunded_partial','refunded_full','transferred')
  OR p.payment_status IS NULL OR p.dispute_id IS NOT NULL OR p.stripe_transfer_id IS NOT NULL THEN
  RETURN jsonb_build_object('error','PAYMENT_STATE'); END IF;
 IF coalesce(p.cooling_off_ends_at,p.captured_at+interval '48 hours')>clock_timestamp() THEN RETURN jsonb_build_object('error','COOLING_OFF'); END IF;
 IF EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
  OR EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status IN ('pending','requires_action')) THEN
  RETURN jsonb_build_object('error','REFUND_ACTIVE'); END IF;
 SELECT * INTO g FROM public."Gig" WHERE id=p.gig_id FOR UPDATE;
 IF NOT FOUND OR g.payment_id IS DISTINCT FROM p.id OR g.user_id IS DISTINCT FROM p.payer_id
  OR g.accepted_by IS DISTINCT FROM p.payee_id OR g.status IS DISTINCT FROM 'completed'
  OR g.worker_completed_at IS NULL OR g.owner_confirmed_at IS NULL OR round(g.price*100)::bigint IS DISTINCT FROM p.amount_total THEN
  RETURN jsonb_build_object('error','GIG_TERMS_CHANGED'); END IF;
 SELECT coalesce(sum(amount_cents),0) INTO verified_total FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status='succeeded';
 IF verified_total IS DISTINCT FROM coalesce(p.refunded_amount,0)::bigint OR verified_total>p.amount_total THEN
  RETURN jsonb_build_object('error','REFUND_PROOF_REQUIRED'); END IF;
 SELECT count(*) INTO income_count FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income') AND direction='credit';
 IF income_count>1 THEN RETURN jsonb_build_object('error','SETTLEMENT_PROOF_REQUIRED'); END IF;
 IF income_count=1 THEN
  SELECT * INTO income FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income') AND direction='credit';
  IF income.user_id IS DISTINCT FROM p.payee_id OR income.counterparty_id IS DISTINCT FROM p.payer_id
   OR income.gig_id IS DISTINCT FROM p.gig_id OR income.type<>'gig_income' OR income.amount IS DISTINCT FROM p.amount_to_payee
   OR NOT EXISTS(SELECT FROM public."Wallet" WHERE id=income.wallet_id AND user_id=p.payee_id AND lower(currency)='usd') THEN
   RETURN jsonb_build_object('error','SETTLEMENT_PROOF_REQUIRED'); END IF;
  -- Exact historical full credit has basis zero. A later refund is recovered
  -- from that original credit by the separate verified refund transaction.
  INSERT INTO public."PaymentWalletSettlement"(payment_id,wallet_transaction_id,frozen_payment,amount_cents,refund_basis_cents,currency,status)
  VALUES(p.id,income.id,public.refund_payment_snapshot(p),income.amount,0,'usd','credited') RETURNING * INTO s;
 ELSE
  IF p.payment_status='transferred' OR p.transfer_status='wallet_credited' THEN RETURN jsonb_build_object('error','SETTLEMENT_PROOF_REQUIRED'); END IF;
  net:=p.amount_to_payee-floor(verified_total::numeric*p.amount_to_payee/p.amount_total);
  IF net>0 THEN
   -- The preserved primitive is service-only. Only this transaction computes
   -- and freezes a residual income amount; legacy wrappers still reject it.
   tx:=public.wallet_credit_before_refund_fence(p.payee_id,net,'gig_income','Income from completed gig',
    p.id,p.gig_id,p.payer_id,NULL,('gig_income:'||p.id)::varchar,
    jsonb_build_object('verified_wallet_settlement',true,'refund_basis_cents',verified_total));
   IF tx.payment_id IS DISTINCT FROM p.id OR tx.user_id IS DISTINCT FROM p.payee_id OR tx.counterparty_id IS DISTINCT FROM p.payer_id
    OR tx.gig_id IS DISTINCT FROM p.gig_id OR tx.amount IS DISTINCT FROM net OR tx.direction<>'credit' OR tx.type<>'gig_income'
    OR NOT EXISTS(SELECT FROM public."Wallet" WHERE id=tx.wallet_id AND user_id=p.payee_id AND lower(currency)='usd') THEN
    RAISE EXCEPTION 'Wallet settlement receipt mismatch' USING ERRCODE='40001'; END IF;
  END IF;
  INSERT INTO public."PaymentWalletSettlement"(payment_id,wallet_transaction_id,frozen_payment,amount_cents,refund_basis_cents,currency,status)
  VALUES(p.id,tx.id,public.refund_payment_snapshot(p),net,verified_total,'usd',CASE WHEN net>0 THEN 'credited' ELSE 'no_earnings' END) RETURNING * INTO s;
 END IF;
 -- Refund status and worker settlement are distinct. Preserve partial/full
 -- refund accounting instead of hiding it behind a generic transferred state.
 UPDATE public."Payment" SET payment_status=CASE WHEN verified_total>0 THEN payment_status ELSE 'transferred' END,
  transfer_status=CASE WHEN s.amount_cents>0 THEN 'wallet_credited' ELSE transfer_status END,
  transfer_completed_at=coalesce(transfer_completed_at,clock_timestamp()),updated_at=clock_timestamp()
 WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=p.gig_id AND payment_id=p.id;
 PERFORM public.settle_payment_refund_wallet(p.id);
 RETURN jsonb_build_object('payment',to_jsonb(p),'settlement',to_jsonb(s),'reused',false);
END $$;

-- Protect payment identity after a durable settlement. Refund/status progress
-- remains allowed, while changing the original worker or money terms does not.
CREATE FUNCTION public.freeze_wallet_settlement_terms() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF public.refund_payment_snapshot(NEW) IS DISTINCT FROM public.refund_payment_snapshot(OLD)
  AND EXISTS(SELECT FROM public."PaymentWalletSettlement" WHERE payment_id=OLD.id) THEN
  RAISE EXCEPTION 'Settled payment terms are frozen' USING ERRCODE='40001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER freeze_wallet_settlement_terms BEFORE UPDATE ON public."Payment"
 FOR EACH ROW EXECUTE FUNCTION public.freeze_wallet_settlement_terms();

CREATE OR REPLACE FUNCTION public.settle_payment_refund_wallet(p_payment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; recovery public."PaymentRefundRecovery"; w public."Wallet";
 s public."PaymentWalletSettlement"; target integer; paid integer; owed integer; basis integer:=0; income_count integer;
 tx public."WalletTransaction"; credit public."WalletTransaction";
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 SELECT * INTO s FROM public."PaymentWalletSettlement" WHERE payment_id=p.id FOR UPDATE;
 IF FOUND THEN
  IF s.frozen_payment IS DISTINCT FROM public.refund_payment_snapshot(p) THEN RAISE EXCEPTION 'Settlement terms changed' USING ERRCODE='40001'; END IF;
  basis:=s.refund_basis_cents;
  IF s.status='no_earnings' THEN RETURN jsonb_build_object('required',false); END IF;
  SELECT * INTO credit FROM public."WalletTransaction" WHERE id=s.wallet_transaction_id AND payment_id=p.id
   AND user_id=p.payee_id AND counterparty_id=p.payer_id AND gig_id=p.gig_id
   AND amount=s.amount_cents AND type='gig_income' AND direction='credit';
  IF NOT FOUND OR NOT EXISTS(SELECT FROM public."Wallet" WHERE id=credit.wallet_id AND user_id=p.payee_id AND lower(currency)='usd') THEN RAISE EXCEPTION 'Settlement credit proof missing' USING ERRCODE='40001'; END IF;
 ELSE
  SELECT count(*) INTO income_count FROM public."WalletTransaction" WHERE payment_id=p.id
   AND type IN ('gig_income','tip_income') AND direction='credit';
  IF income_count>1 THEN RAISE EXCEPTION 'Legacy settlement credit is ambiguous' USING ERRCODE='40001'; END IF;
  IF income_count=1 THEN
   SELECT * INTO credit FROM public."WalletTransaction" WHERE payment_id=p.id AND type IN ('gig_income','tip_income') AND direction='credit';
   IF credit.user_id IS DISTINCT FROM p.payee_id OR credit.counterparty_id IS DISTINCT FROM p.payer_id
    OR credit.gig_id IS DISTINCT FROM p.gig_id OR credit.amount IS DISTINCT FROM p.amount_to_payee
    OR credit.type IS DISTINCT FROM (CASE WHEN p.payment_type='tip' THEN 'tip_income' ELSE 'gig_income' END)
    OR NOT EXISTS(SELECT FROM public."Wallet" WHERE id=credit.wallet_id AND user_id=p.payee_id AND lower(currency)='usd') THEN
    RAISE EXCEPTION 'Legacy settlement credit proof missing' USING ERRCODE='40001'; END IF;
  END IF;
 END IF;
 IF credit.id IS NULL AND p.stripe_transfer_id IS NULL THEN RETURN jsonb_build_object('required',false); END IF;
 -- Refunds already deducted before residual credit must not be clawed back
 -- again. Cumulative floors make multiple partial refunds sum exactly.
 IF coalesce(p.refunded_amount,0)<basis THEN RAISE EXCEPTION 'Refund basis regressed' USING ERRCODE='40001'; END IF;
 target:=floor(coalesce(p.refunded_amount,0)::numeric*p.amount_to_payee/p.amount_total)
  -floor(basis::numeric*p.amount_to_payee/p.amount_total);
 SELECT * INTO recovery FROM public."PaymentRefundRecovery" WHERE payment_id=p.id FOR UPDATE;
 paid:=coalesce(recovery.recovered_amount,0);
 IF target<paid THEN RAISE EXCEPTION 'Refund recovery amount cannot regress' USING ERRCODE='40001'; END IF;
 owed:=target-paid;
 IF p.stripe_transfer_id IS NULL AND owed>0 THEN
  SELECT * INTO w FROM public."Wallet" WHERE id=credit.wallet_id AND user_id=p.payee_id FOR UPDATE;
  IF w.id IS NOT NULL AND NOT w.frozen AND w.balance>=owed THEN
   tx:=public.wallet_debit(p.payee_id,owed,'adjustment','Refund recovery',p.id,p.gig_id,p.payer_id,NULL,
    ('refund-wallet:'||p.id||':'||target)::varchar,jsonb_build_object('verified_refund_recovery',true,'refund_basis_cents',basis));
   IF tx.direction<>'debit' OR tx.amount<>owed OR tx.payment_id IS DISTINCT FROM p.id OR tx.user_id<>p.payee_id THEN
    RAISE EXCEPTION 'Wallet refund recovery receipt mismatch' USING ERRCODE='40001'; END IF;
   paid:=paid+owed; owed:=0;
  END IF;
 END IF;
 INSERT INTO public."PaymentRefundRecovery"(payment_id,target_amount,recovered_amount,debt_amount,kind)
 VALUES(p.id,target,paid,owed,CASE WHEN p.stripe_transfer_id IS NOT NULL THEN 'stripe_transfer' ELSE 'wallet' END)
 ON CONFLICT(payment_id) DO UPDATE SET target_amount=EXCLUDED.target_amount,recovered_amount=EXCLUDED.recovered_amount,
  debt_amount=EXCLUDED.debt_amount,updated_at=clock_timestamp();
 UPDATE public."PaymentRefundRequest" SET reversal_status=CASE WHEN owed>0 THEN 'debt' ELSE 'succeeded' END,
  updated_at=clock_timestamp() WHERE payment_id=p.id AND operation='refund' AND status='succeeded';
 RETURN jsonb_build_object('target',target,'recovered',paid,'debt',owed);
END $$;

REVOKE ALL ON FUNCTION public.settle_paid_gig_wallet_income(uuid,jsonb),public.freeze_wallet_settlement_terms() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paid_gig_wallet_income(uuid,jsonb),public.freeze_wallet_settlement_terms() TO service_role;
