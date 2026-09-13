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
already completed restoration. Final-head CI and integration are next.

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
