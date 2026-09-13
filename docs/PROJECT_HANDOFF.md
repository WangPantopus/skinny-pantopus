# Pantopus project handoff

Updated September 12, 2026, after the sender invitation milestone. **This is the
current entry point.** Old accumulated checkpoints are preserved in
[handoff history](HANDOFF_HISTORY_THROUGH_2026-09-12.md); their old “next” actions
are superseded. Also read the [resume guide](SESSION_RESUME_2026-09-10.md) and
[80-row remaining-work inventory](REMAINING_WORK_2026-09-11.md).

## Where to resume

Continue in `/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/home-permission-boundaries`, associated with
[PR #32 — Enforce Home permission and record boundaries](https://github.com/WangPantopus/skinny-pantopus/pull/32).
**Next: ordinary-member onboarding and household-private first use (H07/H08).**
First refresh local/remote Git, both PRs and exact-head CI as the resume guide
specifies. The PR and private operator index carry the exact source/CI binding;
prior green runs or native candidate numbers are not substitutes for that check.

Recipient invitation recovery remains accepted. Sender creation, explicit resend
and withdrawal now pass actual backend/browser/iOS/Android acceptance. Saved
results survive refresh failure; protected originals recover across lost replies,
restart and account changes. Delivery proof stays separate from saved state and
inbox/push arrival. Current authority is required; withdrawal preserves legitimate
membership, and resend preserves old links and prepared recipient terms.

Backend r6 passes 25 actual HTTP/SDK/SQL originals and preserves every existing
row value in 366 populated tables, with zero PL/pgSQL lint issues. Browser r9
passes nine commands and 1,211 regression tests. Each native platform passes
eight commands (five completed, one cancelled, two rejected), with every original
acknowledged, and four matching recipient reviews without commands. Pending rows
now show complete recipient identities above their actions.

Final iOS source-r19 adds installed held-success/newer-503 ordering and failure,
tab and retry recovery; its full regression passes 4,398 checks / 168 skips.
Final Android r11 passes three installed held-success cases against newer 503,
authority denial and a changed successful list; both full variants pass 4,577
checks / 80 skips each. Older replies cannot restore stale rows or authority.
The command/layout predecessors remain preserved because this final change only
repairs member readers. Both platforms' final source/product/installed bindings,
quality gates, signing and Android's optimized codec runtime pass. Native list
follow-ups issue zero sender commands. All fixtures are exactly cleaned and the
owned devices are stopped with userdata retained.

These are bounded local results, not hosted deployment, live delivery, complete
onboarding or app-wide acceptance. See the [backend report](home-invitation-sender-recovery-2026-09-12.md),
[browser report](home-browser-invitation-sender-2026-09-12.md),
[iOS report](home-ios-invitation-sender-2026-09-12.md),
[Android report](home-android-invitation-sender-2026-09-12.md) and
[contract](home-invitation-sender-contract-2026-09-12.md) for source distinctions,
failed/limited attempts and exact verification limits. Do not restart completed
address, creation, joining, postal or recipient-decision milestones.

### Current next action

1. Reproduce ordinary-member sender → recipient → current My Homes identity →
   matching Home → useful household-private Task on web/iOS/Android, including
   denied/removed access. First capture actual presets/defaults and use the
   shipped sender forms: web defaults to member/tenant, native to member. The
   recorded baseline has no presets and member defaults grant only `home.view`.
   Reproduce task availability before choosing a deliberate permission-policy
   repair; never add fixture grants to manufacture onboarding success. Keep
   residency and ownership separate. H07/H08 close only on their full exit
   criteria; synthetic existing-account login does not close new-account/provider
   onboarding. The resume guide records current task-policy consequences.
2. Repair R02 older-client `POST /:id/claim` partial writes through shared atomic
   policy, preserving its legacy response shape and separate postal intent. Old
   clients have no protected request UUID/address snapshot; do not fabricate one
   or claim the new-client reviewed-address protocol is present.
3. Follow the full ordered inventory through feature/UI/payment/provider,
   integration and launch work. Keep paid activation in one final bundle.

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
| Recipient invitation decisions on all three clients | [Atomic backend](home-invitation-decision-recovery-2026-09-12.md), [browser](home-browser-invitation-decisions-2026-09-12.md), [iOS](home-ios-invitation-decisions-2026-09-12.md), [Android](home-android-invitation-decisions-2026-09-12.md). Encrypted originals, retry/check/cancel/acknowledge, account/lifecycle retirement, legacy login-link migration and fresh access before explicit Home entry. Ordinary-member onboarding remains H07/H08. |
| Sender invitation recovery on all three clients | [Backend](home-invitation-sender-recovery-2026-09-12.md), [browser](home-browser-invitation-sender-2026-09-12.md), [iOS](home-ios-invitation-sender-2026-09-12.md), [Android](home-android-invitation-sender-2026-09-12.md). Protected creation/resend/withdrawal, truthful delivery, current sharing, distinct recipient identities and bounded member-list ordering. Live provider delivery, broader Members/Security and complete onboarding remain separate. |
| Earlier tasks, private files, claim relationships, recurrence and task-to-Gig | [Task recovery](home-task-create-recovery-2026-09-10.md), [media](home-task-private-media-2026-09-10.md), [claim decisions](home-claim-relationship-decisions-2026-09-10.md), [recurrence](home-task-recurrence-engine-2026-09-10.md), [publication](home-task-gig-publication-2026-09-10.md). Native/browser reports are indexed in history; broader storage/entity and paid execution remain separate. |
| Home summaries and bill currency/history/recovery | [Dashboard](home-dashboard-current-summary-2026-09-11.md), [bills](home-bill-comparison-continuation-2026-09-11.md), [summary boundaries](home-summary-boundary-continuation-2026-09-11.md). Place finance, checklist/health lag and deeper provider acceptance remain open. |
| Beacon and platform returns | [Full journey](beacon-full-journey-2026-09-08.md), [preferences](beacon-push-preference-2026-09-08.md), [platform verification](notification-platform-verification-2026-09-09.md). Owner-confirmed physical iPhone foreground/background/closed-app return, block/mute/opt-outs and Android emulator FCM/returns pass. Physical Android and release-wide states remain open; do not repeat completed owner observations. |

### Preserved recipient acceptance — historical checkpoint

Recipient Android r5 passed five commands, five cold account switches, encrypted
legacy-arrival migration and matching Home entry after the navigation-race repair.
iOS r7, browser and backend recipient acceptance remain preserved within their
linked reports. Their earlier test counts and build numbers are historical;
sender source/build/installed bindings are separate. Do not repeat accepted
recipient, address, joining or postal journeys merely to restore session context.
Neither historical local evidence nor an earlier green CI run replaces checks
for the actual pushed head.

## Git and migration gates

Freshly fetched master: `6a1013784db69bf339535a2f4b33b328f2bbf40c`.
PR #32 is an open mergeable draft; its complete Home scope is unfinished.
[PR #34 — Make paid gig acceptance recoverable and bind assignment to payment proof](https://github.com/WangPantopus/skinny-pantopus/pull/34)
is an open conflicting draft at `e9ef2decbb7ec435589bb3b92639041cfc4618a6`, with
all required head checks passing (seeder skipped). Its tips/payment scope is
unfinished. Preserve `/private/tmp/pantopus-staging-paid-gig`, branch
`codex/staging-paid-gig`, its unwired tip draft and completed paid source work;
source/build checkpoints are not full live/native payment acceptance.

SQL inventory: **45 Home / 21 paid / 54 combined versions**, including 12
byte-identical shared versions and zero collisions. Invitation command migration
`20260912020000` and sender migration `20260912040000` are additive source; no permanent adoption. Android adds no
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
| Owned Android | AVD `Pantopus_Home_Recurrence_Acceptance`, emulator-5556, stopped after final sender r11 product/optimized checks, with app/userdata retained. All three sender fixtures cleaned; all eight command originals acknowledged on the accepted r10 predecessor. |
| Owned iOS | Simulator `F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8`, Pantopus Bill Acceptance iPhone 17 / iOS 26.5, stopped with userdata and final sender signed r19 products retained. All four sender fixtures cleaned; earlier recipient/command/layout products and evidence preserved. |
| Owner devices | Physical iPhone remains Staging 1.0.0 (2), earlier source `139868c`; no update in this milestone. Owner simulator `EB5AD759-4699-481F-8A9F-0D650B074623` is unrelated and preserved. Never install loopback acceptance builds on the physical phone. |
| Owned replay DB | Project `/private/tmp/pantopus-home-gig-replay`, DB `supabase_db_pantopus-home-gig-replay`, API 64521 / DB 64522, retained. Sender fixture cleanups restore complete role rows, full ledger and exact function definitions/owners/ACLs/configuration/provenance. Both native list-ordering follow-ups are exactly cleaned; preserve the same exclusive ownership protocol for future fixtures. |
| Retained REST/browser | Preserve REST container `supabase_rest_pantopus-home-gig-replay-preserved-create-recovery-20260911` and its replacement. Owned Next dev 18080 retained; inspect before reuse and do not run a competing `.next` build. Invitation fixture 18084 is stopped; inspect before reuse. |
| Staging deployment — historical, not reverified here | API/worker last recorded at `65d2cc2d9ab4857e044325315f0023a6d8f4bf54`, `https://staging-api.pantopus.com`, existing Oregon EC2; API loopback 18001 behind nginx, worker private. Source is newer. Original production container and all hosted databases preserved. |
| Hosted release — unfinished | Last recorded staging/production deployment and migration switches false; re-read before merge/release. Production schema/ledger, external files, Auth/Storage, DNS/cutover and rollback need separate verification. Local replay is not hosted adoption. |

No merge, deployment, permanent adoption, paid activation, app-data clear or
physical-device change occurred in this milestone. Keep other worktrees, even
prunable metadata, and accepted build products intact. At the owner's storage-cleanup request, older regenerable Gradle cache outputs
were removed while dependencies, projects, databases, device data and acceptance
artifacts were preserved. The temporarily relocated iOS compiler cache has been
returned to its original internal `Build/Intermediates.noindex` directory after
verifying all 35,635 entries/content/modes/mtimes. Its verified external duplicate
was removed; the external drive is no longer required for builds. Cleanup records
are private at `/private/tmp/pantopus-storage-cleanup-20260912/`. Inspect free
space before heavy builds and retain accepted products with APFS clones.

## Evidence and operating rules

Private sender evidence:
`/private/tmp/pantopus-home-sender-invitations-r1/`,
`/private/tmp/pantopus-home-ios-invitation-sender-r1/` and
`/private/tmp/pantopus-home-android-sender-r1/`. Source/build/installed bindings,
actual UI/HTTP/SQL, regressions, signing, optimized codec proof and exact cleanup
records are retained. Verified durable copies and accepted product clones are
indexed under
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/home-invitation-handoff-20260912/sender-invitations-20260912/`.
Earlier recipient roots and products remain preserved. Git contains sanitized
reports and scripts, not raw capabilities, account records or operator logs.

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
