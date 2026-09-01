-- DEV PATCH: Fix get_user_spending to filter by lifecycle status
--
-- The original 095 migration added lifecycle status filtering to
-- get_user_earnings but not get_user_spending. This caused
-- total_payments/total_spent/total_refunded to include canceled and
-- failed payments, producing inflated totals. This patch replaces
-- get_user_spending with the corrected version.
--
-- Idempotent (CREATE OR REPLACE).

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
