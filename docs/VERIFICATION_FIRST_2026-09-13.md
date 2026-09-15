# Verification-first reconciliation — September 13, 2026

The user requires preservation of working code and all existing screen designs.
Continue the original improvements by verifying existing workflows and repairing
demonstrated defects. This milestone inspects source, PR state and existing
evidence; it changes documentation only. It does not certify every screen or
claim that all prior implementation changes were unnecessary.

## Current PR disposition

| PR | Source inspected | Verified state | Disposition |
|---|---|---|---|
| [32](https://github.com/WangPantopus/skinny-pantopus/pull/32) | `4e966835fd6c2c9b51e1cd4d34ecaa8fb30372c8` | Draft against master; mergeable; [CI 34777977420](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34777977420) passes | Preserve accepted Home work. Review remaining functional and presentation differences; do not blanket-rebuild or revert. |
| [34](https://github.com/WangPantopus/skinny-pantopus/pull/34) | `e9ef2decbb7ec435589bb3b92639041cfc4618a6` | Draft against master; conflicting; [CI 34526168928](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34526168928) passes its selected scope | Paid acceptance remains incomplete. Reconcile actual conflicts and existing payment/tip paths before extending them. |
| [35](https://github.com/WangPantopus/skinny-pantopus/pull/35) | `8cfcbf2b28d95587a70fe784c81b913de688dd52` | Merged into #32 at `f1a92f45a`, not master | Preserve accepted native reviewer-history readers and fresh cycles; do not repeat from stale handoffs. |
| [36](https://github.com/WangPantopus/skinny-pantopus/pull/36) | `1c5f7bb1bc4686ea41f411f6bf554dbf7dd2efe1` | Draft against #32; mergeable; [CI 34781479982](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34781479982) passes | Recorded actual claims privacy acceptance is complete. Reconcile visible differences with the design-preservation rule before integration. |

Master at inspection: `6a1013784db69bf339535a2f4b33b328f2bbf40c`.
These are source-bound observations, not proof of production deployment. A later
documentation commit has its own CI state. No PR is merged by this reconciliation.

## Concrete overlap and presentation findings

1. **PR #36 reuses existing database entities.**
   `supabase/migrations/20260913030000_home_current_residency_claims.sql`
   introduces a service-only reader over `HomeResidencyClaim` and `User`, using
   existing review locks/authority. It creates no tables. That migration is a
   privacy/authority repair, not a duplicate household schema.
2. **PR #36 contains visible changes beyond selecting safe fields.** The web
   `ResidencyClaimsPanel.tsx` now delegates to `residency/queue/ResidencyQueueContent.tsx`.
   Its row border changes from yellow to the general border token; the gradient
   avatar changes to a neutral icon; links/buttons gain minimum height and
   different spacing. Both native `HomeClaimResidencyCard` implementations retain
   their card component but replace name initials with `?`, remove age/address
   and display the request date. New queue wrappers add explanatory text and
   reload/count states. Private-field removal is justified by the recorded
   defect; decorative differences need a separate disposition. Source comparison
   establishes these changes; a complete visual comparison has not run here.
3. **PR #32 already changed the review interaction.** The same existing browser
   panel replaces immediate approve/reject calls and a browser prompt with links
   into protected review/recovery. Preserve the accepted command guarantees;
   compare the resulting interaction and presentation before further changes.
4. **PR #34 replaces a pre-existing cancellation surface.** Its diff deletes
   `frontend/apps/web/src/components/gig-detail/CancellationModal.tsx` and adds
   `GigStopDialog.tsx` and recovery surfaces. The prior modal already had reason
   choices and a policy/fee preview. Required payment correctness does not by
   itself justify discarding that presentation. Map old controls/behavior to the
   replacement and the unfinished started-work/fee policy before acceptance.
5. **Renewal remains an unaccepted proposal.** The isolated renewal worktree
   contains an untracked contract and `20260913040000_home_residency_renewal.sql`,
   proposing `HomeResidencyRenewalRequest` and `HomeResidencyRenewalCommand`.
   Neither is applied or pushed. First compare existing `HomeResidencyClaim`,
   `HomeOccupancy`, submission commands, review receipts, invitation decisions
   and membership versions. Ended membership is currently refused; that proves
   a workflow gap, not the necessity of two new tables or a separate screen.
6. **Storage consolidation is deferred.** Existing removal/residency browser
   stores overlap in encrypted recovery plumbing. Do not refactor working stores
   merely for similarity. The isolated renewal worktree retains only a small
   proposed malformed-storage check and focused test edits, plus its draft files;
   none is accepted or integrated by this report. The larger extraction is
   preserved privately, outside the application tree.

A filename-based UI review index identifies **146 candidate files in #32,
26 in #34 and 9 in #36** (181 PR/file entries, including overlap). It selects web
TSX/CSS, native View/Components Swift and Screen/Content/View Kotlin paths in
each PR diff. This is a triage filter, **not 181 redesigns or an exhaustive visual
audit**: view models, shared components and other naming patterns also affect UI.
The private audit directory retains `current-pr-ui-review-candidates.json`.

## Use the existing inventories

The [80-area acceptance backlog](REMAINING_WORK_2026-09-11.md) remains the one
ordered work list. Its 8 closed / 72 partial-or-open rows are neither a measure
of app implementation nor evidence that 72 areas need rebuilding.

| Coverage | Existing inventory / source | Verification treatment |
|---|---|---|
| Designed native screens | [Screen parity inventory](screen-parity-inventory.md), [mobile wiring audit](mobile-wiring-audit.md), [mobile parity audit](mobile-parity-audit.md) | Reuse screen-to-source mappings. Historical counts and REAL_VIEW labels are discovery evidence, not current end-to-end acceptance. |
| Web pages and embedded panels | `frontend/apps/web/src/app/**/page.tsx`, `frontend/apps/web/src/components/` | 306 tracked page entry files at #32's inspected head; include nested panels, modals and actions. Do not equate a file with one reachable product screen; exclude demos only after checking routing. |
| Native navigation and nested actions | iOS `Features/Root/*TabRoot.swift`, `RootTabView.swift`, `Features/Auth/AuthRouter.swift`; Android `ui/screens/root/RootTabScreen.kt` and feature navigation | Trace real destinations, sheets and deep links, including routes newer than the historical 94-design-screen catalog. |
| Home and residency | H01–H08, R01–R06; `backend/routes/home*.js`, Home services and SQL; native `Features/Homes` / `ui/screens/homes` | Preserve accepted subjourneys and bind each remaining scenario to its current implementation before testing. |
| Intelligence, records, bills, mail | I01–I07, D01–D10, F01–F05, M01–M04 | Locate current screen → shared API → route/service → persisted entity; check competing readers before introducing another owner. |
| Payments, social, accounts and adjacent features | P01–P10, N01–N05, A01–A05; [Calendarly audit](../reference/calendarly-parity/3WAY-PARITY-AUDIT.md) | Reconcile both open branches and historical feature inventories. A05 must expand actual uncovered reachable workflows, not silently omit them. |
| Accessibility, failures and lifecycle | U01–U05, [accessibility audit](a11y-audit-current.md) | Use existing design snapshots. Verify actual populated/error/offline states and assistive access; proposed visual fixes remain subject to the design constraint. |
| Schema, release and providers | G01–G05, O01–O06, L01–L04; `supabase/migrations`, `migrations-archive`, existing ledger/replay reports | Reuse schema and preserved proof. Combined populated adoption, provider delivery and production readiness remain distinct open gates. |

For each scenario added to an existing row, record: source/build and platform;
screen and entry path; existing API/service/table; expected and observed behavior;
evidence link; status; minimal proposed fix if any; design impact; regression and
persisted-state/side-effect verification. Use **verified—preserve**, **needs
verification**, **reproduced defect**, **confirmed missing requirement**, or
**externally blocked**. Untested never means broken. An old snapshot or static
source mapping never means the live workflow passes.

## Presentation follow-up

The current #36 candidate restores the two existing web card layouts and native
illustrated empty states in six existing view files. The controller, API and SQL
remain unchanged. See [the candidate report](home-current-claims-wip-2026-09-13.md)
for the rendered web checks, compile gates and installed-native limitations.
The findings above remain the inspection record, not instructions to repeat the
already completed restoration. Source `a68e8f0e5` now passes CI 34785056441 and is integrated into the Home branch.
The current handoff supplies the next existing-reactivation-path verification task.

## Original next bounded task (now implemented in the candidate)

Reconcile #36's existing queue presentation against its #32 base. Preserve the
accepted safe reader, authority checks and stale-response retirement. Identify
which visual differences can be removed while retaining those guarantees, and
which displayed-data changes are required for privacy. Use existing cards and
controls. Only a changed rendering path needs new visual evidence; rerun broader
acceptance only if relevant behavior changes. Then resume the ordered backlog,
starting R03 by comparing existing renewal/re-entry paths before writing code.

The previously reported **87.4% existing-feature rework** is not a duplication,
waste or avoidable-effort percentage. Do not use it to justify blanket deletion.
The last-week PR audit and its qualifications remain in the private audit
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260913-duplication/REPORT.md`.


## Existing landlord flow verification — September 13

Source baseline: Home integration `e6e3c65f8af8201a2dd17e5d915018f539bdd902`.
The follow-up branch `codex/landlord-existing-flow-fixes` changes one existing
service and three existing test files. No screen, layout, service, table or
migration is added. It is integrated into #32 after exact candidate CI passed. Home integration
`e6e3c65f8` passed all 16 checks in CI 34788091570 before this merge. Candidate
`968e145a7` passed six executed checks with five unchanged-scope skips in
[CI 34790034952](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34790034952).
The new merge needs its own CI observation.

The existing path is web `components/landlord/RequestsTab.tsx` → shared
`landlord.approveLease` → `landlordTenant.js` → `landlordAuthorityService` →
`occupancyAttachService` / `homePermissions` → existing `HomeAuthority`,
`HomeLease`, `HomeLeaseInvite`, `HomeLeaseResident`, `HomeOccupancy` and audit rows.
Both native VerifyLandlord wizards already submit tenant approval requests through
their existing repositories/endpoints. Those existing submission screens are not
proof that every invitation-acceptance or reviewer destination is reachable.
The shared tenant acceptance endpoint exists; installed acceptance of that
specific landlord invitation route has not been established here.

An initial check using the existing in-memory database fixture reproduced three
failures. Actual services with the real Supabase SDK, loopback PostgREST and a
new schema-only isolated PostgreSQL database then confirmed them:

- An otherwise valid invitation still granted membership after its issuer's
  `HomeAuthority.status` changed to `revoked`. The repair checks the exact home,
  subject type, subject ID and verified status before any lease/access write;
  unreadable authority also denies. Actual SQL comparison: baseline grants Home
  access, candidate denies with no lease/occupancy and leaves the invite pending.
  A currently verified invitation still creates a lease and grants Home access.
- Tenant approval without a verified `AddressClaim` changes the lease to active,
  receives a failed attachment, returns success with null occupancy and emits a
  success notification. Retrying then refuses the already-active lease. This
  remains **unfixed**; simply adding a method bypass or changing the return flag
  would not repair partial writes/retry consistency.
- A fresh landlord invitation reactivates the existing occupancy row but retains
  an expired `access_end_at`. The service reports success while actual
  `getUserAccess` still denies. This remains **unfixed**; blindly clearing old
  dates would also discard the new lease's intended access period.

The authority repair passes 279 tests across five existing suites (217 service/
pipeline checks and 62 route checks), including six new red-before/green-after
invalid-authority cases, authority-read failure/retry, business/trust subjects
and a route-level denial. An initial root-directory test invocation could not
resolve Express in the existing mock; running the route suite from backend
resolved that harness issue. The route success fixture now supplies its verified
issuer, as the service fixture does. No assertions were weakened.

The SQL fixture initially copied the old in-memory fixture's invalid Home type
`unit`; the database rejected it. Changing only the synthetic fixture to the
supported `house` type allowed the actual comparison. All synthetic users, homes,
authorities, leases, invites, residents and occupancies were removed afterward.
Notifications were intercepted: no external recipient or provider was contacted.
This is service/SDK/SQL evidence, not an authenticated HTTP or installed-screen
acceptance claim. Concurrent authority revocation between the new read and later
writes is still outside the guard's guarantee; the existing multi-write flow is
not atomic and R05 remains open.

Next, repair lease/occupancy consistency and retries using these existing tables,
with current authority and lease dates enforced at the same commit boundary.
The existing Home member/review transaction functions were compared: their
operations cover household roles/removal/reviews, not landlord lease activation.
Archived migrations `20260227000006_home_authority.sql`,
`20260227000007_home_lease.sql` and `20260227000009_home_lease_invite_dispute.sql`
already define the lease entities. This does not justify new renewal tables.
The existing web approval modal also drops edited dates. A rendered React/jsdom
probe changed the visible start/end inputs to 2026-10-01 and 2027-09-30, clicked
Approve Lease, and observed only the lease and authority IDs at the SDK boundary;
the modal closed as if saved. This is a reproduced component/caller defect, not
a real browser/HTTP acceptance claim. Its temporary probe is preserved privately
and removed from the checkout; it asserts the observed defect rather than the
desired behavior and is not counted among the 279 passing regression checks.

Private evidence: owner checkout
`.pantopus-recovery/audits/20260913-landlord-verification/`.
Its manifest binds the regression logs, original/candidate service-chain results,
SQL cleanup and private harness sources. Runtime credentials stay outside Git.


## Existing lease-date controls — September 13 draft

The follow-up branch `codex/lease-approval-dates`, based on `7f2a5e6d6`, repairs
the reproduced date-discard defect through four existing production files:
`RequestsTab.tsx`, the shared landlord SDK, `landlordTenant.js`, and
`landlordAuthorityService.js`. It changes no markup, classes, screen, layout or
schema. One focused web/SDK regression file is added; backend cases extend the
existing service and route test files.

Edited dates reach the existing lease update. Explicit null clears the optional
end date; omission preserves stored values for existing API callers. Unchanged
calendar dates retain their stored times, including a valid same-day lease.
Invalid date ranges remain visible in the existing modal and fail server-side
before activation. Request errors preserve the edits in the mounted modal;
this does not establish recovery after the server commits but its reply is lost.

Eight rendered React/shared-SDK tests and 187 existing/extended backend service,
pipeline and route tests pass. Five UI/SDK cases and eight service cases failed
before the repair. Web TypeScript passes; scoped ESLint has zero errors and one
pre-existing `any` warning. The new test initially used an unsupported Testing
Library option; removing that redundant option resolved its only type error.

Seven actual HTTP route → validation → authority resolver → service → Supabase
SDK → PostgREST → isolated PostgreSQL checks pass: edited values persist, null
clears the end while preserving the start time, old callers retain both dates,
malformed/equal/reversed dates do not activate or change the lease, and an
unrelated actor cannot change the dates. Authentication is controlled synthetic
middleware and notification delivery is intercepted; real login/provider or
installed-native acceptance is not claimed. Synthetic rows are cleaned; only
reference tables remain populated in the isolated database, and its owned
HTTP/REST runtimes are stopped with the lease released.

**Keep this patch in draft until lease and membership consistency is repaired.**
A separate real HTTP/SQL probe reproduced a future-start lease granting Home
access immediately. The same failure occurs when the lease already contains
the future dates and the caller submits no date edits, confirming that this is
in the existing activation path. Date persistence alone does not enforce the
lease window. Existing false approval success/blocked retry and expired
reactivation access also remain open; R05 is not closed.

The next repair must commit current authority, lease state/dates and the
appropriate membership change together; preserve an independently valid
household membership; prevent old completed approvals/invitations from reviving
removed membership; and make retry distinguish saved, rejected and incomplete
outcomes. Reuse the existing lease/invitation/occupancy/audit records and current
permission helpers. Separate PostgREST writes and a JavaScript return-flag change
cannot establish that transaction guarantee. The compared household transaction
functions cover different operations, so any necessary additive transaction
function should extend the existing entities, not create renewal tables or
replacement screens. Do not overwrite applied migration history.

Private source bindings, red/green logs, HTTP/SQL outcomes, access-window failure
probes and runtime cleanup are preserved in the owner checkout at
`.pantopus-recovery/audits/20260913-lease-dates/MANIFEST.json`.


## Existing lease decision transaction — September 13 draft

PR #38 now replaces the unsafe multi-write portions of the existing landlord
service with `decide_home_lease`, called by the same routes. Both approval and
denial receive the authenticated actor separately from the resolved authority;
the function rechecks direct, business-seat and legacy business-team authority
under locks. Invitation acceptance rechecks its exact verified issuer and
recipient. Existing Home locking and permission helpers are reused. The existing
lease/resident/occupancy/invite/audit writes commit or roll back together.

The migration `20260913050000_home_lease_decisions.sql` adds a service-only
function, **no tables**. The baseline, archived lease/invite schema, existing
Home invitation/residency functions and paid branch were compared. The existing
functions decide different records and cannot atomically complete this lease
flow; extending the existing entities meets the need. Completed intent and
membership-generation binding fit in existing service-only lease metadata.
Inventory: 51 Home / 21 paid / 60 combined versions, 12 identical shared versions,
zero collisions. Paused renewal draft `20260913040000` remains excluded.

A new or expired/removed membership receives the approved lease start/end as
both occupancy and access bounds. Independent current membership retains its
role, age, flags and window. A fresh admission retains age limits and explicit
denies; it does not revive old elevated Home overrides. Completed retries read
the existing result, never reactivate removed/replaced/expired membership.
Legacy active leases without this receipt are not automatically repaired.
Approval notifications describe approved dates and are attempted only after a
new committed decision; they remain best effort, not guaranteed delivery.

Verification at this draft:

- 134 service/pipeline/route checks pass. Existing admission persistence cases
  moved to the real SQL contract instead of reproducing SQL in a JS mock.
  Adapter checks cover authenticated identity, date omission/null, incomplete
  replies, transport/database errors, replay and asynchronous notification failure.
- The SQL contract passes authority, recipient, current membership, minor caps,
  dates, frozen Home, business/trust issuer, denial, replay and generation checks.
  Faulting the final audit write rolls back approval and invite acceptance;
  the original request remains retryable. Its generated pgTAP wrapper uses the
  existing CI runner. Application PL/pgSQL lint has zero errors.
- Twelve actual Express/Joi/authority-resolver/service/SDK/PostgREST/PostgreSQL
  checks pass, including all seven date cases, no-AddressClaim approval, actual
  denied future access, expired-row reentry, completed retry, removed-membership
  rejection and one-lease invite replay. Synthetic authentication and intercepted
  notifications are explicit limits. Only reference tables remain populated.
- Five actual multi-session SQL races pass: revocation while awaiting authority,
  approval/denial in both queue orders, simultaneous invitation acceptance, and
  expiry during a Home lock wait. They prove one consistent decision and no
  premature or revoked admission. They are not installed UI or provider evidence.

The existing web component/SDK source and its eight accepted tests are unchanged
by this transaction repair. Browser workflow and lease-end acceptance remain
next; R05 stays open. Earlier date-only and authority-guard reports retain their
source-specific limitations and are not retroactively relabeled.

Private source hashes, fixtures, logs and outcomes are preserved at the owner
checkout's `.pantopus-recovery/audits/20260913-lease-transaction/MANIFEST.json`.
Preparation failures (a wrong enum value, unsupported Home fixture type, short
non-hex invite fixture token, and running Jest outside its backend cwd) are
retained separately from passing application checks. None is claimed as a
production failure. Candidate exact-head CI is pending at this checkpoint.


### Existing browser follow-up and lease-end baseline

Transaction source `81cf3bef8d4c1338b1ca7d082561399bf8ec5698` passes all eight
executed checks in [CI34793608043](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34793608043),
including complete schema replay/lint/SQL contracts; three unchanged scopes skip.
The prior `6ca504854` run failed the required migration compatibility-header
pattern, with database consequently skipped. Its header correction adds no
function-body change; the failed run remains preserved.

The actual existing `PropertyDetail`, Requests and Leases components and theme
CSS ran in an isolated Next renderer, using the actual shared SDK, Express
routes, authority resolvers, PostgREST and SQL. Its shell supplies synthetic
authentication and intercepts provider notifications; full AppShell/login and
installed-native lease acceptance are not claimed. Chrome used an isolated
headless profile, with Pacific timezone explicitly set. No personal browser
profile or device was used.

Six browser cases pass: invalid dates send no request; server failure retains
edits; a lost reply after commit retains edits and the retry sends identical
intent, closes the modal and refreshes the queue; the Leases tab shows the
chosen October 1 calendar date while actual future access stays denied; canceling
denial sends no request; confirmed denial persists its reason and refreshes the
queue without admitting membership. Screenshots were visually inspected.

This found three small existing-component defects. The real SDK rejects with a
plain `{message}` object, so `instanceof Error` hid its message; the modal now
uses the existing `extractApiError` helper. The denial handler did not distinguish
Cancel from an empty optional reason; it now returns on null. Lease display
converted UTC calendar dates to the previous day in Pacific time; both existing
formatters now match the editor's UTC calendar day, while creation timestamps
keep their local display. Markup, classes, layout and navigation stay intact.
Two added cases fail before their fixes; all ten rendered component/SDK checks
pass afterward. The initial eight/nine-case TypeScript check passed, but the
later ten-case source `695a1cfb3` failed CI typechecking: two test-only Testing
Library role options incorrectly used `exact`. A chained local shell command
masked that intermediate TypeScript exit code; it was not a passing check. The
unsupported options are removed in the end follow-up, whose fresh standalone
TypeScript check exits zero. Scoped lint retains one existing `any` warning. Browser preparation used installed Chrome after the Playwright
bundled executable was absent; the initial missing-browser/expected-message
failures are fixture/setup evidence, not additional application failures.

The separate actual HTTP/SQL lease-end baseline **fails**: after preserving an
existing admin membership during approval, ending the lease removes that
independent access. Injecting a database failure on occupancy deactivation
returns HTTP 200 with the lease ended and Home access still active; retry returns
400. These precise failures are the next R05 repair. Existing lease/resident/audit
records must be compared before defining safe end/retry behavior, particularly
for historical memberships without a recorded generation. The draft remains
unmerged. Private evidence remains in the lease-transaction archive.


### Existing lease end and move-out follow-up

The end baseline is repaired in the same existing service, routes and pending
transaction migration; no table or screen was added. The lease end, bound access
withdrawal and audit now commit together. A failed write leaves the active lease
and access unchanged; a repeated completed end reads its receipt. Independently
granted household membership and a later membership generation are preserved.
The existing Leases tab reports actual API errors using the shared helper. Its
existing Ended filter now receives ended/canceled history from property detail;
previously the server excluded the records that this existing UI expected.
No markup, CSS classes, layout or navigation changes were made.

An additional actual HTTP/SQL baseline reproduced co-resident move-out ending
the primary resident's lease and removing the primary access while the departing
co-resident retained access. Self-departure now reuses the existing
`apply_home_member_removal` policy, including ownership transfer, grant expiry
and letter revocation. A co-resident leaves only their own membership; their
resident edge is retained in the existing audit's before-data, and an existing
lease-metadata receipt permits retry after removal. The primary lease and
membership stay unchanged. Restored membership rejects an old departure request
without writes. Co-residency alone cannot authorize ending the whole lease.
An explicit primary self-departure removes that person's independent membership,
including after a landlord ended the lease; landlord end itself preserves it.
The departure notification targets the departing actor. Provider delivery is
still intercepted in acceptance and remains outside this guarantee.

Current bounded verification:

- 125 existing service/pipeline/route checks and ten rendered web/SDK checks pass.
  End persistence assertions moved from the mock gateway into real PostgreSQL.
  Fresh standalone web TypeScript exits zero; scoped ESLint has zero errors and
  the existing one `any` warning.
- The expanded real SQL contract passes admission/end/self-departure, ownership,
  independent and restored membership, overlapping/historical rejection,
  unresolved-unit rejection and resolved-unit admission. A final end-audit fault
  rolls back canonical self-removal, its receipt and every associated write.
  Application function lint reports zero errors; the generated wrapper remains
  part of the existing complete-replay CI gate.
- Five actual end HTTP/SQL comparisons pass, including the two baseline repairs,
  failed/committed retries, new membership after end, and primary move-out.
  The separate co-resident baseline/candidate proves departing-only access,
  correct notification recipient, edge-removal replay, whole-lease denial and
  protection of restored membership through the actual routes and database.
- Seven actual multi-session SQL cases pass. In addition to the five admission
  races above, simultaneous end requests produce one audit and one replay; a
  serialized end followed by fresh admission survives an old end retry.
- Three actual Chrome/HTTP/SQL end cases pass: injected deactivation failure is
  visible and retryable; a lost reply after commit reports an error while access
  is withdrawn; retry refreshes the existing Ended history with one audit.
  The screenshot was visually inspected. The earlier six browser approval/denial
  cases retain their source-specific evidence. The isolated renderer, synthetic
  auth, controlled notification delivery and absence of full AppShell/login
  remain explicit limits.

CI `695a1cfb3` failed only the two test type errors described above;
[CI34794274687](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34794274687)
is preserved as failed. This end follow-up still requires CI on its pushed head.
The pending migration reuses existing Home locking and membership helpers; it
also retains the existing unresolved-unit admission boundary. It does not
backfill ambiguous historical membership bindings. Those landlord-end cases
require an explicit current membership review/removal through the existing Home
workflow before retry; that combined legacy journey is next to verify.

Source search finds the tenant move-out transport in both native apps, but no
current native screen caller of that lease-specific transport. This is not
installed native lease acceptance and is not authorization to build a new screen.
Reconcile the existing Home move-out path and the screen catalog first. Native
landlord verification forms, notification delivery, combined populated adoption
and hosted rollout remain open. R05 stays open; no additional acceptance row is
closed. Private source bindings, failed and passing evidence, renderer source and
runtime ownership are versioned under the existing lease-transaction archive.

Local migration policy validation and generated-wrapper checking pass. The full
local base-comparison process stalled in Xcode Git's `hash-object --stdin` and
was stopped, so it is not recorded as passed. Git's diff against the actual
Home integration base confirms only the new lease migration; applied baseline,
archive, legacy migration and policy bytes are unchanged. Required CI still runs
the original complete migration guard and full schema replay.


### Existing tenant status and cancellation follow-up

The end/move-out source `1f526de0dea0b2201218bcc7be4cc5b0955b19c3` passes all eight
executed checks in [CI34796831599](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34796831599),
including the original migration safeguards, complete database replay/contracts,
web production build and backend privacy gates. Three unchanged native/Seeder
scopes skip. Four additional actual HTTP/SQL legacy groups pass: ambiguous end
makes no writes; the existing protected Home self-removal handles a lost reply
and saved-command retry; landlord end then succeeds once; fresh admission survives
both old removal and old end retries. Both existing native Leave Home screens use
that already accepted removal controller; the relevant native source is unchanged.
No installed product rebuild or new native screen was needed for that comparison.

The existing `LandlordVerificationFlow` and its Verification Center entry called
`GET /tenant/home/:homeId/status`, and the existing Cancel Request control called
`POST /tenant/request/:leaseId/cancel`; neither route existed anywhere in the
backend. The actual existing browser showed the status 404 and retry error.
After connecting the status read, its pending state rendered correctly and the
cancel API independently returned 404. The tenant's approved screen also promised
full access before a future lease started; actual permission checks denied it.

The same route module now returns a no-store projection of this actor's own
primary lease and basic verified-landlord availability. It exposes no authority
identity, another resident, private lease metadata or internal decision receipts.
Stored landlord cancellation maps to the existing denial state/reason; a tenant's
own withdrawal maps to no pending request. Database read errors remain retryable
errors. The existing Verification Center previously treated them as no landlord;
one rendered regression failed before that fallback was corrected to the existing
landlord error/retry view. No replacement view was added.

Tenant cancellation extends the same still-unmerged lease transaction migration:
only the requesting primary tenant may withdraw a pending request, including in
a frozen Home. It saves its completion in existing lease metadata and audits once.
A completed retry cannot erase a landlord decision or grant membership. Withdrawal
and approval serialize on the existing Home/lease locks. Final cancellation-audit
failure rolls back the canceled state and completion receipt. No table or second
migration was added. The iOS transport's historical comment that these routes are
absent is now superseded by this server follow-up; its executable source is unchanged.

The existing tenant UI uses the shared SDK error helper for status/cancel errors,
retains its design, labels the recorded lease approval accurately, and displays
the same UTC lease calendar day as the landlord editor. Markup, layout, classes
and navigation remain unchanged; approval is no longer described as full Home
access. Current checks: 128 backend tests; 13 rendered web/SDK tests; fresh
standalone web TypeScript; scoped lint with zero errors/warnings; application
SQL lint; expanded real SQL rollback contract and generated wrapper all pass.
Two additional multi-session SQL races cover approval/cancellation in both queue
orders. Six actual tenant browser/HTTP/SQL groups pass: own-only safe status,
another actor's isolation, pending display, unauthorized/lost-reply/repeated
cancellation, saved denial reason, and truthful future approval/calendar display.
The inherited isolated-renderer/synthetic-auth/provider limits still apply.
Renderer alias configuration and alert-dialog locator errors were corrected as
fixture issues and are not counted as application failures.

The status/cancellation source still requires CI after its checkpoint is pushed.
Next: existing request submission and uncertain-reply recovery, then the remaining
native lease-verification consumers and stale-response/account boundaries. R05
remains open; these results do not close an entire acceptance row. The new private
source binding and evidence are under the existing lease-transaction archive's
`tenant-status-r1` directory; the end/legacy checkpoint is preserved separately.


### Existing request submission and response-loss follow-up

Source `08e0b617700ed8cbabc291c7d9837101b77cd518` failed
[CI34797859243](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34797859243)
in the pre-existing Verification Center Jest suite. Its API mock omitted the
tenant-status method entirely and threw, while its assertions expected successful
ordinary verification. The fixture now explicitly returns a successful no-landlord,
no-lease result; all existing behavior assertions are retained. The failed run
remains failed evidence. The current 37 rendered checks pass, including that
22-case suite and 15 landlord/tenant checks.

An actual HTTP/SQL barrier held both old request inserts after their preflight
checks. Both identical requests returned 201 and created two pending leases.
The existing request route now uses the same service-only lease transaction and
Home lock for validation, duplicate detection, insertion and audit. The candidate
barrier produces one 201, one 409, one pending lease and one notification attempt.
The transaction also checks current landlord authority, frozen/unresolved-unit
boundaries and valid dates. It grants no membership. Existing historical duplicate
records are preserved for review, not silently deleted or guessed into a lease.
The same unmerged migration gains optional trailing Home/message arguments;
existing decision callers remain compatible, and no table or second migration
was added. Only the exclusively owned schema-only DB had its old private function
signature replaced for testing; no deployed schema/history was changed.

The actual request form also stayed in a generic error after a reply was lost
following a successful insert, and retry returned 409. It now reads the existing
own-status endpoint after a failed response and recognizes a matching saved
pending/active request. Actual Chrome/HTTP/SQL confirms one saved request/audit
and transition to the existing pending view without another submission. When
status is unavailable or the saved intent differs, the form keeps its edits and
shows the real error. Rendered checks verify both response-loss recovery and
retained message/date after failed recovery.

An expired active lease previously selected the approved view, leaving no current
request control. Its status now projects the existing ended state based on the
saved end date without rewriting history. An actual browser/HTTP/SQL journey
selects the existing request form, creates one new pending request, and preserves
the expired historical lease. Existing layout, markup, classes and navigation
remain intact.

Current checks pass: 126 backend tests; 37 relevant rendered web tests; fresh
standalone web TypeScript; application SQL lint and the expanded SQL contract,
including final request-audit rollback. Scoped web lint has zero errors and two
existing `any` warnings in the older Verification Center test fixture. All 54
SQL wrappers verify. After the optional RPC arguments changed, the 12 actual
HTTP/SQL admission checks and five end/move-out checks pass again; their fixture
cleanup leaves only reference tables populated. This compatibility check does
not replace source-specific installed/native or provider acceptance.

Request source `9c31be7a3e75f40476fd30458ef957119c62913c` passes all eight applicable
checks in [CI34798866061](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34798866061),
with three unchanged scopes skipped. Next: stale read/action
results across Home/account/background changes and the legacy request API's lack
of a durable client command ID. Saved-status recovery proves response loss for
an existing record; it does not claim cancellation of an unseen submission or
retirement of every queued original. Reconcile those boundaries using existing
controllers and records before extending anything. R05, installed lease-verification
consumers, provider delivery and combined populated adoption remain open. Evidence
is versioned in the existing lease-transaction archive under `request-submission-r1`.

### Existing tenant Home/account boundaries

Two rendered baseline failures confirmed that a delayed status response could
replace the current Home/account view with the earlier tenant request. The
existing component now tracks the current read lifetime and uses the existing
SDK token-change and storage signals. It clears the prior view on account change,
validates the response Home, and ignores retired responses, errors and action
callbacks. A confirmation opened in an earlier account cannot send cancellation;
an old completed cancellation cannot refresh away the new account's draft. These
are changes within the existing component; no screen, visual markup or style was
added or replaced.

All 41 relevant rendered checks pass, including the original 22-case Verification
Center suite, wrong-Home response rejection and the two baseline regressions.
Fresh standalone TypeScript and scoped lint exit zero. Three actual Chrome cases
use the existing component/SDK and routed HTTP/SQL with synthetic actors: an old
actual 200 body is held and then delivered after the new account's status; an old
confirmation sends zero cancellation POSTs after account change; and a cancellation
commits before its held reply arrives, without erasing the new account's draft.
The old response's hash is recorded privately. The final draft screenshot was
visually checked. Six existing tenant lifecycle browser cases and lost-submission
recovery still pass with these guards.

The first private browser attempt used an ambiguous textbox locator because
Chrome also exposes the date input as a textbox; it is preserved as a fixture
failure. The corrected locator selects the existing textarea and all three cases
pass. This proves actual HTTP/SQL and component behavior under the existing auth
signal; it does not prove real login/cookie rotation or full AppShell behavior.
Background/focus, landlord view lifetimes, unseen/queued submissions and installed
lease-verification consumers remain open. Tenant source `0f54be50a6fc55b13b7425686d6f3c202ef3723c` passes all eight applicable
checks in [CI34799934365](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34799934365),
with three unchanged scopes skipped. R05 stays open, and the inventory remains 8 closed / 72 partial or open.
Private source-bound evidence is versioned under `tenant-account-r1` in the
existing lease-transaction archive. No backend, SDK or migration changed here.


### Existing landlord Home/account boundaries

Two rendered baseline failures reproduced late property reads replacing the new
Home/account view. Actual Chrome/SDK/HTTP/SQL then confirmed the privacy impact:
an authorized response containing tenant email was held, the new synthetic actor
received HTTP403, and delivery of the old body restored tenant details and Approve
controls. That old response also had no cache-control header. The baseline body
hash and screenshot are retained privately; they contain synthetic fixtures only.

The existing PropertyDetail component now clears retired data, uses the existing
SDK account signals, validates the returned Home and collections, and passes a
required current-lifetime guard to the existing approval/denial/end controls.
Late completions cannot refresh a newer view; retired end errors cannot alert the
new account; a denial prompt cannot send after an observed account change. Existing
child state resets when a new detail lifetime is accepted. The same property route
now marks successful and rejected responses private/no-store before authentication.
No SDK, service, migration, visual layout or stylesheet was added or changed.

The actual held-response candidate keeps the existing HTTP403 error view with no
tenant details or approval controls, and its authorized response is private/no-store.
A second actual case commits approval in SQL, holds its successful HTTP response,
changes account, then delivers the reply: the new denial view remains, with one
approval/audit and no extra property refresh. Screenshots were visually checked.
All 46 relevant rendered tests and 66 route tests pass; standalone TypeScript exits
zero. Scoped lint has zero errors and one pre-existing metadata `any` warning.
An initial new ref-cleanup warning was corrected by capturing the existing lifetime
object in the effect. Six actual approval/denial browser cases and three lease-end
failure/lost-reply/retry cases remain compatible. SQL behavior is unchanged, so its
accepted lifecycle/race evidence is reused.

Evidence is source-bound under `landlord-account-r1` in the existing private lease
transaction archive. Landlord source `1a17a22a9fe5e4490e56290f1d51f50af1d0fa39`
passes all eight applicable checks in
[CI34800605686](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34800605686),
with three unchanged native/Seeder skips. The boundary
is actual component/SDK/HTTP/SQL with synthetic authentication, not full AppShell,
real login/cookie rotation or native acceptance. Background/return behavior and the
legacy queued-submission boundary are next; validate the existing workflow before
adding anything. Provider delivery, populated adoption and hosted rollout remain
open. R05 and the 8/72 inventory are unchanged.

### Existing native submission-error follow-up

The existing iOS/Android verify-landlord wizards mapped every HTTP 400/404 response to
mail verification and every HTTP 409 to a saved lease. Actual routed HTTP/Joi/service/SQL
confirmed distinct failures: frozen Home, missing unit and invalid dates return400;
a missing Home returns404; no verified landlord has its own400 message. None saved
a lease. Android's new regression failed on the frozen case on all three automatic
retry attempts; these are one failing test, not three independent defects.

The existing view models now branch only on the known duplicate/no-landlord
responses and retain the form/error for other failures. The current API does not
provide a stable typed code for these cases; unknown response text stays an error.
The existing status/cancellation routes were also incorrectly described as missing
in native endpoint comments; those comments now state that the wizard does not yet
consume them. No endpoint, table, service or replacement screen is added here.

Source tracing also found that both Details screens rendered validation errors
but did not bind submission errors. They now show them using the existing error
banner in its existing position, with the same colors, typography, spacing and
fields. Android's focused view-model suite passes; all three Details Paparazzi
checks pass, preserving the two old goldens and adding only the new error-state
test image. That new rendering was visually checked. SwiftLint 0.63.3 and
SwiftFormat 0.61.1 pass the changed Swift files. All 32 focused iOS tests pass, including a meaningful rendered check that captures
the existing banner and recognizes the visible error text with Vision. Its exported
image was visually checked. The other six existing render checks alone assert
structure, not pixel equivalence; they are not relabeled as full visual acceptance.

The first iOS baseline attempt stopped with exit73 before tests during disk
exhaustion. The next local build failed because its ignored generated project
omitted native files that already existed in the repo. These are retained as
infrastructure failures, not product test results. Old disposable compiler
intermediates were removed to recover space; app bundles, source and test evidence
were preserved. The generated project was backed up and regenerated directly,
without rewriting private environment overlays. The focused retry passed on an
exclusively created simulator, with one heavy local native build at a time. That
simulator is now shut down and deleted; the private native runtime lease is
released. The unrelated pre-existing simulator was preserved.

Local native acceptance is source-bound in `native-errors-r1` under the existing
private lease-transaction archive. Native source `29603b01a9151705c44456950e0d46dfb7bf40f6` passes all15 applicable checks in [CI34803605947](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34803605947), with one unchanged Seeder skip. Its changes are limited to existing models, callers/comments, error-banner
bindings and relevant tests; the only new tracked file is an Android test PNG. It does not establish installed end-to-end lease
verification, account/background retirement, native lost-response recovery, actual
email delivery or all wizard claims. In particular, the existing one-time-email
copy still requires provider/workflow reconciliation. R05 stays open; preserve
existing forms and implement only demonstrated unmet behavior in their current
callers/controllers. The actual HTTP error matrix, Android baseline/candidate and snapshot checks, iOS
failed attempts/passing result bundle, exported image, lint and formatting logs
are retained with their source binding. The five HTTP scenarios cleaned their
synthetic rows. Backend/service/SQL behavior did not change during this native
follow-up, so its accepted lifecycle/race/rollback evidence is reused.


### Existing queued tenant-request follow-up

Actual Express/Joi/service/SQL reproduced a delayed request being saved after its
identical retry had already been saved and canceled. The first authenticated call
was held before SQL while the client stopped waiting. Status was `none`, the retry
saved one pending lease, cancellation returned status to `none`, and releasing the
original produced a second pending lease. This is a request-ordering defect, not
missing tables or screens. The baseline is bound to `29603b01a` in private evidence
`queued-request-r1`.

The existing status response now includes an observation of this actor's latest
lease: Home, actor, lease ID and stored state. The current web form sends that
observation in `request_context`. The same service-only lease transaction compares
it under its existing Home lock before inserting. A stale observation returns409
without adding a lease, audit or notification. Creation timestamps use the clock
after acquiring the lock, so a transaction that waited does not sort its new row
behind an earlier committed request. The context also binds the stored state:
a focused SQL regression showed that an ID-only comparison would miss cancellation
of the same observed pending lease. The final candidate rejects that case too.

The form preserves its edits and observed context after a lost response. If its
recovery read establishes a newer `none`/`ended` status for the same actor/Home,
only a subsequent user click submits with that new observation. Recovery does not
automatically submit. Missing context fails closed in the existing error view.
Existing forms, styling, routes and tables are reused; the single unmerged lease
migration is updated rather than adding another migration or command table.

Local verification passes: 122 focused backend tests, 48 rendered web tests,
standalone web TypeScript, scoped ESLint and the complete lease SQL lifecycle/
rollback contract. All54 generated SQL contract wrappers are synchronized. Actual
HTTP verifies the delayed original leaves exactly one canceled lease and two
existing submit/cancel audits; another actor's context returns409, malformed
context returns400, and an explicit fresh context succeeds201. Actual Chrome uses
the existing form/SDK/HTTP/SQL: first request loses its browser reply while held
before SQL, identical retry saves, the existing confirmation cancels, and the
original later receives409 while the form stays canceled. Another explicit click
uses the canceled lease observation and saves a fresh pending request. Notification
assertions use the existing intercepted fixture, not provider delivery.

The first fixture attempts stalled in Docker's control interface before a useful
product result. Setup/read/cleanup were switched to the already-owned REST service;
direct PostgreSQL access verified the exact owned database before applying the
candidate and running its rollback contract. An initial direct connection lacked
function ownership; subsequent private helper syntax errors ran no SQL. A local
PL/pgSQL lint attempt found that extension absent; no local PL/pgSQL-lint pass is
claimed. Required complete-schema CI remains the gate. All attempts are retained
with their stated boundaries, and synthetic acceptance fixtures are cleaned.

**Limits and next:** `request_context` remains optional for older API clients.
Existing native wizard callers still omit it and therefore do not yet have this
queued-original protection. Continue in those existing controllers and SDK models,
then verify account/background/restart and installed lease-verification journeys.
The successful browser uses an isolated renderer and synthetic authentication,
not full AppShell/login. R05 remains open; provider delivery, combined populated
adoption and rollout remain open. Queued-request application source `25c6a5c01` at `1e4d5a644` passes all 15 applicable
checks in [CI34806113797](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34806113797), with 1 unchanged Seeder skip.


### Existing native and second web request context

The two native request controllers and the separate existing web details route
were still omitting the observation used by the queued-request repair above.
They now GET the existing tenant status, validate its Home/actor/lease tuple, and
include it in the existing POST. Failed or malformed status prevents submission.
The existing Joi route normalizes omitted native nil lease fields to null. The
second web route also retires callbacks on account/Home changes and unmount.
Existing form markup, styles, routes and database migration bytes are unchanged.
No new product file, table or migration was added in this follow-up.

Verification passes: 27 focused iOS and 26 Android tests exercise actual native
network clients/repository with stub responses, including failed status, malformed
context and an explicit retry observing cancellation. Web has 51 rendered checks,
standalone TypeScript and scoped ESLint; 122 backend checks and scoped Swift
format/lint pass. Actual HTTP/Joi/service/SQL accepts omitted nil fields, rejects
a stale original/another actor's observation and permits an explicit fresh request.
Actual Chrome uses the separate existing details route and SDK: a failed status
preserves edits without POST, an old account's delivered status cannot POST or
navigate, and current status → POST saves exactly one pending lease and reaches
the existing submitted route. Notifications are intercepted fixture calls. An additional browser check simulates
a 401 and successful cookie-refresh response through the actual SDK: its status
retry retains the draft and saves one pending lease. It does not verify the identity
provider itself.

The browser's first final database assertion mistakenly selected a nonexistent
`HomeLease.notes` column; correcting only that private assertion produced the
passing run. Earlier native lint failures and the passing corrected runs remain
in private evidence. The source-bound archive is `native-context-r1`, with native
results, captured request bodies, browser evidence and preserved compiled products.
The web renderer uses synthetic authentication; native network checks are separate
from actual HTTP/SQL. Full login, installed native account/background/restart,
response-loss recovery, provider delivery and combined adoption remain open.
The submitted route still has unconditional notification/time-estimate copy,
and native one-time-email claims need reconciliation. R05 stays open.

At the user's request, unused completed test devices were cleaned: six iOS
simulators, two Android AVDs and one tiny unregistered AVD folder. Exact inventory,
exit codes and preserved devices are in private `device-cleanup-r1`; observed free
space increased 6.46GiB. The owner running simulator and current retained iOS/Android
acceptance devices remain. Shared SDK/runtime images, products and evidence remain.


### Existing Android request departure

At `c8127ddbe`, a focused actual-model/repository probe held the status GET,
used existing Back then Discard, and released the GET. The abandoned work still
called request-approval. One regression case failed all three configured retry
attempts; this was not three separate defects. The baseline is preserved in
`native-discard-baseline-r1`.

The existing controller now owns/cancels its pending job when leaving. The
repository checks cancellation after status and before POST; the controller
checks again before consuming a returned result. The 28-test focused suite and
formatting pass. The two new checks deliberately deliver responses despite
cancellation: an abandoned status cannot POST, and a late submission result cannot
restore Sent or replace dismissal. Existing screen markup/design is unchanged.
The first formatting attempt rejected two overlong test lines before tests ran;
the corrected run passes. Candidate source/results are in `native-discard-r1`.

This does not undo a POST already committed by the server, nor prove installed
navigation, account switching, background/restart or iOS departure behavior.
The next check is the equivalent iOS departure case, followed by installed native
verification and saved-state recovery. R05 stays open.


### Existing iOS request departure

At source `10c68a906`, a delayed actual APIClient status response still caused
POST and moved the existing iOS wizard to Sent after Back/Discard. One regression
failed four assertions. The existing controller now owns/cancels queued work and
checks its generation before POST and before consuming a result. The view retires
work on disappearance. Existing markup, styling, layout and routes are unchanged.
The three regressions cover delayed status, deliberately delivered old success/
error/fallback results, and a queued tap retired before execution. All 30 focused
iOS tests and pinned SwiftLint/SwiftFormat pass. The new file contains tests only,
sharing the existing fixture helpers; it keeps the original test file below the
repository's 500-line lint limit. The first candidate build failed to compile a
test helper's escaping predicate; the corrected candidate passes.

An installed Xcode-signed Debug app on an exclusively owned iPhone16 simulator
uses its real login UI, navigation, wizard and APIClient against a loopback fixture.
Login/profile/shell responses are synthetic; tenant status and request routes use
the actual Joi/service/isolated SQL, with notifications intercepted. Back → Close
→ Discard while status was held closed the wizard; the transport disconnected,
and releasing the retired response left zero POSTs, leases and notifications.
The app remained on Hub. This proves cancellation through the installed screen;
it does not claim old bytes were delivered after disconnection. Separate model
regressions deliberately deliver late results. A first UI attempt was inconclusive:
the status timed out and its automatic retry submitted before Back was performed.
That attempt and its fixture reset are retained, not counted as a departure pass.
The first manually re-signed test copy lacked keychain signing metadata; Xcode's
normal simulator signing resolved the setup issue without auth-source changes.

Actual UI also reproduced open defects: Attach proof instantly inserts the sample
`lease_apt3b_2025.pdf`, claims upload and parsing, and sends no upload request. The
Home chip shows the sample Elm Street address for the synthetic Home. Existing
email-delivery claims remain unsupported by this fixture. Existing real file
pickers/private claim evidence paths have been located for reuse analysis; no
replacement upload subsystem, screen or migration was added. Attachment, true
Home identity, saved-request recovery and native account/background/restart remain
open. R05 is not closed by these focused checks.

[CI34808888971](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34808888971)
on `10c68a906` completed with 13 successful jobs, an Android static-analysis
failure and the resulting aggregate failure, plus one unchanged Seeder skip.
Detekt rejected a four-part condition in the existing TenantRepository. Splitting
its Home comparison into a named boolean preserves behavior; local full detekt,
ktlintCheck and all 28 focused Android tests now pass. Corrected checkpoint
`6dbad11dea67c2da52d58e87247b2f207996ba80` passes all15 applicable checks in
[CI34811429769](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34811429769),
with one unchanged Seeder skip. Source, baseline/candidate results, installed-product hashes,
fixture observations and failed attempts are retained privately in
`ios-departure-r1`. The temporary simulator remains exclusively leased for the
next installed checks and will be removed when those checks finish.


### Existing iOS saved-request recovery

Installed source `6dbad11de` saved a pending request through the actual tenant
route/service/SQL, but the held reply timed out. The existing error banner kept
the form; terminating/relaunching the app and reopening the existing deep link
returned the empty Start screen. The status endpoint already returned the actor's
saved lease, but the iOS DTO discarded it and the wizard did not read on appearance.
The initial private assertion expected a still-connected reply; it had already
timed out, so no termination ran until the next controlled call. The timeout and
empty restart are retained as the actual baseline, not a before-timeout kill.

The existing DTO now decodes that lease envelope. The existing wizard reads it on
appearance, validates Home/lease/state identity and shows the same pending/active
confirmation with its saved date/message. Recovery only GETs; it never creates a
request. Failed/malformed reads offer Retry status before entering the form.
The existing error banner is shared with Start rather than copied. The existing
HomeClaimSessionScope binds the controller to its opening account/session. Changed
sessions retire work, clear the private draft/result and dismiss; stale preflights
cannot POST and late request replies cannot restore Sent. Existing views/layouts,
navigation and database bytes are preserved. Same-file extensions keep the existing
controller/tests within lint's type-body limit; no new product or test file was added.

All43 selected iOS tests pass:36 model/network cases and7 existing rendering cases,
including the visible error text. New cases exercise pending/active recovery,
no-request continuation, failed/malformed read retry, departure during recovery,
account change during recovery/preflight, and a delivered POST reply after account
change. Pinned SwiftLint/SwiftFormat pass. Earlier build failures were the existing
banner's private access modifier and an extra test-only argument accidentally added
to two postcard constructors; both were corrected before the passing test run.

The source-bound Xcode-signed candidate was installed on the exclusively owned
simulator. Reopening the same saved request displays Waiting for approval and its
exact persisted details; the database still contains one lease and one original
POST. Native Settings logout → Not you → second synthetic account → same Home
shows Start without the prior tenant confirmation/message. The server observes the
second actor's own status request; it leaves the first tenant's lease unchanged.
Login/profile/Hub are synthetic, tenant routes/Joi/service/SQL are real and isolated,
and notifications are intercepted. This does not verify an identity provider or
provider delivery. The sample attachment was used solely to satisfy the currently
broken form and remains a confirmed defect, not upload acceptance.

Private `ios-recovery-r1` retains source hashes, result bundles, compiled product,
fixture states, UI observations and failed attempts. The equivalent Android
recovery and native foreground refresh remain open, along with the documented
attachment, sample Home label and delivery-copy issues. Existing accepted web/SQL
and native Leave Home evidence is reused. R05 stays open and the80-row inventory
remains8closed/72partial or open. The prior pushed6dbad11de checkpoint's
[CI34811429769](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34811429769)
completed successfully on September14: all15 applicable jobs passed and Seeder
was skipped. This later recovery candidate requires its own remote CI before integration.


### Existing Android saved-request recovery

Source inspection at `9c31bc40d` confirmed the same concrete gap as the installed
iOS baseline: Android's existing status DTO discarded the returned lease, and its
wizard did not read status when opened. The existing DTO/repository/wizard now
recover matching pending/active requests into their existing confirmation, with
stored dates/message and GET only. Home, actor, lease ID and state are checked.
Failed/malformed reads keep the draft and require a status retry before Details.
The existing error banner is reused; layouts, styles and navigation are preserved.

The existing HomeClaimSessionScopeFactory binds the wizard to its opening session.
Changed accounts clear drafts/results and dismiss. The repository checks current
credentials before preflight and again before POST; the controller checks after
responses. Departure cancels owned work, including screen disposal. Explicit
cancellation checks also surround the suspended credential check, so an old read
cannot restore a confirmation after departure. No new product/test file, service,
endpoint, table or migration was added. Test cases share fixtures within the
existing test file to satisfy its class-size limit.

All37 model/session checks pass, including decoded pending/active recovery,
failed/malformed reads, other-actor data, deliberately noncancelable old reads and
POST replies, stored-session replacement before its account flow updates, and
clearing an already visible confirmation. Both existing Start snapshots pass.
The three existing Details snapshots pass after their synthetic session mock was
updated to answer the new credential check. Before that fixture correction, the
validation-error variant failed three retry attempts because validation never
started; this was one variant, not three product defects. No golden image changed.
Full local detekt/ktlintCheck pass. Earlier formatting/class-size check failures
are preserved in private evidence rather than relabeled as successful runs.

An isolated Android API34 baseline APK was built and installed on an exclusively
owned temporary emulator. The computer-control surface did not establish a usable
installed app session; login/restart/account behavior is therefore **not accepted
on installed Android**. The emulator is stopped with its private data retained;
no retained owner/acceptance device or shared runtime was removed. The baseline
APK, source-bound checks, images and limitations are durably retained privately
under `android-recovery-r1`. Provider identity/delivery and native foreground
refresh remain separate acceptance boundaries.

At September14's next check, 8,536 older tracked files and the Git link were
missing from the temporary worktree, and its Gradle project cache lacked metadata.
The committed head and all six edited Kotlin files survived; current files were
copied before repair. Only missing tracked files were restored from `9c31bc40d`;
existing files and unrelated owner work were preserved. A fresh private Gradle
project cache restored validation. The wrapper-not-found and cache failures ran
no tests; the precise missing-file list and retained changes are in private
`worktree-repair.json`. The cause of the temporary-file loss was not established.

Checkpoint6dbad11de's prior remote CI is green; this newer recovery source still
requires its own remote CI. R05 remains open. Next: installed Android acceptance,
both native foreground/indeterminate-reply behavior, and the confirmed attachment,
Home-label and provider-copy defects through existing implementations.


### Existing native foreground checkpoint and user-requested pause

At the user’s September14 pause request, the foreground checks already running
were completed. The existing iOS scene-phase and Android lifecycle hooks now
retire pending requests when the wizard backgrounds and reread status when it
resumes. Details and Sent use the same status recovery as Start. A no-request
response preserves an unfinished Details draft. A failed read reuses the existing
banner and primary button for GET-only status retry before Submit or Done, even
when an old validation error remains. This changes behavior within existing
screens; no new product/test file, layout, service, endpoint or schema was added.

All49 selected iOS tests pass:42 model/network and7 existing rendering checks.
SwiftFormat0.61.1 and SwiftLint0.63.3 pass. All48 Android tests pass:35 wizard-model,
8 session/foreground and5 unchanged Start/Details snapshots. Full detekt/ktlint
checks pass. Each platform adds six cases in its existing test file: pending to
active refresh, draft preservation, failed Details/Sent reads, delivered old
reads and a committed POST whose retired reply arrives after fresh active status.
Earlier formatting-only failures remain in the private run records; the completed
candidate checks have zero failures. Snapshot goldens were not changed.

Installed foreground acceptance remains **open on both platforms**. The compiled
iOS candidate was installed and launched, and normal Settings logout completed;
the user requested a pause before the tenant foreground journey. Android installed
recovery/foreground acceptance also remains open. Model and rendering checks do
not establish installed lifecycle wiring or provider identity/delivery. Prior
installed iOS departure/restart/account evidence remains valid for its bound source.

The owned API18109 and web18110 processes were stopped, with no remaining listeners;
the native fixture server confirmed cleanup of exact owned rows. The owned iOS
simulator is Shutdown and the Android emulator was already stopped. Their data and
accepted evidence are retained. The isolated lease DB/REST remain reserved for
resume. Owner/accepted devices, shared SDK images and unrelated checkout edits were
preserved. Source bindings, result bundles, compiled iOS product, Android XML results
and pause records are durably retained under the private `ios-foreground-r1` and
`android-foreground-r1` audit directories outside `/private/tmp`.

Checkpoint6dbad11de remains the last completed remote CI evidence:15 applicable
checks passed with one unchanged Seeder skip. This later native recovery/foreground
checkpoint is saved to draft PR#38 and needs its own CI before integration. R05
stays open and the inventory remains8 locally closed /72 partial or open /80.
Resume with installed native acceptance, followed by the documented placeholder
repairs; no new work item was started after the pause request.


### Resumed native foreground and confirmation display verification

The user resumed verification on September14 from clean/pushed9d344bcf0. PR38
remained open/draft against the same Home branch. Its CI34820697178 had13 successful
jobs and one unchanged Seeder skip at the latest check; Android quality and the
aggregate result were still outstanding. Do not infer final success from earlier CI.

The saved installed iOS product passes actual Home-button/app-icon lifecycle
transitions against the existing tenant routes/Joi/service/isolated SQL: an
unfinished Details draft survives a no-request reread; a pending request saved by
another synthetic HTTP client appears on foreground; and the same lease refreshes
to active after the existing authority service/SQL approval. Only the intentional
external client sent POST; foreground actions added GETs only. One held status
response timed out and the existing idempotent GET retry recovered active status.
Synthetic login/shell and intercepted notices remain explicit limits.

That installed journey exposed a stored September1 midnight-UTC lease date shown
as August31 on the Los Angeles device, plus active confirmation still promising
notification and approval. Both existing native confirmation formatters now follow
the existing web caller's UTC calendar-date rule for lease dates, while submission
timestamps retain local date formatting. The existing status note distinguishes
pending from active and no longer promises notification delivery. Submission copy
states that the request is saved for review. No layout, screen, table, endpoint or
migration was added. An obsolete comment claiming the status endpoint did not
exist was corrected in the same existing iOS view.

All50 selected iOS checks pass with SwiftFormat0.61.1 and SwiftLint0.63.3. All49
Android checks pass (44 model/session/date +5 unchanged Start/Details snapshots),
with detekt/ktlint and debug APK assembly. Each platform adds one regression in an
existing test file covering lease date preservation and local submission dates in
Los Angeles, Honolulu and Auckland, plus absent/malformed dates. Installed iOS
visibly confirms September1 and the active-lease note using the same saved lease.
The first Android invocation misplaced the test filter after assembleDebug and
ran no tests; the corrected command passed. The failed command is preserved.

The owned Android AVD is now visible in Android Studio Running Devices after
registering its existing private definition; no second emulator or SDK was added.
The current tested APK installed successfully. Computer control nevertheless
repeatedly switched from the rendered device to the IDE window, so **installed
Android recovery/foreground remains unaccepted**. The IDE's automatic sync also
encountered the previously recorded missing project-cache metadata; the passing
CLI checks used the preserved fresh project cache. These are tool/runtime limits,
not evidence of an app-flow failure. No owner or accepted device was modified.

Private source/product bindings, result bundles/XML, HTTP/SQL state and installed
iOS observations are retained outside `/private/tmp` in `native-resume-r1` and
`native-display-r1`. A broken dependency link to an older temporary checkout was
repointed to intact existing owner packages without modifying those packages.
R05 stays open; the inventory remains8 locally closed/72 partial or open/80. The
fake attachment/upload/parse behavior, sample Home/unit and remaining provider
claims still need repair in their existing paths.

### Existing native identity, attachment and calendar input follow-up

The installed iOS app exposed sample address/unit values and an Attach button that
inserts a fixture filename without uploading or parsing bytes. The backend request
contract accepts dates/message and does not require an attachment. Both existing
native wizards now start empty with a neutral rental label, no longer require the
fake file, and never append its name as an uploaded lease. Attach reports that
upload is unavailable through the existing feedback area. Real private lease
attachment remains unfinished: existing HomeDocument and ownership-claim evidence
storage were inspected, but their membership/claim authorization cannot be treated
as permission to expose pre-admission tenant documents.

Native Start/Details and the two existing web presentations now describe saved
requests and verified-owner review without promising one-time email, delivery or a
response deadline. The separate submitted URL does not itself prove submission;
it directs users to its existing Check Status action. No styles, layout controls,
navigation, product files, tables or migrations were added for these changes.

All50 selected iOS checks and49 Android checks pass, with Swift lint/format, Android
detekt/ktlint and APK assembly. Four existing Android image references have text
updates and were visually inspected; the unchanged fast-track pixels retain their
original PNG. Initial Android identity verification failed three distinct checks
that depended on the former live sample unit; its existing fixture seam now
explicitly supplies that unit for mismatch tests/snapshots. Retries are not counted
as additional coverage. The first Swift static pass found a trailing-closure and
test-class-size limit; using trailing syntax and moving one test into the existing
extension resolves both without suppressions. All29 existing web lease tests pass;
scoped ESLint has zero errors and one unchanged effect-ref warning.

Actual HTTP/SQL separately reproduced an impossible February31 being saved as
March3. Joi normalized the string before the existing SQL calendar check. The
three existing lease date schemas now retain the raw ISO input. Three actual
invalid-start/end cases return400 with zero leases/notices, while a leap-day and
offset timestamp preserve their intended dates/times. All130 selected route,
authority-service and pipeline tests pass, including the real validation middleware
for request, invitation and approval schemas. This reuses the existing SQL guards.

The normally signed installed iOS candidate uses real login/wizard UI, synthetic
auth/shell and actual tenant routes/isolated SQL. It displays the neutral rental,
reports Attach unavailable without a file, retains contact/date fields after the
actual February31 rejection, and saves one pending request when only the date is
corrected to September1. Its confirmation has the correct date and contact note,
without a lease-file claim. Exactly two intentional request POSTs occurred: one
rejected, one saved. The single notification attempt was intercepted; delivery and
real provider identity are not accepted. Installed Android journeys remain open.

Private source/product bindings, test results, HTTP states and visual comparisons
are retained in `native-identity-r1`, `native-truth-r1` and `calendar-input-r1` under
the existing durable audit directory. The prior foreground source9d344bcf0 passes
all15 applicable [CI34820697178 checks](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34820697178),
with one unchanged Seeder skip. This follow-up needs its own exact-source CI.
R05 remains open, and the inventory remains8 locally closed/72 partial or open/80.


### Existing unit vacancy and child lease visibility

September14 resumed follow-up, based on113d4cdc6. Existing UnitsTab used a
nonexistent mark-vacant endpoint. The property-detail route returned units but
queried only the parent Home's leases, so an occupied child appeared vacant.
Four rendered baseline cases and two route cases reproduced the defects.

The existing route now reads child leases only for units with a verified authority
matching the subject already resolved by requireAuthority. A parent relationship
alone grants no access to another owner's tenant details. Query failures fail the
read instead of presenting vacancy. The existing unit DTO marks status unavailable
when that authority is absent. The Units tab reuses endLease and the existing
confirmation dialog, displays failures for retry, prevents duplicate actions and
retires callbacks on tab/Home/account departure. Other leases and independent Home
membership retain the existing transaction policy. No new file, table, migration,
replacement service, screen or style was introduced.

All134 selected backend and38 rendered web tests pass, with standalone TypeScript,
scoped ESLint (zero warnings/errors) and diff checks. Native source is unchanged;
its accepted50 iOS/49 Android and static/assembly evidence is reused. Private
same-version dependency repair restored missing qrcode types/jsqr files using
archives verified against the existing lockfile; no manifest/lockfile changed.

Actual Chrome/component/SDK/HTTP/authority/SQL checks verify the managed active
lease, withhold the other owner's lease/tenant data, cancel with zero POSTs,
retain an active row after a controlled503, and retry through the real transaction
to an ended lease/inactive lease occupancy and refreshed Vacant row. A held reply
delivered after leaving Units for Requests causes no alert or extra property GET.
The existing styled layout was inspected after correcting only the private test
renderer's stylesheet setup. Auth/shell are synthetic and notices intercepted;
provider delivery and independent-membership UI cases are not claimed here.

Evidence: private unit-vacancy-r1 contains source-binding.json, baseline/candidate
results, browser-acceptance.json and exact-row HTTP/SQL snapshots; mirrored under
.pantopus-recovery/audits/20260913-lease-transaction. API18111 and private Next18110
are owned local fixtures. Prior API18109 and iOS simulator are stopped; Android
AVD/IDE remain stopped. No unrelated device or checkout was modified.

Next: the existing invitation path, whose notification target has no matching
lease acceptance page, and the existing bulk unit tools whose SDK endpoints are
missing; inspect shared implementations before repair. Private attachment,
provider delivery, installed Android acceptance and adoption/rollout remain open.
R05 and the8/72/80 inventory are unchanged.


### Existing lease invitation landing and acceptance

The stored lease-notification URL had no matching web page, while the tenant SDK
and atomic acceptance transaction already existed. The existing Next configuration
now redirects that URL to the existing Enter Invite Code screen with an explicit
lease type. The screen preserves its markup/styles, previews the invitation for
the authenticated recipient, confirms Home/dates/account, then uses the existing
acceptance API. Ordinary Home codes open the existing protected invitation page
instead of invoking its older acceptance path. Login preserves the destination.
No new screen, file, table, migration or acceptance service was added.

The existing landlord service/route/tenant SDK now expose a read-only recipient
preview. Raw proof stays in the POST body; the response is private/no-store.
Hash/authority fields are excluded, mismatched account/email returns no Home data,
and expired pending invitations or revoked authority cannot offer acceptance.
Accepted invitations can be previewed for retry; the unchanged transaction decides
whether the original acceptance remains recoverable. The screen retires delayed
reads, confirmations and completions on account changes or unmount, blocks duplicate
submissions and retains the code after failure. A saved acceptance directs users
to My Homes; it does not promise current access independent of lease dates.

Seven rendered baseline checks failed on the old path. All144 selected backend
and49 rendered checks now pass, including wrong-account/malformed preview,
cancel/account/unmount confirmation, delayed read/result and lost-reply retry.
Standalone TypeScript and scoped ESLint pass. Unchanged native and SQL acceptance
contracts retain their earlier source-specific evidence.

Actual Chrome follows the old notification URL through the redirect and existing
screen, previews the correct September1 dates, and cancels without acceptance.
The real existing HTTP/service/SQL transaction then saves one active lease and
occupancy while a controlled503 hides its success. Retry recovers the same IDs
with no duplicate records and reaches My Homes. Actual HTTP preview rejects a
wrong recipient and malformed proof without a lease write. The styled existing
screen/dialog were visually inspected. Full navigation cancels a held connection;
in-app Back leaves it connected, and releasing the reply leaves the destination
visible. Rendered tests separately prove no retired callback navigation/toast.
Auth and the destination shell are synthetic; no provider email/native link
acceptance is claimed.

Private lease-invitation-r1 holds source-binding.json, baseline/candidate results,
http-preview.json and browser-cancel/saved-failed-reply/recovered/held evidence.
The initial copied fixture collided with the preceding fixture's synthetic email;
the old fixture was stopped and cleaned before retry. Current owned API18112 and
Next18110 are active. Unit fixture18111 is stopped and its final exact-row state
is retained. Durable evidence remains in the existing private audit directory.

Next: existing landlord invitation creation/sharing and real multi-unit admission
validation, then missing bulk unit handlers. Private lease attachments, provider
delivery, installed Android acceptance, combined adoption/rollout and R05 remain open.

Native identity/date source113d4cdc6 now passes all15 applicable checks and1
unchanged Seeder skip in [CI34827611210](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34827611210).
The unit/invitation follow-up is saved to PR#38 and requires its own CI.


### Existing landlord sharing and parent-building admission

The existing invitation modal discarded the service's raw sharing token and
closed immediately. It now keeps the created link in its existing input, reuses
the existing buttons for Copy Link/Done, and explains that email delivery is not
confirmed. Creation errors retain the form; copy errors leave the full link for
manual copying. Incomplete or wrong-Home results cannot claim a saved link, and
closed/account-retired callbacks cannot refresh or reveal it. Dates retain their
calendar values and obvious missing/reversed ranges do not submit. Markup classes
and layout are preserved; no replacement screen or new file was added.

Six rendered baseline checks failed; all58 existing lease/web checks now pass,
including clipboard failure/retry and malformed response cases. Types/scoped lint
pass. Actual browser/SDK/HTTP/SQL checks cover a controlled503 with no invite or
notice, retained form, a created/copyable link, Done refresh, then that link's
recipient preview and acceptance into one active lease/occupancy. The existing
modal was visually inspected. An initial .invalid fixture email was correctly
rejected by real email validation; reserved example.com fixture addresses then
passed. Notices were intercepted, not delivered to a provider.

A separate actual HTTP baseline created and accepted a lease on the parent Home:
its real home_type is multi_unit, but the existing service checked the nonexistent
building enum. Address data alone did not prevent the transaction from admitting
that parent. The existing service now recognizes multi_unit, and the same unmerged
lease migration's transaction blocks request/approve/accept for that Home type.
No table or second migration was introduced. Existing end/move-out remains usable;
an actual older parent-building lease was successfully ended after the guard.

The service baseline and new real SQL contract assertions failed before the repair.
All145 selected backend tests and the complete lease lifecycle/rollback/retry SQL
contract pass. The first apartment compatibility fixture hit the existing active-
lease conflict guard; isolating its earlier membership fixed the fixture without
changing that guard. Existing application-function lint passes with zero errors
across266 functions/85 trigger bindings (8 warnings). The checker is installed
only inside the existing rollback-only lint script; the initial direct query had
no installed checker and is retained as a failed setup attempt.

Actual HTTP verifies7 parent-building rejections (creation plus request/approval/
acceptance with misclassified or missing address) and3 valid apartment creation/
preview/acceptance cases. Parent pending lease/invitation rows remain unchanged
and no parent occupancy is created. These checks use synthetic auth and the
isolated database; provider delivery, native link acceptance and hosted adoption
remain open.

Private lease-sharing-r1 and lease-building-r1 contain source bindings, baseline/
candidate tests, SQL/lint and exact HTTP/browser state. Earlier API18113 is stopped
and cleaned; owned API18114/Next18110 remain active. Both folders are mirrored in
the existing private recovery audit. Source40866ab85 is pushed and its own
[CI34831886732](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34831886732)
passes all15 applicable checks with one unchanged Seeder skip; the sharing/building follow-up requires its own CI after push.

Next: existing invitation-creation recovery/current-authority/date boundaries,
then bulk unit controls through the existing canonical-address/Home-creation path.
Private attachments, provider delivery, installed Android acceptance, combined
adoption/rollout and the R05 row remain open. The inventory stays8/72/80.


### Existing lease invitation creation boundaries

Actual HTTP/SQL reproduced three defects in the existing creation path: reversed
lease dates saved an invitation; a saved response hidden by timeout could not
recover its sharing link because retry returned a duplicate error; authority
revoked after the service read still permitted creation. These are demonstrated
repairs to HomeLeaseInvite, not a replacement invitation system.

The existing service-only decide_home_lease transaction now handles creation as
well. The same Home/current-authority locks protect validation, normalized
recipient binding, invitation insert and audit. The caller can retain a random
proof whose hash is stored in the existing token_hash column; matching retries
return the original invitation, while changed details/Home, expired proof and
another pending invitation are rejected. A proof lock also serializes concurrent
reuse across different Homes. The real authenticated actor is checked inside SQL
and recorded in the audit. Invalid calendar/range dates cannot write; rollback of
the final audit leaves the original proof retryable. Existing business proofs and
parent-building/address boundaries are reused. No table, column, new file or
second migration was added; this extends the existing unmerged function.

The existing web modal retains the original payload/proof after an unknown reply,
locks its fields, and retries that exact invitation. Definite initial validation
failures permit correction; a later error cannot discard an uncertain original.
Recognized success exposes the same sharing/copy controls. Actual Chrome confirms
saved-but-503 → Retry Original Invite → Copy Link: two POSTs have the same proof
hash, one pending invitation, zero leases/occupancies and one intercepted notice.
This is same-modal recovery only; closing/reloading the form is the next boundary.
Older callers can omit the proof, but cannot recover a lost creation link this way.

Validation:140 selected backend tests,61 existing rendered web tests, standalone
TypeScript/scoped lint, the full SQL lease contract and application-function lint
pass (266 functions/85 trigger bindings, zero errors/eight existing warnings).
Thirteen actual HTTP/SQL cases cover invalid dates, failed saved replies, exact
and changed retries, route-check → authority revocation → transaction, identical
and distinct concurrent proofs, proof reuse across Homes, older callers and leap
dates. The final-audit fault and successful original-proof retry also pass real
SQL. Prior invitation acceptance/end/native evidence is reused where unchanged.
Notification attempts are intercepted; RPC-reply loss before notification, actual
provider delivery, retained recovery after departure and native link acceptance
remain open. Synthetic authentication and the private browser shell do not prove
hosted/provider behavior. Evidence is in lease-invitation-create-r1 under the
existing private recovery audit, with source hashes and result files.


### Existing lease invitation retained recovery

Actual Chrome reproduced Close → reopen losing an invitation whose creation had
committed but returned503. The existing modal now saves its exact original before
POST in the existing private recovery database. An added reusable protected-slot
adapter uses the existing encryption-key/database helpers, AES-GCM authenticated
account/origin/unit scope and atomic compare-and-write. No new database, store,
table, migration or product/test file is introduced. Existing household sender/
recipient journals are unchanged. The authenticated actor is included by the
existing property response and optionally bound to invitation POST; a changed
actor is rejected before the service can write. The original token must match a
successful reply before its sharing link is shown.

Closing/reloading keeps the encrypted original; reopening restores its fields
without POST, and explicit retry checks current server authority before sharing.
Done clears only the acknowledged revision. Corruption, failed storage, retired
work and another tab's replacement cannot authorize an unretained POST or erase a
newer record. An initial definite rejection permits correction; a matching closed/
expired invitation (HTTP410) releases its obsolete proof. Other uncertain errors
retain the original. Existing form markup/styles/layout are preserved.

All70 rendered lease checks and83 route tests pass, with standalone TypeScript
and scoped lint. Actual Chrome/SDK/HTTP/SQL saved-but-503 → full reload → recovered
fields (zero new POST) → explicit retry → Copy → Done → fresh empty form passes.
The same invitation/proof remains with one intercepted notice and zero membership
writes. Nine separate actual Chrome IndexedDB/WebCrypto checks verify reopening,
no plaintext proof/nonextractable key, account separation, copied-ciphertext
rejection, corruption preservation, concurrent retention, stale clear and retired
save/clear. These use an exclusively owned disposable test database. Actual HTTP
also rejects a different expected actor without changing invitations/notices.
The private renderer needed its synthetic signed-in initialization on the root
page; the product's session guard was preserved. No provider authentication,
provider delivery or installed native invitation journey is claimed.

CI34836085491 at c334ea664 failed the generated SQL wrapper synchronization check,
before SQL behavior ran. The manually exercised source contract was newer than
its existing committed pgTAP wrapper. Running the existing generator repairs that
wrapper; all54 wrappers verify and the actual generated lease test passes locally.
This is a generated copy of the same tests, not a second migration or data model.
After editing scripts/db/contracts, always run node scripts/db/sync-sql-contracts.cjs
and its --check before pushing. Preserve the failed run as failed; the correction
requires its own CI. Evidence and source bindings are in lease-invitation-retention-r1.

Next: verify the boundary between a saved lease invitation and its in-app notice
when the database response is lost before notification dispatch. Inspect/reuse the
existing Notification.idempotency_key and notification service before changing it.
Bulk unit tools, private attachments, installed Android/native links, provider
acceptance, combined adoption and hosted rollout remain open; R05 remains open.


### Existing lease invitation notification recovery

The next actual HTTP/service/SQL baseline deliberately lost the database reply
before notification dispatch. One invitation committed; initial503 and repeated
successful retries still produced zero in-app notices. This differs from earlier
post-service503 tests, which had already attempted a notice.

The existing Notification table already has idempotency_key and a unique index.
The existing notification service now accepts an optional stable event key and
quietly stops on its duplicate insert, before badge/socket/push emission. Pending
lease-invitation retries reuse lease-invite:<invitation ID>; accepted invitations
skip obsolete notices. Other notification callers keep their prior behavior.
No new table, column, migration, product/test file or delivery subsystem was added.

All186 selected landlord and notification preference/context tests pass. Actual
HTTP/Joi/service/SQL plus the real Notification table verify original503 → replay:
one invitation, one notice, followed by four concurrent retries with the same
single notice. After marking it read and enabling push, another retry preserves
both its identity and read state with zero push attempts. Synthetic auth and
intercepted badge/push isolate the fixture; provider delivery is not accepted.
The initial fixture-loader recursion was corrected privately before the baseline
ran and changed no app source. Source-bound evidence is in lease-invitation-notice-r1.

This is retry recovery, not a promise of eventual provider delivery: an invitation
whose process stops still needs recovery, and push after a committed notice remains
best effort. Older unkeyed historical notices are not retroactively deduplicated;
no record cleanup is inferred. The current lease-creation transaction/branch is
unmerged. Next: existing bulk-unit controls and canonical Home/address creation;
private lease attachments and remaining native/provider/adoption criteria stay open.


### Existing unit import and range generation

The existing UnitsTab Import and Generate controls and SDK methods both reached
missing routes (actual HTTP404 and browser failure). The repair on
`codex/landlord-unit-tools`, based on lease checkpoint `c51740fce`, connects those
controls to the existing Home router and shared Home-create command execution.
Home remains the unit registry. No new screen, table or SQL function signature is introduced. One forward
migration updates the existing Home-create commit function with the selected-parent
check; the original migration remains unchanged. CI34843214305 caught an initial
edit of migration history. The forward file contains exactly the locally accepted
function body and follows the existing immutable-history gate. The corrected
migration gate passes against the actual PR base. A rollback-only populated
rehearsal preserves all row values across374 public/auth/storage/ledger tables,
plus the function OID, signature, owner, grants and configuration.

Each label uses the existing live/cached canonical-address checks and provisional
property-manager setup. The server-selected unit path obtains its address through
that same validator, including when individual clients must supply an address ID.
The existing provider option leaves household deduplication to the locked SQL
check so an existing unit can be returned unchanged. Units do not inherit verified
authority or ownership from the building. Current parent status, physical identity,
verified authority and current business seat/binding or legacy team proof are
checked under locks before inserting. Private ownership stays unclaimed, with
null owner pointer, provisional occupancy and capped permissions.

The original bounded batch is encrypted through the existing protected recovery
adapter before POST. Stable per-unit command IDs and the full batch intent hash
prevent later-label changes from appending different work to an original request.
Earlier completed units survive a later provider outage; pending/terminal outcomes
stop the batch. Close/reload preserves the original without an automatic POST;
explicit retry recovers its same IDs. Only acknowledged completed or durable
terminal results are compare-cleared. Current account, property and page checks
retire delayed storage/response work. Existing layout/classes are preserved; status
copy distinguishes saved setup, existing units, partial progress and verification.

Validation:73 selected backend address/owner/coordinate tests,90 rendered web
lease/unit tests, standalone web TypeScript and scoped lint, all existing privacy
gates, the extended Home-create SQL contract and its actual generated pgTAP wrapper
pass. All54 wrappers synchronize. Application SQL lint checks266 functions and85
trigger bindings with zero errors/eight existing warnings. Twelve actual HTTP/SQL
checks cover input bounds, actor/authority rejection, original/concurrent retries,
existing-unit preservation, live canonical creation, partial outage, provider
refusal and authority revoked after middleware approval. Existing direct, business
seat and legacy team SQL cases also pass with provisional capability assertions.

Two actual Chrome journeys use the real component/SDK/routes/service/pipeline/SQL:
Import saves two units but loses its HTTP reply, then Close/reload restores the
original without POST and retry recovers the same rows; Generate saves one unit,
loses its provider for the next, then reload/retry saves only the unresolved unit.
Done returns to the same list with six total units:two initial plus four new. The
four new units have no verified authority and offer no tenant invitation action.
The existing screen styling was visually inspected. Real encrypted browser storage
is exercised here; reuse the prior nine WebCrypto/IndexedDB adapter checks.

Evidence is privately retained at `unit-bulk-r1` under the lease-transaction audit
root. Authentication and Google/Smarty replies are synthetic; no external provider
acceptance or delivery is claimed. This covers existing web bulk controls, not
unimplemented native bulk UI. R05 private attachments, native links/installed
Android and provider acceptance, populated adoption and rollout remain open.


### Existing private document download authorization

The existing Home document download route checked access only before reading
private object storage. Six baseline regressions returned200 and delivered the
original bytes after access revocation, permission-read failure, visibility tightened
to sensitive, File deletion, HomeDocument removal or byte replacement while the
provider was responding. Actual upload/download routes, permission resolution and
Home/File/Document/quota SQL reproduce all six failures at unit checkpoint461120fca.

The same route now reuses its authorization/visibility resolver and rereads the
document and File identity after the provider read. Revoked/restricted access returns403,
unavailable permission checks503, removed files/documents404, and changed bytes409,
without a file body or download header. An unchanged authorized file still delivers
its exact bytes with the existing private/no-store and attachment headers. There
is no screen, table, migration or alternate storage implementation.

All101 selected document upload/replacement/deletion/recovery/storage and generic
file access tests pass. Seven actual HTTP/SQL cases pass against the candidate;
the six security cases fail against the preserved baseline. Synthetic authentication
and an in-memory private object provider isolate the authorization boundary; this
is not external storage-provider acceptance. Exact owned Home/File/Document/User
counts are zero afterwards. Private evidence is retained in lease-documents-r1.
The recheck narrows the asynchronous provider-read window; it does not claim an
atomic transaction between database authorization and network delivery.

PR38 checkpointc51740fce now passes15 applicable CI34840961607 checks/one Seeder
skip, including native builds/tests. PR39 checkpoint461120fca passes8 applicable
CI34843857113 checks/three path-based skips. Those PRs remain unmerged. R05 private
lease attachment upload and remaining native/provider/adoption criteria remain open.


### Existing standalone file upload compatibility

Tracing the existing private lease attachment options exposed a separate real
upload mismatch. Current iOS/Android/web callers send general, voice_postscript,
gig_photo, gig_completion, mailbox_unboxing or business_verification; those are
purposes, not values in the existing File.file_type constraint. An omitted type
also defaulted to general. All seven actual HTTP/SQL baseline cases wrote storage,
failed the File insert with500 and attempted cleanup. Existing gig_attachment
already worked. The supported Word MIME application/msword also passed Multer's
allowlist but the route's separate category helper rejected it with415.

The existing route now maps those purpose names to existing other, gig_attachment
or mailbox_attachment categories and retains the purpose in existing file_context.
Supported canonical names retain their prior behavior. The route rejects invalid
or repeated file type/visibility fields before quota/storage work. File category
lookup now uses the same existing MIME allowlist. No client screen, File schema,
migration, public/private delivery rule or storage provider was replaced.

All115 selected document/file tests and the existing privacy gates pass. Twelve
actual HTTP/SQL checks cover every observed purpose, default, canonical compatibility,
Word MIME and invalid metadata without writes; exact owned User/File/object cleanup
is zero. The earlier baseline unit assertion expecting an explicit null context
on a mocked canonical File was a fixture mismatch, not another app defect; it was
corrected. Actual SQL independently establishes the seven insert failures.
Evidence is privately retained in generic-file-r1. Authentication/S3 objects are
synthetic. These checks establish upload/record compatibility, not installed
end-to-end acceptance of every consuming feature or provider access controls.
The legacy S3 helper returns a direct object/CDN URL even for metadata marked
private; its deployed access policy and recipient delivery remain unaccepted.
Do not use that path for the pending tenant's private lease evidence.


### Existing native lease invitation links

Both existing native DeepLinkRouter implementations consumed the second segment
of /invite/lease/<proof>, yielding the literal token lease. The Android routing
baseline reproduces the lost proof under its test configurations. The candidate
on codex/native-lease-invites starts from accepted file checkpointa1069e1de and
preserves the complete bounded hexadecimal proof plus explicit lease kind through
the existing root navigation and TokenAccept screen. It adds no replacement screen,
backend transaction, table or migration. Invalid/extra path segments fail closed.

Lease resolution uses only the existing authenticated recipient-only POST preview;
it does not probe Home/seat/guest URL endpoints with the lease proof. Current
Home, recipient account, status and dates must validate before an offer appears.
The existing frame presents tenant role, proposed dates and receiving account.
Acceptance requires an explicit action and a matching active lease/verified
occupancy receipt. Not now simply closes, without falsely recording a decline.
A lost reply can recheck the accepted invitation and explicitly retry the same
proof through the existing SQL replay. Closing/foreground/session boundaries
retire old results. Existing protected Home-invitation originals keep precedence.

The candidate passes134 selected Android tests (108 routing,23 invitation
model and three unchanged invitation snapshots), Detekt and ktlint. All88 selected
iOS tests pass, including27 invitation cases, with Swift lint/format. Both native
builds succeed. Delivered late preview/acceptance after close or account change
never publishes an offer or success; wrong-scope and unverified receipts fail closed.
The iOS test file keeps the shared session/store harness and adds a documented
file-length exception, matching the existing routing-test convention. No checks
for functional/security behavior were disabled. The initial Android default cache
failure was an environment issue; the existing private project cache resolves it.
The first candidate lint run identified return-count/format issues that were fixed.
Do not report those earlier attempts as passing.

Installed iOS and Android each pass the correct account/Home/calendar offer,
Not now without any acceptance request, a committed acceptance whose response is
replaced by503, and explicit retry recovering the identical lease/occupancy IDs.
Each current build also passes signed-out link → login → original invitation,
without automatic acceptance. The iOS account-removal action intentionally clears
a prior handoff; this is separate from normal sign-in replay. All679 installed iOS
files match the tested product, and the installed Android APK hash matches its
candidate. The IDE initially restored an older Android APK from a saved snapshot;
that mismatch was identified by hash and the candidate installed before acceptance.
Native UI checks use CUA; Android works through the docked IDE panel with touch
gestures/on-screen keys. Host text/keyboard and detached-window control were
unreliable, not established app defects. Do not reuse a restored APK without
checking its hash. The older installed request-approval Android journey is still
a separate open criterion.

Private evidence/runtime leases are in native-invitation-r1. API18109 used the
actual lease router/service/SQL with synthetic login/shell and intercepted
notifications, and owned only its exact fb22-prefixed fixtures. The two disposable
leases do not establish real provider identity, push delivery, terms acceptance
or hosted rollout. Private lease upload remains open.
PR40 a1069e1de separately passes all6 applicable CI34845551425 checks/five skips.

The iPhone16 job in [CI34851208086](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34851208086)
failed an existing Support Train fixture: its debounced recipient GET consumed a
FIFO response intended for a slot/publish request, leaving publish with a synthetic
599. This is a recorded failed run, not a native invitation failure or a pass.
The existing test now uses the already available session-scoped route responses,
with a delayed create response to exercise overlapping recipient search. It checks
all seven slot requests and the single publish request. All13 selected Support
Train tests pass; no Support Train product code, design or schema changes. Private evidence is in android-request-r2. The two
other original iOS CI device jobs and Android instrumented tests passed; the
remaining original Android build/test job was still running at this checkpoint.


### Existing native lease request controls and calendar validation

The formerly open installed Android request journey now runs through the docked
IDE using CUA touch and on-screen keys. Its baseline showed the Details body with
stale1-of-3/Start-verification/Close controls. Two real Compose device regressions
reproduced the stale readout and an enabled action after validation failed. The
repair applies the existing Add Home pattern: pass controls projected from the
same observed state to the existing WizardShell. Step/error changes bring the
existing content/error summary into view. No layout or replacement wizard is added.

Installed testing also found February30 passed both native validators' loose
month/day ranges. The actual backend rejected it and created no lease. Android
now uses the existing java.time calendar parsing pattern; iOS uses strict Gregorian
POSIX/UTC parsing with an exact round trip. Tests cover month lengths, leap years,
century exceptions, canonical formatting and the existing1900 lower bound. Both
existing dirty-form guards now include date-only, phone-only and message-only
edits, while the loaded unit label alone is not an edit. The real Android screen
test checks Back, Close and the existing discard dialog after date-only input.

The installed calendar candidate verifies correct2-of-3/Submit controls, truthful
unavailable attachment feedback, impossible-date rejection without another POST,
correction re-enabling Submit, and a committed request whose response is replaced
by503. Explicit retry reads current context and POSTs again; the existing backend
returns the same pending lease with unchanged dates/message and no duplicate row.
The immediate conflict frame has its existing compact status; foreground refresh
shows the actual saved date/message. Approving the exact disposable lease through
the existing service/SQL while backgrounded then restores active status and
September14,2026 on return. Done closes the screen. Closing a held status read
cancels its socket; releasing afterwards leaves the screen closed. This is canceled
transport evidence, not delivery of late successful bytes.

The installed APK hash matches its built calendar candidate. Subsequent native
dirty-form changes are bounded by the rendered/model regressions; the unchanged
request transport, recovery and date paths retain the installed evidence. Final
candidate checks pass74 Android tests (72 model/snapshot and two real Compose
device tests),52 iOS request model/snapshot tests, Android static checks and
SwiftLint/SwiftFormat. Existing screenshot baselines are unchanged. Five existing product files and existing model tests are repaired;
the only new tracked product/test file is the Android rendered regression suite.
There are no new screens, layouts, backend routes, tables or migrations here.

Private evidence/source and product bindings are in android-request-r2. The API
used actual tenant route/Joi/service/SQL with synthetic login/shell and intercepted
notices. Its exact fb23 Home, lease, occupancy, invitation, authority, address and
User cleanup counts are all zero; API18109 is stopped. Account/departure failures
also retain the focused native session tests; provider identity, notification
delivery and hosted adoption are not established. Private lease attachments and
remaining R05 criteria stay open.


### Existing private lease file storage and request binding

The existing native request screen already contains Attach, remove and file cards,
but its live Attach action reports unavailable and submission has no private file
binding. Repository and all-ref history searches found no private lease upload
contract to reuse. Existing generic S3 upload URLs do not satisfy applicant/current
landlord access. Existing HomeDocument and ownership/task evidence transactions
serve different audiences; no fake household document, claim or task is created.

The backend candidate extends File/HomeLease metadata, uses homeDocumentStorage's
private bucket check, immutable SHA256 keys and retry verification, and reuses the
existing private evidence byte/signature inspector. A File-only reservation admits
quota before storage; finalized drafts grant no lease or occupancy. The optional
file ID in the existing request endpoint reaches a small wrapper around the
unchanged decide_home_lease engine. Request, audit and exact file binding commit
atomically. Retrying a saved request recovers its same attachment; changed details,
wrong actors/Homes, another draft and canceled requests cannot silently rebind it.
Only the applicant can read an unsubmitted draft; submitted bytes require that
applicant or current verified authority. Both authorization and exact binding are
rechecked after provider reads. Generic File listing/RLS/deletion cannot bypass it.

One forward migration adds no tables. It extends existing cleanup functions/worker
and retains File tombstones after removal/expiry/parent deletion. File.user_id can
be null only for a retired private lease file; legacy ownership and its cascade FK
remain intact. The original Home-delete eligibility function would permanently
block an owner after an applicant's abandoned draft. The real database reproduced
that failure. Its focused extension now permits the existing authorized deletion,
whose parent trigger retires/detaches private lease Files atomically. Exact object
keys survive for the existing worker; late writes invalidate old acknowledgements.
The repeated SQL function bodies are forward updates to existing functions, not
additional tenancy/upload tables or replacement implementations.

Verification passes244 selected backend tests, all privacy gates, and eight real
SQL contracts covering existing document delete/recovery/replacement, quota,
task media, Home deletion, lease decisions and the new file binding. The new
contract checks service-only access, direct File RLS, exact quota/retries, calendar
rejection, fault-injected binding rollback, replay/cancellation, cleanup claim
races and real User/Home cascades. Its first candidate correctly failed the
existing required File extension constraint; the reservation now supplies it.
That failed attempt and the Home-delete baseline are retained as failures.

Sixteen actual Express/Multer/service/Supabase HTTP/PostgreSQL cases pass, including
one committed request whose RPC response is lost, exact-row recovery, current
landlord reads, revocation/freeze while bytes are being read, generic bypass denial,
draft removal, deletion of an applicant during provider upload, late-write cleanup,
cancellation and authorized Home removal followed by removal of the last private
object. Exact owned User/File/Home/lease/authority/occupancy/invitation counts and
provider objects finish at zero. The populated forward rehearsal preserves all374
public/auth/storage/ledger table fingerprints (including an existing legacy File)
and existing function identities/grants. Application lint has270 functions and88
trigger bindings, zero errors/eight existing warnings. The55 generated pgTAP
wrappers are synchronized; they duplicate source tests for the existing runner.

Private evidence is under private-lease-evidence-r1 and is mirrored to the owner's
private recovery directory. These checks use synthetic scoped login, an in-memory
private object provider and intercepted notifications with real API/database
behavior. No hosted/private-provider or real identity-delivery acceptance is
claimed. Native/web attachment controls and landlord file presentation are not
yet connected or verified. R05 and the app remain open; continue existing clients
without redesigning them. PR41 now passes11 applicable CI checks/five path skips.
PR42's first attempt failed a Sentry download cache collision before compilation;
its same-source build/dependent-job retry is running. No new PR for the attachment
checkpoint has been opened yet.


### Existing iOS lease attachment and web landlord reader

The existing iOS Attach action, file card, removal and Submit now use the verified
private lease contract through existing DocumentFileReader, MultipartUploader,
APIClient and HomeClaimSessionScope. The added bounded attachment helper owns
the picker lifetime, at most25MB of selected bytes and one stable upload UUID.
It is not a replacement screen or storage service. Its opening actor/Home/session
and original request context survive explicit retries; account changes, closing
and late completions cannot publish into a retired screen. Unconfirmed uploads
or removals block submission and retain their in-memory identity until resolved.
Draft recovery across process restart is not implemented or claimed; abandoned
files use the existing cleanup worker. No client-phase migration or table is added.

The existing card displays actual sanitized filename, type and size without fake
parsed pages/owner/unit. Installed testing caught the first unconfirmed upload
using success styling; the final candidate uses the existing warning treatment
and attachment error banner without changing layout. Explicit sample previews
remain samples. The existing web RequestsTab opens files only on request through
the existing private byte/signature-aware renderer. Viewing makes no lease decision.
Content clears on close, account change, blur/hidden or unmount. Backend and SDK
reuse the existing expected-session header; SDK metadata checks bracket byte reads.

Actual browser testing found that the existing property detail query omitted lease
metadata, hiding both the saved message and attachment. The repaired safe projection
exposes only message and valid File ID, also used by request-list/tenant status.
Storage keys, hashes and decision internals remain private. This repairs an existing
query and reader rather than adding another property page.

Final verification passes248 selected backend tests,148 web tests across five related
suites,60 iOS tests (eight attachment,44 existing wizard and eight structural
render/date/error tests),18 actual HTTP/SQL cases, web TypeScript/scoped ESLint,
SwiftLint/SwiftFormat and privacy gates. The iOS structural suite is not a pixel
golden comparison. Unchanged migration evidence retains eight SQL contracts,374
preserved table fingerprints,270 functions/88 trigger bindings and55 synchronized
wrappers. Initial pnpm command-shim failures remain failed; direct existing package
entrypoints run successfully without dependency/lockfile changes.

Installed iOS selects a synthetic83-byte text file through the real system picker.
A committed upload whose reply becomes503 leaves unconfirmed state; explicit Retry
uses the same File/object with zero leases. Removal's first503 is automatically
retried by the existing idempotent DELETE transport, retiring that File. This is
not installed explicit-removal-retry evidence; pending removal state is covered
by focused tests. A replacement file is attached; a committed request followed
by503 leaves one lease. Explicit Submit retry recovers the same lease, File, date
and message. The final product passes60 tests and all679 installed app files
match the built candidate.

A fresh final-product iOS request opens in the actual web PropertyDetail/RequestsTab
against the same real local API/database. The owner sees the exact selected text.
Holding an authorized content response after backend checks, revoking authority
and delivering the connected old200 bytes makes the SDK's final metadata read
deny access; the bytes never appear. Restoring authority permits explicit reopening.
Switching the synthetic cookie account to an outsider removes private card/content
and the property endpoint denies access. Close/Done finish the browser/native flow.
These checks use synthetic scoped login, object storage and notifications; they
do not establish real provider identity/delivery or hosted rollout.

Private evidence is in private-lease-evidence-r1: backend-reader-r1.log,
web-reader-r1.log, ios-candidate-r2.xcresult, ios-installed-r2-product.json,
http-client-r3 and native-reader-r2, plus initial installed lost-response snapshots.
Both fb27 installed cycles and fb26 HTTP fixtures finish with zero owned
User/File/Home/HomeLease/HomeAuthority/HomeOccupancy/HomeLeaseInvite rows or objects.
API18109, proxy18117, Next18110 and the owned simulator are stopped. The private
harness page is restored and exact picker fixture removed. Evidence/source bindings
are mirrored to the owner's private recovery directory; credentials, tokens and
operator logs remain outside Git/chat.

PR42 e16c0c499 now passes all11 applicable CI34857194083 attempt2 checks/five
path skips. Attempt1 remains failed for a Sentry cache collision before compilation;
no app/CI policy change was made for that retry. This client milestone has not yet
received remote CI. Android attachment, web tenant entry, remaining native landlord
readers and other R05 criteria stay open. Continue existing paths, preserving
designs. R05 and the app remain incomplete.

### Existing Android lease attachment controls

The existing Android Attach action still reported unavailable and could not send
a file. Its existing picker, file card, removal and Submit now connect to the same
private lease contract as iOS. TenantApi/TenantRepository retain the ordinary
request path and add session-bound file operations. The bounded attachment helper
owns only this opening wizard's selected bytes, upload UUID and original request
context. It reuses HomeClaimSessionScope, the existing bounded document reader and
the existing privateEvidencePart multipart encoder, including its UTF-8 filename
handling. The encoder body is unchanged; only its visibility is extended. There
is no new screen, storage service, migration or table in this Android follow-up.

The existing card shows actual filename/type/size and unconfirmed-operation
warnings without invented parsing results. Upload and removal retries retain the
same File identity; unresolved operations block request submission. Request retry
retains the original observed context and validates the returned File binding.
Session changes clear selected bytes; generation/cancellation guards retire old
picker and network completions. Existing form and layout structure are preserved.

R6 passes69 selected tests: seven attachment cases,38 existing wizard cases,
nine session-retirement cases, ten existing private multipart/API cases and five
existing Start/Details rendering cases. Ktlint, Detekt and Debug assembly pass.
The late-completion test waits for the released old operation to finish before
asserting that it cannot publish. Initial R1–R3 formatting failures and R4's two
Detekt failures remain recorded as failed attempts; normal formatting and bounded
control-flow repairs resolve them without disabling guards or assertions.

Installed R6 runs against the actual local API, multipart parser, private lease
service and SQL. The real system picker selects an83-byte synthetic text file with
a Unicode filename. A committed upload whose response is503 leaves one completed
File/object and zero leases; explicit Retry recovers the same File. A removal503
before the transaction leaves the card unconfirmed and blocks submission; explicit
Retry sends the same DELETE, tombstones the File and clears the card. Physical
object deletion is still queued at this point because this fixture does not run
the existing recovery worker. After selecting a replacement, a committed request
whose reply is503 leaves one pending lease. Explicit Submit retry recovers that
same lease/File/date/message, and the existing completion screen shows Pending
Approval with September14 dates. Done leaves the wizard.

That installed journey exposed a stale empty-card caption saying attachment was
unavailable. R7 changes only that caption relative to R6's application/test source;
all three existing Details rendering tests, Ktlint, Detekt and assembly pass.
The final APK is installed and its device hash matches the retained build. The
functional installed journey is R6 evidence; the R7 caption was not separately
reobserved in an installed journey. This explicit source comparison allows reuse
of the unchanged functional checks without repeating them.

Evidence is private-lease-evidence-r1/android-client-r1: build-r1 through build-r7
logs, tests-r6/r7.json, product-binding-r6/r7.json, picker/upload/removal/request
state snapshots, native-final-state.json and native-cleanup.json. Final cleanup
has zero owned User/File/Home/HomeLease/HomeAuthority/HomeOccupancy/HomeLeaseInvite
rows and zero synthetic objects. API18109 is stopped; the exact synthetic device
file and owned reverse mapping are removed. The owned emulator is stopped, its
temporary registration released, and AVD data/products retained. Other devices
are untouched. Evidence is mirrored to the owner's private recovery directory.

This journey does not establish installed Android account-switch or delivered
late-byte behavior for the new attachment helper; its focused tests cover the
stated lifetime boundaries. Identity, storage and notices are synthetic, and
drafts are retained in memory only. Web tenant attachment entry, remaining native
landlord readers, real provider acceptance, combined adoption and hosted rollout
remain open. Inspect existing/archived controls before extending those paths.
R05 and the8 locally closed/72 partial or open inventory remain unchanged.

The preceding iOS/web checkpoint481c45b81 is pushed on draft
[PR43](https://github.com/WangPantopus/skinny-pantopus/pull/43), based on PR42.
[CI34870041822](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34870041822)
passes all13 applicable jobs with two path-based skips. The Android follow-up
requires CI at its own pushed source; this earlier green run does not cover it.


### Existing web tip-status repair

September14 paid integration review traced TipModal through the existing SDK,
pays.js tip/refresh routes, stripeService.createTipPayment/syncTipPaymentStatus
and Payment table. The route's success flag means a PaymentIntent was created;
the modal treated that or a client secret as paid success. Six initial React
regressions fail on the unchanged component. Current source uses the existing
refresh endpoint and requires a paid state from the existing service before
calling onSuccess; any supplied provider status must also be succeeded. Unconfirmed status keeps the same
payment ID/amount for explicit checks; it never creates another payment for a
status retry. An unknown creation reply blocks a second creation inside this
modal. Amount controls freeze once an attempt starts. Layout/styles are retained.

A follow-up test reproduces an old paid response being applied after the task
changes. Two more reproduce submission after cookie-session replacement and an
old paid response being shown to a replaced session. Existing token-change events,
origin/token/session-marker comparison and task/mount lifetime now retire those
responses. The initial nine tests pass, with standalone TypeScript and zero-warning
scoped ESLint. The first typecheck failed because the test used Playwright's exact
option with Testing Library; removing that unsupported test option repairs it.
Earlier failures remain in private integration-review-r1/paid-tip-modal-* logs.

This extends one existing product file and adds one focused regression test file;
no replacement screen, endpoint, service, table or migration. It does not complete
tips: confirmation/3DS UI, a durable creation identity across loss/closing/reload,
strong backend provider proof, and installed/browser/provider acceptance remain
open. The server's pre-existing creation/reconciliation guarantees still need the
planned tip-contract work. No provider operation ran in these mocked component
checks. The unwired gigTipProof draft remains explicitly unaccepted. PR34 stays
draft, including the cancellation presentation/custom-reason review and combined
native/DB gates. Full backend and unchanged web evidence from local274bbe8cb is
reused only for unaffected source.

Tracing the existing syncTipPaymentStatus short circuit caught a compatibility
gap in the first UI candidate: already-paid records intentionally return null
provider status without another provider read. The candidate would have left
those successful tips pending. That regression is reproduced, and the existing
recorded-paid response remains accepted; supplied non-success provider status
still cannot report success. All ten final focused tests pass. This is not a
claim of new exact provider/charge proof—the current service's guarantees remain
the stated limit. The proposed tip-contract document now explicitly says its
routes/migration are unimplemented, preventing a plan from being mistaken for
existing source or completed acceptance.

### September14 merge review and Android screenshot references

The user now authorizes merging PRs that are good to merge, followed by continued
verification and fixes. Fresh remote review finds seven linear Home PR heads:
32→38→39→40→41→42→43. Current master6a1013784 is an ancestor of the complete tip
557a556db. Git merge-tree produces exactly that tip tree with no conflict. There
are no unresolved GitHub review threads. PR43 now targets master to integrate the
preserved chain together; no squash, branch deletion or deployment is intended.
Production and staging deployment/migration switches were freshly verified false.

Final CI34875176418 failed three Android Details golden-image comparisons, each
retried three times. All other nonaggregate jobs passed, including all iOS devices,
Android instrumented tests, backend, web and database replay. Earlier local
rendering checks did not enable Paparazzi's reference comparison; they did not
establish golden-image agreement. The explicit local verify task reproduces all
three failures. Expected/delta/actual images were inspected: the changed text is
the attachment-availability explanation; existing layout, controls and styles are
preserved. Only these three reference images are refreshed from that exact-source
CI rendering. All three Details comparisons now pass the explicit verifyPaparazziDebug task.
Verification thresholds and snapshot assertions remain unchanged.
The failed run stays failed; corrected-source CI is required before merging.

PR34 is held separately. Its merge with the Home tip has nine textual conflicts;
the isolated integration candidate retains both durable notification paths and
current Home/session guards. Syntax checking caught an automatically merged
duplicate session-scope import in gigs.js, which is removed. Combined candidate
checks pass5808 backend tests/16 existing skips,59 focused web tests, web types,
scoped lint with seven existing warnings,62 distinct migration versions and64
synchronized SQL wrappers. Its combined fresh database replay and native CI still
need verification. Existing cancellation presentation/custom-reason behavior and
the unimplemented durable-tip draft remain unresolved; these local checks alone
do not qualify PR34 for merge. No provider operation or hosted migration ran.
Detailed private merge/source evidence is in integration-review-r1 alongside the
existing lease-transaction archive. Owner checkout and unrelated work are intact.


### Existing shared file-picker replacement and preview lifetime

On September14, the existing FileUpload component was traced through its Home
bill/package/issue and gig creation/completion/Q&A callers, with existing upload
SDK/routes retained. All present callers use multi-file mode. The existing
single-file API has a Click to change control and an explicit replacement branch,
but its preceding count check rejects a second selection. Image previews in both
modes allocate a fresh object URL on every render and never release one. This
source dates to the initial import; it is not evidence that these screens need
rebuilding. No backend, storage, migration or caller contract changes are needed.

The unchanged component fails five of eight focused regressions: two replacement
cases, preview stability in both modes and StrictMode/unmount cleanup. The repair
keeps the existing markup/styles and uses a file-scoped effect for local image
URLs, releasing them on replacement/removal/unmount and preventing a replaced
file from rendering the old URL. Multi-file append/count and document-icon
behavior remain intact. All eight cases now pass; standalone web TypeScript and
scoped ESLint pass with zero warnings. The initial lint warning was resolved by
passing the existing required alt prop explicitly. The test file is the only new
source file; the existing product component is extended in place.

These checks use the real React/Next component in jsdom with a controlled URL
allocator, not an installed browser/upload-provider journey. Full caller upload
acceptance and the rest of the inventory remain open. Private baseline/candidate,
types and lint results are retained under integration-review-r1/file-picker-*.
This repair is isolated above Home integration source d18120a8c while PR43 CI runs;
it does not alter the source currently awaiting the Home merge.

A subsequent Chrome check loads the real component in an owned temporary Next
fixture with actual browser File objects. Image decode succeeds; unrelated
renders allocate no further URL, replacement retires the old URL, and the
existing multi-file remove button plus unmount leave zero live URLs (seven
created/seven revoked across the exercise). The Chrome extension disallowed
chooser file injection; no permission was changed. Files for these browser
lifetime checks were supplied by the synthetic fixture, so actual chooser
selection is not accepted browser evidence. The focused React tests cover input
selection/replacement separately. The temporary route is removed, the owned tab
is closed and Next18119 is stopped. Source binding and counters are in the private
file-picker-browser-r1/binding.json; no browser harness is committed.

## Reviewed Home chain integration into master

September14: [PR43](https://github.com/WangPantopus/skinny-pantopus/pull/43) merged
at `0cb4f3c600228dab0d09ca8d660741c93028e3f4` after all16 checks passed in
[CI34879088468](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34879088468).
Its master tree is exactly `c67f9b687dcee56d5a7a7eb52b000a19a3d10306`, matching the
verified head `d18120a8c`. All seven PR heads (32,38–43) remain ancestors, with no
squash or source rewrite. PR32 is marked merged. GitHub cannot retarget an already
incorporated stacked head to master because there are no new commits; PR38–42
are therefore closed with integration references and their branches retained.
No repeated journey or native build was required for an identical merge tree.
Deployment/migration activation remains disabled, and all prior provider,
rollout and feature-completion limits continue to apply. Private merge proof and
fresh PR dispositions are under integration-review-r1/home-merge-*.json.

## Existing cancellation presentation restoration in the paid candidate

September14 compared GigStopDialog with the existing master CancellationModal and
its CompletionFlow caller. The recovery PR had replaced the original icon/reason
buttons and policy/fee/header/footer presentation with a dropdown and plain text.
Two focused regressions reproduce the missing owner/worker buttons. The existing
GigStopDialog now reuses the original reason labels, Lucide icons, selected-state
classes, policy pill, fee-card and header/footer styling. Current term validation,
retained UUID/retry logic, focus management and account/task retirement stay in
place. The displayed fee uses verified terms and never claims a fee was charged
when the action requires review. No new product file, endpoint, migration or table.

All52 rendered recovery/dialog tests pass, including the existing saved-request,
response-loss, conflict, storage and session boundaries. Tests now select the
restored button instead of the superseded dropdown; assertions remain active.
Web types and scoped lint pass. The first type check caught six test-only uses of
Playwright's exact option in Testing Library; removing the unsupported option
preserves its already-exact string-name matching. Initial private patch commands
used a wrong working directory and changed no source; their failed/no-op attempts
are retained separately from the two-failure baseline and passing candidate.

Chrome visually confirms the original button/icon and card styling through the
existing dialog with a synthetic Axios preview adapter. Changed my plans becomes
selected and enables confirmation; Keep Gig closes without submitting any task
or provider operation. The first private fixture intercepted fetch, but this SDK
uses Axios/XHR, so it reached the stopped local proxy and failed; the corrected
fixture changes only the adapter. Temporary Next18119/page/tab are stopped/removed,
and generated route output is preserved privately. This is presentation validation,
not a browser/backend/provider cancellation journey. Evidence is private
paid-cancellation-presentation-r1/baseline-r2.log, candidate-r3.log, types-r2/r3.log,
lint-r1.log and browser-binding-r1.json.

The restoration remains partial: the original Other explanation box is not yet
connected to the durable contract. Its old parent never passed customReason or
onChangeCustomReason, so it was already nonfunctional. Current stop requests retain
an enum reason across SQL, web, iOS and Android. Do not silently discard typed
explanations or put free text into native enum fields. Inspect existing reason
storage and protected recovery before extending the contract; no new schema is
justified yet. Nonzero-fee/started/provider and tip/durable-recovery gates remain
open; original PR34 stays draft. This milestone does not authorize paid launch.


## Existing cancellation Other explanation and private recovery

September14 follow-up in the preserved paid integration candidate. The original
CancellationModal already contained an Other text field, but its CompletionFlow
caller did not pass the input onward. Restore that existing field and its styles
in GigStopDialog, retaining the existing same-request/session recovery path.
No replacement screen or cancellation table is added.

The existing GigStopRequest.reason text stores `other: <original explanation>`
and already binds it under the begin_gig_stop lock. The service presents only the
Other category and SHA-256 fingerprint in request/status receipts. Web sends the
text on first submission and retains it using the existing ProtectedRecoverySlot
AES-GCM/IndexedDB implementation; its ordinary receipt storage contains only the
fingerprint. Native request DTOs/stores retain that fingerprint so the original
actor can retry a server-admitted request without storing or fetching free text.
Existing enum-only native requests remain compatible.

Review found that finish_gig_stop copied reason into Gig.cancellation_reason,
which the unauthenticated task timeline exposes. The new SQL regression fails
against the old function with “Private explanation exposed in public task
timeline.” Forward migration20260914030000 replaces that existing function with
one assignment change: packed Other explanations project to `other` on Gig,
while the exact private request stays immutable. It creates no table, adds no
column or permission, and preserves all release/refund proof and notification
logic. Published migration20260910160000 remains byte-for-byte unchanged.

Verification:

- Backend65 tests and web57 rendered recovery tests pass; web types and scoped
  lint pass. Cases include bounded/hashed input, exact retry, lost reply/reopen,
  failed protected write preventing POST, session retirement during encryption,
  and retired completion preserving the original recovery record.
- Chrome uses the existing dialog/hook with real IndexedDB/WebCrypto and a
  synthetic Axios API. First submission loses its reply; reload preserves an
  encrypted envelope and fingerprint-only receipt. Explicit retry sends the
  same UUID/hash/text; confirmed completion clears both records. Two synthetic
  POSTs occur, with no actual HTTP/provider operation. The owned tab/server and
  temporary harness are removed after source binding and result capture.
- Android38 unit tests plus ktlint/detekt pass. Two earlier formatting failures
  remain recorded; only argument wrapping changed. All22 focused iOS tests, SwiftLint
  and SwiftFormat pass after one existing 401 test was found using
  AuthManager.shared and a simulator's retained login. Its test factory now uses an existing in-memory
  AuthManager/APIClient pair; the denial assertions and production auth behavior
  are unchanged. The original failed run remains recorded; the new fingerprint recovery case
  passed on both runs.
- Real local SQL contract and generated pgTAP pass; the existing production
  stop/refund service runner passes238 connections with a synthetic provider.
  This covers exact private reason persistence, read projection, wrong-fingerprint
  denial, fingerprint-only same-ID recovery, public category-only cancellation,
  financial identity, lost acknowledgements, concurrency and reconciliation.
- The isolated paid database copies the owned Home rehearsal, then applies the
  nine existing paid migrations and this one forward function update. All64 SQL
  contracts pass across recorded runs. Initial reference-defaults failure was a
  setup gap: the old Home rehearsal contained only HomeRolePermission references.
  Five empty reference tables were populated with the unchanged canonical
  baseline statements, then the unchanged check passed. Application function lint
  passes349 functions/106 trigger bindings, zero errors/eight existing warnings.
  The source Home database is unchanged. Eight inspected synthetic fixture tables
  contain zero aac7/aac8 rows after service cleanup and contract rollbacks.

Private evidence: `paid-cancellation-explanation-r1` in the existing local audit
root/mirror, including baseline failures, final logs, combined DB provenance and
browser binding. DB restore first failed on auth schema ownership; the retry used
existing local supabase_admin credentials without altering roles or privileges.
No archive, token, private explanation or operator log is committed.

Limits: no hosted migration/adoption, real Stripe operation, installed native
explanation journey or release acceptance. The fresh combined baseline CI and
remaining durable tip/fee/started-task/provider gates still apply to draft PR34.
Encrypted data written just before a lost local receipt write, or superseded by a
verified competing request, can remain as an inaccessible encrypted orphan; no
provider request is issued before the ordinary receipt is retained. Generic
protected-storage expiry/garbage collection remains a separate lifecycle check.

## Existing residency-letter expiry projection and labels

September14 traced the existing ResidencyLetter service/table/expiry migration,
issuer routes, public verification route, web IdentityDetail and both native
letter DTO/card implementations before editing. The baseline issuer query omitted
expires_at and returned issued until someone verified the public code. The web
card treated every non-revoked value as Active; native expired decoded as unknown
and displayed Revoked. These are existing-flow defects, not missing screens or
schema. The separate scoped ResidencyClaim pass is a different implementation.

The existing issuer serialization now projects elapsed issued rows as expired
and includes expires_at; an explicitly revoked row stays revoked. Listing changes
neither the saved status nor frozen PDF bytes. Both native enums accept expired,
and all three existing cards label Expired/Revoked/Unavailable accurately. The
web retains historical PDF access and disables Mail/revoke controls for inactive
letters. Existing structure/styles and working issued behavior are preserved.
All13 changed files are existing files, including tests and two reports; no new
tracked file, migration, table or service is required.

Baseline checks reproduce one backend failure/11 passes and two web failures/four
passes. Candidate passes12 backend tests,20 web tests across the existing mailbox
and place-group suites,20 iOS DTO tests,6 Android DTO tests, standalone web types,
scoped ESLint/SwiftLint/SwiftFormat and Android Ktlint/Detekt. The final web fixture
uses a future date for its issued case; its six tests pass again. Native view
source compiles, but no installed residency-letter UI journey is claimed.

Eight real local HTTP/SQL cases exercise the actual existing routes, permission
helper, service, PDF renderer, Supabase client and reserved PostgreSQL database:
issue one letter; reproduce the baseline list failure; project expiry before a
public lookup without mutating the row; deny another member's list/PDF/revoke;
return the exact frozen PDF; publicly return only invalid/expired and retire the
existing row; retain explicit-revocation precedence; deny removed/outsider and
unauthenticated access. Identity is synthetic. No external provider ran.

Chrome opens the existing Identity → Residency letter controls and displays the
captured issuer-list response in a private query-cache fixture. The Expired badge,
disabled Mail, enabled historical PDF and absent Revoke are verified, with the
existing layout visually inspected. The initial pre-hydration clicks did nothing;
a compiled-page reload and hydrated control click produced the verified state.
This proves rendered behavior, not browser API/auth or mail-provider acceptance.

Private evidence: residency-letter-expiry-r1 contains baseline/candidate logs,
ios-r1.xcresult and summary, Android summary, http-result-r1.json, issuer-list-r1.json,
browser-binding-r1.json and cleanup-r2.log. The first HTTP process passed all8
functional checks but exited1 because its cleanup email filter left three users.
Exact-ID/email SQL cleanup removed those three; User/Home/HomeOccupancy/ResidencyLetter
counts are all zero. The corrected private script is retained without relabeling
the first run. Next18119 is stopped, the exact temporary page/tab removed, native
simulator stopped and generated output preserved privately. Configuration is
restored; a stale generated-type failure from the earlier file-picker harness is
recorded, and regenerated current route types pass. Owner devices are untouched.
R06/R05, all-platform lifecycle acceptance and hosted rollout remain incomplete.

The preceding file-picker repair merged through
[PR44](https://github.com/WangPantopus/skinny-pantopus/pull/44) at f6dbbe2eb after
all6 applicable checks/five path-based skips passed in
[CI34885279768](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34885279768).
Its source-specific component/browser limits continue to apply.

Residency-expiry PR45 merged September14 at `e775af9ae` after all15 applicable
checks/one path skip passed in [CI34886464860](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34886464860).
Master exactly matched the tested a25b5df61 tree. The paid candidate now includes
that actual master; the two documentation conflicts retain both scoped evidence
sections and the current handoff. No application or schema conflict occurred.


## Paid migration order after the Home merge

The final combined PR34 safeguard correctly rejected nine paid migrations whose
versions preceded the now-merged Home14020000. Earlier local check commands used
an unsupported --base flag; the checker reads MIGRATION_BASE_SHA. With the actual
base supplied correctly, the same nine ordering failures reproduce. The failed
CI34892027685 and local diagnostics are retained.

Move those nine still-unmerged migrations to20260914020100–20260914020900 in their
original dependency order. Each SQL file is byte-for-byte identical under its new
name; no table/function is duplicated, and nothing already in master changes.
The explanation forward update14030000 stays after all of them. The existing
combined local database already applied these identical bodies after the Home
schema, so its64 contracts/function lint remain source-specific evidence. Fresh
full baseline CI must verify the actual renamed tree before merging.

Private `integration-review-r1/paid-migration-order-r1.json` records all old/new
paths and SHA-256 identities. No hosted database or deployment was touched.


## Existing tip status provider proof and guarded persistence

September14 inspected existing Payment columns, POST /payments/tip, refresh route,
StripeService.createTipPayment/syncTipPaymentStatus, callbacks, state transition
helper and the earlier gigTipProof draft. Current creation still calls Stripe
before inserting Payment and has no durable client request UUID. The existing
Payment.id, financial columns and metadata can supply that future reservation;
no competing tip table is justified by this status repair.

Baseline tests reproduce14 failures/one pass for accepting mismatched or stale
provider evidence and inferring capture time without the actual Charge. Separate
transition regressions reproduce two failures/15 passes: the old catch path
writes directly around a rejected transition, or reports cancellation despite a
failed write. Existing real SQL also reproduces a dispute-state race before the
new financial snapshot guard. The original failures remain recorded.

The existing syncTipPaymentStatus now reuses readTipProof for a fresh matching
PaymentIntent/Charge rather than trusting a supplied webhook/create object.
It checks current mode, amount, currency, customer, payer/worker/gig metadata,
platform fee/destination shape and actual capture. Capture time comes from the
verified Charge. The existing state transition helper can bind the original
financial snapshot and status in its guarded update; existing callers retain
their original behavior when no snapshot is provided. Failed/conflicting writes
remain unresolved; no direct fallback can overwrite them. A paid flag without
provider identity is rejected, while an unknown pending original stays pending.
No screen/layout/endpoint/schema is replaced or added.

Validation: final78 focused tests across seven existing suites pass, including
payment/webhook/mobile/read-path compatibility, mismatched identities, stale
success, missing identity, failed persistence, and amount changes. The first full
backend run passed5837 tests/16 skips; after adding the snapshot guard it passed
5838/16 with natural exit0 and the existing open-handles warning. Only the final
two missing-ID regressions and their bounded condition followed that full run;
the final focused suite covers both. Final-head CI remains required.

Nine scenarios run the actual StripeService/state machine against the owned
combined PostgreSQL database via a private SQL adapter: verified success,
stale-event/current-processing, wrong amount, wrong Charge binding, intervening
dispute, intervening amount change, lost database acknowledgement followed by
read recovery without another write, zero-charge cancellation, and inconsistent
already-paid state. They use49 queries, zero provider mutations, and synthetic
provider/notification transport. All exact synthetic users, gig and Payment are
removed. Initial harness failures are retained: its identifier whitelist omitted
digits in last4, and its counter initially counted attempted rather than affected
rows. The intervening-dispute failure was a real application gap and is repaired.

Private evidence is under existing-tip-provider-proof-r1 in the existing local
audit root. No archive/credential/operator log is committed. These checks do not
establish hosted Stripe, installed confirmation, durable creation or full tips.
The current provider guidance also calls for reusing an existing intent and an
idempotency key; provider keys can expire, so that alone cannot replace a durable
local original: [Stripe PaymentIntents](https://docs.stripe.com/payments/payment-intents)
and [idempotency](https://docs.stripe.com/api/idempotent_requests).

Next: reserve the original using the existing Payment model before provider
creation, freeze terms under a lock, and continue same-request/native/browser
confirmation and lost-creation recovery. Preserve the original tip modal design.


## Original tip reservation in existing Payment

September14,2026. Existing source inspection found Payment already has the UUID,
financial amounts, payer/worker/task, provider/customer IDs, timestamps and metadata.
The current createTipPayment still contacts Stripe before inserting that row. This
checkpoint adds the missing atomic reservation and lease functions in
`20260914040000_gig_tip_original.sql`; it does not add a table, column, route, client
or screen. Original Payment.id is also the request UUID. Legacy rows remain intact.

The behavioral contract checks exact original identity across retries/session
renewal, changed amount/method/provider mode/terms conflicts, personal-poster and
confirmation/worker/Connect requirements, existing successful-tip limits, nullable
legacy recovery, immutable fields and direct-client denial. Preparation binds the
existing customer winner, keeps the first provider-attempt time and rejects old
unknown outcomes after23 hours. Explicit cancellation is terminal only before any
provider preparation; a timeout never proves no charge. Stripe documents pruning
of [idempotency keys after at least24 hours](https://docs.stripe.com/api/idempotent_requests),
so the23-hour cutoff is a conservative local recovery policy, not a Stripe guarantee.

Verification in the owned combined database `pantopus_paid_20260914_contract`:

- All65 existing/new raw SQL contracts pass; generated tip pgTAP is `ok`.
- Eight separate-connection scenarios pass: same-ID replay, competing IDs,
  transaction rollback, poster change, exclusive provider lease, lease expiry
  during an observed task lock wait, frozen customer after account change, and
  slot release only after unstarted cancellation commits. Seven scenarios exercise
  concurrency; the customer check is sequential and the lease-expiry case also
  verifies wall-clock revalidation. Exact synthetic fixture cleanup is zero.
- Application-function lint passes357 functions/107 attached bindings, zero
  errors/eight existing warnings. Migration ordering and generated wrappers pass.
- Initial draft contract failed nullable legacy metadata recovery; the repair
  passes. The concurrency script first failed Python parsing before any database
  access; corrected source passed its first execution. Keep failures as evidence.

Reproduction: `scripts/db/contracts/gig-tip-original.sql`, its generated wrapper,
and `scripts/db/test-gig-tip-original-concurrency.py`. The latter requires explicit
local PG* settings and an owned `pantopus_*_contract` database. Private evidence is
under `existing-tip-provider-proof-r1`; credentials and database archives stay out
of Git. These functions are not yet wired into the app. Modern provider binding,
terminal receipts, route/session commands, original-ID client recovery, legacy
cancellation and delivery remain open, as do hosted adoption and real provider /
installed-client acceptance. Current screen designs are unchanged.


## Tip service and API use the original Payment

September14 working follow-up to reservation `ff51584d5`. The same unmerged
migration now freezes the exact provider create JSON once and records matching
pending/terminal evidence atomically in Payment. No additional table/column was
introduced. Existing StripeService.createTipPayment reuses getOrCreateCustomer's
existing CAS, then prepares the original before calling Stripe with a fixed key.
Unknown create responses recover by exact-intent discovery or an explicit retry
within the saved recovery window. Current provider proof precedes SQL receipt
recording and transient checkout; check cannot create/confirm/cancel an intent.
Cancellation is explicit and needs current zero-charge proof, or the durable fact
that provider preparation never happened. Ordinary downstream refund/transfer
states remain compatible with protected original capture identity.

The existing tip POST requires original UUID, unchanged amount/method/terms and
current actor/session. Preview and local original-read endpoints return opening
proof. Old unscoped commands fail409 before the service; pending progress is202,
and only terminal receipts are200. Existing refresh/webhook paths route marked
Payments through the same original check. Modern notices reuse the existing
Notification idempotency key; durable push delivery remains open.

Evidence:86 focused backend tests/5 suites pass. The43 service tests initially
had17 failures from the test's cross-realm structuredClone objects compared with
Node strict equality; replacing the fake RPC copy with actual JSON transport
semantics fixed that fixture. Actual SQL contract, service and provider semantics
are independently covered:12 service/real-SQL scenarios pass in129 queries,
including a first free-task tip through existing customer CAS, provider response
loss/discovery, identical create retry parameters, transient checkout, provider and
unstarted cancellation, lost committed/uncommitted database outcomes, concurrent
service requests, provider amount mismatch, unknown original reads, and cancellation admitted before a delayed first submission. The
reusable `scripts/db/test-gig-tip-original-service.cjs` uses synthetic provider and
notice transports plus real local SQL through a bounded psql adapter; it is not
PostgREST or real-provider acceptance. Exact synthetic cleanup is zero.

All65 raw contracts pass again; function lint passes358 functions/107 bindings,
zero errors/eight existing warnings. The first full backend run records5878 passes,
16 skips and one `homeDocumentFiles` socket interruption. That unchanged file
passes33 tests alone; the full repeat reports5879 passes/16 skips, with natural
exit0. The later cancel-before-first-admission repair is covered by the final
focused86 assertions and12 real-SQL scenarios; it follows the full run. Full current-head CI is still required for this newer
working source. Pushed89658c9e6 completed CI34893989362 with15 successes/one path
skip. Existing clients are still on the old tip command, so this is a partial
backend integration, not a deployable or merge-ready feature. Keep original screen
designs and reuse the existing SDK/confirmation components for the client update.


## Existing web tip confirmation and protected original recovery

September14 follow-up to backend410ae2767. The preexisting TipModal retained a
created payment only in memory, did not present card confirmation, and could not
recover an interrupted creation after restart. The existing API method, modal,
CompletionFlow and GigPaymentSetup now use the tested original Payment protocol.
The amount picker and card-confirmation layouts/styles are preserved. Tip copy
accurately describes an immediate separate charge. No product screen or storage
system is added; ProtectedRecoverySlot's existing AES-GCM/IndexedDB transactions
now also support replacing a specifically expected revision for explicit recovery.

The original amount, worker, terms and UUID are saved before POST, without SDK
secrets or session credentials. Missing reads retain that original. Pending checks
and explicit cancellation keep its UUID. Active-request conflicts require a
verified read and explicit adoption guarded by the saved revision. Every receipt
must match identity, amount, currency and charge outcome. SDK success alone does
not publish a sent tip. Refund/dispute records lead to history information. Current
actor/session/origin/task and storage revision guard callbacks and cleanup. The
existing page reopens retained originals, including provider returns; query-string
success flags are never evidence. Session changes during the page's storage read
cannot open the old original.

Final156 tests/six suites pass:45 modal/page-recovery cases, seven existing/shared
confirmation cases, and104 existing cancellation/checkout/authorization assertions.
TypeScript has zero diagnostics. Scoped lint:zero errors/seven existing any
warnings and one ref-lifecycle warning. The broader cancellation page run first
failed four tests because its old TipModal mock replaced the new named exports;
retaining the actual helpers repairs the fixture, with all30 entry assertions
passing. No app behavior was relaxed for that failure.

Actual Chrome confirms encrypted storage with a non-extractable key, lost response
and reload retaining one UUID/500 cents, exact retry, one matching completion and
removal. Seven actual IndexedDB transaction checks pass; two separate browser tabs
read one original, the second adopts it, and the first's stale revision cannot
overwrite that adoption. Exact shared fixture cleanup passes. The private Axios
adapter supplies synthetic API/provider outcomes, so this is not real Stripe,
HTTP/SQL end-to-end or installed-native acceptance. Visual inspection confirms the
existing picker layout. Both tabs and server18121 are stopped, the exact temporary
page is removed, and Next's generated tsconfig change is restored. Source/evidence
binding:private `existing-tip-provider-proof-r1/tip-browser-binding-r1.json`.
Native original-request clients, legacy recovery, durable delivery and provider
acceptance remain open. PR34 is still draft and needs final current-source CI.


## Existing iOS tip handler and protected recovery

September14 follow-up to web1b9ff598e. The old GigDetailViewModel tip handler
reported success immediately after PaymentSheet completed, even when its optional
status refresh failed, and lost the original across model/app lifetime. The same
handler now uses the original tip terms/commands/receipt DTOs, with the existing
KeychainStore and CheckoutCoordinator. Keychain reads distinguish failure from
absence. Original amount/UUID/worker/terms are retained before POST; SDK credentials
are transient. Current actor/session/origin, stored original and exact server
receipt guard every continuation and cleanup. A current intent check precedes SDK
presentation; success/error/dismissal are followed by a check of the same original.
No SDK outcome alone reports paid. Explicit cancel needs a zero-charge receipt.
Conflicting originals require verified explicit adoption. An existing refund or
dispute record does not announce a new sent tip.

The existing amount picker, spacing, styles and Stripe screen are retained. The
same controls show frozen amount/recovery actions when an original is pending;
an ineligible/read-failed opening cannot choose another amount. Existing custom
amount parsing now rejects nonfinite/over-limit values before converting to Int.
No new product screen, native storage mechanism or database change. One new test
file separates recovery assertions from the existing tip test fixture, keeping
normal static limits; it is not another app implementation.

Evidence:the first compile reaches app success but test compilation fails on a
missing try in one new assertion. Corrected source passes47 selected tests
(18 tip plus29 existing authorization/bid-recovery). Final additional storage and
callback checks pass21 tip tests, for50 distinct selected checks across the two
successful runs. Eleven altered receipt bindings are also exercised inside the
receipt-validation test. SwiftLint and SwiftFormat pass. The actual simulator
Keychain round-trip crosses separate store instances, verifies this-device-only /
unsynchronized attributes, and confirms exact removal. Synthetic URLProtocol and
PaymentSheet presenters supply API/provider outcomes; this does not establish
real provider acceptance or an installed tip UI journey. The owned simulator is
shut down, with owner devices untouched. Source hashes and run bindings are private
under existing-tip-provider-proof-r1/tip-ios-source-binding-r1.json. Android client
integration, legacy recovery, durable delivery, all-platform UI/provider acceptance
and final current-source CI remain open; PR34 remains draft.


## Existing Android tip handler, original recovery and controls

September14 source `c6b1f830e9878ee54dd30e5d83021a331d3a474b`, following iOS `b98cc283c`. The old
GigDetail handler lost its payment ID across model/app lifetime and treated the
SDK Paid callback as success before a best-effort status refresh. Its existing
picker, detail screen, API/repository and GigTip source now use the same original
request protocol as web/iOS. One narrow typed encrypted-preference adapter reuses
Android's existing Keystore/EncryptedSharedPreferences mechanism. Existing Home,
card-setup and refund stores have different typed scopes/records; reusing them as
tip storage would break those contracts. No new screen, layout, table or migration.
Three new test files cover the handler, storage failures and actual controls.

The original UUID/amount/worker/terms are durably retained before POST. Reload404
cannot authorize a replacement; a fresh opening obtains current session proof.
Verified active conflicts require explicit compare-and-replace adoption; unrelated
409 responses cannot offer adoption. Current actor/session/origin, stored original,
one shared admission and a presentation-specific token guard SDK launch/callbacks.
A receipt must match all original financial identities and clear protected storage
successfully before reporting paid. SDK dismissal does not cancel a payment.
Explicit cancellation needs a matching zero-charge receipt. Changed task terms
retain the existing recovery action. Nonfinite/out-of-range input is rejected.

Each screen opening owns its handler and retires its callbacks on departure.
A retired account closes the picker and removes its former amount. Existing picker
controls/styles remain; amounts freeze while pending, existing submit/secondary
controls show recovery/cancellation labels. The encrypted file is excluded from
legacy backup, cloud backup and device transfer; SDK credentials/server proof are
not persisted. Storage read/decode/write/cleanup failure cannot act as an empty slot.
A failed preference commit may mutate memory, so the original expected value is
retained until a successful guarded write.

Verification: R1 compiles the app and passes121 selected tests, but fails format
and detekt checks. R2 passes124 tests after three additional amount/conflict checks;
format passes and two remaining static findings are simplified/resolved in place.
R3 passes124 tests, format/detekt and both APK builds. Final R4 changes only the
screen retirement cleanup and its emulator assertion; all other R3-bound source
is byte-identical. R4 format/detekt and both APK builds pass. Preserve those failed
attempts; no assertions or global static settings are weakened. The124 checks
include27 recovery,6 store,5 existing tip/detail,28 saved-task,5 stop-entry,
24 bid-checkout and29 assigned-authorization/API tests. Eleven altered receipt
bindings run inside one validation test.

Five actual emulator checks pass on R4: frozen amount/continuation/cancel controls,
loading lockout, preserved preset selection, retired-account amount removal, and
real Keystore/EncryptedSharedPreferences persistence across store instances. The
last verifies ciphertext excludes fixture identities/origin, rejects mismatched
or retired cleanup, separates scope and removes exactly the random fixture key.
Both installed application/test APK hashes match the candidate. This is actual
Compose and protected storage with synthetic typed API/SDK outcomes; it does not
establish the full installed tip journey or real Stripe/provider acceptance.

Private binding `existing-tip-provider-proof-r1/tip-android-source-binding-r4.json`
records source/product hashes; unit-r3.json and instrument-r4.log retain results.
Owned AVD emulator-5554 is stopped with data retained, no global registration was
created and other devices remain untouched. Build products and evidence are
preserved privately. PR34 stays draft: legacy recovery, durable delivery,
all-platform installed/provider acceptance and final current-head CI remain open.


## Existing legacy tip recovery without replacement charges

September14 checkpoint `e700862f1` repairs a concrete gap in the existing tip flow:
preview returned `legacyPaymentId`, the local original read rejected it, and all
three clients directed users to payment history without retaining/checking that
payment. Historical rows already owned the financial identity. They are now read
as candidates and registered only after fresh matching PaymentIntent/Charge proof
and an unchanged full Payment snapshot under a row lock. Local reads never imply
capture or cancellation. The same Payment.id remains both request and payment ID;
unknown original confirmation/method remain null. Legacy originals allow check or
explicit confirmed zero-charge cancellation, never new creation/discovery or SDK
confirmation. A missing provider ID stays unresolved. Changed provider identity,
amount/customer/currency/mode/metadata and stale financial snapshots fail closed.

The existing original receipt transaction preserves historical successful/refunded/
disputed/transferred states, capture/cooldown and transfer data. Uppercase historical
currency stays stored while the response uses `usd`. Multiple historical pending
rows can each register; preview still prevents a new charge until all resolve.
Existing pickers, protected stores, receipt validators and session retirement guards
are extended. New-charge eligibility still requires current confirmed terms. Native
encoders may omit a null historical date; the route normalizes that omission before
the legacy check/cancel boundary. A different current Charge cannot validate an
already recorded capture.

Only one new file is added: the310-line forward function/index update
`20260914050000_gig_tip_legacy_recovery.sql`. It adds no table/column, service or
screen. Five existing functions are extended and one exact existing-row admission
function is added. This preserves the preceding reservation migration's rehearsal
history. The other19 source/test files are existing implementations. No screen
layout or design is replaced.

Verification on this source:

- Backend100 focused assertions across five existing suites pass:64 service/mobile/
  read/webhook assertions plus36 critical payment-route regressions. The added cases cover historical read-only identity, resume rejection,
  missing intent, no SDK credentials, explicit same-intent cancellation, four proof
  mismatches, lost/uncommitted adoption replies, native null/omitted date and wrong
  Charge rejection. The prior unchanged compatibility evidence remains available.
- Actual StripeService plus owned PostgreSQL passes19 scenarios/176 queries.
  Ten synthetic create calls produce nine modern intents; six historical provider
  fixtures are pre-existing, for15 total fixture intents. Legacy cases create no
  intent or customer. Two explicit cancellations occur (one modern, one historical).
  Provider/notice transports remain synthetic. Exact fixture cleanup is zero.
- All65 SQL contracts and generated pgTAP source synchronization pass. Ten
  separate-connection cases include concurrent historical registration and an
  observed row-lock wait where a changed amount rejects stale adoption. Exact
  fixture cleanup is zero. Function lint checks359 functions/107 bindings with
  zero errors/eight existing warnings. Migration ordering policy passes; complete
  fresh-database replay remains a current-head CI gate.
- Web53 rendered/validator assertions pass; standalone TypeScript passes. Scoped
  lint has zero errors/one existing cleanup-ref warning. The new source is not
  claimed as a real-browser/actual-provider journey; earlier storage mechanism
  evidence remains bound to its unchanged implementation.
- iOS24 focused tip tests pass in `legacy-tip-ios-r1.xcresult`; SwiftFormat/strict
  SwiftLint pass. Android41 focused unit tests pass (30 recovery,6 protected-store,
  5 view-model checks); format/detekt pass. Both compile their current app/test
  source. Legacy API/provider outcomes are synthetic. No full installed historical
  payment journey or actual Stripe acceptance is claimed.

Earlier attempts remain retained: SQL R1/R2 failed due to a test-only column name
and JSON operator grouping; R3 and complete contracts pass. Android R1 failed test
formatting; corrected R2 passes. iOS initial static checks failed optional/style
rules; corrected checks and the single native test run pass. Web R1/R2 did not
start Jest because of command/bin resolution; R3 passes using the existing linked
Jest package. No dependencies were installed and no assertion was disabled.

Private source binding `existing-tip-provider-proof-r1/legacy-tip-source-binding-r1.json`
links source hashes and run files; `legacy-tip-*` logs/results and SQL rehearsals
are preserved alongside it and mirrored in the existing private audit directory.
The owned iOS device is shut down, and no Android emulator or application server
was started. No hosted migration, deployment or provider activation ran.

Remaining: cold historical discovery when the current worker/confirmation has
changed and this client has no saved original, durable tip notices, full installed/
provider journeys and current-head CI. Existing detail gates currently hide the
native tip entry in that cold case; fix the recovery entry without enabling a new
charge against changed terms. Notification review found that terminal replay skips
notice recovery, duplicate creation returns null, and the best-effort metadata
write can use a stale Payment snapshot. The existing stored-notification receipt
sender and scheduled wallet-delivery worker provide reusable transport/retry code;
the wallet settlement delivery table itself requires a settlement and must not be
repurposed for tip capture. No delivery implementation changed in this checkpoint.
PR34, paid launch, R05/R06 and the app remain incomplete.


## Existing tip entry without a saved client request

September14 continuation after `14b8c3ae5`: the existing native detail gates
required the current worker and owner confirmation, hiding historical payment
recovery on a fresh install. Web could similarly lack both a retained UUID and
current eligibility. The existing local preview already identifies the original
payment; no replacement endpoint, payment, screen or database object is needed.

The three detail implementations now inspect that preview for the completed task's
current personal payer. Native restores its existing tip dock only when a pending
payment exists; web opens its existing recovery picker. Existing validators and
identity/session checks bind discovery to the current account and API origin.
An empty preview cannot enable a new charge when current terms are missing. The
picker retains the original amount and UUID and uses the existing explicit check/
cancel commands. New-tip eligibility, screen layouts and styling are preserved.
Seven existing source/test files change; no new file or migration is added.

Verification on the seven hashed source files:

- Web87 focused assertions pass (tip57 and stop-entry30); TypeScript passes.
  Scoped lint has zero errors/seven existing warnings. Cases include an empty
  preview, recovery without worker/confirmation and retired session/origin replies.
- Android76 selected unit checks pass: recovery30, tip view-model7, protected-store6,
  saved-task28 and stop-entry5. Format/detekt pass. Recovery entry disappears when
  the session changes during discovery; existing API outcomes are synthetic.
- iOS26 focused tip tests pass with zero failures/skips; format/strict lint pass.
  Missing current terms can recover the historical amount/UUID through the old
  picker and explicit check; no existing payment leaves the entry hidden.
  R1 compiled but installation failed because the Mac ran out of disk space;
  zero tests ran. After removing2.18GiB of task-owned disposable build caches,
  R2 executes the same compiled app with test-without-building and passes26.
  Sources, accepted products/APKs, device data and test evidence are retained.

Private `existing-tip-provider-proof-r1/cold-tip-source-binding-r1.json` binds
all seven hashes and run results. `cold-tip-*` logs/commands/results are retained
privately and mirrored in the existing audit directory. This checkpoint is not a
full installed UI or actual-provider journey. No Android emulator was started;
the owned iOS simulator is stopped. No hosted/provider change ran. Current-head
CI, durable tip delivery and the remaining paid/all-app acceptance stay open.


## Existing tip notifications reuse the payment delivery worker

September14 continuation after cold-entry `7791bb16f`: the existing
`_notifyTipReceivedIfNeeded` ran after capture, created/sent a best-effort notice,
and wrote a stale Payment metadata object without checking the write result.
Terminal command replay could skip it; a crash or uncertain push could strand
notification delivery. Existing Notification idempotency and the stored-notice
sender/scheduled wallet relay already provide the required storage/transport pieces.
The wallet outbox table requires a wallet settlement, so it cannot represent tip
capture. Existing typed Home/assignment/stop outboxes have different ownership.

The repair extends Payment metadata, Notification and the existing scheduled relay.
A new capture atomically inserts the existing tip notice and its immutable financial/
content snapshot and capture-time preference. Failure to store that notice rolls
back the local capture write; existing provider/read recovery retains the same
payment. The worker claims one row immediately before delivery, checks the exact
leased note and current payment, then uses the existing receipt transport and
current preference/token ownership checks. Unknown delivery retries the same
Notification ID after backoff; accepted/suppressed outcomes are durable. A lost
acknowledgement is recovered from the stored event. Delivery updates merge under
the Payment row lock and preserve newer metadata and original request terms.

Read notices retain their read flag. Deleted/changed notices, changed recipients
or refund/dispute state suppress an unsent alert. Existing notices keep their
identity/content/read state and are not re-alerted. Historical captures are not
backfilled on adoption/replay. One forward function/trigger/index migration,
`20260914060000_gig_tip_notification_delivery.sql`, preserves earlier migration
history and adds no table/column. Ten existing source/test files change alongside
that migration; no UI or screen design changes. The competing best-effort service
method is removed. Both existing cron and pg-boss registrations reuse their current
worker, with a bounded25 events per queue per run.

Verification:

- 181 backend assertions pass:102 tip/transport/webhook checks and79 existing
  critical routes, paid-delivery and wallet compatibility checks. Capture-time
  consent, current opt-out, missing preference proof, unknown transport, deleted/
  changed eligibility and failed acknowledgement are covered.
- All65 SQL contracts pass; the final extended tip contract also passes after
  adding authenticated/anonymous privilege denial and existing read-notice
  preservation. Generated pgTAP wrappers synchronize. Local migration policy passes.
- Actual StripeService, existing relay and owned PostgreSQL pass22 scenarios with
  235 queries. Eight committed local notices survive16 synthetic transport attempts
  (one unknown attempt and one accepted attempt each); lost final SQL acknowledgement
  creates no extra notice or send. The preserved charge scenarios still make ten
  create calls/nine modern intents, six pre-existing legacy intent fixtures, two
  cancellations and one customer; no historical replacement charge is created.
- Thirteen separate-connection cases pass, including skipped locked delivery,
  expired-lease reclamation, stale-worker denial and observed row-lock waiting
  while preserving newer Payment metadata. Exact fixture cleanup is zero.
- Function lint:363 functions/108 bindings, zero errors/eight existing warnings.

R1 backend failures were stale tests spying on the removed best-effort helper;
R2 retained stale assertions and exited139. Corrected R3 passes102, and the separate
compatibility run passes79. Service/concurrency R1 adapters could not parse SQL NULL
for an empty queue; corrected R2 both pass. Initial owned-local migration application
reported SET LOCAL outside a transaction; all object creation succeeded. Full fresh
schema replay remains a current-head CI gate. These failures are retained, not
counted as passing attempts.

Private `existing-tip-provider-proof-r1/tip-delivery-source-binding-r1.json` binds
all11 implementation/test/migration hashes and run files. Evidence is mirrored in
the existing private audit directory. Actual external provider/push transport and
full installed tip/notification returns remain unverified. No hosted migration,
deployment, provider activation or physical-phone operation ran. PR34, the paid
scope, R05/R06 and the wider app remain incomplete. Next: existing installed tip
recovery journeys, then remaining paid-policy/acceptance rows, reusing accepted work.


## Installed iOS historical tip recovery and accessibility

September14 after `161aaf529`: the existing installed detail screen and tip picker
now pass a complete historical recovery journey through the actual API client,
Express/Joi tip route, StripeService and owned local PostgreSQL. Authentication
and provider responses are synthetic; there is no actual Stripe or push send.
The fixture has an existing$10 payment and no current worker/owner confirmation.

The screen exposes its old tip action, loads the original$10 with amount controls
disabled, checks the original, restarts and restores that same amount/UUID, then
checks a freshly supplied synthetic capture. SQL records exactly one success
receipt and one Notification for the same Payment. Both HTTP commands use check
and1000 cents; provider create count is zero. After another app restart the recovery
entry is absent. The existing real Keychain store is used across these restarts.
The actual installed app matches all679 files in the tested build bundle.

This journey exposed an accessibility identifier defect: the parent shell
identifier was inherited by its sole dock button, replacing the intended control
identifier. The complete R4 hierarchy shows the visible Send a tip button identified
as contentDetailShell. Three `accessibilityElement(children: .contain)` modifiers
in the existing shared detail shell/dock and tip picker preserve their distinct
controls. Layout, labels, styling and payment behavior are unchanged. The actual
R5 picker screenshot retains the established sheet and frozen amount. No new screen,
file, table or migration is added; one existing payment UI test file is extended.

R5 passes one installed journey with zero failures/skips; build R7 succeeds and
SwiftFormat/strict SwiftLint pass on all three source/test files. The private
`installed-tip-ios-source-binding-r5.json` binds hashes and679-file product equality;
`installed-tip-ios-state-r5.json`, `installed-tip-ios-summary-r5.json`, screenshot
and result bundle preserve the observed HTTP/SQL/UI evidence. The helper's earlier
XCTest initializer error (build R1/R2), expired-login/landing-page assumptions
(UI R1/R2) and inaccessible identifier (UI R3/R4) remain failed attempts. R1–R3
were stopped after known failures and have incomplete result bundles; R4 has a
complete failing result and exported hierarchy. No failed run is counted as accepted.

Cold-entry `7791bb16f` passed all15 applicable CI jobs/one Seeder skip in
[CI34920129205](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34920129205).
Delivery head `161aaf529` is pushed to the PR branch for its own CI; the new iOS
accessibility/test checkpoint will also require current-head checks. The owned iOS
simulator is shut down, preserving its data. The loopback18109 fixture remains
reserved for Android/web; its current successful iOS state is archived before reuse.
Actual provider/push delivery, other installed tip cases, wider paid policies and
all-app acceptance remain open. Next: Android/web existing tip journeys, then P04–P10.


## Installed Android and web historical tip recovery

September14 follow-up reuses the existing task detail, tip controls, protected
storage, actual tip HTTP routes, StripeService and owned local SQL. Authentication
and Stripe outcomes are synthetic; neither an external charge nor a push send ran.
This verifies production controls under a private fixture, not the complete site
or real-provider acceptance. The existing screen designs are preserved.

Android's first installed journey on `d6a0194ea` passes cold discovery, frozen$10,
restart/reopen, two checks of the same historical UUID, one capture/notice and exact
one-entry encrypted cleanup. The installed APK matches SHA256 `2774f09daee602ed6247d6d34d454867dc53fee9a309f31a59ebb658045c2a15`.
It also exposes a stale "Check tip status" dock after success, until reopening.
The existing coordinator now publishes terminal receipt state and calls the existing
detail refetch only after verified receipt plus exact storage cleanup. Terminal
state no longer overrides the detail dock. Internal original/receipt protection
remains; failed storage cleanup does not refresh or report terminal success.
Three existing Android implementation/test files change, with no new product file.

The corrected source passes31 recovery/7 view-model tests, formatting, Detekt and
assembly. Two installed success/cancel journeys pass with restart, frozen amount,
zero replacement intent/customer creations and immediate dock retirement before
another restart. Success makes one durable notice; cancellation cancels the same
intent once and makes none. Both remove exactly one encrypted entry. The installed
APK equals the candidate byte hash recorded privately. Earlier R1 Detekt rejects
a complex condition; splitting the existing guards fixes it without changing policy.

Actual Chrome passes existing CompletionFlow/TipModal discovery, selected frozen$10,
reload/reopening, two same-ID checks, one local receipt/notice, zero replacement
creates and removal of the saved original/recovery entry. R1 incorrectly expected
the custom input to contain a selected preset amount; the screenshot proves the
existing$10 preset is selected and the empty custom input is disabled. R2 verifies
that unchanged design and passes. There are zero browser page errors. No web product
file changed; its temporary private wrapper is removed and configs restored.

Evidence is source/product-bound in private `installed-tip-android-source-binding-r2.json`,
`installed-tip-web-source-binding-r2.json`, the Android success/cancel-r2 XML/images/
state snapshots, Chrome-r2 snapshots and run logs under `existing-tip-provider-proof-r1`.
Earlier failed attempts remain preserved. Both owned native simulators, the owned
Chrome process and tip fixture18109 are stopped. Exact SQL cleanup reports zero
fixture auth/users/gigs/payments/notifications; products/device data are retained.
PR34 stays draft; current-head CI, real-provider/push acceptance and the remaining
paid/no-show/fee/dispute/inventory scopes remain open.


## Existing no-show report admission

September14: five route reproductions prove that the existing no-show preview
returned `can_report:false` while a direct POST still cancelled an early or already
started task. Both poster/worker exact waiting boundaries were bypassed. The
existing preview calculation is now shared with POST and enforced before creating
an incident, changing the task or issuing a notification. Existing30-minute
scheduled-start,150-minute unscheduled-acceptance and24-hour worker waiting windows
are preserved, including the strict boundary. Invalid timestamps, absent/same
counterpart and recorded work start fail closed. No fee rate or allocation changes.

Tests cover both rejection and retained eligible paths using the real Express
router:54 tests across stop/payment/save-report suites pass. All privacy gates pass,
including15 audience-profile checks. Nine actual HTTP requests against the same
router and owned SQL reject before writes; exact Gig snapshots remain unchanged,
with zero incidents, notifications or provider calls. The local adapter reads actual
SQL; authentication is synthetic. Exact fixture cleanup passes. The initial local
harness omitted the existing required Gig.description; R1 failed before a request
and cleaned its actors, and corrected R2 passes. Source/fixture/run hashes and logs
are retained privately as `no-show-admission-*` under `existing-tip-provider-proof-r1`.

This changes only the existing gigs route and existing route test file. No table,
migration, screen or layout is added. This is an admission repair, not acceptance
of no-show execution: the old multi-write incident/cancellation/reliability path
still needs concurrency, retry and exact financial receipts. The defined fee rates
alone do not settle who owes/receives worker cancellation/no-show fees; a policy
clarification is pending. Completion and other independent security checks continue.


## Existing worker completion preserves current assignment

September14: six failing route reproductions show that a delayed worker completion
could overwrite a changed worker, owner, payment, price or task status. The existing
mark-completed handler now reuses `bindGigPaymentSnapshot` and checks current
in-progress status, empty worker/owner completion and the observed assignment/start
times in the same conditional UPDATE. A lost comparison returns409 before affinity,
notifications or success; current task data stays intact. Valid completion retains
the original note/photo/checklist behavior. Only the existing route and lifecycle
test file change, with no schema, screen or layout change.

93 focused route assertions pass, including nine changed-snapshot cases and valid
completion. All privacy gates pass, including15 audience-profile assertions. The
actual Express/owned-PostgreSQL harness passes ten interleavings via separate SQL
connections plus one unchanged assignment. Replacement-worker/owner/payment/price/
status/timestamps/owner confirmation and a competing completion remain byte-for-byte
intact after rejection; no notice is attempted for them. Valid completion saves its
existing proof and attempts one synthetic owner notification. No provider capture
runs in worker completion. Exact owned fixture cleanup passes.

Private `worker-completion-http-sql-r3.json`, source bindings and logs retain the
proof. R1's fixture used a noncanonical account_type and rolled back; R2's local SQL
adapter incorrectly encoded PostgreSQL text-array proof photos as JSON. The adapter
was corrected for the existing column type; product serialization was unchanged.
These failed attempts are retained alongside the passing R3. Existing web/native
callers were inspected: they retain proof input on a failed submission. That source
inspection is not a new installed-client acceptance claim; native failures currently
show generic retry copy. Full proof-upload/privacy, command/session retirement,
loss/retry recovery, owner-confirmation effects and durable notification acceptance
remain open within P04/P07/P08/P09.


## Existing owner confirmation preserves reviewed completion

September14: three route reproductions show that owner confirmation checked the
payment/parties/price but still confirmed changed worker-completion or assignment/
start timestamps after capture returned. The existing conditional UPDATE now
compares those dates; its concurrent-receipt fallback also requires completed
status and matching dates. The existing worker and owner paths share the same
assignment-comparison helper. No payment table, migration, service or UI is rebuilt.

101 assertions pass across the existing paid lifecycle/stop/payment route suites,
including changed dates, invalid concurrent receipts and matching /complete alias
recovery. Six actual Express/StripeService/owned-PostgreSQL cases pass with synthetic
provider/auth/notice transport. Four changed-work cases return409 after recording
the exact successful capture; the legitimate financial record stays captured_hold
while owner confirmation and newer task state remain untouched. Two unchanged
cases confirm and retry with one capture/notice attempt each, including recovery
from a lost provider reply. There are six synthetic captures, zero new intent
creations and exact fixture cleanup. Source, fixture and product limits are bound
in private `owner-confirmation-*` evidence under `existing-tip-provider-proof-r1`.

This is a comparison repair, not complete owner-confirmation acceptance. Existing
post-confirmation notification/reliability/standby writes still need durable
recovery; client opening/command-session binding, exact proof-file validation and
full installed/provider journeys remain open. The three date predicates do not
establish a general immutable attachment-review contract.


## Existing owner confirmation commits its records together

September14: an actual Express/StripeService/local-SQL reproduction interrupted the
User.gigs_completed write after owner confirmation. The first request and retry
both returned200, the captured Payment and owner receipt remained saved, and the
worker's count stayed zero. That is a concrete partial-write defect in the existing
flow. Active/archive migrations and all-ref history contained no existing
confirm_gig_completion function; the existing capture functions commit financial
proof without grouping these later Gig/User/GigBid/Notification writes.

The existing route now invokes one service-only transaction over those existing
records. It locks the current Gig, rechecks current owner/business authority and
observed assignment/completion dates, locks and verifies the committed captured
Payment, then writes confirmation, an atomic count increment, remaining standby
closures and existing in-app notification types together. UPDATE RETURNING selects
only the bids actually closed. A failed write rolls back all confirmation effects
while retaining the previously verified capture. Existing capture recovery and the
original Payment/intent are reused. Concurrent/retried confirmations do not change
the first receipt or recreate read/deleted notices. Existing free completion and
historical receipt behavior are preserved. No historical count/notice backfill runs.

One forward function migration,20260914070000_gig_completion_confirmation.sql,
is needed for the database transaction because separate REST writes cannot roll
back together. It adds no table, column, trigger or screen. Existing transport now
accepts the gig_confirmed type; no notification is inserted again by the route.
No screen, layout or client file changes. Migration ordering/compatibility checks
pass against actual master e775af9ae; the initial missing compatibility comment was
corrected without changing the SQL body. The schema addition is inert for the old
backend; backend rollback retains already committed records and needs no data rewrite.

Verification:116 focused tests in the existing lifecycle/stop/payment/delivery
suites pass, as do privacy gates (including15 audience checks),65 SQL contracts and
the generated paid acceptance pgTAP wrapper. The initial new transport test had an
unqualified fixture helper (one failure/115 passes); its corrected test passes.
The SQL contract forces User, bid and notification writes to fail and checks exact
rollback/preserved financial truth, actor/date/financial denials, free completion,
read/deleted notices and service-only privileges. Application function lint checks
364 functions/108 bindings with zero errors/eight existing warnings.

Fourteen actual HTTP/StripeService/owned-SQL scenarios pass (235 SQL queries,
12 synthetic captures, zero replacement intent creations): six preserve date and
lost-provider-reply behavior after moving the comparison to SQL; eight exercise
three interrupted effect writes and successful retries, lost committed RPC reply,
failed notice transport, free completion, historical receipt and ordinary paid
completion. Real SQL rows confirm the counter/bid/notice outcomes, and notice
metadata contains only the existing gig/reason fields in personal context. Five
separate-connection tests observe actual PostgreSQL lock waits: duplicate same-task
confirmation, two tasks crediting one worker, a rolled-back leader with a waiting
retry, changed completion and changed owner. Exact fixture cleanup passes; no
owned server/device remains running from these checks.

Private owner-effects-* logs, fixture code, source hashes and result files are
retained under existing-tip-provider-proof-r1 and mirrored to the owner recovery
archive. CI34924470956 passed the previous installed-tip checkpoint4c8f11114.
Canonical checkpointaddebe757 is runningCI34926992422; this newer transaction
milestone still needs its own current-head CI before integration/merge.

Limits: authentication/provider/push transport are synthetic. The in-app notices
are durable, but push/socket delivery and existing Home service-history capture
remain best effort after commit. A lost RPC response preserves those notices but
can leave transport unattempted; this is measured, not labeled eventual delivery.
Client opening/session binding, proof-file privacy, full installed/provider
completion and fee/no-show policy remain open. No hosted migration or activation ran.


## Existing public gig detail protects completion evidence

September14: six failing route checks reproduced private completion notes, proof
photo URLs, checklists and owner confirmation feedback in public GET /api/gigs/:id
responses for anonymous, unrelated, former-worker, bidding, revoked-business and
failed-authentication callers. The existing SELECT-star path used a serializer
that passed all five fields through. The existing serializer now defaults those
fields out; the detail route retains them only for the current accepted worker
or owner, including current business manage/post permission. Existing public task
content and participant proof presentation are preserved. No screen/layout changes.

While checking that boundary, a separate reproduction showed that hasPermission
could treat a failed BusinessPermissionOverride read as an absent denial and use
a role grant. The existing helper now returns false on that read error. Its usual
role and override behavior remains intact. This is four existing backend/test
files; there is no new service, schema or migration.

155 assertions across six existing route/business-permission suites pass, along
with all privacy gates (including15 audience checks). Eleven actual Express/owned
SQL reads exercise anonymous/unrelated/invalid authentication, owner/current worker,
authorized/revoked/explicitly denied business administrator, an unavailable denial
read, departure and replacement worker. The existing business permission helper
runs against real SQL. Exact task rows remain unchanged; zero provider or notice
calls run; owned actors/tasks/team/override and temporary role fixtures are cleaned.
Authentication and the injected failed override read are synthetic. R1's private
harness restored its module override before lazy optional-auth loading, so owner
access failed; R2 fixed that but assumed role defaults existed in the schema-only
rehearsal DB. R3 explicitly seeds those absent synthetic role defaults, removes them
afterward, and passes all11 reads. Product source is unchanged between those harness
attempts. Both initial unit failure sets and private harness attempts are retained.

Evidence is source-bound in private completion-proof-read-* and
completion-permission-* files under existing-tip-provider-proof-r1 and mirrored to
the owner recovery archive. This verifies the public HTTP response boundary, not
all completion-media privacy. Existing upload paths still require proof of owned
file references and actual private object access; a File.visibility label alone
is not provider access control. Existing raw Gig SQL policies also use creator/
beneficiary relationships and need current proxy/business-authority verification.
Client session/restart recovery, full installed/provider journeys and completion
push/provenance delivery remain open. No hosted change or native rebuild ran.


## Existing Gig policies retire revoked creators

September14: an authenticated PostgreSQL role still read and replaced private
completion proof after the creator's BusinessTeam membership was revoked. The
baseline gig_select_authorized and gig_update_creator policies depended forever
on created_by. The existing backend posts business gigs with the human creator
and business user_id, so current HTTP authority alone did not protect this path.
The initial private raw-gig-proxy-before-r1 SQL reproduces both bypasses and rolls
back all synthetic rows.

The two existing policies now require current authority for a creator acting on
another owner's task. One caller-bound SECURITY DEFINER wrapper reuses existing
can_proxy_post and business_has_permission logic, retaining friend delegation,
current business post/manage authority and personal ownership. It accepts no actor
argument and binds decisions to auth.uid(). The narrow wrapper avoids recursively
applying BusinessTeam RLS while evaluating Gig RLS; it does not introduce another
team/permission implementation. Current owners, beneficiaries and assigned workers
retain reads. The existing creator-only raw content-edit rule is preserved for
currently authorized creators. Backend service-role paths remain unchanged.

The first wrapper used STABLE evaluation. An observed separate-connection race
showed a creator UPDATE could wait on the Gig row while membership was revoked,
then commit using the statement's old authority snapshot. VOLATILE evaluation
makes the existing UPDATE WITH CHECK read current authority after that wait. The
same observed race now returns a denial with zero updated rows and original proof
preserved. No request-delay assumption substitutes for the measured lock wait.

The existing paid-gig SQL contract now verifies active creator reads/edits,
revoked creator read/write denial, explicit override denial, manage-only authority,
owner/worker/personal reads, unrelated and anonymous denials, caller identity binding
and unchanged proof after denied edits. All65 SQL contracts and the generated paid
acceptance pgTAP wrapper pass. Function lint remains364 PL/pgSQL functions/108
bindings, zero errors/eight existing warnings; the new SQL-language wrapper is
exercised by actual policies/roles. Migration ordering/compatibility checks pass
against mastere775af9ae. The separate before/after race and exact fixture cleanup
are retained privately in raw-gig-proxy-* with source hashes and durable mirrors.

One forward migration20260914080000_gig_current_creator_authority.sql changes
functions/policies only. It adds no table, column, screen or stored-row rewrite,
and leaves applied migration history intact. Canonical PR34 CI still covers
addebe757; these later integration milestones need their own CI. No hosted schema,
provider or device change ran. This closes the reproduced creator-authority paths;
completion object storage, supplied file references, client session/restart
recovery and full installed/provider acceptance remain open.


## Existing completion submission verifies uploaded files

September14: four route failures reproduce worker completion accepting external,
foreign-task, foreign-uploader and non-HTTP proof strings. The existing completion
handler previously filtered string values only. Its existing web upload endpoint
creates gigs/<gig>/<actor> keys; native generic uploads create uploads/<actor> keys
and existing File rows with gig_completion purpose. Those source paths already
exist; this repair extends the existing S3 service and completion route.

Before saving completion, the route now verifies the configured public-origin/path,
the current uploader/task path, and the existing native File row's purpose, state,
size/type and optional task relationship. A HeadObject SDK request goes only to
the configured bucket using that derived key, never to the supplied URL. Current
object type/size and native metadata must match. Foreign references and missing
objects reject; unavailable provider reads return retryable503 with no completion
write. Existing assignment/date comparisons still run after the provider wait.
Existing image/video/document types, extensionless keys and safe older basenames
remain supported. No upload endpoint, table, migration, service or screen is added;
three existing source/test files change. Signed query/fragment text is not retained
in the canonical stored reference.

178 focused tests across seven existing route/business/upload suites pass, as do
privacy gates including15 audience checks. The initial new positive fixtures left
assignment timestamps undefined instead of SQL NULL (three failures/174 passes);
correcting those fixtures restores the actual database representation. A later
compatibility check retains safe older basenames without weakening task/uploader
path checks. Earlier failure evidence is preserved.

Thirteen actual HTTP/upload/SQL/S3-SDK scenarios pass (77 SQL queries,19 PUT and nine
HEAD requests to the owned synthetic object provider). Both existing upload
endpoints process a Unicode filename; native File rows and exact uploaded bytes
are verified, and the web upload still runs its existing image-processing path.
Cases cover ordinary web/native and older-key proof, foreign URL/worker/task,
missing objects, unknown provider reads followed by recovery, changed assignment,
wrong native purpose/size, a mixed valid/invalid list and completion without files.
Real task rows and notification attempts match each outcome; no financial provider
call runs. All SQL fixtures and local object bytes are cleaned, and both local
servers close. This is HTTP coverage of the endpoints used by web/native clients,
not a new installed UI journey. Authentication, object service and notices are
synthetic; the HTTP routes, S3 SDK and SQL are real.

Private completion-proof-file-* scripts/logs/results are source-bound and mirrored.
R1 covers12 actual cases; final R2 adds older-key compatibility and passes13.
The previous creator-authority checkpoint428243241 is runningCI34929051683;
prioraddebe757 passed all15 applicable jobs/one skip inCI34926992422. These later
source changes still require their own current-head CI.

Limits: this proves admitted references resolve to current supported objects in
an uploader-owned path at validation time. It does not establish private bucket/CDN
access, immutable byte retention, cross-provider deletion/commit atomicity or
completion session/restart recovery. Historical stored references are not rewritten.
The existing document/video proof presentation also needs its own UI verification.
No hosted storage, schema, provider activation or client layout changed.


## Existing completion storage provider check

September14: the actual configured AWS bucket reports all four public-access-block
flags enabled, no public ACL grant and a nonpublic bucket policy. That does not
establish CDN privacy. Two tiny synthetic objects were created at random keys
matching the existing web/native proof paths. Direct anonymous S3 GET returned403;
anonymous CloudFront GET returned206 with the exact synthetic bytes for both paths.
The File visibility flag cannot protect those bytes. Both exact created versions
were deleted and HEAD verified absence. No application records or user files were
read/written; provider configuration was not changed. This was a bounded real
storage probe, not a deployment or Stripe/push activation.

The generic File implementation already contains a Supabase private-bucket path;
Home byte contracts already verify HOME_DOCUMENTS_BUCKET is private. A read-only
getBucket('private') check returned StorageUnknownError and HOME_DOCUMENTS_BUCKET
is absent in the owner local configuration. No private bucket availability is
claimed and no replacement storage infrastructure was created. Authenticated
private delivery, reference/byte retention and reconciliation of historical public
objects remain required before PR34 release. Reusing current S3 keys with signed
URLs alone would leave the demonstrated CDN bypass intact.

Sanitized completion-storage-config-probe-r1, completion-storage-access-probe-r1
and completion-private-bucket-probe-r1 evidence is retained privately and mirrored.
Keys, bucket hostnames and credentials are excluded from Git/chat. The probes do
not establish hosted database/storage policy adoption or other application flows.

## Existing worker completion recovers its saved result

September14: two reproduced route failures reject the same successful completion
on retry (400) or after a concurrent identical submission (409). The existing Gig
already stores its completion timestamp, note, photo references and checklist; no
new command table, client store or migration is needed to recover that receipt.

The existing handler now compares the normalized request with the saved proof and
requires a valid completion timestamp/current assigned worker. A matching saved
result returns200/reused without another write, object-provider read, affinity
interaction or notification attempt. Different proof returns409. A concurrent
winner must also match the original owner/worker/price/payment/assignment dates
through the existing conditional query. Later owner confirmation is preserved.
The existing upload-path parser is reused separately from object verification so
an unavailable provider cannot prevent reading an already committed result.
New submissions still require the actual object check. Only three existing backend
source/test files change; screens, upload endpoints and schema are preserved.

196 assertions across seven focused suites and privacy gates (including15 audience
checks) pass. Eighteen additional cases cover identical retry/concurrency, changed
proof, replaced/foreign actors, invalid/missing completion timestamps, optional
empty proof, query normalization and changed concurrent assignment fields. The
original two failures are retained in worker-completion-retry-before-r1.log.

Eight actual HTTP/SQL scenarios pass with73 queries and the real S3 SDK against an
owned synthetic object provider (14 uploads/eight HEADs). A lost database commit
acknowledgement first returns500; retry returns the exact stored completion with
zero additional provider checks or writes. Two overlapping SQL updates return the
same result with one new submission/one reused receipt and one notice attempt.
Different proof, a replaced worker, later confirmation, empty proof and normalized
query references preserve the exact stored rows. SQL fixtures and local objects
are removed and both fixture servers stop. Auth/object-provider/notice transport
are synthetic; no financial provider call occurs. No installed native/browser
recovery journey is claimed for this change.

The lost-acknowledgement case also demonstrates a remaining defect: worker notice
creation is still after the completion commit and can be missed (zero attempts).
This repair recovers the saved completion only; durable worker notice creation,
transport/Home provenance, protected object storage, immutable retention and
client session/restart recovery remain open. Private worker-completion-retry-*
evidence is source-bound and mirrored. Prior creator-authority428243241 passed all
15 applicable CI checks/one Seeder skip inCI34929051683; the new source requires
its own CI. No hosted schema/deployment/provider configuration changed.


## Existing worker completion commits its notices

September14: the preceding actual HTTP/SQL retry case reproduced a committed
worker completion whose lost database acknowledgement caused zero notice attempts.
The current worker handler stores proof before best-effort createBulkNotifications;
that separate insert cannot provide transaction safety. Existing/archived SQL and
all-ref history contain no mark_gig_completed transaction. The existing owner
confirm_gig_completion function handles a later stage with payment/counter effects;
it cannot directly save worker proof before owner review. The repair adds one
service-only function over existing Gig and Notification records. No table, column,
trigger, service file, client or screen is added. Applied migrations are unchanged.

The existing handler verifies uploaded objects, then the function takes the Gig
lock and rechecks worker, owner, price/payment and assignment times. It saves the
existing note/photo/checklist and timestamp together with owner notices. Failed
notice writes roll back proof. Matching concurrent receipts return the original
row with no new notices; changed proof/assignment is rejected. Notice recipients
reuse the existing business permission functions: current owner and active managers
or posters, excluding the worker. Notice metadata includes only gig ID and proof
presence flags. Maximum-length gig titles produce a valid truncated notice title.
No historical completion is backfilled and read/deleted notices are preserved.
The existing stored-notice transport handles fresh receipts without reinserting.

222 assertions across eight existing suites pass, with privacy gates including15
audience checks. All65 SQL contracts and the generated paid-gig pgTAP wrapper pass;
application-function lint checks365 functions/108 trigger bindings with zero errors
and eight existing warnings. Migration ordering/backward-compatibility checks pass;
fresh-schema replay remains a current-head CI requirement.

Eight actual HTTP/SQL/S3-SDK cases pass (66 queries,14 synthetic object uploads/eight
HEADs). Each completion retains exactly one actual Notification row, including the
lost SQL acknowledgement case (first503, matching retry200). Concurrent identical
submissions retain one proof/notice with one fresh and one reused result. Existing
proof mismatch, worker replacement, later confirmation, optional empty proof and
reference normalization behavior is retained. Auth/object service/notice transport
are synthetic; SQL rows and route/SDK execution are real. No financial provider
call runs. Exact fixture rows/objects are cleaned and local servers stop.

Seven separate-connection waits are observed in pg_stat_activity. Same-Gig retry,
rollback followed by waiting retry, different concurrent proof and changed worker,
assignment date or owner all preserve the required proof/notice outcome. Business
team revocation while the caller waits on Gig excludes that member after the lock
resumes. The contract also forces notice failure to prove rollback and checks
active/revoked/explicit-denial recipients and read/deleted notice preservation.

Private worker-completion-notice-* source, result and cleanup evidence is bound
and mirrored. Canonicalf58f322e4 is runningCI34931505743; this later transaction
still needs its own CI. In-app notice durability is closed for this transaction;
push/socket retries and Home provenance are still open. Actual client completion
retry currently re-uploads proof files and needs its own repair/acceptance. Private
object storage, retention and client session/restart recovery remain unaccepted.
No hosted migration/deployment/provider configuration changed.

## Existing client completion retries reuse uploaded proof

September14, verified local checkpoint: existing web CompletionFlow and native
GigDetailViewModel handlers upload again after an unknown mark-completed result.
Two web regressions reproduce replacement uploads and submission after an account
change. The repair retains acknowledged upload references while the existing
form is open, uploads only missing selected files, and rejects incomplete upload
receipts. Actor/session/origin and attempt checks retire late callbacks after
identity changes, cancellation or departure. Existing native identity readers and
uploaders are reused. No screen, layout, table, migration or service file is added.
Android now passes72 selected JVM tests (36 task lifecycle, five stop entry and31 tip recovery), format, Detekt and compilation. R1–R5 formatting/static/compile failures remain recorded; R6 passes. One test-class size exception follows the existing test fixture convention; shipping complexity is reduced without suppressing its check. iOS passes46 detail tests on R3 plus43 unchanged tip/authorization checks on R2 (89 distinct). The first run stalled before test attachment; R2 exposed an incorrect path in the new fixture, corrected before R3. Installed native verification passes below.

Web passes96 rendered tests across the existing tip and assigned-authorization
suites, standalone TypeScript and scoped lint (zero errors/six existing warnings).
Chrome R2 uses the actual completion picker/controls, Express routes, S3 SDK and
owned PostgreSQL. The first completion commits but its SQL acknowledgement is
lost:503 leaves the form's note and file selected; retry returns200 with the exact
same URL and original timestamp. Two submissions produce one upload request
(original plus existing thumbnail), one HEAD and one durable owner notification.
R1 incorrectly expected only one object PUT, overlooking the existing thumbnail;
that failed assertion is preserved. R2 passes with no browser page errors. The
synthetic authentication/object service/notice transport are explicit fixture
boundaries. Both SQL fixtures clean exactly; Chrome/API/Next stop, the temporary
page is removed and prior configs restored. Screenshots retain the existing design.

References are currently transient, so process restart and a lost upload response
before receipt remain open. A saved proof receipt does not establish private byte
availability. The confirmed CDN exposure, historical reconciliation, retention,
completion push/socket and Home provenance recovery remain open. PR34 stays draft;
canonicalf58f322e4 passed CI34931505743, while this later client/transaction checkpoint
still needs current-head CI. Private web-completion-* and
native-completion-* evidence preserves failures and results separately.

The installed iOS R5 journey passes using the existing task, Photos picker, note,
submit/error/retry and confirmation controls. One upload and two identical
completion submissions preserve the original timestamp and one actual owner
Notification. All679 installed app files match build R6. Authentication, shell
read projection, object provider and notice transport are synthetic; upload and
completion handlers, S3 SDK calls and owned SQL are real. No financial provider
work occurs. R2 reproduced parent identifiers replacing submit/close identifiers;
two existing-sheet accessibility grouping modifiers repair that boundary without
visual changes. R1/R3 setup failures, R2 failure and R4's Photos accessibility hit
target failure are retained; R5 uses the photo's observed frame for the actual tap.
The owned iOS simulator stops and exact SQL cleanup passes.

A further configuration read identifies the unavailable Supabase endpoint as
loopback, with HOME_DOCUMENTS_BUCKET unset. The earlier StorageUnknownError is
therefore not evidence about a hosted private Supabase bucket. The S3/CloudFront
anonymous-byte finding remains an actual configured-provider observation.

The installed Android R1 journey also passes using the existing task, system
Photos picker, note, submit/error/retry, confirmation and Back controls. Empty
proof causes zero uploads/submissions. A lost committed response preserves the
selected photo/note; explicit retry sends identical proof twice, with one upload,
one object PUT/HEAD, the original timestamp and one stored owner notification.
The installed APK matches the tested build. Authentication, shell read projection,
object provider and notice transport are synthetic; actual HTTP upload/completion
routes, S3 SDK and owned SQL run. No financial provider calls occur. The expired
session was signed in through existing controls, then the task link was reopened;
replaying a deferred deep link after login is not verified. Native payment-timing
copy on a free task is a separate unverified follow-up. Neither journey proves
process-restart proof recovery or immediate push/socket delivery after a lost reply.

Exact native SQL cleanup passes and both owned simulators/API stop. The exact
hash-checked Android photo is removed; other device data is retained. Accepted APK
and app ZIP archives match installed products (all679 iOS files). Final private
source bindings explicitly reuse unchanged ViewModel/test checks; the later iOS
UI-test helper and two accessibility modifiers are bound to the passing installed
journey. All10 modified client/test files already existed. Failed runs and the
accepted evidence are preserved and mirrored under existing-tip-provider-proof-r1.


## Existing completion proof uses private bytes

September15: the configured CloudFront probe established anonymous access to new
completion objects despite File.visibility=private. The repair extends the existing
File/quota records, S3 service's completion helpers, both upload endpoints, Gig
reader and private-file recovery job. Existing Home document/task/claim/lease
storage, their migrations, archived code and other branches were compared first.
Their transactions authorize Home actors and cannot bind the current Gig worker
and assignment. One forward migration extends existing records with service-only
reservation/read/cleanup functions, guards and a restrictive raw-File read policy.
No table, replacement service or screen is added; applied history stays unchanged.

Both native callers now send the existing gig ID with their existing multipart
upload. New proof requires an explicitly configured private GIG_COMPLETION_BUCKET;
unavailable or public storage fails closed with no S3/CDN fallback. Same actor,
gig, MIME and bytes select the same existing File ID after an unknown upload reply.
The reservation locks current assignment terms and uses existing quota accounting.
Provider uploads never overwrite; an unknown receipt requires exact stored size
and SHA256. Finalization rechecks assignment. Completion binds ready, undeleted
proof under the same locks; retirement cannot race it into publishing deleted bytes.

Readers authorize before and after fetching exact private bytes. They send no-store
responses, while web retains its existing photo dimensions, classes and full-image
links using temporary blob URLs. Session replacement retires pending requests and
URLs. Existing published legacy URLs retain their prior rendering behavior; their
historical exposure is not declared fixed. Unsubmitted files expire through the
existing private-file worker. Parent deletion preserves immutable cleanup records;
quota refunds once, exact deletion retries and later object writes are reconciled.

Local evidence:206 focused backend checks/four suites and privacy gates (including15
audience checks) pass. The full backend run passes6015 with16 skips and one obsolete
standalone-upload expectation; that existing test is updated to require private
Gig delegation and zero public writes, and all33 compatibility checks then pass.
The initial full run is retained as failed;6016 distinct tests are verified across
the full and corrected focused run. Current-head CI must repeat the complete suite.
All65 SQL contracts pass, with the later unchanged-reference/changed-assignment
refinement additionally passing the paid contract. Generated wrappers synchronize.
A transaction applies the complete new migration over reconstructed preceding
function/constraint definitions and rolls back successfully. Function lint checks
372 functions/112 trigger bindings: zero errors/eight existing warnings. Migration
policy passes; full fresh-schema replay remains a current-head CI requirement.

Eight actual HTTP/SQL/Supabase Storage SDK cases pass (34 SQL calls/20 synthetic
storage calls), including unknown upload acknowledgement, same-file native/web
recovery, unauthorized/unsubmitted-owner denial, lost completion acknowledgement,
authority revoked during byte delivery, public-bucket/corrupt-byte rejection and
exact retired-object cleanup. Six observed separate-connection waits verify quota,
rollback, changed bytes, completion-versus-expiry and worker replacement. Exact
fixture cleanup passes. Authentication and object storage are synthetic; routes,
SDKs and owned PostgreSQL transactions are real. No financial provider call runs.

Web112 rendered checks, TypeScript and scoped lint pass (zero errors/eight existing
warnings). Chrome verifies existing upload/note/503/retry controls with one upload,
one private object POST, two identical completion requests, the original timestamp
and one actual owner notification. All three existing owner photo surfaces render
authenticated, no-store bytes at their prior sizes; sign-out clears temporary URLs.
The temporary page is removed and prior configs restored. Failed harness cookie-
authentication and Cancel-selector attempts remain recorded; owner R3 passes.

iOS46 focused tests, format/strict lint, build and installed Photos/note/error/retry/
confirmation/Back journey pass. One upload/two identical completion requests retain
one timestamp/notice. All679 installed bundle files match the retained product.
The old shared package checkout had missing files; only an owned cache is restored
from the same seven pinned revisions. No dependency version changes. Initial build
and stalled test-attachment failures remain recorded; build R2/unit R2/UI R1 pass.
Android72 selected JVM checks, formatting/Detekt, build and installed system-picker/
note/error/retry/confirmation/Back journey pass. Empty-proof submission sends nothing;
matching retry retains one private object/upload, two identical completion requests,
one timestamp and one notification. The installed Debug APK matches the retained
product. Both owned simulators are stopped, exact fixture rows are cleaned, and the
hash-checked synthetic Android photo is removed. Other device data is preserved.

Private completion-private-* fixtures, commands, results and source/product hashes
remain outside Git and are mirrored under existing-tip-provider-proof-r1. Current
PR34 remains draft. Hosted private-bucket adoption/anonymous-denial verification,
historical CDN reconciliation, broader generic private-file purposes, client
restart/draft recovery, completion transport and Home provenance remain open.
Existing native owner models currently do not expose completion photo/note fields;
this milestone verifies their existing submission flow, not a new native reader.
No hosted migration, bucket configuration or deployment runs in this checkpoint.


## Existing completion notifications reuse the delivery worker

September15: accepted installed-client fixtures established that a lost completion
SQL acknowledgement left one durable in-app notice and zero transport attempts.
The matching-receipt retry returned before the route's best-effort delivery. The
same gap existed after owner confirmation. Existing acceptance, wallet/tip, stop,
expiry and Home task queues, Notification schema/RLS, archived implementations and
all-ref history were compared. Paid acceptance requires an acceptance record; Home
queues require Home/task semantics; Payment metadata excludes free gigs. The repair
extends existing Notification metadata and the scheduled acceptance worker. One
forward function/trigger/index migration adds no table, column or service and does
not backfill historical notices. Existing screens and client sources are unchanged.

New worker, owner and standby completion notices atomically capture SHA256 hashes
of the original Gig terms and notice, commit-time push consent and lease/retry state.
Raw proof, assignment and payment snapshots are never copied into notifications.
The service-only reader locks Gig before Notification, checks current assignment,
confirmation/financial state and business reviewer authority, then strips queue
metadata from transport. Changed notices and obsolete review/bid events suppress.
Read flags survive retries; deletion cancels delivery without recreation. Unknown
transport outcomes and missing/invalid receipt counts retry the same notice; seven
malformed acceptance receipts that previously incorrectly finished now also retry.
Commit-time opt-out stays suppressed after preferences are enabled; current opt-out
and token ownership remain enforced by the existing transport. Existing detail
refresh events are also delivered through that worker after a lost request reply.
Provider delivery is at least once; exactly-once external alerts are not claimed.

Local verification passes204 tests/four focused suites and privacy gates, including15
audience checks. All65 SQL contracts and generated wrappers pass. Complete forward
migration replay in a rollback transaction passes; function lint checks376 functions/
113 trigger bindings with zero errors/eight existing warnings. Full backend passes
6035 tests/16 skips across339 passing suites. Current-head CI remains required.

Two actual HTTP/SQL/scheduled-worker/notification-service journeys pass, using58 SQL
calls, three synthetic push attempts and14 synthetic socket events. Worker completion
returns503 after a committed write, then200 on retry with one original notification.
An unknown delivery receipt retries the same ID and preserves its read flag. A second
journey loses both worker and owner acknowledgements: retry keeps the original three
notices, suppresses the obsolete review and opted-out standby notice, and delivers
one worker confirmation with its three original detail-refresh signals. Six observed
separate-connection lock waits cover worker replacement, deletion, owner confirmation,
read-state changes, stale lease acknowledgement and revoked business authority. Two
additional SKIP LOCKED/rollback cases prevent duplicate leases/phantom attempts.
Exact fixture cleanup passes; the owned API is stopped. No provider/storage sends
or hosted schema changes run in this checkpoint.

Earlier failed attempts remain evidence: seven baseline malformed receipt failures;
missing digest function caused the first migration transaction to roll back, fixed
using the existing built-in SHA256 pattern; function lint found an ambiguous local
variable, renamed before the passing run; two SQL fixture expectation/precedence
failures are corrected before contract R3. Private completion-delivery-* commands,
fixtures, outcomes and source bindings are retained under existing-tip-provider-proof-r1.
Accepted private-proof browser/native products are reused because relevant client
code/configuration is unchanged. PR34 stays draft. Home maintenance provenance,
restart recovery, hosted storage/historical reconciliation, live delivery and the
remaining payment/release scope remain open.


## Existing Home maintenance history commits with completion

September15: two actual HTTP/SQL baseline cases confirmed work but stored no Home
history. The ordinary path failed because HomeMaintenanceLog.task did not exist;
the lost-acknowledgement retry also skipped the best-effort writer. The screen,
routes, homeSystemsService and original migration151 already existed. Migration151
and its archived counterpart were compared with canonical baseline, current tables,
Home record transactions and all-ref history. Its seven original fields were absent
from canonical replay. The existing unique gig_id index already guarantees one row
per Gig; no replacement history table, service or screen is necessary.

One forward migration restores those original fields without rewriting applied
history. Older performed rows remain completed, retain their original values and
receive names from existing notes; already-adopted field values are preserved. The
existing confirmation transaction locks Home/authority before Gig and commits new
eligible history with confirmation, counters and notices. Current adult maintenance
edit authority is required; foreign, revoked, frozen, explicitly denied and minor
Home access cannot add shared history. Private HomeTask publications keep their
existing null origin_home_id and are not silently copied into the ledger. Replaced
Home origins conflict. Historical confirmations are not backfilled, deleted history
is not recreated, and system installation years are never inferred from job labels.
Raw clients cannot fabricate Gig provenance or change its Home, amount, performer,
recording actor or original dates. Worker/Gig deletion removes its foreign-key
identity while preserving the maintenance row. Resident annotations remain possible.

The route's competing best-effort write and now-unused helper are removed. Five
helper-only mocked tests are superseded by actual SQL history/identity/retention
assertions in the existing paid contract. The existing maintenance edit route also
preserves performer/time on a repeated completion or an automatic Gig record, rejects
replacement automatic costs with409, and compares observed status/update time before
writing. Six actual HTTP unit cases in its existing test file cover these changes.
Screens, layout, API envelopes and all client sources are unchanged.

Local verification passes202 tests/four focused suites and privacy gates, including15
audience checks. All65 SQL contracts pass; the later recorder/time guard and actual
worker/Gig erasure cases additionally pass the paid contract. Generated wrappers
synchronize. Legacy-shape forward replay preserves every old column and correct past
status; full replay over already-adopted fields preserves the complete row. Function
lint checks377 functions/114 bindings with zero errors/eight existing warnings.
Current-head CI remains required; the earlier completion-delivery full suite is a
separate6035-pass/16-skip checkpoint, not a claim of a repeated full suite here.

Five actual HTTP/StripeService/SQL scenarios pass with124 SQL calls and one synthetic
capture. Lost confirmation replies retain one history row. A simulated lost provider
capture reply followed by a forced history-write failure leaves the real local
capture receipt intact; retry confirms and writes history without another capture.
Another person's Home gets no history. Existing Home list/edit/manual-create/complete/
retry/delete endpoints work against real SQL; foreign access rejects, original dates
survive retries, changed automatic cost returns409, and a newer cancellation defeats
a stale completion edit. Deleting history then retrying confirmation preserves that
deletion. Authentication and Stripe responses are synthetic; actual Stripe delivery,
installed maintenance UI and hosted adoption are not claimed.

Six observed separate-connection waits cover competing confirmation, transaction
rollback, Home revocation/freeze, a changed Gig origin and explicit permission denial.
They preserve exactly two eligible history rows and five committed completion counters;
the changed-origin request commits neither. Exact fixture cleanup passes and the owned
API is stopped. No native build/device, provider activation or hosted schema change
runs. Accepted client products are retained and reused.

Failed fixtures remain recorded: the initial paid probe used a synthetic charge ID
with an invalid extra underscore, correctly rejected by the existing capture proof
contract. Its first cleanup omitted clearing Gig.payment_id; cleanup rolled back,
then a dedicated exact-ID transaction cleared the reference and verified removal.
Subsequent fixtures clean correctly; the valid-shape paid case passes. The inherited
free-fixture service label is corrected with an explicit evidence annotation. A
wrong-working-directory cleanup search ran no source change; final focused runR4
passes. Private completion-history-* commands, source/results and prior failures are
preserved under existing-tip-provider-proof-r1. PR34 stays draft. Generic maintenance
granular permissions/raw RLS, Home-origin admission, create-command recovery, complete
maintenance UI acceptance and the remaining paid/release scope remain open.


## Existing owner review retires late web responses

The existing worker completion path already scoped callbacks to task, actor, token,
API origin and session marker; the owner path used an unguarded await. Six baseline
cases reproduced a late confirmation refreshing a retired page/opening its tip UI.
The existing scope and attempt are now shared with owner confirmation. Opening and
submission require current ownership/status/session; late success/failure after
sign-out, silent session/origin change, role loss, dismissal or unmount has no stale
UI effect. Missing API methods fail truthfully. Current success preserves the tip
flow. Dismissal retires UI callbacks; it does not cancel server financial work.
Only the existing CompletionFlow and its existing tip-modal test file change; no
screen, layout, storage, schema or backend contract is added.

106 focused tests across two suites pass. TypeScript passes; scoped lint has zero
errors and six existing any warnings. Chrome uses the real component and API client
with intercepted synthetic responses: sign-out, role loss, leaving, dismissal and
normal success all pass, with one submitted request each and zero page errors.
The four retired cases produce no refresh or tip; the current case refreshes once
and opens the existing tip control. The sign-out case was additionally rerun with
the real clearAuthToken API. The original review layout was visually inspected.
No backend/provider journey or installed native owner-confirmation acceptance is
claimed by these browser cases. Existing accepted native products are preserved.

The first browser harness attempt could not click fixture-only external controls
behind the modal backdrop; corrected fixture controls simulate those external events
without changing product controls. Test DTO casts and a test-only require import
caused initial type/lint failures, now corrected. All attempts remain preserved in
private owner-confirmation-web-* evidence. The temporary page was removed, the three
configuration files restored by hash, the served product retained privately and the
owned port3107 stopped. No native device or backend server was started.

Completion-delivery head1a8a7d549 passes all15 applicable jobs/one Seeder skip in
[CI34947875754](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34947875754).
Home-history dd788e03a and this web checkpoint require their combined current-head
CI. PR34 remains draft. A separate pre-request stale-reviewed-terms concern remains
to reproduce; this callback repair makes no financial authorization claim about it.


## Existing owner confirmation binds the loaded review

The existing confirmation transaction compared the Gig read by the server after a
request arrived. None of the seven current owner callers carried the completion
loaded by the screen. Actual GET, both POST aliases, StripeService and local SQL
reproduced three changed completion-time/proof/price approvals before request:
a$12.50 loaded task captured$20 after its price changed. Baseline35 SQL calls/three
synthetic captures and exact fixture cleanup are retained.

The existing gigPaymentAcceptance helper now computes a non-authorizing digest of
existing assignment/payment/price, full-precision dates, task description/Home and
completion proof. Detail exposes it only to current completion viewers; the private
owner list computes the same digest without adding raw proof to its projection.
Both confirmation aliases compare the loaded digest before provider work or receipt
reuse. Current permission checks, Stripe proof and SQL transaction checks remain.
No new table, migration, service, screen or product file is added. Existing DTOs,
endpoints and all seven current web/iOS/Android owner callers carry their loaded
value. The web review keeps its original through projection changes/retries until
reopened. Actual Chrome also exposed generic error copy for plain API errors; the
existing shared error helper now displays the instruction to reopen and review.
Existing screen layout/classes and native presentation source are preserved.
Updated clients and backend must deploy together: older commands without the loaded
review now reject before capture.

Full backend passes6053 checks/16 skips across339 suites. Final privacy gates pass,
including15 audience checks.107 focused web assertions/types pass; scoped lint has
zero errors/13 existing warnings across its expanded file scope. Android82 tests
across three suites pass with actual DTO serialization and caller checks, compile,
detekt and ktlint. iOS78 tests across the detail/MyTasks suites pass with actual
URLProtocol request-body assertions, build, format and strict lint. These native
checks do not claim installed owner paid-lifecycle UI or real Stripe acceptance.
Existing accepted native products remain retained; the current iOS test host is
separately bound to source and archived. No native UI design change occurs.

Final actual HTTP/SQL acceptance passes three changed-review cases with71 queries:
stale/missing commands return409 with no capture or new confirmation notices; a
fresh explicit review captures once, retry preserves the original confirmation,
and an old review cannot reuse a changed receipt. Private owner-list and detail
digests match; public detail omits proof/digest. Chrome uses the real CompletionFlow,
API client, forwarded HTTP routes, StripeService and SQL (21 queries): two same-review
409s leave capture0/authorized/unconfirmed, then refresh/reopen/current approval
captures once, stores confirmation and opens the existing tip control. Authentication,
business directory, Stripe and tip preview are synthetic. No actual provider send,
hosted adoption or deployment is claimed. All exact aafd/aafe/aaff fixtures are
removed; API18109 and Next3107 are stopped, temporary page/configuration restored,
and browser products/private logs retained outside Git.

Retained attempts include a partial test-edit script stopped by a mismatched helper
name, the first iOS build's file-private test-helper access error (fixed by reusing
existing shared AuthTestSupport), and the final browser's five-second initial-load
timeout. The warmed browser retry allows30 seconds and records page errors; it passes
with zero page errors and the expected server error copy. No app change was made to
address that timeout. Xcode returns the owned simulator to shutdown; unrelated
simulators remain untouched. Private owner-review-* records bind exact source, commands,
results, failed attempts and products. Previous CI34952128109 is a separate checkpoint;
this change needs current-head CI. PR34 remains draft. The digest is neither an access
token nor proof that a person inspected all fields. Post-server-read proof/provider
races, native owner callback lifetime, MyTasks admission, draft/restart and full
installed/provider/release acceptance remain open for subsequent bounded verification.


## Existing MyTasks waits for owner confirmation

Existing native MyTasks called the owner completion endpoint while work was still
in progress, optimistically moved it to Done before a response, and treated worker
completion as owner confirmation. Android reproduced two unique failures (six
executions because the configured runner retried each). Existing web MyGigsV2 also
offered Mark Complete only before the worker was done. These are repairs to the
existing row models, handlers and API projection; no replacement screen is needed.

All three existing lists now keep worker-submitted work active with Ready to confirm,
use their existing confirmation action only for that state, and require a matching
completed receipt with a valid owner-confirmation date. In-progress work opens the
existing detail page. Native optimistic completion copies are removed; the existing
loader refreshes after a receipt. Native failures open existing detail for recovery.
Duplicate pending taps issue one command. Web retains its existing confirmation
dialog and rejects changed-auth callbacks. Card layout, styling and row structure
remain unchanged. Native account/request lifetime is a separate pending check.

Actual Chrome plus existing MyGigs/worker-completion/owner-completion HTTP routes,
StripeService and owned PostgreSQL pass two scenarios: normal confirmation and
a lost committed reply. Each uses37 SQL calls and one synthetic capture. Pending
confirmation has zero captures/no success, a repeat tap sends no second command,
and reload finds the confirmed receipt after a lost reply. The normal run also
verifies unconfirmed work is excluded from Completed and included in In progress.
Authentication, business directory, browser wrapper and Stripe are synthetic.
Native SDK checks do not establish installed native paid-lifecycle UI acceptance.

This browser fixture honors simple SQL column projections literally. It exposed
missing Gig.boosted_at and boost_expires_at fields used by the existing list query.
Original backend migration149 and archived20260516000000 are byte-identical, and
the legacy schema already contains both fields and the index; canonical replay
omitted them. The new20260915040000 forward migration restores those two nullable
fields and the existing partial index with bounded locking. It adds no table and
does not infer historical boost data. Both missing-field and already-adopted
rehearsals preserve the complete existing task values, including full-precision
boost dates, across repeated application. Exact ab02 fixtures roll back. Earlier
owner-review SQL adapters used SELECT* and did not verify the literal list column
projection; their other recorded route/payment checks retain their stated scope.

Local verification passes45 Android MyTasks checks plus compile/detekt/ktlint,
15 backend list/payment checks and all privacy gates (including15 audience checks),
all65 SQL contracts, the generated paid pgTAP wrapper, migration policy and wrapper
synchronization. Web project types pass; this existing page retains its pre-existing
ts-nocheck limitation. Its lint has zero errors/three existing warnings. iOS passes43
checks across MyTasks and unchanged Magic Task suites, build, format and strict lint.
All679 installed test-host files match the retained build; the owned simulator
returns to shutdown, and the unrelated booted simulator remains untouched.

Retained attempts include Android formatting failures R1–R3 and a complex-condition
static failure R4, corrected without weakening rules; iOS test-file length was
repaired by replacing its obsolete header comments. The first browser attempt
failed on the missing original boost fields. Final normal browser R4 and lost-reply
R3 pass with zero page errors, and screenshots preserve the existing layout.
Exact ab01 actors/tasks/payments/notices are cleaned after every fixture. API18109
and Next3107 are stopped; the private page is removed, configuration hashes restored,
and served browser products retained. No hosted schema or actual provider operation
is part of this scope. Private my-tasks-completion-* source/run/product records
retain failures and verification limits. Current-head CI remains required and
PR34 remains draft; no wider inventory row is closed by these bounded checks.


## Existing native owner confirmation retires stale callbacks

The existing detail handlers accepted empty success responses; Android emitted
completion success and refetched, while iOS returned nil and the existing view
treated nil as success. Both could refetch after a session changed. Android also
sent two commands for a repeated pending tap. Corrected baseline fixtures reproduce
three unique Android failures (nine failed executions with configured retries) and
two iOS failures with three failed assertions. Android's first fixture missed the
existing tip-preview dependency; it is retained as a fixture failure, not product
evidence. The corrected baseline uses a consistent owner identity.

Five existing native files extend the existing completion attempt/generation/job,
identity markers, read scope and departure wiring. Owner admission requires the
loaded review and current owner context; pending repeats send one command. A
matching completed receipt with a valid owner-confirmation date is required before
success/refetch. Late session/departure responses retire silently. iOS returns
confirmed/failed/ignored and the existing view displays success only for confirmed;
its previous nil-success convention remains unchanged for unrelated actions.
No new schema, service, screen or visual layout is introduced. Retirement suppresses
client callbacks; it does not cancel a financial operation already admitted by
the server. Existing server receipt/recovery requirements remain separate.

All42 selected Android detail tests pass with compilation, detekt and ktlint,
including the existing worker proof regressions and the normal confirmed receipt.
All50 iOS detail tests pass with build, SwiftFormat and strict SwiftLint, including
normal confirmation/tip refresh, incomplete receipt, late session, departure and
duplicate command checks. All679 installed iOS test-host files match the retained
build, and the owned simulator returns to shutdown. These use mocked repositories
or URLProtocol responses; they are not installed full owner paid-lifecycle UI or
actual provider acceptance. Backend/web/schema acceptance is reused where source
is unchanged; no broad suite is repeated solely for these native handler changes.

Android's first candidate failed line-length formatting; iOS's first lint failed
two trailing-closure checks. Minimal corrections preserve the original rules.
Private native-owner-confirmation-* evidence retains baseline attempts, source
and product hashes, commands and final results. The five application/test files
already existed. The unrelated simulator and owner checkout remain untouched.
The preceding loaded-review/MyTasks checkpoint48df046f6 passes all15 applicable
jobs/one Seeder skip in CI34957710591. Native checkpoint `c12c55e099` now passes
all15 applicable jobs/one Seeder skip in [CI34960015092](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34960015092).
PR34 stays draft. Native MyTasks account/request lifetime remains a separate pending check.

## Existing owner capture interleaving baseline

While native validation ran, the existing HTTP/StripeService/SQL fixture reproduced
four post-server-read races (50 SQL calls/four synthetic captures). Completion
proof changes during provider retrieval, after capture preparation, and at the
synthetic capture call each return200 and confirm different proof. A completion-time
change during provider retrieval returns409 only after the payment is captured,
leaving the task unconfirmed. Both confirmation aliases are exercised. Auth,
business directory and Stripe are synthetic; routes/services and owned PostgreSQL
are actual. Exact ab03 cleanup passes and API18109 is stopped.

This records the failing baseline; the locally verified repair follows below.
At this baseline, capture preparation locks/checks financial terms but does not bind the reviewed proof;
final confirmation checks only the earlier assignment fields. Existing stop/expiry
guards cover their own requests. The existing capture retry job also only selects
already-confirmed tasks, missing newly ambiguous captures before confirmation.
Compare and extend the existing Payment metadata, capture functions and retry job
before proposing new persistence. Preserve the separate booking-payment caller.
Private owner-capture-interleaving-* baseline and reuse records retain the exact
commands/results. The following section records the subsequent source change and its limits.


## Existing owner capture original and recovery

The existing route checked loaded review before a provider await, but capture
preparation and final confirmation did not bind all the reviewed proof. The four
actual baseline races above could confirm changed work or reject only after capture.
The existing retry job also missed unconfirmed originals after a process failure.
Current/archive/history comparison found no private original-approval field.
Payment.metadata is part of existing involved-user API and direct SQL reads, so it
cannot safely hold private approving-manager identity and original feedback.

The forward `20260915050000_gig_completion_original.sql` extends the existing Payment
with one nullable private JSONB field, preserving every old column grant and all
historical rows. Its original contains actor, review/snapshot hashes and feedback;
it does not duplicate raw worker proof. Existing APIs omit this field. No table,
service, screen or layout is replaced. Existing reviewed Gig fields, capture
preparation/receipt, confirmation counter/notices/Home history and retry job remain
the implementation. Free completion and historical already-confirmed capture remain
supported; the separate booking branch is unchanged.

Current locked authority admits one full reviewed snapshot before external work.
Pending approval prevents edits/deletion of its work/payment identity, retains the
first actor/note/rating and leases capture preparation. Stable provider identity and
idempotency key remain unchanged. A fresh matching charge is required. Capture and
confirmation effects commit in one transaction; a lost provider/local response is
recovered by the existing job with the same original. Later revocation cannot undo
an admitted financial operation; HTTP access still requires current permission and
Home history uses current Home authority. A fresh canceled provider intent plus
zero captured-charge proof can release pending edits without confirming completion.
Existing content edits resume after a terminal original.

Validation uses the owned PostgreSQL17.6 database on64522 only:

- 296 focused backend checks pass. Full backend passes6081 tests/16 existing skips
 across339 suites, exit0; all154 final route checks pass, including two additions for revoked-reader
 suppression and safe unknown-provider errors. These unit boundaries use synthetic
 repositories/provider replies; they do not replace SQL acceptance.
- All65 SQL contracts and generated paid pgTAP pass, including original/feedback
 immutability, complete proof/microsecond binding, current admission versus revoked
 recovery, one counter/notice, delete fences, canceled-zero release and direct
 private-column denial while every old column remains readable. Privacy gates pass.
- Ten actual Gig HTTP/StripeService/retry-worker/SQL cases pass, with131 recorded SQL
 calls before two cleanup queries and eight synthetic captures. Four interleaved
 mutations are blocked; a pre-admission edit gets409/capture0. Lost capture/commit
 responses recover one original, one counter and one notice. A held concurrent tap
 gets409 while the admitted command finishes. Canceled zero-charge work stays
 unconfirmed and becomes editable. Auth/business directory and provider are synthetic.
- Seven separate-connection lock waits are observed: edit/admission both orders,
 revocation/admission both orders, duplicate original, duplicate capture lease and
 duplicate capture receipt. A forced failure after capture effects rolls back status,
 original completion, counter and notices. Exact ab04/ab06 fixtures are cleaned and
 every owned connection/API18109 closes.
- A transaction rehearses the prior schema/functions and the complete new migration
 with four old authorized/canceled/captured/refunded rows. All Payment and Gig fields
 survive exactly; zero historical approvals are manufactured. It rolls back with
 exact ab07 cleanup. Function lint checks381 functions/116 attached bindings with
 zero errors/eight existing warnings. Migration policy and wrapper synchronization
 pass; complete fresh schema replay remains required in this checkpoint's CI.

Preserved failed attempts: focusedR1/R2 used old post-capture RPC fixtures; R3's two
privacy cases inherited a previous unavailable-projection spy, fixed with existing
reset hooks. HTTPR1 exposed an unknown provider error returned as500; the existing
route now returns a safe retryable503, and R2 passes. SQLcontractR2 used an invalid
fixture account type; R3 uses the existing individual type. Forward-replayR1 used a
nonexistent canceled_at fixture field; R2 preserves existing fields successfully.
The first lint identified two unused variables; removing those declarations restores
the previous eight warnings. Failed evidence is retained rather than relabeled.

Private owner-original-* files retain commands, failures, source bindings and final
results in the existing evidence root and durable mirror. Screens/client source did
not change; accepted native/browser design evidence is reused. No hosted migration,
deployment or real provider operation ran. Cutover must drain old capture handlers
and activate all original-aware backend readers before admitting new originals.
Do not roll back to raw old serializers while private originals exist. Exhausted
capture caps, provider disputes/refunds, operator resolution, hosted adoption and the
full installed owner lifecycle remain wider acceptance gates; PR34 remains draft.
Native MyTasks lifetime and completion draft/restart are the next bounded checks.

## Existing MyTasks refresh order and canceled confirmation

After0654e856e, inspection of the existing MyTasks callers found Android's
confirmed-receipt path calling `load()`, which returns when the current tab is
already populated. The earlier happy-path test left an empty Open tab selected;
selecting the actual Active tab reproduced the stale row after success. A held
older Android refresh also replaced a newer accepted list. Baseline R1 records
two distinct failures (six failed executions with the configured retries).
An iOS baseline using the existing APIClient/SequencedURLProtocol and compiled
view model reproduced navigation after the confirmation Task was canceled.
These are bounded model reproductions, not installed screen-departure acceptance.

Four existing native source/test files change. Android calls the existing refresh
after a matching receipt. Both loaders use a request generation to retire earlier
responses; iOS also checks cancellation before applying reads or confirmation
callbacks. No screen, layout, table, migration, endpoint or identity service is
added. iOS test comments/formatting were shortened to retain the existing500-line
limit; lint rules were not weakened.

The final Android run passes46 tests, compile, detekt and ktlint. The final iOS
build and45 tests (37 MyTasks plus8 unchanged Magic Task checks) pass with
SwiftFormat and strict SwiftLint. The iOS regression also keeps the last accepted
list when a newer refresh fails and an older response arrives later. Source hashes,
baseline/final logs, Android XML and iOS result bundles are retained under
`existing-tip-provider-proof-r1/my-tasks-lifetime-*` in the private evidence root
and durable mirror. Repository/HTTP responses in these tests are synthetic; this
does not repeat or replace actual local HTTP/SQL acceptance of unchanged backend
code. No full installed paid lifecycle or actual provider claim is made.

The owned simulator81989235 is shut down and the separate user simulator is
preserved. Account changes, real view departure, optimistic boost rollback ordering
and the adjacent rebook rail remain separate verification work.0654e856e passes
all15 applicable jobs/one Seeder skip in
[CI34964238115](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34964238115),
including complete schema replay and native checks. The refresh follow-up is
committed locally at f32c8e66b while the account/screen checks finish. PR34 remains
draft and no broader inventory row is closed.

## Existing native MyTasks account and view lifetime

The existing main-list models did not bind their loaded state and callbacks to
the current session or view lifetime. iOS baseline tests use the actual AuthManager,
APIClient and compiled model with synthetic HTTP responses: sign-out leaves the
old row/count/banner visible, and a held503 confirmation navigates after the same
actor receives a replacement session. Two tests record four failed assertions.
Android's held confirmation invokes newly rebound navigation callbacks; its
baseline records one distinct failure across three configured retry executions.
Existing root sign-out navigation does not make these retained model callbacks safe.

The repair uses GigStopViewModel.currentIdentity on iOS and GigPaymentIdentitySource
on Android. Existing model/view files clear or mask retired state, retire row and
empty-state actions, and reject late reads/confirmation/boost callbacks. Rebinding
starts a new view generation without letting the previous command clear its state.
Android observes the existing identity signal and reloads the current account;
iOS keeps the original session boundary and permits a fresh list entry. All three
iOS callers append their existing destinations directly, removing22 redundant
Task hops after the guard. No routes or visual treatment are redesigned.

Android R3 passes52 tests (46 existing main-list checks plus6 focused lifetime
checks), detekt, ktlint and compilation. The final response-order check holds the
session lookup itself while a newer list finishes, verifying the generation is
checked after that await. R2 passed51 checks before this additional ordering guard.
R1 stopped at the unchanged LargeClass rule; the new lifetime cases were moved to
one focused Android test file, preserving the rule and existing test suite.
Ten other native files already existed. No application screen/service, endpoint,
table, migration or new identity subsystem is added.

iOS R2 passes50 tests (37 existing main-list checks and13 Magic Task/lifetime checks),
build, strict SwiftLint and SwiftFormat. The existing row designs remain covered by
the unchanged8 Magic Task projections. Tests cover sign-out, replacement-session
read and confirmation responses, same-session departure/reentry, old row actions,
and a fresh entry that loads the replacement session. R1 compiled successfully;
two new reentry cases exhausted their one-response GET fixtures. Supplying the
second expected response fixed those fixtures; the same product source passes R2.
The initial static failures and corrected zero-violation run remain recorded.

Source hashes, both baseline/final runs, Android XML, iOS result bundles and cleanup
are retained under `existing-tip-provider-proof-r1/my-tasks-account-*` and its
durable mirror. The owned iOS simulator is shut down and the separate user simulator
is preserved. These checks use synthetic transport/repositories; no installed full
owner/account-switch journey, actual provider or hosted operation is claimed.
The main-list acceptance does not cover the adjacent rebook rail's separate reader,
optimistic boost rollback ordering or completion draft/restart. Those are next.
0654e856e's complete CI remains green; the combined native checkpoint needs its own
CI. PR34 stays draft and the wider inventory remains open.

## Existing native rebooking history and boost refresh

The Android baseline reproduces an older rebook response replacing newer history
and a failed boost restoring an obsolete whole list after a successful refresh:
two distinct failures across six configured retry executions. iOS reproduces
retained history after actual AuthManager sign-out, a held read repopulating a
replacement session, and the same boost rollback defect (three tests/five failed
assertions). HTTP/repository responses are synthetic. The existing iOS test
transport gains an optional response gate so a newer GET can finish while the
boost POST is held; its existing ungated behavior/default initializer are preserved.

The existing rebook models reuse the current native identity helpers and retire
state/actions on session change and view departure. Read generations reject older
responses, including after an awaited Android identity lookup. Reentry reloads;
identical Android history still publishes the new view generation so current cards
work and retained old actions stay silent. iOS requires a fresh entry after a new
session. Existing card styles and navigation destinations are unchanged.

Both boost handlers remove the whole-list optimistic rollback and refresh through
their existing loader after success. The current cards did not display those
optimistic fields. A failure therefore leaves the latest accepted list intact,
and successful-boost tests require the server's refreshed title and a second read.
All nine changed application/test files already existed. No new screen, endpoint,
table, migration or identity service is added.

Final Android R2 passes57 tests (46 main-list/11 lifetime), detekt, ktlint and
compilation. iOS R1 passes55 tests (37 main-list/8 Magic Task/10 lifetime), build,
SwiftFormat and strict SwiftLint. Two test classes share the existing Magic Task
test file to preserve the300-line class limit. Android R1 stopped at an unchanged
condition-complexity rule; splitting that condition retains its post-await checks.
The first iOS baseline build exposed a test-helper initializer compatibility issue;
the defaulted initializer fixed it before the successful R2 baseline build and
expected failing R2 tests. Failed runs remain preserved, not relabeled as passing.

Source hashes, baseline/final logs, Android XML, iOS result bundles and exact device
cleanup are retained under `existing-tip-provider-proof-r1/my-tasks-rebook-boost-*`
and its durable private mirror. The owned iOS simulator is shut down; the separate
user simulator remains untouched. These compiled-model/APIClient checks do not
establish installed rebooking/boost account-switch UI or actual provider acceptance.
No database, hosted or provider operation ran in this scope. The preceding
a943a0dab checkpoint passes all15 applicable jobs/one Seeder skip in
[CI34969633236](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34969633236).
This follow-up needs its own CI. PR34 and the wider inventory remain unfinished.
