-- Backwards compatible: yes. Adds one nullable column to Mail and one partial index; no table, function, constraint
-- change on existing columns, or grant. Deployed apps don't read the column, and the current backend never writes it.
--
-- Mail tab build, SRV-7 (bills from business invoices; the founder approved merging this change on 2026-10-27): when a
-- business invoices someone through Pantopus, a bill arrives in their Mail, linked to its invoice so its status (sent,
-- paid, void, overdue) is read live from the invoice and Pay opens the invoice's existing payment.
SET LOCAL lock_timeout='5s';

ALTER TABLE public."Mail" ADD COLUMN invoice_id uuid REFERENCES public."BusinessInvoice"(id) ON DELETE SET NULL;

COMMENT ON COLUMN public."Mail".invoice_id IS
  'The business invoice this bill was made from (one bill per invoice). Its status is read from the invoice.';

CREATE INDEX idx_mail_invoice ON public."Mail" USING btree (invoice_id) WHERE invoice_id IS NOT NULL;
