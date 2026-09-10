# Installed iOS Home task and private attachment acceptance

Status: draft preserved; first installed execution failed, September 10, 2026.
Source follows the iOS task media checkpoint `502de726f`. This report must not
be read as completed hosted storage or device notification acceptance.

## Scope

The installed app uses its ordinary HTTP login, protected task-create recovery,
canonical OS deep link, system Files picker, private byte renderer and removal
controls. The fixture binds only `127.0.0.1:18081`; it leaves the existing staging
tunnel on port 8000 untouched. A new dedicated simulator has no previous user
session. The compiled app API and socket URLs are checked before execution, and
external analytics configuration must be absent.

No seeded-auth or API-stub launch flags are used. The loopback fixture accepts
only the synthetic account declared in its source and cannot access a real
backend or object provider. A Safari HTTP download supplies a synthetic text file
to the normal Files picker. The source filename is different from the generated
name sent by the app's multipart uploader.

The planned sequence is:

1. Sign in normally, open the Home through its canonical link, then create the
   exact task through the household task form. The fixture commits the task and
   returns an interrupted reply; explicit retry must retain its original UUID
   and payload and return the same task.
2. Reopen that task through its canonical OS link, choose the synthetic file in
   the system picker, then recover an interrupted upload using the same upload
   UUID, MIME type, generated filename and exact bytes.
3. Open the private attachment and inspect its exact text on screen. Revoke
   current task access in the local fixture, background and return, then verify
   that content and metadata disappear before restoring access deliberately.
4. Remove the same attachment. The fixture must exhaust the HTTP client's two
   automatic retries before the explicit removal-retry UI can be tested. The
   final receipt must keep the same attachment ID, mark it retired and unavailable,
   and remove the private bytes while retaining history.

The fixture records only synthetic IDs, event names, byte counts and hashes.
It rejects changed request identities, payloads, MIME types, filenames, bytes or
session headers. It does not record passwords, bearer headers or raw multipart
bodies. Screenshots and execution logs remain private operator artifacts.

## Verification

The new UITest passes SwiftFormat, strict SwiftLint with zero findings and Swift
parsing. The loopback fixture passes Python compilation and an in-process
handler lifecycle check covering create/replay, multipart/replay, exact bytes,
revocation and removal/replay. The R1 actual app and UITest build passed. Before execution, the fixture was
corrected to exhaust automatic DELETE retries, and the exact preview locator was
changed to match the text element itself. The targeted R2 build also passed.

The first installed execution sent one successful synthetic fixture login request,
then exceeded the 30-second signed-in UI wait at UITest line 146. The fixture
recorded no created task, receipt or media; a visually inspected screenshot still
showed the login screen. The test continued looking for later controls after the
failed wait and was interrupted for the owner's fresh-session checkpoint. No
create, exact-task, picker, preview or removal acceptance is claimed.

Diagnose the login response/session persistence and simulator test-host
entitlements before repeating. The current observations do not establish the
root cause. Also make failed asynchronous waits stop the remaining sequence.
See [the continuation checkpoint](SESSION_RESUME_2026-09-10.md) for CI findings
and the private operator evidence locations.

Source files:

- `frontend/apps/ios/PantopusUITests/HomeTaskPrivateJourneyUITests.swift`
- `scripts/ios/home-task-ui-fixture.py`

For execution, first start the fixture on its isolated port. Build the actual app
for the dedicated simulator with `PANTOPUS_API_BASE_URL` and
`PANTOPUS_SOCKET_URL` set to `http://127.0.0.1:18081`. In a private sibling copy of
the generated xctestrun, set the UITest runner environment `RUN_HOME_TASK_UI=1`
and `HOME_TASK_UI_ORIGIN=http://127.0.0.1:18081`, then select only
`PantopusUITests/HomeTaskPrivateJourneyUITests`. Ordinary CI skips this explicit
operator test. Use a fresh simulator or ordinary logout before a repeat; never
change another account's Keychain to make the test pass.

## Limits

This is installed UI acceptance over controlled synthetic HTTP. It does not
replace the real SQL role/concurrency/cleanup contracts or prove hosted bucket
configuration, provider cleanup, APNs delivery or owner-phone installation.
Pending task and file recovery across account replacement, delayed callbacks,
retirement and malformed receipts retain their separate actual-app regression
coverage. Automatic task recurrence and remaining Home release gates stay in the
handoff. No new default permissions or paid dependencies are enabled here.
