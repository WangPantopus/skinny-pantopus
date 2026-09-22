-- Backwards compatible: yes. The existing refund reconciler already accepts
-- exact legacy tip income. Apply the same type binding to protected tip receipts.
-- Supersedes the unmerged225 candidate after master advanced through226.
-- Retained candidate ledger rows and SQL stay unchanged; exact prior application
-- is accepted below. Fresh databases apply this after227 delivery support.
SET LOCAL lock_timeout='5s';
DO $migration$
DECLARE definition text; old_text text; new_text text;
BEGIN
 definition:=pg_get_functiondef('public.settle_payment_refund_wallet(uuid)'::regprocedure);
 old_text:=$old$AND amount=s.amount_cents AND type='gig_income' AND direction='credit'$old$;
 new_text:=$new$AND amount=s.amount_cents
   AND type=(CASE WHEN p.payment_type='tip' THEN 'tip_income' ELSE 'gig_income' END)
   AND direction='credit'$new$;
 IF position(old_text IN definition)>0 THEN
  definition:=replace(definition,old_text,new_text);
 ELSIF position(new_text IN definition)=0 THEN
  RAISE EXCEPTION 'Wallet refund source differs from the reviewed function';
 END IF;
 EXECUTE definition;
END
$migration$;
