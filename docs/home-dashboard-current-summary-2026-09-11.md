# Home dashboard aggregate continuation — September 11, 2026

This continues PR #32 after native bill currency/history commit `983c93a919`.
It does not complete the Home branch, PR #34, or launch preparation. Paid
providers remain one final bundle; no hosted database or deployment was changed.

## Production contract repaired

`GET /api/homes/:id/dashboard` now delegates to `homeDashboardService`, validates
the Home id, sends `private, no-store`, and distinguishes confirmed empty data
from unavailable reads. SQL errors, rejected transport, missing/malformed counts
or lists, failed owner enrichment, deletion eligibility and requested health
failures cannot produce a successful zero/all-clear summary. The route returns
safe errors without SQL contents.

Current effective IAM and the existing SQL `home_record_context` must both
admit shared Home access. The SQL context also fences frozen/archived Homes and
disputed/revoked ownership pointers. The service checks current authority again
before publishing, comparing permissions, role, owner status and occupancy
identity/verification/access dates. A changed grant retires the batch with 503;
current Home denial returns 403. This is checked aggregation across reads, not
a new single-transaction data snapshot or a session-revocation mechanism.
Native foreground/account retirement still needs its own implementation.

Each resource uses its explicit permission: members, tasks, calendar, finance,
mailbox, packages, maintenance, documents, guest management and audit access.
Manager/sensitive visibility applies to document, issue and package counts.
Denied resource tables are not queried; their legacy numeric/list slots are
zero/empty alongside the current permission bag. Owner/manage flags cannot
restore a denied view grant. Pets retain the existing Home-view contract.

The actual database exposed several previously hidden source mismatches:

- There is no `HomeMail` table. Unread badges now query `Mail` with current
  verified mailbox authority, verification-age policy, Home identity, unread/
  unarchived state, expiration and addressee/privacy filters. Another person's
  personal or attention-only mail, limited-access envelopes, shredded mail,
  business mail and expired mail do not enter the count. No content is opened.
- Packages use `expected` and `out_for_delivery`; `ordered`/`shipped` were not
  valid HomePackage statuses. Expected totals and deliveries arriving today
  are now distinct. Overdue bills and scheduled maintenance remain outstanding.
- A future guest pass is not window-current. Pending, future, ended and
  unknown-role occupancy rows are not active household members.
- The Home header uses the established Home list projection, excluding entry
  instructions and Wi-Fi file references. Its deletion advisory remains the
  existing guarded eligibility RPC. The unchanged geography decoder is shared
  with the original Home routes; real zero coordinates remain valid.
- Member identities use the existing safe selection/serializer rather than
  forwarding raw legal names. Browser member rows/details consume the public
  identity fields and retain fallback for older endpoint responses. Native
  reader changes are a separate, still-unverified working draft at this point.

## Actual verification

Private operator evidence stays outside Git. Sources of the repeatable journeys
are `scripts/db/test-home-dashboard-http.cjs` and the upgraded
`scripts/web/test-home-dashboard-access.cjs`.

- HTTP/SQL r5 passes the full owned database journey. Final r6 additionally
  passes through the actual Supabase SDK/PostgREST transport, including nested
  identity serialization, compound Mail/package/date filters, fractional bills,
  geography, denied finance, a frozen Home and successful restoration.
- Populated records include real tasks, calendar, bills, maintenance, documents,
  packages, pets, guest passes, occupancy windows, audit and private Mail variants.
  The fixture checks every queried dependency's database/transport failure,
  malformed counts/lists, Home/enrichment/health failure and recovery.
- Five held, already-produced SQL replies are released after actual changes
  to finance permission, membership, expiry, Home freeze or disputed ownership.
  The old batch is withheld and each fresh recovery succeeds. Pending applicants
  do not receive the shared aggregate. Exact fixture cleanup passes after every
  run, including failed setup attempts.
- Chrome production-aggregate r1 passes member identity rendering, open-panel
  revocation, held aggregate/authority replies, account-marker retirement,
  changed permissions, background/return, authority and claim-list outages,
  pending-residency routing, timeline retirement, narrow layout and keyboard
  reload. Zero page errors and mutations. Wide/narrow screenshots were reviewed.
  Identity, ancillary/fallback endpoints and lifecycle events remain synthetic;
  the aggregate and IAM use production HTTP/helpers/services and real SQL.
- Full backend regression: 317 suites / 5,169 checks pass; the existing one
  suite / 16 skips remain. Full web regression: 92 suites / 1,178 pass. Final web
  typecheck passes; affected lint has zero errors and eight existing warnings.
  Privacy gates pass without extending an allowlist or disabling a gate.

Private evidence: `/private/tmp/pantopus-home-dashboard-http-r6.log`,
`/private/tmp/pantopus-home-dashboard-production-web-r1/`,
`/private/tmp/pantopus-home-dashboard-backend-r1.log`,
`/private/tmp/pantopus-home-dashboard-web-regression-r1.log`,
`/private/tmp/pantopus-home-dashboard-web-types-r3.log`,
`/private/tmp/pantopus-home-dashboard-web-lint-r1.log`, and
`/private/tmp/pantopus-home-dashboard-privacy-r2.log`.

Initial failures are retained: r1's invented Wi-Fi File reference violated its
FK; r2/r3's inconsistent Mail target fixtures violated real constraints. Those
fixtures were corrected without changing constraints. Populated r4 then exposed
an incorrect geography-helper import in the service; the shared existing decoder
fix passes complete r5/r6. Privacy r1 rejected the moved raw-name join; the safe
identity projection passes r2. Web types initially caught an identity-field
change applied to a still-legacy pending-invite type; that unrelated expression
was restored and final typecheck passes.

## Remaining findings and next action

The live browser connection exposed a client contract gap: `useHomeData`
expects entity arrays the aggregate never returned, so a populated overview
can appear empty. Its aggregate failure fallback also tolerates individual read
failures. Repair those states, totals, permission gates and recovery next, using
actual populated production responses. Do not treat the old fallback acceptance
as proof that unavailable data is displayed honestly. Review native equivalents
before claiming whole-dashboard acceptance. Mixed-currency overview totals must
not sum unlike currencies.

Continue native current-access/lifecycle/account/held-read retirement and safe
identity readers, preserving exact private-creator task first use and the correct
ownership/residency applicant entry. Fix captured checklist truncation and
unsupported property-estimate copy. Browser review also retains narrow member
label/badge and floating-chat overlap, plus the verified-member screen's separate
unverified-property label, for the UI pass.

Standalone issue/package routes still need their own explicit permissions,
visibility and mutation review; this aggregate repair does not fix them. Pets'
missing-table fallback, mailbox routes' independent privacy/error behavior, guest
link view-limit/redeemability, Home-timezone day boundaries and large household
pagination remain resource/workflow checks. Current dashboard guest counts mean
unrevoked passes within their time window, not guaranteed link redemption.

The remaining Home/Place/residency/ownership/leases/resources/settings, Pulse/
Beacon, account/vendor and payment/release backlog stays in PROJECT_HANDOFF.
There is no new migration: 38 Home / 21 payment / 47 combined source versions;
combined dependency and replay reconciliation is still a merge gate.

## Remote CI and native draft

All iOS jobs and Android instrumentation on `983c93a919` passed. Android's
lint/test/assemble job failed on the three HomeDashboard Paparazzi images (each
retried), after the intentional Create-footer change; 4,597 checks ran, nine
retry failures and 80 skips. The images have not yet been accepted. Reproduce,
inspect the pixel differences, repair any actual layout defect, then update only
reviewed intentional baselines and verify again. Do not waive the failing gate.

The native safe-identity reader/projection drafts are formatted on iOS. Android's
first formatter run found an overlong new expression; it was wrapped. The owned
targeted Android quality/snapshot build is running as session 13270, log
`/private/tmp/pantopus-home-dashboard-android-snapshot-verify-r1.log`. Inspect its
result before any pass claim. No new native installed acceptance is claimed.
