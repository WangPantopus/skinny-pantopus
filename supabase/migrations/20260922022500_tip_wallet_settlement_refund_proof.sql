-- Backwards compatible: yes. The existing refund reconciler already accepts
-- exact legacy tip income. Apply the same type binding to protected tip receipts.
-- Keep 022400 unchanged after its local application; no ledger row is rewritten.
SET LOCAL lock_timeout='5s';
DO $migration$
DECLARE definition text; old_text text;
BEGIN
 definition:=pg_get_functiondef('public.settle_payment_refund_wallet(uuid)'::regprocedure);
 old_text:=$old$AND amount=s.amount_cents AND type='gig_income' AND direction='credit'$old$;
 IF position(old_text IN definition)=0 THEN
  RAISE EXCEPTION 'Wallet refund source differs from the reviewed function';
 END IF;
 definition:=replace(definition,old_text,
  $new$AND amount=s.amount_cents
   AND type=(CASE WHEN p.payment_type='tip' THEN 'tip_income' ELSE 'gig_income' END)
   AND direction='credit'$new$);
 EXECUTE definition;
END
$migration$;
