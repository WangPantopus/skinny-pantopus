-- Migration 113: Support Train core tables
--
-- Creates all 9 Support Train tables referenced in the design doc
-- Sections 19.2–19.9. Depends on migration 112 (Activity parent table).

BEGIN;

-- ─── 1. SupportTrain (Section 19.2) ────────────────────────────

CREATE TABLE "public"."SupportTrain" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "activity_id" "uuid" NOT NULL,
  "support_train_type" character varying(50) NOT NULL,
  "organizer_user_id" "uuid" NOT NULL,
  "recipient_user_id" "uuid",
  "recipient_home_id" "uuid",
  "story" "text",
  "status" character varying(50) NOT NULL DEFAULT 'draft',
  "sharing_mode" character varying(50) NOT NULL DEFAULT 'private_link',
  "show_exact_address_after_signup" boolean NOT NULL DEFAULT true,
  "enable_home_cooked_meals" boolean NOT NULL DEFAULT false,
  "enable_takeout" boolean NOT NULL DEFAULT false,
  "enable_groceries" boolean NOT NULL DEFAULT false,
  "enable_gift_funds" boolean NOT NULL DEFAULT false,
  "ai_draft_payload" "jsonb",
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "SupportTrain_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrain_support_train_type_check" CHECK (
    ("support_train_type")::"text" = ANY (ARRAY['meal_support'::"text"])
  ),

  CONSTRAINT "SupportTrain_status_check" CHECK (
    ("status")::"text" = ANY (ARRAY[
      'draft'::"text",
      'published'::"text",
      'active'::"text",
      'paused'::"text",
      'completed'::"text",
      'archived'::"text"
    ])
  ),

  CONSTRAINT "SupportTrain_sharing_mode_check" CHECK (
    ("sharing_mode")::"text" = ANY (ARRAY[
      'private_link'::"text",
      'invited_only'::"text",
      'direct_share_only'::"text"
    ])
  ),

  CONSTRAINT "SupportTrain_activity_id_fkey"
    FOREIGN KEY ("activity_id")
    REFERENCES "public"."Activity"("id") ON DELETE CASCADE,

  CONSTRAINT "SupportTrain_organizer_user_id_fkey"
    FOREIGN KEY ("organizer_user_id")
    REFERENCES "public"."User"("id") ON DELETE RESTRICT,

  CONSTRAINT "SupportTrain_recipient_user_id_fkey"
    FOREIGN KEY ("recipient_user_id")
    REFERENCES "public"."User"("id") ON DELETE SET NULL,

  CONSTRAINT "SupportTrain_recipient_home_id_fkey"
    FOREIGN KEY ("recipient_home_id")
    REFERENCES "public"."Home"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "idx_support_train_activity_id"
  ON "public"."SupportTrain" ("activity_id");

CREATE INDEX "idx_support_train_organizer_status"
  ON "public"."SupportTrain" ("organizer_user_id", "status");

CREATE INDEX "idx_support_train_recipient_user_id"
  ON "public"."SupportTrain" ("recipient_user_id")
  WHERE "recipient_user_id" IS NOT NULL;

DROP TRIGGER IF EXISTS "trg_supporttrain_updated_at" ON "public"."SupportTrain";
CREATE TRIGGER "trg_supporttrain_updated_at"
  BEFORE UPDATE ON "public"."SupportTrain"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


-- ─── 2. SupportTrainRecipientProfile (Section 19.3) ────────────

CREATE TABLE "public"."SupportTrainRecipientProfile" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "support_train_id" "uuid" NOT NULL,
  "household_size" integer,
  "adults_count" integer,
  "children_count" integer,
  "preferred_dropoff_start_time" time,
  "preferred_dropoff_end_time" time,
  "contactless_preferred" boolean NOT NULL DEFAULT false,
  "delivery_instructions" "text",
  "dietary_styles" "jsonb" NOT NULL DEFAULT '{}'::"jsonb",
  "allergies" "jsonb" NOT NULL DEFAULT '{}'::"jsonb",
  "favorite_meals" "jsonb" NOT NULL DEFAULT '{}'::"jsonb",
  "least_favorite_meals" "jsonb" NOT NULL DEFAULT '{}'::"jsonb",
  "favorite_restaurants" "jsonb" NOT NULL DEFAULT '{}'::"jsonb",
  "special_instructions" "text",
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "SupportTrainRecipientProfile_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrainRecipientProfile_support_train_id_fkey"
    FOREIGN KEY ("support_train_id")
    REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS "trg_supporttrainrecipientprofile_updated_at" ON "public"."SupportTrainRecipientProfile";
CREATE TRIGGER "trg_supporttrainrecipientprofile_updated_at"
  BEFORE UPDATE ON "public"."SupportTrainRecipientProfile"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


-- ─── 3. SupportTrainOrganizer (Section 19.4) ───────────────────

CREATE TABLE "public"."SupportTrainOrganizer" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "support_train_id" "uuid" NOT NULL,
  "user_id" "uuid" NOT NULL,
  "role" character varying(50) NOT NULL DEFAULT 'co_organizer',
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "SupportTrainOrganizer_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrainOrganizer_role_check" CHECK (
    ("role")::"text" = ANY (ARRAY[
      'primary'::"text",
      'co_organizer'::"text",
      'recipient_delegate'::"text"
    ])
  ),

  CONSTRAINT "SupportTrainOrganizer_support_train_id_fkey"
    FOREIGN KEY ("support_train_id")
    REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE,

  CONSTRAINT "SupportTrainOrganizer_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "public"."User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "idx_support_train_organizer_train_user"
  ON "public"."SupportTrainOrganizer" ("support_train_id", "user_id");


-- ─── 4. SupportTrainSlot (Section 19.5) ────────────────────────

CREATE TABLE "public"."SupportTrainSlot" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "support_train_id" "uuid" NOT NULL,
  "slot_date" date NOT NULL,
  "slot_label" character varying(50) NOT NULL,
  "support_mode" character varying(50) NOT NULL,
  "start_time" time,
  "end_time" time,
  "capacity" integer NOT NULL DEFAULT 1,
  "filled_count" integer NOT NULL DEFAULT 0,
  "status" character varying(50) NOT NULL DEFAULT 'open',
  "notes" "text",
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "SupportTrainSlot_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrainSlot_slot_label_check" CHECK (
    ("slot_label")::"text" = ANY (ARRAY[
      'Breakfast'::"text",
      'Lunch'::"text",
      'Dinner'::"text",
      'Groceries'::"text",
      'Custom'::"text"
    ])
  ),

  CONSTRAINT "SupportTrainSlot_support_mode_check" CHECK (
    ("support_mode")::"text" = ANY (ARRAY[
      'meal'::"text",
      'takeout'::"text",
      'groceries'::"text"
    ])
  ),

  CONSTRAINT "SupportTrainSlot_status_check" CHECK (
    ("status")::"text" = ANY (ARRAY[
      'open'::"text",
      'full'::"text",
      'canceled'::"text",
      'completed'::"text"
    ])
  ),

  CONSTRAINT "SupportTrainSlot_support_train_id_fkey"
    FOREIGN KEY ("support_train_id")
    REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_support_train_slot_train_date"
  ON "public"."SupportTrainSlot" ("support_train_id", "slot_date");

CREATE INDEX "idx_support_train_slot_open"
  ON "public"."SupportTrainSlot" ("status")
  WHERE "status" = 'open';

DROP TRIGGER IF EXISTS "trg_supporttrainslot_updated_at" ON "public"."SupportTrainSlot";
CREATE TRIGGER "trg_supporttrainslot_updated_at"
  BEFORE UPDATE ON "public"."SupportTrainSlot"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


-- ─── 5. SupportTrainReservation (Section 19.6) ─────────────────

CREATE TABLE "public"."SupportTrainReservation" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "slot_id" "uuid" NOT NULL,
  "support_train_id" "uuid" NOT NULL,
  "user_id" "uuid",
  "guest_name" character varying(255),
  "status" character varying(50) NOT NULL DEFAULT 'reserved',
  "contribution_mode" character varying(50) NOT NULL,
  "dish_title" character varying(255),
  "restaurant_name" character varying(255),
  "estimated_arrival_at" timestamp with time zone,
  "note_to_recipient" "text",
  "private_note_to_organizer" "text",
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "canceled_at" timestamp with time zone,

  CONSTRAINT "SupportTrainReservation_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrainReservation_status_check" CHECK (
    ("status")::"text" = ANY (ARRAY[
      'reserved'::"text",
      'canceled'::"text",
      'delivered'::"text",
      'confirmed'::"text"
    ])
  ),

  CONSTRAINT "SupportTrainReservation_contribution_mode_check" CHECK (
    ("contribution_mode")::"text" = ANY (ARRAY[
      'cook'::"text",
      'takeout'::"text",
      'groceries'::"text"
    ])
  ),

  CONSTRAINT "SupportTrainReservation_slot_id_fkey"
    FOREIGN KEY ("slot_id")
    REFERENCES "public"."SupportTrainSlot"("id") ON DELETE CASCADE,

  CONSTRAINT "SupportTrainReservation_support_train_id_fkey"
    FOREIGN KEY ("support_train_id")
    REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE,

  CONSTRAINT "SupportTrainReservation_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "public"."User"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_support_train_reservation_train_status"
  ON "public"."SupportTrainReservation" ("support_train_id", "status");

CREATE UNIQUE INDEX "idx_support_train_reservation_slot_reserved"
  ON "public"."SupportTrainReservation" ("slot_id")
  WHERE "status" = 'reserved';

DROP TRIGGER IF EXISTS "trg_supporttrainreservation_updated_at" ON "public"."SupportTrainReservation";
CREATE TRIGGER "trg_supporttrainreservation_updated_at"
  BEFORE UPDATE ON "public"."SupportTrainReservation"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


-- ─── 6. SupportTrainFund (Section 19.7) ────────────────────────

CREATE TABLE "public"."SupportTrainFund" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "support_train_id" "uuid" NOT NULL,
  "currency" character varying(3) NOT NULL DEFAULT 'USD',
  "goal_amount" integer,
  "total_amount" integer NOT NULL DEFAULT 0,
  "status" character varying(50) NOT NULL DEFAULT 'enabled',
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "SupportTrainFund_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrainFund_status_check" CHECK (
    ("status")::"text" = ANY (ARRAY[
      'enabled'::"text",
      'disabled'::"text",
      'closed'::"text"
    ])
  ),

  CONSTRAINT "SupportTrainFund_support_train_id_fkey"
    FOREIGN KEY ("support_train_id")
    REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE
);

DROP TRIGGER IF EXISTS "trg_supporttrainfund_updated_at" ON "public"."SupportTrainFund";
CREATE TRIGGER "trg_supporttrainfund_updated_at"
  BEFORE UPDATE ON "public"."SupportTrainFund"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();


-- ─── 7. SupportTrainFundContribution (Section 19.7) ────────────

CREATE TABLE "public"."SupportTrainFundContribution" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "support_train_fund_id" "uuid" NOT NULL,
  "contributor_user_id" "uuid",
  "amount" integer NOT NULL,
  "currency" character varying(3) NOT NULL DEFAULT 'USD',
  "note" "text",
  "is_anonymous" boolean NOT NULL DEFAULT false,
  "payment_status" character varying(50) NOT NULL,
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "SupportTrainFundContribution_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrainFundContribution_fund_id_fkey"
    FOREIGN KEY ("support_train_fund_id")
    REFERENCES "public"."SupportTrainFund"("id") ON DELETE CASCADE,

  CONSTRAINT "SupportTrainFundContribution_contributor_user_id_fkey"
    FOREIGN KEY ("contributor_user_id")
    REFERENCES "public"."User"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_support_train_fund_contribution_fund_created"
  ON "public"."SupportTrainFundContribution" ("support_train_fund_id", "created_at" DESC);


-- ─── 8. SupportTrainUpdate (Section 19.8) ──────────────────────

CREATE TABLE "public"."SupportTrainUpdate" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "support_train_id" "uuid" NOT NULL,
  "author_user_id" "uuid" NOT NULL,
  "body" "text" NOT NULL,
  "media_urls" "jsonb",
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "SupportTrainUpdate_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrainUpdate_support_train_id_fkey"
    FOREIGN KEY ("support_train_id")
    REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE,

  CONSTRAINT "SupportTrainUpdate_author_user_id_fkey"
    FOREIGN KEY ("author_user_id")
    REFERENCES "public"."User"("id") ON DELETE CASCADE
);


-- ─── 9. SupportTrainInvite (Section 19.9) ──────────────────────

CREATE TABLE "public"."SupportTrainInvite" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "support_train_id" "uuid" NOT NULL,
  "invited_by_user_id" "uuid" NOT NULL,
  "invitee_user_id" "uuid",
  "invitee_email" character varying(255),
  "invite_token" character varying(255) NOT NULL,
  "status" character varying(50) NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
  "accepted_at" timestamp with time zone,

  CONSTRAINT "SupportTrainInvite_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "SupportTrainInvite_support_train_id_fkey"
    FOREIGN KEY ("support_train_id")
    REFERENCES "public"."SupportTrain"("id") ON DELETE CASCADE,

  CONSTRAINT "SupportTrainInvite_invited_by_user_id_fkey"
    FOREIGN KEY ("invited_by_user_id")
    REFERENCES "public"."User"("id") ON DELETE CASCADE,

  CONSTRAINT "SupportTrainInvite_invitee_user_id_fkey"
    FOREIGN KEY ("invitee_user_id")
    REFERENCES "public"."User"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_support_train_invite_train"
  ON "public"."SupportTrainInvite" ("support_train_id");

CREATE UNIQUE INDEX "idx_support_train_invite_token"
  ON "public"."SupportTrainInvite" ("invite_token");

COMMIT;
