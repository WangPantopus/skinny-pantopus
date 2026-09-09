-- User block list: prevents direct chat creation and messaging between blocked pairs.
-- Blocking is directional (A blocks B), but enforcement is bidirectional
-- (neither A nor B can message the other while a block exists).

CREATE TABLE "UserBlock" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id UUID NOT NULL REFERENCES "User"(id),
  blocked_user_id UUID NOT NULL REFERENCES "User"(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_user_id, blocked_user_id),
  CHECK(blocker_user_id != blocked_user_id)
);

-- Indexes for fast lookup in both directions
CREATE INDEX idx_userblock_blocker ON "UserBlock" (blocker_user_id);
CREATE INDEX idx_userblock_blocked ON "UserBlock" (blocked_user_id);

-- RLS: users can only see/manage their own blocks
ALTER TABLE "UserBlock" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
  ON "UserBlock" FOR SELECT
  USING (auth.uid() = blocker_user_id);

CREATE POLICY "Users can create their own blocks"
  ON "UserBlock" FOR INSERT
  WITH CHECK (auth.uid() = blocker_user_id);

CREATE POLICY "Users can delete their own blocks"
  ON "UserBlock" FOR DELETE
  USING (auth.uid() = blocker_user_id);
