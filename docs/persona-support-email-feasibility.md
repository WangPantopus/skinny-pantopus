# Persona-specific support email — feasibility

Date: 2026-05-08
Status: PARTIAL — app code ships in P2.9; AWS SES (or equivalent) inbound-routing infra must be deployed by ops before the per-persona address is exposed to fans.
Resolves (partially): `docs/audience-profile-tier-ladder-design-2026-05-08-v2.md` §17 #8.

---

## 0. Why this doc exists

§17 #8 proposed `support+{persona_handle}@pantopus.com` as the address
shown on Stripe receipts so the creator's real email never leaks. The
P2.9 prompt asks: is the existing email infrastructure capable of
catch-all routing, and if not, what's the deferral plan?

## 1. Outbound infrastructure

`backend/services/emailService.js` uses **nodemailer** with generic
SMTP, configured via env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `SMTP_FROM`). The provider behind those credentials is
operator-chosen; both AWS SES SMTP and SendGrid SMTP work without
code changes.

This is fine for **outbound** mail (Pantopus → user). Per-persona
support email needs **inbound** mail (fan replies to receipt → Pantopus).

## 2. Inbound infrastructure

Pantopus has **no inbound email handling today**. The `routes/`
directory has zero email-inbound routes; the only email-related
external surface is outbound Lob postcard webhooks (delivery status
callbacks, not actual email).

Setting up inbound mail for `*@pantopus.com` requires deployment-
side work that lives outside this codebase:

- **AWS SES** (recommended if Pantopus already uses SES for outbound):
  - Verify the `pantopus.com` domain in SES (DKIM + receipt rules).
  - Configure a Receipt Rule with recipient `*@pantopus.com` whose
    action is "Invoke Lambda function" (or "S3 + SNS").
  - Lambda parses the email, computes an HMAC over the JSON, and
    POSTs to `https://api.pantopus.com/api/internal/email-inbound`.
- **SendGrid Inbound Parse** (alternative): point an `MX` record at
  SendGrid's parse host; configure the parse webhook to POST to the
  same internal route. Pantopus app code is identical either way.

## 3. P2.9 scope decision

**Defer the visible per-persona address until the inbound infra is
deployed.** Specifically: ship the app-side code now, but gate the
`support_email` Stripe arg behind an env flag so deployments without
the SES/Lambda routing don't accidentally promise fans an address that
doesn't deliver.

Behavior matrix:

| `PERSONA_SUPPORT_EMAIL_DOMAIN` env | What Stripe receipt shows |
|---|---|
| unset / empty | No `support_email` set per-persona; Stripe falls back to the connected account's account-level support email (Pantopus support address). |
| `pantopus.com` (or other deployed domain) | `support+{handle}@pantopus.com` set on `business_profile.support_email`. |

This makes the rollout safe: ops sets the env var **after** the SES
Receipt Rule + Lambda are live. Until then, fans see the Pantopus-wide
support address (no per-persona hint, but mail does deliver).

## 4. Components landed in P2.9 (app side)

1. `applyPersonaBusinessProfile` reads `PERSONA_SUPPORT_EMAIL_DOMAIN`
   and conditionally sets `business_profile.support_email`.
2. `services/personaSupportEmailRouter.js` — pure function that maps
   a parsed inbound email to a forwarded message to platform support
   OR a polite-bounce reply.
3. `routes/internalEmailInbound.js` — HMAC-authenticated webhook the
   Lambda calls. Validates `X-Pantopus-Signature` against
   `EMAIL_INBOUND_HMAC_SECRET` env, then calls the router.
4. `app.js` mounts the route at `/api/internal/email-inbound`.

## 5. Components NOT landed (ops side)

- AWS SES / SendGrid Inbound Parse configuration. See
  `docs/persona-support-email-setup.md` for the runbook.
- `EMAIL_INBOUND_HMAC_SECRET` env wiring in production secrets
  manager.
- Lambda code that signs + POSTs the parsed email. Sample contract
  is in the setup doc.

## 6. §17 #8 status

**PARTIAL** — flips to RESOLVED when:

1. SES Receipt Rule (or equivalent) deployed for `*@pantopus.com`.
2. Lambda is signing + posting to the internal route in production.
3. `EMAIL_INBOUND_HMAC_SECRET` is set in production secrets.
4. `PERSONA_SUPPORT_EMAIL_DOMAIN=pantopus.com` is set (the visible
   switch that turns the per-persona address ON).
5. A live round-trip test: send to `support+e2e_creator@pantopus.com`,
   verify it lands in the platform support inbox with the
   `[@e2e_creator]` subject prefix.
6. `personaPaymentsService.applyPersonaBusinessProfile` re-runs over
   existing connected accounts so the new `support_email` propagates
   (handled by the next persona-update reconcile pass).

Until those six are checked off, the per-persona address is
**configured in code but not exposed in production**.
