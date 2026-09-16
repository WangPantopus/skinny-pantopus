# Stream 1 — Gigs and payments

Updated September 15, 2026. Owner: coordinator / Stream 1.
State: handoff — iOS WIP pushed; candidate validation and acceptance remain open.

Preserve existing iOS, Android and web screen designs. Verify existing behavior,
repair demonstrated failures in place, and retain the evidence limits below.
P04 and the wider P01–P10/launch backlog remain open; no inventory row closes.

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
