# Native saved-card recovery — September 9, 2026

Work is isolated in `/private/tmp/pantopus-staging-payment-sheet`, branch
`codex/staging-payment-sheet`, initially from master `2259b8ee9`. No provider
calls, live payment fixtures or deployments have run for this milestone yet.

## Owned setup and durable reconciliation checkpoint

The native Payments screen previously displayed Stripe's setup flow and then
refreshed a local list once. A delayed/missing attachment callback left the card
absent, and database persistence failures were acknowledged to Stripe as success.

Preparation now returns the SetupIntent's non-secret identifier and status. An
optional identifier resumes that exact owned `mobile_add_card` setup without
creating a replacement customer/setup on an unknown response. Incomplete setups
can resume the SDK with a refreshed ephemeral key; processing is rechecked;
successful setups proceed directly to reconciliation. Foreign/canceled/missing
proof is denied.

The authenticated confirmation endpoint verifies the provider's successful setup,
exact account/customer/source and currently attached card before returning its
durable local record. A removed method cannot be reattached by this endpoint.
Attachment webhooks share the retryable save path; database/event-ledger failures
return failure so delivery can be retried. Same-card concurrent requests converge
on the unique provider method row.

Backend validation: 57 focused tests, all 4,548 backend tests (16 skipped) and
privacy gates pass on the initial branch baseline. This count precedes integration
of PR #29's additional mail tests. Native account/origin-scoped persistence,
same-setup recovery after navigation/restart, terminal-denial handling and stale
UI response guards are being verified separately before their commit. The first
iOS recovery run passed 33 focused tests; a final reverse-order action guard and
Android verification remained in progress at that backend-only checkpoint.

## iOS recovery checkpoint

The branch now includes merged master `3009eb0be` through merge `98dbc77d0`.
iOS persists only the non-secret setup identifier, scoped to the signed-in
account and API origin, before presenting Stripe. Returning to Payments or
restarting the app resumes that setup; processing and retryable confirmation
failures keep recovery available. Terminal missing/foreign proof is cleared
with an accurate message. A fresh successful card list wins over the receipt,
while a failed refresh preserves the confirmed saved card.

Add, default and removal actions cannot overlap. Account and request-generation
checks prevent a delayed list or failed optimistic action from replacing a newer
screen state. All 36 focused iOS tests pass (13 recovery, 8 save, 15 existing),
with strict SwiftLint, SwiftFormat and whitespace checks passing. These tests
used explicit localhost API/socket settings and do not certify a live Stripe
SDK journey.

## Android recovery checkpoint

Android implements the same account/origin-scoped durable setup recovery and
confirmation contract, including restored SDK activity results and failed
persistence/clear handling. The list, optimistic row actions and setup flow
share mutual action guards and account/generation checks. All 49 focused tests
pass (20 existing view-model, 19 recovery, 5 DTO, 5 persistence), with
ktlintFormat, ktlintCheck, Detekt and main/test compilation passing. Combined
native coverage is 85 passing focused tests. A read-only review found no
request/response mismatch between either client and the current backend.

Both native source milestones are pushed (`3afbf043d` iOS, `6d322b1df` Android).
The explicit opt-in iOS live-test harness now compiles and passes strict lint
and formatting. It covers SDK cancellation, same-setup recovery after restart,
two saved cards, default selection, cold restart, removal cancellation, fallback
default and empty state through the real UI. Actual provider calls and simulator
UI acceptance have not run yet. Ordinary CI skips these disposable staging actions.

## Atomic default/removal and customer-binding checkpoint

Review reproduced an existing stale-default race: an old retry reads card A as
default, another device selects B, then the old retry overwrites the provider's
invoice default back to A while the local preference remains B. Another read or
a time-limited job lock would not safely order a delayed external write.

The implementation makes the app's saved-card preference atomic
under the user's database row lock, preserving a newer explicit choice across
retries and first-card races. It fences removed provider methods with durable
removal records and revokes authenticated direct table mutations that bypass the
service protocol. Explicit checkout-selected cards and existing authorizations
remain authoritative. Stripe invoice-default mirroring is removed because
the current payment workflows do not use it as their charge source. This is a
locally verified implementation; hosted application and acceptance remain next.

Local verification also exposed a first-customer race and a direct authenticated
write to the Stripe customer binding. The database milestone now includes a
compare-and-set customer binding and a narrow guard against client changes to
that binding. Two first-use requests return the durable winning customer before
preparing a setup. Real authenticated SQL roles cannot insert, change or clear
the binding; ordinary NULL-binding signup and profile editing still work.

All 73 focused backend tests and the complete 4,607-test backend suite pass
(16 skipped), together with privacy checks. All 18 SQL contracts and the generated
pgTAP payment wrapper pass. The committed concurrency runner exercises 32
PostgreSQL connections: customer binding, first cards, explicit default, delayed
save, removal, early detach, transaction rollback, five-second lock timeout and
successful retry. Function lint reports zero errors across 130 application
functions and 74 trigger bindings, with three existing warnings.

A separate populated disposable clone proves whole-migration rollback restores
DDL/grants. Successful application preserves every fixture User/card field
except the deterministically cleared duplicate-default flag, including accounts
with false/NULL flags and no default. No cards are deleted by normalization.
Final local database: `payment_method_upgrade_contract`.

Remaining limit: an unknown provider customer-create response can leave an
unused extra Stripe customer. The CAS prevents returning an uncommitted customer
or binding a setup to the losing candidate; it does not atomically delete provider
history. Free staging's read-only preflight found zero duplicate customer bindings
and zero duplicate card defaults. No hosted migration or provider call has run
for that local checkpoint.

## Free staging candidate checkpoint

[PR #31](https://github.com/WangPantopus/skinny-pantopus/pull/31) is draft at
`2e7b04293db851b60414983246503e914bbf95d2`, including PR #30's checked master
merge. Its full CI runs separately from local verification. Backend milestone
`034148e6b` and both native milestones are committed and pushed.

The payment migration was applied only to Free staging `ptudkfqdhqpkbkzqlabu`:
SHA-256 `a078f13d374c4e648385c95596b103de7f6093d44a7a14ff06e888cc1fb85380`.
Before/after fingerprints preserve existing User, PaymentMethod, Payment, mail,
Home, file, document and quota records, plus the absent hosted migration ledger.
No duplicate defaults required normalization on this hosted application.

The loopback-only private candidate is healthy at source `2e7b04293`, image
`sha256:2e0a32e8b0e2caa849a28b3e401d0a37c0d9b6b8a50fd63a8608f994ce486d08`.
The prior `68e3e052a578` candidate is retained stopped as
`pantopus-home-documents-candidate-before-payment-sheet`. Public API/worker,
browser API/web and production container identities remain unchanged.

Two fresh synthetic actors have push disabled, no device tokens and initially
empty saved cards. Stripe test mode is verified; actor setup created no setup
intent or charge. Real iOS/Android simulator UI acceptance is now active through
the localhost tunnel. Do not rerun the applied migration or actor initializer.
Private operator runners retain progress and exact fixture identities.

Next finish actual Stripe SDK/test-mode add/cancel/default/remove and cold-start journeys on
both simulators, test recovery and foreign proof denial, verify no charge was
created, and clean exact test cards/customers/sessions. Source tests do not certify
PaymentSheet delivery or externally delivered callbacks. Production finance,
Connect/payouts, charges/refunds and release rollout remain separate gates.

## Android native acceptance and iOS accessibility checkpoint

The Android localhost build from committed recovery source passes the real Stripe
SDK journey: normal login, cancel, cold restart with the same pending setup,
Visa and Mastercard save, second-card default, cold persisted default, cancelled
removal, default fallback, both removals and normal logout. The private driver
was reconciled at observed UI boundaries when SDK labels differed; no completed
card setup was blindly replayed.

Provider/API verification confirms exactly two successful owned test-mode setups,
zero attached cards, two completed removal proofs, rejection of foreign and
removed setup proofs, zero charges/PaymentIntents/payment rows, zero push tokens
and preserved original document IDs. Authenticated client customer-binding
changes are rejected and removal proofs remain service-only. Exact customer and
session cleanup waits for both platforms; do not rerun Android UI acceptance.

The iOS simulator's native identity check now succeeds after simulated Face ID
enrollment and matching authentication. It exposed accessibility identifiers
inherited from the Settings/payment card containers, hiding their child controls
from XCTest. Explicit accessibility containment preserves those controls and
screen grouping. Strict SwiftLint/SwiftFormat and the test build pass. The actual
iOS SDK card journey is still pending, and final current-head CI is required.

The follow-up UI harness now locates the actual Add control after the native
identity gate and checks the saved row's announced default state. Exported live
accessibility hierarchy confirms the contained card controls retain their exact
identifiers; the outer Settings wrapper still names the enclosing screen.
This avoids relying on a wrapper identifier or a badge hidden inside a button.
The rebuilt opt-in harness and strict lint/format checks pass; live iOS acceptance
is continuing from the still-empty actor. Android exact PostgREST denials were
also verified as permission-denied errors, not generic request failures.

## iOS first-card checkpoint

Real iOS SDK cancellation, retry persistence across cold launch and successful
Visa setup now pass. Provider reconciliation proves exactly one successful owned
setup and one attached default Visa, with no charges. A later test query exposed
SwiftUI combining inherited child identifiers into an invalid saved-row identifier.
The stable identifier is now attached directly to the saved-card button.

The rebuilt harness resumes only from the privately reconciled single-card
checkpoint; it does not repeat successful setup or treat a partial run as full
acceptance. It still must prove second-card setup/default/restart/removal/logout,
then complete API/provider checks and exact cleanup. Strict lint/format and the
new test build pass. Android remains complete and must not be replayed.

## Completed native acceptance and exact cleanup

Both platforms now pass real Stripe test-mode SDK setup and app reconciliation:

| Check | iOS simulator | Android emulator |
| --- | --- | --- |
| Normal login and logout | Pass | Pass |
| Cancel, cold launch, resume the same setup | Pass | Pass |
| Save Visa and Mastercard through Stripe UI | Pass | Pass |
| Select second-card default and cold persistence | Pass | Pass |
| Cancel removal, remove default, fallback to first card | Pass | Pass |
| Remove final card and show empty state | Pass | Pass |

The iOS first-card run and final resumed run are joined by exact provider/API
reconciliation. Its final opt-in test passes in 185.993 seconds; no successful
card setup was replayed while repairing test selectors. The Stripe saved-card
picker is addressed by its `+ Add` identifier (its label is “Add new payment
method”). The final Back action targets the Payments bar, preserving the normal
Settings logout path. Android's ten-stage private driver likewise retains exact
checkpoints. This is simulator evidence, not physical-device payment certification.

For each actor, independent provider/API checks prove exactly two successful
owned setups, exactly two distinct removed cards and completed removal proofs.
Foreign prepare/confirm and removed-proof reuse return 404. Real authenticated
PostgREST calls cannot forge or clear the durable customer binding (42501), and
removal records remain service-only. No PaymentIntent, charge or Payment row was
created. There are zero push tokens, and the original Home document IDs match.

Exact cleanup passes: both test customers are deleted, cards remain detached,
only the fixture removal proofs are removed, and customer bindings are cleared.
Normal UI logout completed. Historical operator sessions were also revoked via
password step-up and global logout for the exact disposable accounts. All fixture
sessions are revoked and original documents are preserved. Provider test history
is retained; do not rerun these actors, SDK setups, publishers or cleanup.

Native application source includes `9fbf548bf`; the final selector corrections
are test-only. The private API remains `2e7b04293` / `2e0a32e8b0e2`. Strict
lint/format and build pass, as do the existing 85 focused native tests, 4,607
backend tests (16 skipped), privacy gates, 18 SQL contracts and 32-connection
transaction checks. Final current-head CI is required before PR #31 integration.

Paid-gig authorization/capture/refund, Connect/payouts, broader native identity
failure handling and integrated release acceptance remain separate work. Source
review found the pre-existing sensitive-screen guard treats invalid capability
like an absent credential; that requires a dedicated failure-path repair before
release. These completed normal-path simulator checks do not certify that branch.
