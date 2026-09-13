# Private claim evidence — September 10, 2026

This checkpoint restores an ordinary claim's private document upload and review
path. A saved upload remains **pending evidence**. A current, authorized reviewer
must fetch the exact bytes and explicitly confirm that document before it can
support a separate claim approval. Uploading, opening or verifying one document
never creates household membership or ownership.

## Implemented behavior

`20260910090000_home_claim_private_evidence.sql` adds protected upload intents and
review inspection receipts. A caller-selected upload UUID binds the original
Home, claim, uploader, document type, filename, MIME type, size and SHA-256 hash.
The service reserves quota before writing bytes into the configured private
Home documents bucket. It publishes one pending manual evidence record only
after the exact object exists and the current claim/access checks pass again.
A retry of the same operation cannot charge quota or publish evidence twice.

Manual files support deed, closing disclosure, tax bill, utility bill and lease.
They cannot masquerade as identity-provider, title-match or escrow attestations.
Existing trusted provider evidence keeps its previous eligibility rules;
untrusted legacy metadata and storage references remain quarantined and require
a private re-upload. No caller-supplied object reference is signed or deleted.

Every read uses the current exact claimant or reviewer context, immutable object
binding and byte hash. The API rechecks access after fetching the object. Private
metadata and byte responses are not cacheable. No public URL or provider path
appears in the client document projection. Direct client access to protected
intent/inspection tables and the new service functions is denied, including
inherited PUBLIC grants; private File reads are restricted as well.

The reviewer first opens a particular file using the displayed claim snapshot.
After fetching and hashing its bytes, the service records a short-lived,
actor-bound inspection receipt; only its hash is stored. Explicit verification
requires that same actor, Home, claim, evidence, current authority and snapshot.
A successful response can be recovered from its protected receipt without
reapplying verification. Expired receipts, changed evidence, role/age restrictions,
explicit denies and revoked ownership cannot recover old authority. Claim
approval remains the separate 080000 transaction and keeps its role/evidence
ceilings.

Claimants can retire pending evidence through the guarded API, including after
their exact protected withdrawal in an existing household. Retirement hides
its bytes, releases quota once and retains its intent/File/evidence history.
Verified evidence is retained. Cleanup failures return a retryable error; the
five-minute recovery job retries abandoned reservations and retired tombstones.
A late provider write invalidates an older cleanup acknowledgement. Exact private
creator setup and its protected claim-withdrawal history remain usable while
pending evidence is reserved, published and retired.

## Browser controls

Ownership/residency upload pages bind their first authenticated read to a
server-issued session fingerprint. File selection waits for that read. Writes
and their responses recheck it, and a retained old callback cannot rebind after
a session change. A failed upload retains the original claim/file/upload ID for
retry. Manual residency choices no longer offer a government-ID upload as if it
were provider verification. The unsupported household challenge route presents
a specific unavailable message rather than promising automatic dispute activation.

The platform claim reviewer opens exact private bytes in a constrained preview,
then explicitly confirms one document. Already verified files remain readable
without another inspection/verification action. Unknown verification results
retain the original receipt for retry. Changed claims, sessions and unmounted
screens discard late bytes and callbacks; local object URLs are revoked. Closing
or selecting another claim cannot be overwritten by an older detail request.
The existing ordinary claim decision sends the displayed token and expected
session; notification delivery is still a best-effort consequence of a committed
decision, not a browser guarantee.

The cross-tab session-change marker is the exact nonsecret API client addition
already made in the payment branch. Server session comparison supplies the
mutation boundary; browser notifications promptly hide retained document views.

## Verification

- Evidence storage/service unit checks: **43 passing** on final backend source.
  They exercise immutable byte identity, unknown PUT reconciliation, reservation
  ordering, authority changes before/after download, inspection issuance,
  verification receipt mismatch and cleanup recovery.
- Actual HTTP route checks: **11 passing**, plus **41 passing** existing claim
  gateway compatibility checks. The metadata cache-header assertion was added
  for the final combined backend run. Routes prove authentication/session checks
  precede upload/provider work and bytes never accompany a denied read.
- Browser checks: **36 passing** across four focused suites. They exercise
  pending/verified reads, explicit inspection confirmation, exact API receipts,
  no-auto-approval, duplicate-action guards, unknown-result retry, changed server
  identity, late callbacks, retained upload scopes, stable upload IDs and the
  ordinary ownership/residency entry pages. Type gate: **zero errors**. Focused
  ESLint has no errors or new warnings; three existing admin-page `any` warnings
  remain. The final combined browser run passes **1,078 tests in 86 suites**,
  with no failures/skips; the final type gate also reports zero errors.
- The final clean disposable database replayed **26 sorted migrations**, including
  090000 evidence and 100000 task media. It passes **32 raw SQL contracts and 32
  generated pgTAP wrappers**, with explicit TAP failure detection. Application
  SQL lint covers **201 functions and 83 trigger bindings**, zero errors and the
  same five baseline warnings. The pinned full scan retains only previously
  reviewed stock PostGIS diagnostics. All exact fixture counts return to zero.
- The evidence SQL contract uses the actual **24 shipped role-default rows**.
  It proves pending evidence cannot approve a claim; exact manual review can
  support a separate resident approval without ownership; reviewer age/revoke/
  explicit deny and claimant access windows apply; unknown roles, cross-claim
  access and manual IDV are denied; quota failures roll back reservation; changed
  snapshots/expired or foreign inspections fail; private withdrawal/retirement
  preserves first use; client forgery and physical history deletion are denied.
- All **44 combined evidence/task function bodies** byte-match the final clean
  replay. Source/runtime aggregate SHA-256:
  `cf071a1637c6c02fe7f595399ce4b5af0111ea0941b1dadf2de20445a1d63c93`.
  Evidence migration SHA-256:
  `ec83b7740b0264977aca2a2ab5031d11be5648ccdc791b768f0d0f75de4b9a5d`.
  The added ordinary-withdrawal helper is explicitly inaccessible to anonymous
  and authenticated database roles and executable only by service_role.

The final replay also passes 20 task races, nine real task Storage API journeys
and six baseline SDK/PostgREST checks, recorded in the separate
[task media report](home-task-private-media-2026-09-10.md). These do not substitute
for evidence-specific checks. The repaired evidence candidate independently
passes **20 demonstrated lock races**, covering current authority/age/status,
expiry while waiting for quota, inspection/snapshot drift, finalize/withdraw and
verify/retire ordering, protected ordinary withdrawal and exact-receipt replay.
All exact race fixtures return to zero. The final candidate also passes **ten
actual evidence Storage API scenarios**, using the production service, Supabase
SDK, PostgREST and Storage API with synthetic roles and temporary local bytes.
These include exact byte upload/read, direct authenticated/anonymous/public
read denial, lost provider reply without duplicate quota, actual reviewer
inspection/verification and exact retry, revocation during a real download,
failed cleanup/retry/late PUT, private creator withdrawal, separate resident
approval without ownership, and ordinary non-private withdrawal/byte retirement.

The corrected clean replay passes the combined **40 observed races and 19 real
Storage API scenarios**. Exact user/auth/Home/File/intent/claim-receipt/evidence/
inspection/quota fixture counts are all zero. The earlier final replay at port
64322 is preserved; the corrected candidate uses a new database at port 65322.

The initial combined backend run exposed four old fixture mismatches after new
authenticated response/session fields; the corrected claim and dashboard suites
pass 11 and 63 checks respectively. The final combined backend rerun passes
**5,056 tests, with 16 skipped, across 312 passing suites and one skipped suite**
(exit 0). Privacy gates pass, including **15 E2E checks**. The independent root
review of the final service, routes and browser controls found no remaining
blocker within this checkpoint.
No hosted database/storage write or role-default grant was performed.

The real rehearsal found a genuine recovery defect: a non-private claimant could
withdraw successfully but could not retire ready pending evidence afterward, and
those bytes stayed quota-charged. The fix permits only that exact claimant's
protected withdrawal receipt to authorize pending-file retirement; it does not
change private household access or permit verified-evidence removal. A forged
terminal claim state without the protected receipt remains denied.

## Remaining work and limits

This is a source checkpoint, not full Home or release acceptance. Native private
evidence upload/viewing/verification, claimant document-management and retirement UI,
complete document/evidence/legacy Home deletion and full household acceptance
remain next. The byte-preview component has focused browser tests; actual
reviewer browser acceptance and hosted private-bucket configuration remain
required. The current file selection's upload ID survives retry in that page;
a closed page must reload current claim evidence before deciding to upload again.
No background notification or review completion time is promised.

Dedicated challenge, ownership transfer and lease lifecycles remain separate
workflows. No new ordinary member/manager/guest role defaults or verification-age
feature flag were enabled. All paid provider subscriptions remain deferred to
the final combined launch-preparation step requested by the owner.

Final combined backend evidence is `/private/tmp/pantopus-home-private-lifecycle-backend-r2.log`;
full browser evidence is `/private/tmp/pantopus-home-evidence-full-web-local.log`.

Operator evidence stays outside Git in `/private/tmp/pantopus-home-evidence-*`
and `/private/tmp/pantopus-private-storage-final-*`, with replay log
`/private/tmp/pantopus-home-task-media-evidence-final-replay.log` and the preserved
final replay project `/private/tmp/pantopus-home-task-media-evidence-final`
(database `postgres`, container `supabase_db_pantopus-home-task-media-evidence-final`,
loopback port 65322). Earlier evidence databases and unrelated worktrees remain
untouched.
