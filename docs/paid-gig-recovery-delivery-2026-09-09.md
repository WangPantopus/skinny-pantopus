# Paid-gig recovery and delivery — September 9, 2026

This source checkpoint follows backend `fa3a70a43` / `15754b439` and the
[web recovery checkpoint](paid-gig-web-recovery-2026-09-09.md) at `68cb112a4`.
The coordinator confirmed PR #31 merged after all final-head checks, with master
`d7be416b872a31ceb53094d7d19c3f114185831f`. Integrate that master after this frozen
backend checkpoint is committed. No paid-gig provider call, hosted migration,
production change or new role grant ran during this work.

## Unknown provider outcomes and checkout proof

[Stripe recovery](../backend/stripe/stripeService.js) lists PaymentIntents only
under the payer's durable customer and exact acceptance-attempt metadata. It
checks complete bounded pagination, rejects multiple candidates, then retrieves
the sole candidate again to verify payer, worker, gig, amount, currency, manual
capture, operation and fee terms. Only a persisted matching Payment can bind to
the operation. A lost local insert or bind response recovers the same provider
identity. List absence never permits creation after the conservative ten-minute
same-operation retry window; an incomplete/error response never permits creation.

The [reconciliation job](../backend/jobs/reconcileGigAcceptance.js) only discovers
and binds existing objects. It cannot create, cancel, confirm or assign anything.
Unknown/ambiguous outcomes remain visible on the service-owned operation, with a
fifteen-minute retry interval. The owner can also resume or abort the exact bid;
abort recovers an unbound known intent before requesting cancellation. An absent
provider proof leaves the original operation intact.

Accept responses include `authorizationReady`, `paymentStatus`, `providerStatus`,
`amountCents` and `currency`. Readiness requires current exact provider proof and
a saved authorized state. Ready responses omit the client secret and unnecessary
saved-card ephemeral-key setup. Unconfirmed responses return the same intent and
its durable amount; stale pre-reservation bid snapshots cannot become display
terms. The legacy retry route and service reject replacement of an
operation-backed PaymentIntent.

## Atomic assignment and delivery

The [additive migration](../supabase/migrations/20260910030000_paid_gig_recovery_delivery.sql)
materializes the chat room, payer/worker participants, one acceptance message and
stored worker/standby/onboarding notifications inside the assignment transaction.
Notification failure rolls back assignment and chat together. A lost HTTP
response returns the same receipt; repeated finalization does not recreate a
deleted notification or reactivate a departed chat participant. Existing rooms,
including historical duplicates, remain intact. Existing accepted operations
can repair chat on explicit retry without replaying historical notifications.
Exact private addresses are read through the gig's existing access boundary;
the new acceptance message and notification contain no copied street address.

Current HTTP acceptance, binding, finalization and cancellation use actor-aware
service RPCs. Their business permission decision preserves the existing
`gigs.manage` or `gigs.post` policy and briefly locks its membership, override and
role-policy inputs, including absent deny rows. A committed revocation observed
after a wait denies the transition. A second actor check after provider access
prevents a revoked delegate receiving the recovered checkout secret. Original
service-only primitives remain compatible for trusted internal reconciliation;
no end-user role receives new execution rights.

The [delivery relay](../backend/jobs/deliverGigAcceptance.js) claims a single
leased event at a time and rechecks the current assignment, recipient's live
bid/chat participation, notification existence, onboarding state, global push
setting, gig preference and currently registered tokens. Suppressed events stay
suppressed after later opt-in. Lease identity fences acknowledgements. Unknown,
partial or unconfigured transport results remain retryable under the same stored
notification ID. Push is **at least once**: a provider success followed by a lost
acknowledgement can produce a duplicate device alert. SQL stores exactly one
in-app event; the code does not claim exactly-once external delivery.

Both existing scheduling systems register the reconciliation and delivery jobs,
with the existing pg-boss/cron mutual-exclusion mechanism. No job was run against
a real provider during these checks.

## Verification and remaining gates

- Full backend: **4,730 passing tests, 16 existing skips**. Focused exact-proof,
  real HTTP route, actor, recovery and relay cases: **128 passing**.
- Repository privacy gates pass after permitting the mocked local HTTP listener;
  the initial sandbox-only listener error was not an assertion failure.
- Fresh chronological canonical replay: **20 SQL contracts** pass. Application
  function lint: **zero errors**, three existing warnings, 151 functions and
  78 trigger bindings. Generated wrappers and migration policy checks pass.
- [Real SQL delivery contract](../scripts/db/contracts/paid-gig-delivery.sql)
  covers revoked/denied business actors, notification failure rollback, exact
  receipt replay, lease identity and actual authenticated-role denial.
- [Concurrency harness](../scripts/db/test-paid-gig-concurrency.cjs): **56 local
  PostgreSQL connections** exercise competing acceptance/cancel/capture,
  revocation while finalization waits, unique event leases and stale-lease
  denial, plus deleted-notification/departed-participant preservation.
- A whole-migration rehearsal on synthetic populated prior-checkpoint records
  preserves every original Gig, Bid, Payment and acceptance value and both
  historical duplicate chat rooms. It rolls back all synthetic changes. Local
  concurrency fixtures are deleted by exact IDs, including public profiles.

Backend source and local SQL evidence do not complete native SDK acceptance,
real provider notifications, historical assigned off-session renewal (including
holds that expire before future work), payer refund receipts, wallet settlement
or Connect withdrawal. Those are subsequent gates before claiming the complete
paid-gig journey. Ambiguous/missing old provider outcomes remain conservatively
unresolved; the software never manufactures a replacement charge to clear them.
