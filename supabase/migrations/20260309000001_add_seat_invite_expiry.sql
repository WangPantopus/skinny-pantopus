-- Add invite_expires_at to BusinessSeat for invite expiry enforcement (AUTH-1.6)
ALTER TABLE "BusinessSeat"
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN "BusinessSeat".invite_expires_at
  IS 'When this seat invite expires. NULL for existing rows; new invites set NOW() + 14 days.';
