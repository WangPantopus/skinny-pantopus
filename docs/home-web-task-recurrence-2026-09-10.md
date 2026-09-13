# Browser automatic task recurrence — September 10, 2026

The browser now explicitly starts, changes and pauses automatic schedules for
existing permitted Home tasks. This follows the committed
[recurrence engine](home-task-recurrence-engine-2026-09-10.md), `2a6f0b3ba`.
The complete recurrence feature still requires iOS/Android controls and installed
acceptance. Both feature PRs remain drafts; nothing was deployed or merged.

## User workflow

The task panel loads its current source and schedule before showing controls.
Users choose days, weeks or months, an interval of 1–365, and a timezone. A saved
due date is required. Unsaved source edits must be saved before activation.
Existing RRULE preferences stay unchanged and inactive until explicit activation.
Current next occurrence, paused/review state and generated count are visible.
The explanation covers missing monthly dates, local clock changes, missed dates,
completion, attachment copying and the effect of pausing.

The Recurring tab includes configured schedules even when the original task has
no legacy recurrence rule. Tasks and exact notification details distinguish
automatic, paused, review-needed and saved-but-inactive preferences. Confirmed
changes refresh the surrounding task list. If a source changed during recovery,
the visible task reloads before another activation can use its newer timestamp.

Visual inspection found the existing Priority row clipped High/Urgent in the
narrow task panel. Its four controls now fit in two rows. Actual Chrome images
were reviewed at desktop and 390-pixel viewport widths; repeat controls remain
reachable within the scrolling panel.

## Retained original changes

Before dispatch, the browser encrypts one original UUID and immutable command
with AES-GCM in IndexedDB. A nonextractable key and scope-bound authenticated
data protect the stored envelope. Credentials and session proof are excluded.
This is protection for local recovery, not a defense against arbitrary scripts
already executing within the same origin or a claim about browser backups.

Lost responses retain the exact command through panel close and page reload.
Retry sends that original request after current account/access and stored-version
checks. An old start receipt may be confirmed while the current schedule remains
paused; the replay never becomes a replacement start. Confirmed recovery persists
until explicit acknowledgment. Only definitive invalid/stale rejections can be
dismissed; unknown outcomes and request conflicts retain their original identity.

IndexedDB compare-and-write prevents another tab from replacing or consuming a
different saved request. A second stored-version check follows the asynchronous
permission preflight. Close, background, account change, lost management rights
or current task denial stops later dispatch. Current denial clears the task form.
Unreadable recovery blocks new changes and remains stored.

## Database compatibility

`20260910210000_home_task_recurrence_projection.sql` adds a five-field schedule
summary to already-authorized task responses: state, frequency, interval, timezone
and next due time. It exposes no recurrence actor, receipt or other task ID.
Existing task/calendar visibility, locks, final access checks and service-only
grants are preserved. Source edits/cancellation show review-needed status and no
next date. No existing records or legacy preferences are rewritten.

Home now has 31 numbered migrations, origin/master 12 and paid gigs 21. The
filename/body inventory has no collision. Home recurrence occupies `200000` and
its projection `210000`; paid-gig tip reservation `190000` remains separate.
This is not the final combined branch replay or hosted ledger reconciliation.

## Verification and limits

- **1,178 web checks pass across 92 suites**, including 18 new recurrence cases
  and the existing task/attachment checks. Final TypeScript checking and focused
  changed workflow lint pass. The shared timezone selector has one pre-existing
  hook-dependency warning; its only change here exports the existing zone list.
- Fresh **31-migration** replay passes on the dedicated local PostgreSQL 17
  project using pinned Supabase CLI 2.116.0. Function lint reports 211 application
  functions, 84 trigger bindings, zero unreviewed errors, the six reviewed PostGIS
  diagnostics and 40 visible warning-level diagnostics.
- **37 raw SQL contracts and 37 generated pgTAP wrappers pass**, with TAP plans
  and assertions checked through direct psql. This retains the earlier local
  pg_prove image-download limitation; normal remote database CI is separate.
  All six real SDK/PostgREST baseline checks pass after this migration.
- Applying the additive projection to the existing populated recurrence upgrade
  rehearsal preserved every full-row fingerprint: **15,108 rows across 362 public,
  auth and storage tables** in that database. This measured inventory differs
  from the engine checkpoint's narrower original-table inventory. It does not
  represent a hosted upgrade, external object restore or combined payment stream.
- The committed [Chrome acceptance script](../scripts/web/test-home-task-recurrence.cjs)
  opens the actual web task page, routes local HTTP through the production
  recurrence service, and calls real service-role SQL in an isolated contract
  database. It passes explicit activation, lost committed response/reload, later
  real pause plus old-start replay, retained confirmation/acknowledgment, real
  overdue generation, Recurring filtering, pause, competing tabs, close during
  preflight, current-denial clearing, account-change retirement and corrupt
  encrypted recovery. Seven browser POST attempts produce one generated task;
  the original plus generated task both survive pause. Exact fixtures are cleaned.
- Its HTTP authentication/session and unrelated application endpoints are
  synthetic. These results do not certify a hosted browser session, native
  recurrence controls, external push delivery or production worker rollout.
  The prior backend engine/concurrency evidence remains separate and valid.
- The initial Chrome run reached and correctly cleared denied task fields, then
  failed an assertion expecting the inner API message rather than the parent
  access message. That expectation was corrected; the full journey passed.
  Visual review and source review then added the priority fit and source/manage
  refresh safeguards; their final checks and complete Chrome rerun pass.

The engine head `2a6f0b3ba` now passes all required
[CI checks](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34536849754).
This browser/projection milestone requires its own final-head CI. PR #34 remains
`e9ef2decb`, green but incomplete. No prior waiver or green predecessor certifies
the newly pushed source.

Private synthetic evidence is under
`/private/tmp/pantopus-task-recurrence-evidence/`: `browser-reviewed/result.json`,
reviewed desktop/mobile screenshots, `web-reviewed-*`, `projection-contracts.log`,
`projection-function-lint.log`, `projection-sdk.log` and `projection-upgrade.json`.
These operator artifacts are outside Git. The browser fixture contains no real
credentials or user records and can be rerun against an explicitly selected
disposable contract database and a local web dev server.

The owned web listener on 3108 and dedicated `pantopus-home-recurrence-replay`
Supabase project were stopped after acceptance; the latter retained its local
backup. Exact browser/SDK fixtures were cleaned. The separate pre-existing
database container and empty owned contract databases were retained for native
continuation. Other owner listeners, simulators and worktrees were untouched.

## Next action

Implement equivalent iOS and Android recurrence state, explicit activation/pause
and protected original-command recovery; verify installed native workflows.
Native Recurring filters and saved-preference copy still need the new projection.
Then continue task-to-Gig, relationships/residency, ownership and lease/resource
cleanup, alongside the separately unfinished payment branch. Reconcile final
migrations and required CI before any merge. Keep all paid services in one final
owner launch-preparation bundle. Owner checkout files and other worktrees remain
preserved; completed Beacon and attachment acceptance must not be repeated.
