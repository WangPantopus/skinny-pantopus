# iOS private household task attachments

Status: verified source checkpoint ready for integration, September 10, 2026.
This follows exact task notification routing `c1cac2a30`. Backend attachment
reservation, current authority, retirement and cleanup remain the previously
verified contracts in [the task media report](home-task-private-media-2026-09-10.md).

## User behavior

Both Home task entry points expose the same private attachment sheet from their
current exact task detail. Current read access reveals metadata and exact file
bytes; both the media response and exact task capability must permit upload
before a write. No Home role or notification payload grants attachment access.

One chosen file keeps its original upload UUID, bytes and MIME type until the
result is confirmed. The upload sends a generated stable filename instead of the
original private local filename. An unknown response, timeout, rate limit or
malformed receipt keeps the same operation for explicit retry. A file that has
never been submitted can be discarded locally; an attempted file cannot be
silently replaced by another payload. A background return reads current state
without automatically repeating a POST.

Only an exact `409 HOME_TASK_UPLOAD_RETIRED` response exposes an explicit
“Clear removed upload request” action for that original upload. The action
requires the current visible session and matching pending ID, clears local
selection, then reads current state. It does not delete a file, submit another
request or allocate a new UUID. A deliberate new file choice creates the next
operation; queued Save, discard or acknowledgment actions from the old selection
cannot act on it. Other conflicts and unknown responses retain the original
operation.

List and byte operations check the current task and opening local/server session
before and after their work. A preview requires the exact current available
record, MIME type and byte length. Changed records, denied access, missing
content, screen departure or a replaced session prevent late bytes from appearing.
PDF, text and images render in memory, without a public URL or browser. Images
reuse bounded ImageIO decoding at 1600 pixels. Task text previews display at most
200,000 characters with an explicit truncation label; the existing claim preview
retains its previous behavior and verification copy.

Removal targets the exact original file and requires a retired, unavailable,
cleanup-complete response plus a current follow-up read. Unknown removal keeps
that same file for explicit retry. A reopened list shows incomplete reservations,
retired history and pending cleanup. Legacy public attachments stay unavailable
and are never treated as trusted download or deletion references.

Closing the attachment sheet hides content while retaining its model in the
existing task screen. Backgrounding hides metadata/previews and invalidates
suspended operations. Leaving the task or retiring its session clears the retained
selection. An already in-flight request may still complete on the server; its
late result cannot restore content to the retired screen. On reopening, the authoritative list shows any server reservation
or saved result; an incomplete reservation can be removed before deliberately
choosing a replacement file. This milestone does not persist file bytes to disk
or claim automatic cold-start upload replay.

## Verification

The eleven Swift files pass SwiftFormat, strict SwiftLint with zero findings,
Swift parsing and whitespace checks. Independent source review, including the
final exact-ID acknowledgment and queued-action controls, passes.

The R2 actual app build and selected suites passed **89 tests, zero failures**:
14 media client, 12 media view-model, 20 private claim evidence, 27 task access,
11 task notification routing and five task notification tap cases. Evidence:
`/private/tmp/pantopus-home-ios-task-media-r2.log`.

The final terminal-recovery app run passed **15 tests, zero failures**: the 12
affected media view-model cases and three new terminal-upload cases. Evidence:
`/private/tmp/pantopus-home-ios-task-media-r3.log`. Together with the 77 unchanged
R2 cases, all **92 current cases** have passed. These are two relevant app runs,
not one combined 92-test run. Both compiled the actual app, and the final source
passed independent peer review with no additional blocker.

The first build compiled the app but stopped before tests on two missing test
`throws` declarations. Corrected fixture reads preserve every assertion; no
runtime behavior changed in that repair. Final focused tests also exercise
record retirement, filename and size changes after bytes have downloaded.

New tests cover read-only access, malformed/duplicate/foreign metadata, legacy
quarantine, original multipart UUID/filename/bytes/session, changed records and
access during downloads, exact removal receipts, removing another uploader's
file, retries after server retirement, 503/408/429 upload recovery, late picker
callbacks, background return during an upload, queued activation and session
replacement during a provider request. All fixtures use synthetic in-process
HTTP responses; no hosted storage or provider writes are involved.

Private source manifest:
`/private/tmp/pantopus-home-ios-task-media-files.txt`.
Source aggregate (manifest path, NUL, bytes, NUL for each entry):
`b257aa04f91827edfae2d7bade2144d0dc4514dc718bd6ace6f315d3f972cca4`.

## Remaining acceptance

Installed native picker/preview/removal and the complete household journey still
need acceptance after source integration. App tests alone do not establish
hosted bucket configuration, object-provider behavior or physical notification
delivery. No owner-phone installation, hosted migration, role default or paid
subscription changes in this slice. Automatic recurrence and remaining ownership,
relationship and release work stay in the handoff; paid dependencies remain one
final launch-preparation step.
