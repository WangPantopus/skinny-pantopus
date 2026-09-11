# Home dashboard aggregate continuation — September 11, 2026

This continues PR #32 after native bill currency/history commit `983c93a919`.
It does not complete the Home branch, PR #34, or launch preparation. Paid
providers remain one final bundle; no hosted database or deployment was changed.

## Populated browser and standalone list milestone

The browser now uses the aggregate's actual counts/today contract and reads
full task/issue/bill/package/document/event collections only with their explicit
view grants. The fictional aggregate arrays and permissive fallback are removed.
A failed aggregate performs no fallback collection reads. Required SQL failures,
missing arrays and wrong Home identities remain unavailable; optional card
failures have explicit Retry states. Refresh rechecks current access and totals.
Invitation refresh uses the safe current roster rather than reintroducing legal
names or counting pending invitations as members.

Actual populated UI exposed and repaired these functional defects:

- Stored tasks/events and outstanding counts were absent from the overview.
- Bills show their own major-unit currency and two decimal places. The overview
  counts bills due without adding USD to CAD. Calendar-only due dates keep the
  saved day in America/Los_Angeles; a bill due today is not prematurely overdue.
  Finance viewers lack Add Bill/Mark Paid controls. No bills due does not claim
  every historical bill was paid; rendering does not sort shared state in place.
- Today issue/package shortcuts now open Maintenance/Deliveries. Maintenance's
  default Active list includes open, in-progress and scheduled records; previously
  open/in-progress issues had no list. Preview cards support Enter/Space and focus.
- Future packages are pending rather than arriving, and vendor names render.
  The property preview no longer claims an ATTOM source without evidence.
  Document/package/calendar/expanded-card visibility uses current explicit grants.

Issue/package GETs now validate filters and rows, enforce current permissions and
visibility, send no-store, and recheck authority after reading. Owner pointers
cannot bypass a resource denial. Explicit standalone resource grants remain
usable without inventing a parent home.view grant. Writes/media/receipts are
separate unfinished scope.

HTTP/SQL **r7 passes**, including both list endpoints, valid/invalid/duplicate
filters, SQL/transport/malformed/cross-Home failures, visibility, denied reads,
two held replies after revocation and real SDK/PostgREST list filters, plus the
prior aggregate matrix. Chrome **r6 passes all 13 journey groups**, zero page
errors/mutations and exact cleanup. Core records and pets use production HTTP/
services/SQL; seven denied view sections issue no forbidden collection requests.
The previous account/access/lifecycle/applicant/held-reply matrix also passes.
Final overview, active maintenance and fractional-currency/date screens were
reviewed. Identity, ancillary/provider responses and deterministic lifecycle
signals remain synthetic; this is not complete write or native acceptance.

A policy finding remains: the owned baseline allows a verified generic member
to lack home.view. Browser r1's approved-member restoration used the old fallback
after aggregate denial; it was not proof of correct admission. Current acceptance
keeps that Home denied, then applies an explicit grant and verifies restoration
without owner controls. Reconcile role presets/defaults with actual residency
and invitation onboarding. No inferred grant or fallback bypass was introduced.

Full backend regression passes 317 suites / 5,169 checks (existing one suite /
16 skips). Final web regression r3 passes 92 suites / 1,178; final typecheck r3 passes,
affected lint r2 reports zero errors / 104 warnings across the wider edited set,
and all five identity/privacy gates pass. No migration or hosted/provider change.

Private proof: `/private/tmp/pantopus-home-dashboard-http-r7.log`,
`/private/tmp/pantopus-home-dashboard-production-web-r6/`, and
`/private/tmp/pantopus-home-dashboard-web-contract-{backend-r1,regression-r3,types-r3,lint-r2}.log`.
Browser r3/r4 failed ambiguous selectors after accessible cards were introduced;
r5 exposed the real missing active-maintenance destination. Final r6 passes after
repair. Web regression's old aggregate fixture was corrected to the real contract
without weakening denied-permission assertions. Earlier evidence below remains
historical; its web fallback and standalone GET findings are superseded here.

Next: native strict aggregate decoding, safe identity, current access, foreground/
return/account/held-reply retirement and proper applicant/private-first-use entry.
Native default DTOs still hide missing aggregates, core/intelligence reads remain
unscoped, and public-profile fallback is not shared Home authority. Claim ownership
must not be offered to every non-owner. Existing verification/waiting-room readers
also discard the 403 verification body and need actual residency review.

Other reachable findings remain: embedded issue/bill/package handlers discard
media and some write errors only log; standalone bill units/package states differ;
document sharing, Share Center, member/security and provider-list errors need
acceptance. Keep pets' missing-table fallback, mailbox privacy, guest redemption/
limits, Home-day timezone boundaries, pagination, narrow member/chat overlap and
property verification wording open. Native identity drafts remain uncommitted
without installed proof. Full Home/Place/Pulse/Beacon/account/payment/release
priorities, combined migrations and the final paid-provider bundle remain.

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
retry failures and 80 skips. All three differences were reproduced locally and visually reviewed: the last
viewport rows now scroll above the reserved Create footer instead of lying under
the floating action button. No other pixels changed. Only these three images
were copied from the reviewed renderer output to their baselines. Targeted r2
passes all three; quality, main compilation and test compilation passed in r1.
The failed run was not waived. Private original images, current images, deltas
and failure XML are under `/private/tmp/pantopus-home-dashboard-android-snapshot-r1/`;
final verification is `/private/tmp/pantopus-home-dashboard-android-snapshot-verify-r2.log`.
The old sample attention text says three items while listing four; retain that
existing sample/presentation mismatch for the native UI pass, independently of
this footer-only pixel repair.

Backend/browser milestone is pushed as `60228da3d`. Its newly running CI must be
checked independently; the baseline follow-up will also need its own checks.
Native safe-identity DTO/projection changes remain an uncommitted working draft.
iOS formatting passes; Android's initial formatter found a long new expression,
which was wrapped and passes final quality/compilation. No new native installed
acceptance or whole-Home lifecycle completion is claimed.
