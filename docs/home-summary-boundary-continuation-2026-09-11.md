# Home summary and preference workflows — September 11, 2026

Continuation of dashboard `d681da444`. This report supersedes its earlier WIP
notes. PR #32 remains an unfinished draft; this is a bounded Home milestone,
not complete Home, native, provider, financial-comparison or launch acceptance.

## Result and actual workflow evidence

The browser keeps failed summary reads distinct from confirmed empty data, gives
separate Retry controls, and retires reads/actions on Home/account/lifecycle
changes. Health requires every contributing read permission; bills require
finance.view and the audit timeline requires members.manage. Current permissions
also gate checklist changes, sharing, create/invite controls and the member audit
entry. Existing owner pointers do not override denied controls.

Checklist updates now bind the URL Home, exact item and current actor in one
locked SQL transaction with the audit. An identical current status preserves
completion identity; different terminal states conflict and hired/gig-linked
items are protected. Failed context/current/carryover/history/generation reads
remain unavailable. This is not a durable original-intent receipt or a completed
checklist-to-gig workflow.

Real SQL exposed an additional production schema mismatch: HomePreference is a
fixed-column, one-row-per-Home table, but settings, bill trends and the benchmark
job expected nonexistent key/value columns. The additive settings JSON object
preserves the fixed preferences. Validated Home fields, typed notifications,
bill sharing and a minimal audit now commit together after lock-wait authority
checks. No preexisting Home is silently opted in. Unknown save results require
reading current state before another change. Current checklist/sharing UI busy
states prevent duplicate taps; sharing remains available when there are no bills.
The job now reads the real preference column; benchmark correctness remains the
explicit next milestone below.

Actual acceptance:

- Chrome → production HTTP/Joi/helper/services → owned PostgreSQL, summary r1:
  four PATCH requests, zero page errors. Five unavailable/retry states, current
  and empty results, persisted sharing, lost committed opt-out/completion,
  skip/busy state, malformed success, held response/background retirement,
  effective read/action restrictions and narrow/keyboard recovery passed.
  Eight screens were visually reviewed. This found a desktop floating-button
  overlap over the sharing switch; the final layout reserves its action space,
  fills limited-reader grids and uses neutral empty-state copy. R2 passed with an actual pointer click as well as keyboard sharing. Its visual
  review then corrected the switch’s missing active color; final r3 verifies
  distinct on/off colors and repeats the complete sequence: PASS, four PATCHes,
  zero page errors. Final active desktop and narrow/off screens were reviewed.
- Production HTTP/SQL final r5 passes current health/read and transport errors,
  finance denial before private queries; exact Home checklist binding, invalid
  state, current recovery, repeat identity and revocation; audit authority/read
  failures; source error versus absent property; bill preference errors and lost
  saves; atomic settings and preserved unrelated typed notifications; first
  checklist generation and repeat identity; mixed insufficient/displayable
  benchmark cohorts and benchmark-query failures. Property-provider responses,
  auth and notifications are synthetic; no paid provider calls.
- Eight observed checklist lock-wait races pass (r2); seven settings lock-wait
  races pass (r1), including expiry while the preference row itself is locked.
  Audit failures roll back data. Exact SQL/HTTP/browser fixtures are cleaned.
- Full dashboard regression r1 passes current authority, pending residency,
  fallback, stale read/lifecycle and narrow keyboard states. Full residency r1
  passes eight POSTs/four receipts/zero page errors after the summary changes.
  The final dashboard layout-only change follows those two runs; the summary
  pointer/narrow rerun covers that layout.

Private artifacts remain outside Git and chat. Paths share `/private/tmp/`:
`pantopus-web-summary-r1/`, `pantopus-web-summary-r2/` and
`pantopus-web-summary-r3/` (screens/results),
`pantopus-home-summary-http-r5.log`, `pantopus-home-summary-concurrency-r2.log`,
`pantopus-home-settings-concurrency-r1.log`,
`pantopus-web-dashboard-summary-r1/`, `pantopus-web-residency-summary-r1/`.
Executable evidence is in `scripts/web/test-home-summary-flows.cjs`, the existing
browser regression drivers, `scripts/db/test-home-summary-http.cjs`,
`test-home-summary-concurrency.py` (optional `settings` mode), and both new SQL
contracts/pgTAP wrappers.

## Migrations and verification

New ordered migrations:

- `20260911003000_home_summary_boundaries.sql`: seasonal-table privilege fence
  and service-only exact checklist transaction; requires existing record locks.
- `20260911010000_home_settings_preferences.sql`: preserved fixed preferences,
  additive typed settings, ordinary-client privilege fence and service-only
  atomic Home settings/preference/audit transaction, using the same record locks.

Source is **37 Home / 46 combined with paid**. The current 21-version paid
source union has no duplicate versions or shared-file content conflicts; that
static check does not replace dependency reconciliation or combined replay. New migrations are applied only to
owned local SQL. The working Gig ledger remains earlier manually applied history;
final pinned fresh replay independently verifies all 37 ledger versions. PR #34
still needs combined dependency resolution/replay and has merge conflicts. Apply
these migrations before the changed API/job code; no hosted adoption was done.

Pinned Supabase **2.116.0** fresh summary replay passed 36 versions, all 41 pgTAP
contracts, function lint and six SDK/PostgREST cases. The final independent
settings replay passed **37 versions, all 42 pgTAP contracts, function lint and
six SDK/PostgREST cases**. Final lint reports 220 application functions/84 trigger
bindings, six previously reviewed stock PostGIS findings and 40 warnings. All 42
standalone real SQL contracts pass on the owned Gig database too. Both fresh
projects are stopped with backups, not reset or deleted.

Two separately retained populated predecessor copies passed exact existing-row
hash/count preservation: summary **15,119 rows/365 tables**, settings **15,120
rows/365 tables**, covering public/auth/storage. The settings comparison excludes
only the newly added JSON property, separately verifies every new settings object
is empty, and preserves fixed visibility/social/quiet-hours/radius data. Fixtures
also retain historical completed/skipped/hired/gig links, old timestamps, revoked
memberships, denies and audits. Predecessors were reconstructed only in the new
copies; source/owner databases and archives were not rewritten. Dedicated
`home_summary_upgrade_contract` / `home_settings_upgrade_contract` copies remain.

Final local gates: TypeScript r8 passes; web r2 92 suites/1,178 cases passes;
whole-web lint r3 has zero errors/1,160 warnings; backend r2 317 suites/5,169 cases
passes with one suite/16 preexisting skips; privacy r1 passes; migration policy,
wrapper parity and whitespace pass. The legacy dashboard file still has @ts-nocheck; the actual browser runs are
material evidence for that page. No new native build/device acceptance is
claimed here. Private logs use `pantopus-home-summary-` or
`pantopus-home-settings-` prefixes with the corresponding gate/revision suffix.

Initial limitations are retained: checklist race r1 had a fixture-key collision
in case eight, then exact cleanup/key correction/full r2 passed. HTTP r2/r3 found
the actual missing preference columns; r4 passed after the additive schema/RPC
repair and r5 added actual first-generation/typed-settings/cohort acceptance.
An initial `typecheck` command selected no package script; the actual `type-check`
command passed. An intermediate whitespace check found one trailing blank and
was corrected. Browser r1 passed assertions but its screenshots found the sharing
switch overlap; the corrected pointer/visual rerun is recorded separately.

## Remaining findings and next action

1. **Bill comparison currency, aggregation and withdrawal.** HomeBill.amount is
   entered/displayed as major currency units by web/iOS, while the job averages
   it directly into `_cents`; Place divides both benchmark and own amounts by
   100. `home.js` trend series uses raw values, duplicate monthly points and
   unordered/index-aligned benchmark arrays. Inventory all writers/readers,
   currencies and historical derived rows, establish explicit units, monthly
   household aggregation and matching periods, and safely version/rebuild derived
   values. Do not rewrite source bills or guess units from numerical magnitude.
   The job also leaves old cohorts when opt-outs/deletions/no qualifying data
   shrink them and only deletes by age. Resolve stale contribution/count removal,
   read errors, freshness, threshold behavior and multi-run consistency together.
   No paid provider or live financial action is part of this repair.
2. **Native summary and residency parity.** Install/verify iOS/Android limited
   summary/error/loading/retry and preferences against the revised contract;
   prepared residency decisions and protected original/receipt recovery remain.
   General HomeSettingsTab still falls back after failed reads, performs a
   separate Home update before settings and has no original-intent receipt.
   Notification delivery behavior is not established by saving its preferences.
3. **Other Home boundaries.** Issue/package endpoint write permissions and full
   dashboard entity unavailable-vs-empty states still need actual workflow review;
   this milestone only gates their overview entry controls. Sidebar/deep-link and
   every individual entity panel are not accepted here. Generic Post Home Task/
   Gig follows its separate Gig policy; no new permission was invented for it.
   Checklist gig-link flow, stronger nested malformed-response validation,
   timeline pagination/labels, full settings privacy/CAS/clear-field behavior,
   current server invalidation without a lifecycle event, physical devices,
   dark/zoom/accessibility breadth and production UI builds remain explicit gaps.
4. Resume transactionally recoverable residency submission/cold-start/resubmission,
   ownership transfer/challenge, lease/resources, then every Home/Pulse/Beacon,
   account/vendor/platform and upgrade/release item in PROJECT_HANDOFF. No earlier
   unresolved item is removed by this milestone. All paid services remain one
   final launch-preparation bundle.

Remote state was refreshed after origin fetch: `d681da444` now passes all required
CI including CI OK; #32 stays draft because its scope is incomplete. #34 remains
draft `e9ef2decb`, prior CI green but conflicted/unfinished. #7/#24 are merged.
Verify the next pushed exact head independently. Owner checkout/files/emulators
remain untouched; Docker engine and the owned web/Gig DB stay available.
