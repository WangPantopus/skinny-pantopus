# Home list unit identity — September 11, 2026

Visual iPhone creation acceptance found that units 301 and 303 at one street
looked identical in My Homes. Their distinct units were stored correctly, but
the safe list projection omitted `Home.address2`. The API, browser and iPhone
repair now passes actual acceptance. Android unit labels and retained creation
remain local WIP, with wizard integration and installed acceptance still due.

## Behavior and actual acceptance

All three Home-list routes include the authorized unit beside the existing
allowed address. Personal verification entries explicitly return no street or
unit; unrelated/revoked callers still receive no shared card. A malformed unit
is a retryable list error. The browser rejects malformed unit fields before
rendering. Browser and iPhone show the unit separately from the Home name and
do not show it on verification-only entries.

Actual HTTP/SDK/SQL r2 passes all three projections, corrected-unit reload,
malformed-unit refusal, current authority/refusal/recovery and private-creator
versus personal-verification boundaries. Its existing failure/held-response
matrix also passes. Exact SQL fixture cleanup is confirmed.

Actual Chrome r2 passes two same-named Homes at one street with distinct SQL
units and correct Home-specific destinations at 375px width, without horizontal
overflow. Shared/private cards show their unit; applicants do not. Existing
unavailable/malformed Retry, revocation, account/background retirement and real
private Tasks navigation continue to pass. Screens are reviewed; exact SQL
cleanup passes. Chrome r1 found the previous owned web server had exited and
failed before page acceptance; its exact fixture cleanup succeeded. The server
was restarted only after confirming that its old PID and port were absent.

Installed iPhone r1 repeats actual creation/lost-reply/restart and optional-setup
refusal/correction, then checks each exact new Home's Tasks action and its unit.
Both journeys pass in 206.318 seconds together. The reviewed final screen shows
both units clearly while preserving private-setup and unverified identity. The
complete fixture has zero fixture errors and graceful exact SQL/function cleanup.
The local ledger remains `20260910220000`; this change adds no migration.

Backend regression passes 317 suites / 5,170 checks (16 skips). Web regression
passes 92 suites / 1,178 checks, strict types and changed-page lint pass. iPhone
final signed build r2, three-file format/strict lint and full regression pass:
4,369 checks, 168 skips, zero failures (4,537 total). Privacy gates pass.
The initial iPhone style invocation rejected an explicit nil initializer; the
implicit optional initializer passes style and compilation. No build ran on that
failed style invocation.

## Evidence and remaining work

Private evidence is under `/private/tmp/pantopus-home-list-unit-`:

- `http-r2.log`, `backend-r1.log`, `privacy-r1.log`;
- `web-r2/` (screens and result), `web-r2.log`, `web-regression-r1.log`,
  `web-types-r1.log`, `web-lint-r1.log`;
- `ios-build-r2.log`, `ios-{format,lint}-r2.log`,
  `ios-regression-r1.xcresult`, `ios-ui-r1.xcresult` and its exported attachments;
- `native-fixture-r1.{json,log}` with exact cleanup confirmation;
- `web-server-r1.log` for the replacement owned development server.

Accepted iPhone creation predecessor products remain APFS-cloned at
`/private/tmp/pantopus-home-native-artifacts-after-ios-create/`. Owner work,
original Docker REST container/configuration evidence, databases and devices
remain preserved. No hosted change, paid activation, message or merge occurred.

Continue Android unit/creation integration and acceptance, then browser retained
creation, existing-Home admission, primary/private first use and invitations,
native residency and the full inventory. This does not close U01's broader
identity/layout cases or H07/H08/R02. Source migrations remain 40 Home / 21 paid /
49 combined; #32/#34 remain unfinished drafts and #34 conflicts. Check this
milestone's own pushed-head CI before integration.
