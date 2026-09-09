-- ============================================================
-- Monthly Receipt table + email_receipts preference toggle
-- ============================================================

-- 1. MonthlyReceipt table — stores computed monthly summaries
CREATE TABLE IF NOT EXISTS "public"."MonthlyReceipt" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "receipt" jsonb NOT NULL,
    "emailed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "MonthlyReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MonthlyReceipt_user_year_month_key" UNIQUE ("user_id", "year", "month"),
    CONSTRAINT "MonthlyReceipt_month_check" CHECK ("month" >= 1 AND "month" <= 12),
    CONSTRAINT "MonthlyReceipt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE
);

CREATE INDEX idx_monthly_receipt_user_id ON "public"."MonthlyReceipt" ("user_id");

ALTER TABLE "public"."MonthlyReceipt" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_receipt_select_own" ON "public"."MonthlyReceipt"
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

GRANT ALL ON TABLE "public"."MonthlyReceipt" TO "anon";
GRANT ALL ON TABLE "public"."MonthlyReceipt" TO "authenticated";
GRANT ALL ON TABLE "public"."MonthlyReceipt" TO "service_role";

-- 2. Add email_receipts toggle to MailPreferences
ALTER TABLE "public"."MailPreferences"
    ADD COLUMN IF NOT EXISTS "email_receipts" boolean DEFAULT true;
