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
PR head. A prior green run is insufficient. The historical incoming sender-work head
`253d5c6cf2108076781c709b1baf563a8c2874e6` has all 16 checks green in
[CI 34721540576](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34721540576).
The sender milestone has separate source/product acceptance below. Inspect live
Git/CI and the private operator index for its exact committed/pushed binding; do
not treat that historical incoming run as current verification.
#32 remains a draft; #34 is an unfinished conflicting draft. Master at handoff was
`6a1013784db69bf339535a2f4b33b328f2bbf40c`.

If the temporary checkout is gone, recover source from the verified remote
feature branch into a new isolated worktree. Do not reconstruct code from logs
or overwrite the owner checkout. It retains old master and three unrelated
documentation/design changes. Do not prune other worktrees.

## Next implementation: ordinary-member onboarding and private first use

The ongoing browser baseline found and repaired authentication forms' native GET
fallback before hydration. See the [actual Chrome proof and limits](web-auth-form-hydration-2026-09-12.md).
The full member first-use journey remains the next task; do not repeat that
bounded authentication reproduction merely to recover context.

Sender invitation creation, explicit resend/withdrawal and recovery pass backend,
browser and both installed native clients. Backend r6 proves 25 originals and
preservation of 366 populated tables; browser r9 proves nine commands. Each
native platform proves eight commands (five completed, one cancelled, two
rejected), with every original acknowledged, plus four matching recipient
reviews without commands. Complete Pending identities and a separate reader-only
ordering follow-up also pass. See the
[sender contract](home-invitation-sender-contract-2026-09-12.md),
[backend report](home-invitation-sender-recovery-2026-09-12.md),
[browser report](home-browser-invitation-sender-2026-09-12.md),
[iOS report](home-ios-invitation-sender-2026-09-12.md) and
[Android report](home-android-invitation-sender-2026-09-12.md).

Saved results survive refresh failure; withdrawal never deletes membership.
Resend preserves old links, original dates and prepared recipient decisions.
Legacy approved requests use current canonical role/source checks, and delivery
copy matches the effective role. Retained command/layout predecessors are bound
separately from the final native reader repair; do not repeat them blindly.

Complete ordinary-member sender → recipient → current My Homes identity →
matching Home → useful household-private Task on all three clients, including
current access denial/removal and recovery, without fixture permission overrides.
Keep household admission separate from residency/ownership. Preserve accepted
address/creation/join/postal/recipient subjourneys and their verification limits.
Broader new-account/provider onboarding still needs its own proof. H07/H08 remain
partial; only close their complete exit criteria.

First capture the real role preset/default policy and create through shipped UI.
Web defaults to member/tenant and native to member; the recorded baseline has no
Home role presets, and the member-default repair intentionally grants only
`home.view`. Task reads need `tasks.view`; creation also needs edit/manage.
Reproduce current behavior before a deliberate permission-policy repair. Do not
insert synthetic grants, reinterpret tenant as lease resident, or describe
household-private tasks as personally private. The existing member-default HTTP
script proves admission/list/detail; extend the invitation fixture narrowly for
real Task commands rather than using older mocked-task fixtures.

Any policy repair has wider consequences than one onboarding task. Existing
`tasks.edit` permits creating and changing one's own readable tasks, plus
status-only changes on another author's task when assigned; broader edits need
`tasks.manage`. It also enables own media/recurrence and can make an explicit
adult eligible for separate reviewed Gig publication. `tasks.view` reveals
permitted household tasks. There is no existing `tasks.create` permission.
Capture both role and individual denies: task-specific permissions and membership
retirement matter independently of a `home.view` denial. Preserve these boundaries
when choosing and accepting a deliberate policy change.

Live defaults participate in `home_invite_policy`. Adding defaults affects
already accepted members immediately and makes pending non-null admission
snapshots fail `INVITE_POLICY_CHANGED`; re-preparing that same invitation cannot
repair the snapshot. New reviewed issuance is needed. The prepared recipient
hash itself uses the stored invitation, not fresh defaults. Legacy null snapshots
intentionally remain an exception and can accept the new current policy. Preserve
saved snapshots/receipts and explicitly cover this distinction in the policy
upgrade; do not describe every pending invitation as automatically retired.

R02 older-client `POST /:id/claim` partial writes follow: share atomic policy and
preserve the legacy response shape and separate postal intent. Do not invent a
protected original UUID or reviewed-address snapshot for old clients. Continue
the ordered inventory after that. **7 of 80 rows closed** does not measure app
completion or remaining effort.

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
| iOS | Owned `F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8`, stopped with signed sender r19 and userdata retained; inspect before new work. Derived `/private/tmp/pantopus-home-documents-derived`, preserved accepted products; compiler cache is back internally after verified storage cleanup. Owner `EB5AD759-4699-481F-8A9F-0D650B074623` unrelated. |
| Phone | Existing Staging 1.0.0 (2), earlier source `139868c`. No update in this milestone. Never install loopback acceptance binaries on it. |
| Node | Backend acceptance uses Node 20 `/Users/yingpengwang/.nvm/versions/node/v20.20.0/bin/node`. Inspect package scripts/configuration before reuse. |

Private Android environment `/private/tmp/pantopus-home-create-android.env`
points to owned loopback/test services. Never print it or use it for a physical
release. Final command from `frontend/apps/android`:

```sh
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ./gradlew -Ppantopus.envFile=/private/tmp/pantopus-home-create-android.env :app:ktlintCheck :app:detekt :app:assembleDebug :app:lintDebug :app:lintRelease :app:testDebugUnitTest :app:testReleaseUnitTest :app:assembleRelease
```

Final sender r11 passed in 18m 34s, including both full variants/Lints and
optimized Release. The exact final optimized APK codec probe also passed. Do not
run Gradle concurrently or repeat full acceptance merely to recover context. Run checks justified by the
next change. Owner-requested cache cleanup removed 52.7 GiB of regenerable cache
data and left 61.4 GiB free before resumed builds. The iOS cache is back on the
internal disk; no external drive is needed. Inspect space before heavy builds and
use APFS clones to retain accepted artifacts.

Current sender driver: `scripts/android/home-invitation-sender-journey.py`.
Preserved recipient driver: `scripts/android/home-invitation-decisions-journey.py`.
Shared fixture: `scripts/ios/home-invitation-ui-fixture.cjs`. Inspect guards,
arguments and ownership before starting. These use real production routes/SDK/
SQL with controlled authentication/provider/fault boundaries; they are not live
delivery proof and must never target hosted or owner data.

## Current sender evidence

Backend/browser root: `/private/tmp/pantopus-home-sender-invitations-r1/`.
Final backend `backend-http-r6-final` and its source binding cover 25 originals;
`browser-final-r9` and `browser-source-binding-r9-final.json` cover nine commands,
current roles, sharing proof, failure/restart recovery and exact cleanup. Web
regression is 1,211 passed / 95 suites, types and changed-source lint green.

Native evidence is at `/private/tmp/pantopus-home-ios-invitation-sender-r1/`
and `/private/tmp/pantopus-home-android-sender-r1/`. iOS `verification-summary.json`
points to final source-r19/candidate-r19, installed list-ui-r2 and full-r4:
4,398 passed / 168 skipped. Its installed overlap proves a newer 503; deterministic
regressions cover newer denial/success and session retirement. Source-r17 layout
and earlier eight-command recovery remain explicit predecessors.

Android `verification-status.json` points to final r11 products and list-ui-r1,
which proves three held-old-success cases: newer 503, current authority denial
and newer success after seeded recipient acceptance. Both full variants pass
4,577 checks / 80 skips each. The eight-command/layout r10 APK and evidence are
preserved separately. All final signatures, installed/source bindings and the
optimized r11 codec runtime pass. The native list follow-ups create zero sender
commands. All four iOS and three Android fixtures are exactly cleaned, and both
owned devices are stopped with userdata retained.

Verified durable summaries, actual result bundles, visual evidence and accepted
product clones are indexed at
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/home-invitation-handoff-20260912/sender-invitations-20260912/`.
Read each platform's report for failed/limited attempts, actual versus injected
boundaries, final source distinctions and broader verification limits.

## Preserved recipient evidence

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
