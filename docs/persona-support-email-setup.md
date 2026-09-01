# Persona-specific support email — production setup

Date: 2026-05-08
Companion to `docs/persona-support-email-feasibility.md` (P2.9 app-side
landed; this doc covers the ops-side setup).

---

## 0. Goal

Wire `support+{persona_handle}@pantopus.com` so:

- Stripe receipts list it as the merchant's support address (no
  creator real-email leak — §6.3 / §17 #8).
- Customer replies route to platform support (`support@pantopus.com`)
  with a `[@handle]` subject prefix.
- The creator's real inbox is never on the path.

The Pantopus app pieces are already deployed (`backend/jobs/personaSupportEmailRouter.js`,
`backend/routes/internalEmailInbound.js`). Until the SES Receipt Rule
is live AND `PERSONA_SUPPORT_EMAIL_DOMAIN` is set, fans see the
account-level Pantopus support address on receipts — no black-hole
addresses are exposed.

## 1. Architecture

```
      Stripe receipt → fan replies to support+mayabuilds@pantopus.com
                                    │
                                    ▼
      ┌─────────────────────────────────────────────┐
      │ AWS SES — Receipt Rule on *@pantopus.com    │
      │   action: invoke Lambda                     │
      └────────────────────┬────────────────────────┘
                           ▼
      ┌─────────────────────────────────────────────┐
      │ Lambda parser (Node)                        │
      │   1. Pull S3 object (raw MIME)              │
      │   2. Parse to { to, from, subject, text,    │
      │                 html }                      │
      │   3. POST to api.pantopus.com/api/internal/ │
      │      email-inbound with X-Pantopus-         │
      │      Signature: <hex(HMAC-SHA256(body))>    │
      └────────────────────┬────────────────────────┘
                           ▼
      ┌─────────────────────────────────────────────┐
      │ Pantopus backend                            │
      │   verify HMAC                               │
      │   parsePersonaSupportAddress(to)            │
      │     → forward to PLATFORM_SUPPORT_EMAIL     │
      │     → polite-bounce reply on unknown handle │
      └─────────────────────────────────────────────┘
```

## 2. Required env vars

| Env | Set in | Purpose |
|---|---|---|
| `PERSONA_SUPPORT_EMAIL_DOMAIN` | Backend (Pantopus app) | The visible switch. When set, `applyPersonaBusinessProfile` populates `business_profile.support_email = support+{handle}@<domain>` on Stripe. Until set, Stripe falls back to the account-level support address. |
| `EMAIL_INBOUND_HMAC_SECRET` | Backend AND Lambda | Shared 32+ byte secret. Backend rejects every request when unset (501). |
| `PLATFORM_SUPPORT_EMAIL` | Backend | Where forwarded mail lands. Defaults to `support@pantopus.com`. |

## 3. AWS SES setup

1. Verify the `pantopus.com` domain in the SES region you'll receive
   in (e.g. `us-east-1`). Add the DKIM CNAMEs to DNS.
2. Add an MX record on `pantopus.com` pointing at SES inbound:
   ```
   pantopus.com.  MX  10  inbound-smtp.us-east-1.amazonaws.com.
   ```
3. Create a **Receipt Rule Set** (or use the active one) and add a
   rule:
   - Recipients: `pantopus.com` (matches every recipient address;
     filter the `support+*` subset in the Lambda).
   - Action 1: **S3** — store the raw MIME in
     `s3://pantopus-inbound-mail/{rule}/{messageId}` (so we can replay).
   - Action 2: **Invoke Lambda function** —
     `pantopus-inbound-email-router`.
   - Spam + virus filtering: enable both. SES sets `X-SES-Spam-Verdict`
     and `X-SES-Virus-Verdict` in the message headers; the Lambda
     SHOULD drop anything other than `PASS`/`PASS`.
4. Activate the rule set.

## 4. Lambda contract

The Lambda receives an SES event, fetches the raw MIME from S3, parses
it (recommend `mailparser` from npm), and POSTs JSON to the backend.
Pseudocode:

```js
import crypto from 'crypto';
import { simpleParser } from 'mailparser';
import fetch from 'node-fetch';

export const handler = async (event) => {
  for (const record of event.Records) {
    const raw = await s3GetRawMime(record.ses.mail.messageId);
    const parsed = await simpleParser(raw);

    // Drop spam/virus per SES verdict headers.
    const spam = parsed.headers.get('x-ses-spam-verdict');
    const virus = parsed.headers.get('x-ses-virus-verdict');
    if (spam !== 'PASS' || virus !== 'PASS') continue;

    const to = (parsed.to?.value?.[0]?.address || '').toLowerCase();
    if (!/^support\+[a-z0-9_.-]+@pantopus\.com$/i.test(to)) {
      // Not a persona-support address — let the catch-all do its
      // own thing or drop silently.
      continue;
    }

    const body = JSON.stringify({
      to,
      from: parsed.from?.value?.[0]?.address || '',
      subject: parsed.subject || '',
      text: parsed.text || '',
      html: parsed.html || '',
    });
    const signature = crypto
      .createHmac('sha256', process.env.EMAIL_INBOUND_HMAC_SECRET)
      .update(body)
      .digest('hex');

    await fetch('https://api.pantopus.com/api/internal/email-inbound', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-pantopus-signature': signature,
      },
      body,
    });
  }
};
```

The shared secret MUST live in AWS Secrets Manager (or equivalent),
NOT in the Lambda's code or env-var literal — rotate quarterly.

## 5. Verification — round-trip smoke test

After steps 3 + 4 deploy:

1. Pick a verified test persona handle (e.g. `e2e_creator_p29`).
2. Send a plain-text email from any external account to
   `support+e2e_creator_p29@pantopus.com`.
3. Within 60s, the platform support inbox should receive a forward
   with subject `[@e2e_creator_p29] <original subject>`.
4. The body MUST contain the original sender address + the original
   message text + the persona display name.
5. The body MUST NOT contain the creator's `User.email`,
   `User.name`, or `User.id`.

If all 5 hold:
- Set `PERSONA_SUPPORT_EMAIL_DOMAIN=pantopus.com` in backend env.
- Trigger a reconcile pass that re-runs `applyPersonaBusinessProfile`
  for every existing persona's connected account so Stripe picks up
  the new value (or wait for the next persona-update event).
- Update §17 #8 status to RESOLVED in
  `docs/persona-support-email-feasibility.md` §6.

## 6. Rollback

If anything goes wrong:

1. Unset `PERSONA_SUPPORT_EMAIL_DOMAIN` in backend env. Stripe
   immediately falls back to the account-level support address on
   the next `applyPersonaBusinessProfile` call (incremental — old
   subscriptions keep the previous receipt template until renewal).
2. Disable the SES Receipt Rule. Inbound mail bounces with NDR;
   the Lambda stops invoking; the internal route stops receiving
   anything.
3. The HMAC-failure path returns 401 — if the secret rotates and
   someone doesn't update both sides, the route just refuses.

## 7. Observability hooks

Backend logs (`logger`):

- `email_inbound.signature_mismatch` — every request that fails HMAC.
  Spike = either a misconfigured Lambda or an unauthorized poke.
- `email_inbound.secret_missing` — backend received a request but
  `EMAIL_INBOUND_HMAC_SECRET` isn't set. Should never happen post-
  deploy.
- `persona_support_email.unrecognized_to` — email arrived at the
  webhook with a `to` that doesn't match the support+handle pattern.
- `persona_support_email.no_persona` — handle didn't match any
  active PublicPersona; polite-bounce sent.
- `persona_support_email.lookup_failed` — Supabase error during
  persona lookup. Investigate.
