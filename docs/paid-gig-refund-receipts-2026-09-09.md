# Paid-gig refund receipts — September 9, 2026

This source checkpoint gives payer/admin refund requests a durable identity,
exact provider proof and a recoverable result. It does not complete the whole
paid-gig release journey and has not run against hosted data or Stripe accounts.
Parent integration and current-head CI remain separate from this local evidence.

## Behavior and public contract

`POST /api/payments/:paymentId/refund` accepts the existing `reason`, optional
cent `amount` and optional `description`, plus an optional UUID `requestId`.
The admin equivalent keeps its existing admin requirement and rechecks the
persisted role. A payer still cannot initiate a refund once income has reached
the worker wallet or a provider transfer. Internal gig/booking cancellation
callers retain their service policy path; HTTP input cannot select that mode.

The result contains `success`, `refundRequest`, a verified compatibility
`refund` receipt (or null) and the exact minimal `payment` summary. Success is
true only after a succeeded operation was saved. Successful replies use HTTP
200; pending/requires-action/failed/canceled receipts use 202 with their actual
status. Ambiguous provider or local-save failures return 503 with the retained
request identity when available. A competing request returns 409 with code
`REFUND_ACTIVE` and its existing receipt. Changing the original terms of an
existing UUID is a conflict.

A request exposes `requestId`, `paymentId`, `operation` (`refund` or `release`),
`amountCents`, `currency`, `status`, `providerRefundId`, `canRetry`,
`reversalStatus`, `requestedAmountCents`, `reason` and `description`. The original
nullable requested amount survives cold recovery: omitted amount means the
remaining balance at reservation, while an explicit partial amount stays fixed.
`canRetry` reflects the current caller's original payer/admin operation and
endpoint amount limits; another actor's policy/admin request is readable but
not offered as a payer mutation.

`GET /api/payments/:paymentId/refunds` returns scoped local request/verified
receipt history and the payment summary. It performs no provider call. A hold
release succeeds only after exact PaymentIntent cancellation; it leaves
`refunded_amount` at zero. A succeeded refund represents a provider-confirmed refund of captured money, not instant
appearance in the payer's bank.

The [shared web controls](paid-gig-web-refunds-2026-09-09.md) are a separate
client checkpoint. Native refund controls and real provider acceptance remain.

## Frozen terms, provider proof and recovery

The service checks exact PaymentIntent identity, customer, payer, payee, gig,
amount, currency and applicable acceptance-attempt metadata. Captured refunds
also require the exact paid/captured Charge. Request amount and payment terms
are frozen under a Payment row lock before any provider mutation. The final
provider lease rechecks current actor authority and current dispute/state after
waiting for locks; revocation or a newly opened dispute blocks new mutations.

Each request uses one stable provider idempotency key. After an unknown response,
read-only discovery paginates refunds for that exact PaymentIntent, validates
receipt terms and rejects duplicate matches. A missing list result never
permits a new create after the conservative ten-minute window. Existing exact
receipts can be persisted after the window and after actor revocation because
that is evidence reconciliation, not new financial authorization. The periodic
recovery job is registered with both cron and pg-boss ownership conventions.
Unresolved older provider absence remains a retained operation for support.

Only `succeeded` provider refunds contribute to `refunded_amount`.
`pending`, `requires_action`, `failed` and `canceled` do not. Receipt identity
cannot move between payments or requests; terminal receipts cannot regress
because of a stale event. `refund.created`, `refund.updated`, `refund.failed`,
legacy `charge.refund.updated` and `charge.refunded` all read current provider
proof instead of copying event totals. A durable-write failure retries the
webhook. Actual receipts can be recorded during a dispute without erasing it.

These status and event choices follow the official
[Refund object](https://docs.stripe.com/api/refunds/object),
[refund creation](https://docs.stripe.com/api/refunds/create),
[refund list](https://docs.stripe.com/api/refunds/list), and
[Stripe event types](https://docs.stripe.com/api/events/types) contracts.

## Wallet and database boundary

Migration `20260910050000_paid_gig_refund_receipts.sql` adds service-only
`PaymentRefundRequest`, `PaymentRefundReceipt` and `PaymentRefundRecovery`.
Historical `Refund` rows are preserved and are not trusted as provider evidence.
The old client Refund insert policy and direct financial write/function grants
are closed while existing authenticated involved-party reads remain. The
existing wallet implementation is preserved behind a service-only wrapper.

Refund reservation and income credit lock Payment before Wallet. A reserved
refund blocks stale wallet credit; an existing exact credit removes the payer's
self-service refund entitlement. Wallet settlement recovery uses one SQL
transaction and never resets an unknown Stripe transfer to retry. Stale legacy
status writers cannot replace an active `refund_pending` state (a dispute may
still freeze the payment). Gig status mirrors update only its current payment.

After an allowed admin/policy refund of credited income, proportional cumulative
wallet recovery is debited once when funds are available. Insufficient/frozen
wallet funds are recorded as debt separately from customer refund success.
Historical explicit Connect transfers are recorded as debt for support, without
fabricating a reversal receipt. The unused direct Connect creation helper is
closed until its own durable transfer/recovery workflow exists; active gig
settlement already uses wallets.

## Local evidence and limits

- Final combined backend regression passes **4,768 tests**, with 16 existing
  skips, under CI's Node 22. A final caller retry-availability refinement is
  covered by **37 passing focused refund tests** after that full pass.
- Earlier full runs encountered intermittent local HTTP socket/parse failures
  in dismiss, worker-release and paid-gig mutation tests. The final full rerun
  passes without raising timeouts; no runtime-version cause is claimed.
- Fresh chronological canonical application replay passes all **21 SQL
  contracts**, including actual service/authenticated/anon roles. Managed Supabase
  prerequisites were cloned into a new disposable database, and only that new
  database's public application schema was cleared before replay.
- Application function lint reports **zero errors**, 159 PL/pgSQL functions and
  79 trigger bindings; three existing warnings remain.
- Refund races pass **28 separate PostgreSQL connections**: same/different request,
  both wallet/refund lock orders, admin revocation and dispute while claim waits,
  one provider lease, and duplicate receipts producing one wallet recovery.
  The source runner deletes only its exact synthetic fixtures, including
  independent public User profiles.
- Populated upgrade rehearsal preserves exact historical Payment, Refund,
  Wallet and WalletTransaction rows and the original wallet function body. It
  creates no verified receipt from historical rows alone.
- Privacy gates, generated contract-wrapper consistency, migration policy and
  diff checks pass. The initial child privacy run hit a local listener permission
  limit; the authorized host rerun passed, including 15 audience-profile E2E cases.
- Provider behavior is mocked in backend tests. Database tests use only local
  synthetic fixtures. No hosted migration, Stripe request, provider event
  configuration, runtime deployment or device acceptance occurred here.

## Immediate next gates

1. Release the remaining worker earnings after a **pre-release partial refund**.
   Current transfer selection accepts only `captured_hold`, and the new income
   fence intentionally refuses refunded payments. `refunded_partial` residual
   earnings remain held until a frozen proportional settlement receipt exists;
   this checkpoint must not be called a complete wallet lifecycle.
2. Finish historical assigned off-session authorization recovery and native
   refund controls, then run fresh test-mode paid-gig authorize → complete →
   capture → scoped refund acceptance with exact cleanup.
3. Complete explicit Connect transfer/reversal reconciliation and operational
   recovery of wallet/transfer debt before enabling those historical paths.
   New provider creation remains blocked for unresolved operations beyond the
   conservative window; support needs positive provider evidence to resolve them.
4. Review broader legacy dispute accounting separately. This checkpoint prevents
   new refund mutation during a current dispute and preserves disputed status
   while recording exact refunds; it does not redesign dispute-loss accounting.
5. Apply a reviewed hosted upgrade and required provider webhook subscriptions
   only through the parent's deployment/acceptance sequence after integration.
