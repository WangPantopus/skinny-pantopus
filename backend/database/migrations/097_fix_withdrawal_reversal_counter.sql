-- Fix: Decrement lifetime_withdrawals when a withdrawal reversal credit is applied.
-- Previously, failed withdrawals were reversed as type 'adjustment' which did not
-- decrement lifetime_withdrawals, causing the "Withdrawn" stat to include failed amounts.

CREATE OR REPLACE FUNCTION "public"."wallet_credit"(
  "p_user_id" "uuid",
  "p_amount" bigint,
  "p_type" character varying,
  "p_description" "text" DEFAULT NULL::"text",
  "p_payment_id" "uuid" DEFAULT NULL::"uuid",
  "p_gig_id" "uuid" DEFAULT NULL::"uuid",
  "p_counterparty_id" "uuid" DEFAULT NULL::"uuid",
  "p_stripe_pi_id" character varying DEFAULT NULL::character varying,
  "p_idempotency_key" character varying DEFAULT NULL::character varying,
  "p_metadata" "jsonb" DEFAULT '{}'::"jsonb"
) RETURNS "public"."WalletTransaction"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
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
    IF v_tx IS NOT NULL THEN
      RETURN v_tx;  -- Already processed
    END IF;
  END IF;

  -- Lock the wallet row for update (prevents concurrent modifications)
  SELECT * INTO v_wallet FROM "Wallet"
  WHERE id = v_wallet.id
  FOR UPDATE;

  IF v_wallet.frozen THEN
    RAISE EXCEPTION 'Wallet is frozen';
  END IF;

  v_balance_before := v_wallet.balance;
  v_balance_after  := v_wallet.balance + p_amount;

  -- Update balance and lifetime counters
  UPDATE "Wallet"
  SET balance = v_balance_after,
      lifetime_received = CASE
        WHEN p_type IN ('gig_income', 'tip_income') THEN lifetime_received + p_amount
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

  -- Insert ledger entry
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

-- Add 'withdrawal_reversal' to the allowed type values.
ALTER TABLE "WalletTransaction" DROP CONSTRAINT "WalletTransaction_type_check";
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_type_check"
  CHECK (("type")::text = ANY (ARRAY[
    'deposit','withdrawal','withdrawal_reversal','gig_income','gig_payment',
    'tip_income','tip_sent','refund','adjustment',
    'transfer_in','transfer_out','cancellation_fee'
  ]::text[]));

-- Reclassify existing withdrawal reversal transactions from 'adjustment' to
-- 'withdrawal_reversal' so they are identifiable going forward.
UPDATE "WalletTransaction"
SET type = 'withdrawal_reversal'
WHERE type = 'adjustment'
  AND direction = 'credit'
  AND description LIKE 'Reversal: withdrawal failed%';

-- Repair lifetime_withdrawals for all affected wallets.
-- Recalculate as the sum of completed (non-reversed) withdrawal debits.
UPDATE "Wallet" w
SET lifetime_withdrawals = COALESCE(sub.net, 0)
FROM (
  SELECT wallet_id,
         SUM(CASE WHEN type = 'withdrawal' AND status = 'completed' THEN amount ELSE 0 END) AS net
  FROM "WalletTransaction"
  GROUP BY wallet_id
) sub
WHERE w.id = sub.wallet_id
  AND w.lifetime_withdrawals <> COALESCE(sub.net, 0);
