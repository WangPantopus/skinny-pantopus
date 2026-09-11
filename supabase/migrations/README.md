# Canonical migration stream

The two September 8 baseline files install the application schema and existing
static references into a fresh Supabase database. Legacy history is preserved in
../migrations-archive and backend/database/migrations.

Existing populated projects must complete their verified forward upgrade and
reviewed ledger adoption before migration automation is enabled. These baseline
DDL files must never run on an existing application schema. Environment rollout
and database switches remain disabled until that environment is adopted.

Add only new timestamped migrations after the latest baseline/version. Preserve
baseline and applied migration bytes. See docs/supabase-migration-automation-runbook.md.
