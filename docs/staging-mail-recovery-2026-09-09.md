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

## Delivery recovery milestone

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

The repaired private candidate runs `593cfbafabddf6425c4e6510eeac21570d28a357`
(image `6465d0406c2d088eb3fb3b43775f97f814646e5efdc5da741162945f4a6799f4`).
Its previous image remains stopped for rollback; public API/worker and browser
containers are unchanged. [PR #27](https://github.com/WangPantopus/skinny-pantopus/pull/27)
is a draft; its [first CI run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34390656532)
passed. PR #26's [merged-master CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34388309333)
passed; PR #25's older master run was superseded/canceled.

Live service publication → API status/confirmation now passes. The probe discarded
three actual Lob test responses; replay returned the same provider postcard ID
all three times. API start/resend retained one attempt/job, authentication and
foreign-account checks denied access, and a wrong code created no occupancy.
A locally signed synthetic webhook, carrying the actual Lob receipt metadata,
recovered the receipt through the real API. This is not evidence of an externally
delivered Lob callback. The exact printed code then created one verified member
occupancy; repeated confirmation did not consume proof again or add membership.

Cleanup passed: the one Lob test postcard, temporary Home/occupancy/address,
attempt/token/job, synthetic webhook and address events are removed. Both fixture
sessions are revoked, with zero push tokens or household memberships. Original
Home document IDs are preserved. The synthetic actors remain as private evidence.
Do not repeat these completed publishers. The public browser has not received
the new web source; live browser-to-current-release acceptance remains separate.

## Atomic request admission milestone

A new competing-start regression reproduced two attempts before either request
could observe the other. `admit_mail_verification` now creates the attempt,
secret hash and mail job in one transaction. Per-user and per-address locks
serialize both duplicate requests and postage budgets. Existing proofs and unit
selections survive retry. The function is service-only; the matching backend
fails closed if the migration is missing. It does not rewrite historical rows.

The migration `20260909184500_mail_verification_admission.sql` has been applied
only to the owned local `mail_verification_contract` clone so far. Its SQL
contract verifies retry/role boundaries, budgets and rollback after a duplicate
job ID. Nine real competing PostgreSQL connections verify one attempt for a
shared request and independent user/address budget enforcement. All 13 SQL
contracts, 119 application functions and 73 trigger bindings pass the full lint
harness, with six previously reviewed stock PostGIS findings. The initial local
clone used a different database owner and could not create the PostGIS fixture;
matching the clone owner to the existing replay fixed this setup issue without
changing application grants or production.

The final 4,480-test backend run and privacy gates pass, including the new
missing-migration regression. Next apply
the checked additive function only to Free staging, preserving mail/file rows and
its absent migration ledger, build the matching private candidate, and run real
concurrent API starts. No production migration or release is implied.

A crash before dispatch may still require reconciliation; this is not an outbox
worker or a claim of automatically recovering every process interruption. The
separate native landlord/ownership postcard path remains unverified by these
web/address-service checks.

## External prerequisite

The owner confirmed there is no active Smarty subscription and plans to activate
one for testing and launch. Activation followed by real DPV, unit, eligibility,
error/retry and access-boundary acceptance is required before address verification
is ready. A one-time reminder is scheduled for September 10 at 9 a.m. Pacific.
Do not purchase a plan on the owner's behalf. Google/Apple staging OAuth remains
disabled; its real callbacks are separate unfinished acceptance.
