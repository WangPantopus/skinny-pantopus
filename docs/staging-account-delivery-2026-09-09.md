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
