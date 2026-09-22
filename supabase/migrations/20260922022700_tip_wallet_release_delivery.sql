-- Backwards compatible: yes. The existing settlement and delivery tables also
-- protect new tip wallet credits. Historical credits never replay notices.
-- A forward migration is necessary because the existing applied functions only
-- admit gig_payment. Reuse their locks, proof, refund fencing and delivery leases;
-- do not create a parallel outbox or rewrite applied migration history.
-- Target the inner implementation retained by 20900; its public wrapper must
-- keep the Gig→Payment stop fence. This unmerged candidate was renumbered from
-- 22400 after fresh-schema CI exposed the wrong target. An exact prior delivery
-- transformation is accepted for retained candidate databases; unknown shapes fail.
SET LOCAL lock_timeout='5s';

DO $migration$
DECLARE definition text; replacement record;
BEGIN
 definition:=pg_get_functiondef('public.settle_paid_gig_wallet_income_before_stop_fence(uuid,jsonb)'::regprocedure);
 FOR replacement IN SELECT * FROM (VALUES
  ($old$p.payment_type IS DISTINCT FROM 'gig_payment'$old$,
   $new$(p.payment_type IS NULL OR p.payment_type NOT IN ('gig_payment','tip'))$new$),
  ($old$t.type='gig_income'$old$,
   $new$t.type=(CASE WHEN p.payment_type='tip' THEN 'tip_income' ELSE 'gig_income' END)$new$),
  ($old$income.type<>'gig_income'$old$,
   $new$income.type IS DISTINCT FROM (CASE WHEN p.payment_type='tip' THEN 'tip_income' ELSE 'gig_income' END)$new$),
  ($old$tx.type<>'gig_income'$old$,
   $new$tx.type IS DISTINCT FROM (CASE WHEN p.payment_type='tip' THEN 'tip_income' ELSE 'gig_income' END)$new$),
  ($old$IF NOT FOUND OR g.payment_id IS DISTINCT FROM p.id OR g.user_id IS DISTINCT FROM p.payer_id
  OR g.accepted_by IS DISTINCT FROM p.payee_id OR g.status IS DISTINCT FROM 'completed'
  OR g.worker_completed_at IS NULL OR g.owner_confirmed_at IS NULL OR round(g.price*100)::bigint IS DISTINCT FROM p.amount_total THEN$old$,
   $new$IF NOT FOUND OR g.user_id IS DISTINCT FROM p.payer_id
  OR g.accepted_by IS DISTINCT FROM p.payee_id OR g.status IS DISTINCT FROM 'completed'
  OR (p.payment_type='gig_payment' AND (g.payment_id IS DISTINCT FROM p.id
   OR g.worker_completed_at IS NULL OR g.owner_confirmed_at IS NULL
   OR round(g.price*100)::bigint IS DISTINCT FROM p.amount_total)) THEN$new$),
  ($old$public.wallet_credit_before_refund_fence(p.payee_id,net,'gig_income','Income from completed gig',
    p.id,p.gig_id,p.payer_id,NULL,('gig_income:'||p.id)::varchar,$old$,
   $new$public.wallet_credit_before_refund_fence(p.payee_id,net,
    (CASE WHEN p.payment_type='tip' THEN 'tip_income' ELSE 'gig_income' END)::varchar,
    CASE WHEN p.payment_type='tip' THEN 'Tip received' ELSE 'Income from completed gig' END,
    p.id,p.gig_id,p.payer_id,NULL,
    ((CASE WHEN p.payment_type='tip' THEN 'tip_income:' ELSE 'gig_income:' END)||p.id)::varchar,$new$)
 ) AS replacements(old_text,new_text)
 LOOP
  IF position(replacement.old_text IN definition)=0 THEN
   RAISE EXCEPTION 'Tip wallet settlement source differs from the reviewed function';
  END IF;
  definition:=replace(definition,replacement.old_text,replacement.new_text);
 END LOOP;
 EXECUTE definition;

 definition:=pg_get_functiondef('public.read_wallet_settlement_delivery(uuid,uuid)'::regprocedure);
 FOR replacement IN SELECT * FROM (VALUES
  ($old$p.payment_type='gig_payment'$old$,$new$p.payment_type IN ('gig_payment','tip')$new$),
  ($old$t.type='gig_income'$old$,
   $new$t.type=(CASE WHEN p.payment_type='tip' THEN 'tip_income' ELSE 'gig_income' END)$new$),
  ($old$AND EXISTS(SELECT FROM public."Gig" WHERE id=p.gig_id AND user_id=p.payer_id AND payment_id=p.id)$old$,
   $new$AND EXISTS(SELECT FROM public."Gig" WHERE id=p.gig_id AND user_id=p.payer_id
    AND (p.payment_type='tip' OR payment_id=p.id))$new$)
 ) AS replacements(old_text,new_text)
 LOOP
  IF position(replacement.old_text IN definition)>0 THEN
   definition:=replace(definition,replacement.old_text,replacement.new_text);
  ELSIF position(replacement.new_text IN definition)=0 THEN
   RAISE EXCEPTION 'Tip wallet delivery source differs from the reviewed function';
  END IF;
 END LOOP;
 EXECUTE definition;
END
$migration$;
