-- Backwards compatible: yes. Same signature, body and privileges, except that a
-- repeated idempotency key now returns the first ledger row, as the function always
-- intended. `v_tx IS NOT NULL` on a row is false whenever any of its columns is NULL,
-- and these rows always have NULL columns, so the replay check never matched: a
-- repeated key fell through to a second insert, the unique idempotency_key refused it
-- (23505), and the caller's transaction failed instead of getting the first debit.
-- Callers pass a key exactly to get that replay (wallet withdrawals, refund recovery).
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.wallet_debit(p_user_id uuid, p_amount bigint, p_type character varying, p_description text DEFAULT NULL::text, p_payment_id uuid DEFAULT NULL::uuid, p_gig_id uuid DEFAULT NULL::uuid, p_counterparty_id uuid DEFAULT NULL::uuid, p_stripe_transfer character varying DEFAULT NULL::character varying, p_idempotency_key character varying DEFAULT NULL::character varying, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS public."WalletTransaction"
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_wallet "public"."Wallet";
  v_tx     "public"."WalletTransaction";
  v_balance_before bigint;
  v_balance_after  bigint;
BEGIN
  -- Ensure wallet exists
  SELECT * INTO v_wallet FROM get_or_create_wallet(p_user_id);

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_tx FROM "WalletTransaction"
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_tx;  -- Already processed
    END IF;
  END IF;

  -- Lock the wallet row for update
  SELECT * INTO v_wallet FROM "Wallet"
  WHERE id = v_wallet.id
  FOR UPDATE;

  IF v_wallet.frozen THEN
    RAISE EXCEPTION 'Wallet is frozen';
  END IF;

  v_balance_before := v_wallet.balance;
  v_balance_after  := v_wallet.balance - p_amount;

  -- Check sufficient balance
  IF v_balance_after < 0 THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: %, Required: %',
      v_wallet.balance, p_amount;
  END IF;

  -- Update balance
  UPDATE "Wallet"
  SET balance = v_balance_after,
      lifetime_spent = CASE
        WHEN p_type IN ('gig_payment', 'tip_sent') THEN lifetime_spent + p_amount
        ELSE lifetime_spent
      END,
      lifetime_withdrawals = CASE
        WHEN p_type = 'withdrawal' THEN lifetime_withdrawals + p_amount
        ELSE lifetime_withdrawals
      END,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Insert ledger entry
  INSERT INTO "WalletTransaction" (
    wallet_id, user_id, type, amount, direction,
    balance_before, balance_after, description,
    payment_id, gig_id, counterparty_id,
    stripe_transfer_id, idempotency_key, metadata
  ) VALUES (
    v_wallet.id, p_user_id, p_type, p_amount, 'debit',
    v_balance_before, v_balance_after, p_description,
    p_payment_id, p_gig_id, p_counterparty_id,
    p_stripe_transfer, p_idempotency_key, p_metadata
  )
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;
$$;

-- Unchanged privileges (20260922020300 made the wallet functions service-only).
REVOKE ALL ON FUNCTION public.wallet_debit(uuid, bigint, character varying, text, uuid, uuid, uuid, character varying, character varying, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_debit(uuid, bigint, character varying, text, uuid, uuid, uuid, character varying, character varying, jsonb)
  TO service_role;
