# Residency review receipts — September 11, 2026

This completes the backend prepared-review and original-decision recovery slice.
It does not complete household admission clients, claim submission/cold-start
routing, ownership, release acceptance or either feature PR.

## Result and boundaries

The production Home router now exposes a current residency review and returns
an immutable original receipt separately from today's claim and occupancy.
Explicit decisions bind Home, exact claim, authenticated reviewer, action,
role/reason, request UUID and reviewed snapshot. They require the opening
session proof before the transaction. Current ordinary `members.manage`
authority is checked under the existing admission lock order, including access
windows evaluated after blocking locks, explicit denies, revoked ownership,
Home security state and self-admission denial.

The snapshot includes the claim, target occupancy, target overrides and role
permissions. Membership, claim, audit and receipt commit in one transaction.
The wrapper retains the existing admission function's role/age ceilings,
restrictions, ownership routing and renewal requirements. Receipt insertion
failure rolls back all admission changes. The new receipt is service-only;
ordinary browser roles cannot read or mutate it directly. The Home deletion
eligibility function retains all prior guards and adds the new receipt fence.

A retry of an approval that preceded move-out returns its historical confirmation
alongside the inactive current membership; it cannot restore access, renew dates
or reapply a role. A rejection retried after resubmission returns the historical
rejection and current pending claim; it cannot reject that new submission.
Same UUID with changed intent is a conflict. A stale new decision needs a fresh
review. Current authority remains mandatory even for original receipt recovery.

Legacy requests without UUID/token map to one normalized historical intent.
They do not create a new identical rejection after resubmission. Deliberate new
decisions need an explicit UUID and current token. Historical pre-migration
reviews are preserved without inventing/backfilling receipts; their unsupported
retry is a conflict rather than an invented historical confirmation. Clients
must render original and current state separately before this scope can merge.

Session proof does not grant authority. It is checked before SQL, never treated
as a credential, and private responses use `Cache-Control: private, no-store`.
Notification transport runs only after a new confirmed transaction. A transport
failure does not turn committed admission into a failure, and a receipt retry
does not send it again. This is not guaranteed notification delivery: the lost
commit-response case may omit a notification. Provider delivery/outbox acceptance
remains in the wider notification/release work.

## Actual behavior verified

`test-home-residency-review-http.cjs` drives the production Express routes,
Joi validation and service against real PostgreSQL. Authentication and
notification transport are synthetic and explicitly isolated; the SQL RPC bridge
uses local psql, not hosted Supabase Auth or a paid provider.

The actual sequence passes prepared session binding, incomplete identities,
changed session before SQL, lost committed approval reply, exact original retry,
subsequent move-out preservation, changed command conflicts, legacy rejection
and resubmission, a deliberate fresh review, current authority denial/restoration,
foreign actor/claim denial, changed membership restrictions, notification
failure/replay and an injected receipt-insert failure. Four receipts and four
audits remain before exact fixture cleanup, with no partial claim/occupancy
changes after injected failure.

`test-home-residency-review-concurrency.py` observes actual PostgreSQL lock waits
in 13 races. These cover duplicate approval, competing rejection/approval,
reviewer removal, revoked ownership proof, explicit management denial, changed
target restriction, frozen Home, changed submission, reviewer becoming a teen,
access expiring while blocked, later move-out during original recovery, target
becoming an owner, and a changed target override. Each asserts the exact resulting
projection and absence of unintended receipt/audit/membership changes. Exact
fixtures are removed afterward.

The SQL contract also checks service/browser ACLs, self-admission, preserved
membership fields and defaults, historical/current separation, normalized legacy
replay, receipt identity conflicts, changed reviews, current security/authority,
role ceilings and full rollback on final receipt failure.

## Schema and application gates

- Rollback-only candidate migration plus SQL contract passed before persistent
  application to the owned local Gig replay database.
- All 40 SQL contracts pass on that local schema.
- Fresh empty replay using pinned Supabase CLI **2.116.0** passes all **35**
  migrations, with an exact source hash match and 35 ledger entries.
- All **40 pgTAP wrappers** pass on that fresh replay.
- Function lint passes **218 application functions / 84 trigger bindings**;
  six exact reviewed stock PostGIS diagnostics and 40 warnings remain under the
  existing checked-in review, with no new application exception.
- All **6 real SDK/PostgREST/Following baseline cases** pass and clean up.
- Populated predecessor rehearsal preserves **15,117 original rows across 364
  public/auth/storage tables**, including a rejected historical residency review,
  inactive restricted membership and audit. No legacy receipts are backfilled.
  Its exact synthetic fixture is removed; the isolated upgrade database remains.
- Final Node **22.23.2** full backend passes **317 suites / 5,167 checks** with
  the existing one skipped suite / 16 skipped checks. All privacy gates pass.
- The 42 affected route/admission checks pass with real Express validation and
  synthetic RPC results; these do not substitute for the SQL/HTTP/race evidence.
- Migration policy, generated-wrapper synchronization and diff whitespace checks
  pass. The combined Home/paid set has **44 collision-free versions**, but that
  does not reconcile or verify the final combined deployment/upgrade sequence.

The first fresh replay used the machine's older global CLI **2.98.2**. The
empty task-owned project was then reset/replayed with the pinned CLI; the final
35-version, lint, pgTAP and SDK results above use that final replay. No user/Home
rows existed in that project before reset. The first full backend run reported
two unrelated socket hangups (marketplace unknown PUT and missing feature flag).
Both affected suites passed their 58-case recheck, and the final complete backend
run passed without source or assertion changes. Do not describe the first run as
green or infer that the transient transport observation is globally eliminated.

Private evidence remains outside Git under `/private/tmp/` with the
`pantopus-residency-review-` prefix: `sql-draft-r3.log`, `migration-local-r1.log`,
`http-sql-r1.log`, `concurrency-r1.log`, `all-sql-contracts-r1.log`,
`fresh-replay-r2.log`, `fresh-pgtap-r1.log`, `function-lint-r1.log`,
`fresh-postgrest-r1.log`, `populated-upgrade-r1.log`, `backend-full-r2.log`,
`backend-failure-recheck-r1.log`, `privacy-r1.log` and `http-adapters-r1.log`.
No credentials, raw device tokens, archives or operator log contents enter Git.

## Integration, infrastructure and next work

PR #7 passed final required CI at `8c2eaa110` and merged as `6a1013784`.
Home integration `e709fbd0b` preserves the diagnostics privacy fix and current
Home task routes. Its native jobs were still running before this backend commit;
verify the new exact head separately. Earlier Home/master runs superseded by new
pushes are cancelled, not complete green runs. PR #24's design archive is also
merged; original owner files remain untouched.

Docker stopped during local resource pressure. The owner explicitly authorized
restoring its existing engine. Graceful restart timed out; only identified Docker
processes were stopped, with one backend process requiring termination. The
existing engine and local containers recovered. No container, volume, database,
owner emulator or owner source was deleted. Only previously documented task-owned
rebuildable build intermediates were reclaimed. Subsequent actual SQL and upgrade
checks above passed. This is not a production disaster-recovery rehearsal.

Next: both browser residency entry points need prepared review, encrypted original
and confirmation recovery, current authority/session/lifecycle handling and actual
UI/HTTP/SQL acceptance. Fix the household panel's Cancel-triggered rejection and
false-empty list behavior in that integration. Then complete installed iOS and
Android parity; transactional claim submission/cold-start/resubmission remains a
separate unfinished slice. Continue ownership transfer/challenge, lease/resource
cleanup and the complete ordered handoff backlog afterward.

PRs #32/#34 stay drafts until their scope and migration dependencies are complete.
Paid #34 remains `e9ef2decb`, green but unfinished. Preserve both branches' native
GigDetail and web CompletionFlow changes at reconciliation. Keep all paid services
for one final launch-preparation bundle. No hosted deployment or provider purchase
occurred. The owner prioritizes actual application behavior over unit coverage.
