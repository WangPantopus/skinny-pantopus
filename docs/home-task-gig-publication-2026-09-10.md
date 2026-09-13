# Home task to Gig: recoverable publication backend — September 10

The ordinary `POST /api/gigs` flow now supports an explicitly reviewed private
Home task source. Publication, the private task backlink, one original receipt
and a private audit commit together. The task stays open; publication does not
assign anyone, charge a card, mark the work complete or start recurrence.
**Browser/iOS/Android composer entry and retained recovery are not yet wired.**
This is a verified backend milestone, not completed user-facing conversion.

## User-visible contract and boundaries

The [publication contract](../backend/contracts/home-task-gig-publication.md)
defines the next client work. A current, authorized adult household member must
review public text, price, explicit location and terms. Private mail, files,
access secrets, source IDs, assignees and recurrence are not copied. The source
Home/task IDs stay in the private receipt/backlink; they are absent from the
public Gig. Conversion is personal posting, with an explicitly selected location
and address reveal after assignment or never public. Another source/proxy cannot
be attached to the same request.

The source must be open, unassigned and unlinked, with automatic recurrence
inactive. The command carries the exact source timestamp, original UUID and
explicit review acknowledgement; its request requires the opening session scope.
Current authorization is rechecked inside the same Home/mail/task transaction.
A lost committed response recovers the same receipt. Changed terms conflict;
a fresh UUID cannot republish a linked source. Replaying the original command
returns current Gig state and cannot undo later price edits or cancellation.
Deleting the Gig retains its receipt and cannot turn recovery into new posting.
Whole-Home deletion preserves publication history pending resource retirement.
The legacy mail shortcut remains explicitly unavailable until its client flow
uses this protected composer; it has not been silently re-enabled.

Ordinary publication fanout remains best effort. Replay never broadcasts another
publication or sends duplicate saved-search alerts. A transport failure before
first fanout can omit that alert; no durable Gig delivery claim is made here.
Provider bidding/payment and eventual completion still use the ordinary Gig
lifecycle, with PR #34's remaining payment work and acceptance outstanding.

## Findings resolved while exercising actual paths

- The fresh canonical baseline omitted archived `Gig.task_format`, while the
  actual creation route always wrote it. Additive migration `20260910215000`
  restores the enum/column/index without rewriting historical migration files.
  Creation explicitly supplies `in_person` instead of NULL, which would violate
  the restored required column. Ordinary HTTP creation is exercised against SQL.
- Joi ISO-string normalization truncated PostgreSQL's microsecond source version,
  rejecting an unchanged task as stale. The validated timestamp now retains its
  original precision. The real HTTP creation/replay journey covers this boundary.
- Conversion validates money precision rather than silently rounding reviewed
  amounts. Past deadlines prevent a new publication; original recovery can still
  pass validation after a deadline has elapsed.
- Replay now derives its location from the current Gig, not the original request.
- The first deletion-policy wrapper failed the repository's explicit dependency
  coverage check. The final additive migration extends the complete existing
  policy directly; all existing deletion/authority contracts pass.

Migration `20260910220000` contains the private receipt, source read and atomic
publication functions. The two new versions follow Home recurrence/projection
and do not collide with the paid tip reservation `20260910190000`. Current
inventory: Home 33 migrations, paid 21, combined 42 versions with no filename/body
collision. This is not final combined-branch replay or dependency approval.

## Actual verification and limits

- [HTTP/service driver](../scripts/db/test-home-task-gig-service.cjs): actual
  Express creation route, Joi validation, production service and real PostgreSQL.
  Missing/changed session, absent review, implicit Home location, public address
  reveal, over-precise money and foreign actor deny without publication. Lost
  commit response, same original retry, new-UUID conflict, changed terms, later
  cancellation/price, revocation, stale task and deleted-Gig tombstone pass.
  One Gig/backlink/audit/receipt is observed, private source fields are absent,
  and the source stays open with no payment/assignment. Ordinary creation also
  passes the restored schema. Authentication and downstream fanout are synthetic;
  no external provider or browser UI is claimed by this driver.
- [Concurrency driver](../scripts/db/test-home-task-gig-concurrency.py): eight
  observed PostgreSQL lock waits cover identical and conflicting requests,
  different UUIDs, rollback, membership revocation, task editing/deletion and
  concurrent Gig cancellation. Original state and exact cleanup pass.
- [SQL state contract](../scripts/db/contracts/home-task-gig-publication.sql):
  direct-client table/RPC denial, frozen Home, explicit deny, account ban, age,
  assigned/completed task, active recurrence, past deadline, source preservation,
  private data separation, deletion guard and replay/retirement pass.
- Final pinned CLI **2.116.0** empty replay passes all **33 migrations**. All
  **38 SQL contracts** and **38 pgTAP wrappers** pass. Reviewed complete function
  lint passes: **213 application functions, 84 trigger bindings, zero application
  errors**, five existing application warnings and six existing reviewed stock
  PostGIS diagnostics. The initial bootstrap used the installed older CLI; the
  final replay and reviewed lint use the pinned version.
- [Populated upgrade driver](../scripts/db/test-home-task-gig-upgrade.py): an
  isolated copy reconstructed to the immediately preceding schema preserves
  **15,111 original rows across 362 public/auth/storage tables**, comparing
  every original field. Only the documented new format default is added. A
  synthetic historical canceled Gig retains its original price/status. Clone
  setup initially failed on active source sessions and managed schema ownership;
  the final run uses dump/restore with the local managed administrator and passes.
  It is a local preservation rehearsal, not hosted ledger adoption. Fixtures
  were removed; the final empty replay subsequently removed the temporary copy.
- All six real SDK/PostgREST baseline checks pass on the final replay and clean
  their exact fixtures.
- All privacy gates pass. The first full backend run passed **5,164 tests with
  16 existing skips**. A final run passed 5,162 and hit one unchanged payment
  suite's HTTP timeout/parser failure; its **20 unchanged checks** immediately
  pass separately. The timeout cause is unproven. Current-head remote CI remains
  required; these observations are not a waiver or a claim of a clean final
  broad run. User priority is actual workflows, not coverage percentages.

Private evidence is under `/private/tmp/pantopus-home-gig-*`: final HTTP/races,
SQL/pgTAP, reviewed lint, fresh replay, populated replay `r6`, backend/affected
suite and SDK logs. Credentials, raw records and operator logs are not committed.
Exact fixture cleanup is asserted by the committed drivers.

## Native CI continuation

Predecessor `4ff1277dd` passes backend/web/database/Android CI but fails two
existing iOS checks in [run 34545744441](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34545744441):
`HomeClaimWithdrawalTests.testDelayedOldAccountClaimLoadCannotEnableWithdrawal`
and `NewMessageViewModelTests.testSearchTriggersDirectoryFetchAndShowsAllVerified`.
The former used a nominal 500 ms polling budget; the latter asserted after a
fixed 600 ms debounce/network sleep. They now wait for the observed condition
within a bounded monotonic deadline, preserving their assertions and app code.
The simulator build, Swift format/strict lint and both affected suites pass:
**17 cases repeated three times, 51 successful executions**, no skips. Local
runtime is iOS 26.5; final remote iOS 18.5 checks remain required. This is test
synchronization verification, not new installed native conversion acceptance.
The dedicated `D2596847-1D20-47EE-BB47-54AC59EBF180` simulator was shut down;
the owner's existing booted simulator was preserved.

## Next action

Connect the browser composer with protected original-command/receipt recovery,
then actual Chrome acceptance against this production API/SQL path. Follow with
native composer/recovery and installed iOS/Android conversion journeys. Verify
unknown results, reload/background, competing views, changed account/session,
revocation, source edits, terminal Gig state and exact destination before marking
conversion complete. Continue relationships/residency, ownership, lease/resource
cleanup, payments and the ordered release backlog. Keep PRs #32/#34 drafts.
All paid services remain deferred to one final owner launch-preparation bundle.
