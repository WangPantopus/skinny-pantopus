# Ordinary member household Task first use

H07/H08 continuation on `codex/home-permission-boundaries`. This report covers
ordinary household invitation admission and useful household-private Tasks.
It does not close the full onboarding inventory or establish hosted readiness.

## Reproduced baseline

Actual HTTP → production service → local SDK/PostgREST/SQL baseline r4 accepts
both shipped invitation variants: browser `member` with `tenant` preset, and
native bare `member`. The retained replay has no `HomeRolePreset` rows. The
existing tenant fallback remains canonical `member`; it is not `lease_resident`.
Both recipients have current shared My Homes and Home detail access after
acceptance, but all eight Task read/create/update attempts return
`403 HOME_RECORD_DENIED` without changing the existing Task or creation receipt.
There are no positive fixture overrides. Admission creates verified household
occupancy, zero residency or ownership claims, and no recipient ownership row.
Verified occupancy is not evidence that residency or ownership was verified.

An authorized owner control proves the real Task gateway works: a lost committed
creation reply retries the same UUID and body, returning one existing Task and
one receipt. Recurrence and Gig metadata reads succeed for that explicit adult
owner. The ordinary member denial is therefore an actual policy gap.

Private baseline evidence is under
`/private/tmp/pantopus-home-sender-invitations-r1/h07-http-baseline-r4/`, with
`source-and-evidence-binding.json`. The used fixture
`h07-http-baseline-fixture-r2/cleanup.json` verifies all 366 retained populated
tables, exact role rows, complete ledger and function/schema provenance.
Earlier runner attempts exposed harness column/arity and HTTP status assumptions;
their evidence remains private. The first mutated attempt also cleaned exactly.
Authentication, notification/email transport and app-shell data are controlled.
Browser and installed native UI evidence is separate.

## Deliberate policy change

`20260912050000_home_member_task_defaults.sql` adds only missing canonical
member `tasks.view` and `tasks.edit` defaults with `ON CONFLICT DO NOTHING`.
Existing role rows, including explicit false values, remain byte-for-byte intact.
Individual denies remain authoritative. No management, finance, residency or
ownership permission is introduced. Existing recorded roles, age bands,
membership dates and admission history are not rewritten.

This changes live authority for existing ordinary members as well as new
admissions. The existing gateway permits reading eligible household Tasks,
creating a Task, editing one's own readable Task, and status-only completion of
another person's Task assigned to the caller. Editing another creator's content
still requires `tasks.manage`. Manager visibility, sensitive visibility and
source-Mail recipient/attention/privacy checks remain independent boundaries.
`home.view` remains an overview permission; denying it alone does not revoke
separately granted Task access.

The Task default `visibility=members` means household-private. The existing
private-setup exception restricts its context to the creator's own `members`
records. Once that same Home establishes ordinary shared membership, those
records follow the existing household audience. This change adds no permanent
personally private Task audience or alternate visibility type.

Historical recorded `member` plus child age retains its recorded role but has
effective role `restricted_member`. The resolver reads defaults from the recorded
role and then applies the age ceiling, so such a child can gain `tasks.view`,
never `tasks.edit`. A new pending child cannot be admitted as canonical `member`;
the allowed `restricted_member` admission remains overview-only. Teens retain
their existing write ceiling. Null age retains historical ordinary compatibility,
while Gig publication still separately requires explicit adult membership.

Global default changes alter `home_invite_policy`, without rewriting stored
invitation rows or prepared recipient hashes. A pending non-null policy snapshot
rejects changed policy and requires a newly reviewed invitation. Repreparing the
same unchanged row does not repair that policy mismatch. Legacy null snapshots
retain their existing acceptance compatibility under current authority. Completed
decision receipts remain historical; saved Task creation receipts also retain
their original identity and payload hash.

## Candidate backend verification

The actual candidate passes all 49 raw SQL contracts and their 49 generated pgTAP
wrappers, the populated upgrade rehearsal, and ordinary member HTTP/SDK/SQL first
use. All mutations are rolled back or exactly cleaned; no migration is permanently
adopted. Browser and installed native first-use verification remains separate.

- The new passing SQL contract covers shipped policy admission without custom grants,
  creation/retry and own/assigned mutation authority, restricted/source privacy,
  current permission/status/time/freeze denial, historical versus newly admitted
  child behavior, old non-null/null snapshots and established household audience.
- Populated upgrade r1 applies the actual migration in an outer rollback
  transaction, checks all existing values except the intended two inserts,
  existing-member live access, prepared hashes, preserved role denies and
  idempotence, then compares complete retained rows and schema before/after.
- The HTTP runner keeps distinct `baseline` and `member-tasks` expectations.
  Candidate r1 passes actual member Task first use, same-original lost-reply
  recovery, current denial/recovery, empty media/current capability reads,
  other-creator and assigned-completion boundaries, and restricted/source privacy.
- Older exact reference counts change from 29 to 31. Existing complete before/after
  role comparisons remain. The prior invitation policy-change probe now changes
  an installed default and restores it exactly. A read-only collection fixture
  now records an explicit edit deny instead of relying on a missing member grant.

The HTTP candidate creates and accepts two ordinary invitations, creates two
member Tasks through a lost committed reply each, and recovers each exact request
without duplication. It edits and completes each Task, denies changed originals,
preserves them under edit/view denial and membership removal, and resumes after
restoration. Another creator's content edits remain denied; an assigned member's
status-only completion succeeds. Existing owner manager/sensitive Tasks and an
owner's personal-Mail-derived Task remain hidden. Six owned Tasks and five
creation receipts are present at the end; the sixth Task uses the existing
source-Mail transaction. Exact cleanup removes their owned source, notifications
and related history and restores all 366 retained populated tables and schema.

Private candidate evidence under the shared sender root:

- `h07-member-task-upgrade-r1/`: actual two-row migration, preserved populated
  decisions, old snapshot behavior, original hashes, idempotence and rollback.
- `h07-task-contracts-all-r2/`: 98 passing raw/generated executions and complete
  before/after retained row and schema comparisons.
- `h07-member-task-http-r1/`: actual HTTP results, safe request identity/hash
  evidence, role policy and owned admission/Task projections.
- `h07-member-task-http-fixture-r2/cleanup.json`: all four established cleanup
  flags plus complete populated-row/schema preservation across 366 tables.

The first focused SQL attempts exposed a fixture alias ambiguity, a PL/pgSQL
conditional syntax error and a remaining old `can_manage_tasks=false` assertion.
These were repaired to preserve the intended full-row/authority checks. The first
full suite also exposed four already-accepted recovery migrations absent from
the retained replay schema. The final suite applies those source migrations only
inside each rollback transaction; it does not infer adoption from the ledger.
All failed attempts preserve retained rows/schema and remain in private evidence.

The shared UI fixture defaults to `baseline`; only explicit final argument
`member-tasks` temporarily applies the candidate. It exposes real scoped
My Homes ownership-claim and Task media metadata reads. No storage upload,
download or paid/provider activation is exposed. Owned private source-Mail test
data is opt-in for HTTP privacy acceptance and included in exact cleanup.

The [browser first-use journey](home-browser-member-first-use-2026-09-12.md)
also passes its separately recorded admission, lost-reply and cold-login
continuation, own edit/completion and current-access cases. Its 1,221 web checks
pass with zero type errors. [Installed iOS first use](home-ios-member-onboarding-2026-09-12.md)
also passes: exact text, own edit/completion, current access and two deliberate
originals with two receipts/four creation POSTs. Its final production/unit source
passes 4,402 checks/168 skips; source/product bindings, durable evidence and exact
cleanup pass. [Installed Android first use](home-android-member-onboarding-2026-09-12.md)
also passes exact text, edit/completion/reopen, lost-reply cold recovery and
current permission/membership changes: one original, one Task/receipt and two
matching creation POSTs. Both variants pass 4,581 checks/80 skips. All four local
journeys, exact cleanup and durable bindings pass; the integration commit's
exact-head CI must be verified independently. Broader H07/H08 and the ordered
backlog remain open beyond these controlled existing-account journeys.

Verified durable backend evidence is under
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/home-invitation-handoff-20260912/member-onboarding-20260912/backend-member-tasks/`.
Its manifest preserves source copies and all prior attempts separately. All 165
bound backend/contract sources still match the primary candidate; durable files
were checked by size and SHA256 without accessing the database. Browser bindings
and its documented driver-only follow-up are separate. Raw private records and
operator material are excluded from Git.
