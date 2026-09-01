-- Migration 192: Address review queue
--
-- SCN-11: `manual_review` is emitted as the next action by six rungs of the
-- decision ladder (addressDecisionEngine.js), and no queue, route or admin
-- surface consumed it. Every escalation was a dead end: the engine said "a
-- human should look at this" and no human ever could. That makes every
-- "route to manual review" remedy in the design non-functional, which is why
-- ambiguous addresses were either silently accepted or silently refused
-- (audit 2026-08-22).
--
-- AddressVerificationEvent is append-only telemetry and cannot serve as a work
-- queue: it has no assignment, no state, and no outcome.

CREATE TABLE IF NOT EXISTS "public"."AddressReviewCase" (
  "id"            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "address_id"    uuid REFERENCES "public"."HomeAddress"("id") ON DELETE SET NULL,
  "home_id"       uuid REFERENCES "public"."Home"("id") ON DELETE SET NULL,
  "user_id"       uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,

  -- Why the engine escalated: the verdict status plus its reasons.
  "verdict_status" text NOT NULL,
  "reasons"        jsonb DEFAULT '[]'::jsonb NOT NULL,
  "trigger"        text,

  "status" text NOT NULL DEFAULT 'open'
    CONSTRAINT "AddressReviewCase_status_chk"
    CHECK ("status" IN ('open', 'in_review', 'approved', 'rejected', 'dismissed')),

  "assigned_to"   uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "resolved_by"   uuid REFERENCES "public"."User"("id") ON DELETE SET NULL,
  "resolved_at"   timestamptz,
  "resolution_note" text,

  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_address_review_case_open"
  ON "public"."AddressReviewCase" ("created_at" DESC)
  WHERE "status" IN ('open', 'in_review');

CREATE INDEX IF NOT EXISTS "idx_address_review_case_address"
  ON "public"."AddressReviewCase" ("address_id", "created_at" DESC);

-- One open case per (address, user) so a retrying user does not flood the queue.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_address_review_case_one_open"
  ON "public"."AddressReviewCase" ("address_id", "user_id")
  WHERE "status" IN ('open', 'in_review');

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE "public"."AddressReviewCase" ENABLE ROW LEVEL SECURITY;

-- Reviewers reach this through the service role only; a user may see the
-- status of their own case so the client can stop showing a dead end.
DROP POLICY IF EXISTS "address_review_case_select_own" ON "public"."AddressReviewCase";
CREATE POLICY "address_review_case_select_own"
  ON "public"."AddressReviewCase"
  FOR SELECT TO "authenticated"
  USING ("user_id" = "auth"."uid"());

DROP POLICY IF EXISTS "address_review_case_service" ON "public"."AddressReviewCase";
CREATE POLICY "address_review_case_service"
  ON "public"."AddressReviewCase"
  FOR ALL TO "service_role"
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE "public"."AddressReviewCase" FROM "anon";
REVOKE ALL ON TABLE "public"."AddressReviewCase" FROM "authenticated";
GRANT SELECT ON TABLE "public"."AddressReviewCase" TO "authenticated";
GRANT ALL ON TABLE "public"."AddressReviewCase" TO "service_role";
