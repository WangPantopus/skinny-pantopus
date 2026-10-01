-- Backwards compatible: yes. Same signature, body and privileges, except that a
-- repeated idempotency key now returns the first ledger row, as the function always
-- intended. `v_tx IS NOT NULL` on a row is false whenever any of its columns is NULL,
-- and these rows always have NULL columns, so the replay check never matched: a
-- repeated key fell through to a second insert, the unique idempotency_key refused it
-- (23505), and the caller's transaction failed instead of getting the first credit.
-- This is wallet_credit's inner implementation (the baseline wallet_credit body,
-- renamed by 20260922020300 and 20260922020900). Its fenced wrappers check income
-- receipts themselves; every other credit type with a key (withdrawal reversals,
-- refund recovery, adjustments) relies on this check. 20261001132000 made the same
-- fix in wallet_debit.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.wallet_credit_before_gig_stop(p_user_id uuid, p_amount bigint, p_type character varying, p_description text DEFAULT NULL::text, p_payment_id uuid DEFAULT NULL::uuid, p_gig_id uuid DEFAULT NULL::uuid, p_counterparty_id uuid DEFAULT NULL::uuid, p_stripe_pi_id character varying DEFAULT NULL::character varying, p_idempotency_key character varying DEFAULT NULL::character varying, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public."WalletTransaction"
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_wallet "public"."Wallet";
  v_tx     "public"."WalletTransaction";
  v_balance_before bigint;
  v_balance_after  bigint;
BEGIN
  SELECT * INTO v_wallet FROM get_or_create_wallet(p_user_id);

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_tx FROM "WalletTransaction"
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_tx;
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM "Wallet"
  WHERE id = v_wallet.id
  FOR UPDATE;

  IF v_wallet.frozen THEN
    RAISE EXCEPTION 'Wallet is frozen';
  END IF;

  v_balance_before := v_wallet.balance;
  v_balance_after  := v_wallet.balance + p_amount;

  UPDATE "Wallet"
  SET balance = v_balance_after,
      lifetime_received = CASE
        WHEN p_type IN ('gig_income', 'tip_income', 'booking_income', 'package_income') THEN lifetime_received + p_amount
        ELSE lifetime_received
      END,
      lifetime_deposits = CASE
        WHEN p_type = 'deposit' THEN lifetime_deposits + p_amount
        ELSE lifetime_deposits
      END,
      lifetime_withdrawals = CASE
        WHEN p_type = 'withdrawal_reversal' THEN GREATEST(lifetime_withdrawals - p_amount, 0)
        ELSE lifetime_withdrawals
      END,
      updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO "WalletTransaction" (
    wallet_id, user_id, type, amount, direction,
    balance_before, balance_after, description,
    payment_id, gig_id, counterparty_id,
    stripe_payment_intent_id, idempotency_key, metadata
  ) VALUES (
    v_wallet.id, p_user_id, p_type, p_amount, 'credit',
    v_balance_before, v_balance_after, p_description,
    p_payment_id, p_gig_id, p_counterparty_id,
    p_stripe_pi_id, p_idempotency_key, p_metadata
  )
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;

-- Only the definer wrapper may enter the preserved unfenced implementation (as
-- 20260922020900 set): no role but the owner may execute it.
REVOKE ALL ON FUNCTION public.wallet_credit_before_gig_stop(uuid,bigint,character varying,text,uuid,uuid,uuid,character varying,character varying,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
