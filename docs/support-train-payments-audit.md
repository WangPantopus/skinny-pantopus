# Support Train Gift Funds — Stripe Integration Audit

**Date:** 2026-04-07  
**Scope:** Identify the right integration points for SupportTrainFundContribution charges.

---

## 1. Which function should charge the contributor?

**Use `stripeService.createPaymentIntentForGig()`** at `backend/stripe/stripeService.js:627`.

This is the same function the existing **business catalog donation** flow uses (`backend/routes/businesses.js:2520`). It:
- Accepts `payerId`, `payeeId`, `amount` (cents), `paymentMethodId`, `metadata`
- Calls `_getPayeeAccountOptional()` (line 639) — **does not require** the payee to have a Connect account
- Uses `capture_method: 'manual'` (hold funds, capture later)
- Creates a `Payment` DB row with full audit trail
- Returns `{ clientSecret, paymentIntentId, paymentId }`

Do **NOT** use `createTipPayment()` (line 1197) — it calls `_getPayeeAccount()` which **throws** if the payee has no Connect account (`stripeService.js:465`).

---

## 2. Where do funds land?

**Funds land in the platform's Stripe account first (escrow-like).**

`createPaymentIntentForGig` uses `capture_method: 'manual'` — the PaymentIntent is authorized but not captured until an explicit capture call. The existing gig flow captures via `capturePaymentIntent()` (`stripeService.js:795`) after owner confirmation, then transfers to the payee's Connect account via `createTransfer()` (`stripeService.js:850`).

For gift funds, the organizer/recipient would need a Connect account to receive a transfer. If they don't have one, the funds remain on the platform until they onboard.

Alternatively, funds can be credited to the recipient's **Pantopus wallet** via `walletService.creditGigIncome()` (`walletService.js:230`) without requiring a Connect account — the wallet balance is withdrawn later when the user sets up Connect.

---

## 3. Connect-account-not-ready handling

**Yes, there is an existing pattern:**

- `_getPayeeAccountOptional()` (`stripeService.js:479-484`) returns `null` if no Connect account — the charge proceeds and funds stay on platform
- `walletService.withdraw()` (`walletService.js:96-112`) checks `payouts_enabled` and throws descriptive errors:
  - `'No payout account set up. Please connect your Stripe account first.'` (line 108)
  - `'Your payout account is not yet verified. Please complete Stripe onboarding.'` (line 111)
- Connect onboarding is triggered via `POST /api/payments/connect/onboarding` (`backend/routes/pays.js:208`)

---

## 4. Canonical "no Connect account" error

| Context | Error | File:Line |
|---------|-------|-----------|
| Withdrawal | `No payout account set up. Please connect your Stripe account first.` | `walletService.js:108` |
| Withdrawal | `Your payout account is not yet verified. Please complete Stripe onboarding.` | `walletService.js:111` |
| Tip payment | `Payee has no Stripe account. They must complete onboarding first.` | `stripeService.js:465` |
| Route handler | Checks `err.message?.includes('payout account')` | `backend/routes/wallet.js:101` |

---

## 5. Existing one-time donation flow to mirror

**Business catalog donation** at `backend/routes/businesses.js:2490-2548`:

```
POST /:businessId/catalog/:itemId/donate
Body: { amount_cents, donor_user_id? }
```

Flow:
1. Validates the catalog item is `kind: 'donation'` (line 2496)
2. Calls `createPaymentIntentForGig()` with `metadata.type: 'catalog_donation'` (line 2523)
3. Returns `{ client_secret, payment_intent_id, payment_id, amount_cents, fee_cents, net_to_business }`
4. Frontend confirms the PaymentIntent with the client secret
5. Webhook handles capture and settlement

**This is the closest existing pattern.** Gift fund contributions should mirror it with `metadata.type: 'support_train_gift_fund'`.

---

## Design Decisions Requiring YP Input

### 1. Should gift funds escrow until the train completes?
The current donation flow captures immediately. For Support Train gift funds, should we hold (manual capture) and release when the train completes? Or auto-capture and credit to the recipient's wallet immediately?

### 2. Who is the payee — the organizer or the recipient?
The donation flow pays the business. For Support Train, is the payee the `recipient_user_id`, the `organizer_user_id`, or a platform-held account? This affects who needs a Connect account.

### 3. What if the recipient is not a Pantopus user?
Design doc Section 27.2 says the train should work with non-user recipients. If the recipient has no Pantopus account, where do gift funds go? Options: hold in platform escrow, credit organizer's wallet, or require recipient to sign up before fund release.

### 4. Should anonymous donations show the amount to the organizer?
Design doc says anonymous donations are supported. Should the organizer see the amount (but not the name) or neither? This affects the fund contribution response shape.

### 5. Platform fee on gift funds?
The existing donation flow includes platform fees (`fee_cents` in response). Should Support Train gift funds also include a platform fee, or should they be fee-free to encourage generosity?
