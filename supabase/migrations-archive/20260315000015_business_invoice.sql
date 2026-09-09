-- BIZ-30: BusinessInvoice table for post-service billing
CREATE TABLE IF NOT EXISTS "public"."BusinessInvoice" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_user_id" "uuid" NOT NULL,
    "recipient_user_id" "uuid" NOT NULL,
    "gig_id" "uuid",
    "line_items" "jsonb" NOT NULL DEFAULT '[]'::"jsonb",
    "subtotal_cents" integer NOT NULL,
    "fee_cents" integer NOT NULL DEFAULT 0,
    "total_cents" integer NOT NULL,
    "currency" character(3) DEFAULT 'usd' NOT NULL,
    "status" character varying(20) DEFAULT 'draft' NOT NULL,
    "due_date" timestamp with time zone,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "paid_at" timestamp with time zone,
    "payment_id" "uuid",
    "stripe_payment_intent_id" character varying(255),
    CONSTRAINT "BusinessInvoice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BusinessInvoice_status_check" CHECK (
        ("status")::text = ANY (ARRAY[
            'draft'::text, 'sent'::text, 'viewed'::text,
            'paid'::text, 'void'::text, 'overdue'::text
        ])
    ),
    CONSTRAINT "BusinessInvoice_total_positive" CHECK ("total_cents" > 0),
    CONSTRAINT "BusinessInvoice_business_fk" FOREIGN KEY ("business_user_id")
        REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "BusinessInvoice_recipient_fk" FOREIGN KEY ("recipient_user_id")
        REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "BusinessInvoice_gig_fk" FOREIGN KEY ("gig_id")
        REFERENCES "public"."Gig"("id") ON DELETE SET NULL,
    CONSTRAINT "BusinessInvoice_payment_fk" FOREIGN KEY ("payment_id")
        REFERENCES "public"."Payment"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_business_invoice_business" ON "public"."BusinessInvoice" ("business_user_id");
CREATE INDEX IF NOT EXISTS "idx_business_invoice_recipient" ON "public"."BusinessInvoice" ("recipient_user_id");
CREATE INDEX IF NOT EXISTS "idx_business_invoice_status" ON "public"."BusinessInvoice" ("status");
