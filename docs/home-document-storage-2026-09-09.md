# Home document file delivery — September 9, 2026

Development branch: `codex/home-document-storage`, based on the document access
repair in PR #19. This is an unfinished delivery milestone, not live acceptance.

## Backend byte path

`POST /api/homes/:homeId/documents/upload` accepts the file and document metadata
as multipart data, after checking `docs.upload` and the requested visibility.
It stores bytes in an explicitly configured **private** Supabase bucket, then
creates a quota-accounted File and linked HomeDocument record. Storage
configuration is checked rather than created implicitly; a missing or public
bucket fails closed. The path uses no public or client-visible signed URLs.

A client upload UUID identifies one attempt across retries. The server binds it
to the caller, Home, file checksum and metadata. Identical completed requests
return the existing record; conflicting reuse cannot overwrite it. If file
storage succeeds but a database response fails, the same request reconciles
the object and rows, then completes without charging quota twice. Storage or
file records left by an abandoned partial attempt still need scoped cleanup;
they are not reported as a completed document.

`GET /api/homes/:homeId/documents/:documentId/content` checks current document
permission and visibility, linked File ownership/Home/deletion state, the
server-derived object path, private bucket and byte checksum. It returns the
bytes with private/no-store headers. An old content path cannot bypass a new
access denial. Metadata-only creation cannot supply a trusted file ID, storage
reference or reserved server fields. The new upload operation has its own
authenticated-user rate limit and a 25 MiB file limit.

## Verification so far

All 4,414 backend tests pass (281 suites; 16 existing tests and one suite skipped).
The 74 targeted document/file tests cover exact bytes, private bucket checks,
corruption, invalid paths, duplicate/conflicting retries, partial database
failure, quota, revoked access, sensitive scopes and old deleted-file links.
Storage is mocked in these tests. Hosted bucket setup and live concurrent
requests remain unverified.

## Native upload and iOS file access

Both native pickers now retain the actual bounded file bytes after the picker
closes and send multipart uploads. A retry keeps its UUID while the bytes and
metadata match; success requires a linked File and authenticated content path.
Empty/oversized files and metadata without bytes cannot claim a completed upload.
The visibility label now says “Managers and owners,” matching its stored scope.

The iOS simulator passes all 22 upload/preview/export tests. Private previews use
APIClient's authenticated Home/document endpoint, never a supplied URL. Denial
clears previously loaded content; backgrounding clears the document and a return
reloads it. Open/Share first check access again, then pass a private temporary
copy containing the exact bytes to the system share sheet; the copy is removed
when sharing closes or the screen leaves. Strict Swift lint and formatting pass.
Android upload tests pass; its matching preview/export checks are still running.
These are stubbed local tests, not hosted storage or physical-device acceptance.

The backend also normalizes UUID case and prevents a retry from revealing a
document whose visibility was restricted after upload. Its final 4,414-test run
passes. PRs #17–#19 have merged with passing integrated checks; #19 is master
`0021cb59d6649f501a86bacd4d69edfc932c0e94`.

## Next action

Finish Android preview/export verification and native visual acceptance. The existing detail screens
also have unfinished delete/replace/share actions; finish the authorized
operations or make their limits explicit in the user flow. Correct the current
“Owners only” label, whose stored `managers` scope also includes managers.

Then provision only the isolated staging private bucket on existing/free
capacity, run upload/read/retry/revocation/cleanup acceptance through the actual
API and native clients, and verify the proxy body limit matches the file limit.
No bucket has been created yet. Native changes remain development builds;
public staging API/worker and production remain unchanged.
