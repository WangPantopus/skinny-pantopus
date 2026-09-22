-- Backwards compatible: yes. A won dispute keeps its provider ID for history,
-- but no longer blocks otherwise eligible wallet income or stranded recovery.
-- Reproduced with a real TEST closed/won event: the worker skipped the mature
-- payment and the existing settlement RPC returned PAYMENT_STATE.
-- These guards live in already-applied functions; a forward replacement is
-- required. Reuse their bodies/signatures/privileges; do not rewrite history,
-- create parallel tables, clear dispute IDs, or bypass cooling/refund/proof locks.
-- Active, lost and unknown disputes with an ID remain blocked.
SET LOCAL lock_timeout='5s';

CREATE OR REPLACE FUNCTION public.settle_paid_gig_wallet_income(p_payment_id uuid,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE p public."Payment"; g public."Gig"; s public."PaymentWalletSettlement";
 tx public."WalletTransaction"; income public."WalletTransaction"; verified_total bigint; net integer; income_count integer; recipient record; event_id uuid; note_id uuid;
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
  OR p.payment_status IS NULL OR (p.dispute_id IS NOT NULL AND p.dispute_status IS DISTINCT FROM 'won') OR p.stripe_transfer_id IS NOT NULL THEN
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
  -- Materialize only a new, nonzero income. Historical adoption and existing
  -- receipts never replay notices or recreate a recipient-deleted notification.
  IF net>0 THEN
   FOR recipient IN SELECT p.payee_id AS user_id,'payout_sent'::text AS kind
     UNION ALL SELECT p.payer_id,'payment_completed' LOOP
    INSERT INTO public."PaymentWalletDelivery"(settlement_id,user_id,kind)
     VALUES(s.id,recipient.user_id,recipient.kind) RETURNING id INTO event_id;
    INSERT INTO public."Notification"(user_id,type,title,body,icon,link,metadata,idempotency_key)
     VALUES(recipient.user_id,recipient.kind,
      CASE WHEN recipient.kind='payout_sent' THEN '$'||to_char(net/100.0,'FM9999999990.00')||' credited to your wallet'
       ELSE 'Worker earnings credited' END,
      CASE WHEN recipient.kind='payout_sent' THEN 'Your gig earnings were credited to your Pantopus wallet. Open your wallet for its current balance and withdrawal options.'
       ELSE '$'||to_char(net/100.0,'FM9999999990.00')||' was credited to the worker’s Pantopus wallet. This is the worker share after applicable fees and refunds.' END,
      CASE WHEN recipient.kind='payout_sent' THEN '💰' ELSE '✅' END,
      CASE WHEN recipient.kind='payout_sent' THEN '/app/wallet' ELSE '/gigs/'||p.gig_id END,
      jsonb_build_object('gig_id',p.gig_id,'payment_id',p.id,'wallet_settlement_id',s.id,
       'amount',net,'amount_cents',net,'currency','usd'),
      'wallet-settlement:'||s.id||':'||recipient.kind) RETURNING id INTO note_id;
    UPDATE public."PaymentWalletDelivery" SET notification_id=note_id WHERE id=event_id;
   END LOOP;
  END IF;
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

CREATE OR REPLACE FUNCTION public.reconcile_payment_wallet_release(p_payment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; credited boolean;
BEGIN
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.payment_status NOT IN ('transfer_scheduled','transfer_pending') THEN RETURN jsonb_build_object('payment',to_jsonb(p),'changed',false); END IF;
 IF (p.dispute_id IS NOT NULL AND p.dispute_status IS DISTINCT FROM 'won') OR coalesce(p.refunded_amount,0)>0 OR EXISTS(SELECT FROM public."PaymentRefundRequest"
  WHERE payment_id=p.id AND status IN ('pending','requires_action')) THEN RETURN jsonb_build_object('error','REFUND_OR_DISPUTE'); END IF;
 SELECT EXISTS(SELECT FROM public."WalletTransaction" WHERE payment_id=p.id AND user_id=p.payee_id AND direction='credit'
  AND type IN ('gig_income','tip_income') AND amount=p.amount_to_payee) INTO credited;
 IF NOT credited AND (p.payment_status='transfer_pending' OR p.stripe_transfer_id IS NOT NULL) THEN RETURN jsonb_build_object('error','TRANSFER_UNKNOWN'); END IF;
 UPDATE public."Payment" SET payment_status=CASE WHEN credited THEN 'transferred' ELSE 'captured_hold' END,
  transfer_status=CASE WHEN credited THEN 'wallet_credited' ELSE transfer_status END,
  transfer_completed_at=CASE WHEN credited THEN coalesce(transfer_completed_at,clock_timestamp()) ELSE transfer_completed_at END,
  updated_at=clock_timestamp() WHERE id=p.id RETURNING * INTO p;
 UPDATE public."Gig" SET payment_status=p.payment_status,updated_at=clock_timestamp() WHERE id=p.gig_id AND payment_id=p.id;
 RETURN jsonb_build_object('payment',to_jsonb(p),'changed',true);
END $$;

CREATE OR REPLACE FUNCTION public.wallet_credit(p_user_id uuid,p_amount bigint,p_type character varying,p_description text DEFAULT NULL,
 p_payment_id uuid DEFAULT NULL,p_gig_id uuid DEFAULT NULL,p_counterparty_id uuid DEFAULT NULL,
 p_stripe_pi_id character varying DEFAULT NULL,p_idempotency_key character varying DEFAULT NULL,p_metadata jsonb DEFAULT '{}')
RETURNS public."WalletTransaction" LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public."Payment"; tx public."WalletTransaction";
BEGIN
 IF p_type IN ('gig_income','tip_income') AND p_payment_id IS NOT NULL THEN
  SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
  IF NOT FOUND OR p.payee_id IS DISTINCT FROM p_user_id OR p.payer_id IS DISTINCT FROM p_counterparty_id
   OR p.gig_id IS DISTINCT FROM p_gig_id OR p.amount_to_payee IS DISTINCT FROM p_amount OR p_amount<=0 THEN
   RAISE EXCEPTION 'Wallet income does not match payment' USING ERRCODE='40001'; END IF;
  SELECT * INTO tx FROM public."WalletTransaction" WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN
   IF tx.payment_id IS DISTINCT FROM p_payment_id OR tx.user_id IS DISTINCT FROM p_user_id OR tx.amount IS DISTINCT FROM p_amount
    OR tx.type IS DISTINCT FROM p_type OR tx.direction<>'credit' THEN
    RAISE EXCEPTION 'Wallet income receipt does not match' USING ERRCODE='40001'; END IF;
   RETURN tx;
  END IF;
  IF p.payment_status NOT IN ('captured_hold','transfer_scheduled') OR (p.dispute_id IS NOT NULL AND p.dispute_status IS DISTINCT FROM 'won') OR coalesce(p.refunded_amount,0)<>0
   OR EXISTS(SELECT FROM public."PaymentRefundRequest" WHERE payment_id=p.id AND status IN ('pending','requires_action'))
   OR EXISTS(SELECT FROM public."PaymentRefundReceipt" WHERE payment_id=p.id AND status IN ('pending','requires_action','succeeded')) THEN
   RAISE EXCEPTION 'Payment cannot be released while refund or dispute is active' USING ERRCODE='40001'; END IF;
 END IF;
 RETURN public.wallet_credit_before_refund_fence(p_user_id,p_amount,p_type,p_description,p_payment_id,p_gig_id,p_counterparty_id,
  p_stripe_pi_id,p_idempotency_key,p_metadata);
END $$;
