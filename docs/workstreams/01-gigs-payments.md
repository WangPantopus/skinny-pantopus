# Stream 1 — Gigs and payments

Updated September 15, 2026. Owner: primary coordinator.
State: ready for review — P04 Start Work recovery repaired and verified end to end.

Apply the user's clarified [working agreement](README.md#working-agreement):
preserve iOS/Android/web designs, verify existing journeys first, repair and retest
failures, and justify any new file or database structure before adding it.

## Scope and source

- Inventory: P01–P10. Current milestone: the P04 Start Work slice — a committed
  transition with a lost reply, retry, concurrent requests, current assignment
  identity and stale/invalid native results. The rest of P04 (no-show,
  cancellation-fee execution, completion/reopen policy, immutable displayed
  terms) is untouched and stays open.
- Worktree: `/private/tmp/pantopus-paid-gig-integration`.
- Branch: `codex/paid-gig-integration`; milestone commit `f437dfd20`, base `b4b783f8d`,
  then master integration `959e147e6` (documentation resolution only, no application change).
- Changed paths: `backend/routes/gigs.js`, `backend/tests/unit/paidGigLifecycleRoute.test.js`.
- PR #47 carries this branch. PR #34 stays draft at `c9cb69825`; its remaining
  acceptance scope is unchanged by this milestone.

## Reproduced failures

Reproduced against the existing route before any application edit, then re-run
after the repair:

1. A committed start whose reply was lost: the same worker's retry returned
   `400 Gig must be assigned to start (current: in_progress)`.
2. A concurrent duplicate start: the losing request returned
   `500 Failed to start gig` for work that had in fact started.
3. A transport failure on the gig read returned `404 Gig not found`, telling the
   worker to stop rather than retry.

The existing authority and snapshot guards were already correct and were proven
so, not changed: a foreign actor and a replaced worker are refused with 403, a
changed payment snapshot is refused, and an unstarted gig still fails closed when
authorization cannot be verified.

## Repair and why reuse was sufficient

Repaired the existing handler in place. No new table, migration, RPC, service,
screen or test file. `matchesWorkerStart` mirrors the file's existing
`matchesWorkerCompletion`; one `recoverSavedStart` closure re-reads the row under
the existing `bindGigPaymentSnapshot` before both the non-assigned rejection and
the conditional-write failure. The existing conditional UPDATE already commits
exactly once, so only the recovery read was missing — a `start_gig_work` RPC
mirroring `mark_gig_completed` was considered and rejected as unnecessary, since
that RPC exists to commit completion proof and notices in one transaction, which
the start path does not require. The read now uses `maybeSingle` and splits 503
from 404, matching the sibling handler at `gigs.js:7695-7698`.

New cases live in the existing `backend/tests/unit/paidGigLifecycleRoute.test.js`
beside its accepted completion-recovery block, reusing its existing harness.

## Evidence

- Reused: the web Start Work control guard accepted at `c9cb69825` within its
  [recorded source and runtime limits](https://github.com/WangPantopus/skinny-pantopus/blob/b4b783f8d42027e22c113a3cfd301f5eb7b4c54b/docs/VERIFICATION_FIRST_2026-09-13.md#existing-web-start-work-control).
  That guard requires `status`, `accepted_by` and a finite `started_at` in the
  reply; the recovery reply satisfies it, so no web change was needed.
- New end to end: 23/23 checks over real HTTP through the existing route against
  real PostgreSQL on the retained replay stack (API 64521 / DB 64522), free and
  paid gigs — first start commits `in_progress` with `started_at`; a lost reply
  recovers the saved row with its original `started_at`, no repeated owner notice
  and no repeated provider authorization; genuinely concurrent starts both return
  200 against one commit, agree on one `started_at` and leave one notice; a
  foreign actor and a replaced worker are refused 403; a settled later price
  change still recovers the saved start and reports the current price; an
  unstarted gig still fails closed at 503 when authorization cannot be verified.
- Regression: full backend Jest 6193 passed / 16 skipped / 0 failed; the paid
  lifecycle suite 220 passed (206 baseline plus 14 new); backend privacy gates pass.
- Client reading, no code changed: web `CompletionFlow.tsx` validates the receipt;
  `my-bids/page.tsx`, iOS `GigDetailViewModel.startTask` (`EmptyResponse`) and
  Android `GigDetailViewModel.startTask` (Moshi) discard the body and refetch, so
  a stale or invalid payload cannot overwrite their state. The additive `reused`
  field is ignored by all three, as it already is for `mark-completed`.

## Limitations

- Stripe is a labeled stub in the end-to-end harness; only the provider call is
  stubbed. Real provider authorization remains unverified here and stays with
  P08/P09.
- The replay database predates the current branch's migrations (for example it
  has no `mark_gig_completed`, and `User.account_type` still uses `individual`).
  Every column and constraint the start path touches is present and was exercised;
  no schema was changed, reset or migrated.
- No installed iOS or Android build was run for this milestone. Native behavior
  is established by source reading plus the shared backend contract, not by a
  device journey.
- The repository's own `tests/integration/gig-lifecycle.test.js` cannot run against
  the replay database: its helper seeds `account_type: 'personal'`, which that
  older schema rejects. The suite was not modified to fit a stale fixture; the one
  auth row it leaked before failing was removed.
- Green CI and the mocked suite alone do not close P04.

## Examined and deliberately not changed

Recorded so they are not re-derived, each without a reproduced failure:

- `accepted_at` is not bound by `bindGigPaymentSnapshot`. Reopen sets
  `accepted_by`, `accepted_at` and `payment_id` to NULL, so a paid re-assignment
  always changes `payment_id`. Only a price-0 gig re-assigned to the same worker
  leaves every bound predicate identical across assignment epochs, and the start
  is still truthful for the worker currently assigned. No harm reproduced.
- A conditional write that matches no row for a reason other than this worker's
  own start still returns 500; the sibling urgent handler returns 409 "Task
  changed. Refresh before updating status" (`gigs.js:7761`). Candidate next item.
- `createBulkNotifications` writes no `idempotency_key`, so an owner notice lost
  after the commit is never recreated. This predates the repair and is not a
  regression. It sits in the shared notification service and needs a coordinator
  assignment before any edit.

## Coordination and handoff

- Runtime: used the retained replay stack read/write for owned fixtures only.
  All fixture rows removed and verified: 6 gigs, 8 users, 4 payments; 0 remain.
  No schema, migration or reset. No heavy native build taken.
- Shared-file effects: none from the repair. The change is confined to the gigs
  route and its existing test file, both already Stream 1 scope.
- Integration performed: PR #47 was unmergeable against master, so GitHub could
  build no merge ref and scheduled no CI at all for `f437dfd20`. The cause was this
  branch carrying its own copies of the shared coordination documents that master
  had received independently through PR #48. Merge `959e147e6` resolves those four
  documentation conflicts only — the two shared coordination files take master's
  published versions, the handoff and backlog keep both sides' distinct content —
  and PR #47 is mergeable again with CI run 35046049526 scheduled. Feature branches
  should stop carrying shared coordination documents; master owns them.
- Blocker unchanged: the cancellation/no-show fee payer and recipient policy is
  still unspecified; it does not block this milestone.
- Peer findings received: Stream 3 wrote its N04 "ready for review" handoff into
  the retired `docs/workstreams/03-accounts-social.md` snapshot inside the gigs
  worktree instead of this live folder. The content is preserved outside Git and
  was not committed to the gigs branch; the snapshot was reverted so the master
  integration could proceed. Stream 3 must republish that handoff here — the
  coordinator will not write another stream's live status file. Its pushed work
  on `codex/workstream-accounts-social` (`fc99f8ee7`) is unaffected.
- Reviewed for conflict, no Stream 1 overlap: Stream 3's branch changes 14
  frontend files only, no backend, schema or migration. It does touch the shared
  SDK export barrel `frontend/packages/api/src/index.ts`, which the coordination
  guide lists as cross-cutting and which needed a recorded assignment first. The
  edit is two additive export lines and conflicts with nothing in Stream 1; the
  assignment is recorded here retroactively rather than treated as a violation.
  Stream 2 has pushed no work; `codex/workstream-home` is still at master.
- Next action: confirm CI run 35046049526 on PR #47 head `959e147e6`, then take
  the 409 conflict taxonomy item above as the next bounded milestone.
