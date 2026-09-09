# Staging account delivery

The staging runtime had no SMTP host or credentials. The email service silently
returned success through its development fallback even with production security
settings, so signup and recovery could claim to send links that never left the
process. Supabase's actual settings also report Google and Apple disabled;
email authentication is enabled. Those provider checks are read-only.

## Email repair

Email delivery now fails closed without a transport. Metadata-only local preview
requires explicit `EMAIL_DELIVERY_MODE=log` and a development/test environment;
staging and production cannot use it. Auth links and message bodies are not
logged. SMTP readiness has bounded timeouts and runs before account lookup for
signup, verification resend and password recovery. An unavailable server returns
the same retryable 503 for known and unknown email addresses.

A late send failure after registration preserves the new identity and returns
`VERIFICATION_EMAIL_UNAVAILABLE`, `accountCreated` and `requiresEmailVerification`
with guidance to request another link. It does not delete an account after a
potentially ambiguous SMTP result. Recovery/resend retain indistinguishable
acknowledgements if a later account-specific send fails. Native and web wording
acknowledges the request without claiming delivery; transport errors remain
visible through the existing error paths.

## Verification and next milestone

- 36 focused delivery, registration and identity-firewall cases pass.
- Full backend: 277 suites / 4,338 tests pass, with 16 existing skips in one
  suite. Privacy gates pass.
- Strict SwiftLint and SwiftFormat pass for all touched Swift files.
- Final frontend CI and actual staging SMTP-capture signup → verification →
  login → recovery → new-password login remain to be run.

No external mailbox delivery, OAuth callback, runtime rollout or production
change is established by these local tests. Use an isolated capture inbox on
existing capacity for synthetic staging messages, then record exact runtime
identity and cleanup. No paid service or live charge/postcard is authorized by
this report.

## Live candidate findings

Candidate source `41372f71657e3462938c8b15dbfde9ab0a97cf48`, image
`sha256:9891109b915f54d7a2e8e6d822e257972a28eefe4aadb0e34f64b16b1efe0e12`,
runs separately from the public staging API with jobs disabled. Mailpit v1.31.1
is pinned by image digest; SMTP binds only to the host's Docker bridge and its
inbox API binds to loopback. No relay is configured and recipients are restricted
to synthetic example.com addresses. This uses existing capacity. Configuration
follows the [official Docker](https://mailpit.axllent.org/docs/install/docker/)
and [SMTP](https://mailpit.axllent.org/docs/configuration/smtp/) documentation.

Actual signup sends one captured verification email and rejects pre-verification
login. Resend sends a second captured link with the exact private return target;
verification succeeds once, replay fails, and verified login reaches the account
profile. Recovery rejects an ordinary access token and gives identical request
acknowledgements for known/unknown addresses. Its captured recovery link changes
the password and rejects link reuse and the old password.

The immediate new login exposed a real bug: JWT issuance was 127 ms before the
millisecond revocation cutoff because JWT `iat` uses whole seconds. Login returned
200, then the profile request returned SESSION_REVOKED. New deterministic cases
at millisecond 127 and 999 reproduce it. The repair preserves the precise cutoff
and waits for the next token second before acknowledging reset/lockdown; 141 targeted auth/delivery tests and all 4,340 backend tests pass. Live
verification of the updated candidate is next. Do not repeat the consumed recovery token.

The configured auth-link origin is `https://staging.pantopus.com`, which currently
fails DNS resolution. Captured token/API verification proves backend behavior,
not browser completion through that hostname. Staging web hosting remains next.
Private account/capture artifacts are under `account-delivery/`; no credentials
or captured messages belong in Git or chat.

## Repaired candidate — live reset passed twice

Updated candidate source `ca47de8b043c7ae5ec2b7f9d4c6e161843bd831d`, image
`sha256:f18f0f4a05ca17dd6c195bbdfc9feb07592ba3b0221fc4b6594d3641b8545df8`,
passes two fresh recovery-link cycles. Each reset was followed immediately by
credential login and an authenticated own-profile request, with no harness
sleep. The JWT issuance offsets were +804 ms and +143 ms after their precise
cutoffs. The prior access token was denied in both cycles. All 4,340 backend
tests pass. Original consumed links and earlier revoked sessions were not reused.

## Android visual verification

Final CI at `ca47de8b0` passed iOS on all three simulators and Android
instrumented tests, but failed two email-status screenshot baselines that
still expected the old delivery claims. The actual CI screenshots were
visually inspected. Only those two baselines were regenerated for the intended
“Check your email” / “Link requested” copy; all seven status-screen snapshots
then passed local verification. The remaining final-head CI must pass before
merge. PR #16's merged-master CI also passed in full.
