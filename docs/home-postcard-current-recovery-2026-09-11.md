# Home postal verification — current recovery work

Updated September 12, 2026. Backend request/status recovery is accepted within
the local evidence below, following personal residency milestone `edf907108`.
Code confirmation and browser/native postal journeys remain open. Keep retained
requests, provider acceptance, physical delivery, code verification and current
Home access separate.

## Actual baseline

`scripts/db/test-home-postcard-current-baseline.cjs` uses production Home
ownership/postal/personal-progress routes, actual local Supabase SDK/PostgREST
and SQL. Only authentication, provider and notification boundaries are
controlled; it never sends a postcard or notification. The corrected baseline
passes in `/private/tmp/pantopus-home-postcard-current-baseline-r2/` and its
adjacent log, reproducing:

- An uncertain provider result retains one pending proof and a retry does not
  resend. Preserve this behavior. The existing status route lacks private/no-store.
- Code confirmation can return HTTP 200 with provisional residency and no
  current household access. The old browser screen nevertheless announces a
  verified membership and navigates directly to a shared destination.
- A request containing the applicant's selected apartment is ignored; the
  provider boundary receives the Home's subsequently changed apartment.
- An archived Home reaches both dispatch and confirmation.
- An occupancy whose start is in the future reaches dispatch and changes its
  verification record after code entry.

Private SQL snapshots retain the exact proof/occupancy/claim states. Raw codes
stay in the test process; serialized provider observations omit them. Exact
synthetic Home/user/receipt cleanup passes; existing schema and the migration
ledger are unchanged. The first attempt failed at fixture module setup because
a nested service's database import was not intercepted; no fixtures were created.
Both attempts and accepted evidence remain preserved.

## Accepted backend request/status milestone

New `postcard-requests` submit/read/cancel routes retain the actor, original UUID
and exact six-field mailing address. Admission atomically saves a request, postal
proof and audit. A cancelled-before-arrival UUID fences delayed submission;
already admitted mail cannot be recalled by claiming cancellation. A new UUID
can explicitly reconfirm a changed unit and retire the incompatible old code
without erasing its original destination or transport receipt. SQL serializes
actual per-address and per-user postal budgets; HTTP recovery has a separate
30-per-15-minute actor budget. Read/cancel do not consume that submission budget.

Dispatch uses the current Home/review lock scope, then checks the current clock,
own occupancy and ownership restrictions and exact confirmed address. Only one
worker may claim dispatch. Archived/merged/frozen/disputed Homes, future or ended
access, rejected residency and ownership records cannot reach new dispatch.
There are no membership, claim, date, age or permission changes in this scope.
A status read never sends mail. All new routes and legacy postal responses use
private/no-store, including authentication/validation failures at these routes.

`postcard-status` reports own safe metadata and separates not-started, provider
acceptance, uncertain transport and definite refusal. It returns an address only
when the caller's own completed command hash binds that historical input; it
never substitutes the current private Home address. Cross-actor reads fail.
The current capability checks are separate from historical command completion
and do not assert current household access. A code whose recoverable dispatch
has not started is not presented as ready for verification.

A dedicated versioned HMAC key derives the same six-digit code after a process
restart, without storing plaintext. Original cards retain their key version.
Missing/rotated-away keys preserve a saved command; they do not rotate a code or
resend uncertain mail. Lost dispatch-claim replies stay uncertain. Receipt-write
failure preserves proof; the existing signed-webhook boundary can reconcile
provider acceptance. Definite refusal permits an explicit new request. A late
receipt does not overwrite known acceptance or undo verified/retired proof.
Legacy pending proofs retain their original unknown transport and are not resent.

### Verification and evidence

- Production HTTP/routes/service → actual Supabase SDK/PostgREST/SQL acceptance:
  `/private/tmp/pantopus-home-postcard-request-http-r2/` and adjacent log. Original
  lost-reply recovery, key-version changes/missing keys, cancellation, private
  address binding, restricted current access, eight simultaneous original-command
  retries, uncertain dispatch, lost receipt, webhook reconciliation, malformed
  status/retry, definite refusal/correction, and late-write rollback all pass.
  Provider and notification boundaries are controlled: no real mail/messages.
- Eleven observed database lock races pass in
  `/private/tmp/pantopus-home-postcard-request-concurrency-r1.log`: duplicate
  admission/dispatch, cancel-before-arrival, changed unit, archived Home, removal,
  expiry after waiting, rejection, shared pending proof and changed intent.
- Portable SQL policy/admission/status/dispatch/receipt/budget/privacy contract
  passes in `/private/tmp/pantopus-home-postcard-current-policy-r7.log`. The
  committed pgTAP wrapper is generated from that contract (47 wrappers total).
- Populated upgrade rehearsal preserves every value in 365 public/auth/storage
  tables and reports zero function lint issues:
  `/private/tmp/pantopus-home-postcard-request-upgrade-r2.log`.
- Full backend regression: 317 suites / 5,170 passed / 16 skipped, 71.2 seconds:
  `/private/tmp/pantopus-home-postcard-request-backend-r3.log`. The earlier full
  run hit a five-second device-auth timeout and a subsequent HTTP parse failure;
  that suite passes alone (30 checks, `auth-r1`) and in the complete rerun.
  Initial backend/types launch attempts invoked package shell wrappers as JS;
  they did not execute checks and are superseded by the corrected invocations.
- Browser SDK types (`types-r2`) and all privacy gates (`privacy-r1`) pass.
  Prefix for those logs: `/private/tmp/pantopus-home-postcard-request-`.
- Every exact HTTP/race fixture and temporary table/function is cleaned. Upgrade
  and contract rehearsals roll back. The existing migration ledger is unchanged.
  Source inventories are 42 Home / 21 paid / 51 combined, with 12 identical shared
  migrations and no timestamp collision (`migration-inventory-r2.json`). The
  first inventory measured only additions beyond master (30/9/39), not totals.
  Combined replay/adoption and pushed-head full-schema CI remain separate gates.

### Final launch configuration

Include `HOME_POSTCARD_CODE_KEYS_JSON` (at most eight named base64 32-byte keys)
and `HOME_POSTCARD_CODE_ACTIVE_KEY` in the existing final launch bundle. These
are dedicated verification-code keys, never shared service/JWT credentials.
Keep each old key until every associated pending card no longer needs initial
dispatch. No real key was generated/configured and no paid service was activated.
The locally tested key material is synthetic and absent from reports/output.
The migration is additive; old clients keep their previous API behavior, with
private/no-store added. That compatibility does not certify their known postal
admission/confirmation gaps as fixed.

## Work to complete

Next, bind code confirmation to its exact postcard and retained verification
attempt. Recheck current authority under the same locks; preserve age, dates,
explicit denies and existing review/challenge timestamps. A postal code must not
restore ended access, grant ownership or turn a historical receipt into current
Home access. Retire the legacy unsafe paths after native/version compatibility
acceptance. New request/status APIs alone do not close R02.

The browser must read status on entry, distinguish no request from a failed
read, show uncertain delivery without resending, and recheck current personal
access after code acceptance. Its saved request must survive restart/lost replies;
errors must permit useful recovery. Native clients and old/new version behavior
remain part of R02 acceptance. Do not certify physical delivery from a provider
receipt or local controlled transport. Keep all paid activation in the final
launch bundle.

The previous browser joining milestone `92c4d8072` now has **all** CI jobs green
in [run 34676301600](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34676301600).
Personal status `edf907108` is pushed; its CI is
[run 34677751286](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34677751286).
All of its jobs, including native platforms and fresh database replay, now pass. #32/#34 remain unfinished drafts;
no merge, hosted release, physical-device change or paid activation has occurred.
