-- Backwards compatible: yes. Adds two columns to Mail, both with defaults, and two indexes; no table, function,
-- constraint or grant changes. Deployed apps don't read the columns; the current backend never writes them, so a piece
-- it stores lands at once (the default), as today. Existing pieces keep their creation time as their delivery time.
--
-- Mail tab build, SRV-1 (founder decision 2026-10-27: ordinary mail arrives once a day, time-sensitive pieces right
-- away; the founder approved merging this change on 2026-10-27). The backend sets delivered_at when it stores a piece:
-- the next 7 a.m. in the mailbox's time zone, or at once for a special delivery (special_delivery true). Every read
-- shows only pieces whose delivered_at has come, so delivery never waits on a scheduled job.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."Mail" ADD COLUMN delivered_at timestamptz;
ALTER TABLE public."Mail" ADD COLUMN special_delivery boolean NOT NULL DEFAULT false;

-- Existing pieces were in the box the moment they were stored. (The migration runs as postgres, which
-- enforce_mail_update_columns lets through.)
UPDATE public."Mail" SET delivered_at = coalesce(created_at, now()) WHERE delivered_at IS NULL;

ALTER TABLE public."Mail" ALTER COLUMN delivered_at SET DEFAULT now();
ALTER TABLE public."Mail" ALTER COLUMN delivered_at SET NOT NULL;

COMMENT ON COLUMN public."Mail".delivered_at IS
  'When the piece went into the mailbox: the next 7 a.m. in the mailbox''s time zone, or the moment it was stored for a special delivery. Reads show a piece only once delivered_at has come. Pieces stored before 2026-10-27: their created_at.';
COMMENT ON COLUMN public."Mail".special_delivery IS
  'Arrived on its own, outside the morning round: certified, time-sensitive, overdue, or due that day or earlier.';

-- The drawer lists and counts read a person's or a Home's delivered pieces, newest delivery first.
CREATE INDEX idx_mail_recipient_user_delivered ON public."Mail" USING btree (recipient_user_id, delivered_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_mail_recipient_home_delivered ON public."Mail" USING btree (recipient_home_id, delivered_at DESC)
  WHERE deleted_at IS NULL AND recipient_home_id IS NOT NULL;
