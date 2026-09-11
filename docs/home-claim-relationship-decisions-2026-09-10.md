# Recoverable Home claimant relationship decisions — September 10

Declining a claimant relationship and flagging an unknown claimant now commit
through one production database transaction: current authority, exact reviewed
claim/evidence snapshot, mutation, receipt and audit. A lost response recovers
the original decision and returns today's claim without undoing later changes.
This is a backend checkpoint. Explicit prepared review, protected original
storage, receipt presentation and cold recovery on web/iOS/Android remain next.
Existing invitation and evidence transactions remain in place.

## Behavior and compatibility

`POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship` accepts the
existing `action` and optional `note`, with optional paired `request_id` UUID and
`review_token` (64 lowercase hex characters) for decline/flag. Invitation requests
continue through the existing merge service and do not accept those new fields.
The displayed token comes from the current authorized claim review projection.

- A new explicit decision requires the displayed snapshot still to match.
  Reusing the original UUID with different action, note or token conflicts.
  An identical retry returns the original receipt plus the current claim.
- Legacy clients have no persisted command ID. Identical actor/Home/claim/action/
  normalized-note requests are one historical intent, even after the claim
  changes. A deliberately new decision requires a new explicit UUID and current
  token. This compatibility fallback does not claim safe prepared client recovery.
- Current ordinary adult household authority is required before a new decision
  **and before receipt recovery**. Revocation, current access windows, explicit
  denies, revoked ownership proof, private bootstrap and frozen/disputed Home
  checks run under the existing Home/claim authority locks. Platform admin status
  and old owner pointers do not bypass them. Self-review is denied.
- Decline records a receipt/audit only. The claim continues independently; it
  does not reject evidence, remove a member or revoke an invitation.
- Flag records challenge routing. Only evidence accepted by the existing trusted
  provider/private-inspection predicate establishes strength. Pending uploads,
  filenames and legacy verified labels with untrusted references do not create
  a property dispute. Qualifying owner evidence enters challenged review;
  weaker/untrusted evidence enters admin review. Already challenged claims need
  the separate dispute flow.
- No identity approval, ownership grant, membership change, evidence verdict,
  security freeze or external notification is performed. Recovery cannot repeat
  mutation or audit. Receipt reads expose no evidence reference or private note.
- Known denials/conflicts have typed 400/403/404/409 codes. An uncertain transport
  or malformed result is 503 and asks the caller to retain/retry the original.

## Findings resolved

The old route checked authority, updated claim/Home and wrote audit separately;
an intervening revocation or failed audit could leave an inconsistent result.
It also derived dispute strength with `includeUnverified: true`. A pending deed
could therefore escalate an unknown-person flag to a property dispute. The new
transaction fixes both boundaries and covers lost committed responses.

The complete SQL deletion contract caught a missing dependency after adding the
receipt table. The final additive migration includes the current Home deletion
policy with this receipt classified as established household history, preserving
all existing task-publication, financial, storage and private-setup boundaries.
No older migration was edited. Home now has 34 migrations; with paid #34's 21,
the inventory has 43 distinct versions. Final combined dependency reconciliation
and fresh/populated replay are still required before integration.

## Actual verification

- [HTTP driver](../scripts/db/test-home-claim-relationship-http.cjs): actual
  Express/Joi route, production service and PostgreSQL pass feature-off and bad
  request denial, lost committed response, legacy exact recovery, current later
  rejection, explicit uppercase UUID normalization, trusted flag receipt,
  conflicting intent and revoked/restored authority. Exact fixtures are cleaned.
  Identity/configuration are synthetic; this is not browser or provider proof.
- [Concurrency driver](../scripts/db/test-home-claim-relationship-concurrency.py):
  12 observed PostgreSQL lock waits pass duplicate/conflicting submissions,
  reviewer/proof revocation, explicit deny, changed evidence, frozen Home,
  withdrawn claim, teen reviewer, access expiring while blocked, later rejection
  during recovery and private-bootstrap denial. Exact resulting state, one
  receipt/audit where applicable, and exact cleanup are asserted.
- [SQL contract](../scripts/db/contracts/home-claim-relationship-decisions.sql):
  service-only table/RPC access, stale snapshots, normalized legacy retries,
  untrusted evidence, trusted evidence, current receipt projection, atomic audit
  failure rollback and preservation of evidence/membership/proof fields pass.
- Final pinned Supabase CLI **2.116.0** empty replay passes **34 migrations**.
  All **39 raw SQL contracts and 39 pgTAP wrappers pass** after the deletion
  dependency repair. Reviewed function lint passes **214 application functions
  and 84 trigger bindings**, with zero application errors. Six known stock
  extension diagnostics and existing warnings remain reviewed baseline items;
  the final gate reports 40 overall warnings and two known unattached triggers.
- [Populated upgrade](../scripts/db/test-home-claim-relationship-upgrade.py):
  final migration preserves every original field in **15,114 rows across 363
  public/auth/storage tables**, including synthetic historical evidence/audit.
  No old decision is backfilled into a new receipt. This is a local predecessor
  reconstruction and preservation rehearsal, not hosted migration adoption.
- All backend privacy gates and the full backend run pass: **317 passing suites,
  5,164 passing checks, 16 existing skips**. These support the actual workflow
  evidence; coverage percentages are not a completion criterion.

Private evidence is under `/private/tmp/pantopus-home-relationship-*`: HTTP/race
`r1`, SQL `r3`, fresh replay/raw SQL/pgTAP `r2`, final reviewed function lint,
final populated upgrade and full backend/privacy logs. Initial SQL driver issues
were fixture baseline restoration and temporary-table access; both were corrected.
The first full replay exposed the deletion dependency and failed that contract;
the final replay and all gates pass. Credentials, archives and raw operator logs
remain outside Git and chat.

## Continuation

Origin was fetched; the preceding Android head `05c678efe` is 50 commits ahead
of current master with none missing. Its required CI has passed all reported
jobs except Android lint/test/assemble, still running at this checkpoint in
[run 34557884984](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34557884984).
Refresh the new exact head independently. PR #32 stays draft; paid #34 at
`e9ef2decb` remains draft, green and unfinished. Preserve both branches' native
GigDetail and web CompletionFlow changes during eventual integration.

Exact relationship fixtures are cleaned. The fresh relationship replay project
is stopped with its backup retained; the existing owned Gig replay database
remains available for immediate browser acceptance. Native emulators/simulators
and acceptance listeners from the preceding milestone remain stopped. Owner
checkout changes and existing owner runtimes are preserved.

Next: browser prepared relationship review, encrypted original/confirmation
recovery and actual UI → production HTTP/SQL acceptance, followed by iOS/Android
parity. Then finish residency receipts, ownership transfer/challenge and lease/
resource cleanup, the remaining Home/Pulse/Beacon and platform/vendor workflows,
and final combined release rehearsals. All paid services remain in one final
launch-preparation bundle. No hosted migration, deployment or merge occurred.
