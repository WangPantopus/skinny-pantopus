# Pantopus project handoff

Updated September 12, 2026, after Android invitation acceptance. **This is the
current entry point.** Old accumulated checkpoints are preserved in
[handoff history](HANDOFF_HISTORY_THROUGH_2026-09-12.md); their old “next” actions
are superseded. Also read the [resume guide](SESSION_RESUME_2026-09-10.md) and
[80-row remaining-work inventory](REMAINING_WORK_2026-09-11.md).

## Where to resume

Continue in `/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/home-permission-boundaries`, associated with
[PR #32 — Enforce Home permission and record boundaries](https://github.com/WangPantopus/skinny-pantopus/pull/32).
Recipient invitation recovery is accepted on backend, browser, iOS and Android.
**Next: sender invitation management and truthful delivery, then complete
ordinary-member onboarding (H07/H08).** Do not restart completed address,
creation, joining, postal or recipient-decision milestones.

This is a deliberate handoff boundary: the Android feature, installed recovery
journey, full regression, optimized artifact and fixture cleanup are complete.
The outgoing session checks the pushed head's CI before handing off. Refresh that
head's live GitHub status on arrival using the resume guide. No partially running
acceptance fixture needs takeover.

### First concrete task

1. Reproduce sender creation through actual routes/SQL/UI: a saved invitation
   whose reply is lost, a successful create followed by failed member refresh,
   and unavailable notification delivery. Keep saved creation recoverable; a
   failed refresh must not imply creation failed.
2. Reconcile email and username labels with saved-versus-delivered proof. Browser
   email mode distinguishes unconfirmed delivery; username mode still says
   “Invitation sent.” Inspect native sender surfaces too.
3. Finish explicit resend and withdrawal with current authority, retained original
   intent, lost-reply/account-change recovery and truthful delivery. Preserve the
   accepted immutable recipient command and independently checked current access.
   Use owned synthetic fixtures; no live recipients or paid activation.
4. Complete ordinary-member onboarding and first useful action on web/iOS/Android.
   Address validation, membership, residency and ownership remain separate. Close
   H07/H08 only after their full exit criteria pass.
5. Repair older-client residency submission compatibility (R02), then follow the
   inventory: broader residency/ownership/leases, intelligence, records/settings/
   privacy, finance/mail, payments, social/accounts/providers, UI/accessibility,
   integration and launch.

Concrete starting code is in the resume guide. These sender observations are
read-only findings for the next scope; no sender repair is claimed here.

## What is done

**7 acceptance rows are fully closed (H01–H06 and R01); 73 are partial/open.**
Many open rows contain substantial accepted subjourneys. These counts are **not
percentages of app implementation, effort spent or effort left**. Do not call
this “8% complete / 92% unfinished.” No weighted app-wide completion percentage
or reliable release date is established.

| Accepted bounded work | Evidence and remaining limits |
| --- | --- |
| Current Home authority, identity and deletion eligibility | [Detail](home-detail-authority-2026-09-11.md), [lists](home-list-authority-2026-09-11.md), [field projection](home-detail-projection-2026-09-11.md), [native identity](home-native-list-first-use-2026-09-11.md). Actual HTTP/SDK/SQL and installed native acceptance; other IAM/mutation surfaces remain open. |
| Address, location and retained creation | [Native address](home-native-address-entry-2026-09-11.md), [location recovery](home-device-location-recovery-2026-09-11.md), [browser creation](home-browser-create-recovery-2026-09-11.md), [iOS](home-ios-create-recovery-2026-09-11.md), [Android](home-android-create-recovery-2026-09-11.md). Units, cancellation, lost replies and process recovery; address entry grants no access. |
| Joining, postal decisions, prepared review and private first use | [Submission](home-residency-submission-recovery-2026-09-11.md), [personal progress](home-personal-residency-progress-2026-09-11.md), [iOS postal](home-ios-postal-recovery-2026-09-12.md), [Android postal](home-android-postal-recovery-2026-09-12.md), [iOS review](home-ios-residency-review-2026-09-12.md), [Android review](home-android-residency-review-2026-09-12.md), [private first use](home-private-first-use-2026-09-12.md). Older-client partial-write compatibility and broader lifecycle remain open. |
| Recipient invitation decisions on all three clients | [Atomic backend](home-invitation-decision-recovery-2026-09-12.md), [browser](home-browser-invitation-decisions-2026-09-12.md), [iOS](home-ios-invitation-decisions-2026-09-12.md), [Android](home-android-invitation-decisions-2026-09-12.md). Encrypted originals, retry/check/cancel/acknowledge, account/lifecycle retirement, legacy login-link migration and fresh access before explicit Home entry. Sender management/delivery remains open. |
| Earlier tasks, private files, claim relationships, recurrence and task-to-Gig | [Task recovery](home-task-create-recovery-2026-09-10.md), [media](home-task-private-media-2026-09-10.md), [claim decisions](home-claim-relationship-decisions-2026-09-10.md), [recurrence](home-task-recurrence-engine-2026-09-10.md), [publication](home-task-gig-publication-2026-09-10.md). Native/browser reports are indexed in history; broader storage/entity and paid execution remain separate. |
| Home summaries and bill currency/history/recovery | [Dashboard](home-dashboard-current-summary-2026-09-11.md), [bills](home-bill-comparison-continuation-2026-09-11.md), [summary boundaries](home-summary-boundary-continuation-2026-09-11.md). Place finance, checklist/health lag and deeper provider acceptance remain open. |
| Beacon and platform returns | [Full journey](beacon-full-journey-2026-09-08.md), [preferences](beacon-push-preference-2026-09-08.md), [platform verification](notification-platform-verification-2026-09-09.md). Owner-confirmed physical iPhone foreground/background/closed-app return, block/mute/opt-outs and Android emulator FCM/returns pass. Physical Android and release-wide states remain open; do not repeat completed owner observations. |

### Latest Android acceptance

Final installed r5 passes five commands (two accepted, one declined, one
cancelled, one rejected), five cold account switches with logout replies held,
actual plaintext-to-encrypted arrival migration, lost reads/replies, expired
confirmation, wrong-account denial, access removal and retired replies. Every
original is acknowledged in native UI. A reproduced blank-screen navigation
race is fixed: invitation dismissal completes before explicit Home entry. The
accepted run reaches the matching actual dashboard and authority routes.

Both Debug and Release regressions pass **4,547 tests / 80 existing skips / zero
failures in 516 suites per variant**. Ktlint, Detekt, full Lint, privacy gates,
both signed APKs and the actual optimized APK's generated record adapters pass.
Native evidence uses controls, navigation and HTTP/SQL; protected capture stays
enabled, so zero-byte screenshot placeholders are not pixel-review evidence.
Other screen/text sizes, TalkBack, full dashboard providers and live delivery
remain open. The [Android report](home-android-invitation-decisions-2026-09-12.md)
describes driver continuations and preserved earlier attempts.

iOS predecessor `13bb557e72a3b6a02f6b50762509566c7a0d53be` is fully green in
[CI 34716984061](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34716984061).
Its installed r7 acceptance, Keychain migration and **4,383 passed / 168 skipped**
remain valid within the iOS report's limits. Browser regression: **1,193 passed**.
Backend invitation regression: **5,170 passed / 16 skipped**, every value in 366
populated tables preserved, zero function lint issues. Predecessor checks do not
replace current pushed-head CI.

## Git and migration gates

Freshly fetched master: `6a1013784db69bf339535a2f4b33b328f2bbf40c`.
PR #32 is an open mergeable draft; its complete Home scope is unfinished.
[PR #34 — Make paid gig acceptance recoverable and bind assignment to payment proof](https://github.com/WangPantopus/skinny-pantopus/pull/34)
is an open conflicting draft at `e9ef2decbb7ec435589bb3b92639041cfc4618a6`, with
all required head checks passing (seeder skipped). Its tips/payment scope is
unfinished. Preserve `/private/tmp/pantopus-staging-paid-gig`, branch
`codex/staging-paid-gig`, its unwired tip draft and completed paid source work;
source/build checkpoints are not full live/native payment acceptance.

SQL inventory: **44 Home / 21 paid / 53 combined versions**, including 12
byte-identical shared versions and zero collisions. Invitation command migration
`20260912020000` is additive source; no permanent adoption. Android adds no
migration. Reserved ledger version `20260910220000` must retain every original
row/column, not merely its version number. Reserved tip migration
`20260910190000_paid_gig_tip_receipts.sql` is not implemented. Combined dependency
reconciliation, populated replay and per-environment ledger adoption remain open.

The owner authorizes branches, commits, pushes, PRs and merges of completed
scopes with passing checks and reconciled migrations. Neither draft meets those
scope conditions. Do not bypass protections or enable deployment to merge.
Verify final PR checks and merged-master checks independently.

## Preserved work and runtime state

| Surface | Current or explicitly historical state |
| --- | --- |
| Owner checkout | `/Users/yingpengwang/skinny-pantopus`, master `939878b4f6cd1c3084b1d2811cb98270ab38a440`, intentionally behind origin. Modified `docs/PROJECT_HANDOFF.md` and untracked Place concept HTML/design Markdown remain untouched. No reset/clean/stash wholesale or incidental commits. |
| Owned Android | AVD `Pantopus_Home_Recurrence_Acceptance`, emulator-5556, stopped after r5 artifact checks, installed app/userdata retained. Both fixtures cleaned and all final originals acknowledged. |
| Owned iOS | Simulator `F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8`, Pantopus Bill Acceptance iPhone 17 / iOS 26.5, stopped with userdata and accepted signed r7 products retained. All four fixtures cleaned. |
| Owner devices | Physical iPhone remains Staging 1.0.0 (2), earlier source `139868c`; no update in this milestone. Owner simulator `EB5AD759-4699-481F-8A9F-0D650B074623` is unrelated and preserved. Never install loopback acceptance builds on the physical phone. |
| Owned replay DB | Project `/private/tmp/pantopus-home-gig-replay`, DB `supabase_db_pantopus-home-gig-replay`, API 64521 / DB 64522, retained. Both Android fixture cleanups restore complete role rows, full ledger and exact function definitions/owners/ACLs/configuration/provenance. |
| Retained REST/browser | Preserve REST container `supabase_rest_pantopus-home-gig-replay-preserved-create-recovery-20260911` and its replacement. Owned Next dev 18080 retained; inspect before reuse and do not run a competing `.next` build. Invitation fixture 18084 stopped. |
| Staging deployment — historical, not reverified here | API/worker last recorded at `65d2cc2d9ab4857e044325315f0023a6d8f4bf54`, `https://staging-api.pantopus.com`, existing Oregon EC2; API loopback 18001 behind nginx, worker private. Source is newer. Original production container and all hosted databases preserved. |
| Hosted release — unfinished | Last recorded staging/production deployment and migration switches false; re-read before merge/release. Production schema/ledger, external files, Auth/Storage, DNS/cutover and rollback need separate verification. Local replay is not hosted adoption. |

No merge, deployment, permanent adoption, paid activation, app-data clear or
physical-device change occurred in this milestone. Keep other worktrees, even
prunable metadata, and accepted build products intact. Disk was about 5 GiB free
near completion; inspect before heavy builds and use APFS clones for retained
products. Do not clean unrelated artifacts to make room.

## Evidence and operating rules

Private latest evidence:
`/private/tmp/pantopus-home-android-invitation-decisions-r1/` and
`/private/tmp/pantopus-home-ios-invitation-decisions-r1/`. Source/build/installed
bindings, actual UI/HTTP/SQL, full regressions, signing, optimized codec proof and
exact cleanup records are retained. Git contains sanitized reports and scripts,
not raw capabilities, account records or operator logs.

Private durable operator index:
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/OPERATOR_HANDOFF.md`.
It is not in a clone. A new machine needs separately authorized private transfer
and access; temporary evidence cannot be assumed to survive. Read privately only
as needed. Never print or commit credentials, raw invitation/device tokens,
database archives or private environment/operator files. Inspect scripts before
running: older operator scripts can send or mutate on execution.

Preserve Home, Pulse and Beacon, address-free discovery/following, progressive
setup and useful private Homes without neighbors. Address preview, household
admission, residency and ownership are distinct. Preserve authorized property/
ATTOM, weather, AQI/alerts, sunrise/daylight, environmental and civic/election
features with truthful provider/geography/licensing limits. Saved data is not
delivered mail, reminders or money. The [design collection](pantopus-product-design-index-2026-09-09.md)
and fictional Place prototypes remain preserved proposals, not automatically
missing v1 work or instructions to rewrite the product during recovery work.

Keep paid services, subscriptions and provider activation in **one final launch
bundle**. Use existing/free capacity for independent feature work. Source merge
authorization does not authorize new spending or production cutover. Complete
concrete release/rollback work before its final review.

After each milestone, replace current status/next action, update inventory rows
and add a dated report. Keep history in reports or historical snapshots instead
of another contradictory “current” checkpoint. Prioritize actual UI, records,
failures and recovery over increasing unit coverage.
