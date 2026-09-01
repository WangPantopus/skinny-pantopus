-- 161_calendarly_packages_automations.sql
-- Calendarly — sellable session packages, reminder/automation scaffolding, invitee email
-- suppression, and the deferred external-calendar stub. Depends on 159 + 160.
--
-- Also extends the wallet ledger so booking/package income counts toward lifetime_received,
-- mirroring how gig_income/tip_income already do.

-- ============================================================
-- 1. BookingPackage + PackageCredit
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."BookingPackage" (
    "id"             "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type"     "public"."scheduling_owner_type" NOT NULL,
    "owner_id"       "uuid" NOT NULL,
    "owner_user_id"  "uuid",
    "home_id"        "uuid",
    "name"           "text" NOT NULL,
    "sessions_count" integer NOT NULL,
    "price_cents"    integer NOT NULL,
    "currency"       "text" DEFAULT 'USD' NOT NULL,
    "event_type_id"  "uuid",
    "is_active"      boolean DEFAULT true NOT NULL,
    "created_at"     timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"     timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BookingPackage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BookingPackage_sessions_chk" CHECK (("sessions_count" > 0)),
    CONSTRAINT "BookingPackage_price_chk" CHECK (("price_cents" >= 0)),
    CONSTRAINT "BookingPackage_owner_chk" CHECK (
        ("owner_type" = 'home' AND "home_id" IS NOT NULL AND "owner_user_id" IS NULL AND "owner_id" = "home_id")
        OR ("owner_type" = ANY (ARRAY['user'::"public"."scheduling_owner_type", 'business'::"public"."scheduling_owner_type"])
            AND "owner_user_id" IS NOT NULL AND "home_id" IS NULL AND "owner_id" = "owner_user_id")
    )
);
ALTER TABLE "public"."BookingPackage" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."PackageCredit" (
    "id"            "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id"    "uuid" NOT NULL,
    "buyer_user_id" "uuid" NOT NULL,
    "total"         integer NOT NULL,
    "remaining"     integer NOT NULL,
    "payment_id"    "uuid",
    "purchased_at"  timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at"    timestamp with time zone,
    "created_at"    timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "PackageCredit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PackageCredit_remaining_chk" CHECK (("remaining" >= 0 AND "remaining" <= "total"))
);
ALTER TABLE "public"."PackageCredit" OWNER TO "postgres";

-- ============================================================
-- 2. SchedulingWorkflow + BookingReminderLog + EmailSuppression
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."SchedulingWorkflow" (
    "id"               "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type"       "public"."scheduling_owner_type" NOT NULL,
    "owner_id"         "uuid" NOT NULL,
    "owner_user_id"    "uuid",
    "home_id"          "uuid",
    "event_type_id"    "uuid",
    "name"             "text" NOT NULL,
    "trigger"          "text" NOT NULL,
    "offset_minutes"   integer DEFAULT 0 NOT NULL,
    "action"           "text" NOT NULL,
    "message_template" "text",
    "is_active"        boolean DEFAULT true NOT NULL,
    "created_at"       timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"       timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "SchedulingWorkflow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchedulingWorkflow_trigger_chk"
        CHECK (("trigger" = ANY (ARRAY['booking_created'::"text", 'cancelled'::"text", 'rescheduled'::"text", 'before_start'::"text", 'after_end'::"text"]))),
    CONSTRAINT "SchedulingWorkflow_action_chk"
        CHECK (("action" = ANY (ARRAY['email'::"text", 'push'::"text", 'in_app'::"text", 'sms'::"text"]))),
    CONSTRAINT "SchedulingWorkflow_owner_chk" CHECK (
        ("owner_type" = 'home' AND "home_id" IS NOT NULL AND "owner_user_id" IS NULL AND "owner_id" = "home_id")
        OR ("owner_type" = ANY (ARRAY['user'::"public"."scheduling_owner_type", 'business'::"public"."scheduling_owner_type"])
            AND "owner_user_id" IS NOT NULL AND "home_id" IS NULL AND "owner_id" = "owner_user_id")
    )
);
ALTER TABLE "public"."SchedulingWorkflow" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."BookingReminderLog" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id"  "uuid" NOT NULL,
    "workflow_id" "uuid",
    "kind"        "text" NOT NULL,
    "sent_at"     timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "BookingReminderLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."BookingReminderLog" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."EmailSuppression" (
    "id"         "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email_hash" "text" NOT NULL,
    -- Suppression is scoped to one scheduling owner. The unsubscribe route is
    -- unauthenticated (proof = possession of a manage token), and the invitee_email on a
    -- booking is caller-supplied — an attacker who books with a victim's address must not
    -- be able to mute the victim's reminders for every page on the platform.
    "owner_type" "public"."scheduling_owner_type" NOT NULL,
    "owner_id"   "uuid" NOT NULL,
    "reason"     "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."EmailSuppression" OWNER TO "postgres";

-- ============================================================
-- 3. ConnectedCalendar — deferred external-sync stub (created empty/disabled)
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."ConnectedCalendar" (
    "id"                "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id"           "uuid" NOT NULL,
    "provider"          "text" NOT NULL,
    "external_account"  "text",
    "access_token_enc"  "text",
    "refresh_token_enc" "text",
    "sync_token"        "text",
    "check_conflicts"   boolean DEFAULT true NOT NULL,
    "write_target"      boolean DEFAULT false NOT NULL,
    "last_synced_at"    timestamp with time zone,
    "status"            "text" DEFAULT 'disabled' NOT NULL,
    "created_at"        timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at"        timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ConnectedCalendar_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConnectedCalendar_provider_chk"
        CHECK (("provider" = ANY (ARRAY['google'::"text", 'outlook'::"text", 'apple'::"text", 'caldav'::"text"]))),
    CONSTRAINT "ConnectedCalendar_status_chk"
        CHECK (("status" = ANY (ARRAY['disabled'::"text", 'active'::"text", 'error'::"text", 'revoked'::"text"])))
);
ALTER TABLE "public"."ConnectedCalendar" OWNER TO "postgres";

-- ============================================================
-- 4. FOREIGN KEYS (idempotent) — incl. Booking.package_credit_id deferred from 160
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingPackage_owner_user_id_fkey') THEN
    ALTER TABLE "public"."BookingPackage"
      ADD CONSTRAINT "BookingPackage_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingPackage_home_id_fkey') THEN
    ALTER TABLE "public"."BookingPackage"
      ADD CONSTRAINT "BookingPackage_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingPackage_event_type_id_fkey') THEN
    ALTER TABLE "public"."BookingPackage"
      ADD CONSTRAINT "BookingPackage_event_type_id_fkey"
      FOREIGN KEY ("event_type_id") REFERENCES "public"."EventType"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackageCredit_package_id_fkey') THEN
    ALTER TABLE "public"."PackageCredit"
      ADD CONSTRAINT "PackageCredit_package_id_fkey"
      FOREIGN KEY ("package_id") REFERENCES "public"."BookingPackage"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackageCredit_buyer_user_id_fkey') THEN
    ALTER TABLE "public"."PackageCredit"
      ADD CONSTRAINT "PackageCredit_buyer_user_id_fkey"
      FOREIGN KEY ("buyer_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PackageCredit_payment_id_fkey') THEN
    ALTER TABLE "public"."PackageCredit"
      ADD CONSTRAINT "PackageCredit_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "public"."Payment"("id") ON DELETE SET NULL;
  END IF;

  -- Deferred from 160 (PackageCredit did not exist yet).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_package_credit_id_fkey') THEN
    ALTER TABLE "public"."Booking"
      ADD CONSTRAINT "Booking_package_credit_id_fkey"
      FOREIGN KEY ("package_credit_id") REFERENCES "public"."PackageCredit"("id") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingWorkflow_owner_user_id_fkey') THEN
    ALTER TABLE "public"."SchedulingWorkflow"
      ADD CONSTRAINT "SchedulingWorkflow_owner_user_id_fkey"
      FOREIGN KEY ("owner_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingWorkflow_home_id_fkey') THEN
    ALTER TABLE "public"."SchedulingWorkflow"
      ADD CONSTRAINT "SchedulingWorkflow_home_id_fkey"
      FOREIGN KEY ("home_id") REFERENCES "public"."Home"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SchedulingWorkflow_event_type_id_fkey') THEN
    ALTER TABLE "public"."SchedulingWorkflow"
      ADD CONSTRAINT "SchedulingWorkflow_event_type_id_fkey"
      FOREIGN KEY ("event_type_id") REFERENCES "public"."EventType"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BookingReminderLog_booking_id_fkey') THEN
    ALTER TABLE "public"."BookingReminderLog"
      ADD CONSTRAINT "BookingReminderLog_booking_id_fkey"
      FOREIGN KEY ("booking_id") REFERENCES "public"."Booking"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConnectedCalendar_user_id_fkey') THEN
    ALTER TABLE "public"."ConnectedCalendar"
      ADD CONSTRAINT "ConnectedCalendar_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "BookingPackage_owner_idx" ON "public"."BookingPackage" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "PackageCredit_buyer_idx" ON "public"."PackageCredit" ("buyer_user_id");
CREATE INDEX IF NOT EXISTS "PackageCredit_package_idx" ON "public"."PackageCredit" ("package_id");
CREATE INDEX IF NOT EXISTS "SchedulingWorkflow_owner_idx" ON "public"."SchedulingWorkflow" ("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "SchedulingWorkflow_event_type_idx" ON "public"."SchedulingWorkflow" ("event_type_id") WHERE ("event_type_id" IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS "BookingReminderLog_unique" ON "public"."BookingReminderLog" ("booking_id", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailSuppression_email_owner_unique"
  ON "public"."EmailSuppression" ("email_hash", "owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "ConnectedCalendar_user_idx" ON "public"."ConnectedCalendar" ("user_id");

-- ============================================================
-- 6. Extend wallet ledger: booking_income / package_income count toward lifetime_received
-- ============================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_type_check') THEN
    ALTER TABLE "public"."WalletTransaction" DROP CONSTRAINT "WalletTransaction_type_check";
  END IF;
  ALTER TABLE "public"."WalletTransaction"
    ADD CONSTRAINT "WalletTransaction_type_check"
    CHECK ((("type")::"text" = ANY ((ARRAY[
      'deposit'::character varying, 'withdrawal'::character varying, 'gig_income'::character varying,
      'gig_payment'::character varying, 'tip_income'::character varying, 'tip_sent'::character varying,
      'refund'::character varying, 'adjustment'::character varying, 'transfer_in'::character varying,
      'transfer_out'::character varying, 'cancellation_fee'::character varying,
      -- 'withdrawal_reversal' predates this migration (097_fix_withdrawal_reversal_counter):
      -- dropping it here would make every failed-withdrawal refund insert violate the CHECK.
      'withdrawal_reversal'::character varying,
      'booking_income'::character varying, 'package_income'::character varying
    ])::"text"[])));
END $$;

-- Re-define wallet_credit to roll booking/package income into lifetime_received.
-- (Copy of the existing function with the lifetime_received CASE extended. The lifetime_withdrawals
--  CASE from 097_fix_withdrawal_reversal_counter MUST be preserved here, or re-running this
--  CREATE OR REPLACE silently reverts that fix.)
CREATE OR REPLACE FUNCTION "public"."wallet_credit"(
  "p_user_id" "uuid", "p_amount" bigint, "p_type" character varying,
  "p_description" "text" DEFAULT NULL::"text", "p_payment_id" "uuid" DEFAULT NULL::"uuid",
  "p_gig_id" "uuid" DEFAULT NULL::"uuid", "p_counterparty_id" "uuid" DEFAULT NULL::"uuid",
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
  SELECT * INTO v_wallet FROM get_or_create_wallet(p_user_id);

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_tx FROM "WalletTransaction"
    WHERE idempotency_key = p_idempotency_key;
    IF v_tx IS NOT NULL THEN
      RETURN v_tx;
    END IF;
  END IF;

  SELECT * INTO v_wallet FROM "Wallet"
  WHERE id = v_wallet.id
  FOR UPDATE;

  IF v_wallet.frozen THEN
    RAISE EXCEPTION 'Wallet is frozen';
  END IF;

  v_balance_before := v_wallet.balance;
  v_balance_after  := v_wallet.balance + p_amount;

  UPDATE "Wallet"
  SET balance = v_balance_after,
      lifetime_received = CASE
        WHEN p_type IN ('gig_income', 'tip_income', 'booking_income', 'package_income') THEN lifetime_received + p_amount
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

-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE "public"."BookingPackage"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PackageCredit"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SchedulingWorkflow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."BookingReminderLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."EmailSuppression"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ConnectedCalendar"  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookingpackage_service" ON "public"."BookingPackage";
CREATE POLICY "bookingpackage_service" ON "public"."BookingPackage" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "bookingpackage_read" ON "public"."BookingPackage";
CREATE POLICY "bookingpackage_read" ON "public"."BookingPackage" FOR SELECT USING (
  "owner_user_id" = "auth"."uid"()
  OR ("owner_type" = 'home' AND "public"."home_has_permission"("home_id", 'calendar.view'::"public"."home_permission", "auth"."uid"()))
);

DROP POLICY IF EXISTS "packagecredit_service" ON "public"."PackageCredit";
CREATE POLICY "packagecredit_service" ON "public"."PackageCredit" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "packagecredit_read" ON "public"."PackageCredit";
CREATE POLICY "packagecredit_read" ON "public"."PackageCredit" FOR SELECT USING ("buyer_user_id" = "auth"."uid"());

DROP POLICY IF EXISTS "schedulingworkflow_service" ON "public"."SchedulingWorkflow";
CREATE POLICY "schedulingworkflow_service" ON "public"."SchedulingWorkflow" FOR ALL USING ("auth"."role"() = 'service_role');

DROP POLICY IF EXISTS "bookingreminderlog_service" ON "public"."BookingReminderLog";
CREATE POLICY "bookingreminderlog_service" ON "public"."BookingReminderLog" FOR ALL USING ("auth"."role"() = 'service_role');

DROP POLICY IF EXISTS "emailsuppression_service" ON "public"."EmailSuppression";
CREATE POLICY "emailsuppression_service" ON "public"."EmailSuppression" FOR ALL USING ("auth"."role"() = 'service_role');

DROP POLICY IF EXISTS "connectedcalendar_service" ON "public"."ConnectedCalendar";
CREATE POLICY "connectedcalendar_service" ON "public"."ConnectedCalendar" FOR ALL USING ("auth"."role"() = 'service_role');
DROP POLICY IF EXISTS "connectedcalendar_owner" ON "public"."ConnectedCalendar";
CREATE POLICY "connectedcalendar_owner" ON "public"."ConnectedCalendar" FOR SELECT USING ("user_id" = "auth"."uid"());

-- ============================================================
-- 8. GRANTS
-- ============================================================

GRANT ALL ON TABLE "public"."BookingPackage"     TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."PackageCredit"      TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."SchedulingWorkflow" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."BookingReminderLog" TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."EmailSuppression"   TO "authenticated", "service_role";
GRANT ALL ON TABLE "public"."ConnectedCalendar"  TO "authenticated", "service_role";
