# Browser ordinary-member first use

September 12, 2026. **Bounded existing-account first use passes locally.**
This report does not close H07/H08 or broader new-account/provider onboarding.

## Actual baseline

Chrome r5 uses the shipped browser invitation form's member/tenant default.
Normal sender login, reviewed creation, actual saved-link transfer, normal
sign-out/recipient login, reviewed acceptance, fresh access check and explicit
Done reach My Homes. The current response and screen show Member, shared Home
access and no deletion eligibility. They make no residency or ownership claim.
The Dashboard link opens the exact same Home ID and receives its actual 200
dashboard response. Its current member defaults do not offer Add Task. A known
Tasks route returns actual HTTP 403 with disabled creation.

That denied Tasks screen incorrectly also displays Active (0), Done (0),
Recurring (0) and “No active tasks.” The repair renders counts, rows and empty
messages only after a current collection has been verified. Retry remains
available on failure, and disabled creation now looks disabled. The Task form's
labels identify their inputs; Type, Priority and Status expose grouped selected
states, and save failures have an alert role.

The baseline uses actual production Home routes, Supabase SDK and SQL through
the owned loopback fixture. Authentication, delivery, app-shell responses and
fault boundaries are controlled. One sender and one recipient command complete,
both are acknowledged, and zero Tasks are created. Both browser fixtures were
exactly cleaned, preserving full row values and schema properties across 366
populated tables, role defaults, ledger and original functions.

Earlier attempts are retained privately. A real pre-hydration native GET login
defect was separately [repaired and verified](web-auth-form-hydration-2026-09-12.md).
Other driver interruptions were an overly strict select-label lookup and a
missing ownership-reader mount in the fixture. That mount now calls the real
production ownership route; it does not substitute an empty result.

## Candidate verification

The additive member Task policy is covered separately by the
[backend report](home-member-task-first-use-2026-09-12.md). No synthetic positive
permission overrides are used to make the UI journey pass. The prepared browser
driver requires explicit `member-tasks` fixture mode for its candidate journey;
baseline mode requires the original policy instead.

One actual default member invitation and acceptance complete and are explicitly
acknowledged. My Homes identifies the shared Member correctly, and its Dashboard
opens the same Home. The visible Quick actions menu starts a Task with Chore,
Medium and Unassigned defaults. A lost committed reply preserves the original
title, description and disabled fields. After closing Chrome completely and
normally signing in as the same member, Retry original request uses the identical
UUID and payload hash, leaving exactly one Task and one creation receipt.

Own description edits, completion with its timestamp, and reopening with that
timestamp cleared pass. Explicit `tasks.edit` denial leaves the Task readable
but disables creation, completion and form writes. `tasks.view` denial, a 503 read
and removed membership show unavailable access without false empty counts or
rows. Clearing the fault or restoring membership recovers the same current Task.
Independent `home.view` denial does not remove separately authorized Task access.
The confirmed original is explicitly consumed with Start another task; cancelling
the resulting blank form issues no replacement command. Default `members`
visibility remains household-private, not permanent personal privacy. No residency
or ownership claim is created; owner records remain unchanged.

These results deliberately preserve one original across bounded continuations:
admission r1, creation/lost reply r2, and recovery/lifecycle/denials r4. R1's driver
initially expected Add Task outside its actual Quick actions menu. R2/r3 exposed
the local Next development server redirecting an expired-session request from
`127.0.0.1` to `localhost`, outside the driver's permitted origin; the auth form
correctly remained disabled when its scripts were blocked. R4 re-enters the
original origin through normal sign-in. This proves cold recovery after sign-in,
not persistent provider sessions or hosted redirect configuration. Failed attempts
are retained; no extra invitation, acceptance or Task was created to replace them.

The final fixture was exactly cleaned: all five preservation checks pass across
366 populated tables, including complete role rows, ledger and function properties.
The server is stopped. Screenshots at 390 pixels were inspected, with no horizontal
overflow, and no unexpected browser or transport errors occurred.

Current web regression passes 1,221 tests in 96 suites; zero type errors and
changed-source lint pass. Six collection regressions distinguish real empty
success from 403/503, malformed success, failed foreground refresh and an
account change during a held reply; optional roster failure cannot hide an
independently verified Task. Candidate exact pushed-head CI and native integration
are separate gates. The earlier auth repair at `80c702a34` has all 16 CI jobs green
in run `34737876978`; it is not CI evidence for this uncommitted candidate.

Private evidence: `/private/tmp/pantopus-home-member-first-use-r1/`, with accepted
baseline `browser-baseline-r5/result.json` and final continuation
`browser-first-use-r4/result.json`. Durable copies are indexed under
`home-invitation-handoff-20260912/member-onboarding-20260912/`
in the owner's private recovery directory. Original profiles and capabilities
remain private. Use `scripts/web/test-home-member-first-use.cjs` only against the
exclusively owned loopback fixture after inspecting its current mode and guards.
