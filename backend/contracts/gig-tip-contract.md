# Durable Gig tip contract

Matching clients and backend must deploy together. The previous tip POST without an
original request UUID, current opening session proof and exact displayed terms returns
`409 TIP_TERMS_REQUIRED` before any provider payment operation.

`GET /api/payments/tip-preview?gigId=:gigId` returns local eligibility and opening proof:

```ts
type TipTerms = {
  gigId: string;
  payerId: string;
  payeeId: string;
  ownerConfirmedAt: string | null; // null only for historical existing-payment recovery
};
type TipPreview = {
  actorId: string;
  sessionScope: string;
  terms: TipTerms | null;
  eligible: boolean;
  unavailableReason: string | null;
  activeRequestId: string | null;
  minimumAmountCents: 50;
  maximumAmountCents: 99999999;
  remainingTipSlots: number;
};
```

Only the exact personal Gig poster can begin a tip. The Gig must be completed and
owner-confirmed with its current worker. The existing minimum of 50 cents, maximum
of three successful tips per Gig, full tip amount to the worker and existing Connect
account-record requirement remain. An unresolved request is recovered or canceled
before starting another one; an unknown provider outcome does not free a tip slot.
A canceled, confirmed zero-charge attempt does not consume a successful-tip slot.
The amount ceiling is Stripe's existing eight-digit USD constraint, checked before
reservation: [PaymentIntent amount documentation](https://docs.stripe.com/api/payment_intents/create).

`POST /api/payments/tip` accepts the following command. Generate and durably retain
one original UUID and its nonsecret amount/terms before sending it. `mode` changes
what this invocation may do; it does not replace the original operation or terms.

```ts
type TipCommand = {
  requestId: string;
  gigId: string;
  amount: number; // original integer cents
  expectedActorId: string;
  expectedSessionScope: string;
  expectedTerms: TipTerms;
  paymentMethodId?: string | null; // original optional saved method ID
  mode: 'resume' | 'check' | 'cancel';
};
```

`resume` is an explicit send/resume action. A durable request and Payment reservation
precede any PaymentIntent creation. Retries retain the same Payment, provider key,
amount, optional method and metadata. Provider keys may be pruned after at least 24 hours; a retry beyond the
conservative recovery window requires exact existing-intent discovery and never
creates again based on list absence ([Stripe idempotency](https://docs.stripe.com/api/idempotent_requests)).
`check` only reads current provider evidence
and reconciles that evidence; it never creates, confirms, cancels, captures or refunds
an intent. `cancel` is a separate explicit cancellation request; only durable proof
of no charge completes cancellation. A closed SDK sheet or a timeout is not such
proof. Provider processing and unknown creation/cancellation results remain pending.

`GET /api/payments/tip-requests/:requestId` reads the saved local request only. It
never creates provider work or treats absence as permission for a new UUID. A cold
unknown request keeps its original UUID and terms. The current screen obtains new
opening session proof; a freshly authorized session of the same original payer may
recover the request, while a stale screen's old proof fails before provider access.

Commands and request reads return this exact identity and receipt shape. Only a
fresh provider check may include transient checkout data; GET does not include it.

```ts
type TipRequest = {
  requestId: string;
  gigId: string;
  payerId: string;
  payeeId: string;
  paymentId: string;
  amountCents: number;
  currency: 'usd';
  terms: TipTerms;
  paymentMethodId: string | null;
};
type TipReceipt = {
  requestId: string;
  gigId: string;
  paymentId: string;
  payerId: string;
  payeeId: string;
  amountCents: number;
  currency: 'usd';
  status: 'succeeded' | 'canceled';
  paymentIntentId: string | null;
  chargeId: string | null;
  amountChargedCents: number;
};
type TipProgress = {
  actorId: string;
  sessionScope: string;
  request: TipRequest;
  status: 'pending' | 'requires_action' | 'succeeded' | 'canceled' | 'needs_review';
  paymentStatus: string;
  providerStatus: string | null;
  paymentIntentId: string | null;
  canRetry: boolean;
  canCancel: boolean;
  receipt: TipReceipt | null;
  checkout?: {
    paymentIntentId: string;
    clientSecret: string;
    customer: string;
    ephemeralKey: string | null;
    publishableKey: string | null;
  };
};
```

Match the original request, Gig, Payment, payer, payee, terms, amount, currency and
opening actor/session before using any response or SDK callback. A successful tip
requires a matching durable `succeeded` receipt with the exact PaymentIntent, Charge
and full charged amount. Neither HTTP success, missing checkout data, an accepted
SDK callback nor a pending local status establishes success. Recheck the same
operation directly before SDK presentation and after its callback. An unconfirmed
result remains recoverable with the same UUID; never persist SDK secrets or current
server session proof.

Only `TIP_ACTIVE` may identify another pending operation through
`{ code: 'TIP_ACTIVE', activeRequestId }`. Read and verify that original request
before explicitly adopting it. Other conflicts must not replace local recovery.
Storage failure or a competing saved operation stays visible; account/API changes
and dismissal cannot let delayed responses erase another operation.

The existing `POST /api/payments/tip/:paymentId/refresh-status` remains a provider-read
compatibility path for the exact payer or payee. It must not create a replacement
payment or use a stale event to overwrite financial state. New clients use the
scoped original-request command above. Historical tip rows with no request UUID are
never converted into a new charge. Exact provider-read reconciliation may register
their existing Payment/PaymentIntent as a protected legacy request; its unknown
historical confirmation time remains null, and it permits only check or confirmed
zero-charge cancellation. It never permits a new intent or client confirmation.
New request creation requires a nonnull current owner confirmation. Unverified or
multiple historical pending payments block an ambiguous new tip until individually
reconciled. Existing successful tips and financial records are preserved.

This is the source contract for migration `20260910190000_paid_gig_tip_receipts.sql`.
Hosted application, new provider acceptance and client completion remain separate
verification gates until the corresponding source and receipt tests pass.
