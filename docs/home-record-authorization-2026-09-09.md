# Home task and calendar authorization checkpoint

This checkpoint applies current record permissions to Home tasks and calendar
events across the Home API, mail conversion, scheduling visits, dashboard,
Hub, and briefing projections. Personal task tables remain unchanged. Ordinary
role defaults remain the shipped 24 rows; this migration adds no role grants.

## Authority and record identity

`20260910060000_home_record_transactions.sql` introduces service-only read and
mutation transactions. They lock the exact Home and current authority/proof
rows, then records and original mail in a consistent order. Explicit role,
verification state, age ceilings, access dates, and permission overrides apply
after lock waits. An unavailable authority lookup returns a retryable 503.

- Task and event reads require `tasks.view` or `calendar.view` and the record's
  visibility. Creator, assignee, and viewer IDs never override a type or
  sensitive-read denial. Viewer IDs are not a private-visibility mode.
- An editor can create and edit/delete their own readable records. A task
  assignee with `tasks.edit` can change completion status; editing another
  author's content or deleting it requires `tasks.manage`. Event management
  uses the analogous calendar permissions.
- Assignees and viewers must have current verified, known-role access to the
  resulting record. A private creator can assign only themselves. Completion
  timestamps come from the server and are cleared when a task reopens.
- Assignment notifications re-read the exact current task, require the same
  assignee, and use its current title. Delivery is best effort after commit; it
  is not an atomic notification reservation and cannot retract delivered alerts.
- RSVP is an atomic upsert for the authenticated user and exact readable event,
  and requires the event to request RSVP. Clients cannot nominate another user.
- Home and author identity are immutable. Task media have an additive exact
  `(task_id, home_id)` foreign key; historical mismatches remain quarantined
  rather than being silently deleted.
- Direct browser reads and writes to task, event, attendee, and task-media tables
  are closed. Browser clients use the authorized API projections. Existing
  scoped sharing remains on its exact DTO/receipt API.

The exact creator of an unfinished private Home can use their own members-only
tasks and events, including after saving their own WiFi or pending verification
evidence. This exception still rejects prior verified/established or foreign
household history, known minors, expired access, and explicit denies. Own
record audit history does not permanently prevent cleanup. Attached storage
continues to require retirement before task or Home deletion.

## Original mail and derived reads

Task source mail is retained in immutable `source_mail_id`. The existing
`mail_id` foreign key may become NULL when mail is deleted; the retained source
keeps a copied private task inaccessible instead of silently declassifying it.
Legacy source hints without verified provenance require review.

Every nonnull Home identity must match the selected Home. Every explicit user,
attention recipient, and destination must agree with the reader. Expired,
shredded, business-scoped, and view-count-limited mail cannot supply this Home
task journey. An unbound personal mail item can be copied only by its exact
recipient into a Home where they independently have task creation permission;
later reads remain restricted to that recipient. It is never implicitly shared
with the household or an external token recipient. Shared household mail can
supply an external task DTO only when all destination discriminators remain
compatible with that exact household.

Mail conversion creates one task, source link, and audit transition atomically.
An exact retry returns the existing task. The mail interface preserves its
pending/completed labels while storing canonical open/done values. Mail source
previews are projected inside the same authorized transaction.
Deleting that task clears only its current source backlink and permits a later
conversion. A new NOT VALID backlink foreign key also clears links during a
whole-Home cascade without discarding unresolved historical mail. Failed audit
writes roll back both deletion and unlinking; a competing conversion creates
one replacement after the delete commits.

Dashboard, Hub, and briefing task/calendar counts and titles use these same
filtered records. Calendar booking projections require consistent Home and
owner IDs; foreign EventType references never supply another Home's title.
Scheduling availability's busy-interval calculation is a separate existing
path and is outside this checkpoint; it does not project task/event titles.

## Deliberate unfinished journeys

**Live task attachment upload/download/retirement is unfinished.** Legacy task
media return safe metadata and `HOME_TASK_MEDIA_REUPLOAD_REQUIRED`, with no URL,
storage key, or thumbnail URL. Upload requests first authorize the exact task,
then return `HOME_TASK_PRIVATE_STORAGE_REQUIRED` (409), with no provider upload
or metadata write. Task deletion and whole-Home deletion preserve attached
metadata until storage retirement can be completed.

The prior task route passed six arguments in the wrong order to the five-argument
`s3Service.uploadHomeTaskMedia(buffer, originalFilename, userId, taskId, mimeType)`
and expected a `category` absent from its `{key, url}` return. Its stored URLs
were also permanent public-style URLs. This checkpoint does not claim that old
objects or cached URLs have been revoked; no storage provider was modified.
Private reservations, upload/finalize authorization, exact authenticated byte
delivery, recovery, and retirement remain the next attachment milestone.

Task-to-gig publication now returns `HOME_TASK_GIG_FLOW_REQUIRED` (409) after
exact task write authorization. The old placeholder bypassed the protected gig
publication/payment flow and used incompatible columns. A complete conversion
through that protected flow remains unfinished.

Client form capabilities and partial-save messages remain a following milestone.
The API includes per-record edit/complete/delete/upload capabilities, preserves
omitted values, supports explicit NULL clearing, and recognizes existing web
general/recurring task labels without adding database types or permissions.

## Verification

- 128 final focused backend tests pass, including exact route/service bindings,
  sanitized failures, source conversion, RSVP, metadata quarantine, and derived
  briefing projections. The document dashboard's existing count/denial tests
  also pass with fixtures for the new record RPC; their document assertions
  remain unchanged.
- All 29 real SQL contracts and 29 generated pgTAP wrappers pass on the disposable
  combined development database. The one earlier named-sharing direct-SELECT
  assertion now accepts either no visible row or the stronger denied SELECT.
- 17 observed-lock-wait races pass: actor revocation/read/write denies and
  expiry, assignee state/role/permission changes, visibility/reassignment,
  original-mail recipient/expiry/deletion changes, disabled RSVP, concurrent
  RSVP, duplicate source conversion, and deletion versus reconversion. Exact sixteen-Home, three-account, and
  source-mail fixture cleanup passes.
- Application lint checks 173 functions and 77 trigger bindings with zero
  errors and the same five pre-existing warnings.
- The pinned Supabase function gate passes with the same six reviewed extension
  errors and 40 CLI warnings. All six real SDK/PostgREST baseline checks pass;
  the final database has zero synthetic users, Homes, tasks, events, attendees,
  media, or Mail remaining and a 23-migration ledger.
- Independent parent review found no additional P1/P2 issue in this bounded
  source. The final source replays cleanly through 23 migrations and passes all
  29 contracts/wrappers and 17 races on that clean database. Before the final
  current-assignee/title change, the isolated full backend run passed 4,906
  tests with 16 skips across 303 suites. The final source passes its 128 focused
  tests and all 15 privacy E2E checks. Three subsequent full attempts each
  passed 4,907 tests with 16 skips and one local HTTP socket failure, in a
  different test each time: notifications.context, fridgeCards, and
  broadcastTiers. All three unchanged suites pass their focused rechecks:
  8, 11, and 28 tests respectively (47 total). These full-run failures remain
  recorded verification limits; no assertion,
  production behavior, or timeout was relaxed to obtain a pass. Final-head
  remote CI remains required before integration.

No hosted schema, provider state, or production data changed. Operator logs and
synthetic concurrency diagnostics remain outside Git.
