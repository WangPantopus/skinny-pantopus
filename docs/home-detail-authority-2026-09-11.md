# Home detail authority and pause checkpoint — September 11, 2026

Continuation of `42accb7325de9a5e0ea4604094a61dd89d78e182` on
`codex/home-permission-boundaries`. This is a bounded backend repair and a
requested session handoff. Neither Home nor payments nor launch is complete.

## Reproduction and resulting behavior

The actual production routes, Supabase SDK/PostgREST and owned local SQL showed
that frozen/archived Homes, revoked ownership and explicit `home.view` denial
still returned a full Home detail response, while `/dashboard-access` returned
403. `/my-homes`, `/primary` and the legacy root list also retained Home data
after expired/future/inactive access. The detail response included all five
occupants (four pending) and raw account names. These are separate findings;
this checkpoint repairs only the detail/property-detail authority boundary and
safe failure handling, not every list or identity projection.

Both detail routes now require current JavaScript and SQL Home authority before
reading shared data and after completing it. A delayed Home, ownership or
provider result cannot survive current revocation, freeze or an explicit denial.
Responses, including errors, use private/no-store. Invalid Home IDs return 400.
Missing, malformed or failed Home/ownership/claim reads return a typed, safe,
retryable error rather than fake empty data, raw error details or a false 404.
The property handler validates its provider result envelope and retains the
legitimate unavailable-property response. Deeper property-content validation,
provider-side cache writes and identity projections remain separate work.

## Actual verification

`test-home-detail-authority-http.cjs` uses actual production routes, IAM and RPCs
through the real local SDK; only authentication, provider responses and injected
post-query faults are controlled. Every real query resolves before the script
holds or corrupts its result. It accepts only the owned local project and loopback
API, never a hosted database or paid provider.

Final r2 passes:

- Current nested Home and unavailable-property responses, exact Home identity,
  no-store and invalid-ID handling.
- Actual minor-owner ceilings; legacy/v2 pending claim selection; failed,
  missing and interrupted claim reads with current recovery.
- Thirteen current authority changes on both routes: frozen/frozen-silent,
  archived/merged, revoked/disputed ownership, inactive/expired/future occupancy,
  pending residency and explicit `home.view` denial. Shared detail and provider
  queries do not run after initial denial. Every case has a positive recovery.
- Failed/missing/interrupted Home and ownership reads; malformed/failed provider
  results; safe typed errors and successful retries.
- Nine held produced Home/ownership/provider results across revocation, freeze
  and explicit deny; none returns shared data after the authority change.
- Exact fixture SQL cleanup; the fixed ddc236 namespace is free.

Private evidence: `/private/tmp/pantopus-home-identity-baseline-r1.log`,
`/private/tmp/pantopus-home-detail-authority-http-r{1,2}.log`,
`/private/tmp/pantopus-home-detail-privacy-r1.log` (all gates pass), and
`/private/tmp/pantopus-home-detail-backend-r3.log` (final regression: 317 suites /
5,169 checks pass, 16 existing skips, 70.326 seconds on Node 20). The first regression had one existing minor-
owner route fixture missing the newly required SQL context and owner row ID;
its focused assertion is preserved with a valid context fixture. Claim-read
flag tests also retain their narrow purpose after current admission. The real
SDK run separately verifies both minor authority and claim behavior.
An intermediate r2 regression was stopped after a wrong-working-directory edit
failed and left its fixture unchanged; it is not a passing run or an app defect.

No schema migration, native build, paid call, hosted mutation or deployment is
included. Existing installed iOS/Android evidence belongs to `42accb732` and its
predecessors; this route repair does not claim new native UI acceptance.

## Exact continuation

Read [the remaining-work inventory](REMAINING_WORK_2026-09-11.md) and the latest
handoff first. Continue H02-H08: list/primary/root current access and truthful
roles/deletion eligibility, safe per-field/member identity projection, separate
Home/residency/ownership verification, and real create/join/invite defaults and
private first use. Then native residency and the remaining ordered inventory.
Keep the observed checklist/health lag (I01), deeper provider/record/settings/
privacy paths and all payment, integration and launch work open.

#32 and #34 remain drafts; #34 conflicts with master and has an unwired tip draft.
The source union is 38 Home / 21 payment / 47 distinct migration versions before
any new tip migration. Combined replay/dependency reconciliation and final-head
CI remain mandatory before merging. All paid services remain one final bundle.
