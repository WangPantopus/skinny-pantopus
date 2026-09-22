# Durable wallet-credit notifications — September 10, 2026

A new paid-gig wallet credit now commits the worker and payer in-app notices
and their delivery events in the same transaction as the money and settlement
receipt. A server stopping immediately afterward cannot lose the notices.
Notification-storage failure rolls back the entire new credit for exact retry.
This extends the [residual settlement transaction](paid-gig-wallet-settlement-2026-09-10.md).

Only a new positive credit creates events. Historical adoption, zero earnings
and an existing settlement receipt never backfill or recreate notifications.
Migration `20260910120000_paid_gig_wallet_delivery.sql` changes no historical
financial records. It adds service-only `PaymentWalletDelivery` and preserves
the prior settlement proof, amount, refund, lock and rollback checks.

The worker notification links to the earnings wallet and reports the exact
historical credit. The payer notice identifies the worker share after applicable
fees and refunds. Neither claims a bank transfer or treats the worker share as
the customer's original charged total. The current balance remains a wallet
read, since later refunds or withdrawals can change it.

The scheduled relay leases at most 25 events per run, rechecks exact settlement,
ledger, wallet and recipient/notification proof, and delivers the existing
notification ID. Expired leases recover after process death. Unknown transport
results retry with backoff; malformed acknowledgements cannot mark completion.
Current global push and gig-update preferences are checked before sending.
Suppressed push stays in-app and is not replayed after preferences are restored.
Deleting an in-app notification suppresses its outstanding delivery and retries
cannot recreate it. Cron and pg-boss registrations use the existing job ownership
mechanism. The old post-commit path remains only for legacy non-gig payments.

## Verification

- Final complete backend suite: **4,821 passed, 16 existing skips**. All privacy
  gates pass, including 15 E2E checks. The focused settlement/relay suites pass
  56 checks with transport, storage, preference and malformed-receipt failures.
- Fresh isolated replay: **17 migrations, 23 raw SQL contracts and 23 pgTAP
  wrappers pass**. Wrappers explicitly reject TAP `not ok`. Application function
  lint reports **164 functions, 80 trigger bindings, zero errors** and three
  unchanged warnings.
- Existing settlement concurrency passes with **36 database connections**.
  The actual production relay also runs against real local SQL: concurrent
  claims obtain distinct events, expired leases recover, uncertain transport
  and a lost acknowledgement retain the same two notification IDs and one
  credit. Final fixture counts are zero.
- A populated upgrade preserves exact Payment, Gig, Wallet, WalletTransaction,
  PaymentWalletSettlement and PaymentRefundRecovery rows. Replaying the prior
  receipt creates no notification events. Exact rehearsal fixtures are cleaned.
- Independent review confirms that the prior settlement transaction changes
  only by adding atomic notification materialization. All four final function
  bodies match the checked database byte for byte. Migration SHA-256:
  `c63e3d39b253120503930420a20e234502b781b8c11a32b96b59660fea5595a9`.

The first local harness attempts corrected copied RPC names, psql boolean JSON
encoding, a fixture cleanup dependency and a snapshot ordering assumption. The
final actual relay/SQL check passes; no runtime assertion or timeout was relaxed.
Reproduce it with `node scripts/db/test-wallet-delivery-recovery.cjs CONTAINER
DATABASE_contract` against an isolated migrated local database. Detailed logs
remain outside Git under `/private/tmp/pantopus-wallet-delivery-*`.

## Limits and next work

Transport remains at least once: if a provider accepts a notification but its
acknowledgement is lost, retry can present the same notification again. The
stored notice and money credit remain unique. This checkpoint uses synthetic
push transport and local PostgreSQL, not hosted or physical-device acceptance.
It covers paid-gig wallet credits; legacy tip/booking notices retain their
existing delivery path. Full launch capacity and retention checks remain open.

Continue historical assigned authorization recovery, cancellation-fee policy,
dispute/Connect/debt workflows and a fresh complete sandbox paid-gig journey,
then integrate with all current-head checks passing. Paid subscriptions stay
deferred to the owner's final combined launch-preparation step.
