# Home document lifecycle — September 9, 2026

Work continues in `/private/tmp/pantopus-home-file-access` on
`codex/home-document-lifecycle`, following the [byte-delivery milestone](home-document-storage-2026-09-09.md).

## Deletion implementation and local verification

Both native Delete actions now call the authenticated Home document endpoint.
They require confirmed deletion before leaving the screen, clear private content
on a denied/failed delete, remove export copies, and prevent repeated taps or
foreground reloads from restoring a deleted preview. Returning to the list
fetches current documents. Live native list refresh is the next acceptance check.

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
  Swift lint passes. Native quality/build and live deletion acceptance continue.

Evidence is in the private recovery directory `home-file-access/`, including
`delete-backend-tests.log`, `delete-privacy.log`, `delete-migration-rehearsal.log`,
`delete-concurrency.cjs`, `delete-function-lint.log`, `delete-android-results.json`
and `delete-ios-tests.log`. No credentials, tokens or private object contents are
in this report.

## Remaining limits and next actions

Complete isolated staging API and both native deletion journeys with disposable
documents, retaining the original shared PDF evidence. Confirm provider cleanup
and old-content denial after removal. Then finish replacement, abandoned upload
reconciliation and atomic quota enforcement across different upload IDs. Legacy
metadata-only documents do not yet use this byte-deletion contract. The iOS OS
picker still needs live acceptance. Source integration and isolated candidates
do not certify the public staging or production deployment.
