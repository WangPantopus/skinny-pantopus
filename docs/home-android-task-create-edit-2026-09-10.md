# Android retained task creation and sparse editing

This checkpoint connects the Android task form to the protected task-creation
receipt contract. One encrypted request is stored for the exact API origin,
account and Home before a creation POST. Reopening discovers it without sending
another request. The user can explicitly retry the same UUID and original body;
network errors, HTTP 408/429 and unverified replies preserve that command.

The response must bind the exact actor, Home, request and task. A known task ID
and payload hash are saved before removing the original request, so failed
cleanup and reopening retain the receipt proof. The returned task is the current
projection and may legitimately have a changed title. An occupied recovery slot
or failed protected-storage operation cannot start a replacement request.

Only a creation POST explicitly rejected with `400 HOME_RECORD_INVALID` or
`409 HOME_TASK_CREATE_RETIRED` offers **Clear saved request**. This action checks
the current session and exact stored record, closes the form and does not POST
or delete a task. Other conflicts, malformed receipts and unknown outcomes do
not offer this acknowledgement.

Editing sends only changed fields and explicitly encodes null for intentional
clears. Untouched dates, recurrence rules and task types retain their exact
server values. Every requested field must match the raw update reply, including
equivalent date normalization, before a current authorized task projection is
shown. Dirty input survives foreground reload. An uncertain edit retains its
original sparse patch in the current form for an explicit retry.

Both form modes recheck current collection or record capabilities and the
opening account/session. Leaving, backgrounding or replacing the session hides
content and invalidates suspended work and late picker callbacks. Confirmation
is consumed once without delayed or optimistic navigation. Recovery has an
explicit retry control rather than inheriting an editable form's dirty gate.

## Verification

The final host build passed all **134 JVM tests across nine classes**, with zero
failures, errors or skips. Coverage includes the form, current access, creation
coordinator, protected store, actual Retrofit request bytes and existing
list/detail consumers. The separate **two Compose instrumentation tests passed**
on `Pantopus_Entry_API_34` (Android 14), exercising the actual enabled retry and
disabled in-flight controls. Fresh XML counts were independently inspected.

Formatting, `git diff --check` and Detekt passed without findings. Android lint
reported zero errors, 212 existing warnings and 17 informational findings. Both
the app and instrumented-test APKs assembled. The final build completed in
3 minutes 27 seconds; the isolated Compose run completed in 34 seconds.

Independent review identified and repaired an initially disabled recovery
control, missing confirmation of requested edit values and dirty-input
replacement on foreground reload. The final reviewed paths passed. The first
build stopped at four static-analysis findings after app compilation; named
HTTP/date constants and an equivalent validation return expression repaired them
without waiving rules. The second run had 132 passing unique tests and two failing
concurrency fixtures, each automatically retried three times. Those fixtures had
competed or cancelled before their first scheduled request entered transport.
Explicit transport-entry barriers and durable-original assertions now prove the
intended overlap. Both pass in the final run; no production behavior or timeout
was changed for that fixture correction.

Operator evidence is retained outside Git:

- `/private/tmp/pantopus-home-android-task-create-r3.log`
- `/private/tmp/pantopus-home-android-task-create-instrumented-r1.log`
- Exact selector, source and SHA manifests under
  `/private/tmp/pantopus-home-android-task-create-*`.

The nine JVM XML reports are in the Android app's
`build/test-results/testDebugUnitTest`; the two Compose results are in
`build/outputs/androidTest-results/connected/debug`. These checks establish
request/recovery/control behavior and a buildable app, not full hosted household
or physical-device acceptance.

## Remaining work

Exact notification-to-task routing is next, followed by private attachment
controls and full installed-app task journeys. Edit recovery is retained by the
form's ViewModel, not across
process death; reopening the task after process loss reads current server values.
This checkpoint stores recurrence data but does not implement automatic task
generation or notification scheduling. No hosted migration, provider setting,
paid service or physical-phone installation changed.
