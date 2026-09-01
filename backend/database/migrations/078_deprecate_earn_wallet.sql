-- ============================================================
-- MIGRATION 078: Deprecate EarnWallet table
--
-- The EarnWallet table is a legacy artifact from the mailbox
-- Phase 3 earn feature. All wallet operations now use the
-- canonical Wallet + WalletTransaction tables with cents-based
-- amounts and atomic RPC functions (wallet_credit/wallet_debit).
--
-- The EarnWallet table is NOT dropped here because it may
-- contain existing balance data that needs to be reconciled.
-- TODO: After confirming no data dependencies, migrate any
-- remaining EarnWallet balances to the Wallet table and then
-- DROP TABLE "EarnWallet".
-- ============================================================

COMMENT ON TABLE "public"."EarnWallet" IS
  'DEPRECATED — Legacy earn wallet from mailbox Phase 3. '
  'All wallet operations now use the Wallet table. '
  'Do not reference this table in new code. '
  'Pending migration of any remaining balances before drop.';
