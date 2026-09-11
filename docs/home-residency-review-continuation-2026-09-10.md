# Residency review continuation — September 10, 2026

This is the original source audit for the residency slice. The September 11
[backend receipt milestone](home-residency-review-receipts-2026-09-11.md) now completes
prepared HTTP/service/SQL receipts and recovery; browser/native integration and
submission/cold-start/resubmission remain unfinished. It preserves the existing transactional
admission report and does not replace invitation/evidence/relationship work.

## Findings to resolve

1. `review_home_residency` commits membership/claim/audit together and checks
   current authority, but its retries infer identity from reviewed actor and
   current claim status. There is no durable original request/receipt binding.
   A rejection retried after resubmission can act on the new pending claim; a
   changed rejection reason can be acknowledged as the old rejection. Approval
   recovery after removal is safely denied but cannot show its historical result
   separately from the now-inactive membership.
2. The approval/rejection HTTP routes discard replay metadata. Current web/iOS/
   Android review controls send immediate commands and show transient toasts;
   they retain neither the reviewed snapshot nor the original across restarts.
   New receipts must keep original outcomes separate from current membership and
   must never reactivate, re-template, renew dates or replay notifications.
3. There are two browser residency surfaces: the owners review page and
   `ResidencyClaimsPanel` used by the household members page. Cover both. The
   latter treats failed loading as no claims and its rejection prompt currently
   sends a rejection even when Cancel returns null. Fix and exercise cancellation,
   denied/loading states, keyboard interaction and recovery in the actual UI.
4. Legacy `POST /api/homes/:id/claim` still separately inserts/resubmits a claim,
   counts authority, applies occupancy templates, requests postcards and updates
   routing. Rejected resubmissions skip the original cold-start routing. This
   needs a distinct transactional submission/cold-start/resubmission slice, with
   role/age/date/ownership preservation and explicit recoverable provider intent.
   Do not enable paid mail while preparing it.
5. Residency passes/letters (`residencyClaimService`) are a different feature
   from household admission (`HomeResidencyClaim`). Keep their issue/view/revoke
   and current public-verification gates in the wider inventory; do not mistake
   one feature's acceptance for the other.

## Next implementation and acceptance

Start with additive, service-only residency review receipts and current prepared
review. Bind actor/Home/exact claim/action/role or reason/request UUID to the
reviewed claim and target membership state. Legacy retries must safely recover
one historical intent, not silently authorize a new resubmission. Check today's
ordinary authority before exposing either current state or saved results. Keep
existing admission ceilings, restrictions and rollback guarantees.

Run production HTTP/service/PostgreSQL loss/retry, changed command, stale review,
resubmission, later removal, authority revocation, conflicting decisions and
final-receipt/audit failure. Demonstrate real locking races, refresh all schema
contracts and deletion dependencies, then fresh replay and populated preservation.
Follow with both browser entries and installed iOS/Android prepared review and
protected cold recovery. Verify actual UI and state transitions, not coverage
percentages. Claim submission/cold-start/resubmission, ownership/lease/resource
work and the broader handoff backlog remain afterward.

PRs #32/#34 stay drafts until their complete scopes and migration dependencies
are reconciled. All paid dependencies stay one final launch-preparation bundle.

## Backend checkpoint — September 11

The additive `20260910233000_home_residency_review_receipts.sql`, service and HTTP
routes now pass the actual behavior and schema gates in the linked report.
The committed Home set becomes 35 migrations and the eventual combined Home/paid
set 44 distinct versions. Browser/native review recovery and submission remain
next; the original findings above are retained to keep their full scope visible.
