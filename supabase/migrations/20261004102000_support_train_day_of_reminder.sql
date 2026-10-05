-- Backwards compatible: yes. Adds a nullable independent delivery marker;
-- existing clients and the evening-before job keep last_reminder_sent unchanged.
-- Existing applied schema has one marker for two deliveries. It cannot record
-- both independently, so extend this table rather than rewrite applied history
-- or introduce a parallel reservation/reminder table. No backfill is needed.
BEGIN;
SET LOCAL lock_timeout='5s';

ALTER TABLE public."SupportTrainReservation"
  ADD COLUMN IF NOT EXISTS day_of_reminder_sent_at timestamptz;

COMMIT;
