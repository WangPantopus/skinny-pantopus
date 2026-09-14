# Personal residency progress — September 11, 2026

Continuation of browser submission milestone `92c4d8072`. This scope makes an
applicant's own requests identifiable and separates their saved review from
current household access. R02/H07/H08 and launch remain open.

## Product behavior

My Homes previously rendered identical “Home verification” cards and sent every
residency applicant to an ownership-document upload page. It also lost the
personal request destination when a later removal excluded the Home from the
current access list. It now lists the applicant's submitted address and request
status separately, with bounded pagination and a dedicated current-status page.
Shared/private Homes retain their current destinations and a residency-status
link; ownership review retains its separate path.

The status page distinguishes saved household review, separate address
verification, rejected resubmission, ownership review, current Home/private-task
access and unavailable or ended access. A historical approval cannot create an
“Open Home” action after removal, an explicit deny or expiry. Resubmission goes
through explicit address/apartment confirmation. Checking progress sends no
mail, notifications or admission mutations. Refresh, retry, page lifetime and
session fences retire obsolete reads and clear sensitive data on read failure.

## Read boundaries

`GET /api/homes/my-residency` reads only caller-owned application columns, with
50-row pages, a stable cursor and explicit `next_cursor`. It retains personal
history without a current Home destination. `GET /api/homes/:id/my-residency`
requires a caller-owned claim, occupancy, ownership record or created Home
reference. Its current access uses the existing JavaScript/SQL Home-list policy;
references and authority are rechecked before projection. Invalid, failed,
interrupted, malformed and changed reads have safe retryable errors. Responses
and errors are private/no-store, including before authentication.

Addresses are the caller's submitted values, never joined from the current
private Home. Reviewer/account identities, review internals, raw occupancy,
postal codes/hashes and provider receipts are excluded. The older `/my-claims`
reader also uses these scoped pages, preserves personal field aliases and
returns `home: null` instead of joining current private Home details. Its SDK
exposes the continuation cursor. No reachable browser/native caller of that
legacy reader was found in the current source; outside/older-client compatibility
is not certified by that observation.

## Verification and evidence

Actual production HTTP/Supabase SDK/PostgreSQL acceptance passes in
`/private/tmp/pantopus-home-residency-progress-http-r3/` and its adjacent log:

- Correct personal identity before/after current private street/unit changes,
  including the legacy reader; no current Home address/name query is made.
- Actor isolation, missing personal progress, invalid IDs/cursors and no-store.
- Saved pending/rejected/verified review versus current access; all three postal
  routing modes; inactive, future/ended/expired/provisional access; frozen,
  disputed, archived and merged Homes; verified ownership without a claim.
- Failed/interrupted/malformed own reads and held claim/authority results;
  recovery after every refusal. A scoped positive/negative `home.view` override
  exercises current admission without adopting the member-default migration.
- Fifty-two personal rows paginated once each, including historical rows with
  no current Home; exact fixture cleanup and unchanged migration ledger.

Actual Chrome → production HTTP/SDK/SQL passes in
`/private/tmp/pantopus-home-residency-progress-web-ui-r4/`: three distinct request
cards, household review without document upload, submitted identity after a
current unit change, failed/malformed read → retry, rejected resubmission target,
separate mail-verification target without requesting mail, pagehide/pageshow with
a held old response, current approval followed by removal/freeze and preserved
personal history. The 51-row historical extension also passes load-more failure,
preserved first-page content and retry through every remaining request. Narrow
screenshots were inspected. Protected original-command
submission acceptance belongs to the preceding report; this status driver uses
the production submission endpoint to prepare its own synthetic records.

Backend regression passes 317 suites / 5,170 checks (16 skips) in
`/private/tmp/pantopus-home-residency-progress-backend-r2.log`; browser regression
passes 93 suites / 1,193 checks in `...-web-regression-r2.log`. Final web types
pass with zero errors (`...-web-types-r3.log`), changed-source lint has zero errors
or warnings (`...-web-lint-r1.log`), and every privacy gate passes
(`...-privacy-r1.log`). The actual full joining recovery regression also passes
with its new My Homes/status destinations (`...-join-regression-r1/`); original
owner creation/cancel/retry/atomic-refusal recovery and distinct private-unit
cards pass (`...-create-regression-r1/`). Explicit renter creation also passes
(`...-renter-regression-r1/`), with no ownership claim and a current private Tasks
destination. All browser commands were acknowledged through UI before cleanup.
The owned status, joining and creation fixtures are stopped; their exact SQL and
temporary functions/tables are cleaned, with no ledger change. All abbreviated
private paths share the
`/private/tmp/pantopus-home-residency-progress` prefix. The first full backend
regression had one existing OAuth test exceed
its 5-second timeout while other checks ran; its isolated 89-check suite passes.
Earlier UI attempts retained a driver field-name mistake and a missing production
service in the fixture allowlist; the corrected actual run passes. Failed runs
and all private screens/logs remain preserved.

## Limits and immediate continuation

The postal destination remains the older verification screen. Its optimistic
delivery/membership copy, initial status reconciliation, selected mailing-address
binding and unknown-outcome recovery still need repair and actual acceptance.
Opening a link is not acceptance of mailing or verification. The legacy claim
mutation still needs compatibility migration; native submission/status and
prepared residency review remain open. Mounted server changes without refresh,
broader lifecycle/accessibility/provider/version combinations and current-owner
reviewer messaging are separate acceptance work. The pre-existing floating
chat/add controls remain visible on narrow Home screens.

No new migration, permanent schema adoption, hosted rollout, paid activation,
physical iPhone change or merge. Existing database helpers/ledger, owner work,
devices and accepted products are preserved. The physical iPhone remains on the
verified Pantopus 1.0.0 (2); paid services stay one final launch bundle.
