# Staging mail verification recovery — September 9, 2026

## Scope and reproduced failure

Work is isolated in `/private/tmp/pantopus-staging-mail-retry`, branch
`codex/staging-mail-retry`, based on merged PR #26 (`635f57571`). Production,
public staging API/worker, the browser candidate and unrelated design work are
preserved. Only existing/free capacity and Lob test keys are used.

A real Lob sandbox postcard was accepted, then the test process deliberately
lost the provider's response. The existing application returned failure and
deleted its attempt, token and job. This reproduced invalidation of a code
already accepted for printing. The exact test postcard and disposable address
were deleted; the synthetic actor remains with push disabled and no household
access or push tokens. No physical mail was sent. Private evidence is retained
under `staging-mail/lost-response-probe.log`; credentials, code and provider IDs
are excluded from Git.

## Repair in progress

- Dispatch claims a job before calling the provider. Concurrent workers or a
  later process cannot send the same claimed job again.
- Bounded retries reuse one Lob idempotency key and identical in-memory payload.
  Definitive input/auth rejection is separate from an uncertain network/provider
  outcome. No raw provider response or verification code is logged.
- Uncertain sends and failed receipt writes retain their verification proof.
  Repeated starts return the existing verification; unresolved resends preserve
  the newly printed code and refuse to print again. Resends preserve the unit.
- A signed Lob event can recover an original receipt using the application's
  correlation ID. Transient webhook persistence failures request redelivery.
- The browser retains code entry for the saved verification and displays
  “Checking mail delivery.” Its status action checks the receipt without
  creating another postcard.

[Lob documents](https://help.lob.com/print-and-mail/building-a-mail-strategy/managing-mail-settings)
that idempotency keys expire after 24 hours. This repair retries only briefly
inside the original dispatch; it never treats an old key as permission to send
again after a process restart. A persistently uncertain delivery requires
provider/webhook reconciliation. The application does not store plaintext codes
in user-readable job metadata.

## Verification and remaining work

The first 195 focused backend tests and nine browser mail tests pass, including
lost receipts, preserved code confirmation, repeated starts, competing workers,
receipt-write failure, unit preservation, webhook recovery/retry and browser
code entry. Web type checking reports zero errors and changed-file lint passes.
The initial full backend run found one dispatch mock missing its durable receipt
and an unrelated intermittent residency HTTP socket failure. The mock is fixed;
all 40 affected/security tests pass. The final full run passes all 4,478 backend tests and privacy gates. All 1,000
web tests pass; full web lint has zero errors (existing warnings remain).

Live acceptance of the repaired application is still pending. Also exercise
simultaneous *new* starts, which are a different race from competing dispatch
workers, and finish transactional admission/rate-limit protection if needed.
A crash before dispatch may still require reconciliation; this is not an
outbox worker or a claim of automatically recovering every process interruption.
The separate native landlord/ownership postcard path has not been certified by
these web/address-service checks. No production migration or release is implied.

## External prerequisite

The owner confirmed there is no active Smarty subscription and plans to activate
one for testing and launch. Activation followed by real DPV, unit, eligibility,
error/retry and access-boundary acceptance is required before address verification
is ready. A one-time reminder is scheduled for September 10 at 9 a.m. Pacific.
Do not purchase a plan on the owner's behalf. Google/Apple staging OAuth remains
disabled; its real callbacks are separate unfinished acceptance.
