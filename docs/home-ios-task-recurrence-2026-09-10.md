# iOS automatic Home task recurrence — September 10, 2026

## Result and next action

iOS now exposes explicit start/change/pause controls from a saved Home task,
displays actual automatic schedule status, and retains the exact original change
and confirmation in Keychain until the user reviews it. The installed simulator
journey passes through normal login, OS task routing, real screens, process death,
background return and protected storage. This completes the iOS recurrence
checkpoint within the local limits below. Android recurrence remains next.

Continue Android controls, protected recovery, schedule projections/filters and
installed acceptance before task-to-Gig and the remaining ordered Home scope.
Both feature PRs remain unfinished drafts. No merge, hosted migration, deployment,
owner-phone action or paid-service activation occurred. Paid dependencies remain
one final launch-preparation bundle.

## Implementation

- `HomeTaskRecurrenceView` opens through an atomic sheet presentation from the
  exact task detail. It provides daily/weekly/monthly intervals of 1–365, the
  existing searchable timezone picker, current schedule/next date, explicit
  activation/change/pause, original retry, and explicit confirmation review.
  Saved legacy rules still do not activate a schedule. Task detail/list chips and
  the Recurring filter use `automatic_recurrence`, including tasks without a
  legacy rule. The creation form points users to the saved task's repeat screen.
- `HomeTaskAccess` validates task/configuration/receipt identities and current
  session proof. Every change performs a fresh management preflight, then checks
  the original protected draft again immediately before dispatch. Start binds
  the reviewed task timestamp and configuration revision; pause sends only its
  original UUID, action and revision. A fresh source read must agree with the
  recurrence endpoint's task timestamp before controls are available.
- `PendingHomeTaskRecurrenceStore` stores the original origin/actor/Home/task/
  UUID/command and optional confirmation in non-synchronizing,
  `whenUnlockedThisDeviceOnly` Keychain. It contains no credentials or session
  proof. Exact comparisons serialize saves/clears on the main actor within the
  app process. Unreadable storage does not become an empty slot.
- `HomeTaskRecurrenceViewModel` retains uncertain changes and validates exact
  receipts. Confirmation is durable before the final current-state read and is
  consumed only by explicit review. Replaying an earlier start cannot overwrite
  a later pause. Closing/backgrounding invalidates pending UI work; foreground
  reload waits for an in-flight action to settle. Changed account/access/source
  and competing stored requests cannot reuse stale controls or replace the
  original command.

## Finding resolved

The first targeted execution exposed a private-state cleanup ordering issue:
an account change invalidated the access lifecycle revision before the model's
error handler checked it, allowing old task data to remain in model memory even
though the screen hid it. The handler now retires a changed account before the
old-revision check. The affected regression passes and asserts both no POST and
immediate private task-state removal.

## Verification

| Check | Observed result |
| --- | --- |
| Full SwiftLint strict lint | Pass, zero findings |
| Full SwiftFormat lint on final source | Pass, 0 of 2,133 files require formatting; 14 excluded |
| Final Debug `build-for-testing` | Pass, ad-hoc signed simulator app/test bundles |
| Actual built host Keychain entitlement verifier | Pass |
| Recurrence regression rerun after the cleanup fix | 14 passed, zero failed; includes actual Keychain round trip |
| Related Home task access/list/form/create/recovery/media checks | 136 passed in the preceding selected execution |
| Installed recurrence UI journey | 1 passed, zero failed, about 123 seconds |
| Final source whitespace and Python fixture syntax | Pass |

The first selected execution contained 150 tests: 149 passed and the cleanup
case failed. After repairing it, all 14 affected recurrence tests were rerun and
passed. The 136 unchanged related checks were not rerun unnecessarily. These
are separate executions, not a claim that a final full iOS suite ran locally.

The 14 recurrence cases cover exact replay after a lost reply and later pause,
confirmed cold recovery, close/account change during preflight, close after POST,
competing stored commands, mismatched receipts, failed confirmation persistence,
changed hashes, definite rejection versus unknown outcomes, unreadable/unwritable
storage, current denial, source timestamp races, failed final reads/clear,
minimal pause bodies, actual Keychain scope/clear and malformed projections.

### Installed journey

The dedicated **Pantopus Recurrence Acceptance** iPhone 17 simulator ran iOS
26.5. The actual signed binary's API/socket URLs were verified as loopback
`http://127.0.0.1:18083`; analytics/error-reporting keys were empty. The app used
the normal login and protected session. No seeded-auth or API-stub app flags
were used. Notification prompts alone were disabled for this unrelated journey.

`HomeTaskRecurrenceJourneyUITests` drove these real interactions:

1. Sign in, open the exact task using its canonical OS link, open Repeat schedule,
   choose Los Angeles in the timezone picker, and start repeating.
2. The synthetic HTTP fixture commits the original start and loses its reply.
   A separate fixture command then pauses the schedule. Terminate/relaunch the
   app and retry the stored start: the original UUID is confirmed while the
   current schedule remains paused.
3. Terminate/relaunch again with the confirmed receipt still present; explicitly
   review it, start a new schedule, review that confirmation and reach Pause.
4. Lose the committed pause reply, background/return, and retry/acknowledge that
   exact pause without creating a replacement.
5. Revoke current access, background/return, verify that private task content
   and mutation controls disappear, restore access and reload the paused state.

The final fixture has four committed originals (including the separate pause),
two exact replays, two deliberately lost replies, zero rejected fixture requests,
four receipts and current revision 4/paused. Access is restored. Screenshots were
reviewed for the separate original/current states, active pause controls and
denied-access screen; no blank sheet or overlapping controls were observed.

### Reproduction and private evidence

Committed entry points are
`scripts/ios/home-task-recurrence-ui-fixture.py` and
`frontend/apps/ios/PantopusUITests/HomeTaskRecurrenceJourneyUITests.swift`.
The fixture requires an absolute private `--output` outside the checkout and
binds only loopback. The UI test skips unless the test runner has
`RUN_HOME_RECURRENCE_UI=1` and
`HOME_RECURRENCE_UI_ORIGIN=http://127.0.0.1:18083`.

Build with the same loopback API/socket settings, blank analytics keys, and
`CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES CODE_SIGN_IDENTITY=-`.
Run `scripts/ios/verify-simulator-keychain-host.py` against the resulting app.
Add the two UI environment values to a private copy of the generated xctestrun
beside the original build products, then use `xcodebuild test-without-building`
with `-only-testing:PantopusUITests/HomeTaskRecurrenceJourneyUITests` and
`-parallel-testing-enabled NO` on an isolated simulator.

Evidence stays outside Git:

- `/private/tmp/pantopus-home-recurrence-ios-build-r4.log`
- `/private/tmp/pantopus-home-recurrence-ios-lint-final.log`
- `/private/tmp/pantopus-home-recurrence-ios-format-final-r2.log`
- `/private/tmp/pantopus-home-recurrence-ios-tests-r1.xcresult` and adjacent log
  (initial selected execution, including the diagnosed failure)
- `/private/tmp/pantopus-home-recurrence-ios-tests-r2.xcresult` and adjacent log
  (all 14 affected tests passing after the fix)
- `/private/tmp/pantopus-home-recurrence-ios-ui-r1.xcresult` and adjacent log
- `/private/tmp/pantopus-home-recurrence-ios-ui-attachments/` (reviewed PNGs and
  summarized command evidence)
- `/private/tmp/pantopus-home-recurrence-ios-fixture-final.json`

## Limits, Git and cleanup

This installed native check uses synthetic HTTP authentication, tasks and
receipts. The fixture supplies a fixed next date and does not execute the worker
or calendar math. Real service/SQL generation and calendar/concurrency proof
remain the separate [engine](home-task-recurrence-engine-2026-09-10.md) and
[browser](home-web-task-recurrence-2026-09-10.md) evidence. This is not hosted
provider, physical-device or end-to-end production-worker acceptance.

Keychain evidence covers the entitled simulator host and actual app process
death. It does not establish cross-process compare-and-swap or every physical
device/keychain failure mode. Local iOS 26.5 checks do not replace required
remote iOS 18.5 CI. The gated installed journey is not silently enabled in
ordinary CI.

Origin and worktree/PR state were refreshed before work and again before the
milestone. Home started clean at `c7ebfdd2d`; its
[browser-head run](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34539565010)
has passed backend, database, web and iOS checks plus Android instrumentation;
Android lint/test/assemble was still running at this observation. Validate the
new iOS commit's own required CI separately. PR #34 remains clean at
`e9ef2decb`, green but unfinished/draft. The owner checkout's modified handoff
and two untracked design files are preserved. No migration changed in this iOS
milestone; the final combined Home/paid migration dependency and fresh/populated
replay remain required before integration.

After saving the final evidence, only the owned fixture listener on 18083 was
stopped and simulator `D2596847-1D20-47EE-BB47-54AC59EBF180` was shut down. The
owner's existing booted simulator, other runtimes/worktrees and local work were
left untouched. Private test artifacts and the dedicated simulator remain
available for diagnosis; no credentials, raw tokens or operator logs entered Git.
