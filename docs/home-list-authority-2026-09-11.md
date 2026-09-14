# Home lists, current access and private first use — September 11, 2026

Continuation from paused `943b08cc4` on `codex/home-permission-boundaries`.
This closes the bounded H02/H06 server list repair and adds browser acceptance.
It does not close native identity, real onboarding/invitations, all detail-field
permissions or the remaining Home/payment/release scope.

## Resulting behavior

`/my-homes`, `/primary` and the legacy root list share one production reader.
Candidate discovery reads IDs only. JavaScript IAM and the current SQL record
context must agree before shared card fields are read. Current Home state,
occupancy windows, ownership, explicit denies and effective minor ceilings are
checked again after the reads. All responses, including empty/error responses,
are private/no-store. An unreadable candidate, card, ownership, claim, IAM or
deletion result produces a safe retryable 503. A change during the request retires
the result instead of returning an old role, card or pending claim.

Cards contain an explicit field allowlist. They do not include raw owners,
occupants, account links, access instructions or provider payloads. Occupancy is
the caller's actual record, or null for an owner without occupancy. Effective
authority, ownership verification and residency records are separate fields;
there is no fabricated active admin/owner occupancy. Deletion eligibility uses
the existing guarded SQL policy and remains advisory: the delete transaction
locks and rechecks the actual operation. No migration changed.

An applicant receives only personal verification progress, without the Home's
shared address, location or display name. The exact private-creator SQL predicate
permits a private setup card and personal Tasks; established/foreign household
history removes that exception. Neither becomes a primary shared Home. Primary
selection skips expired candidates and preserves the oldest current occupancy,
then current verified ownership and legacy-pointer preference.

The browser My Homes page clears previous entries while loading, on account
changes and while backgrounded; it discards delayed results from an older
request/session. Unavailable or malformed results show Retry. It uses current
role/deletion metadata, links applicants to verification, and sends private
creators to Tasks. Cards and links work at narrow widths and with keyboard
navigation. The SDK declares nullable occupancy/address fields; Mailbox and
Place switchers exclude entries without shared Home access. Other consumers'
full lifecycle acceptance remains open.

## Verification and limits

The committed `scripts/db/test-home-list-authority-http.cjs` exercises production
routes/services through the actual Supabase SDK/PostgREST and owned local SQL.
Only authentication and faults injected after real results resolve are controlled.
The owned loopback project guard prevents hosted/paid operations.

- All three routes preserve current cards and safe field projection. Twelve
  authority changes exclude the Home before card reads, with positive recovery
  after each: frozen/frozen-silent, archived/merged, revoked/disputed ownership,
  inactive occupancy, both expired windows, both future windows and explicit deny.
- Failed, missing/null and interrupted discovery, card, ownership, claims, IAM,
  context and deletion reads produce typed safe errors and then recover.
- Nine held card/claim/eligibility replies retire after revocation. A separately
  held claim cannot restore withdrawn progress while Home access stays unchanged.
- Verified owners without occupancy remain discoverable without invented
  membership. An earlier expired occupancy cannot hide the next current primary.
  Explicit deletion denial and minor limits win. Private setup and established
  history, own pending legacy/v2 claims and unrelated-account empty lists pass.

`scripts/web/test-home-list-flows.cjs` uses Chrome with the same real production
Home list/task routes, SDK and SQL. Login, unrelated sidebar APIs, injected list
errors and lifecycle signals are controlled. It verifies current owner/deletion
controls; failure/malformed Retry; current revocation/recovery; held old-account
retirement; background/foreground; applicant privacy/destination; and the actual
private setup list → permitted Tasks screen with Add Task available. It does not
claim a new task creation/provider journey or native list acceptance. Both SQL
harnesses clean their exact synthetic fixtures.

Private evidence stays outside Git:

- `/private/tmp/pantopus-home-list-baseline-r1.log`
- `/private/tmp/pantopus-home-list-authority-http-r{1,2,3,4}.log`
- `/private/tmp/pantopus-home-list-web-r{1,2,3}/` and adjacent `.log` files
- `/private/tmp/pantopus-home-list-privacy-r1.log`
- `/private/tmp/pantopus-home-list-backend-r{1,2,3}.log`
- `/private/tmp/pantopus-home-list-web-{types-r5,lint-r3,regression-r3}.log`

Browser r1's narrow screenshot was taken during the sidebar resize animation;
it was not finished narrow-layout proof. r2 waits for the responsive layout, and
r3 strengthens the bound to the settled content inset. The initial type pass
still had the page's inherited `@ts-nocheck`; that suppression is removed. A
wrong-directory cleanup edit made no change; later strict typing exposed and
fixed the SDK zipcode/nullable-address assumptions. These are retained evidence
limits, not hidden passing results. HTTP r3 used an invalid legacy enum value
for withdrawal (`withdrawn` instead of the actual `revoked` + v2 `withdrawn`);
SQL cleanup passed, then closing its still-held HTTP request produced a socket
error. Corrected r4 passes, including held claim withdrawal. Web regression r2
found three old Place switcher fixtures missing explicit shared access; the
fixtures now represent a current verified resident, a current legacy owner with
no residency attestation, and an excluded applicant. Final r3 passes all 92
suites / 1,178 checks. Strict web typecheck r5 and affected lint r3 pass without
errors or warnings. Browser r3's finished private setup, Retry and Tasks pixels
are reviewed; fixture diagnostics contain zero errors.

All privacy gates pass. Backend r1 passes 317 suites / 5,169 checks (16 existing
skips). Backend r2 has one HTTP parser failure in the existing logout test;
the isolated 89-check auth suite passes without source changes. No cause is
established by that rerun. Final full backend r3 passes all 317 suites / 5,169 checks (16 existing skips),
78.206 seconds on the installed supported Node 20 runtime.

## Continue

H03's list failures are repaired; broader malformed detail/identity reads remain
with H04. H04 still includes wildcard detail/property Home fields and raw active
member/owner projection. H05/H07 need real native identity and create/save/join/
invite defaults, including the verified-member `home.view` gap without bypassing
explicit denies. H08 now has the bounded browser private-first-use list journey;
real native list/detail, residency and provider onboarding remain. Continue those,
then the full [remaining-work inventory](REMAINING_WORK_2026-09-11.md).

#32/#34 remain unfinished drafts. #34 conflicts with master. Reconcile the 38 Home /
21 payment / 47 distinct migration dependencies and replay the combined final
schema before any merge. A green historical head is not new-head evidence. No
hosted mutation, provider activation, migration, merge or deployment is included.
Paid dependencies stay in one final launch-preparation bundle. Owner checkout,
paid worktree, databases, devices, build products and private evidence are preserved.
