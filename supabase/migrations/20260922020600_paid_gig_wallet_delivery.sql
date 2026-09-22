-- Backwards compatible: yes. New wallet credits commit both their in-app
-- notices and durable delivery events with the money receipt. No historical
-- financial rewrite or historical notification backfill occurs.
SET LOCAL lock_timeout='5s';
CREATE TABLE public."PaymentWalletDelivery" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 settlement_id uuid NOT NULL REFERENCES public."PaymentWalletSettlement"(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('payout_sent','payment_completed')),
 notification_id uuid REFERENCES public."Notification"(id) ON DELETE SET NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','done','suppressed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 retry_at timestamptz NOT NULL DEFAULT now(),
 lease_id uuid,lease_until timestamptz,last_error text,completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(settlement_id,user_id,kind)
);
CREATE INDEX payment_wallet_delivery_pending ON public."PaymentWalletDelivery"(retry_at,created_at)
 WHERE state IN ('pending','processing');
ALTER TABLE public."PaymentWalletDelivery" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."PaymentWalletDelivery" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."PaymentWalletDelivery" TO service_role;

CREATE OR REPLACE FUNCTION public.settle_paid_gig_wallet_income(p_payment_id uuid,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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

CREATE FUNCTION public.claim_wallet_settlement_delivery()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE event public."PaymentWalletDelivery";
BEGIN
 SELECT * INTO event FROM public."PaymentWalletDelivery"
 WHERE (state='pending' AND retry_at<=clock_timestamp()) OR (state='processing' AND lease_until<=clock_timestamp())
 ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE public."PaymentWalletDelivery" SET state='processing',lease_id=gen_random_uuid(),
  lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1 WHERE id=event.id RETURNING * INTO event;
 RETURN to_jsonb(event);
END $$;

CREATE FUNCTION public.read_wallet_settlement_delivery(p_id uuid,p_lease_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE event public."PaymentWalletDelivery"; s public."PaymentWalletSettlement";
 p public."Payment"; note public."Notification"; eligible boolean;
BEGIN
 SELECT * INTO event FROM public."PaymentWalletDelivery" WHERE id=p_id AND lease_id=p_lease_id AND state='processing'
  AND lease_until>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','LEASE_LOST'); END IF;
 SELECT * INTO s FROM public."PaymentWalletSettlement" WHERE id=event.settlement_id;
 SELECT * INTO p FROM public."Payment" WHERE id=s.payment_id;
 SELECT * INTO note FROM public."Notification" WHERE id=event.notification_id AND user_id=event.user_id;
 eligible:=note.id IS NOT NULL AND s.status='credited' AND s.amount_cents>0
  AND p.payment_type='gig_payment' AND s.frozen_payment=public.refund_payment_snapshot(p)
  AND note.type=event.kind AND note.metadata->>'wallet_settlement_id'=s.id::text
  AND note.metadata->>'payment_id'=p.id::text AND note.metadata->>'amount_cents'=s.amount_cents::text
  AND EXISTS(SELECT FROM public."WalletTransaction" t JOIN public."Wallet" w ON w.id=t.wallet_id
   WHERE t.id=s.wallet_transaction_id AND t.payment_id=p.id AND t.user_id=p.payee_id
    AND t.counterparty_id=p.payer_id AND t.gig_id=p.gig_id AND t.direction='credit' AND t.type='gig_income'
    AND t.amount=s.amount_cents AND w.user_id=p.payee_id AND lower(w.currency)='usd');
 IF event.kind='payout_sent' THEN
  eligible:=eligible AND event.user_id=p.payee_id AND note.link='/app/wallet';
 ELSE
  eligible:=eligible AND event.user_id=p.payer_id AND note.link='/gigs/'||p.gig_id
   AND EXISTS(SELECT FROM public."Gig" WHERE id=p.gig_id AND user_id=p.payer_id AND payment_id=p.id);
 END IF;
 RETURN jsonb_build_object('eligible',coalesce(eligible,false),'notification',CASE WHEN eligible THEN to_jsonb(note) ELSE NULL END);
END $$;

CREATE FUNCTION public.finish_wallet_settlement_delivery(p_id uuid,p_lease_id uuid,p_outcome text,p_error text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
BEGIN
 IF p_outcome IS NULL OR p_outcome NOT IN ('done','suppressed','retry') THEN RETURN false; END IF;
 UPDATE public."PaymentWalletDelivery" SET state=CASE WHEN p_outcome='retry' THEN 'pending' ELSE p_outcome END,
  retry_at=clock_timestamp()+make_interval(secs=>least(3600,30*least(greatest(attempts,1),120))),
  lease_id=NULL,lease_until=NULL,last_error=left(p_error,100),
  completed_at=CASE WHEN p_outcome='retry' THEN NULL ELSE clock_timestamp() END
 WHERE id=p_id AND lease_id=p_lease_id AND state='processing' AND lease_until>clock_timestamp();
 RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.claim_wallet_settlement_delivery(),public.read_wallet_settlement_delivery(uuid,uuid),
 public.finish_wallet_settlement_delivery(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_wallet_settlement_delivery(),public.read_wallet_settlement_delivery(uuid,uuid),
 public.finish_wallet_settlement_delivery(uuid,uuid,text,text) TO service_role;
