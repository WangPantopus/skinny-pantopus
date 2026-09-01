# Stripe Connect Express Receipt Verification

Date: 2026-05-08
Status: PARTIALLY VERIFIED — source-side audit complete, live Stripe transaction + support ticket pending.
Owner: Claude Opus 4.7 (P2.8 source pass)
Resolves (partially): `docs/audience-profile-tier-ladder-design-2026-05-08-v2.md` §17 #7.

---

## 0. What this doc is

The audience-profile design v2 §6.3 spec'd the Stripe Connect Express
receipt firewall: persona display name on receipts, `PANTOPUS *@HANDLE`
statement descriptor, persona profile URL on the merchant card, no
creator legal-name leak. §17 #7 flagged it for a live verification pass
before launch because Stripe's actual rendering for sub-merchant
receipts depends on details only Stripe support can confirm.

P2.8 covers the audit + code fixes that can be done from the source
alone. The live test-mode transaction findings and the Stripe support
ticket answers are filled in below the `[VERIFY IN LIVE STRIPE]` and
`[STRIPE TICKET]` markers when the operator runs them.

## 1. Source-side audit

`backend/services/personaPaymentsService.js → applyPersonaBusinessProfile`
issues a `stripe.accounts.update(accountId, ...)` with the following
shape (post-P2.8):

```js
{
  business_profile: {
    name: persona.display_name || persona.handle,
    url: 'https://pantopus.com/@HANDLE',
    support_url: 'https://pantopus.com/@HANDLE',
    product_description: 'Updates and member-only content from @HANDLE on Pantopus.',
  },
  settings: {
    payments: {
      statement_descriptor: 'PANTOPUS *@HANDLE', // ≤ 22 chars, uppercased
    },
  },
}
```

**Intentionally omitted in v1:** `business_profile.support_email`. P2.9
provisions a per-persona SES catch-all (`support+{handle}@pantopus.com`)
which becomes the value for that field once routing is in place.

## 2. Design intent vs. observed behavior

| Surface | Intended (§6.3) | Source-side audit | Live-Stripe finding | Match? |
|---|---|---|---|---|
| Card statement descriptor | `PANTOPUS *@HANDLE` (≤22 chars) | `settings.payments.statement_descriptor` set by `buildStatementDescriptor()`; uppercased; truncated to 22 | `[VERIFY IN LIVE STRIPE — paste descriptor as it appears on the test fan's card statement view in the Stripe Dashboard]` | TBD |
| Receipt merchant name | Persona `display_name` (NOT legal name) | `business_profile.name` set to `persona.display_name`, falling back to handle | `[VERIFY IN LIVE STRIPE — paste merchant name from the receipt PDF + the email receipt subject]` | TBD |
| Support URL on receipt | `https://pantopus.com/@HANDLE` | `business_profile.support_url` set (P2.8 fix) | `[VERIFY IN LIVE STRIPE — note whether Stripe surfaces this URL on the receipt and Connect dashboard]` | TBD |
| Business URL on receipt | `https://pantopus.com/@HANDLE` | `business_profile.url` set (was already in place) | `[VERIFY IN LIVE STRIPE]` | TBD |
| Support email on receipt | `support+{handle}@pantopus.com` (P2.9) OR Pantopus support address (v1 fallback) | `business_profile.support_email` NOT set per-persona; falls back to whatever the connected account inherited at `accounts.create` time | `[VERIFY IN LIVE STRIPE — note what email address appears under "Contact" on the receipt]` | TBD |
| Customer-facing billing portal merchant name | Persona `display_name` | Same as receipt merchant name (driven by `business_profile.name`) | `[VERIFY IN LIVE STRIPE]` | TBD |
| Customer's credit-card statement | `PANTOPUS *@HANDLE` | Driven by `settings.payments.statement_descriptor` | `[VERIFY IN LIVE STRIPE — confirm the descriptor appears verbatim on the card statement, not truncated/replaced by Stripe]` | TBD |
| Creator-side: fan's billing legal name visible to the creator? | NO — never shown in any Pantopus UI | Pantopus's own dashboards aggregate revenue only and never query Stripe billing-name endpoints (§6.3) | `[VERIFY IN LIVE STRIPE — confirm fan legal name does NOT appear on any Connect Express dashboard surface that Pantopus links to]` | TBD |
| Creator's legal name leakage anywhere | NO | `accounts.update` never sends `individual.first_name` / `individual.last_name` from `applyPersonaBusinessProfile`; KYC fields are set ONCE at `createConnectAccount()` time and Stripe owns their visibility | `[VERIFY IN LIVE STRIPE — inspect every receipt + portal surface and note any place creator legal name appears]` | TBD |

## 3. Stripe support ticket

Open ticket with the following questions. Paste answers under each.

### Q1. Receipt PDF merchant name fallback
> For a Connect Express connected account, does the receipt PDF
> rendered to a customer use `business_profile.name` from the
> connected account, or some other field? Specifically: can it ever
> fall back to the connected account's legal name
> (`individual.first_name` / `business_name`)?

**[STRIPE TICKET — paste answer]**

### Q2. Support email per-Product
> Can the `support_email` shown on a customer receipt be set
> per-Product / per-Price, or is it always the connected account's
> `business_profile.support_email`? If only per-account, can the
> platform set a different `support_email` per connected account at
> account creation, and does updating it later via `accounts.update`
> propagate to receipts for already-existing subscriptions?

**[STRIPE TICKET — paste answer]**

### Q3. Per-Product display name on receipts
> If a connected account has multiple Products (e.g., a creator with
> multiple personas — though Pantopus is one persona per user at v1),
> can each Product have a different display name on receipts, or do
> all receipts use `business_profile.name`?

**[STRIPE TICKET — paste answer]**

### Q4. Statement descriptor handling
> We set `settings.payments.statement_descriptor` to
> `PANTOPUS *@HANDLE`. Stripe's docs say descriptors can be modified
> per-charge. For Connect Express direct charges, does our
> account-level descriptor flow through unchanged to the cardholder's
> statement, or does Stripe apply additional sub-merchant prefixing?

**[STRIPE TICKET — paste answer]**

### Q5. Connected-account dashboard fan-name visibility
> When a creator logs into their Stripe Express Dashboard via
> `accounts.createLoginLink`, does the transaction list show the
> fan's billing legal name? We want to know whether we should warn
> creators in our UI that the Stripe Express dashboard exposes
> personal data about fans that Pantopus's own dashboard does not.

**[STRIPE TICKET — paste answer]**

## 4. Live test-mode transaction findings

Operator runs:
1. Create a test creator (e.g. `e2e_creator_p28`) and complete Connect
   Express onboarding for a persona with a unique handle (e.g.
   `mayabuilds_p28`).
2. Create the default tier ladder + Stripe Prices.
3. Subscribe a test fan (use Stripe test card `4242 4242 4242 4242`)
   to the Member tier.
4. Capture and paste below:

### 4.1 Statement descriptor

`[VERIFY IN LIVE STRIPE — paste the value as shown in the Stripe
Dashboard's Payment view's "Statement descriptor" field]`

### 4.2 Customer receipt PDF

`[VERIFY IN LIVE STRIPE — attach PDF or paste merchant name + URLs
+ support contact as rendered]`

### 4.3 Customer email receipt

`[VERIFY IN LIVE STRIPE — paste subject, From: address, From: display
name, body merchant name]`

### 4.4 Customer's Stripe billing portal view

`[VERIFY IN LIVE STRIPE — paste the merchant name + plan name + any
other identifying fields shown to the customer]`

### 4.5 Creator's Connect Express dashboard

`[VERIFY IN LIVE STRIPE — note what fan data is visible in the
Connect Express transaction list]`

## 5. Remediation status

| Category | Item | Status |
|---|---|---|
| A — Pantopus fix in API call args | `business_profile.support_url` not set | **FIXED in P2.8** |
| A — Pantopus fix in API call args | `business_profile.product_description` not set | **FIXED in P2.8** |
| A — Pantopus fix in API call args | `business_profile.support_email` per-persona | **DEFERRED to P2.9** (SES catch-all) |
| B — Stripe limitation | Connect Express dashboard fan-name visibility | **PENDING** ticket Q5 |
| B — Stripe limitation | Per-Product receipt name | **PENDING** ticket Q3; may force a v1.1 multi-persona compromise |
| C — Different code path | TBD pending live verification | TBD |

## 6. Acceptance criteria for §17 #7 RESOLVED

§17 #7 flips from PARTIALLY VERIFIED to RESOLVED when:

1. Every `[VERIFY IN LIVE STRIPE]` row in §2 + §4 is filled in.
2. Every Stripe support ticket question in §3 has an answer pasted in.
3. Any Category B / C items have follow-up issues filed and linked.
4. The audience-profile design v2 §17 #7 is updated to RESOLVED with
   a backlink to this doc.

Until then, treat §6.3 as "best-effort, source-verified, live-unverified."

## 7. Note on the audience-profile design doc location

`docs/audience-profile-tier-ladder-design-2026-05-08-v2.md` (the
authoritative spec) is currently authored outside this repo (it was
provided as session context, not committed). The §17 update calling
this doc out as the resolution artifact will land when that doc is
checked in. Until then, this verification doc IS the source of truth
for the §17 #7 status — anyone reading the design will be pointed
here from `personaPaymentsService.js`'s top-level comment.

