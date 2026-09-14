# Explicit Home task recurrence engine — September 10, 2026

This checkpoint implements the database, API and worker contract for automatic
Home task recurrence in draft PR #32. **Browser/iOS/Android activation and recovery
controls remain the next milestone.** Existing saved recurrence preferences stay
inactive. No hosted migration, scheduler rollout, paid service or production
runtime changed.

## Behavior and retained authority

A user explicitly starts a schedule for an existing permitted task. Its due date
is the first occurrence, which already exists. Daily, weekly and monthly periods
support an interval of 1–365 and an explicit database-recognized timezone.
Activation chooses the next future occurrence; it never backfills old saved rules.
Unsupported legacy RRULEs remain byte-for-byte intact and are not interpreted as
new consent. The new schedule has its own explicit cadence.

Occurrences preserve local wall time. Missing monthly dates are skipped rather
than clamped; the January 31 pattern next occurs on March 31. Spring clock gaps
shift forward, autumn overlaps choose standard time, and subsequent dates return
to their original wall time. Calendar calculation examines at most 33 candidates,
including a leap-day annual interval after several missed years.

The worker selects at most 25 indexed due schedules each minute. After downtime,
it creates the latest due occurrence and advances directly to the next future
date, without creating a backlog of every missed date. It uses the existing
protected task-creation receipt, so the occurrence, audit, assignment notification
and delivery outbox commit with the schedule's progress. Failed progress writes
roll the whole operation back. A lost committed reply or competing worker cannot
create the same occurrence again. Reconciliation does not call a push provider;
the existing outbox relay handles current preferences and exact task destinations.

Future tasks copy title, description, type, assignee, priority, budget and
visibility/viewers. Attachments, details, mail and Gig associations are not copied.
Mail/Gig-linked source tasks cannot activate this contract. Creating a task does
not initiate a payment or publish a Gig.

Current Home authority and exact recipients are checked in the same established
Home/authority → source mail → task lock order. Revoked/expired access, a banned or
deleted activating account, canceled/deleted source tasks and changed source
details stop generation and require review. Completing the source task alone does
not stop its schedule. A source hash is independent of the worker connection's
timezone. Pause stops future creation and preserves existing tasks.

## API and command recovery

- `GET /api/homes/:homeId/tasks/:taskId/recurrence` returns the current permitted
  configuration, revision, task update timestamp, manage capability and session
  binding. It does not activate or generate anything.
- `POST` to the same URL requires the opening session scope and an original
  `request_id`. A start command includes `action: start`, `expected_revision`,
  `expected_task_updated_at`, `frequency`, `interval` and `timezone`. Pause accepts
  only `action: pause` and `expected_revision`.
- One immutable receipt binds the actor, Home, task, original request, action,
  request hash, resulting revision and receipt time. A lost response is recovered
  using that same request and command. Replaying an old start proves its old
  receipt while returning the current paused configuration; it never reapplies
  the old action over a later change.
- Stale revisions/source snapshots return a conflict. Reads and writes use
  `private, no-store`; account/session changes deny writes before database work.
  Malformed or mismatched projections/receipts never become client success.

The additive migration is `20260910200000_home_task_recurrence.sql`. Both new
tables and all recurrence RPCs are unavailable to raw anonymous/authenticated
database clients. The private Home setup/deletion policies explicitly admit only
the same creator's private recurrence history; foreign or established history
does not become private bootstrap. Authorized Home deletion removes its schedules
and command history. Ordinary role defaults remain unchanged.

## Verification

- Full Node 22 backend regression: **5,164 passed, 16 existing skipped**, 317
  passing suites. Focused recurrence/task-creation/assignment suites: **72 passed**.
  Privacy gates, including 15 privacy E2E checks, pass.
- Final fresh replay: **30 migrations** on a separate local Supabase PostgreSQL
  17 project. Pinned CLI 2.116.0 function validation passes: **211 application
  functions, 84 trigger bindings, zero unreviewed errors**. The six reviewed stock
  PostGIS diagnostics and 40 warning-level diagnostics remain visible.
- All **36 raw SQL contracts and 36 generated pgTAP wrappers pass**, with exact
  fixture cleanup. The CLI test command stalled downloading its `pg_prove:3.36`
  image and was stopped. These same committed contracts/wrappers were executed
  directly using `psql -X -v ON_ERROR_STOP=1`; every TAP plan and passing assertion
  was checked. The normal CI runner remains a separate required gate.
- Real transaction races verify one occurrence under competing workers; pause,
  source edits, creator revocation, recipient expiry and deletion winning first;
  a generated occurrence surviving a subsequent pause; and lost-response retry.
  Counts prove one creation receipt and one assignment event per occurrence.
- The production recurrence service runs against real service-role SQL with
  intentionally lost responses after command and occurrence commits. Its cold
  retries retain one command and one task/outbox, and an old start cannot undo a
  newer pause. This is service/database acceptance, not installed client or
  external-provider acceptance.
- Populated upgrade rehearsal preserves full-row fingerprints of **14,972 rows
  across 327 original tables**, including a historical completed task with an
  unsupported RRULE and budget. It activates no legacy schedule. Six real
  SDK/PostgREST baseline integration checks also pass.
- Fresh migration inventory: master **12**, Home **30**, paid-gig **21** numbered
  SQL migrations; no conflicting versions/body hashes. This inventory is not a
  combined Home/payment deployment or populated-upgrade rehearsal.

An initial full-test command ran from the repository root, where the existing
Express mock resolves dependencies from the wrong working directory. The final
full run above uses `backend/`, matching CI. No test or assertion was relaxed.

Private local evidence is under `/private/tmp/pantopus-task-recurrence-evidence/`:
`backend-full-correct-cwd.log`, `privacy.log`, `final-replay.log`,
`final-function-lint.log`, `direct-contracts.log`, `populated-upgrade.log`,
`sdk-postgrest.log` and `final-concurrency.log`. Reproducible service and observed
concurrency drivers are in `scripts/db/test-home-task-recurrence-service.cjs` and
`scripts/db/test-home-task-recurrence-concurrency.py`. Operator logs and account
credentials remain outside Git.

## Next action and release limits

Add explicit browser and native start/pause/current-state controls with retained
original commands, stale-state review and opening-account/session fences. Verify
actual client workflows, then task-to-Gig and the remaining Home lifecycle scope.
The existing clients still describe their old saved preferences accurately;
this backend checkpoint does not mark the complete recurrence feature finished.

Required CI on predecessor `e4069f244` is fully green. The new checkpoint must pass
its own required checks. PRs #32/#34 remain drafts until their scopes and combined
migration dependencies are complete. PR #34 remains at `e9ef2decb`; durable tips
and remaining paid-gig work are unfinished. Paid dependencies remain one final
launch-preparation bundle, and owner-checkout work remains untouched.
