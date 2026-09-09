# Staging browser and vendor acceptance — September 9, 2026

Work continues on `codex/staging-vendor-acceptance`, initially based on PR #23
at `f6f250ff0`. PR #23's current-head CI is still running; PR #22's
[merged-master CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34378389968)
passed. Preserve the original checkout and its unrelated Places design work.

## Frontend DNS and HTTPS

The owner supplied the authenticated Cloudflare session. Added only a new
DNS-only A record for `staging.pantopus.com` to the existing staging host.
The apex, `www`, production API and existing staging API records were preserved.
Public DNS resolves the new record. Let's Encrypt issued a separate certificate,
valid through December 8, 2026; trusted hostname verification and TLS 1.3 pass.

The existing web image (`74e300c76d13`, source `a9a27f8b1`) now serves HTTPS.
Login, registration, verification, forgot-password and reset-password pages all
return 200 with indexing disabled. HTTP redirects to HTTPS; ACME challenges keep
their existing webroot. Existing nginx files are hash-identical to their backup.
Account query URLs are excluded from proxy access logs and use no-referrer.

For these browser checks, nginx sends same-origin `/api/` and Socket.IO requests
to the tested account candidate (`ca47de8b`, image `f18f0f4a05ca`, port 18002).
Next's own `/api/og/` routes stay on the web server. The public staging API/worker
remain on `65d2cc2d9`; the Home candidate remains separate on port 18003.
The account candidate uses the Free staging database and private SMTP capture,
accepting only synthetic `@example.com` recipients, without relay. No capture UI
is exposed. This is not yet a unified release candidate or real email delivery.

A separate nginx renewal hook now reloads only for this frontend certificate.
The existing API hook is preserved. Certbot's scoped renewal dry run, including
the deploy hook, passes; the existing renewal timer remains enabled.

## Completed browser email journey

Fresh real Chrome browser checks now pass against the HTTPS staging hostname:

- Signup requires verification, sets no authentication cookie and preserves the
  requested `/app/place?account_return=browser-check` destination in the captured
  email. The capture uses only a new synthetic `@example.com` account.
- Opening the captured verification link succeeds, reaches sign-in, and returns
  to that exact path and query after sign-in. Reusing the link displays an
  invalid/expired error and receives a denial response.
- Access and refresh cookies are Secure, HttpOnly, SameSite=Lax and scoped to
  the staging hostname. Refresh has its narrower endpoint path. Tokens are
  absent from the login/refresh JSON and inaccessible to page JavaScript.
- Missing CSRF denies a profile mutation with 403. A valid CSRF header permits
  the synthetic edit; the original profile value is restored afterward.
- Browser forgot-password → captured recovery link → new password → immediate
  sign-in returns to the exact requested destination. The old password and old
  access/refresh cookies are denied; the recovery link is single-use.
- Cookie refresh and subsequent profile access succeed. Local logout clears
  cookies and invalidates both the saved access and refresh credentials.

One private test selector initially matched both the intended error and Next's
empty route announcer. Narrowing it to the visible error completed the replay
check; the verified signup was not repeated. The browser fixture is retained as
synthetic evidence, with its profile restored, push disabled and no device tokens.
No physical iPhone step was needed. Real SMTP relay and Google/Apple OAuth
callbacks remain unverified; the captured email journey does not certify them.

## Sandbox payment probe

Provider inventory confirms Stripe test mode with a live test-mode balance read,
plus a Lob test key. No real charge or physical mail was created. Two new
synthetic accounts have push disabled and zero device tokens.

A real sandbox saved-card retry exposed a defect: the first add creates one
owned payment method, but repeating it returns HTTP 201 with `paymentMethod:
null` after the duplicate database insert fails. The list still contains exactly
one card; the other synthetic account cannot read or change its default.
Repair and repeat acceptance are pending. The exact test customer, card and
unconfirmed SetupIntent are privately recorded for scoped cleanup after testing.

Private evidence and resumable helpers live under the ignored operator directory
`20260907/staging-vendor`; credentials, email links and raw logs stay there.
No production changes or new paid resources were made.
