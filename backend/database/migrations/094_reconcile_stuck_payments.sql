-- ============================================================
-- Migration 094: Reconcile stuck payments from pre-fix runs
--
-- Context:
--   Before the transferred_at → transfer_completed_at fix,
--   payments could get wallet-credited but remain stuck in
--   transfer_scheduled or transfer_pending because the status
--   transition failed on a nonexistent column.
--
-- This migration:
--   1. Finds payments in transfer_scheduled/transfer_pending
--      that have a matching wallet credit (WalletTransaction)
--   2. Advances them to 'transferred' with transfer_completed_at set
--   3. Syncs the denormalized Gig.payment_status
--
-- Both steps are wrapped in a transaction so either both succeed
-- or neither does. An updated_at guard (> 1 hour stale) prevents
-- overwriting rows that a live webhook may be actively processing.
--
-- Safe to run multiple times (idempotent).
-- ============================================================

BEGIN;

-- Step 1: Advance stuck transfer_scheduled/transfer_pending payments
-- that already have a wallet credit to 'transferred'.
-- The updated_at guard ensures we only touch rows that have been
-- untouched for over an hour, avoiding races with live webhooks.
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

-- Step 2: Sync Gig.payment_status for any gigs linked to
-- the payments we just advanced
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
