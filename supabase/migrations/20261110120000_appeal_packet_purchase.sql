-- Backwards compatible: yes. Adds one new table. No existing table, column, row, function, index or grant changes; the
-- deployed backend and the apps in the stores never read or write it.
--
-- The Home Money Check's appeal packet (backend/services/appealPacket.js): one row per packet bought, so the owner
-- can download it again. A packet is for one Home and one county value year. Approved by the founder on November 10,
-- 2026. Additive: nothing else reads or writes this table.
--
-- `reference` is the payment provider's own id for the purchase (a Stripe Checkout Session). `revoked` is set when
-- the payment is refunded or disputed. A deleted account leaves the receipt, without its owner. `home_id` is the Home's
-- id as a plain value, not a link: a receipt is no part of a Home, so deleting the Home neither waits on it nor changes
-- it (the Home deletion policy reviews every table linked to "Home", supabase/tests/home-delete-transaction.test.sql).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE public."AppealPacketPurchase" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES public."User"(id) ON DELETE SET NULL,
 home_id uuid NOT NULL,
 value_year integer NOT NULL,
 provider text NOT NULL CHECK(provider IN ('stripe')), reference text NOT NULL,
 amount_cents integer NOT NULL CHECK(amount_cents > 0), currency text NOT NULL DEFAULT 'usd',
 revoked boolean NOT NULL DEFAULT false, checked_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,reference)
);
CREATE INDEX ON public."AppealPacketPurchase"(home_id,user_id) WHERE NOT revoked;
ALTER TABLE public."AppealPacketPurchase" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."AppealPacketPurchase" FROM PUBLIC, anon, authenticated;
GRANT ALL ON public."AppealPacketPurchase" TO service_role;

COMMIT;
