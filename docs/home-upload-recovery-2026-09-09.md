# Home upload accounting and recovery — September 9, 2026

Active work is in `/private/tmp/pantopus-home-upload-recovery`, branch
`codex/home-upload-recovery`, based on the completed
[document lifecycle PR #21](https://github.com/WangPantopus/skinny-pantopus/pull/21).
PR #21 is ready with final-head CI running at `49b103f84`; do not merge it until
those checks pass. Its report records both native deletion journeys and the
repaired iOS Files-picker upload/return/share journey.

## Atomic quota milestone

The database now checks and reserves bytes, file count and daily uploads under
the same quota row lock as File insertion. Rejected admission rolls back the
File too. The preliminary capacity check handles expired daily counters and
concurrent first-use quota creation. Existing quota rows/limits are preserved.
Direct browser writes to File/FileQuota are revoked: shipped clients use the
authenticated backend, while quota reads and permitted file reads remain.

SQL contracts pass in a separate local database cloned from the owned canonical
replay, preserving its catalog owners. Three real two-connection tests pass:
the second different-ID upload waits, then is denied by the storage, file-count
or daily limit respectively, without an extra File or quota charge. Direct quota
edits and negative file sizes are denied. The earlier document deletion/access
contract also passes with the stronger direct-write denial.

Private evidence is in `home-upload-recovery/quota-contracts-final.log` and
`quota-concurrency.cjs`. This migration has only been applied to the owned local
`home_upload_recovery_contract` database. The original canonical replay,
hosted staging and production have not received the quota changes.

## Reservation and recovery milestone

The upload API now reserves a durable File before writing its private object.
Admission failures write no provider bytes. Provider outages keep one reservation;
an identical retry finishes without charging quota again. A five-minute worker
claims at most 100 unpublished reservations older than 24 hours or deleted
tombstones. It locks and rechecks publication before releasing quota once.
Only derived paths in the configured private bucket are removable. Missing
configuration disables this worker. Failed removal retries after ten minutes;
completed tombstones reconcile daily to catch writes that outlive a crashed API.
Late-upload notification invalidates any older cleanup acknowledgement.

All 4,439 backend tests pass (283 suites, 16 tests/one suite skipped), including
62 focused storage/lifecycle/recovery cases. All 11 SQL contracts and the complete
pinned Supabase 2.116.0 function scan pass: 116 application functions, 73 bindings,
zero application errors and the six reviewed stock PostGIS diagnostics.
Two real connection races pass in both orders: publication wins and cleanup
preserves bytes/quota, or expiry wins and late publication is rejected without
resurrection. Private evidence: `recovery-contract.log`,
`recovery-application-lint.log`, `recovery-concurrency.cjs`, `recovery-tests.log`
and `backend-full.log` under the same private recovery directory. Privacy gates
pass on rerun; the first run had a socket hang-up in the unchanged audience
integration suite while the full backend suite ran concurrently.

## Work in progress and verification limits

Native dedicated export/preview directories and launch cleanup are implemented;
build/test and restart acceptance are pending. Active external shares remain
valid while the app backgrounds. Android recognizes its earlier scoped temporary
prefixes. iOS's old unmarked UUID directories cannot safely be distinguished
from unrelated temporary files; only the known synthetic leftovers can be
removed separately. Hosted recovery acceptance and document replacement remain.
The new migration has still only reached the owned local contract database.
