-- Backwards compatible: yes. Restore the existing settlement stop fence after
-- 22300 replaced its public wrapper while changing won-dispute eligibility.
-- Actual concurrent settlement and Gig→Payment stop locking reproduced 40P01.
-- Keep applied history intact: extend the original inner implementation in place
-- and restore the reviewed 20900 wrapper, preserving signatures and privileges.
SET LOCAL lock_timeout='5s';

DO $migration$
DECLARE definition text;
 old_guard text := 'OR p.dispute_id IS NOT NULL OR p.stripe_transfer_id IS NOT NULL';
 new_guard text := 'OR (p.dispute_id IS NOT NULL AND p.dispute_status IS DISTINCT FROM ''won'') OR p.stripe_transfer_id IS NOT NULL';
BEGIN
 definition:=pg_get_functiondef('public.settle_paid_gig_wallet_income_before_stop_fence(uuid,jsonb)'::regprocedure);
 IF position(old_guard IN definition)=0 THEN
  RAISE EXCEPTION 'Won-dispute settlement source differs from the reviewed inner function';
 END IF;
 EXECUTE replace(definition,old_guard,new_guard);
END
$migration$;

CREATE OR REPLACE FUNCTION public.settle_paid_gig_wallet_income(p_payment_id uuid,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='5s' AS $$
DECLARE target_gig uuid; p public."Payment";
BEGIN
 SELECT gig_id INTO target_gig FROM public."Payment" WHERE id=p_payment_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF target_gig IS NOT NULL THEN PERFORM 1 FROM public."Gig" WHERE id=target_gig FOR UPDATE; END IF;
 SELECT * INTO p FROM public."Payment" WHERE id=p_payment_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','NOT_FOUND'); END IF;
 IF p.gig_id IS DISTINCT FROM target_gig THEN RETURN jsonb_build_object('error','TERMS_CHANGED'); END IF;
 RETURN public.settle_paid_gig_wallet_income_before_stop_fence(p_payment_id,p_expected);
END $$;
