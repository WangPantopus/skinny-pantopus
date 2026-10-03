-- Backwards compatible: yes
-- Native Log/Edit accepted these per-entry values but kept them only in memory.
-- The existing log has no category/contact slot; HomeVendor.contact and
-- HomeMaintenanceTemplate.maint_type describe separate entities. Extend the log
-- without rewriting applied migrations, creating vendor rows or encoding notes.
-- Deploy before the backend begins writing these fields. Legacy rows stay NULL.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE public."HomeMaintenanceLog"
  ADD COLUMN category text,
  ADD COLUMN performer_contact text,
  ADD CONSTRAINT home_maintenance_log_category_check CHECK (
    category IS NULL OR category IN (
      'hvac', 'plumbing', 'electrical', 'roof', 'gutter', 'appliance', 'pest',
      'landscape', 'cleaning', 'painting', 'safety', 'chimney', 'generic'
    )
  ),
  ADD CONSTRAINT home_maintenance_log_contact_length_check CHECK (
    performer_contact IS NULL OR char_length(performer_contact) <= 4000
  );

RESET lock_timeout;
RESET statement_timeout;
