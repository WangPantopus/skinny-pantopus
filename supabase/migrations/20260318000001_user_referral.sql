-- ============================================================
-- UserReferral table — tracks invite codes and referral conversions
-- ============================================================

CREATE TABLE IF NOT EXISTS "UserReferral" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  referred_user_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ,
  source TEXT
);

-- Index for fast lookup by invite_code (public join endpoint)
CREATE INDEX IF NOT EXISTS idx_user_referral_invite_code ON "UserReferral" (invite_code);

-- Index for looking up a user's referral row quickly
CREATE INDEX IF NOT EXISTS idx_user_referral_referrer_id ON "UserReferral" (referrer_id);

-- RLS: service role only (backend manages all access)
ALTER TABLE "UserReferral" ENABLE ROW LEVEL SECURITY;
