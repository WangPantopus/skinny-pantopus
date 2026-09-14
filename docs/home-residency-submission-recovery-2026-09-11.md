# Existing-Home submission recovery — September 11, 2026

Active R02 work after the [browser creation milestone](home-browser-create-recovery-2026-09-11.md).
The additive backend command now has actual HTTP/SDK/SQL acceptance. R02 remains
open: all three clients still use the legacy submission path and must be migrated
and accepted. Browser/iPhone/Android Home creation acceptance remains intact.

## Reproduced through production HTTP / SDK / SQL

The owned `test-home-residency-submission-baseline.cjs` runs the existing
`POST /api/homes/:id/claim` route against the actual local Supabase SDK and SQL.
Authentication and notification/postage boundaries are synthetic. An injected
read fault happens only after the real authority query has returned.

Baseline r2 reproduces four failures:

1. An authority read failure occurs after the claim insert. HTTP 500 leaves one
   pending claim and no applicant occupancy; retry returns HTTP 400 for the
   already-pending claim and cannot finish admission.
2. A verified HomeOwner without an occupancy is skipped by the authority query.
   The route attempts the controlled postcard boundary. Its HTTP 503 leaves a
   pending claim; retry again cannot complete it. This demonstrates misrouting
   and partial state; no paid provider is contacted or real delivery attempted.
3. A rejected claim resubmits with HTTP 200 but bypasses cold-start routing and
   creates no applicant occupancy. The response claims resubmission while the
   admission path remains incomplete.
4. A provisional private setup occupancy is reported as already a member and
   receives HTTP 400, although it has not established verified residency.

The exact ddc242 fixture namespace is cleaned after all four cases. No schema
migration, hosted operation, owner-data change, notification or postage occurred.
Evidence is private at `/private/tmp/pantopus-home-residency-submission-baseline-r2/`
and the matching `.log`. Initial r1 stopped during module setup before inserting
fixtures because its unused address-verdict import was incomplete; r2 corrects
that controlled boundary and runs the production route.

## Accepted backend command

The new `POST /api/homes/:id/residency-submissions`, status and cancellation
endpoints bind actor, Home, original request UUID, exact selected address/unit
snapshot and renter/household role. `check-address` adds that explicit snapshot
without exposing occupant identities. The SQL transaction locks the current Home
and review authority, then saves the claim, pending/private occupancy, audit and
original outcome together. Failed required writes roll back the entire command.
A cancellation tombstone fences a delayed submission; a committed result wins
later cancellation. Changed details cannot replace an existing request.

Current verified HomeOwner records count even without occupancy. Explicit denies,
minor ceilings, ownership restrictions and access dates stay in force. Removed,
expired and previously verified access is not reactivated. Rejected resubmission
uses the same routing and atomic writes, keeps existing occupancy values, and
retires prior pending postcard codes while preserving their dispatch evidence.
A second pending application never re-templates or renews the existing occupancy.

The original completed proof remains historical after review, address change or
Home deletion. It explicitly leaves current access unchecked. New commands fail
when the selected street or apartment changes, including during a row-lock wait.
This compares the exact selected Home snapshot, so legacy Homes need no canonical
ID backfill. It is a concurrency fence, not an address-normalization replacement.

The command records the next verification step and requests no postcard or
notification delivery. It never reports a letter sent or grants verified
residency/ownership. Service-only RLS commands keep UUID/hash/outcome fields, not
raw addresses, request bodies, postal secrets or provider credentials.

## Verification and private evidence

- Actual production route + local Supabase SDK/SQL r5 passes ordinary and lost
  reply recovery, changed-role/cross-account refusal, cancellation, current
  ownership without occupancy, late audit failure and original retry, rejected
  resubmission, private creator setup, child ceilings and no provider dispatch.
  The actual per-actor limiter throttles submissions while status/cancellation
  stay available and postcard allowance is untouched. Actual address lookup
  feeds the submitted snapshot; changed apartments reject
  without partial admission and require a fresh command after correction.
  Evidence: `/private/tmp/pantopus-home-residency-submission-http-r5/` and `.log`.
- Eleven observed database lock races pass in concurrency r2: duplicate UUID,
  both cancellation orderings, conflicting intent, current authority revocation,
  archival, removal, clock-based expiry, distinct commands for one application,
  changed street and changed apartment. Exact SQL and temporary schema are
  cleaned. Evidence: `/private/tmp/pantopus-home-residency-submission-concurrency-r2.log`.
- Portable SQL contract r3 passes service-only access, atomic rollback including
  old postal-code retirement, historical proof, unchanged occupancy/denies/dates,
  invalid input, selected-address fencing, current routing and deletion. Its
  generated pgTAP wrapper is committed with the other 45 wrappers. Evidence:
  `/private/tmp/pantopus-home-residency-submission-contract-r3.log`.
- Populated upgrade r3 preserves every row value/count across all 365 existing
  public/auth/storage tables. Targeted function lint reports zero issues. The
  entire migration/lint rehearsal rolls back; the real migration ledger remains
  unchanged. Evidence: `/private/tmp/pantopus-home-residency-submission-upgrade-r3.log`.
- Final backend regression r3 passes 317 suites / 5,170 checks with 16 skips.
  Final privacy r4 and web type gate r1 pass (zero type errors); the address lookup
  regression separately passes 22 checks. Evidence uses the private prefix
  `/private/tmp/pantopus-home-residency-submission-` with `backend-r3.log`,
  `privacy-r4.log`, `web-types-r1.log` and `address-regression-r1.log`.
- Migration policy and all 46 generated wrappers pass. Source inventories are
  41 Home / 21 paid / 50 combined with 12 identical shared migrations and no
  timestamp collision. Fresh full-schema CI and final combined adoption remain
  required; a populated rollback rehearsal does not replace them.

Earlier HTTP r1/r2 cache-setup failures, contract r1 fixture-role refusal and
upgrade r1 runner quoting error are preserved; corrected final runs pass. The
second privacy invocation used the wrong working directory and did not execute;
the corrected final fourth invocation is the applicable result. No permissions were
weakened to make fixtures pass. Temporary commands/functions and exact synthetic
rows are cleaned; existing review helpers, owner data and ledger are preserved.
No hosted migration, merge, device change, provider dispatch or paid activation.

## Remaining product work and next action

The legacy `/claim` route is deliberately unchanged during the additive rollout;
its four reproduced failures are not closed for existing clients. Replace each
client entry with protected original-command storage and recovery, then reconcile
the legacy compatibility path. Reconcile stale-authority/postcard paths with
the already accepted postcard admission/confirmation boundary; durable mail intent
and unknown delivery must stay distinguishable from claim/admission completion.
Keep provider dispatch and real delivery in the final paid launch bundle.

Then wire original-command recovery and first-use destinations across the browser
and both native clients, accept ordinary member/invitation flows and native
residency review, and continue the full backlog. Broader numeric/form validation,
address-change lifecycle, existing-Home optional setup and provider step-up UI
remain part of the continuing onboarding/UI audit.
