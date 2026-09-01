-- ============================================================
-- Migration 095: Align payment analytics RPC math with runtime logic
--
-- Context:
--   The API runtime (earningsService + spending route) applies lifecycle
--   state filters and refund netting rules when aggregating payment totals.
--   Existing RPC functions were missing part of that logic, which could
--   produce mismatched totals when switching to RPC-first aggregation.
--
-- This migration updates:
--   1) get_user_earnings: filter includable lifecycle states and compute
--      net values as max(amount_to_payee - refunded_amount, 0)
--   2) get_user_spending: filter by lifecycle status (matching earnings)
--      and guard total_paid math with GREATEST(..., 0)
--
-- Safe to run multiple times (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."get_user_earnings"(
  "p_user_id" uuid,
  "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone,
  "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH scoped AS (
    SELECT
      payment_status,
      GREATEST(0, COALESCE(amount_to_payee, 0) - COALESCE(refunded_amount, 0)) AS net_amount,
      COALESCE(is_escrowed, FALSE) AS is_escrowed,
      escrow_released_at
    FROM "Payment"
    WHERE payee_id = p_user_id
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND payment_status IN (
        'captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred',
        'refund_pending', 'refunded_partial', 'refunded_full', 'disputed',
        'succeeded', 'processing'
      )
  ),
  earnings AS (
    SELECT
      COUNT(*) AS total_payments,
      COALESCE(SUM(net_amount), 0) AS total_earned,
      COALESCE(SUM(CASE WHEN payment_status IN ('transferred', 'succeeded') THEN net_amount ELSE 0 END), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN is_escrowed = TRUE AND escrow_released_at IS NULL THEN net_amount ELSE 0 END), 0) AS total_escrowed,
      COALESCE(SUM(CASE WHEN ((is_escrowed = FALSE) OR escrow_released_at IS NOT NULL OR payment_status IN ('transferred', 'succeeded')) THEN net_amount ELSE 0 END), 0) AS total_available
    FROM scoped
  )
  SELECT jsonb_build_object(
    'totalPayments', total_payments,
    'totalEarned', total_earned,
    'totalPaid', total_paid,
    'totalEscrowed', total_escrowed,
    'totalAvailable', total_available,
    'currency', 'USD'
  ) INTO v_result
  FROM earnings;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_user_spending"(
  "p_user_id" uuid,
  "p_start_date" timestamp with time zone DEFAULT NULL::timestamp with time zone,
  "p_end_date" timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH scoped AS (
    SELECT
      amount_total,
      refunded_amount,
      payment_status
    FROM "Payment"
    WHERE payer_id = p_user_id
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND payment_status IN (
        'captured_hold', 'transfer_scheduled', 'transfer_pending', 'transferred',
        'refund_pending', 'refunded_partial', 'refunded_full', 'disputed',
        'succeeded', 'processing'
      )
  ),
  spending AS (
    SELECT
      COUNT(*) AS total_payments,
      COALESCE(SUM(amount_total), 0) AS total_spent,
      COALESCE(SUM(GREATEST(0, amount_total - COALESCE(refunded_amount, 0))), 0) AS total_paid,
      COALESCE(SUM(COALESCE(refunded_amount, 0)), 0) AS total_refunded
    FROM scoped
  )
  SELECT jsonb_build_object(
    'totalPayments', total_payments,
    'totalSpent', total_spent,
    'totalPaid', total_paid,
    'totalRefunded', total_refunded,
    'currency', 'USD'
  ) INTO v_result
  FROM spending;

  RETURN v_result;
END;
$$;
