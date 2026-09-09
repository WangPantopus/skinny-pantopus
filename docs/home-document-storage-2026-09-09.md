# Home document file delivery — September 9, 2026

Development branch: `codex/home-document-storage`, based on the document access
repair in PR #19. Live API and paired native acceptance pass. Document lifecycle
operations remain in progress.

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

All 4,415 backend tests pass (281 suites; 16 existing tests and one suite skipped).
The 75 targeted document/file tests cover exact bytes, private bucket checks,
corruption, invalid paths, duplicate/conflicting retries, partial database
failure, quota, revoked access, sensitive scopes and old deleted-file links.
Storage is mocked in these tests. The separate live matrix below verifies the
isolated hosted bucket and concurrent requests.

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
Android document coverage passes 49 tests, with five existing snapshot tests
skipped; formatting, Detekt and Android lint pass. Its preview uses the
authenticated endpoint, clears denied/background content, and shares a private
FileProvider copy after checking access again. PDF preview temp files are removed.
These are stubbed local tests, not hosted storage or physical-device acceptance.

The backend also normalizes UUID case and prevents a retry from revealing a
document whose visibility was restricted after upload. Its final 4,415-test run
passes. PRs #17–#19 have merged with passing integrated checks; #19 is master
`0021cb59d6649f501a86bacd4d69edfc932c0e94`.

## Next action

Finish delete/replace, abandoned upload cleanup and quota concurrency, then the
remaining native picker variants. Verify the public proxy body limit before
rolling out the candidate. The initial member request failed closed because
staging has no default member permission rows; document grants were added only
for this synthetic Home. Those grants do not certify default IAM reference data.

Native changes remain development builds;
public staging API/worker and production remain unchanged.

## Live private storage milestone

The updated isolated candidate runs `bcba6739c` (image
`sha256:ba9e7669b6f9651f1c4902e38d641c8d6b5726967f36b9c5d79f98d14e60c5bb`).
Live upload → listing → exact-byte retrieval passes for the synthetic owner and
explicitly permitted member. Three concurrent identical uploads produce one
File/HomeDocument and one quota charge. Changed metadata conflicts, unauthenticated
content fails, sensitive content is denied to the member, and the bucket's public
object URL does not return bytes. The repaired legacy list excludes all three
byte-contract records. Explicit document-permission denial and inactive
membership both deny old content paths; restoring the fixture's access works.

The three synthetic documents, Home, member and private bucket are retained for
native acceptance. The existing account-delivery account is the synthetic owner;
no real household, device token, production service or public staging API was
changed. The older candidate is stopped and retained for rollback. Do not rerun
one-time candidate creation scripts without reconciling current container state.

## Native entry and diagnostic repairs

The Place landing screen previously offered no general Home tools entry, and
both Home dashboards omitted Documents. Both clients now route Home tools to
the existing household dashboard and show Documents only with confirmed read
access. Missing or denied access does not expose the document count.

Android debug HTTP diagnostics now record only method/status/timing. Canary
tests verify that credentials, device proofs, URLs and private file bodies do
not reach the logger and that the transport bytes remain unchanged.

The iOS acceptance build initially lacked signing and could not persist its
Keychain. A correctly signed simulator build now completes a device-bound
login and opens the hosted permitted document. Its footer accessibility IDs
needed isolation from the enclosing screen identifier. PR #19's merged-master
CI passed in full. Unsupported end-to-end-encryption copy has been corrected;
the unfinished bulk Export button is hidden. Individual document sharing works.

## Paired native milestone

On the owned Android emulator, the ordinary Home tools → Documents → Upload
flow selected `native-picker-D2.pdf` from the OS Downloads picker and saved it
as “Copper meadow.” The server has exactly one linked File/HomeDocument and
one 609-byte quota charge. Authenticated retrieval and the temporary share copy
match the original PDF byte for byte. The PDF preview displays its copper-meadow
marker, and Android's system share sheet receives the actual PDF.

The signed iOS simulator independently opens that Android-uploaded document and
offers Save to Files through the system share sheet. Its private temporary share
copy also matches all 609 original bytes. The opt-in UI test passes with a real
staging session, not injected auth or a stub API. Android background → foreground
after a scoped permission denial hides both document content and metadata;
restored fixture access returns HTTP 200. The original three API documents and
this native PDF remain for lifecycle acceptance. The fixture member's original
document-view grant is restored.

Final focused checks pass: 47 Android tests across dashboard, entry, document
list/upload/access and safe logging; the inspected Place screenshot; Detekt,
formatting and Android lint; 18 iOS dashboard/entry/access tests; ten document
list tests; strict Swift lint/format; and backend privacy gates. Earlier full
backend and upload tests remain recorded above. Physical devices, live iOS
picker upload, bulk export and deletion/replacement are not established by
this milestone. Public staging API/worker and production remain unchanged.
