# Home document lifecycle — September 9, 2026

Work continues in `/private/tmp/pantopus-home-file-access` on
`codex/home-document-lifecycle`, following the [byte-delivery milestone](home-document-storage-2026-09-09.md).

## Deletion implementation and local verification

Both native Delete actions now call the authenticated Home document endpoint.
They require confirmed deletion before leaving the screen, clear private content
on a denied/failed delete, remove export copies, and prevent repeated taps or
foreground reloads from restoring a deleted preview. Both native confirmation →
removal → refreshed list journeys now pass against the private staging candidate.

The API checks current `docs.manage` and document visibility. Its service-only
database transaction locks the file and document, checks the expected version
and visibility, releases the original uploader's quota once, deletes the list
record and retains a File tombstone. Repeating the request reconciles pending
private-object removal. Storage failure returns committed deletion with cleanup
pending; it cannot expose the deleted content. Generic retention keeps upload
UUID tombstones so old retries cannot recreate the document.

The migration prevents generic File reads and direct client edits from bypassing
the private Home byte contract. A HomeDocument trigger locks and verifies its
active File before publishing a row, rejecting an in-flight retry after deletion.
Existing legacy file access is retained.

Verification so far:

- All 4,425 backend tests pass (282 suites; 16 tests and one suite already skipped).
  Privacy gates pass. Ten new deletion regressions cover permissions, sensitive
  visibility, changed versions, database/storage failure, retry and old upload IDs.
- Local SQL contract passes, including raw File isolation, service-only RPC,
  changed version/visibility rejection, quota idempotency, retention and late
  upload resurrection denial. A real two-connection test confirms the second
  deletion waits and returns a reused result, with one quota release.
- Pinned CLI/function lint passes: 114 application functions, 73 trigger bindings,
  zero application errors and six previously reviewed stock PostGIS diagnostics.
- 33 Android document/list/upload tests and 17 iOS access/list tests pass. Strict
  Swift lint, Android formatting/Detekt/assemble and iOS test-bundle build pass.
- Live concurrent API deletion removes one private object and releases quota
  once; viewer and sensitive-scope denial, old content 404 and old upload 409
  pass. Both native deletion journeys pass and their removed provider objects,
  quota and old-content denial were independently verified through the API.

Evidence is in the private recovery directory `home-file-access/`, including
`delete-backend-tests.log`, `delete-privacy.log`, `delete-migration-rehearsal.log`,
`delete-concurrency.cjs`, `delete-function-lint.log`, `delete-android-results.json`
and `delete-ios-tests.log`. No credentials, tokens or private object contents are
in this report.

## Isolated staging milestone

The compatible migration was applied only to the Free staging database after
local rehearsal and a hosted catalog preflight. Existing File, HomeDocument and
FileQuota rows were byte-for-byte unchanged. Staging had no hosted migration
ledger table; none was created. Production was not touched. Private schema and
record-hash backups are retained in `delete-stage-*.log`.

The private API candidate runs backend `ed315cc54`, image
`3f1c2324f636ee8edddf6b3813fd71312f50f8206ebbd3413f890fb0a53cd4ab`, on the
existing host's loopback port. The previous candidate is stopped and retained.
Public staging API/worker still use `65d2cc2d9`. Three disposable documents were
removed by the API, iOS and Android respectively. The original four documents
remain, and the temporary fixture-only `docs.manage` grant was removed.

The iOS deletion UI result is `ios-delete-20260909T144151.log`; Android's fresh
confirmation and returned list are `android-delete-confirm.xml` and
`android-delete-return-list.xml`. `verify-ios-delete.log` and
`verify-android-delete.log` verify actual provider/quota state. An initial Android
operator build used the default emulator hostname and failed the candidate's
request-signing check; the rebuilt APK uses the correct localhost origin, and
normal synthetic sign-in and deletion pass. This was a test configuration
mistake, not a reason to weaken request signing.

## iOS Files picker and upload return

The complete Files picker → byte upload → stable document list → exact document
→ Share journey now passes on the owned iPhone 17 / iOS 26.5 simulator. Both the
authenticated stored file and the native share copy match all 609 fixture bytes.
Quota increments once. The guarded UI test is skipped in normal CI without its
private fixture inputs. Final live result: `ios-picker-20260909T151502.log`,
`verify-ios-picker.log` and `ios-picker-share-verification.json`.
All 34 final iOS upload/access/list unit tests and strict Swift lint/format pass
after the navigation repair (`ios-document-final-unit.log`).

This acceptance exposed a real iOS navigation bug: upload completion removed
the route, then a delayed close callback and environment dismissal popped again.
The form now closes once through its navigation owner or environment dismissal;
both tab roots leave completion navigation to that one close. The initial I4
document was independently byte-verified and then removed through the authorized
API. Its provider object and quota were cleared before fresh I5 acceptance.
The final I5 document remains with the original four documents as evidence.

## Remaining limits and next actions

Finish replacement, abandoned upload
reconciliation and atomic quota enforcement across different upload IDs. Legacy
metadata-only documents do not yet use this byte-deletion contract. Source integration and isolated candidates
do not certify the public staging or production deployment.
Private native share copies also need cleanup after process termination; current
normal-close/delete cleanup cannot cover a process killed while its share sheet
is open. Keep that case in the remaining lifecycle work.
