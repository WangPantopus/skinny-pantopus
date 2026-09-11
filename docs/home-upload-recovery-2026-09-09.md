# Home upload accounting and recovery — September 9, 2026

Active work is in `/private/tmp/pantopus-home-upload-recovery`, branch
`codex/home-upload-recovery`, based on the completed
[document lifecycle PR #21](https://github.com/WangPantopus/skinny-pantopus/pull/21).
PR #21 merged as `c1f411c583e9375616e06570bdcea062f16bf532` after
[final-head CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34369706912)
passed at `49b103f84`. Its report records both native deletion journeys and the
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
`quota-concurrency.cjs`. At that checkpoint the migration had only reached the
owned local `home_upload_recovery_contract` database. Its subsequent compatible
Free-staging application is recorded below; production remains untouched.

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

## Hosted staging milestone

Migration `20260909150000_home_upload_recovery.sql`, SHA-256
`238551d953935fee17e3cc4b9c62d804b5fd90bcfe8c76adc2317d9e453bb92c`,
is applied only to Free staging `ptudkfqdhqpkbkzqlabu`. Existing File,
HomeDocument and FileQuota row hashes are unchanged; the absent migration ledger
remains absent. Production is untouched. The private loopback candidate runs
`35cd3eee7`, image `07c3fc8843f42e5f4065acad6c5323ee1c3c0fa7024323b9bbc82170ae22fc0f`.
Public staging API/worker remain on their prior revision; candidate jobs stay
disabled and the recovery worker was invoked manually for scoped acceptance.

Live concurrent uploads admit one and deny the other with no rejected object.
Abandoned expiry releases quota once; a simulated provider outage retains a
retry record, then restored removal succeeds. A recent reservation survives.
Both notified and unreported late writes reconcile, while old UUID/content
returns stay denied. All five original documents and exact I5 bytes survive;
synthetic quota limits and usage are restored. Four disposable upload IDs remain
as tombstones or a rejected admission; no test document remains published.

The first provider-removal assertion saw a cached download after successful
removal. Provider listing and a fresh uncached request independently proved
absence. The resumed check uses both and passes. New uploads now request zero
cache lifetime; all 62 focused tests pass after that change. The follow-up
candidate now runs `4609759e1`, image
`14bdf3b4117a7f481ba81754f6cec407851da1a36f389a3ae5571782bc849153`.
Live `max-age=0`, exact bytes, empty provider listing and immediate normal
download denial after deletion pass; its disposable file is removed and quota
restored. The original five documents remain. Evidence is private under
`recovery-staging-migration.json`, `build-plan.json`, `recovery-journey.log`,
`inspect-recovery.log`, `recovery-resume.log` and `cache-journey.log`; do not rerun
completed publishers.

## Work in progress and verification limits

Native dedicated export/preview directories and launch cleanup pass 35 iOS and
34 Android focused tests, strict Swift lint, Kotlin formatting/Detekt and both
builds. Both native share → process restart checks now pass: the system share
sheet receives the exact 609-byte file, and a fresh process removes the dedicated
copy. iOS evidence is `ios-native-20260909T155807.log` and
`ios-native-restart.json`; Android evidence is the scoped UI captures and
`android-native-restart.json`. No external recipient was selected. Active external shares remain
valid while the app backgrounds. Android recognizes its earlier scoped temporary
prefixes. iOS's old unmarked UUID directories cannot safely be distinguished
from unrelated temporary files; only the known synthetic leftovers can be
removed separately. Two such known synthetic iOS leftovers were removed after
matching all 609 bytes and their hash; unrelated temporary files were preserved.
Document replacement remains next.
