# Bill comparison continuation — September 11, 2026

Work after pushed Home summary/settings milestone `a6d879664`. PR #32 remains
draft; full cross-client financial acceptance remains unfinished. No provider or paid
service activation, source-bill rewrite or hosted database action is authorized
by this report. Existing user authorization governs the continuing local work.

## Current SQL and browser calculation milestone

Work after `a74102c92` replaces the ambiguous derived cache with indexed,
read-only SQL snapshots. All source bills and historical BillBenchmark rows
remain unchanged. The old scheduled writer is retired, with a harmless operator
compatibility entry. No legacy unit conversion or derived-row rebuild is needed
for these new readers. Opt-outs, deletions, corrected paid status and location
changes affect the next statement snapshot; an already-started response is not
retroactively revoked. Browser lifecycle/access retirement remains essential.

Migration `20260911020000_current_home_bill_comparisons.sql` requires current
Home authority and finance permission for personal values, and returns one
currency in decimal major units. Paid positive bills are summed per household,
bill type and period-start month within the current/preceding 23 months, through
CURRENT_DATE. Each household has one weight. Three through nine households
return no aggregate amounts; ten or more can return averages/medians. Geometry
is authoritative, with valid map-center fallback, including actual zero values.

Home trends expose chronological unique month keys and a currency selector.
Place's USD comparison averages only matching personal/peer months, reports the
actual period, and preserves fractional major units. The legacy peer helper
retains its explicit USD-cents output by converting the canonical aggregate;
its display floor cannot be lowered and a latest insufficient cohort cannot be
replaced by an older qualifying cohort. Every source failure remains an error.
The server and browser reject malformed financial shapes and wrong currencies.

Browser bars align by month key; the visible recorded average and expandable
monthly table expose amounts without requiring hover. Sharing remains usable
with no personal history, disables during saving, and reloads current results.
Explicit loading/error/empty states, keyboard controls, readable month/year
labels and horizontal chart scrolling remain. Place overview/detail browser and
native presentation acceptance are still separate, unfinished work.

### Executed evidence

- Production Home/Place HTTP -> service -> local SQL r2 passes fractional
  household/month totals, USD/CAD separation, chronological periods, invalid
  currency, matching-month comparisons, geometry/absence/zero fallback,
  returned/transport failures, settings opt-out/restore and current authority.
  Driver: `scripts/db/test-home-bill-comparison-http.cjs`.
- Adapted summary and Place boundary HTTP regressions pass, including actual
  settings, first checklist generation, lost replies, current access/errors and
  retained-but-ignored old cache rows. The old cache fixture is never used as a
  production fallback. Both complete exact fixture cleanup.
- Final actual Chrome r3 passes two settings PATCHes, no page errors, fractional and
  unmatched months, held CAD switching, pointer opt-out/keyboard restore,
  source/malformed recovery, held lifecycle retirement, finance denial/restore,
  confirmed empty and 24 real SQL months on a 390px viewport. Initial r1 passed
  assertions but visual review found hover-only amounts; r2 adds visible average
  and the monthly table. r2 CAD and narrow table screenshots were reviewed.
  Final r3 also passes wrong-currency, malformed/empty nested arrays and low-cohort
  rejection, followed by the complete remaining financial journey and exact cleanup.
- The extended SQL contract passes 10/9/3/2/zero cohorts, contribution deletion
  and exact restoration, status/location corrections, repeats, currency/date
  exclusions, privileges and unchanged source rows. Local r2 overlapped another
  fixture in the same synthetic cell and saw 20 households; isolated r3 passes.
  This was fixture interference, not a production aggregation failure.
- Three observed overlapping/cancelled SQL reads pass. A paused statement returns
  a coherent original snapshot after an atomic opt-out/amount correction commits;
  the next read sees the changed values. Revocation affects subsequent reads;
  restoration works. Cancelled reads and the retired job change no bills.
  Driver: `scripts/db/test-home-bill-comparison-snapshots.cjs`.
- Pinned CLI 2.116.0 fresh replay passes **38 migrations / 43 pgTAP contracts**.
  Function lint passes 221 application functions / 84 trigger bindings, the six
  previously reviewed stock PostGIS diagnostics and 42 warnings. Two new warnings
  are text-literal-to-JSONB initializer coercions. The first scan overlapped
  pgTAP and saw its temporary extension routines; a sequential scan after their
  automatic rollback passes. No diagnostic whitelist was broadened.
- All six real SDK/PostgREST cases pass on the new fresh project. The first
  invocation supplied a path instead of the required project name and ran zero
  cases; corrected r2 executes all six. Never infer a pass from exit status alone.
- Populated upgrade preserves **15,167 copied rows across 365 public/Auth/storage
  tables**, including source bills, opt-ins and ambiguous historical cache rows.
  The copy captured owned synthetic snapshot fixtures as well as the existing
  rehearsal records; this is preservation of that copy, not a production count.
  New functions/indexes require no row rewrites. The exact upgrade-only fixtures
  are removed and the dedicated database is retained.
- A synthetic plan with 1,000 Homes / 24,000 bills uses the cell index and an
  existing HomeBill index to read the ten-Home cohort. Observed execution was
  0.992 ms. The transaction rolled back. This is an indexed-query observation,
  not launch capacity certification or a hosted latency promise.
- All 317 backend suites / 5,169 cases and privacy gates pass (one existing suite /
  16 cases skipped). All 92 web suites / 1,178 cases, types and whole-web lint pass;
  lint retains 1,160 existing warnings. The 48 affected Place cases now consume
  canonical SQL DTOs. Initial fixture editing used the wrong working directory
  and failed before writes; corrected changes pass. Migration policy, generated
  wrappers and whitespace checks pass. All 43 contracts also pass on the owned
  populated development database after browser fixtures are cleaned.
- The complete existing browser summary recovery journey passes against the new
  RPC (four PATCHes, zero page errors). No new installed native/provider proof is
  claimed for these financial changes.

Private evidence lives outside Git under `/private/tmp/pantopus-home-bill-comparison-*`,
`/private/tmp/pantopus-web-bill-comparison-r{1,2,3}/`,
`/private/tmp/pantopus-home-summary-live-bills-http-r1.log`,
`/private/tmp/pantopus-place-live-bills-http-r1.log` and
`/private/tmp/pantopus-web-summary-live-bills-r1/`. Source drivers are committed;
raw operator logs, credentials and database archives are not.

### Remaining financial/release gates

1. Reconcile iOS/Android bill DTOs/presentation: both still assume first month is
   newest and divide peer values by 100; their shared money format rounds away
   cents. Add actual installed amount/month/currency/error/recovery acceptance.
2. Verify/fix Place overview and money-detail fractional formatting, displayed
   comparison periods, unavailable/source-error/current-access retirement in all
   three clients. The HTTP values are verified; presentation is not certified.
3. Reconcile old-client/backend version behavior before release. Migration
   compatibility preserves data; it does not make the changed amount/order
   contract compatible with old native clients. Deploy migrations before readers,
   stop the old worker schedule with the reviewed worker release, and bind the
   final web/native/API versions or provide an explicit compatibility contract.
4. Broader bill create/edit/delete/splits, malformed input/currency, refunds,
   household contributor eligibility and scale/retention review remain alongside
   the general financial/permission backlog. No zero-bug or whole-app completion
   claim follows from this milestone.

Source union is **38 Home / 21 paid / 47 combined migrations**, no timestamp or
shared-file-content collisions. Combined dependencies/replay remain unfinished.
The preceding `a74102c92` now passes all required CI; every new pushed head needs
its own checks. PR #32 remains an unfinished draft. #34 is still draft
`e9ef2decb`, green but conflicted and unfinished. No merge/deployment/provider
activation is implied. Paid services remain one final launch bundle.

## Current bounded permission/error repair

Source tracing found Place intelligence used membership without requiring
home.view, and its Band-A bill composer read individual HomeBill values without
finance.view. The repair requires current home.view at the route and only reads
personal bills with finance.view; public peer aggregates still render without a
personal value/comparison. Returned database errors now remain section errors.
The shared coordinate helper no longer turns absent/null/empty coordinates into
0,0, and validates latitude/longitude ranges while allowing an actual zero.

Actual production Place route/helper/composer/serializer → owned PostgreSQL r3
passes own-finance denial before querying HomeBill, no personal value in the
peer-only response, own/peer read errors without comparison data, absent versus
actual zero coordinates and whole-Home denial before financial queries. Exact
fixtures were cleaned. Provider dependencies were disabled and only
`sections=bill_benchmark` was requested; no provider or notification calls ran.
Evidence driver: `scripts/db/test-place-bill-boundaries-http.cjs`, with optional
`place` fixture mode. Private log: `/private/tmp/pantopus-place-bill-boundaries-http-r3.log`.

The first HTTP adapter rejected the legitimate `address2` column identifier; its
identifier whitelist was corrected, r2 passed and r3 added absent-coordinate
acceptance. Two old in-memory verified-member cases lacked a home.view grant;
they now seed that actual permission and all 25 Place cases pass. The earlier
wrong-working-directory edit command failed before changing files and was rerun
in the actual worktree. Full backend r1 passes 317 suites/5,169 cases (one suite/16 existing skips);
privacy r1 passes. Both final logs use the private
`pantopus-place-bill-boundaries-` prefix. Whitespace/source syntax checks pass.
No new browser/native acceptance of this Place change is claimed yet.

## Findings that motivated the current calculation (historical)

- HomeBill.amount is numeric(12,2), entered as a major-unit decimal by web,
  iOS and the HTTP create route. The source row has a currency (USD default).
  Do not divide source bills or guess historical units from amount size.
- `backend/jobs/billBenchmarkRefresh.js` puts raw amounts from every currency
  into `_cents` columns, rounds away fractional major units, averages individual
  bills rather than household totals, and counts distinct homes separately.
  Two bills from one household therefore skew its weight. The job now reads
  `HomePreference.settings` correctly after the preceding milestone.
- Home trend reads return raw benchmark values and raw source amounts, mix
  currencies, retain duplicate month points, read only 200 bills without the
  documented 24-month condition, and pair benchmark bars by array position.
  Month labels use local time for an ISO month, shifting them in negative zones.
- Place divides benchmark and personal raw amounts by 100, reads every source
  bill regardless of paid/currency/period and labels the result monthly. Peer
  selection mixes periods and reports an unsupported 12-month average.
- `services/place/billBenchmarkReader.js` returns nominal cents, permits a caller
  to lower the displayMin floor, silently maps errors to unavailable, and uses
  an old qualifying month if the latest month is insufficient, without freshness.
- The job upserts qualified rows but leaves old rows after opt-outs, deletions,
  unpaid corrections, moving Home coordinates or a cohort falling below the
  threshold; its only cleanup is by age. An all-opted-out run returns before
  cleanup. Shared/derived results need consistent invalidation and rebuilding.
- All writers/readers, currencies, minimum cohort and common comparison periods
  must be reconciled before enabling useful comparisons. Keep old source bills
  and historical derived rows intact while introducing a versioned, auditable
  recalculation; never silently multiply old derived values.

The current SQL milestone above reconciles these producer/consumer findings.
Continue the explicit remaining financial/release gates, preserving this history. Validate multiple bills per Home/month, multiple
currencies, fractional amounts, 3/9/10 homes, mismatched/month-boundary dates,
missing/invalid coordinates, source-read errors, zero opted-in homes, repeated
refresh, opt-out/delete/status/location changes, interrupted rebuilds and actual
web/native display. Physical/provider/production-upgrade acceptance is separate.

## Other newly traced limits retained

HomePrivacyService still falls back to permissive default address_precision after
read failure. Review that distinct privacy surface before claiming complete Place
privacy. General HomeSettingsTab fallback/partial writes, individual issue/package
writes, nested malformed-summary validation, timeline pagination/labels and the
full Home/Pulse/Beacon/account/vendor/release backlog remain in the preceding
summary report and PROJECT_HANDOFF. Native summary/residency parity follows these
confirmed summary/financial findings; all paid services stay one final bundle.

Historical a74102c92 scope had no migration (37 Home / 46 combined). The
new current-calculation checkpoint above is 38 / 47; combined dependency/replay
reconciliation is still required. #34 remains draft e9ef2decb with conflicts and unfinished scope.
The latest push's exact-head CI is independent of the earlier green d681da444.
Owned web 18080/Gig DB remain; fresh 36/37/38 projects are stopped with backups;
owner files, emulators and all existing database copies remain untouched.
