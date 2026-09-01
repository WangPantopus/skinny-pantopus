-- Add guest_email to SupportTrainReservation so non-Pantopus users
-- can sign up for support train slots via email.

ALTER TABLE "public"."SupportTrainReservation"
  ADD COLUMN "guest_email" character varying(320);

-- Index for looking up reservations by guest email (e.g. duplicate checks)
CREATE INDEX "idx_support_train_reservation_guest_email"
  ON "public"."SupportTrainReservation" ("guest_email")
  WHERE "guest_email" IS NOT NULL;
