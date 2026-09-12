# Pantopus resume guide

Updated September 12, 2026. Filename retained for existing links. Start with
[PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) and the
[remaining inventory](REMAINING_WORK_2026-09-11.md). The previous guide is
preserved in [resume history](SESSION_RESUME_HISTORY_THROUGH_2026-09-12.md).

## Confirm the worktree and live checks

```sh
cd /private/tmp/pantopus-home-permission-boundaries
git status --short
git branch --show-current
git rev-parse HEAD
git fetch origin
git worktree list --porcelain
git log -1 --oneline origin/master
gh pr view 32 --json title,state,isDraft,mergeable,headRefOid,baseRefName,statusCheckRollup,url
gh pr view 34 --json title,state,isDraft,mergeable,headRefOid,baseRefName,statusCheckRollup,url
git rev-parse origin/codex/home-permission-boundaries
gh run list --branch codex/home-permission-boundaries --workflow CI --limit 5 --json databaseId,headSha,status,conclusion,url
```

Expected branch: `codex/home-permission-boundaries`. Compare local, remote and
PR head. A prior green run is insufficient. iOS predecessor
`13bb557e72a3b6a02f6b50762509566c7a0d53be` is green in
[CI 34716984061](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34716984061);
Android is the next source milestone. Inspect the actual current head's checks.
#32 remains a draft; #34 is an unfinished conflicting draft. Master at handoff was
`6a1013784db69bf339535a2f4b33b328f2bbf40c`.

If the temporary checkout is gone, recover source from the verified remote
feature branch into a new isolated worktree. Do not reconstruct code from logs
or overwrite the owner checkout. It retains old master and three unrelated
documentation/design changes. Do not prune other worktrees.

## First implementation: sender invitation management

Recipient accept/decline recovery is accepted on all three clients. Read the
[Android report](home-android-invitation-decisions-2026-09-12.md) and
[backend protocol](home-invitation-decision-recovery-2026-09-12.md), preserving
immutable commands, protected originals and separately checked current access.
Start actual saved-create/lost-reply/failed-refresh reproduction here:

- `backend/routes/home.js`, invitation creation around `notifyCreated`: write
  precedes best-effort delivery and returns invitation plus `emailSent`.
- `backend/services/homeInvitationService.js`: non-replayed create allocates a
  fresh capability; sender creation currently lacks a protected original command.
- `supabase/migrations/20260910034500_home_invitation_transactions.sql`,
  `write_home_invitation`: create/request/approve/reject; remaining resend/
  withdrawal contract is unfinished.
- `frontend/apps/web/src/components/home/InviteMemberModal.tsx` and
  `frontend/apps/web/src/components/home/members/InviteFlow.tsx`: email mode
  distinguishes unconfirmed delivery; username success wording needs reconciliation.
- `frontend/apps/web/src/app/(app)/app/homes/[id]/dashboard/page.tsx`,
  `handleInvite`: refresh failure after a successful write can look like create
  failure. Confirm in real UI before repairing.

Use `rg` to confirm paths/symbols on the actual head. Finish recovery, explicit
resend/withdrawal/current authority and truthful delivery on all sender surfaces,
then ordinary-member onboarding (H07/H08). Continue R02 older-client partial-write
compatibility next, then the ordered inventory. **7 of 80 rows closed** does not
measure app completion or remaining effort.

## Local setup and preservation

Read the private operator index only as needed:
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/OPERATOR_HANDOFF.md`.
Do not print it. Private files are not available from Git alone.

| Resource | Resume handling |
| --- | --- |
| Replay DB | `/private/tmp/pantopus-home-gig-replay`, container `supabase_db_pantopus-home-gig-replay`, API 64521 / DB 64522; CLI `/opt/homebrew/bin/supabase`. Preserve DB and full ledger; never reset it to prepare a test. |
| REST | Preserve `supabase_rest_pantopus-home-gig-replay-preserved-create-recovery-20260911` and replacement. `/private/tmp/pantopus-home-create-rest-before-recovery.json` contains private configuration: never print it. |
| Browser | Owned Next dev 18080 retained, last PID 42758; inspect identity before reuse, no competing `.next` build. Invitation fixture 18084 stopped. |
| Android | AVD `Pantopus_Home_Recurrence_Acceptance`, emulator-5556, stopped with app/data retained. SDK `/Users/yingpengwang/Library/Android/sdk`; Java 17 `/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home`. No data clear/uninstall to simplify tests. |
| iOS | Owned `F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8` stopped; derived `/private/tmp/pantopus-home-documents-derived`, accepted r7 retained. Owner `EB5AD759-4699-481F-8A9F-0D650B074623` unrelated. |
| Phone | Existing Staging 1.0.0 (2), earlier source `139868c`. No update in this milestone. Never install loopback acceptance binaries on it. |
| Node | Backend acceptance uses Node 20 `/Users/yingpengwang/.nvm/versions/node/v20.20.0/bin/node`. Inspect package scripts/configuration before reuse. |

Private Android environment `/private/tmp/pantopus-home-create-android.env`
points to owned loopback/test services. Never print it or use it for a physical
release. Final command from `frontend/apps/android`:

```sh
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ./gradlew -Ppantopus.envFile=/private/tmp/pantopus-home-create-android.env :app:ktlintCheck :app:detekt :app:assembleDebug :app:lintDebug :app:lintRelease :app:testDebugUnitTest :app:testReleaseUnitTest :app:assembleRelease
```

It passed in 25m 45s, including optimized Release. Do not run Gradle concurrently
or repeat full acceptance merely to recover context. Run checks justified by the
next change. Disk was about 5 GiB free; inspect before heavy builds and use APFS
clones to retain artifacts without unrelated cleanup.

Native driver: `scripts/android/home-invitation-decisions-journey.py`.
Shared fixture: `scripts/ios/home-invitation-ui-fixture.cjs`. Inspect guards,
arguments and ownership before starting. These use real production routes/SDK/
SQL with controlled authentication/provider/fault boundaries; they are not live
delivery proof and must never target hosted or owner data.

## Exact latest evidence

Private Android root: `/private/tmp/pantopus-home-android-invitation-decisions-r1/`.

- `native-acceptance-r5-summary.json`: `ui-r2`, `ui-continue-r3`, `ui-finish-r4`
  share the same installed r5 APK/fixture and unchanged 20 Android source/test
  files. Driver corrections wait for durable acknowledgement and inspect actual
  dashboard controls. All five commands and cold account switches pass.
- `old-arrival-r2-binding.json` and source binding: actual predecessor migration
  through normal sign-in and in-place update. Raw XML/store inspections contain
  private capabilities; never print them.
- `candidate-r5-source-inputs.json`, `installed-binding-r5.json`, retained Debug/
  Release APKs and signing logs bind source/build/installed products.
- `release-codec-r1/result-r5.json`, mapping and initializer bytecode bind actual
  optimized APK round trips for three generated-Moshi records. R8 merges the
  builder; the probe follows actual bytecode without changing app data.
- Both `*-regression-r5-summary-final.json` and complete retained results:
  4,547 passed / 80 skipped per variant, 516 suites. Final quality/build/privacy
  logs pass. Zero-byte screenshot placeholders are not visual evidence.
- `fixture-r1/cleanup.json` and `fixture-r2/cleanup.json` each have all four flags
  true: fixtures removed, complete role rows restored, complete ledger preserved,
  exact functions/properties/provenance preserved. All originals acknowledged;
  owned emulator stopped with userdata retained.
- `migration-inventory-final-r5.json`: 44 Home / 21 paid / 53 combined, 12 identical
  shared and zero collisions. Combined replay/adoption still open. Preserve every
  row/column of reserved ledger version `20260910220000`.

Private iOS root: `/private/tmp/pantopus-home-ios-invitation-decisions-r1/`:
signed r7, 308.125-second accepted UI r3, 4,383 passed / 168 skipped, source/
installed bindings, all four cleanups and stopped simulator. Browser/backend
reports index their evidence. Preserve incomplete attempts as history; cancelled
Android r4 is not verification.

A receiving engineer on another machine needs separately authorized transfer of
private evidence and access. Git reports describe outcomes/limits but contain no
credentials, SQL archives or private fixtures. Never copy raw operator material
into a PR or chat.

## Integration and launch

Reconcile both branches' actual SQL and dependencies, run combined fresh/populated
replay preserving values/files/obligations, then verify exact PR and merged-master
checks before merging completed scopes. Read deployment/migration switches again;
historical values are false. Neither #32 nor #34 is complete enough to merge.

Source acceptance does not update hosted staging/production. Last recorded staging
API/worker is `65d2cc2d9`; not reverified during Android acceptance. Hosted Auth/
Storage, external-file restore, ledger adoption, distribution, cutover and rollback
remain separate gates. Keep paid services/provider activation in one final launch
bundle. Continue feature correctness/recovery on existing/free capacity.
