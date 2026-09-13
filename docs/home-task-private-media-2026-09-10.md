# Private Home task attachments — September 10, 2026

Home tasks now have a private attachment upload, download, removal and recovery
journey. The web task panel preserves the saved task ID and each file's upload
ID when an attachment fails, shows the partial result and retries the remaining
files. The displayed task and subsequent actions stay bound to the opening
account/session, including cookie-authenticated session replacement.

## Scope and behavior

- A service-only reservation binds immutable original Home, Task, uploader,
  upload ID, content hash, size, MIME type and private bucket. File quota and
  intent creation commit together. A matching retry does not charge twice or
  overwrite bytes; conflicting reuse of an upload ID is rejected.
- Uploads support PDF, plain text and supported image formats up to 25 MB per
  file. Metadata contains no public URL or provider key. Current task read and
  write authority, visibility, sensitive permission, source Mail identity,
  role/status and access windows are checked under locks. A second current
  check runs after provider download before bytes can leave the service.
- Existing task/dashboard projections use safe attachment metadata and current
  capabilities. Legacy public attachments remain unavailable and require a
  separately verified reupload/retirement journey; their paths are never trusted
  as a deletion target. Attachment metadata and byte responses use
  `Cache-Control: private, no-store`.
- An immutable private-setup bit records whether an upload was reserved by the
  exact current private creator. That proof and the current own members-only
  task preserve first-use access. A formerly shared upload cannot become private
  setup after an occupancy downgrade. The preceding private claim-evidence and
  protected withdrawal predicates remain intact.
- Removal first hides metadata, retires the upload and releases quota once.
  Provider failure retains cleanup state for explicit retry or background
  recovery. Original identity survives Task and Home deletion. Late provider
  completion invalidates stale cleanup acknowledgements; retired tombstones are
  also revisited daily if the process dies before recording completion.
- Task deletion retires and drains its exact trusted attachments before deleting
  the Task. Home deletion retains the prior exact primary/private-creator
  authority and explicit denies, additionally checks current attached task
  authority, drains trusted task bytes, and detaches only confirmed retired task
  File live links. A new concurrent attachment prevents final deletion. Any
  downstream failure rolls back File/intent detach and record deletion together.

Documents, claim evidence and legacy files still block Home deletion until their
separate complete retirement sets are proven. No arbitrary historical reference
is detached to make deletion succeed. The ordinary role defaults and direct
client grants remain unchanged; private task intent/media/File access is closed
to browser database roles.

The service uses the existing configured private `HOME_DOCUMENTS_BUCKET`, checks
that it is explicitly private for every provider operation and derives each key
from the protected intent. No new paid bucket, subscription or hosted setting was
created. Generic File listing, soft deletion and retention exclude protected
document, task and evidence markers.

## Verification

- Focused backend: **221 passing checks across 11 suites**, covering task storage,
  service and HTTP behavior, request session scope, record compatibility,
  document dashboard visibility, Home authority, owner-pointer adapters and the
  effective-permission dashboard. Direct-handler tests supply verified synthetic
  request context while preserving their existing privacy assertions.
- Final combined backend: **5,056 passing checks and 16 existing skips**, with
  312 suites passing and one skipped. All **15 privacy E2E checks** pass. The
  initial combined run exposed missing synthetic session context in one old
  dashboard fixture; supplying that context preserved the finance/document
  denial assertions, and the final full run passed.
  The subsequent one-line metadata cache-header repair passes all **ten route
  checks**, including its new header assertion; the full suite was not repeated
  for that isolated response-header change.
- Web: **21 passing checks** for partial upload retry, retained task/file IDs,
  read-only download, failed removal recovery, legacy quarantine, synchronous
  duplicate-action prevention, exact opening response scope and session changes
  before/after asynchronous work. Web type gate: **zero errors**.
- Local SQL: **20 demonstrated lock races** passed with exact twenty-Home,
  three-account, upload, File and source-Mail cleanup. They include current
  revoke/deny/age/role/source checks, access expiry while waiting for Home or
  quota, duplicate reservations, retirement/publication ordering, Task/Home
  deletion versus new uploads, and expiry during Home retirement with rollback.
- Real local storage: **nine passing scenarios** exercise the actual service,
  SDK, PostgREST and Storage API with tmpfs bytes. These cover exact upload/read,
  direct authenticated/anonymous/public denial, a lost provider reply after the
  real write, quota retry, permission loss during actual download, failed removal
  retry, late PUT recovery, Task deletion, private creator first-use and Home
  deletion, and late PUT recovery after the Home no longer exists.
- A new clean disposable database replayed all **26 migrations** in sorted order,
  including the preceding private evidence migration and this task migration.
  That exact replay passes **32 raw contracts and 32 pgTAP wrappers** (explicit
  `not ok` detection), the **20 task races**, **nine task storage checks**, the
  companion evidence's **20 races and ten real storage checks**, and **six
  baseline SDK/PostgREST checks**. Application lint passes **201 functions and
  83 trigger bindings**, with zero errors and the same five baseline warnings.
  The pinned full scan retains only the previously reviewed stock PostGIS
  diagnostics. All exact fixture counts return to zero.
- All **44 final evidence/task function bodies** match the clean database
  byte-for-byte, including the final forward definitions. Source and runtime
  aggregate SHA-256 both equal
  `cf071a1637c6c02fe7f595399ce4b5af0111ea0941b1dadf2de20445a1d63c93`.
  Task migration SHA-256:
  `0cbcd5dee9e44e68397235c1788e65a7346c7a0f4471faf5e98b2393fce3586e`.

The first real-storage contract run found only an invalid test projection
(`File.file_key` instead of canonical `File.file_path`); the fixture was corrected
and the same real privacy assertions then passed. Earlier HTTP multipart testing
also exercised the real two-part request and corrected the parser's part limit.
No assertion, production timeout or permission was weakened for verification.

The companion evidence rehearsal found that an ordinary claimant's protected
withdrawal prevented retirement of their pending file. The preceding evidence
migration now permits that exact retirement without granting private setup or
ownership. The final sorted replay above includes this repair; its new helper
remains executable only by the service role. The earlier replay was preserved.

## Release limits and next work

Final-head remote CI remains required before merge. Local storage uses synthetic
JWT database roles and a file-backed Storage
API; it does not prove hosted object-provider configuration or native device UI.
No hosted writes or new native attachment screens were performed in this slice.

The remaining Home work includes complete document/evidence/legacy retirement,
native task attachment consumption, task-to-gig publication, other ownership and
household workflows, and final household acceptance. A lost task-create HTTP
reply before any task ID is known remains a separate record-idempotency concern;
this milestone prevents duplicate Tasks after a confirmed Task save followed by
an attachment failure.

Private operator evidence is retained outside Git under
`/private/tmp/pantopus-private-storage-final-*` and
`/private/tmp/pantopus-home-task-media-evidence-final-replay.log`. The preserved
local project is `/private/tmp/pantopus-home-task-media-evidence-final`, database
`postgres` in `supabase_db_pantopus-home-task-media-evidence-final`, loopback port
65322. Earlier evidence databases were preserved.
