-- Migration 187: Harden HomePostcardCode (legacy postcard verification)
--
-- SECURITY. The legacy postcard path used by the iOS and Android clients had
-- four defects, all in one small table:
--
--   1. Codes were generated with `Math.floor(100000 + Math.random() * 900000)`
--      — a non-cryptographic PRNG, seeded per process and predictable.
--   2. Codes were stored in cleartext (`"code" text NOT NULL`).
--   3. Migration 036 enabled no RLS on the table.
--   4. No dispatcher ever mailed the code, so every pending row is dead.
--
-- The application now generates codes with crypto.randomInt and stores only a
-- SHA-256 hash. This migration adds the hash column, retires the cleartext
-- column, and puts the table behind RLS.
--
-- DEPLOY ORDER: this migration and the code change must land together. The old
-- code writes the NOT NULL "code" column this drops; the new code writes
-- "code_hash", which the old schema lacks. Apply during the same deploy as the
-- backend that ships it (the table is low-traffic; a request that races the
-- swap fails loudly with a column error and can simply be retried).

BEGIN;

ALTER TABLE "public"."HomePostcardCode"
  ADD COLUMN IF NOT EXISTS "code_hash" text;

-- Every pending code predates the dispatcher and was never mailed to anyone,
-- so none of them can legitimately be redeemed. Retire them rather than
-- attempting to hash a value no user ever received.
UPDATE "public"."HomePostcardCode"
   SET "status" = 'expired',
       "updated_at" = now()
 WHERE "status" = 'pending';

-- Drop the cleartext column now that nothing depends on its contents.
ALTER TABLE "public"."HomePostcardCode"
  DROP COLUMN IF EXISTS "code";

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE "public"."HomePostcardCode" ENABLE ROW LEVEL SECURITY;

-- A user may see that they have a pending request (and when it expires), but
-- the hash is never useful to them and the row is only ever written server-side.
DROP POLICY IF EXISTS "home_postcard_code_select_own" ON "public"."HomePostcardCode";
CREATE POLICY "home_postcard_code_select_own"
  ON "public"."HomePostcardCode"
  FOR SELECT TO "authenticated"
  USING ("user_id" = "auth"."uid"());

DROP POLICY IF EXISTS "home_postcard_code_service" ON "public"."HomePostcardCode";
CREATE POLICY "home_postcard_code_service"
  ON "public"."HomePostcardCode"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE "public"."HomePostcardCode" FROM "anon";
REVOKE ALL ON TABLE "public"."HomePostcardCode" FROM "authenticated";
GRANT SELECT ON TABLE "public"."HomePostcardCode" TO "authenticated";
GRANT ALL ON TABLE "public"."HomePostcardCode" TO "service_role";

COMMIT;
