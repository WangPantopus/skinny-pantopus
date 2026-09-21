# Pantopus remaining work

Follow the user's [verification-first rules](../AGENTS.md) and the
[PR reconciliation and screen/workflow inventory map](VERIFICATION_FIRST_2026-09-13.md).
Preserve working code and all existing screen designs. Every Fix or Implement
instruction below requires checking existing implementations and current evidence;
it is not permission to rebuild a screen or add a competing schema. The original
improvement requirements remain in scope.

The user approved [three workstreams](workstreams/README.md) on September 15.
Shared instructions and status snapshots are published to master through a
separate documentation branch; the live hub is in the neutral coordination
worktree. This document remains the authoritative backlog. First bounded
milestones: P04 Start Work (Stream 1), M02 browser guest passes (Stream 2), and
N04 personal blocking/direct messages (Stream 3). Discovery closes no rows.
The current handoff supersedes historical PR state below; source-specific paid
candidate evidence is linked there and does not establish master acceptance.

September21 P08 additionally verifies actual Stripe TEST capture→existing worker
wallet release→web notification return, including concurrent/repeated workers and
history failure/retry after a fresh credit. A two-file existing wallet refresh gap
is repaired at02706ba39; integrated head/current CI and exact limits are in
[Stream1 status](workstreams/01-gigs-payments.md). No broad row-count change.

September21 P09 now additionally verifies an intact successful refund response after
an actual browser account switch, followed by same-owner saved receipt recovery,
with actual Stripe TEST/SQL and exact cleanup. This is a bounded web acceptance;
no row-count change. See [Stream1 evidence and limits](workstreams/01-gigs-payments.md).

September20 Stream1 extends existing P02/P03/P08/P09 evidence with real Stripe TEST
browser tips: captured-original recovery, decline/retry,3DS failure/retry, lost
committed reply/reload, zero-charge cancellation. Reproduced absent-transfer receipt
bug repaired in existing validator atbe13cd7ba. Actual paid-bid12.50authorization→
workerStartWork/completion→ownerCapture plus7.50checkoutcancel now verified in
Chrome/StripeTEST/API/SQL; source/current CI/cleanup/limits in
[live Stream1 status](workstreams/01-gigs-payments.md). Synthetic app identity;
Connect transfers/payouts, live/hosted and native tips remain open. No row closed.

Native reviewer history is accepted and integrated through PR #35 into #32.
PR #36 current-claims HTTP/SDK/browser/native acceptance is also complete at
`1c5f7bb1b`, with final CI 34781479982 passing. The existing presentation is restored and integrated from `a68e8f0e5`;
CI 34785056441 passes all executed checks. See the current-claims report for
rendering limits. PR #32 is now merged; PR #34 remains draft and unmerged. Counts remain 8 closed and 72 partial/open. Renewal/schema drafts
remain paused pending an existing-implementation comparison.

Updated September 13, 2026 after current-claims integration and design restoration.
Start with [the current handoff](PROJECT_HANDOFF.md) and
[resume guide](SESSION_RESUME_2026-09-10.md). This is the authoritative ordered
acceptance inventory; older dated reports retain their historical limits.

**8 of 80 rows locally closed (H01–H06 and R01–R02); 72 partial/open.** Many open rows contain
accepted subjourneys. The rows are not equally weighted and do not measure app
implementation, effort remaining or a release date. Actual records, UI states,
failures, recovery and current access establish acceptance; unit coverage alone
does not. Further auditing may discover additional defects.

Recipient invitation recovery passes backend/browser/iOS/Android. Sender
[backend](home-invitation-sender-recovery-2026-09-12.md) and
[browser](home-browser-invitation-sender-2026-09-12.md) acceptance now pass creation,
explicit resend/withdrawal, recovery and truthful delivery, including legacy
approved requests and membership preservation. Both installed native sender
command journeys, complete Pending recipient identities and bounded member-list
refresh ordering also pass. Ordinary-member Task policy, backend/browser and
installed iOS/Android first use now pass, including exact input, lost replies,
cold recovery and current access. Exact fixture cleanup and durable proof pass.
The bounded H07/H08 milestone is committed/pushed at `767fbb2`, with all 16
checks green in [CI 34742973930](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34742973930).
R02 older-client compatibility and the combined 100 SQL contracts also pass
locally, and its committed/pushed head `d3c3e0f` passes all 16 checks in
[CI 34744758908](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34744758908).
R03 [backend](home-member-removal-recovery-backend-2026-09-13.md) and
[browser removal recovery](home-browser-member-removal-recovery-2026-09-13.md) now
pass actual acceptance. Both native five-original removal journeys and the
combined applicant/reviewer HTTP/browser baseline also pass, as do both bounded
native reader follow-ups. Reviewer-history [backend](home-residency-review-history-backend-2026-09-13.md)
and [browser](home-browser-residency-review-history-2026-09-13.md) now also pass
actual own-history pagination/detail/current-authority recovery, real expiry
races and the fresh post-ack combined applicant/reviewer cycle, with exact
fixture cleanup. Both installed native history readers and fresh native cycles now pass. Current-claims privacy acceptance and presentation restoration are integrated
from PR #36; continue the remaining R03 lifecycle and full ordered backlog.
No additional row is closed.
Do not redo accepted native joining/postal/review/private-first-use work solely
because an older report says “next.”

**Legend:** **Fix** = reproduced defect or identified unfinished implementation;
**Verify** = actual workflow/reconciliation still required, not necessarily broken;
**Integrate** = source/schema/version gate; **Launch** = release prerequisite.

During H07/H08, [browser authentication readiness](web-auth-form-hydration-2026-09-12.md)
was repaired after actual pre-hydration native GET leakage with synthetic data.
All four forms pass disabled/delayed JavaScript checks. This is a bounded
subjourney; the authentication change itself closes no additional acceptance row.

## 1. Home identity and current access — active work

- [x] H01 **Implemented and locally verified:** Detail/property-detail current authority and held-result retirement pass real SDK/HTTP/SQL acceptance. See [the bounded repair](home-detail-authority-2026-09-11.md); final-head CI remains G05. H02/H06 are also locally verified; H03/H04 projections are now locally verified; H05 native identity is now locally verified; H07/H08 remain partial.
- [x] H02 **Implemented and locally verified:** All three lists share current authority, safe errors and held-result retirement. Real SDK/SQL/HTTP authority and recovery matrix passes; see [the list repair](home-list-authority-2026-09-11.md). Final-head CI remains G05.
- [x] H03 **Implemented and locally verified:** Detail/list/occupants use explicit validated projections and safe retryable errors, with real SDK/SQL/HTTP and browser property recovery. See [the read repair and limits](home-detail-projection-2026-09-11.md); broader UI/settings/vendor checks remain D05/D07/I05.
- [x] H04 **Implemented and locally verified:** Detail/property/occupants use per-field grants, safe household references and a verified current roster. Managed history and peer ownership remain separately gated. Actual SDK/SQL/HTTP acceptance passes; see [the projection repair](home-detail-projection-2026-09-11.md). Native first use remains H08; other mutation/IAM surfaces remain D01/D05/D07.
- [x] H05 **Implemented and locally verified:** Both native lists/dashboard/profile distinguish saved Home, private setup, effective role, ownership and residency. Installed SDK/SQL identity, applicant navigation, recovery and current-access retirement pass; see [the native report](home-native-list-first-use-2026-09-11.md). Complete member onboarding and broader UI remain H07/H08/U01/U02; legacy compatibility is locally verified in R02.
- [x] H06 **Implemented and locally verified:** Lists use guarded deletion eligibility and actual occupancy or null, including verified owners without occupancy, private creators, explicit denies and minor limits. Browser controls/first use pass against real list/SQL responses. Broader member onboarding remains H08; see [the list report](home-list-authority-2026-09-11.md).
- [ ] H07 **Verify (partial):** Ordinary invitation admission and missing `home.view` defaults pass actual HTTP/SQL and populated upgrade with explicit denies preserved; see [the member-default repair](home-member-view-defaults-2026-09-11.md). Native search/manual entry, canonical correction, unit editing, partial discard and failure/background recovery now pass both installed platforms; see [address entry](home-native-address-entry-2026-09-11.md). Device location denial/Settings/grant/revocation also passes both installed platforms; see [location recovery](home-device-location-recovery-2026-09-11.md). iPhone original-command creation/restart/cancel and atomic optional setup now pass [installed acceptance](home-ios-create-recovery-2026-09-11.md). Android also passes [retained creation and distinct units](home-android-create-recovery-2026-09-11.md). Browser now passes [retained creation, renter and storage-failure recovery](home-browser-create-recovery-2026-09-11.md). Browser existing-Home submission and bounded address lifetimes now pass [actual acceptance](home-browser-residency-submission-2026-09-11.md). Browser applicant status and postal recovery, both native joins/status and both native postal recovery now pass. Both native prepared review flows and selected-address private first use now pass. Bounded [browser invitation recovery](home-browser-invitation-recovery-2026-09-12.md) also passes, followed by [atomic invitation decision commands](home-invitation-decision-recovery-2026-09-12.md); [protected browser decisions](home-browser-invitation-decisions-2026-09-12.md) and [iOS recovery with secure sign-in return](home-ios-invitation-decisions-2026-09-12.md) also pass. [Android protected recovery and encrypted legacy sign-in return](home-android-invitation-decisions-2026-09-12.md) also pass. Sender [backend](home-invitation-sender-recovery-2026-09-12.md) and [browser](home-browser-invitation-sender-2026-09-12.md) pass actual creation/recovery, explicit resend/withdrawal and truthful delivery. Both installed native sender command journeys and member-list ordering follow-ups pass; see [iOS sender acceptance](home-ios-invitation-sender-2026-09-12.md) and [Android sender acceptance](home-android-invitation-sender-2026-09-12.md). The [ordinary-member Task policy and backend proof](home-member-task-first-use-2026-09-12.md), [browser first use](home-browser-member-first-use-2026-09-12.md) and [installed iOS continuation](home-ios-member-onboarding-2026-09-12.md) pass; [Android final installed acceptance](home-android-member-onboarding-2026-09-12.md) also passes. All controlled member Task journeys are accepted; the remaining new-account/provider/lifecycle exit criteria stay open. Address validation grants no membership.
- [ ] H08 **Verify (partial):** Browser and both installed native owner/applicant/private setup lists, distinct destinations, unavailable/malformed retry and private list → real Tasks pass through actual SDK/SQL. Private setup → selected-address submission → separate mail next step also passes on all three clients; see [private first use](home-private-first-use-2026-09-12.md). Recipient decisions and sender recovery pass backend/browser/iOS/Android, including explicit resend/withdrawal, current list ordering and complete pending recipient identities. Ordinary-member browser/iOS/Android Task first use passes with truthful household admission labels, exact text, retained creation and current-access recovery. Complete the broader new-account/provider/onboarding/verification exit criteria. See [the native limits](home-native-list-first-use-2026-09-11.md) and [onboarding work](home-onboarding-recovery-2026-09-11.md).

## 2. Residency, ownership and leases

- [x] R01 **Implemented and locally verified:** Backend/browser and both installed native prepared residency review pass protected originals/receipts, approval/rejection, lost replies, restart, current-access removal/restoration and retired replies. See [iOS acceptance](home-ios-residency-review-2026-09-12.md) and [Android acceptance](home-android-residency-review-2026-09-12.md). Broader history/authority combinations remain R03; final release-wide checks remain U05/G05.
- [x] R02 **Implemented and locally verified:** The [new atomic submission command](home-residency-submission-recovery-2026-09-11.md) passes real HTTP/SDK/SQL, eleven lock races, selected-address fencing, rejected resubmission, failure/cancel recovery, dedicated request limits and populated upgrade. Role, age, dates, explicit denies and ownership restrictions are preserved. [Browser original-command joining and address lifetimes now pass](home-browser-residency-submission-2026-09-11.md). [Current personal identity/status and paginated history pass](home-personal-residency-progress-2026-09-11.md). [Postal request](home-postcard-current-recovery-2026-09-11.md) and [code/review backend recovery](home-postcard-verification-recovery-2026-09-12.md) now pass. [Browser postal recovery](home-browser-postcard-recovery-2026-09-12.md) also passes. Both native joining/status, [iOS postal recovery](home-ios-postal-recovery-2026-09-12.md) and [Android postal recovery](home-android-postal-recovery-2026-09-12.md) also pass; both native prepared-review clients now pass. The [legacy compatibility repair](home-residency-legacy-compatibility-2026-09-12.md) replaces the partial-write route with shared atomic policy. It passes 53 actual HTTP/SDK calls, ten observed lock races, populated preservation, reviewer alias compatibility and all 100 combined H07/R02 SQL contracts. Existing membership, full uniqueness and protected originals are preserved. No historical-binary UI, immutable legacy request/cancel protocol, live notice arrival or hosted adoption is claimed; broader applicant/reviewer lifecycle remains R03 and final release gates remain G03/G05.
- [ ] R03 **Fix/Verify:** [Actual backend/browser/iOS/Android removal](home-member-removal-baseline-2026-09-13.md) proves lost-reply stale UI and repeated DELETE side effects. [Backend](home-member-removal-recovery-backend-2026-09-13.md) and [browser recovery](home-browser-member-removal-recovery-2026-09-13.md) pass protected originals, lost replies, unseen cancellation, current authority and history after self-leave. Both native five-original journeys now pass and are exactly cleaned. The [iOS reader follow-up](home-ios-member-removal-recovery-2026-09-13.md) also passes same-original installation, Close/interactive dismissal, held-success/newer-failure ordering and explicit retry; [Android's bounded reader/count follow-up](home-android-member-removal-recovery-2026-09-13.md) passes both full variants and installed held-read/tab/Close, unavailable/retry and unknown-versus-confirmed-zero behavior, with zero new commands and exact cleanup. The [combined applicant/reviewer baseline](home-residency-cycle-baseline-2026-09-13.md) passes actual selected-address submission, rejection, resubmission, independent approval, acknowledgement, protected removal, cold applicant return, observed reviewer conflicts and real authority expiry. Post-acknowledgement reviewer history and native combined-cycle acceptance pass in merged PR #35. The raw-field/no-store claims-queue repair passes actual acceptance in PR #36 (final CI 34781479982); its restored presentation is integrated from `a68e8f0e5` with passing CI 34785056441. Verify the remaining lifecycle using existing implementations first. The additive removal nonce preserves old column values but requires fresh review of old unsubmitted reviewer originals. Protected Home re-invitation and fresh submission refuse ended membership. The separate existing occupancyAttachService reactivation path remains used by landlord invitations/approvals, with existing service/pipeline tests. Verify that path before extending ordinary-household re-entry; do not build another activation service or assume the entire app lacks this behavior. Preserve accepted applicant pagination/resubmission and immutable historical receipts. Establish the household residency needs-more-information contract separately from ownership challenge; current household forms expose approval/rejection only.
- [ ] R04 **Verify:** Complete ownership transfer, challenge/dispute, recovery and related household lifecycle paths beyond the already completed ordinary claim review/withdrawal and relationship-decision milestones.
- [ ] R05 **Verify:** PR #38 repairs demonstrated lease approval/date/admission, end/move-out, tenant status/cancel and request-submission defects using existing records and designs. End source1f526de0d passes eight CI checks/three unchanged skips; legacy protected-removal → end → fresh-admission passes. Native Leave Home controllers are unchanged and accepted evidence is reused. Current request source passes 126 backend/37 rendered tests, SQL lifecycle/rollback/lint, actual submission-race and response-loss/expired-lease browser journeys, and 12 admission/five end HTTP/SQL compatibility checks. Request source9c31be7a3 passes all eight applicable CI34798866061 checks/three unchanged skips. Tenant Home/account response retirement now passes 41 rendered tests, fresh types/lint, three actual browser/HTTP/SQL privacy cases and existing lifecycle/recovery compatibility; tenant source0f54be50a passes all eight applicable CI34799934365 checks/three unchanged skips. Landlord Home/account retirement now passes 46 rendered/66 route checks, types/lint, actual held-response and committed-approval browser cases, and six approval/three end compatibility cases; landlord source1a17a22a9 passes all eight applicable CI34800605686 checks/three unchanged skips. Native request-error classification and existing error-banner binding now pass the Android view-model suite/three Details snapshots, 32 focused iOS tests including visible-text rendering, and scoped lint/format checks; native source29603b01a passes all15 applicable CI34803605947 checks/one unchanged Seeder skip. No native replacement screen or service was added. Queued-original reproduction and the existing web status-context repair now pass actual HTTP/browser retry-cancel-delayed-original and fresh-request checks, 122 backend/48 rendered tests, types/lint and the full lease SQL contract; checkpoint1e4d5a644 passes all 15 applicable CI34806113797 checks/1 unchanged Seeder skip. The existing iOS/Android controllers and separate web details caller now forward the observation: 27 iOS/26 Android/51 rendered/122 backend tests, web types/lint and Swift checks pass, plus actual second-page browser/SDK/HTTP/SQL failure/account-change/saved-request checks and native omitted-nil HTTP compatibility. Native network tests use stubs; installed native acceptance and the submitted-page notification claims remain open. A later Android Back/Discard probe reproduced submission after departure; the existing job/cancellation repair passes all28 focused tests, including delivered old responses. The equivalent iOS departure repair passes30 focused tests and Swift checks; installed iOS Back/Close/Discard against actual tenant routes/SQL cancels the held status with zero POSTs/leases/notices. Synthetic login/shell only. Installed UI proves sample attachment/upload/parse claims and a sample Home label remain. Exact10c68 CI failed Android Detekt condition complexity; the equivalent condition simplification passes local detekt/ktlint and28 focused tests, and corrected checkpoint6dbad11de passes all15 applicable CI34811429769 checks/one unchanged Seeder skip. iOS saved-request recovery now passes36 model/network+7 existing rendering checks; actual installed restart recovers the same saved request using GET only, and normal logout/second synthetic login shows no prior tenant data. This reuses the status endpoint, confirmation view and existing session scope. Android recovery now passes37 model/session tests and all5 unchanged Start/Details snapshots with detekt/ktlint; it reuses the existing status/session paths and adds no product/test file. Both native foreground models now pass49 iOS checks (42 model/network+7 rendering) and48 Android checks (43 model/session+5 unchanged snapshots), with static checks. Work resumed at the user’s request. Installed iOS now passes draft preservation, externally saved pending recovery, pending-to-active foreground refresh and one timed-out-read retry using GET only. Its displayed lease date was one day early and its active note still described pending approval; the existing native display repair passes50 iOS/49 Android checks, static checks and Android assembly, plus installed iOS date/status inspection. The earlier Android installed-control limit is superseded by the accepted request journey and rendered regressions in [native request evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-lease-request-controls-and-calendar-validation). Live native forms now use an empty form and neutral rental label. Fake attachment insertion/requirement/file-on-record claims are removed; the existing control truthfully reports private upload unavailable. Native/web email and delivery claims are corrected without changing the designs. All50 iOS/49 Android checks, static checks/assembly and29 existing web lease tests pass; installed iOS verifies Attach feedback, invalid-date rejection with retained fields, and a corrected saved request without a file claim. Actual HTTP exposed February31 normalizing to March3 before SQL validation; the existing route now preserves raw ISO input for the existing SQL guard. Three invalid start/end cases create no lease/notice, valid leap-day/offset inputs still save, and130 selected backend tests pass. Prior foreground source9d344bcf0 passes all15 applicable CI34820697178 checks/one unchanged Seeder skip. Native identity/date source113d4cdc6 passes all15 applicable CI34827611210 checks/1 unchanged Seeder skip. Existing unit vacancy/child-lease follow-up now passes134 backend/38 rendered tests, types/lint and actual browser cancel/failure/retry/late-response journeys. It reuses lease-end and verifies per-unit authority before exposing tenant status; no schema/design change. Bulk unit handlers remain open. Existing lease notification URLs now reach the existing code screen and recipient-only preview/acceptance:144 backend/49 web tests, types/lint and real browser cancel/saved-reply-loss/retry pass without duplicate lease/occupancy. Invitation sharing now retains/copies the link in the existing modal and passes browser creation-to-acceptance plus58 rendered checks/types/lint. Parent-building admission was reproduced against the real multi_unit enum; the existing service/transaction fix passes145 backend tests, full lease SQL contract, application-function lint and7 parent rejections/3 valid apartment HTTP cases. Existing invitation creation now reuses the same transaction and retained proof:140 backend/61 web tests, full SQL rollback/retry/lint,13 actual HTTP cases and browser saved-but-503 recovery/copy pass. Protected departure/reload recovery now passes70 rendered/83 route tests,9 real IndexedDB/WebCrypto cases and actual browser reload/retry/copy/Done plus HTTP actor rejection. Existing recovery storage and styles are reused; no new file/schema. CI34836085491 failed a stale generated test wrapper; its regenerated lease wrapper passes locally and all54 wrappers synchronize, with corrected CI pending. Database-reply-loss notification recovery now passes186 selected backend/notification tests and actual HTTP/SQL original503/retry/concurrency/read-state cases using the existing Notification idempotency column/index. Provider emission remains best effort; native link acceptance and provider delivery remain open. Existing unit Import/Generate now reuse protected Home creation and canonical validation:73 backend/90 rendered tests,12 actual HTTP/SQL checks and two Chrome recovery journeys pass; one forward function-update migration, with no new table or design replacement. See [unit evidence](VERIFICATION_FIRST_2026-09-13.md#existing-unit-import-and-range-generation). PR38 c51740fce passes15 applicable CI checks/one skip; PR39 461120fca passes8 applicable checks/three path-based skips. Existing private document downloads now recheck authorization and file identity after storage responds:101 selected tests and seven actual HTTP/SQL checks pass, including six reproduced disclosure cases. No screen/schema change for this repair. Existing general upload purpose/schema and Word MIME mismatches are repaired using File.file_type/file_context:115 selected tests and12 actual HTTP/SQL checks pass. See [the bounded evidence](VERIFICATION_FIRST_2026-09-13.md#existing-standalone-file-upload-compatibility); generic S3 recipient/privacy and consuming journeys remain unaccepted. Native lease links now reuse the existing invitation screens and pass134 Android/88 iOS checks, static checks/builds and both installed offer, Not now, saved-response-loss/retry and signed-out replay journeys with canonical SQL receipts. No new screen/table/migration. See [native invitation evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-lease-invitation-links). The earlier Android request-approval installed journey is verified within the [native request evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-lease-request-controls-and-calendar-validation) limits. Real private lease upload and provider acceptance remain open. Provider delivery, combined adoption and rollout remain open. See [current evidence and limits](VERIFICATION_FIRST_2026-09-13.md#existing-request-submission-and-response-loss-follow-up). Private lease backend now passes244 selected tests/privacy gates, eight SQL contracts and16 actual HTTP/SQL cases, with374-table forward preservation and no new tables; [backend evidence](VERIFICATION_FIRST_2026-09-13.md#existing-private-lease-file-storage-and-request-binding). Existing iOS attachment controls and the web landlord reader now pass248 backend/148 web/60 iOS tests and18 actual HTTP/SQL cases, plus an installed iOS-to-browser private-file journey; [PR #43 client evidence](VERIFICATION_FIRST_2026-09-13.md#existing-ios-lease-attachment-and-web-landlord-reader) retains lost-reply recovery, delivered old bytes after revocation, account switching and exact fixture cleanup. Existing Android attachment controls now pass69 focused/rendering/API tests and static/build checks, plus the real picker/Unicode upload, explicit removal retry and saved-request recovery journey. The final caption-only correction passes three Details rendering checks and has a matching installed APK; [Android evidence](VERIFICATION_FIRST_2026-09-13.md#existing-android-lease-attachment-controls) retains exact source/runtime limits. Web tenant entry, remaining native readers and real provider acceptance remain open.
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
- [ ] D05 **Fix/Verify:** Finish general HomeSettingsTab error recovery, atomic saves, retained original intent, privacy settings, concurrent edits and explicit clearing of optional fields. Saving notification preferences alone does not establish delivery. R03 source review found Android and iOS Settings hardcode the nonpending footer as Owner and the address chip as Verified. Actual Android ordinary-member self-leave now confirms the false Owner footer; the offscreen Verified chip and iOS footer remain source observations. Repair the identity labels and verify each actual state.
- [ ] D06 **Fix:** HomePrivacyService must not fall back to permissive address precision when its read fails; verify every exposed privacy control against actual consumers.
- [ ] D07 **Fix/Verify:** Sender invitation queues, explicit actions and bounded stale-list retirement now pass on all three clients. Reconcile DocsCard Share with the current sharing contract; finish ShareCenter, Members/Security and provider panels' error-versus-empty behavior and current access. R03 source review found the standalone browser role cycle excludes the current role before searching its index, selecting the first assignable role; reproduce and replace this with an explicit supported role choice.
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

- [x] P01 **Implemented and locally verified:** Durable tips reserve the exact original request/payment/payer/worker/cents/currency/terms before provider creation (`reserve_gig_tip_original` → `prepare_gig_tip_provider` → frozen `provider_params`). Verified September 16 on a fresh full-schema replay: tracked `scripts/db/test-gig-tip-original-service.cjs` 22/22 and a route-level HTTP/SQL harness 15/15 (lost provider create leaves a reserved, retryable original; identical retries reuse one intent). Real provider acceptance remains P02/L01. See [Stream1 evidence and limits](workstreams/01-gigs-payments.md).
- [ ] P02 **Verify:** Tip migrations (`20260916021100..021300`), service and routes exist and pass local synthetic-provider verification for unknown creation, check/resume/cancel, historical legacy tips and the three-successful-tip limit without duplicate charges (September 16, same evidence as P01). September20 actual Stripe TEST UI proof now covers original recovery, decline/retry,3DS failure/retry and cancellation (see Stream1 status). Still open: cold historical discovery beyond the 24-hour window and broader reconciliation/provider boundaries with L01.
- [ ] P03 **Verify:** Retained tip commands and receipt handling exist in web, iOS and Android (contract `backend/contracts/gig-tip-contract.md`) with unit-level coverage (web tip modal in the September 16 289-test run; iOS `GigTipTests`/`GigTipRecoveryTests`; Android `GigTipViewModelTest`/`GigTipRecoveryTest`). September20 browser UI → real HTTP/SQL now passes retained reload/session changes, lost/invalid receipts, concurrent tabs, departure and cancellation with synthetic providers (see Stream1 status). September20 actual Chrome Stripe TEST checkout/3DS and fresh browser recovery now pass. Still open: installed native tip journeys, unavailable-storage behavior and broader provider acceptance (P08/P09 scope). The installed iOS attempt was interrupted by local Simulator failure; it is not accepted.
- [ ] P04 **Fix/Verify:** Finish started-work, no-show, cancellation-fee and completion/reopen policies, immutable displayed terms and exact fee execution. Existing zero-fee unstarted-stop recovery is a bounded completed source milestone. Start Work is verified end to end (backend `599de1586`, displayed-terms binding `a65411758`/`4ad88ec11`, installed iOS and Android journeys). Completion, owner confirmation and reopen/release policies with immutable displayed terms passed 32/32 real HTTP/SQL checks on the full schema on September 16 (free paths complete; paid confirmation verified to the provider boundary). Still open: no-show and cancellation-fee policies and exact fee execution, which need the fee payer/recipient product decision, and broader provider settlement (P02/L01). September20 actual Chrome paid-bid authorization→worker start/completion→owner approval captured the exact selected1250c at Stripe TEST. See [Stream1 evidence and limits](workstreams/01-gigs-payments.md).
- [ ] P05 **Fix/Verify:** Settle cancellation-fee residuals under an explicit policy; do not silently treat held money as released earnings or waive fees.
- [ ] P06 **Fix/Verify:** Finish disputes and dispute-loss accounting, historical Connect transfers/reversals, payout onboarding/withdrawal and operational debt recovery, including contradictory legacy proof.
- [ ] P07 **Fix/Verify:** Provide support/reconciliation paths for retained unknown financial operations and durable attention; review legacy tip/booking notices separately from the completed paid-gig wallet outbox.
- [ ] P08 **Verify:** Run fresh installed/native and browser sandbox journeys: chosen bid → authorization → assignment → worker start/completion → owner capture → wallet release/refund → exact notification return, including all loss/retry/denial paths.
- [ ] P09 **Verify (partial):** September20 Chrome/actual Stripe TEST/API/full77SQL now verifies assigned reopen and grace cancellation with hold release, lost stop-response reload, captured partial500c refund with lost-response recovery and remaining750c full refund. Exact provider/request/SQL proof and cleanup are in Stream1 status. Still verify installed clients, remaining denial/provider-failure cases, historical transfer/reversal and broader close/release scope; source/build checkpoints do not replace acceptance.
- [ ] P10 **Verify:** Payment worker retries, retained operations, financial records and notification delivery need final workload/capacity/retention checks and safe fixture cleanup.

## 8. Pulse, Beacon, notifications and social safety

- [ ] N01 **Verify:** Close remaining release-build notification states across platforms: exact post/chat/task destinations, foreground/background/cold start, permission denial, login continuation, token changes, account switching and unread state. Preserve completed evidence rather than rerunning it blindly.
- [ ] N02 **Verify:** Physical Android notification/device acceptance remains unverified; emulator delivery is not hardware acceptance. No physical Android is currently available in the recorded setup.
- [ ] N03 **Verify:** Release-candidate Pulse and Beacon journeys must preserve address-free discovery, explicit following, eligible posting, conversation/reply return, mute/unfollow and private/public identity boundaries.
- [ ] N04 **Verify:** Reporting, blocking, moderation and old/shared/deep-link access need a usable end-to-end safety workflow under the final release flags. Draft PR51 at `dfc860bfe` has bounded browser/HTTP/PostgreSQL and regression evidence; native lifetime, real socket/provider delivery and wider entry-point acceptance remain open. See the [source-bound review](VERIFICATION_FIRST_2026-09-13.md#existing-profile-safety-and-blocked-user-journeys); no row closure or merge approval.
- [ ] N05 **Verify:** Any promised calendar/reminder delivery must arrive once, open the correct authorized destination and honor preferences; saved schedule data is separate evidence.

## 9. Accounts, providers and storage

- [ ] A01 **Verify:** Remaining real signup, verification/recovery email and OAuth callbacks, including Apple/Google, cancellation, provider failure and return to the original authorized destination.
- [ ] A02 **Verify:** Real onboarding/account session expiry, revocation, logout/account switching and local protected-data retirement across provider and client combinations not covered by controlled local login.
- [ ] A03 **Verify:** Hosted media/document upload, preview, replacement, deletion, permissions, quotas and file cleanup under actual Auth/Storage configuration.
- [ ] A04 **Verify/Launch:** Remaining address/provider coverage, including activated Smarty scenarios, geography/unit disambiguation and legitimate unavailable responses. Prepare what is possible on existing/free capacity first.
- [ ] A05 **Verify:** Reconcile all reachable marketplace, subscription, booking, wallet, mail, profile, search and adjacent actions against the current release inventory. Old static audits are discovery inputs, not proof that each item is still broken.

## 10. UI, accessibility and operating conditions

- [ ] U01 **Fix/Verify:** The discovered indistinguishable unit cards are repaired and accepted on API/browser/iPhone and [Android](home-android-create-recovery-2026-09-11.md). See [the repair](home-list-unit-identity-2026-09-11.md). Both native Pending invitation lists also show complete recipient identities, with four matching prepared reviews per platform; see the sender reports. Resolve indistinguishable personal residency cards, retained narrow-screen member/badge and floating-chat overlap, property-verification wording and long native activity identities; review finished screens, not loading placeholders.
- [ ] U02 **Verify:** Complete small screens, large text/Dynamic Type, zoom, keyboard/focus, screen readers, contrast and dark-mode checks across reachable flows.
- [ ] U03 **Verify:** Exercise loading, empty, partial, unavailable, offline, slow response, retry, cancellation, back navigation, duplicate taps and process death with actual UI and persisted state.
- [ ] U04 **Verify:** Validate long-lived sessions, background/foreground transitions and concurrent device/account changes beyond the bounded Home tests.
- [ ] U05 **Verify:** Run the final release-build feature/screen/action inventory on web, iOS and Android; resolve or accurately constrain every unfinished reachable action and preserve existing entitlements.

## 11. Integration and migration dependencies

- [ ] G01 **Integrate:** Complete #32's Home scope and #34's payment scope before marking either ready. Keep PR descriptions matched to final scope; #32 includes accepted Task/R02 and backend/browser removal recovery while #34 remains unfinished.
- [ ] G02 **Integrate:** Resolve #34's actual master conflicts without losing either branch's work; preserve all unrelated local changes.
- [ ] G03 **Integrate:** Reconcile the primary source’s 49 Home / 21 payment / 58 distinct combined migration versions and dependency order (12 byte-identical shared versions, zero collisions at this checkpoint). The source includes Task defaults `20260912050000` R02 compatibility `20260912060000` removal recovery `20260913010000` and reviewer history `20260913020000`. The latest 104-contract Home proof applies Home prerequisites only and does not complete combined paid/Home replay or adoption. Integrated PR #36 adds reader version `20260913030000` without new tables; the current inventory is 50 Home / 21 paid / 59 combined, with the same 12 shared versions. The preceding 49/21/58 count is historical. The reserved tip migration is unimplemented; review existing tip/schema paths before choosing a final change.
- [ ] G04 **Integrate:** Replay the combined final schema, permissions/RPC contracts and populated upgrades; preserve old values, files and financial obligations and reconcile cross-branch deletion dependencies.
- [ ] G05 **Integrate:** Pass required CI on each final PR head, review the integrated result and verify merged-master checks. Earlier green or cancelled runs are not substitutes. Preserve source-bound evidence of the a1d278e33 iPhone SE attachment-request setup timeout in CI 34784251075; current a68e8f0e5 passes all three iOS jobs, but the short fixture wait deserves a bounded stability follow-up.

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

The [combined residency baseline](home-residency-cycle-baseline-2026-09-13.md)
now passes ten actual HTTP/SDK/SQL groups, 128 requests and a separate Chrome
applicant/reviewer cycle. Observed lock conflicts and real clock-expired reviewer
authority pass. Post-acknowledgement reviewer history is absent in current source;
the actual shared claims queue exposes raw identity/extra claim fields and omits
explicit no-store headers. These are separate remaining repairs. Both native
five-original removal matrices and bounded stale-reader/count follow-ups pass;
retain their distinct source/product/installed bindings and failed predecessors.

Next: verify the newly integrated native removal head and its own exact-head CI.
Continue actual reviewer-history HTTP/browser/native acceptance and the observed
current-claims privacy/reader repair, then the remaining R03 lifecycle and full
ordered inventory. The backend/browser predecessor1a passes its separately bound
manual CI34750247001 (15 successful jobs including CI OK; Detect changes skipped).
Refresh current Git/PR checks and fixture ownership
before acting. Use the resume guide’s current next step.
Keep this inventory updated as evidence closes or adds individual items.
