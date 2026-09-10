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
Android verification remain in progress at this backend-only checkpoint.

## Required default/removal repair before acceptance

Review reproduced an existing stale-default race: an old retry reads card A as
default, another device selects B, then the old retry overwrites the provider's
invoice default back to A while the local preference remains B. Another read or
a time-limited job lock would not safely order a delayed external write.

The next approved implementation makes the app's saved-card preference atomic
under the user's database row lock, preserving a newer explicit choice across
retries and first-card races. It will fence removed provider methods with durable
removal records and revoke authenticated direct table mutations that bypass the
service protocol. Explicit checkout-selected cards and existing authorizations
remain authoritative. Stripe invoice-default mirroring is to be removed because
the current payment workflows do not use it as their charge source. This is a
design decision awaiting implementation and real SQL/API verification, not a
completed guarantee.

After source integration and checks: refresh the private staging candidate, run
actual Stripe SDK/test-mode add/cancel/default/remove and cold-start journeys on
both simulators, test recovery and foreign proof denial, verify no charge was
created, and clean exact test cards/customers/sessions. Source tests do not certify
PaymentSheet delivery or externally delivered callbacks. Production finance,
Connect/payouts, charges/refunds and release rollout remain separate gates.
