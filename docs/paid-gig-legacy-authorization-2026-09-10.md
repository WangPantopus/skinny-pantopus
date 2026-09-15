# Assigned payment authorization recovery — September 10, 2026

Historical assigned gigs now recover their exact existing authorization through
one backend service and protected database receipt. Retrying an authentication
challenge or an already authorized hold does not create a replacement intent.
The scheduler, owner retry/continue/status routes and authorization webhooks use
the same current-payment proof. New bid-acceptance operations remain on their
separate acceptance-recovery path.

`20260910110000_legacy_gig_authorization.sql` adds service-only
`GigLegacyAuthorization` history. Reservation, mutation leases and receipt writes
lock the current assigned Gig and Payment, verify the payer, worker, amount,
currency and actor permission, and reject captures, disputes, refunds or changed
assignment terms. Original payment amounts and fees remain unchanged. A canceled
provider intent can be replaced only after its exact terminal receipt; the old
operation remains in history. Direct changes to protected financial terms or
intent identity fail. No historical rows are backfilled during migration.

Provider requests use the durable operation's frozen parameters and key. Unknown
creation outcomes are searched within the exact customer's intents and operation
metadata, then retrieved again for proof. Multiple candidates or incomplete
discovery stop recovery. A missing historical failed-authorization intent can be
adopted only from unique matching payer/worker/gig proof. An unresolved old
failure remains `needs_review`; list absence does not authorize another hold.
Known operation retries cannot create beyond ten minutes from the first request.
Provider reads and exact receipt recovery remain available after that window.

The receipt carries a verification version, so a delayed response cannot
overwrite newer evidence. Reads cannot clear another request's active mutation
lease. A save failure or lost acknowledgement does not return readiness; the
next check retrieves the same intent and completes the same receipt. Stale
webhook payloads are reconciled against the provider's current state. Unchanged
status checks do not emit socket refreshes or change the Gig revision. Current
authorization changes still refresh viewers, and actionable webhook receipts
preserve payer attention notices without replaying unchanged events. A durable
cancellation marker prevents both SDK readiness and worker start
while cancellation is in flight or its outcome is unknown. Worker start and
cancellation admission serialize on the Gig and protected operation. Scheduled
cancellation changes the Gig only after current, exact canceled-provider proof;
a newly authorized hold is preserved.

## Client contract

Both `retry-authorization` and `continue-authorization` require
`expectedActorId`, `expectedSessionScope` and the displayed `expectedPaymentId`, `expectedPayerId`, `expectedPayeeId`, integer
`expectedAmountCents` and `currency: "usd"`. Missing/malformed terms return an actionable 400 before provider work. The
server compares the actor and opening session fingerprint before reservation;
account replacement or same-account session replacement returns
`SESSION_SCOPE_CHANGED`, even if the browser storage event has not arrived.
Registered-session token refresh preserves the fingerprint. Verified legacy
tokens use a digest and rotate conservatively. No credential or bearer-capable
identifier is returned. The shared helper and six tests are identical to the
Home session-boundary implementation. The values are rechecked after reservation,
lease and receipt operations. `refresh-payment-status` accepts an empty body and
only reads provider state and reconciles its receipt; it never creates or
confirms a provider intent.

Responses contain `gigId`, `paymentId`, `actorId`, `payerId`, `payeeId`,
`sessionScope`, `authorizationAttemptId`, nullable `paymentIntentId`, `amountCents`, `currency`,
`paymentStatus`, nullable `providerStatus`, `authorizationReady`,
`alreadyAuthorized`, `recoveryState`, `canRetry` an optional transient `clientSecret`, `cancellationPending` and nullable
`authorizationAvailableAt`. Fresh saved-card holds remain unavailable before
the scheduled start minus 24 hours; existing actionable intents remain resumable.
Only an exact durable `requires_capture` receipt is ready. SDK
states return a secret only when automatic confirmation is supported. Missing
secrets, processing and uncertain outcomes never imply success. Clients must
distinguish the signed-in actor from a business payer and verify both identities.

The existing business `gigs.manage`/`gigs.post` policy remains supported, with
current authority checked at transaction boundaries. The payment GET now admits
current business managers and rechecks its Gig binding and permission after
asynchronous reads. Worker reads retain provider-field redaction. No new role
defaults or grants are added.

## Verification

- **108 focused service, actual HTTP/webhook, scheduler and session checks pass**, including
  explicit expected terms, business actor/payer separation, worker redaction,
  stale webhook state, missing secrets, wrong provider amounts/customers,
  unknown outcomes, old attempts and retained canceled-intent replacement.
- The actual production service runs against real local PostgreSQL with a
  synthetic Stripe boundary: lost create response and lost database
  acknowledgement retain one intent, exact ready resume avoids another SDK
  setup, replacement retains history, simultaneous claims admit one lease, and
  lock-wait amount/owner/dispute changes stop mutation. Both cancellation/start
  orderings are exercised, including SDK completion while the provider cancel
  call is in flight. The harness uses **57 database connections**, then removes its exact synthetic fixtures.
- Fresh isolated replay passes **18 migrations, 24 raw SQL contracts and 24
  generated pgTAP wrappers**. Application SQL lint reports **171 functions,
  82 trigger bindings, zero errors and three unchanged warnings**. The final
  contract also verifies current business managers, revoked membership and
  explicit permission denial, record rollback, lease expiry and client denial.
- Populated upgrade preserves exact Payment, Gig, Wallet, WalletTransaction,
  PaymentWalletSettlement, PaymentRefundReceipt and PaymentRefundRecovery rows.
  No authorization history appears merely from applying the migration, and all
  rehearsal fixtures are cleaned. All eight final function bodies match the
  independent replay byte for byte. Migration SHA-256:
  `14a545ac12978570b92c3fa3585e742a219af1aaa0d900219234c0bc8d28bcee`.
- Final complete backend regression passes **4,895 checks with 16 existing
  skips** across 298 passing suites. All privacy gates pass, including **15 E2E
  checks**. Migration policy and generated-wrapper checks pass. Independent
  financial/service/SQL, request-scope and unchanged-status review is complete.
  The full final run uses Node.js 22, matching CI, and includes the six final
  realtime checks; the SQL contract proves unchanged receipts preserve the
  Gig revision. No provider or device acceptance is implied.

The first real SQL run exposed a JSON-null composite conversion, which was
corrected. Older scheduler tests were updated to exercise the protected service
contract instead of expecting the removed blind Stripe call/Gig write. A full
backend run encountered two unrelated tip-route HTTP listener/parser failures;
the unchanged 20-test suite passed in isolation. A later unrelated Home
address socket error passed its unchanged 21-test suite in isolation. The final
complete run passes. No assertion, timeout or skip was relaxed. Final verification logs stay outside Git under
`/private/tmp/pantopus-legacy-authorization-*`.

Reproduce the service/database check with
`node scripts/db/test-legacy-gig-authorization.cjs CONTAINER DATABASE_contract`
against an isolated migrated local Supabase PostgreSQL database. It rejects
nonlocal container naming and noncontract database names and uses synthetic
Stripe responses only.

Stripe's documented [confirmation states](https://docs.stripe.com/api/payment_intents/confirm)
and [idempotency behavior](https://docs.stripe.com/api/idempotent_requests)
inform the provider boundary; actual provider acceptance remains a separate
launch check.

## Remaining work

Update and verify all native assigned-authorization controls against the required
terms/receipt contract, then complete a fresh full sandbox paid-gig journey.
Web/native client completion and business delegate entry points are verified
separately from this backend checkpoint. General
cancellation fees, expiry/no-show workflows, dispute/Connect/debt handling and
durable legacy authorization/cancellation notifications remain distinct work.
This checkpoint does not claim those flows complete.

This is local source/database verification: no hosted migration, provider
operation or physical device acceptance occurred. Deploy matching clients with
the required-term resume routes; older blind-resume requests fail safely. Paid
subscriptions and dependencies stay deferred to the owner's final combined
launch-preparation step. Completed Beacon and saved-card acceptance stays
complete and must not be repeated.
