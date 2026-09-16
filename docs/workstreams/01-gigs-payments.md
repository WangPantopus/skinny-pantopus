# Stream 1 — Gigs and payments

Updated September 16, 2026. Owner: coordinator / Stream 1.
State: ready for review — displayed-terms binding delivered at `a65411758` (backend +
iOS/Android/web callers + SDK) and verified locally, over real HTTP/SQL and on the
installed iOS candidate; heavy native build slot **released** at 10:50 PDT; owned simulator
shut down; fixtures cleaned. Installed Android, real provider authorization and the wider
P04 scope remain open.

Preserve existing iOS, Android and web screen designs. Verify existing behavior,
repair demonstrated failures in place, and retain the evidence limits below.
P04 and the wider P01–P10/launch backlog remain open; no inventory row closes.

## Milestone: Start Work bound to the displayed assignment terms — September 16, 2026

- **Branch/commit:** `codex/paid-gig-integration` at **`a65411758`**, pushed to draft
  [PR47](https://github.com/WangPantopus/skinny-pantopus/pull/47); its CI was starting at this
  update. Previous head `74c01bf49` had 14 applicable checks green with one Android job
  still pending when superseded.
- **Changed paths (all existing files except two small DTOs):** `backend/routes/gigs.js`
  (start handler + three helpers), `backend/tests/unit/paidGigLifecycleRoute.test.js`;
  `frontend/packages/api/src/endpoints/gigs.ts` (`startGig(gigId, expected?)`);
  `frontend/apps/web/src/components/gig-detail/CompletionFlow.tsx`,
  `frontend/apps/web/tests/assigned-gig-authorization.test.tsx`; iOS
  `GigsEndpoints.swift` (new `StartGigBody`), `GigDetailViewModel.swift`,
  `GigDetailViewModelTests.swift`; Android `GigDtos.kt` (new `StartGigBody`), `GigsApi.kt`,
  `GigsRepository.kt`, `GigDetailViewModel.kt`, `GigDetailSaveViewModelTest.kt`. No screen,
  layout, styling, navigation, table, migration, RPC, service or new screen file.
- **Reproduced requirement:** installed journey D above and `stale-before-read-http-sql.json`:
  the route started a newer same-worker assignment the client never displayed (200 with a
  new `accepted_at`, owner notified). Change orders already mutate `Gig.price` while
  assigned, so displayed terms can drift in practice. Existing pattern reused: the route
  family already binds flat `expected*` body fields (confirmation/authorization).
- **Repair:** the existing handler accepts optional `expectedAcceptedAt`, `expectedPrice`,
  `expectedPaymentId`; when any is present all three are compared with the route's own
  read (timestamps by instant, so PostgREST `+00:00` matches a client `Z`) before recovery,
  provider verification or the write, answering the existing conflict copy with
  `409 ASSIGNMENT_CHANGED`; malformed terms are 400; callers that send none keep the
  prior behavior. iOS sends every key (null included); Android's Moshi omits nulls and the
  route reads an absent key as a displayed null; web passes the rendered `accepted_at`,
  `price`, `payment_id` and shows the server guidance plus the existing reload on 409.
- **Evidence (source-bound):** backend lifecycle suite 239/239 (10 new cases); full backend
  Jest 6212 passed / 16 skipped; real HTTP → route → PostgREST → PostgreSQL harness 8/8
  (`displayed-terms-http-sql.json`: stale re-stamp refused with no write or notice, saved
  start not recovered under old terms, lost-reply recovery under the same terms, legacy
  caller unchanged, timestamp formatting, malformed 400, exact cleanup); web
  `assigned-gig-authorization` + `gig-acceptance-entrypoints` 126/126 and the typecheck
  gate at 0 errors; Android ktlint/detekt and `GigDetailSaveViewModelTest` 55/55; iOS
  SwiftLint strict/SwiftFormat (pinned) and `GigDetailViewModelTests` 61/61 on the owned
  iOS 26.5 simulator. Two first attempts were test-compile errors (stray MockK import;
  SwiftFormat-hoisted `await`) and are retained as attempts, not counted.
- **Installed rebuilt iOS candidate** (same runtime, real route with the change):
  stale assignment re-stamped after the screen loaded → **409, row stayed assigned, no
  notice**, screen stayed "Assigned"; reopen → screen shows the new assignment → Start →
  200, one notice, "In progress"; lost reply after commit → error path → retry with the
  same displayed terms → `reused: true`, same timestamp, one notice, "In progress".
- **Limits:** synthetic identity, intercepted providers, free gig, older retained schema,
  simulator; local web lint could not run in this worktree (symlinked node_modules farm) —
  CI's web lint job is the gate for that; the web my-bids card still starts without terms
  because its list projection carries no assignment terms (separate bounded follow-up);
  installed Android not run; P04 stays open.
- **Shared-file effects:** additive optional parameter on `@pantopus/api` `startGig`
  (Stream 1 scope per the guide); no peer paths touched.
- **Cleanup:** runtime 18132 stopped, exact owned rows 0 by direct SQL (`f91504x0` prefixes),
  simulator shut down, own Gradle daemon stopped, heavy slot released.
- **Evidence:** `/private/tmp/pantopus-p04-start-20260916-r2` (`EVIDENCE.md` second section),
  mirrored to the owner's private `.pantopus-recovery/audits/20260916-p04-start-r2`.

**Next bounded milestone (Stream 1):** installed Android Start Work journey on the rebuilt
candidate (new owned emulator, existing acceptance AVD untouched), then the my-bids
terms follow-up or P05/P06 policy verification per the backlog order.

## Milestone: iOS Start Work candidate verified locally and installed — September 16, 2026

- **Branch/commit:** `codex/paid-gig-integration` at **`74c01bf49`**, pushed; draft
  [PR47](https://github.com/WangPantopus/skinny-pantopus/pull/47) now carries a scope
  description. CI 35126983681 was running at this update (backend/web/database/iOS lint
  green, native test jobs pending); do not treat it as final until it completes.
- **Changed path:** only `frontend/apps/ios/PantopusTests/Features/ContentDetail/GigDetailViewModelTests.swift`
  (3 lines). No application code, screen, layout, styling, navigation, schema or new file.
- **Reproduced failure:** CI 35103180556 on `e531074e4` failed `testStartTaskTransitionsToInProgress`
  on all three simulators (line 364, "In-progress worker gets the delivery affordance"):
  the trailing-closure rewrite no longer bound the closure to `tipIdentity:`, so
  `startTask()` used the default identity and returned `.ignored`. The correction hoists
  the closure into a typed local constant passed with the explicit label.
- **Reused evidence:** backend 13/13 HTTP/SQL cases and 229 regressions (`599de1586`),
  Android 54/54 JVM (`9397e39a7`), CI 35054602607 simulator runs of the six WIP cases,
  and the accepted web browser evidence at `c9cb69825`. Unchanged sources are bound by
  hash in `ios-candidate-source.json`.
- **New evidence (source-bound):** SwiftLint 0.63.3 strict 0 violations; SwiftFormat 0.61.1
  0/2248 files. `PantopusTests/GigDetailViewModelTests` on the owned simulator
  `Pantopus Stream1 Start R2` (iOS 26.5): **59 executed, 0 failures**, including the six
  Start Work cases and the previously failing case. A first attempt hung before XCTest
  attached (the host launched with a persisted r1 session) and is retained as a hung
  attempt, not counted; attempt 2 after a simulator shutdown/boot passed.
- **Installed candidate journeys** on the same Debug build (`Pantopus.debug.dylib` contains
  the receipt guard; API/socket 127.0.0.1:18132): real sign-in UI backed by a synthetic
  login fixture → existing GigDetail via `pantopus://gigs/<id>` → real `backend/routes/gigs.js`
  → supabase-js → PostgREST 64521 → PostgreSQL 64522; providers intercepted; push/badge/socket
  stubbed; free gig; retained older schema; fixture prefix `f9150420`.
  - A. Invalid receipt (200 `{}` after commit): SQL `in_progress` and one `gig_started`
    notice; the screen stayed "Assigned"/"Start task" and did not refresh from the invalid
    receipt. Retry → `reused: true`, same `started_at`, still one notice → "In progress"
    with "Mark as delivered".
  - B. Lost reply (socket destroyed after commit): committed with one notice; client error
    path with no automatic POST retry (non-idempotent by design); screen stayed "Assigned".
    Explicit retry → `reused: true`, same timestamp, one notice → "In progress".
  - C. Ordinary start: one POST, `in_progress`, one notice, refresh → "In progress".
  - D. **Stale assignment before the server's first read** (`accepted_at` re-stamped in SQL
    after the screen loaded): the route **started the newer assignment** (200, new
    `accepted_at`) and notified the owner; the candidate refused to show success and stayed
    at "Assigned"; a retry returned `reused: true` for the newer assignment and was refused
    again. The same boundary is reproduced over pure HTTP (`stale-before-read-http-sql.json`:
    200 with the new `accepted_at`; a free→paid change before the read is refused 402).
    This is the previously unproven scope, now concretely reproduced; it stays open.
  - E. Two taps within a 4 s held reply: exactly one POST reached the route, one transition,
    one notice; the second tap was ignored.
  - Toast text was not captured by simulator screenshots; state transitions and SQL records
    are the accepted evidence.
- **Limits:** synthetic sign-in/identity, intercepted providers, free gig, older retained
  schema, stubbed delivery, simulator rather than a physical device. Session replacement and
  departure mid-request remain unit-test-only. Installed Android was not run. P04 stays open.
- **Shared-file/integration effects:** none (test file only); no peer source touched.
- **Cleanup:** runtime 18132 stopped; exact `f9150420`/`f9150430` rows 0 by direct SQL;
  owned simulator shut down; heavy native slot released; no schema/reset/container change;
  owner iPhone17 and peer devices untouched.
- **Evidence:** `/private/tmp/pantopus-p04-start-20260916-r2` (harness, logs, xcresult,
  screenshots, `EVIDENCE.md`), mirrored to the owner's private
  `.pantopus-recovery/audits/20260916-p04-start-r2`.
- **Process:** the earlier Stream 1 session (`pantopus-paid-gig-integration-c8`) is still
  alive with two stuck background loops in this worktree; it was told that this session is
  the sole Stream 1 writer. One writer per worktree.

**Next bounded milestone (Stream 1, assigned in the guide): displayed-terms binding for
Start Work.** Journey D shows the route can start terms the client never displayed. The
smallest repair in the existing implementation: accept an optional expected-assignment
snapshot (`accepted_at`, `price`, `payment_id`) in the existing `POST /:gigId/start` body,
compare it with the route's own read before the provider check and answer the existing 409
conflict on mismatch; pass the displayed snapshot from the existing iOS/Android/web callers
and `frontend/packages/api` `startGig`. Existing clients that send no body keep today's
behavior. No new file, table, screen or migration. Change orders already mutate `Gig.price`
while assigned, so displayed terms can drift in practice.

## Resumed from the cutoff — September 16, 2026

The cutoff section below set the resume point: fix the trailing-closure lint, then
validate the iOS candidate. Both are now done, and no heavy native slot was needed
because CI had already exercised the candidate on simulators.

- **Lint repaired, after one wrong attempt.** `e531074e4` rewrote the offending
  call to trailing-closure form. That satisfied SwiftLint but was wrong: `tipIdentity`
  is followed by `makeTipRequestId`, `liveActivity`, `roomEvents` and `emitRoom`, so
  a trailing closure no longer binds to `tipIdentity`. It compiled, `ios / Lint`
  went green, and `testStartTaskTransitionsToInProgress` then returned `.ignored`
  instead of `.confirmed` on all three simulators in CI 35103180556 — one green job
  traded for three failing ones. Lint passing is not evidence the change is correct.
  The correction keeps the explicit `tipIdentity:` label and hoists the closure into
  a typed local constant, so there is no closure literal for the rule to flag and
  the semantics match the form that passed on `9af5dcf74`. Verified with the versions
  CI pins (SwiftLint 0.63.3, SwiftFormat 0.61.1): 0 violations in 2245 files, 0 of
  2248 files needing formatting, `verify-icons` and `verify-overline` pass.
  No screen, layout, styling or navigation change.
- **The iOS candidate is no longer unvalidated.** CI run 35054602607 on the WIP
  `9af5dcf74` failed *only* the lint job and its aggregate; `ios / Build iOS test
  bundles` and all three device jobs succeeded. The executed-test log for
  `ios / Tests on iPhone 16` contains all six new cases —
  `testStartRejectsMissingOrMismatchedSavedReceipt`, `testStartDebouncesPendingRequest`,
  `testStartRetiresReplyAfterSessionReplacement`, `testStartRetiresReplyAfterDeparture`,
  `testStartRetiresReplyAfterSameWorkerReassignment` and
  `testStartDoesNotApplyRefreshAfterSessionReplacement` — on iPhone 16, 16 Pro and SE.
  This supersedes the cutoff note that no candidate build or test had run. It is
  **simulator** evidence from CI, not an installed-device journey.
- **The `accepted_at` binding in `599de1586` was independently re-verified.** That
  commit adds a timestamp equality predicate to `bindGigPaymentSnapshot`, which a
  mocked suite cannot prove safe: a microsecond round trip through PostgREST and
  supabase-js that truncated would break every real start, because the real
  acceptance RPCs stamp `accepted_at` with PostgreSQL `now()`. Confirmed against
  real PostgreSQL that a gig stamped `2026-09-16 13:39:21.846253+00` still starts
  (200) and still recovers its saved start (200, `reused: true`), free and paid.
  The helper has exactly two callers, both inside the start handler, so the wider
  lifecycle is unaffected. Its preserved recovery-read 503 is a real improvement
  over the inherited patch, which treated a failed recovery read as "no saved start".
- **End-to-end re-run on the combined tree**: 28/28 checks over real HTTP through
  the existing route against real PostgreSQL, free and paid. Backend Jest 6202
  passed / 16 skipped / 0 failed. Fixtures removed exactly: 9 gigs, 13 users,
  6 payments; 0 remaining; no schema, reset or migration.

**Process finding — two writers shared one worktree.** While this task held
`/private/tmp/pantopus-paid-gig-integration`, another Stream 1 session committed and
pushed to the same branch, including a WIP commit that broke CI, and swept this
task's uncommitted 409/503 repair into `599de1586`. The work itself is sound and is
kept; the hazard is that neither writer could see the other's in-flight edits, and a
"WIP" commit reached a shared branch. One writer per worktree, and no WIP commits on
a branch with an open PR.

**Still open, unchanged by this resumption**: an installed iOS and Android Start Work
journey, real provider authorization, the stale-client assignment boundary before the
server's first read, and the unspecified cancellation/no-show fee payer/recipient
policy. P04 does not close.

## Immediate cutoff handoff — September 15/16, 2026

The user requested immediate wrap-up. Implementation and testing have stopped.
The next agent resumes **Stream1 and coordination**; the previous Stream1 writer
has stopped and ownership was explicitly transferred to this task.

- Paid worktree: `/private/tmp/pantopus-paid-gig-integration`, branch
  `codex/paid-gig-integration`, clean and pushed at **`9af5dcf7417760c9483c4f7b1e1008722350daf8`**.
  [PR47](https://github.com/WangPantopus/skinny-pantopus/pull/47) remains draft.
  This is an **unverified iOS WIP**, not an accepted repair or merge candidate.
- Master is **`82430954038ec6e74b72b54192aaad8117bcc363`**, documentation-only
  [PR50](https://github.com/WangPantopus/skinny-pantopus/pull/50), with four applicable
  checks/seven path skips. Paid merge `4aaa08546` preserved both append-only report
  sections; application bytes before the WIP match `41c75d49a`.
- The iOS baseline ran59 tests:53 existing tests passed; all6 new distinct cases
  failed, with28 assertions. Cases cover invalid/missing/mismatched receipts,
  duplicate pending requests, late session/departure/reassignment replies and a
  session change during refresh. Baseline exit65 is expected failure evidence.
- Actual installed **baseline**: normal sign-in UI with synthetic local auth →
  existing GigDetail via deep link → Start task → In progress/Task started/Mark as
  delivered. Real route/PostgREST/PostgreSQL saved `started_at` and exactly one
  Notification; provider calls intercepted. Free gig, older retained schema.
  This proves the ordinary baseline journey only.
- WIP changes only three existing files: `GigDetailViewModel.swift`,
  `GigDetailView.swift` and `GigDetailViewModelTests.swift` under the existing iOS
  ContentDetail feature/test folders. It validates the saved receipt, binds the
  pending attempt to identity/assignment, retires callbacks on departure and uses
  existing `ConfirmationResult` to suppress stale success. Refresh guards are
  threaded through existing readers. The screen callback changed; its appearance,
  layout and navigation did not. No new application file/schema was added.
- Swift parse passed and SwiftFormat ran. Scoped strict SwiftLint currently fails
  **one `trailing_closure` at test line355**. **No candidate Xcode build/test or
  installed candidate journey has run.** Current-head CI was not accepted; green
  [CI35049746982](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35049746982)
  applies only to `41c75d49a` (15 applicable checks/one Seeder skip).

This shared cutoff is published for review in documentation-only
[PR52](https://github.com/WangPantopus/skinny-pantopus/pull/52); its checks/merge
remain pending at handoff. Do not resume work merely to finish that PR now.

**Resume here:** inspect the three-file WIP and private baseline/candidate logs,
fix the trailing-closure lint issue, then reserve the heavy native slot before
running the59-test iOS suite and affected static checks. Reuse the baseline command
from `ios-baseline.log` and source metadata. Review any compile/behavior failures;
then rerun installed invalid/late/retry and valid journeys through existing UI,
real caller/API and persistence. Do not label the WIP accepted from parsing or CI.
Android54 JVM tests and backend229 regressions/13 HTTP cases remain source-bound
accepted evidence; installed Android, stale-client assignment before the server's
first read, paid providers and broader P04/P08/P09/R05 remain open.

Private evidence: `/private/tmp/pantopus-p04-start-20260915-r1`, mirrored to
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260915-p04-start-r1`.
Start with `EVIDENCE.md`, `ios-baseline-source.json`, `ios-baseline.log`,
`ios-baseline.xcresult`, `ios-installed-baseline.json`, `ios-candidate-lint.log`
and `ios-runtime.cjs`. Derived build output remains only in the temporary source
folder. Raw credentials, logs and device tokens stay outside Git/chat.
The first truncated Safari deep link was a harness entry error; reopening the full
URL worked. A reused-view deep-link lead and MyTasks500 on the older schema are
unverified/outside this acceptance, not reasons to expand the current patch.

**Cleanup confirmed:** own HTTP18132 stopped; exact `f9150410` fixtures removed
(`ios-runtime-cleanup.json` reports zero); new owned simulator
`C2BCF36A-F300-48C1-9BA7-876CA9F61E55` is Shutdown. Earlier `f9150400` cleanup was
also zero. The heavy native slot is released. No other simulator, physical device,
container or schema was changed by Stream1. Preserve the owner's checkout and
other streams' fixtures.

**Coordinator pickup:** the live guide remains
`/Users/yingpengwang/pantopus-coordination/docs/workstreams/README.md`; application
copies are snapshots. Stream2's dirty02 and Stream3's dirty03 are author-owned and
were deliberately not staged with this cutoff. Review their live files and fresh
remote state before integration. Stream2 is at `70e079543`, no PR; its broader M02
and two unverified callback/scope leads remain open. Stream3 draft PR51 is freshly
observed at **`22adc728512b8dd0f261c0aaf02e255123dc7f50`**. Its later native lifetime,
N05 reminder and cross-room retry milestones are reported, not fully coordinator
reviewed. Earlier reviewed `dfc860bfe` evidence is in the existing verification
report. No peer or paid application merge is approved.

Stream3 task **Resume Stream 3 verification**
(`01a0a824-301b-74e3-a1d9-b205714ed7a1`) was notified of the cutoff and native-slot
release. Its existing grants continue. The guide now records the exact forward
migration/contract assignment for the reproduced block-versus-send race, restricted
to its new isolated SQL64532/API64531 database. Do not apply it to retained64522.
Stream3 also received immediate cutoff: it reports HTTP18130/web18131 stopped and
exact `f9150300` cleanup zero at21:13:58 PDT. Its simulator
`0AE16FA0-E244-414F-86C8-24893BDFD979` remains stopped. Isolated canonical-empty
SQL64532 is retained healthy; API64531 has not started. No transactional migration
or SQL-test code has been written. Current PR51 CI35054358217 was still running
at peer cutoff, not accepted. Its final dirty live03 includes the remaining matrix
and76-file private evidence mirror; the successor must publish that author snapshot.
Docker is now responsive; old Docker-blocked notes do not establish a current block.

## Earlier accepted milestones and preparation snapshot

The cutoff section above supersedes current-source, preparation and resource claims
in this retained milestone history.

## Source and ownership

- Application worktree: `/private/tmp/pantopus-paid-gig-integration`, branch
  `codex/paid-gig-integration`. The user confirmed the previous writer stopped.
- Backend milestone: **`599de1586`**, on prior integration `959e147e6`.
  Changed only `backend/routes/gigs.js` and its existing
  `backend/tests/unit/paidGigLifecycleRoute.test.js`.
- Android milestone: **`9397e39a7`**, changing only the existing
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/GigDetailViewModel.kt`
  and `frontend/apps/android/app/src/test/java/app/pantopus/android/ui/screens/contentdetail/GigDetailSaveViewModelTest.kt`.
- Current pushed head: **`41c75d49a`**, integrating master `0616d6e79`. This merge
  changes documentation snapshots only; the shared handoff/backlog take master’s
  authoritative versions. Earlier paid history remains in Git and the linked
  source-specific reports. Application bytes match `9397e39a7`.
- PR34 remains draft at `c9cb69825`. PR47 is now also draft because it contains
  unfinished paid scope. User PR46 remains separate. No paid feature was merged.
- Shared documentation PR50 merged as **`824309540`** after four applicable
  checks/seven path skips. It publishes the reviewed Stream3 milestone without
  merging application code. Its tree matches tested `123d11437`.
- Shared documentation PR49 merged as **`0616d6e79`** after four applicable
  checks passed/seven path skips. Its tree equals tested `3c4f1f721`; no application
  changed. The neutral coordination branch is synchronized with that master.

iOS follow-up is in preparation: six regression cases added to the existing
GigDetailViewModelTests cover receipt, duplicate, reassignment, departure and
session/refresh lifetime. They have not run yet; application code is unchanged.
Waiting for Stream3 to release the heavy native slot. No native acceptance claim.

## Reproduced backend failures and repair

Actual HTTP → production route → real Supabase client → PostgREST → PostgreSQL
reproduced seven failures against `959e147e6` before this repair:

- Concurrent owner/worker/price replacement returned 500 instead of conflict.
- A pending start started a newer assignment to the **same worker**, because
  `accepted_at` was omitted from the existing conditional update.
- An unavailable write returned 500 rather than a retryable unavailable response.
- An unavailable saved-result read returned 400 for already-committed work.
- A committed write with a lost reply and unavailable recovery returned 500.

The inherited uncommitted 409/503 patch fixed five of these. Reused it, then bound
both the conditional write and recovery read to existing `accepted_at`, and
preserved the recovery read's error as 503. Reused the route's existing recovery
helper and the existing lifecycle test harness. No table, migration, RPC, service,
screen or test file was added. The older conclusion that same-worker free-task
reassignment needed no repair is superseded by this reproduced race.

Final evidence: **12 HTTP cases plus exact cleanup pass (13/13)**, **229 lifecycle
regressions pass**, and backend privacy gates pass. Lost-reply retries keep the
saved timestamp; two concurrent HTTP starts produce one stored transition and
one stored notification; foreign/replaced workers are refused. The notification
writer is real, while push/badge/socket delivery is stubbed. Identity and transport
faults are synthetic. These new HTTP checks cover free gigs on the retained older
schema; paid provider and full UI acceptance are not implied. No schema was changed.

The two preliminary private harness attempts overlapped their own fixtures; their
results remain recorded as invalid attempts. Final runs are sequential, with
ownership checked before seeding and exact cleanup afterward. The four newly added
unit checks first fail against the inherited patch (225 pass/4 fail), then all 229
pass after the repair. Earlier failures are not relabeled passing.

## Native verification correction and current follow-up

Discarding a response and refetching does **not** establish stale/invalid-result
safety. The earlier source-reading conclusion is withdrawn. Android emitted
"Task started" for any successful decoded response. iOS still decodes
`EmptyResponse` and its caller treats a nil error as success even when silent
refresh fails; it needs its own baseline and repair.

Six distinct Android baseline tests reproduced five defects: invalid receipts,
duplicate pending requests, and late results after session change, departure or
reassignment. The ordinary valid case passed. Gradle retried the five failing
cases, producing 16 recorded executions; these are five distinct failures.

The Android candidate reuses the existing session/read-scope guard and the existing
view-model. It retains one pending start, checks the current assignment and saved
receipt, and retires callbacks on departure or assignment replacement. A stale
failure cannot clear a newer request. The existing screen and controls are
unchanged. The final functional suite passes **54/54**, and **ktlint and detekt pass**
after extracting the receipt predicate into a small helper in the same file. The initial complexity failure remains a
failed attempt. Repository responses and identity are mocked in these JVM tests;
**no installed native journey is accepted by this result**.

## Reused evidence, limits and next action

- Accepted web Start Work component, SDK and regression source is unchanged from
  `c9cb69825`; reuse its [browser evidence with the original synthetic HTTP/auth
  limits](https://github.com/WangPantopus/skinny-pantopus/blob/b4b783f8d42027e22c113a3cfd301f5eb7b4c54b/docs/VERIFICATION_FIRST_2026-09-13.md#existing-web-start-work-control).
- The [prior Start Work record](https://github.com/WangPantopus/skinny-pantopus/blob/82025bc092d09fd288a9a462ca48d5ebbc67fd3f/docs/workstreams/01-gigs-payments.md)
  retains the original `f437dfd20` paid/free evidence and old schema/provider
  limits. Its native acceptance and same-worker-race conclusions are superseded
  above. Prior private artifacts that were not available in this resumed session
  are not claimed as newly inspected.
- The backend binds the assignment observed by its own initial read. A request
  based on a client assignment already stale **before** that read needs further
  verification; neither this patch nor the original web guard proves that scope.
- iOS invalid/late callbacks, both installed native journeys and real provider
  authorization remain open. Native JVM success and green CI are not end-to-end
  acceptance. Cancellation/no-show fee payer/recipient policy is still unspecified.
- Next: verify iOS and the installed Start Work
  journeys, including the stale-client assignment boundary, before claiming
  native or P04 completion. No feature merge while scope
  is unfinished.

## CI, runtime and coordination

- Prior [CI35046049526](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35046049526)
  on `959e147e6` passed 15 applicable checks/one Seeder skip.
  Backend [CI35048472265](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35048472265)
  on `599de1586` was superseded and cancelled by the new push; its aggregate
  check reported failure on cancellation, so it is not a green result. Current combined
  [CI35049746982](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35049746982)
  on `41c75d49a` passes15 applicable checks/one Seeder skip. Do not treat a prior
  source’s CI as final-head evidence.
- PostgreSQL64522/API64521: only exact owned synthetic rows were written. Three
  users, one gig and its notifications are removed; final remaining count zero.
  The private HTTP listener is closed. No container/schema/database reset, cache
  cleanup, physical device or simulator mutation. Heavy native build slot is
  **released** after the successful Android test/static run. No new device
  reservation remains.
- Private scripts, results, source hashes and failed attempts:
  `/private/tmp/pantopus-p04-start-20260915-r1`, mirrored to the owner’s private
  `.pantopus-recovery/audits/20260915-p04-start-r1`. Keep raw logs/credentials outside Git.
- Stream2 handoff reviewed at `70e079543`: browser slice only, SQL decision boundary
  simulated, broader M02 open. Source review leaves token/Home transitions and
  old revoke callbacks as **unreproduced leads** to verify before merge: existing
  content is not cleared on scope change, and a late revoke calls its captured
  old-Home loader. Stream2 owns that follow-up; no peer source was edited here.
- Stream3 pushed `dfc860bfe` in draft PR51. Coordinator inspected source and
  private test/persistence artifacts:42 backend,10 web,13 Android JVM,13 iOS model,
  and9 HTTP/SQL cases pass within synthetic auth/older-schema/intercepted-delivery
  limits. Its installed iOS phase is underway; no full native/N04 acceptance.
  Android CI fails ktlint indentation before later Android gates. The new SDK
  application file and an unreproduced profile-navigation callback lead were sent
  back for author reconciliation. See the [shared review](../VERIFICATION_FIRST_2026-09-13.md#existing-profile-safety-and-blocked-user-journeys).
  Stream3 remains sole writer for blockService, direct-chat socket handlers,
  chats.js and bounded Jest inclusion; paid private-gig helper/export are separate.
  Its exclusive native slot and isolated simulator `0AE16FA0-E244-414F-86C8-24893BDFD979`
  remain reserved. HTTP18130/web18131 and three `f9150300` fixture users are active.
  Earlier exact cleanup reports zero between phases; final cleanup is still owed.
  No schema/reset/cache changes, REST18089 or existing/physical-device install are
  granted. Preserve the owner iPhone17 and other acceptance devices.
- Stream2's SDK guest-status type widening and Stream3's additive SDK exports
  conflict with no Stream1 change. Neither peer branch is approved for merge.
  Their uncommitted live status updates are preserved and not staged by this task.
