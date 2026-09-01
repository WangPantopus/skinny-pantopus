-- Migration 116: Add reminder tracking to SupportTrainReservation
--
-- Tracks when the last reminder was sent so day-of reminders are not duplicated.

ALTER TABLE "public"."SupportTrainReservation"
  ADD COLUMN IF NOT EXISTS "last_reminder_sent" timestamp with time zone;
