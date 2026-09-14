# Home creation recovery — September 11, 2026

The atomic backend creation milestone is locally accepted after pushed location
milestone `af28df271`, whose [CI run 34660624151](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34660624151)
now passes every job. This report accompanies the backend source checkpoint;
verify its own pushed-head CI separately. H07/H08/R02 remain open for retained
client commands, actual create/join UI, primary eligibility and private first use.

## Actual baseline

The production validation/create routes, occupancy template, Supabase SDK and
owned local PostgreSQL reproduce two defects. A controlled SDK-boundary fault
submits an invalid occupancy age enum to PostgreSQL after the Home insert has
committed. PostgreSQL rejects that occupancy, but HTTP returns 201. Actual SQL
shows one Home, zero occupancies and one preferences row. Repeating the identical
request returns another 201; SQL then shows two active Homes at the identical
address hash, zero occupancies and two preferences rows.

The route assumes an address-hash uniqueness violation will stop duplicates.
Both the source baseline and actual database instead have a non-unique partial
index, `idx_home_address_hash_active`. Existing records must be preserved;
adding uniqueness without reconciling duplicates would not be a safe upgrade.

Private baseline r2: `/private/tmp/pantopus-home-create-baseline-http-r2.log`,
`/private/tmp/pantopus-home-create-baseline-duplicate-r2.json`,
`/private/tmp/pantopus-home-create-baseline-events-r2.json` and
`/private/tmp/pantopus-home-create-baseline-fixture-r2.log`. The first attempt's
retry assertion expected a conflict and failed because creation succeeded
again; that evidence is retained separately. Both exact synthetic namespaces
were cleaned on graceful shutdown. No existing data, schema or migration ledger
was changed; the failed enum value was sent only for the reserved fixture user.

## Implemented backend repair

`POST /api/homes` reserves the original request before provider work. The
service-only `HomeCreateCommand` stores an immutable input hash, fenced worker
lease and durable outcome. It does not store the address, original body, access
codes or provider response. A missing GET does not prove a delayed POST cannot
commit: Cancel can create a tombstone before that POST arrives. Completed
outcomes win cancellation races. Expired/replaced/cancelled workers cannot write
Home resources or overwrite a newer decision.

The SQL transaction commits Home, creator occupancy and age restrictions,
preferences, pending owner/claim/audits, optional Wi-Fi/access records and the
outcome together. Address creation is serialized and checks active canonical,
hash and legacy-field matches explicitly. It preserves existing duplicates.
The canonical provider snapshot and any required mail step-up are rechecked
at commit. Required SQL failure rolls back the setup; optional access rejection
rolls back earlier setup writes before retaining a rejection. Unexpected errors
leave the original command recoverable. The route has no independent Home,
occupancy, preference, owner, claim or access-secret insert.

Known account DOB survives in occupancy; historical null age retains existing
compatibility. Creation grants no verified owner pointer or verified residency.
The route rejects contradictory role/owner inputs, requires canonical persistence,
keeps existing address/provider/attestation gates, and removes raw ZIP/coordinate
creation logging and SQL debug responses. Nested optional access validation also
redacts both leaf and whole-array errors from responses and logs.

## Client protocol and remaining work

Clients should persist `request_id` and the exact original body before POST.
The body can include up to twenty `access_secrets` with the existing secret
payload fields. Status is `GET /api/homes/create-commands/:requestId`; cancellation
is `POST /api/homes/create-commands/:requestId/cancel`.

- Completed: 201 on the committing response, 200 on replay, with the original
  Home/claim/access IDs. These IDs outlive deletion and confer no current access.
  `current_access: not_checked` means the client must reload current Homes and
  its authorized destination. The verification fields describe creation setup.
- Pending: 202 for active work; transient failure is 503 with retained pending
  state when confirmed. Retry the same command; do not mint a new ID or discard
  its details merely because a reply/status is missing.
- Rejected: a durable, safe 4xx code. Review/correct into a new command only once
  that outcome is confirmed. Cancellation returns the winning cancelled or
  completed outcome, rather than claiming a committed Home was undone.

Legacy clients without a UUID receive atomic setup and address deduplication,
but cannot recover through a UUID they never retained. Protected native/browser
storage, lost-reply/restart UI, joining, primary eligibility and useful first-use
navigation are next. Optional native setup must move into the original command.
Current destinations must use current list/record authority. Legacy orphan Homes
and duplicate-household admission still need explicit reconciliation; this
migration neither deletes nor promotes them. The existing best-effort self
notification is not a durable delivery guarantee, particularly after a lost
commit response. The retained outcome supplies verification guidance independently.

## Verification

Final production HTTP/SDK/PostgreSQL acceptance passes original replay without
providers, status, changed-intent refusal, duplicate refusal, cancellation before
arrival and during held provider work, lost SDK commit reply, lost HTTP response,
actual SQL occupancy failure/rollback/exact retry, pending-owner setup with two
private access records, child optional-access rejection, and concurrent same-
address commands. External providers, authentication and self notification are
controlled boundaries; this is not native UI, real signup or paid-provider proof.

Private final evidence: `/private/tmp/pantopus-home-create-recovery-http-r3.log`,
`/private/tmp/pantopus-home-create-recovery-http-r3.json`,
`/private/tmp/pantopus-home-create-recovery-events-r2.json` and
`/private/tmp/pantopus-home-create-recovery-fixture-r2.log`. The exact SQL fault
trigger was removed. Both fixture runs removed their synthetic rows and temporary
new functions/table; no migration ledger changed and port 18084 is free.

The portable SQL contract passes atomic rollback, authority limits, defaults,
cross-account receipt isolation, retained outcome after deletion, provider-snapshot
retirement, duplicate refusal and lease/cancellation cases. Final function lint
has zero issues (`/private/tmp/pantopus-home-create-atomic-contract-r3.log`). The
populated additive migration rehearsal preserves all row values in 365 existing
public/auth/storage tables and rolls back completely
(`/private/tmp/pantopus-home-create-upgrade-r1.log`).

Backend regression passes 317 suites / 5,170 checks (16 skips), 72.196 seconds:
`/private/tmp/pantopus-home-create-backend-r1.log`. All privacy gates pass:
`/private/tmp/pantopus-home-create-privacy-r1.log`. The 72 affected address,
provenance and redaction checks also pass; their mocks now stop at the real
transaction boundary rather than simulating independent Home setup writes.
Migration policy and generated SQL wrappers pass. Fresh empty-schema replay
remains a required check on the next pushed head.

Failed attempts remain private: the first atomic SQL contract had an ambiguous
fixture variable; the first HTTP duplicate assertion expected the SQL conflict
code but the existing provider decision correctly returned `ADDRESS_CONFLICT`.
The regression's old partial-write mocks and full-row response expectations were
updated, and the provider-outage diagnostic was preserved with pending recovery.
A premature final-fixture request preceded listener readiness; readiness was
confirmed before the successful final run. One wrong-directory test-edit command
and one upgrade-script Python quoting error changed no source/database state.
The first lint warning was an implicit UUID-array initializer; it is explicitly
typed in the accepted function.

## Integration boundary

Source inventory is 40 Home / 21 payment / 49 distinct combined migration
versions, with identical contents for every shared version. The new
`20260911040000` version has no paid-branch collision. Dependency/union replay,
unfinished draft PR scopes and current-head checks still gate merging. #32
remains draft; #34 remains draft/conflicted. No permanent schema adoption, merge,
hosted mutation or paid activation. Owner work, existing databases, devices,
accepted native products and private evidence remain preserved. Paid services
remain one final launch bundle.
