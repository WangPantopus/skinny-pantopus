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
pass afterward, with TypeScript clean and scoped lint retaining one existing
`any` warning. Browser preparation used installed Chrome after the Playwright
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
