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
Home remains the unit registry. No new screen, tracked file, table, migration or
SQL function signature is introduced; the existing unmerged Home-create commit
function gains the selected-parent check.

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
