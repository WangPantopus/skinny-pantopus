# Android exact task notification routing

Android task assignment and completion notifications now resolve the exact Home
and task IDs from their metadata before considering the historical dashboard
link. Push dispatch and in-app taps share the same canonical UUID routing logic.
The task destination opens the existing read-only detail, which fetches current
authorized content and capabilities rather than displaying a notification's task
snapshot or opening an edit form.

An in-app task row must belong to the opening account's personal notification
context and current session. Taps and direct mark-read actions confirm the actual
stored credentials, including replacements whose token-flow event has not yet
arrived. Queued mark-read work confirms those credentials again before issuing its
request. Marking a row read preserves its metadata for later taps.
Unrelated or malformed JSON metadata does not break notification-list decoding;
legacy notifications without an exact task pair retain their previous link.

The router accepts the canonical `/app/homes/:home/tasks/:task` path and matching
custom-scheme links, rejects malformed task paths and retains an exact arrival
through sign-in. A signed-in arrival is account-bound. The current detail read,
displayed denial or actual departure completes only that arrival. Backgrounding
an unfinished read preserves it; session loss cannot consume a retained
reauthentication destination or show stale task content.

## Verification

Focused tests cover metadata and push selection, in-app recipient/session guards,
queued mark-read, metadata after marking read, canonical deep links, signed-out
replay, replacement-account denial, exact arrival completion and current detail
access. Existing router, notification, task access and task detail suites are
included in the verification selection. The first app verification passed 190
JVM checks, formatting, Detekt, lint and debug APK assembly. Independent review
then found the stored-credential/collector race described above; the repair adds
four actual-scope regressions for unpublished actor/session changes, unreadable
credentials and a change between initial confirmation and queued HTTP.

Final R2 completed successfully in 5m9s. The eight selected suites executed 194
unique JVM checks with zero failures, errors or skips, including 24 new routing
and session regressions. Formatting and Detekt passed with zero findings. Android
lint reported zero errors, 212 existing warnings and 17 informational findings;
debug APK assembly passed. The exact repaired source also passed independent
review and `git diff --check`.

The host log is `/private/tmp/pantopus-home-android-task-notification-r2.log`.
Fresh JUnit XML in `frontend/apps/android/app/build/test-results/testDebugUnitTest`
was checked per selected class. Build artifacts and operator logs remain outside
Git. These checks do not claim provider delivery or installed-app household
acceptance.

## Remaining work

Private task attachments are the next native slice. Full hosted task publication,
provider delivery and notification-to-detail acceptance remain separate. No
backend, database, web, iOS, paid service or physical-phone state changed in this
checkpoint.
