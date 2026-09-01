# Email firewall audit — 2026-05-08

Date: 2026-05-08
Status: Audit complete; remediation landed in P2.10.
Resolves: audience-profile design v2 §6.3 acceptance criterion for emails.
Companion: `docs/persona-support-email-feasibility.md` (P2.9 — inbound), this doc (P2.10 — outbound).

---

## 0. Why this audit

P0.6 enforces the firewall on **notifications** (the `Notification`
table + the template registry). Direct emails sent from
`backend/services/emailService.js` are a separate code path — neither
the registry nor the template-validation harness touches them. P2.10
audits each `sendXxx` function for cross-context leaks and adds the
audience-context emails the membership lifecycle needs.

## 1. Inventory + per-function audit

| Function (line in emailService.js) | Context | Recipient | Identifiers in subject/body | Cross-context risk | Verdict |
|---|---|---|---|---|---|
| `sendHomeInviteEmail` (110) | personal | invitee email | inviter's `display name`, home name | none — no persona fields touched | ✅ clean |
| `sendPasswordResetEmail` (211) | platform | user email | reset link only | strictly platform — no zone identifier | ✅ clean |
| `sendVerificationEmail` (313) | platform | user email | verification link only | platform | ✅ clean |
| `sendMonthlyReceipt` (425) | personal | creator's `User.email` | gigs / marketplace / community / reputation aggregates | NO audience income aggregated today (audited line-by-line) | ✅ clean — see §2 |
| `sendGuestReservationConfirmationEmail` (574) | personal | guest email | booking + home name | none | ✅ clean |
| `sendGuestReservationAddressEmail` (680) | personal | guest email | address (only after booking is confirmed) | none | ✅ clean |
| `sendDisplayNameMigrationEmail` (874) | personal | user email | username, previous display name | none | ✅ clean |

**No existing function leaks across the firewall.** The audit found
zero remediation needed for the existing surface.

## 2. `sendMonthlyReceipt` deep-dive

The receipt template aggregates these sections (lines 473–500):

- **Earnings**: gig count, total earned, top category.
- **Spending**: gigs posted (completed), total spent.
- **Marketplace**: listings sold/bought, free items.
- **Community**: posts created, connections, neighbors helped.
- **Reputation**: rating, reviews, rating change.

There is **no persona-revenue, persona-subscriber, or
persona-broadcast field** in the schema this template consumes
(`receipt` is built upstream by Pantopus's monthly-receipt aggregator,
which only queries personal-side tables: Gig, Listing, Post,
Connection, Review). Confirmed by inspection.

### What if persona earnings are added to the monthly receipt later?

Per §6.3: persona income MUST NOT interleave with personal income in
the same email. Per the P2.10 spec, three options:

| Option | Description | Recommended? |
|---|---|---|
| A | Two separate monthly receipts — personal-zone, audience-zone. | ✅ recommended at the time persona earnings ship. Cleanest separation; matches the two-zone mental model. |
| B | One receipt; persona earnings as an aggregate (no per-persona name) on the personal side; per-persona detail on the audience side. | ❌ rejected — still surfaces an audience-zone signal in a personal-zone email. |
| C | Leave as-is, recipient is the creator themselves. | ❌ rejected — even though the recipient knows both sides, the email is the canonical "personal-zone status" digest; mixing audience data in it makes the two-zone IA leaky everywhere users look. |

**Decision:** When persona earnings ship in the monthly receipt
(currently not in scope), implement Option A. A new
`sendPersonaMonthlyReceipt` will live alongside the existing
`sendMonthlyReceipt` and pull from audience-zone tables only. This
audit pre-commits the architectural choice.

## 3. New audience-context emails (P2.10)

Three new functions in `emailService.js`, all targeting the **fan's**
`User.email`. Per §6.3, the creator's email is never copied or
referenced; the persona display name is the only creator-side
identifier in the body; `Reply-To` is intentionally NOT set (fans
who reply land at the platform `From:` address, which is policy
already).

| Function | Trigger (Stripe webhook) | Subject pattern | Identifiers in body |
|---|---|---|---|
| `sendPersonaSubscriptionWelcomeEmail` | `customer.subscription.created` (first time only) | `Welcome to {personaDisplayName}'s {tierName} tier` | persona display name, persona handle, fan handle, tier name, period end date |
| `sendPersonaSubscriptionCanceledEmail` | `customer.subscription.deleted` | `Your {personaDisplayName} subscription was canceled` | persona display name, fan handle, period end date |
| `sendPersonaPaymentFailedEmail` | `invoice.payment_failed` | `Payment issue with your {personaDisplayName} subscription` | persona display name, fan handle, retry guidance |

**What's deliberately excluded from every audience-context email:**

- The creator's `User.email`, `User.name`, `User.username`, address.
- Any local profile, home, business, or marketplace identifier.
- Any neighbor or connection signal.
- A `Reply-To` header pointing at the creator's real email.

## 4. Webhook wiring

`backend/stripe/stripeWebhooks.js` — three new email sends, each
wrapped in try/catch so an email-delivery failure cannot break the
webhook's DB transaction:

- `handlePersonaSubscriptionCreated` — sends the welcome email
  ONLY on the insert path (i.e. first time we see this membership).
  An existing-row update path means the membership row was reseeded
  by a Stripe replay; no welcome email there.
- `handlePersonaSubscriptionDeleted` — sends the cancellation email
  on every fire (the handler runs at most once per real cancel).
- `handlePersonaInvoicePaymentFailed` — sends the payment-failed
  email on every fire. Stripe's Smart Retries cause multiple
  fires; the email is idempotent in tone but we don't dedupe yet
  (a follow-up may add a 24h dedupe window — flagged in §6).

Each handler reads the fan's `User.email`, the persona's
`display_name + handle`, and the tier's `name` from the existing
PersonaMembership joins.

## 5. Tests

`backend/tests/unit/emailFirewall.test.js` — at least 4 cases:

1. Welcome email subject + body contain the persona display name
   + tier name; never the creator's `User.name` or `User.email`.
2. Welcome email recipient is the fan's email; the fan's email
   never appears in the body itself.
3. Cancellation email follows the same firewall rules.
4. Personal-zone emails (home invite, monthly receipt, password
   reset) never carry any `@handle`-style audience identifier
   in subject or body.
5. Persona emails do NOT set a `Reply-To` header pointing at any
   creator-side address.
6. Monthly receipt body never references any persona-zone field
   (audience income, subscriber counts, broadcast metrics) — proof
   the personal-zone aggregator stays personal-zone.

## 6. Remaining concerns / follow-ups

- **Persona-earnings monthly receipt.** Not built. When it ships,
  follow the §2 Option A decision: a separate
  `sendPersonaMonthlyReceipt` template that pulls from audience-
  zone tables only. Cross-link this doc.
- **Payment-failed dedupe window.** A repeated retry sequence can
  fire `invoice.payment_failed` many times. The audit doesn't fix
  this; add a 24h "we already told you" check on the membership row
  if fan complaints come in.
- **Reply-To on outbound emails.** Currently emails go out under
  the global `SMTP_FROM`. Replies to persona emails should land at
  the platform support address; once `PERSONA_SUPPORT_EMAIL_DOMAIN`
  (P2.9) is live in production, set `Reply-To: support+{handle}@<domain>`
  on persona emails so threaded replies inherit the persona context.
  Currently NOT set so replies bounce harmlessly.
- **Email template registry parity.** P0.6 has a notification
  template registry that rejects cross-context placeholders at
  compile time. `emailService.js` does not. The audit-test pattern
  in `emailFirewall.test.js` is the lighter substitute; a future
  pass could lift email templates into the registry and get the
  same compile-time guarantee.
