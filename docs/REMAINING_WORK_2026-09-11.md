# Pantopus remaining work — September 11, 2026

This is the consolidated known backlog, reconciled against the newest Home and
payment checkpoints. Older reports retain superseded findings; their unchecked
boxes do not automatically reopen completed work. This inventory includes both
confirmed defects and required acceptance that has not yet been performed. It
cannot promise there are no undiscovered defects in the remaining audit surface.

Latest local Home milestone: [iPhone retained Home creation](home-ios-create-recovery-2026-09-11.md),
following the atomic creation backend and native location/address/identity work.
Installed original-command restart/cancel and atomic optional-setup recovery pass;
final iPhone regression passes 4,369 checks (168 skips). The [unit-label repair](home-list-unit-identity-2026-09-11.md) now passes actual
API/browser/iPhone acceptance; Android labels and creation remain in progress. Android/browser
retained commands, existing-Home join, primary eligibility and complete private
first use remain open. Backend predecessor `c0d474989` has all CI checks green in
[run 34663479661](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34663479661).
Verify the next pushed head through [PR #32 checks](https://github.com/WangPantopus/skinny-pantopus/pull/32/checks).
#32 remains draft; #34 remains draft/conflicted at `e9ef2decb`, with an unwired
durable-tip draft. Earlier-head checks do not certify a final head.

**Legend:** **Fix** = reproduced defect or identified unfinished implementation;
**Verify** = execute/reconcile the actual workflow, not an assertion that it is
broken; **Integrate** = source/schema/version gate; **Launch** = release prerequisite.
There are 80 tracked items below, with H01–H06 locally verified and 74 remaining.
No task is weighted equally, so the number of unchecked entries is not a percent
of engineering effort or a reliable release date. Unit-test coverage is not an
exit criterion. Actual records, UI states, retries and current access are.

## 1. Home identity and current access — active work

- [x] H01 **Implemented and locally verified:** Detail/property-detail current authority and held-result retirement pass real SDK/HTTP/SQL acceptance. See [the bounded repair](home-detail-authority-2026-09-11.md); final-head CI remains G05. H02/H06 are also locally verified; H03/H04 projections are now locally verified; H05 native identity is now locally verified; H07/H08 remain partial.
- [x] H02 **Implemented and locally verified:** All three lists share current authority, safe errors and held-result retirement. Real SDK/SQL/HTTP authority and recovery matrix passes; see [the list repair](home-list-authority-2026-09-11.md). Final-head CI remains G05.
- [x] H03 **Implemented and locally verified:** Detail/list/occupants use explicit validated projections and safe retryable errors, with real SDK/SQL/HTTP and browser property recovery. See [the read repair and limits](home-detail-projection-2026-09-11.md); broader UI/settings/vendor checks remain D05/D07/I05.
- [x] H04 **Implemented and locally verified:** Detail/property/occupants use per-field grants, safe household references and a verified current roster. Managed history and peer ownership remain separately gated. Actual SDK/SQL/HTTP acceptance passes; see [the projection repair](home-detail-projection-2026-09-11.md). Native first use remains H08; other mutation/IAM surfaces remain D01/D05/D07.
- [x] H05 **Implemented and locally verified:** Both native lists/dashboard/profile distinguish saved Home, private setup, effective role, ownership and residency. Installed SDK/SQL identity, applicant navigation, recovery and current-access retirement pass; see [the native report](home-native-list-first-use-2026-09-11.md). Real onboarding/verification and broader UI remain H07/H08/R01/R02/U01/U02.
- [x] H06 **Implemented and locally verified:** Lists use guarded deletion eligibility and actual occupancy or null, including verified owners without occupancy, private creators, explicit denies and minor limits. Browser controls/first use pass against real list/SQL responses. Native UI reconciliation remains H05/H08; see [the list report](home-list-authority-2026-09-11.md).
- [ ] H07 **Verify (partial):** Ordinary invitation admission and missing `home.view` defaults pass actual HTTP/SQL and populated upgrade with explicit denies preserved; see [the member-default repair](home-member-view-defaults-2026-09-11.md). Native search/manual entry, canonical correction, unit editing, partial discard and failure/background recovery now pass both installed platforms; see [address entry](home-native-address-entry-2026-09-11.md). Device location denial/Settings/grant/revocation also passes both installed platforms; see [location recovery](home-device-location-recovery-2026-09-11.md). iPhone original-command creation/restart/cancel and atomic optional setup now pass [installed acceptance](home-ios-create-recovery-2026-09-11.md). Finish Android/browser retained creation and real existing-Home join, then complete onboarding. Address validation grants no membership.
- [ ] H08 **Verify (partial):** Browser and both installed native owner/applicant/private setup lists, distinct destinations, unavailable/malformed retry and private list → real Tasks pass through actual SDK/SQL. Finish real onboarding, ordinary-member UI and completed verification flows. See [the native limits](home-native-list-first-use-2026-09-11.md) and [onboarding work](home-onboarding-recovery-2026-09-11.md).

## 2. Residency, ownership and leases

- [ ] R01 **Fix/Verify:** Finish installed iOS and Android prepared residency review, protected original-command/receipt storage, approve/deny, lost replies, app restart and current-access recovery. Backend and both browser review entries already have acceptance.
- [ ] R02 **Fix:** Make residency claim submission, cold-start admission and rejected resubmission transactional and recoverable; preserve role, age, access dates and ownership restrictions.
- [ ] R03 **Verify:** Review history, needs-more-information, resubmission after a decision, later removal, expired authority and conflicting reviewers across actual native flows.
- [ ] R04 **Verify:** Complete ownership transfer, challenge/dispute, recovery and related household lifecycle paths beyond the already completed ordinary claim review/withdrawal and relationship-decision milestones.
- [ ] R05 **Verify:** Lease creation/change/end, renter/landlord/manager authority and access expiry must remain coherent with ownership and household admission.
- [ ] R06 **Verify:** Residency passes/letters are separate from household admission: verify issue, view, revoke and public-verification access independently.

## 3. Home intelligence, checklist and dates

- [ ] I01 **Fix:** Reproduce and repair health-score lag after checklist generation and uncertain-save recovery; coordinate generation, cache invalidation and card reload. Reviewed iOS screens show a 30-point/no-checklist snapshot beside populated checklist data.
- [ ] I02 **Verify:** Finish server validation for nested checklist rows, metadata, generation races, carryover/history, pagination and historical states beyond completed native malformed-card rejection.
- [ ] I03 **Fix/Verify:** Complete seasonal checklist Hire → correct Gig → returned checklist linkage and durable original-intent recovery, without treating a callback or missing reply as completion.
- [ ] I04 **Fix/Verify:** Use the Home's local calendar/date rules for bill due dates, daily dashboard boundaries, recurrence and daylight-saving transitions; compare actual displayed dates with saved records.
- [ ] I05 **Verify:** Property details, estimates, sources, stale cache, provider failure, absent data and wrong-property responses need deeper provider/data acceptance. “Unavailable” must not falsely imply failed address verification.
- [ ] I06 **Verify:** Preserve and accept supported weather, air quality, alerts, sunrise/sunset/daylight, environmental and civic/election sections, including geography, unavailable states and provider restrictions.
- [ ] I07 **Verify:** Current server changes must invalidate mounted views and cached values appropriately, including cases without a foreground/navigation event; verify timeline labels and pagination.

## 4. Home records, settings, sharing and privacy

- [ ] D01 **Verify:** Finish explicit write permissions, visibility, receipts and actual create/edit/delete recovery for issues, packages and remaining Home entities. Their repaired overview/read routes do not certify every mutation.
- [ ] D02 **Fix:** Resolve browser embedded issue/bill/package media being discarded and silent write errors; verify cancellation and unknown saves in the actual panels.
- [ ] D03 **Fix:** Reconcile standalone bill amount-unit handling and package `in_transit` input with the real server contract.
- [ ] D04 **Verify:** Reconcile HomeMaintenanceLog versus HomeIssue behavior and other competing readers/writers so records have one truthful lifecycle.
- [ ] D05 **Fix/Verify:** Finish general HomeSettingsTab error recovery, atomic saves, retained original intent, privacy settings, concurrent edits and explicit clearing of optional fields. Saving notification preferences alone does not establish delivery.
- [ ] D06 **Fix:** HomePrivacyService must not fall back to permissive address precision when its read fails; verify every exposed privacy control against actual consumers.
- [ ] D07 **Fix/Verify:** Reconcile DocsCard Share with the current sharing contract; finish ShareCenter, Members/Security and provider panels' error-versus-empty behavior and current access.
- [ ] D08 **Verify:** Complete external-share expiry/revocation, exact-resource scope, document/evidence retirement, account changes and hosted storage lifecycle acceptance beyond already verified local/native document milestones.
- [ ] D09 **Fix/Verify:** Reject malformed success records instead of optimistic fake success or false empty lists; pets' missing-table fallback remains a known example.
- [ ] D10 **Verify:** Household leave/delete and linked-resource cleanup must preserve history, files, balances and live obligations through ownership/lease changes.

## 5. Bills and Place finance

- [ ] F01 **Verify:** Place overview and financial-detail UI on web/iOS/Android: cents, fractions, currencies, matching periods and consistent totals. Completed Home bill cards do not certify Place screens.
- [ ] F02 **Verify:** Place financial failures, source absence and access retirement must remain distinct from zero/no bills; review Home/Place privacy together.
- [ ] F03 **Verify:** Broader bill creation, edits, deletion, splits, malformed input, currency changes and permission-limited actions need actual end-to-end acceptance.
- [ ] F04 **Verify:** Contributor eligibility, withdrawal/deletion, cohort freshness and scale/retention must remain correct with the final deployed bill worker and reader versions.
- [ ] F05 **Integrate:** Bind the final explicit legacy/current bill format to backend, worker and native versions; deploy the required schema before readers and retire the old worker schedule safely.

## 6. Mail, guests and other reachable Home features

- [ ] M01 **Verify:** Private Mail's separate routes must enforce recipient/attention/privacy/trust restrictions, expired or provisional membership, errors and exact-content returns independently of dashboard badge counts.
- [ ] M02 **Verify:** Guest-pass issue/redeem/revoke, time windows and view limits must work in the actual guest flow; an active dashboard count is not proof of redeemability.
- [ ] M03 **Verify:** Large households and long histories need pagination, ordering and performance checks across members, activity, mail, records and shared resources.
- [ ] M04 **Verify:** Reconcile reachable mailbox conversions, translations, signing, physical-mail and neighbor-request actions with what they actually perform. Finish or accurately constrain any remaining placeholder promise; historical audits need fresh reproduction.

## 7. Payments and paid gigs — PR #34

- [ ] P01 **Fix:** Implement durable tips: atomically reserve exact original request/payment/payer/worker/cents/currency/terms before provider creation; the current contract/helper draft is not wired.
- [ ] P02 **Fix:** Add tip migration/service/routes and exact provider proof; resolve unknown creation, check/resume/cancel, historical unknown tips and maximum-successful-tip concurrency without duplicate charges.
- [ ] P03 **Fix:** Implement retained tip commands and truthful SDK/receipt handling in web/iOS/Android, with account/session changes and app restart recovery.
- [ ] P04 **Fix/Verify:** Finish started-work, no-show, cancellation-fee and completion/reopen policies, immutable displayed terms and exact fee execution. Existing zero-fee unstarted-stop recovery is a bounded completed source milestone.
- [ ] P05 **Fix/Verify:** Settle cancellation-fee residuals under an explicit policy; do not silently treat held money as released earnings or waive fees.
- [ ] P06 **Fix/Verify:** Finish disputes and dispute-loss accounting, historical Connect transfers/reversals, payout onboarding/withdrawal and operational debt recovery, including contradictory legacy proof.
- [ ] P07 **Fix/Verify:** Provide support/reconciliation paths for retained unknown financial operations and durable attention; review legacy tip/booking notices separately from the completed paid-gig wallet outbox.
- [ ] P08 **Verify:** Run fresh installed/native and browser sandbox journeys: chosen bid → authorization → assignment → worker start/completion → owner capture → wallet release/refund → exact notification return, including all loss/retry/denial paths.
- [ ] P09 **Verify:** Exercise assigned authorization, refunds and cancel/reopen/release/close through installed clients and actual provider state. Their source/build checkpoints do not replace this acceptance.
- [ ] P10 **Verify:** Payment worker retries, retained operations, financial records and notification delivery need final workload/capacity/retention checks and safe fixture cleanup.

## 8. Pulse, Beacon, notifications and social safety

- [ ] N01 **Verify:** Close remaining release-build notification states across platforms: exact post/chat/task destinations, foreground/background/cold start, permission denial, login continuation, token changes, account switching and unread state. Preserve completed evidence rather than rerunning it blindly.
- [ ] N02 **Verify:** Physical Android notification/device acceptance remains unverified; emulator delivery is not hardware acceptance. No physical Android is currently available in the recorded setup.
- [ ] N03 **Verify:** Release-candidate Pulse and Beacon journeys must preserve address-free discovery, explicit following, eligible posting, conversation/reply return, mute/unfollow and private/public identity boundaries.
- [ ] N04 **Verify:** Reporting, blocking, moderation and old/shared/deep-link access need a usable end-to-end safety workflow under the final release flags.
- [ ] N05 **Verify:** Any promised calendar/reminder delivery must arrive once, open the correct authorized destination and honor preferences; saved schedule data is separate evidence.

## 9. Accounts, providers and storage

- [ ] A01 **Verify:** Remaining real signup, verification/recovery email and OAuth callbacks, including Apple/Google, cancellation, provider failure and return to the original authorized destination.
- [ ] A02 **Verify:** Real onboarding/account session expiry, revocation, logout/account switching and local protected-data retirement across provider and client combinations not covered by controlled local login.
- [ ] A03 **Verify:** Hosted media/document upload, preview, replacement, deletion, permissions, quotas and file cleanup under actual Auth/Storage configuration.
- [ ] A04 **Verify/Launch:** Remaining address/provider coverage, including activated Smarty scenarios, geography/unit disambiguation and legitimate unavailable responses. Prepare what is possible on existing/free capacity first.
- [ ] A05 **Verify:** Reconcile all reachable marketplace, subscription, booking, wallet, mail, profile, search and adjacent actions against the current release inventory. Old static audits are discovery inputs, not proof that each item is still broken.

## 10. UI, accessibility and operating conditions

- [ ] U01 **Fix/Verify:** The discovered indistinguishable unit cards are repaired and accepted on API/browser/iPhone; finish Android unit labels with creation acceptance. See [the repair](home-list-unit-identity-2026-09-11.md). Resolve retained narrow-screen member/badge and floating-chat overlap, property-verification wording and long native activity identities; review finished screens, not loading placeholders.
- [ ] U02 **Verify:** Complete small screens, large text/Dynamic Type, zoom, keyboard/focus, screen readers, contrast and dark-mode checks across reachable flows.
- [ ] U03 **Verify:** Exercise loading, empty, partial, unavailable, offline, slow response, retry, cancellation, back navigation, duplicate taps and process death with actual UI and persisted state.
- [ ] U04 **Verify:** Validate long-lived sessions, background/foreground transitions and concurrent device/account changes beyond the bounded Home tests.
- [ ] U05 **Verify:** Run the final release-build feature/screen/action inventory on web, iOS and Android; resolve or accurately constrain every unfinished reachable action and preserve existing entitlements.

## 11. Integration and migration dependencies

- [ ] G01 **Integrate:** Complete #32's Home scope and #34's payment scope before marking either ready. Update their stale PR descriptions to match the final work.
- [ ] G02 **Integrate:** Resolve #34's actual master conflicts without losing either branch's work; preserve all unrelated local changes.
- [ ] G03 **Integrate:** Reconcile 40 Home / 21 payment / 49 distinct combined migration versions and dependency order. The reserved tip migration is not yet implemented and will change the final set.
- [ ] G04 **Integrate:** Replay the combined final schema, permissions/RPC contracts and populated upgrades; preserve old values, files and financial obligations and reconcile cross-branch deletion dependencies.
- [ ] G05 **Integrate:** Pass required CI on each final PR head, review the integrated result and verify merged-master checks. Earlier green or cancelled runs are not substitutes.

## 12. Production upgrade and operations

- [ ] O01 **Launch:** Complete each environment's migration-ledger adoption and hosted upgrade plan without rewriting historical ledgers or treating a local replay as production proof.
- [ ] O02 **Launch:** Rehearse backup/restore and independently recover external files; database archives alone do not contain uploaded file bytes.
- [ ] O03 **Launch:** Verify hosted Auth, Storage, secrets/configuration, least-privilege permissions, queues/workers and provider/webhook configuration for the exact candidate.
- [ ] O04 **Launch:** Bind backend/web/native builds, schema, flags, supported geography and bill/payment worker versions in a release manifest; reconcile deployment drift.
- [ ] O05 **Launch:** Prepare and validate deployment/rollback, production routing/DNS, certificates, observability, incident/support procedures and post-deploy checks. Production cutover needs its concrete review/authorization.
- [ ] O06 **Launch:** Complete workload/capacity/retention checks, store/distribution builds, signing, production APNs/FCM and platform release requirements.

## 13. Final paid bundle and pilot

- [ ] L01 **Launch:** Assemble all needed paid services/subscriptions/provider activation and costs into one final launch-preparation bundle. Do not activate services piecemeal during feature work.
- [ ] L02 **Launch:** Complete the paid/provider scenarios that depend on that approved bundle and run the final build-specific Home/Pulse/Beacon acceptance matrix.
- [ ] L03 **Launch:** Perform the approved cutover, verify real post-deployment behavior and preserve rollback capability.
- [ ] L04 **Launch:** Run a small consenting pilot, fix observed usability/reliability problems, and measure real first value/voluntary returns without collecting unnecessary private content. Engineering checks cannot establish product-market fit.

## Completed work deliberately excluded from the open count

The latest malformed-card/receipt and overdue-health milestones; current Home
summary authority and held-response retirement; both native controlled A→B→A
account journeys; Home bill currency/history/recovery; completed browser residency
review; completed ordinary claim/relationship recovery; task creation, private
attachments, recurrence and task-to-Gig milestones; native saved-card acceptance;
and owner-confirmed physical iPhone Beacon preferences are not being reopened as
blanket tasks. Remaining integration, real-provider and broader scenario limits
above are distinct. The paid branch has completed source milestones for acceptance,
refunds, assigned authorization, wallet settlement/delivery and unstarted stops;
those are not being mislabeled as wholly unimplemented.

The nationwide/Place redesign collection is preserved product-design work, with
its own scope decisions; it is not silently counted as a missing v1 implementation.

## Sources and continuation

- [Project handoff](PROJECT_HANDOFF.md) and [session checkpoint](SESSION_RESUME_2026-09-10.md).
- [Latest Home dashboard and intelligence evidence](home-dashboard-current-summary-2026-09-11.md).
- [Home summary boundaries](home-summary-boundary-continuation-2026-09-11.md), [bill comparison](home-bill-comparison-continuation-2026-09-11.md), [residency continuation](home-residency-review-continuation-2026-09-10.md).
- [Payment branch handoff](https://github.com/WangPantopus/skinny-pantopus/blob/codex/staging-paid-gig/docs/PROJECT_HANDOFF.md) and [durable-tip draft](https://github.com/WangPantopus/skinny-pantopus/blob/codex/staging-paid-gig/docs/paid-gig-tip-draft-checkpoint-2026-09-10.md).
- Private real SDK/SQL identity baseline: `/private/tmp/pantopus-home-identity-baseline-r1.log` (exact fixture cleanup passed). No credentials or raw operator logs are committed.

Next implementation: verify the newest pushed head’s CI, then finish native Home list/verification and real onboarding/residency. Paused
`943b08cc4` now has all checks passing. Keep this
inventory updated as evidence closes or adds individual items.
