-- M5: BusinessProfile avg_response_minutes
-- Cached field updated nightly: average first-reply time for inquiry chats
ALTER TABLE "BusinessProfile"
  ADD COLUMN IF NOT EXISTS "avg_response_minutes" INTEGER;
