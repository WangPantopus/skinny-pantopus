# Fresh-session continuation checkpoint — September 10, 2026

This is a source-preservation checkpoint requested by the owner so work can
continue in a fresh session. It includes unfinished implementation. It is not a
release, completed acceptance, or permission to merge failing/unfinished PRs.
The [resumed native recovery report](home-native-ci-recovery-2026-09-10.md)
records the subsequent origin/PR refresh, iOS simulator-signing repair and
passing protected-store checks. Its newer observations supersede those specific
CI findings below; Android/browser/installed-journey gates remain open.
The subsequent [browser access report](home-web-task-access-recovery-2026-09-10.md)
closes browser findings 1 and 2 below with actual Chrome evidence. The
[confirmed recovery report](home-web-task-confirmed-recovery-2026-09-10.md) closes
finding 4 with actual encrypted IndexedDB, reload, competing-tab and corrupt-slot
acceptance. The [upload reselection report](home-web-task-upload-reselection-2026-09-10.md)
closes finding 3 with actual encrypted Chrome recovery, exact reselected bytes,
competing tabs, current metadata/retirement, corrupt storage and account changes.
All four browser findings below are now historical; remaining Home scope is open.
The resumed [installed iOS journey](home-ios-task-installed-journey-2026-09-10.md)
now passes end to end after repairing the blank attachment sheet and the test
workflow. Its newer evidence supersedes the original failed execution below.
The resumed [Android attachment report](home-android-task-private-media-2026-09-10.md)
closes the draft compiler/formatting, cancellation/temporary-file and stale image
findings. Local full gates, emulator controls/PDF and the installed complete
attachment journey pass. Remote required CI on the final head remains a separate
gate. Older failed/unbuilt observations below are retained only as history.
The latest handoff checkpoint lists all six pushed continuation milestones and
the next remaining scope. The new synthetic servers and dedicated simulators
were stopped after acceptance; existing owner sessions remain untouched. Refresh
current PR #32 CI rather than relying on a superseded run.
Read this document and the top of `PROJECT_HANDOFF.md` first; consult older
reports only for the next concrete task. Refresh Git and CI before relying on
the observations below.

## Working directories and source state

| Workstream | Worktree | Branch / PR | Last verified milestone before this checkpoint |
| --- | --- | --- | --- |
| Home and browser/native tasks | `/private/tmp/pantopus-home-permission-boundaries` | `codex/home-permission-boundaries`, draft PR #32 | `502de726f` iOS private task media |
| Paid task workflows | `/private/tmp/pantopus-staging-paid-gig` | `codex/staging-paid-gig`, draft PR #34 | `48afcc68f` Android payment opening identity |
| Production adoption planning | `/private/tmp/pantopus-staging-adoption-plan` | `codex/staging-adoption-plan`, no PR | `71473ed5a`; older report context must be reconciled with final source |
| Owner checkout | `/Users/yingpengwang/skinny-pantopus` | local `master` | `939878b4f`; intentionally not updated over owner edits |

The two active draft branches now preserve the additional work described below.
Use `git log -1`, `git status --short`, `git fetch origin`, and current PR checks
to resolve their actual checkpoint commit IDs. Do not infer that a branch has
been merged or deployed because it was pushed.

The main checkout has an unrelated modified `docs/PROJECT_HANDOFF.md` and two
untracked owner files: `docs/designs/pantopus-place-page-concept-2026-09-09.html`
and `docs/pantopus-place-social-design-2026-09-09.md`. Those were preserved and
must not be swept into these commits. PR #24 and other unrelated work remain
separate. Recovery logs, credentials, raw tokens and database archives stay out
of Git. The private operator continuation lives under the main checkout's
`.pantopus-recovery/20260907/OPERATOR_HANDOFF.md`.

## Completed milestones to preserve

- The full Beacon publish → notification → exact permitted post journey passed
  live staging/API and recorded device checks. The owner confirmed physical
  iPhone foreground, background and closed-app delivery, old blocked-link denial,
  mute/resume, global push off/restore, and the repaired Beacon-specific saved
  preference off/restore with no replay. Android emulator delivery, permission
  denial/restoration and expired-session exact return also passed within their
  documented limits. Do not repeat these completed fixtures or owner checks.
- Native saved-card setup, default/removal, account boundaries and cleanup are
  complete. Mail-code/multi-unit verification and recorded fixture cleanup are
  complete within their reports' synthetic/provider limits.
- Home role/record authorization, transactional task creation receipts, private
  documents/claim evidence, native task browse/create/edit, and durable assignment
  notifications have committed checkpoints. Current assigned recipients and
  preferences govern delivery; exact metadata routes to current permitted tasks.
- Recent Home milestones: `f24785404` iOS retained forms; `92a35b7f9` assignment
  outbox; `848bf28c6` Android retained forms; `c1cac2a30` iOS task routing;
  `9df1e4934` browser task routing; `f5ca4acfd` Android task routing;
  `502de726f` iOS private task attachments. Each has a linked dated report.
- Recent payment milestones include durable refunds, assigned authorization,
  hold-expiry recovery and stop/cancel/release actions across clients.
  `d2b9b42a6` keeps saved browser actions reachable, `4dec19088` adds Android
  stop recovery, and `48afcc68f` binds payment actions to their opening identity.
  These are source milestones, not certification of every payment journey.
- Production database backup was restored locally: all 299 archived COPY
  sections matched. Canonical fresh replay and populated upgrade rehearsals
  have passed their recorded checkpoints. External object bytes and final hosted
  ledger/Auth/storage adoption remain separate unfinished gates.

Evidence entry points: [Beacon journey](beacon-full-journey-2026-09-08.md),
[preference acceptance](beacon-push-preference-2026-09-08.md),
[platform notifications](notification-platform-verification-2026-09-09.md),
[Home assignment delivery](home-task-assignment-delivery-2026-09-10.md),
[browser task routing](home-web-task-notification-routing-2026-09-10.md),
[Android task routing](home-android-task-notification-2026-09-10.md), and
[iOS task attachments](home-ios-task-private-media-2026-09-10.md).
Payment reports live on `codex/staging-paid-gig`.

## First priority: close the known Home gaps

### Current PR #32 CI failures

Run [34484769214](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34484769214)
at `502de726f` passed backend, privacy, database replay, web, web E2E, iOS build
and Android instrumentation. It failed the following native checks. These are
diagnosed observations, not failures introduced by every draft file below.

1. All three iOS simulator jobs fail the old footer assertion in
   `PantopusTests/Features/Homes/ClaimUploadStepSnapshotTests.swift:58`. The
   approved current copy in `ClaimUploadStep.swift:15` describes current
   authorized claim reviewers; the assertion still expects the older assigned-
   reviewer wording. Update the assertion to the actual reviewed product policy.
2. All three also fail
   `HomeTaskSavedRequestTests.testProtectedStoreRoundTripUsesExactScopeAndMatchingClear`
   with missing Keychain entitlement `-34018`. `.github/workflows/ios-ci.yml:124`
   disables signing and clears entitlements in the shared build. Supply a properly
   entitled simulator test host for actual protected-store verification. Do not
   hide this test failure or infer a production Keychain defect from it.
3. Android's five `AddHouseholdTaskFormSnapshotTest` images are stale following
   the reviewed “Saved recurrence” copy and truthful scheduling disclaimer in
   `AddHouseholdTaskFormScreen.kt:472`. Differences are 1.513019–1.740916%,
   repeated on all retries. Review and refresh these five baselines. Formatting,
   static analysis, lint and compilation passed; this CI run stopped at JVM
   tests before APK assembly.

Private evidence: `/private/tmp/pantopus-pr32-ci-34484769214/failed.log`, adjacent
iOS logs and downloaded Android reports/deltas. Do not commit operator artifacts.
Refresh CI after fixes; the new checkpoint itself has not inherited a green CI.

### Browser task forms — draft implementation, review findings open

Seven new modules in `frontend/apps/web/src/components/home/tasks/` provide the
typed task model, current-session client, encrypted IndexedDB retained command,
create controller, shared form lifecycle, task collection and dashboard action
bindings. `TaskSlidePanel.tsx`, the Home dashboard and standalone task page use
the shared form. Creation saves an original UUID/payload before POST; edits send
only changed fields and preserve untouched timestamp/recurrence/zero budget.
Attachment retries retain original per-file IDs in the live panel, with explicit
retired-upload acknowledgment. No credentials or server session proof are stored
in the encrypted recovery payload.

Current verification: 20 rendered workflow checks pass in
`tests/homeTaskAttachments.test.tsx`; final checkpoint typecheck passes with zero
errors and focused source lint has zero warnings/errors. Those checks use a
storage test double. The actual encrypted IndexedDB browser journey and the full
web suite have NOT run for this draft. Earlier 1,145 passing web checks belong
to `9df1e4934`, not this new form implementation.

Independent source review found four required follow-ups, not browser-reproduced
yet. Address these before calling this milestone complete:

1. A fresh task detail 403/404 during save leaves the prior private fields and
   readiness visible. Clear rendered private task state and invalidate readiness
   on current read denial in `useHomeTaskForm.ts`.
2. `uploadHomeTaskMedia` internally awaits a session preflight before POST. The
   form can close/background during that await, yet the helper starts the POST
   afterward. Carry the lifecycle guard into the helper and check just before
   dispatch; distinguish this from an upload already sent.
3. Closing/reopening clears unknown per-file UUIDs. Reselecting the same bytes
   can create another upload after a lost committed response. Design explicit
   recovery/reselection of the unresolved identity; do not claim cold file replay.
4. `HomeTaskCreationController.finish` clears the retained command before its
   final lifecycle check and UI completion. Background/close after the IndexedDB
   delete is queued can suppress success after recovery state has gone. Retain
   confirmed recovery until it can be safely consumed, including competing tabs.

Then run focused failure/race cases, type/lint/full web gates and actual Chrome
acceptance: create → lost reply → close/reopen → exact original recovery, sparse
edits/clears, current denial, account change, corrupt/competing storage, and
attachment retry/reselection. Inspect encrypted stored envelopes and verify no
replacement POST. Use localhost synthetic HTTP and keep logs/screenshots private.

### Android task attachments — unbuilt draft

The 22 Android files add API DTO/service/repository/DI, exact-task attachment
access/controller/ViewModel/dialog/picker, shared private preview and focused
checks. The detail screen opens the media dialog. Explicit retired-upload
acknowledgment binds the original failed POST ID and current stored credentials;
it issues no replacement POST/DELETE. No Gradle, compiler, app build or installed
journey has verified this candidate yet.

Source review identified a cleanup gap: `HomeTaskMediaRepository.kt:54–60` and
`HomeTaskMediaPicker.kt:13–23` return private byte arrays through cancellable
`withContext(IO)`. Cancellation on dispatcher return can discard bytes before
the caller can erase them. Close this ownership/cleanup boundary. PDF preview
uses a temporary `cacheDir` file; normal cleanup does not cover process death.
Do not describe it as strictly memory-only. Pending file bytes/UUID survive only
ViewModel lifetime, not process death.

After fixes, run formatting, Detekt, lint, JVM checks and app builds. Include new
`HomeTaskMediaApiTest`, `HomeTaskMediaAccessTest`, `HomeTaskMediaControllerTest`
and `HomeTaskMediaTerminalTest`, plus the existing Home task/access/detail/list
and private claim-evidence suites touched by the shared preview. Run
`HomeTaskMediaControlsTest` on the emulator, then the full installed picker →
preview → revoke → removal/recovery journey. Two control tests alone are not
full journey acceptance.

### Installed iOS task journey — build passed; first execution failed

The [installed journey report](home-ios-task-installed-journey-2026-09-10.md)
and committed UITest/loopback fixture preserve the exact plan. Both actual build
attempts passed. The first installed execution reached one synthetic login
request, then timed out awaiting the signed-in UI at UITest line 146. The fixture
recorded no task, creation receipt or media. An inspected screenshot remained on
the login screen. It did NOT establish create/picker/preview/removal acceptance.
The unsuccessful run was interrupted for this owner-requested checkpoint.

Next diagnose login-response decoding/session persistence and the entitled test
host before retrying; the observed result does not establish the cause. Make
failed waits stop the remaining journey. The dedicated synthetic simulator is
`A7714AC8-6F53-4DCD-A233-3028B19275C6`; keep the owner's other simulator/phone
sessions untouched. Fixture binds `127.0.0.1:18081`; existing port 8000 is a
separate SSH listener. Private build/run scripts and evidence are listed in the
operator handoff. Use a fresh synthetic simulator or ordinary logout for repeat
acceptance, never erase another account's Keychain.
The unsuccessful runner and loopback fixture were stopped, and this dedicated
simulator was shut down for the checkpoint. Other simulators/listeners were left
alone. Restart the fixture deliberately before resuming its tests.

## Payment continuation on PR #34

All CI at the last completed milestone `48afcc68f` passed. The new checkpoint
adds only `backend/contracts/gig-tip-contract.md` and `backend/stripe/gigTipProof.js`
plus documentation. The proof helper passes syntax checking, but has no executed
behavioral verification and is not wired into the tip routes. No durable tip
migration, reservation, service or client implementation is complete.

Next implement durable tip requests before repairing optimistic client success:
reserve original UUID/Payment/immutable amount+terms+method before provider work;
retain the same provider key; verify exact payer/payee/customer/currency/metadata,
mode, fee/destination and charged amount. `check` performs provider reads only;
`cancel` needs durable proof of zero charge. SDK completion or HTTP success is
insufficient. Unknown/historical pending tips block new charges; reconcile them
without inventing an old confirmation time. Preserve payer-only completed and
owner-confirmed Gig policy, minimum 50 cents, maximum three successful tips,
full tip to worker and current Connect account-record requirements. Verify the
contract and existing financial conventions before using the draft helper.

Migration `20260910190000_paid_gig_tip_receipts.sql` is RESERVED, not implemented.
Home already owns `170000` task receipts and `180000` assignment outbox; reserve
Home additions at `200000` or later after coordination. Audit all older cross-
branch timestamp collisions and dependencies before combining PR #32/#34.

Finish tip backend SQL/concurrent replay/populated upgrade and service proof,
then browser/iOS/Android retained recovery and SDK lifecycle. Continue remaining
started-work/no-show/fee/completion/reopen/dispute/Connect/debt behavior and
durable attention, followed by actual sandbox/provider and installed journeys.
Preserve balances, receipts and historical financial records; no live charges.

## Remaining sequence through launch

1. Resolve the concrete CI and draft review findings above, verify and commit
   each meaningful milestone. Keep PRs #32/#34 draft until their final combined
   scope, migration ordering and current checks are ready for integration.
2. Complete Home task recurrence (a stored rule is not automatic scheduling),
   task-to-Gig, relationships/residency exact receipts, ownership challenge/
   transfer, lease and resource/derived-data cleanup. Inventory reachable Home,
   Pulse, mailbox and marketplace workflows and finish their remaining gates.
3. Complete payment paths above and remaining notification/account lifecycle
   coverage. Existing physical Beacon/native saved-card checks stay complete;
   physical Android delivery and other explicitly unverified OS/provider paths
   must retain their limits. Browser notification cache/account lifetime needs
   separate review beyond exact-task routing.
4. Complete real OAuth callbacks and real email delivery/recovery verification
   using existing capacity where possible. Controlled SMTP/API tests do not
   certify external delivery. Keep vendor-dependent cases clearly pending.
5. Combine the release source and final migration stream. Rehearse empty replay,
   populated upgrades and preservation of original records/entitlements; reconcile
   hosted ledgers, managed Auth/storage, external file backup/restore and schema
   differences. Produce concrete deploy/rollback/version/flag/candidate plans.
6. Verify release candidates across web, iOS and Android with integrated Home/
   Pulse/Beacon and adjacent workflows, meaningful access/error/retry checks,
   accessibility and capacity/load/retention observations. Review final CI and
   use the exact reviewed head when merging. Earlier PR #14's CI waiver does not
   waive the current release checks.
7. After all work achievable without new spend is ready, present ONE consolidated
   owner launch-preparation list of every paid dependency/subscription, including
   Smarty. The owner will purchase/activate them together. Smarty's existing
   reminder remains paused; do not create duplicate reminders or buy a plan.
8. Run the newly enabled provider acceptance, resolve findings, then carry out
   reviewed production cutover/post-deploy/rollback readiness and a small pilot.
   Local/CI passes alone are not evidence that every feature is complete or that
   production has been upgraded.

The owner prioritizes working, maintainable, scalable workflows over unit-test
counts. Use tests as evidence for consequential failure modes and spend remaining
acceptance effort on actual journeys. Do not promise zero bugs, fabricate a
completion percentage, repeat completed owner checks, or spend money now.
