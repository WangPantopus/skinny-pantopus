-- Backwards compatible: yes. Adds two nullable Mail columns and a partial index.
-- The deployed backend neither reads nor writes them, so it keeps working until
-- the new backend ships. Deploy migration before backend/web.
-- A deleted letter stays recoverable for 30 days: deleted_at/deleted_by hide it
-- from every list and letter view at once, a member who could see it can restore
-- it, and a nightly job hard-deletes letters deleted more than 30 days ago. Until
-- now DELETE /api/mailbox/:id removed the row at once with no notice or undo,
-- including a household letter the other members were still using.
SET LOCAL lock_timeout='5s';
ALTER TABLE public."Mail"
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES public."User"(id) ON DELETE SET NULL;
-- Recently deleted lists and the purge read only deleted rows.
CREATE INDEX idx_mail_deleted_at ON public."Mail"(deleted_at) WHERE deleted_at IS NOT NULL;
