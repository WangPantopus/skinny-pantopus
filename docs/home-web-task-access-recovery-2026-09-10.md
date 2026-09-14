# Browser task access and upload lifetime — September 10, 2026

## Changes and observed workflows

A current task read returning 403/404 during save now removes the form's
private fields and task metadata, invalidates readiness and requires a new
permission read. Reloading discards the denied edits rather than repopulating
them from the prior field baseline. The exact task ID remains available for
that permission read, including tasks first created in the live form.

The upload helper accepts the form's lifetime guard and checks it after its
session preflight, immediately before each POST and after suspended work.
Closing or backgrounding before dispatch therefore cannot start an upload.
An already dispatched upload remains an unknown outcome requiring its original
identity; this change does not claim to cancel a committed provider operation.

Actual Chrome acceptance exposed the fixed app header covering the task
panel's Close button. The panel now renders through a body portal, carries an
accessible Close label and dialog name, traps Tab/Shift-Tab within its visible
controls and returns focus on close. The header no longer intercepts the
normal Close click.

## Verification

- 24 focused rendered-form/helper checks pass, including fresh 403/404 denial,
  discarded denied edits, delayed upload preflight and stopping a second file.
- The full web suite passes all 1,158 checks in 91 suites. Browser typecheck
  reports zero errors; full web lint reports zero errors with 1,160 existing
  warnings. Final changed-source lint and typecheck are also run after the
  keyboard focus follow-up.
- Actual Chrome over synthetic localhost HTTP passes current denial → hidden
  fields → permitted reload; sparse title editing preserves the untouched exact
  timestamp, recurrence rule and zero budget. The test holds the upload helper's
  own preflight response, clicks the actual Close button, then releases it:
  zero upload POSTs occur. Final Chrome also checks keyboard focus wrapping.
- Local source comparison finds no duplicate migration versions or different
  migration bodies at the same version across current master, Home and paid-gig
  branches. This is an inventory check, not a combined replay/dependency proof.

Private evidence is under `/private/tmp/pantopus-home-browser-access-*`.
The acceptance script blocks non-loopback requests and uses synthetic IDs and
HTTP replies; no hosted account, file provider, private credentials or paid
service participates. Unrelated chat/offers/professional fixture routes are not
certified by these checks.

## Remaining required findings

The two storage findings from [the checkpoint](SESSION_RESUME_2026-09-10.md)
remain open: unresolved per-file upload UUIDs do not survive panel reopening,
and confirmed creation recovery can be removed before a final UI lifetime
check. Complete these before calling the retained browser form milestone done.
Encrypted IndexedDB corruption/competing-tab/cold-reopen acceptance remains
required; the focused form tests above use a storage double. PR #32 remains
an unfinished draft. No merge, migration, provider activation or launch is
implied. Paid dependencies remain one final owner launch-preparation bundle.
