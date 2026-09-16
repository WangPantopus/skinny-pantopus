# Stream 1 — Gigs and payments

Updated September 15, 2026. Owner: coordinator / Stream 1.
State: CI — two bounded repairs pushed; native end-to-end acceptance remains open.

Preserve existing iOS, Android and web screen designs. Verify existing behavior,
repair demonstrated failures in place, and retain the evidence limits below.
P04 and the wider P01–P10/launch backlog remain open; no inventory row closes.

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
- Shared documentation PR49 merged as **`0616d6e79`** after four applicable
  checks passed/seven path skips. Its tree equals tested `3c4f1f721`; no application
  changed. The neutral coordination branch is synchronized with that master.

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
- Next: finish current-head CI, then verify iOS and the installed Start Work
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
  on `41c75d49a` is queued. Do not treat a prior source’s CI as final-head evidence.
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
- Stream3 live handoff is republished at `fc99f8ee7`, correctly marked repair with
  no real-persistence/installed acceptance and an introduced empty-list defect.
  It owns `chats.js` block repairs and the bounded `backend/jest.config.js`
  inclusion of the existing chat-access suite. On its resumed request, overlap
  review found the paid socket delta is only `emitPrivateGigUpdate` and its export.
  Stream3 is now sole writer for the block-service error/cache repair and affected
  direct-chat socket handlers, preserving private-gig delivery, session revocation
  and `connectedUsers`. Verify all block-service callers before changing errors.
  Runtime grant: exact synthetic social fixtures on PostgreSQL64522/API64521,
  private HTTP18130/web18131, no schema changes. REST18089 is not granted (retained
  Home database resource and currently not listening). Stream3 owns the next
  heavy native slot after announcing exact build/device targets and checking
  leases; owner iPhone17 and existing acceptance devices remain protected.
- Stream2's SDK guest-status type widening and Stream3's additive SDK exports
  conflict with no Stream1 change. Neither peer branch is approved for merge.
  Their uncommitted live status updates are preserved and not staged by this task.
