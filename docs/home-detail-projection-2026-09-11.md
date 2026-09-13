# Home detail fields, household identity and property recovery — September 11, 2026

Continues `c4a22858f` on `codex/home-permission-boundaries` in
`/private/tmp/pantopus-home-permission-boundaries`. This is the H03/H04 read
milestone. No schema, hosted configuration, paid provider or deployment change.

## Result

`GET /api/homes/:id`, `/property-details` and `/occupants` now use
`homeDetailService` and current JavaScript plus SQL admission before and after
reading. The final authority check also runs when materialization fails, so
revocation wins over a concurrent stale-data retry error.

Shared detail selects explicit Home fields. Entry/parking instructions require
`access.view_codes`; arbitrary `niche_data`, private file references, raw owner
pointers and address/geocoding internals are omitted. The provider receives its
existing cache internally so a cache write does not destroy unrelated values;
only its property bundle is returned. The legacy `is_owner` field remains stored
self-report metadata for the existing editor; it does not attest ownership or
address verification and never grants access.

Household references retain native-required `id` and `username`, with `name:null`
and the profile image. Legal names, personal email/locality and raw account
records are not queried or emitted as member identity. Peer owners require
`ownership.view`; pending/disputed owner records additionally require management.
A caller can still read their own status without a peer-owner grant. `owner` is
the permitted verified primary user owner, including without an occupancy, not
an unchecked `Home.owner_id` reference.

The active roster requires `members.view`, verified/current occupancy, valid
access dates and SQL admission for each subject. Its role is the current SQL
role including minor ceilings. Pending, inactive, future and expired rows are
excluded. `include_inactive=1` additionally requires `members.manage`. Pending
invitations are manager-only; inviter display uses a handle. Owner/member/claim
and invitation projections are rechecked before return. Held removal can produce
a fresh filtered result or a safe retry; it cannot resurrect the removed member.
Malformed/unavailable rows fail safely instead of reporting an empty household.

The browser property page clears data on retry, auth/session changes and
backgrounding; held replies cannot revive a retired session. Unavailable property
records and failed requests have working recovery controls. The narrow source
label now fits beside the floating chat button. Home editing omits unreadable
instruction controls and fields from its save payload. Home contact navigation
uses the safe primary-owner reference and no longer substitutes an arbitrary
first member for an administrator. The occupants SDK type matches actual fields.

## Acceptance and evidence

All fixture data and logs stay outside Git; exact cleanup passed on every run.
The production routes/IAM, actual Supabase JS SDK/PostgREST and owned local SQL
are exercised. Authentication, provider replies, ancillary browser APIs and
lifecycle events are controlled. No message was sent.

- HTTP/SQL/SDK final r5:
  `/private/tmp/pantopus-home-detail-projection-authority-r5.log`.
  Includes the existing thirteen-change authority matrix, nine held-reply
  denials, malformed/failed Home/owner/claim/provider results and recovery;
  explicit field denies, safe identities, own versus peer ownership,
  current/history permissions, member time windows/minor role, and held member
  removal. Runnable: `scripts/db/test-home-detail-authority-http.cjs`.
- Chrome final r3: `/private/tmp/pantopus-home-property-detail-web-r3.log` and
  `/private/tmp/pantopus-home-property-detail-web-r3/` (`result.json`, screenshots).
  Actual property rendering, error/malformed Retry, actual revocation/recovery,
  held account switch, background/foreground retirement, provider-unavailable
  retry, settled 375px view, withheld edit controls and owner-without-occupancy
  contact navigation pass. Failure and final narrow screenshots were inspected.
  Runnable: `scripts/web/test-home-property-detail-flows.cjs`.
- Privacy gates r2 pass:
  `/private/tmp/pantopus-home-detail-projection-privacy-r2.log`.
- Backend r2: 317 suites / 5,169 passed, 16 existing skips, 70.006 seconds:
  `/private/tmp/pantopus-home-detail-projection-backend-r2.log`.
- Web regression r1: 92 suites / 1,178 passed, 22.459 seconds:
  `/private/tmp/pantopus-home-detail-projection-web-regression-r1.log`.
- Strict web types r3 pass; affected lint r2 has no errors and retains eight
  existing `any`/editor `ts-nocheck` warnings. Evidence:
  `/private/tmp/pantopus-home-detail-projection-types-r3.log`,
  `/private/tmp/pantopus-home-detail-projection-lint-r2.log`.

Initial regression fixtures supplied non-UUID identities, missing permission
arrays and sparse Home rows. Those isolated claim/minor fixtures were corrected;
production validation was retained. The initial held-reply run identified the
error/admission ordering repair. Two matrix assertions were corrected: invalid
query input uses the existing 400 envelope, and a freshly filtered roster is a
valid safe response after a held subject is removed. Chrome r1 had an ambiguous
Beds locator, corrected to the hero statistic. Chrome r2 exposed source-label
chat overlap; final r3 verifies its repair. No failed attempt is counted as passing.

## Limits and continuation

H03/H04 here close the specified detail/list/occupants read projections, not all
Home endpoints. Broader settings/mutation responses, IAM audit/request identity,
Members/Security page failure states, role actions and privacy controls remain
D01/D05/D07. Property provider identity matching, deeper nested/vendor validation,
cache age and estimates remain I05; live server invalidation without lifecycle
changes remains I07. Native installed decoding/display and true create/join/invite
first use remain H05/H07/H08, then R01–R06. Native and backend authority may not be
inferred from self-reported ownership or an address.

The previous list head `c4a22858f` has green backend/web/privacy/schema,
Android instrumented checks and iOS test-bundle build in
[CI 34634628047](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34634628047).
iOS simulator tests and Android assemble were still running at the last refresh.
Check the next pushed head independently. Both PRs remain unfinished drafts;
#34 remains conflicted. The 38 Home / 21 payment / 47 combined migration
reconciliation remains open. All owner work, SQL stores, devices, builds and
private evidence are preserved. Paid services remain one final launch bundle.

### CI follow-up for the detail milestone

The pushed `afd231655` run [34636714349](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34636714349)
caught a redacted-public-preview regression: a helper removed during cleanup
still had a caller. That cleanup occurred after the earlier local full regression.
The flag-aware personal-claim predicate is restored; it grants only the existing
redacted preview, never shared Home data. All 18 focused address/claim checks and
full backend regression (317 suites / 5,169 passed, 16 skips, 90.682 seconds) now
pass. Evidence: `/private/tmp/pantopus-home-detail-projection-preview-fix-r2.log`,
`/private/tmp/pantopus-home-detail-projection-backend-r3.log`; failed CI log remains
private at `/private/tmp/pantopus-home-detail-projection-ci-backend-afd231655.log`.
A first focused invocation used the repository root instead of backend and could
not resolve its test mock's express import; the backend invocation passed.

The native H05/H08 candidate is now in progress, not yet accepted. Previous
native products are preserved with filesystem clones under
`/private/tmp/pantopus-home-native-artifacts-before-h05/`. Actual SDK list/detail
native-fixture mode is being prepared; no new migration or paid activation.
Verify the repair's new pushed head independently; the failed head is not green.
