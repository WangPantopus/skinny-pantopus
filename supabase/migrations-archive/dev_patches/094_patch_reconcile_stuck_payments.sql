-- DEV PATCH: Fix 094_reconcile_stuck_payments.sql
--
-- Run this on development databases that already applied the original 094
-- migration. The original had two issues:
--   1. No transaction wrapping — if Step 2 failed, Payment rows were
--      advanced to 'transferred' but Gig.payment_status was stale.
--   2. No updated_at guard — could race with live webhook processors
--      and overwrite a webhook's status with 'transferred'.
--
-- Since the original already ran, Payment rows that qualified were already
-- updated. This patch re-runs Step 2 (Gig sync) inside a transaction to
-- fix any Gig rows that may have been left behind if Step 2 failed.
-- It also applies the updated_at guard for consistency.
--
-- Idempotent — safe to run multiple times.

BEGIN;

-- Re-sync Gig.payment_status for payments that were advanced by the
-- original migration but whose Gig rows may not have been updated.
UPDATE "Gig" g
SET
  payment_status = 'transferred',
  updated_at = NOW()
FROM "Payment" p
WHERE
  g.id = p.gig_id
  AND p.payment_status = 'transferred'
  AND p.transfer_status = 'wallet_credited'
  AND g.payment_status IN ('transfer_scheduled', 'transfer_pending');

-- Also catch any remaining stuck payments that the original migration
-- may have missed if they were being actively processed at the time.
-- The 1-hour staleness guard prevents racing with live webhooks.
UPDATE "Payment" p
SET
  payment_status = 'transferred',
  transfer_status = 'wallet_credited',
  transfer_completed_at = NOW(),
  updated_at = NOW()
WHERE
  p.payment_status IN ('transfer_scheduled', 'transfer_pending')
  AND p.dispute_id IS NULL
  AND p.updated_at < NOW() - INTERVAL '1 hour'
  AND EXISTS (
    SELECT 1 FROM "WalletTransaction" wt
    WHERE wt.payment_id = p.id
      AND wt.type IN ('gig_income', 'tip_income')
  );

-- Final Gig sync pass for any payments just advanced above.
UPDATE "Gig" g
SET
  payment_status = 'transferred',
  updated_at = NOW()
FROM "Payment" p
WHERE
  g.id = p.gig_id
  AND p.payment_status = 'transferred'
  AND p.transfer_status = 'wallet_credited'
  AND g.payment_status IN ('transfer_scheduled', 'transfer_pending');

COMMIT;
