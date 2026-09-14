# Android private task attachments — September 10, 2026

The preserved Android attachment draft now builds and passes its local quality
and installed acceptance gates. Uploads, downloads and removal remain bound to
current Home/task access and the opening actor/session. Unknown uploads retain
the same selected bytes and UUID; confirmed retirement has an explicit guarded
acknowledgment. Legacy attachments offer no old public-byte URL.

## Findings resolved

A shared `readPrivateHomeMedia` helper erases a private result if cancellation
occurs as an IO read returns, before its caller takes ownership. It covers task
media downloads, system file selection, claim-evidence downloads and unpublished
preview bitmaps. Deterministic scheduler tests verify the cancellation boundary
and normal transfer of the original buffer. Response bodies stay inside `use`.

PDF preview opens an empty temporary file, unlinks it before any private bytes
are written, then renders through the seekable descriptor. Process death closes
the unlinked descriptor; it cannot leave a named cache file containing those
bytes. This is still disk-backed temporary storage, **not memory-only**. An actual
API 34 emulator test renders a synthetic PDF through this path and verifies no
named private-preview file remains. It does not claim forensic disk erasure.

The retired-upload compiler failure is repaired by capturing the typed network
failure before reading its code/body. Draft Kotlin formatting is corrected.
Five stale task-form images were visually reviewed and refreshed for the saved
recurrence wording and truthful scheduling disclaimer; the other two baselines
were retained. The control test now lays out its two independent states in a
Column, matching the product container, so one fixture cannot cover the other.

## Actual installed journey

A separate `Pantopus_Home_Task_Acceptance` API 34 emulator used a compiled
`http://10.0.2.2:18082` app with telemetry disabled. Its host HTTP fixture bound
only `127.0.0.1:18082`; unrelated port 8000 and the existing emulator were untouched.
The synthetic account signed in through the ordinary UI, with notification
permission declined because delivery was outside this task's scope.

The actual app passed Home → Tasks → create with a lost committed reply → close
and reopen saved request → exact original retry. The fixture recorded one
creation and one replay. An ordinary OS `pantopus://homes/.../tasks/...` intent
then opened the exact task. A synthetic 86-byte file obtained from the loopback
fixture was placed in the dedicated emulator's Downloads folder, selected via
the system Files picker, and uploaded through the real multipart client.

The fixture recorded one upload plus one explicit replay, with exactly matching
UUID, generated filename, MIME and bytes. The app displayed the exact downloaded
private text. Revocation followed by background/return hid the text and filename;
the fixture observed current task denial. Restored access allowed removal. All
four DELETE attempts targeted the original media ID: three injected uncertain
replies, each followed by an explicit retry, then confirmed retirement. The final
record was unavailable/retired and no Open attachment control remained. There
were zero rejected fixture requests. No API or authentication was stubbed inside
the app; ancillary Home/Place provider endpoints were explicitly unavailable.

## Verification and evidence

The complete local Gradle quality/build command passed: ktlint, Detekt, Android
lint (zero errors; 212 existing warnings), JVM checks, full Paparazzi verification,
debug APK and Android-test APK assembly. JUnit XML reports **4,486 passed, 80
skipped / 506 suites**. Existing skipped snapshot/baseline debt was not enabled or
silently counted as passing. The five changed images also passed focused
verification before the full run. The final instrumented bundle passed both
attachment-control checks and the real PDF descriptor preview (3 checks).

Private evidence:

- `/private/tmp/pantopus-home-android-final-gates-r1.log` and the app's generated
  JUnit/Paparazzi/lint reports; final PDF bundle build/static checks are in
  `/private/tmp/pantopus-home-android-pdf-build-r2.log`.
- `/private/tmp/pantopus-home-android-controls-pdf-final.log`.
- `/private/tmp/pantopus-home-android-ui-acceptance-result.json`, adjacent full
  synthetic fixture state, and `pantopus-home-android-{preview,revoked,ui-final}.xml`.
- `/private/tmp/pantopus-home-android-driver.py` records the actual UI driver;
  `scripts/ios/home-task-ui-fixture.py --port 18082` provides the reusable strict
  HTTP fixture. `pantopus-home-android-ui.env` and install logs remain private.

## Remaining limits

Pending file bytes/UUIDs survive the task ViewModel, not process death; there is
no automatic cold file replay. The installed journey used a synthetic local
service and text file, with a separate real Android PDF rendering check. It does
not certify hosted SQL/object storage, physical push delivery, every document
format or all Home/Place workflows. Existing skipped snapshots remain a broader
release gate. PR #32's remote required checks must run on this final commit;
local passes are separate evidence. PR #34 is still unfinished even though its
current checks pass. Neither branch was merged; no hosted migration, owner phone
or paid service changed.
