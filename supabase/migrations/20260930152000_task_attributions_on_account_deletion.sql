-- Backwards compatible: yes. Makes five person columns nullable and sets their
-- foreign keys to ON DELETE SET NULL; no rows change when this is applied. The
-- deployed backend and apps keep writing a person into each column; they only
-- see NULL for a row whose person has deleted their account, which this change
-- makes possible for the first time. Every reader already handles it: the
-- matching web and app release shows "Former member" for that person, and
-- older versions show their generic label (Anonymous, Someone, Neighbor).
--
-- Account deletion (DELETE /api/users/account) sets these columns to NULL
-- before deleting the person, like every other attribution column, but they
-- were NOT NULL, so the step failed and the deletion was refused (409
-- ACCOUNT_RECORDS_RETAINED) for anyone who had ever:
-- - asked a question on a task (GigQuestion.asked_by);
-- - reported a no-show, or been reported (GigIncident.reported_by and
--   .reported_against), task owners included;
-- - requested a change on a task (GigChangeOrder.requested_by);
-- - started a refund (Refund.initiated_by; people with payments are refused
--   earlier, PAYMENT_HISTORY_RETAINED, so this matters for delegates).
-- The rows stay for the other person (the owner's Q&A, the task's incident
-- and change history, the refund record); only the link to the deleted
-- person is cleared.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."GigQuestion"
  ALTER COLUMN asked_by DROP NOT NULL,
  DROP CONSTRAINT "GigQuestion_asked_by_fkey",
  ADD CONSTRAINT "GigQuestion_asked_by_fkey"
    FOREIGN KEY (asked_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."GigIncident"
  ALTER COLUMN reported_by DROP NOT NULL,
  ALTER COLUMN reported_against DROP NOT NULL,
  DROP CONSTRAINT "GigIncident_reported_by_fkey",
  ADD CONSTRAINT "GigIncident_reported_by_fkey"
    FOREIGN KEY (reported_by) REFERENCES public."User"(id) ON DELETE SET NULL,
  DROP CONSTRAINT "GigIncident_reported_against_fkey",
  ADD CONSTRAINT "GigIncident_reported_against_fkey"
    FOREIGN KEY (reported_against) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."GigChangeOrder"
  ALTER COLUMN requested_by DROP NOT NULL,
  DROP CONSTRAINT "GigChangeOrder_requested_by_fkey",
  ADD CONSTRAINT "GigChangeOrder_requested_by_fkey"
    FOREIGN KEY (requested_by) REFERENCES public."User"(id) ON DELETE SET NULL;

ALTER TABLE public."Refund"
  ALTER COLUMN initiated_by DROP NOT NULL,
  DROP CONSTRAINT "Refund_initiated_by_fkey",
  ADD CONSTRAINT "Refund_initiated_by_fkey"
    FOREIGN KEY (initiated_by) REFERENCES public."User"(id) ON DELETE SET NULL;
