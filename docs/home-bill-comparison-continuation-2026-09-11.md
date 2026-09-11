# Bill comparison continuation — September 11, 2026

Work after pushed Home summary/settings milestone `a6d879664`. PR #32 remains
draft; currency/aggregation/cohort repair is unfinished. No provider or paid
service activation, source-bill rewrite or hosted database action is authorized
by this report. Existing user authorization governs the continuing local work.

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

## Confirmed amount and derived-data findings still to resolve

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

Inspect the full producer/consumer contract and choose one canonical calculation
before editing migrations. Validate multiple bills per Home/month, multiple
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

No new migration exists in this continuation yet: committed source is 37 Home /
46 combined, static union collision-free but dependency/replay reconciliation
still required. #34 remains draft e9ef2decb with conflicts and unfinished scope.
The latest push's exact-head CI is independent of the earlier green d681da444.
Owned web 18080/Gig DB remain; fresh 36/37 projects are stopped with backups;
owner files, emulators and all existing database copies remain untouched.
