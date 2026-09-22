# Durable tip draft and session continuation

September 10, 2026. The owner requested committing and pushing all agent-owned
work for a fresh session. This checkpoint preserves unfinished source; it does
not complete the tip feature or authorize production/provider mutations.

The last completed milestone is `48afcc68f`, Android payment opening identity.
All of its GitHub CI checks passed. New draft files are:

- `backend/contracts/gig-tip-contract.md`: proposed preview/original-command/
  progress/receipt contract, explicit resume/check/cancel semantics, immutable
  request terms, truthful provider success and historical request handling.
- `backend/stripe/gigTipProof.js`: proposed exact customer/PaymentIntent/Charge
  validation and provider-read helper. JavaScript syntax checking passes. It is
  not integrated into existing routes and has no executed behavior tests.

No tip migration, durable reservation/service, SQL verification, route migration,
client recovery, provider acceptance or live charge was completed. Treat every
new draft behavior as requiring review. Existing tip behavior is still the old
implementation and must not be described as fixed by these two files.

## Next implementation

1. Review the contract and provider helper against existing financial policy and
   Stripe test responses. Reserve original UUID, Payment identity, payer/payee,
   cents/currency, displayed terms and optional method atomically before provider
   creation. A lost reply must reuse the same reservation/key. Lock successful
   and unresolved requests when enforcing the maximum-three-successful-tips rule.
2. Implement migration `20260910190000_paid_gig_tip_receipts.sql` (RESERVED only),
   current-scope API/service authorization and exact durable receipts. `check`
   only reads/reconciles provider state. Explicit cancellation completes only
   after verified zero-charge evidence. Preserve unknown outcomes and account/
   session boundaries; no local missing-ID inference after uncertain creation.
3. Preserve payer-only completed/owner-confirmed Gig eligibility, minimum 50
   cents, full tip to worker and the existing Connect account-record policy.
   Validate provider customer, mode, amount, currency, metadata, fee/destination,
   PaymentIntent/Charge and success proof. Reconcile historical unknown tips
   without issuing replacement charges or inventing confirmation dates.
4. Verify real local SQL concurrency/replay, populated upgrades and service
   recovery before implementing browser/iOS/Android retained commands and SDK
   callbacks. Neither SDK completion nor missing checkout data means success.
5. Complete sandbox/provider and installed journeys, then remaining started-work,
   no-show, fees, completion/reopen, dispute, Connect/debt, durable attention and
   capacity work. Do not repeat completed native saved-card acceptance/cleanup.

Home branch `codex/home-permission-boundaries` owns migration versions `170000`
and `180000`; future Home additions should use `200000` or later after coordination.
Audit older cross-branch migration timestamp/dependency collisions before
integration. PR #34 remains a draft; new checkpoint CI must be checked separately.

## Shared continuation

The comprehensive handoff is
[SESSION_RESUME_2026-09-10.md on the Home branch](https://github.com/WangPantopus/skinny-pantopus/blob/codex/home-permission-boundaries/docs/SESSION_RESUME_2026-09-10.md),
also local at `/private/tmp/pantopus-home-permission-boundaries/docs/SESSION_RESUME_2026-09-10.md`.
It records current browser/Android drafts, the failed first iOS installed task
journey, exact Home CI repairs, completed milestones and all remaining launch
stages. Refresh Git and remote CI before acting.

All new paid services/subscriptions, including Smarty, remain one final owner
launch-preparation bundle after work achievable without spending is ready. No
purchase, new infrastructure, hosted migration or owner-phone action is part of
this checkpoint. Preserve main-checkout owner edits and keep secrets/operator
logs/database archives out of Git. Continue prioritizing actual smooth workflows
and maintainability; do not infer completion from test counts.
