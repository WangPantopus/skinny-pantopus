# Pantopus resume guide

Updated September 13, 2026. Filename retained for existing links. Start with
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
PR head. The committed/pushed Task predecessor is
`767fbb2278774bcd092f2e1b425cc43325bda8a9`, with all 16 checks green in
[CI 34742973930](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34742973930).
The earlier fully CI-verified R02 checkpoint is `d3c3e0fac3b90e7e0d468ba421cffd5bb0e9475c`,
with all 16 checks green in [CI 34744758908](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34744758908).
The older authentication repair remains accepted at `80c702a34`. Backend/browser
R03 recovery is committed/pushed at `1a475708468c1f7e46583c476301f3a106117d77`.
Its original PR run stayed queued without jobs; a separately dispatched exact-head
[CI 34750247001](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34750247001)
passes 15 jobs including CI OK; Detect changes is skipped for the manual full
run. Local, remote, PR and successful run heads match. The original queued run
and the earlier R02 run do not verify this source. Refresh actual Git and CI
before relying on this checkpoint.
The native removal milestone now passes product and installed gates and is
integrated separately from the history candidate. Its exact pushed-head CI must
be verified independently of 1a. Inspect live Git/CI, the PR and private operator
index for the current source/CI binding before relying on any checkpoint.
#32 remains a draft; #34 is an unfinished conflicting draft. Master at handoff was
`6a1013784db69bf339535a2f4b33b328f2bbf40c`.

If the temporary checkout is gone, recover source from the verified remote
feature branch into a new isolated worktree. Do not reconstruct code from logs
or overwrite the owner checkout. It retains old master and three unrelated
documentation/design changes. Do not prune other worktrees.

## Next acceptance: reviewer history and current claims privacy

The committed Task first-use milestone passes
[backend policy/HTTP/SQL](home-member-task-first-use-2026-09-12.md),
[browser](home-browser-member-first-use-2026-09-12.md) and
[installed iOS](home-ios-member-onboarding-2026-09-12.md) acceptance.
The [installed Android journey](home-android-member-onboarding-2026-09-12.md)
also passes exact input, cold original retry, edit/completion/reopen and current
access, with both full variants, lint/signing and optimized codec proof. All
fixtures are exactly cleaned, both owned devices are stopped with userdata
retained, and durable source/product/evidence copies are verified. Its exact-head
CI is green, and the later R02 integration also has all 16 checks green at d3.
All clients preserve
their accepted segments and failed
driver predecessors; do not describe segmented proof as an uninterrupted fresh run.

The browser [authentication readiness repair](web-auth-form-hydration-2026-09-12.md)
is already committed and verified. Do not repeat that bounded reproduction.

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

The member journey uses ordinary sender → recipient → current My Homes identity →
matching Home → useful household-private Task, including current access
denial/removal and recovery, without positive fixture permission overrides.
Keep household admission separate from residency/ownership. Preserve accepted
address/creation/join/postal/recipient subjourneys and their verification limits.
Broader new-account/provider onboarding still needs its own proof. H07/H08 remain
partial; only close their complete exit criteria.

Actual baseline capture is complete. Web defaults to member/tenant and native
to member; the retained replay has no Home role presets and originally grants
ordinary members only `home.view`. Both shipped admissions succeed but eight
ordinary Task operations fail. The additive `20260912050000` candidate grants
only missing `tasks.view`/`tasks.edit` defaults. All 49 raw and 49 generated SQL
contracts, populated upgrade and real HTTP/SDK/SQL pass. Do not reinterpret
tenant as lease resident or household-private Tasks as personally private.
The shared invitation fixture uses explicit `member-onboarding member-tasks`
arguments and actual Task routes; its default remains the preserved baseline.

The deliberate policy repair has wider consequences than one onboarding Task. Existing
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

R02 [older-client compatibility](home-residency-legacy-compatibility-2026-09-12.md)
is integrated from the isolated worktree based on `80c702a34`. Additive
`20260912060000` shares atomic admission, preserves existing membership and the
legacy envelope, and keeps postage separate. Actual acceptance passes 53
HTTP/SDK calls, ten observed lock races, populated upgrade and omitted-role
household approval. The combined H07/R02 candidate passes all 50 raw plus 50
generated contracts, with exact 366-table/function/role/full-ledger restoration.
Root verifies primary bytes against those tested sources before committing.
No immutable request UUID, reviewed-address snapshot, cancellation guarantee,
old-binary UI coverage, live notice arrival or hosted adoption is claimed.

R03 [four-platform removal baseline](home-member-removal-baseline-2026-09-13.md)
proves committed-reply loss, misleading cached membership and repeated DELETE
side effects. Native baselines are complete against retained H07 products at d3:
one iOS confirmation produces three committed removals; the accepted browser
and Android cases each produce one. Fresh roster reads recover the actual state;
current 503 remains unknown. Shipped re-invitation refuses ended membership;
an older held request is discarded before RPC, without forced renewal.

The [backend removal repair](home-member-removal-recovery-backend-2026-09-13.md)
and [actual browser recovery](home-browser-member-removal-recovery-2026-09-13.md)
now pass: protected originals, exact retry, unseen cancellation, changed review,
current authority, and historical results after self-leave without Home access.
All five browser originals are acknowledged. Backend acceptance passes populated
upgrade, 51 raw/51 generated contracts, 15 actual HTTP/SDK groups and seven
observed-lock groups; browser regression passes 1,260 checks in 100 suites.
Their integrated pushed-head CI remains separate from the predecessor R02 run.

Both native five-original journeys now pass two completed, one cancelled and two
rejected originals, with all acknowledged and exact cleanup. Their bounded
reader follow-ups also pass: actual iOS Close and Android held-read tab switching exposed
stale roster restoration; Android also showed false zero counts on read failure.
iOS app9 passes its signed build, 81 focused checks and 4,428 full checks with
168 skips. Its same-original installed continuation passes and is exactly
cleaned. Android's predecessor passes 4,622 checks with 80 skips per variant;
its reader/count repair passes 48 focused Members checks, 4,626 full checks with
80 skips per variant, signing/optimization and actual installed held/tab/Close,
503/Retry and unknown-versus-confirmed-zero checks. iOS's follow-up uses one
additional deliberate original across app6 to app9 without another submit;
Android's follow-up creates zero originals. Both owned devices are stopped with
userdata retained. See the [iOS report](home-ios-member-removal-recovery-2026-09-13.md)
and [Android report](home-android-member-removal-recovery-2026-09-13.md).
Inspect actual build, DB and device leases rather than repeating accepted
baselines or overwriting source. Failed driver predecessors remain distinct
from accepted proof.
Committed candidate HTTP/SDK/UI acceptance uses a separately owned database to
preserve the retained column/catalog provenance. Browser fixtures are cleaned;
runtime-r5 REST 18085 remains available for the next owned native fixture.

The removal nonce invalidates old unsubmitted reviewer tokens because the old
snapshot hashes the full occupancy; fresh review is required. Completed receipts
and old occupancy column values remain preserved. Legacy no-UUID callers retain
no fence against a future legitimate renewed membership; current shipped renewal
is refused. H07 controlled removal and sender withdrawal remain separate proof.

The [combined applicant/reviewer baseline](home-residency-cycle-baseline-2026-09-13.md)
passes ten actual HTTP/SDK/SQL groups and 128 requests, actual Chrome submission,
rejection, resubmission, independent approval, acknowledgement, removal and cold
applicant return. Conflicting independent reviewers and real authority expiry
during observed SQL waits also pass. Both fixtures are exactly restored. Current
claims responses expose broad private fields and omit explicit no-store headers;
the shared queue visibly displays a raw account name. Acknowledged reviewer
decisions have no supported history entry. Continue the isolated history candidate
and this observed claims-queue repair after native reader acceptance, then the
ordered inventory. The isolated history candidate now passes populated upgrade,
zero SQL lint issues and 104 raw/generated contracts, with exact restoration.
Its first upgrade caught an inherited service-role helper grant; the additive
candidate now revokes it and directly tests the denied helper call. Preserve
that failed predecessor and use private preparation-r3 for the corrected
history-runtime port guard. History HTTP/browser/native acceptance remains
unrun. Do not repeat the completed primary baseline.
Private evidence is under `pantopus-home-member-removal-r1`
and durable `member-removal-20260913/{backend-recovery-r1,browser-recovery-r1}`.
Inspect the operator index and current ownership before another writer.
**8 of 80 rows locally closed** does not measure app completion or remaining effort.

## Local setup and preservation

Read the private operator index only as needed:
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/OPERATOR_HANDOFF.md`.
Do not print it. Private files are not available from Git alone.

| Resource | Resume handling |
| --- | --- |
| Replay DB | `/private/tmp/pantopus-home-gig-replay`, container `supabase_db_pantopus-home-gig-replay`, API 64521 / DB 64522; CLI `/opt/homebrew/bin/supabase`. Preserve DB and full ledger; never reset it to prepare a test. |
| REST | Preserve `supabase_rest_pantopus-home-gig-replay-preserved-create-recovery-20260911` and replacement. `/private/tmp/pantopus-home-create-rest-before-recovery.json` contains private configuration: never print it. |
| Browser | Primary Next dev 18080, last PID 42758, is retained. Isolated history Next 18081, last PID 59774/session 27247, has not run history UI acceptance. Inspect identity before reuse; no competing builds. Native runtime-r5/REST 18085 and data are retained after exact fixture cleanup. Backend history acceptance owns runtime-r2/REST 18086 and fixture port 18084 after 104 passing contracts. |
| Android | AVD `Pantopus_Home_Recurrence_Acceptance`, emulator-5556, stopped after accepted R03 reader candidate r2 with app/data retained. SDK `/Users/yingpengwang/Library/Android/sdk`; Java 17 `/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home`. No data clear/uninstall to simplify tests; inspect the lease before reuse. |
| iOS | Owned `F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8`, stopped after accepted R03 app9/driver10 follow-up, with userdata retained. Both native removal journeys and failed predecessors have verified durable copies. Derived `/private/tmp/pantopus-home-documents-derived`, preserved products; compiler cache is back internally after verified storage cleanup. Owner `EB5AD759-4699-481F-8A9F-0D650B074623` unrelated. |
| Phone | Existing Staging 1.0.0 (2), earlier source `139868c`. No update in this milestone. Never install loopback acceptance binaries on it. |
| Node | Backend acceptance uses Node 20 `/Users/yingpengwang/.nvm/versions/node/v20.20.0/bin/node`. Inspect package scripts/configuration before reuse. |

Private Android environment `/private/tmp/pantopus-home-create-android.env`
points to owned loopback/test services. Never print it or use it for a physical
release. Final command from `frontend/apps/android`:

```sh
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home ./gradlew -Ppantopus.envFile=/private/tmp/pantopus-home-create-android.env :app:ktlintCheck :app:detekt :app:assembleDebug :app:lintDebug :app:lintRelease :app:testDebugUnitTest :app:testReleaseUnitTest :app:assembleRelease
```

Member candidate r1 passes both full variants (4,581 checks/80 skips each),
both Lints, signing and optimized Release. The exact optimized APK codec probe
also passes, as does installed first use. Sender r11 remains
a separately accepted predecessor. Do not
run Gradle concurrently or repeat full acceptance merely to recover context. Run checks justified by the
next change. Owner-requested cache cleanup removed 52.7 GiB of regenerable cache
data and left 61.4 GiB free before resumed builds. The iOS cache is back on the
internal disk; no external drive is needed. Inspect space before heavy builds and
use APFS clones to retain accepted artifacts.

Current member driver: `scripts/android/home-member-onboarding-journey.py`.
Preserved sender driver: `scripts/android/home-invitation-sender-journey.py`.
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
