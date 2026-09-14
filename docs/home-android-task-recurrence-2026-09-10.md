# Android automatic Home task recurrence — September 10, 2026

## Result and next action

Android recurrence is complete within the local acceptance limits below: the
installed journey, full Debug/quality/snapshot/build gates and two instrumented
regressions pass. Browser, iOS and Android now have explicit recurrence controls
and retained original-command recovery. Continue task-to-Gig, then the ordered
relationships/residency, ownership, lease/resource and remaining payment scope.

## Scope

Android now has explicit start/change/pause controls on an existing Home task,
actual schedule projections in task detail/list/Recurring filters, and encrypted
original-command recovery. Legacy saved preferences still do not activate a
schedule. The editor supports daily/weekly/monthly intervals of 1–365 and the
existing searchable timezone picker. The creation form points to Repeat schedule
on the saved task for activation.

`HomeTaskRecurrenceAccess` binds current task/source/configuration reads and
receipts to the opening actor, Home, task and server session. A reviewed source
timestamp and schedule revision are sent with start. Every mutation performs a
fresh permission preflight; the controller rechecks the stored original and its
lifetime immediately before dispatch. The Retrofit contract sends only the
original wire fields and current scope header, with no-store caching behavior.

`PersistentPendingHomeTaskRecurrenceStore` uses a dedicated
EncryptedSharedPreferences file and Android Keystore. It persists the original
origin/actor/Home/task/UUID/command and optional confirmation, with no credentials
or session proof. Exact comparisons and durable commit guard replacement and
clear; unreadable storage is not treated as empty. A failed disk commit preserves
the prior logical value even if SharedPreferences has changed its memory cache.
The file is excluded from cloud backup and device transfer.

The controller serializes same-scope actions, preserves uncertain originals
through close/background/process death, stores a verified confirmation before
the final current-state read, and consumes it only after explicit review. Old
start replay cannot overwrite a later pause. Access/account/source changes hide
stale task content and prevent new mutations. Current credentials are checked
again after protected reads; the final dispatch check has no additional
suspension after its stored-snapshot read.

## Findings resolved

The first selected run passed 97 checks: 24 new recurrence tests and 73 related
Home task checks. Static analysis found a filename mismatch, a complex condition
and unnamed numeric constants; those are repaired in the subsequent source.
Review then added a regression for credential replacement during protected IO.

The first installed attempt exposed an initial Android notification prompt that
the UI driver did not yet dismiss. The corrected driver then signed in normally,
followed the exact OS task link and exposed a real editor crash: Material's
floating text-field label interpolated incompatible Em/Sp letter-spacing units
in PantopusTypography. The interval label is now separate, following other Home
forms, and an emulator regression renders and edits it under the actual theme.
The repaired app passes the full installed journey below. Both the actual-theme
field regression and real Keystore/EncryptedSharedPreferences regression pass.

## Installed journey

The dedicated API 34 `Pantopus_Home_Recurrence_Acceptance` emulator ran the actual
debug app. DEX inspection verified the packaged BuildConfig API/socket fields
as `http://10.0.2.2:18083` and the telemetry keys as empty. The driver used normal
sign-in, declined the unrelated notification prompt and followed the canonical
OS task intent. No authentication or API was stubbed inside the app.

The complete installed run passed:

1. Open Repeat schedule, select Los Angeles, start and lose the committed reply.
2. Pause through a separate fixture command; force-stop/relaunch and retry the
   original start. Its original UUID is confirmed while the current schedule
   remains paused.
3. Force-stop/relaunch again with the confirmed receipt still available. Explicitly
   review it, start a new schedule, review that confirmation and reach Pause.
4. Lose a committed pause reply, background/return, retry the same saved pause
   and explicitly acknowledge it.
5. Revoke access, background/return and verify private content/mutation controls
   disappear. Restore access and reload the paused schedule. Android Back closes
   the editor and task detail displays the actual paused projection.

There are four committed originals (including the separate pause), four receipts,
two exact replays, two deliberately lost replies and zero rejected fixture
requests. Final revision is 4/paused and access is restored. Hierarchies were
reviewed for original-versus-current state, reachable active controls, denied
content and refreshed task detail. Five form snapshots were visually reviewed
for the revised activation instructions; unrelated error/loading baselines were
retained.

Private installed evidence is under
`/private/tmp/pantopus-home-android-recurrence-ui-r3/`: `result.json`,
`fixture-final.json`, and the named XML hierarchies. The adjacent driver log
records success. `/private/tmp/pantopus-home-android-recurrence-apk-final-verification.txt`
binds the actual verified APK hash. Earlier `ui-r1` records the harness prompt
failure; `ui-r2` and `pantopus-home-android-recurrence-crash-r1.log` record the
diagnosed rendering crash. These are historical failures, not the final result.

## Final verification

| Check | Result |
| --- | --- |
| Full ktlint and Detekt | Pass |
| Android lint | Zero errors; 212 existing warnings and 17 informational findings |
| Complete Debug JVM checks and Paparazzi verification | 4,511 passed, 80 existing skipped / 510 suites |
| New recurrence checks within that full run | 25 passed, zero failures |
| Debug and Android-test APK assembly | Pass |
| Actual-theme interval render/edit | Installed API 34 check passed |
| Actual Keystore/encrypted-store round trip, scope isolation and exact clear | Installed API 34 check passed; no original IDs/timezone plaintext in the backing file |
| Normal installed app recurrence journey | Pass, final revision 4/paused |
| Python driver syntax and source whitespace | Pass |

The full command used an explicit private env file and ran `ktlintCheck detekt
:app:lintDebug :app:testDebugUnitTest paparazziVerify :app:assembleDebug
:app:assembleDebugAndroidTest`. The 80 pre-existing snapshot skips remain visible
and are not counted as passing. Local Debug coverage does not replace the final
commit's complete remote CI or certify every release/device configuration.

The 25 new JVM checks include the real Retrofit wire contract, malformed/current
state and receipt rejection, replay/confirmation retention, competing controllers
and protected slots, denied/current management changes, source timestamp races,
cancellation while durable IO completes, unpublished credential replacement,
failed persistence/clear and automatic projections without a legacy rule.

Private evidence includes
`/private/tmp/pantopus-home-android-recurrence-full-gates-r1.log`,
`/private/tmp/pantopus-home-android-recurrence-full-results/` (JUnit/lint XML),
`/private/tmp/pantopus-home-android-recurrence-instrumented-final.log`, and
the installed artifacts above. Earlier focused results are retained in
`/private/tmp/pantopus-home-android-recurrence-focused-r1-results/`.

## Reproduction and limits

The committed driver is `scripts/android/home-task-recurrence-journey.py`; it
requires the specifically named `Pantopus_Home_Recurrence_Acceptance` AVD and
clears only its debug app. It uses ordinary login/UI/OS intents, never seeded
authentication. The shared fixture is
`scripts/ios/home-task-recurrence-ui-fixture.py --port 18083`, bound only to
loopback. The APK must be compiled with API/socket URL
`http://10.0.2.2:18083`, blank telemetry keys and a private explicit Gradle env file.
Both fixture and driver require evidence outside the checkout.

Native HTTP identities/tasks/receipts and the fixture next date are synthetic.
The fixture does not run the worker/calendar math. Real generation remains the
separate [engine](home-task-recurrence-engine-2026-09-10.md) and
[browser](home-web-task-recurrence-2026-09-10.md) service/SQL evidence. No hosted
provider, physical-device push or production-worker acceptance is implied.
Same-process storage comparisons do not establish cross-process atomicity or
every physical Keystore failure mode. The editor retains screen-capture
protection; installed hierarchy evidence must not disable it for screenshots.

PRs #32/#34 remain drafts. Required CI on the final head, remaining Home/payment
scope and final combined migration dependency/fresh/populated replay are separate
integration gates. Paid dependencies remain one final launch-preparation bundle.

Origin and both worktrees/PRs were refreshed before work. Predecessor `8eacea7c8`
now passes all required checks in
[run 34542327929](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34542327929).
The new Android milestone must receive its own required CI. Paid-gig remains
clean/green at `e9ef2decb`, with unfinished scope. No migration changed here and
no feature branch was merged or deployed.

Only the owned 18083 HTTP fixture and dedicated recurrence emulator on 5556 were
stopped after acceptance. The existing emulator on 5554, owner simulator, hosted
runtimes, paid services and owner-checkout handoff/design edits remain untouched.
Private emulator/artifact state remains available for diagnosis outside Git.
