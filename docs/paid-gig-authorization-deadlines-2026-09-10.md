# Provider authorization deadlines — September 10, 2026

Paid-gig reconciliation previously assigned a new seven-day authorization window
when it found an existing hold. Historical assigned recovery also retained a
locally estimated window. These dates could make an old hold look valid longer
than the payment provider would allow.

The current implementation uses the exact latest Charge's
`payment_method_details.card.capture_before`, as described in
[Stripe's manual authorization documentation](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method).
It verifies the Charge's intent, customer, currency, amount, uncaptured/paid state
and absence of refunds before accepting that deadline. Missing, malformed,
foreign or expired readiness proof cannot authorize task acceptance.

## Behavior

- New paid-gig creation, recovery after a lost provider response and subsequent
  authorization checks retain the provider's deadline. Reconciliation does not
  start another local seven-day window. An existing estimated date is corrected
  only after reading exact current provider evidence.
- Paid-gig capturable webhooks read the current intent and Charge; the older
  event object alone cannot manufacture readiness or a new deadline. Events for
  payments already past the authorization phase do not regress their state.
- Historical authorization stores the verified deadline and Charge in the same
  locked receipt transaction as the provider status. Missing/expired proof leaves
  the previous receipt and payment unchanged. The new migration does not rewrite
  historical financial rows or manufacture an authorization history.
- The common Charge reader can return an expired verified deadline to the separate
  expiry workflow. A distinct live-readiness check rejects it for authorization.
  Provider access is read-only in this checkpoint.

## Verification

The isolated final source snapshot passes **4,911 backend checks**, with 16 existing
skips; all privacy gates pass. Its focused provider/service checks pass 116 cases,
and the affected HTTP routes plus the previously failing adjacent HTTP suite pass
96 cases. Older provider fixtures were extended with exact synthetic Charge
proof; their original readiness/privacy assertions remain intact.

A new disposable database replayed all **19 migrations** through 130000 in sorted
order. It passes **25 raw SQL contracts and 25 pgTAP wrappers**, 171 application
functions and 82 trigger bindings with zero errors and the same three baseline
warnings. The existing actual-service/SQL recovery harness passes **57 database
connections**, including unknown provider outcomes, lost receipts and cancellation
versus worker-start ordering, using a fixed synthetic provider deadline.

The new SQL contract proves that an existing seven-day estimate becomes the exact
one-hour provider deadline, repeated reconciliation does not extend it, and
missing, malformed, foreign-role and expired proofs cannot change the receipt.
Its final function body matches the fresh database byte for byte. Migration
SHA-256: `600f3c026af49e9161b573c07d2e7e32dd7b45ba6ab32377286a2d8b96b32580`.

A separate populated upgrade preserves exact rows across Payment, Gig, Wallet,
WalletTransaction, PaymentWalletSettlement, PaymentRefundReceipt,
PaymentRefundRecovery, GigPaymentAcceptance and GigLegacyAuthorization. The
existing authorization operation remains present, no history is backfilled,
and all exact synthetic fixtures are cleaned up.

Independent source review passed for the exact Charge proof, current-state
receipt checks, locked legacy transaction and preserved financial terms.

## Limits and next action

Deploy the matching runtime and migration together: the historical receipt now
requires a verified deadline. Existing unverified dates are not bulk-backfilled.
Non-gig booking authorization remains a separate lifecycle; this change addresses
paid gigs. The provider is synthetic in these checks, so fresh sandbox acceptance
is still required. No hosted database, provider mutation, physical device check
or paid dependency ran.

Next complete durable authorization-expiry cancellation. The old expiry job could
cancel a task after an unknown hold-release result and could update a task whose
assignment had changed; that job remains under active repair. Then finish manual
cancellation, dispute/Connect/debt, durable attention, full provider journeys and
capacity/integration checks. Draft PR #34 remains unfinished. All paid subscriptions
are deferred together to the owner's final launch-preparation step.

Private logs and proofs remain outside Git under
`/private/tmp/pantopus-gig-deadline-*`. Disposable databases
`paid_gig_deadline_fresh_contract` and `paid_gig_deadline_upgrade_contract` are
retained in the existing local replay container. The full backend verification
snapshot excludes the separate in-progress expiry implementation.
