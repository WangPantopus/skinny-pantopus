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

Page availability is not account acceptance. Fresh browser signup, captured-link
verification, password recovery, cookie/CSRF and exact return remain next.
The Mac's system resolver temporarily retains the earlier negative answer;
public DNS and certificate checks use the verified address with hostname checks.

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
