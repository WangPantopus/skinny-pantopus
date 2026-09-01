-- Migration 114: Add UNIQUE constraint on SupportTrainRecipientProfile.support_train_id
--
-- Each Support Train has at most one recipient profile. Required for
-- upsert operations on the recipient-profile endpoint.

ALTER TABLE "public"."SupportTrainRecipientProfile"
  ADD CONSTRAINT "SupportTrainRecipientProfile_support_train_id_key"
  UNIQUE ("support_train_id");
