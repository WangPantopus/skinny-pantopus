# iOS household task creation recovery and sparse editing

Status: verified source checkpoint, September 10, 2026.
The previous task browsing checkpoint is `0fdfaab1d`; the backend's protected
creation receipt is `7d7ea44a6`. This milestone does not complete Home release
acceptance, private task attachments or notification delivery.

## User behavior

Both Home task entry points open the same form and navigate directly to the
exact task after a verified create response. The form obtains current collection
creation permission or current exact-task editing permission. Permission and
session checks run again before mutation. Backgrounding, leaving, a replaced
session or delayed navigation cannot publish an old completion.

Creation saves one immutable request UUID and original payload in this-device-only
Keychain storage before sending it. The storage key includes API origin, actor
and Home. An interrupted response keeps those details for explicit retry, including
reopening the form or app in a new current session. Missing and unreadable storage
are distinct. A failed storage read or write cannot silently create another task.
Concurrent screens cannot send competing creates for the same scope. A completed
form cannot allocate a second UUID while its dismissal is pending.

The receipt binds actor, Home, request, exact task and a valid canonical payload
hash. Current task text may reflect a legitimate later edit; recovery does not
replace it with the original title. A mismatched response, malformed session or
failed local receipt cleanup does not signal success. The confirmed task identity and hash are saved in the protected pending record
before clearing it, so a failed cleanup retains that proof after reopening. Both
writes and clears compare the exact expected record; another saved request
cannot be overwritten after an await. No bearer token or session proof is persisted.

Only the exact confirmed `400 HOME_RECORD_INVALID` or
`409 HOME_TASK_CREATE_RETIRED` responses permit the separate **Clear saved
request** acknowledgement. It clears the matching local request and closes the
form; it sends no new create and does not delete or restore a task. Unknown
outcomes, malformed replies, conflicts, 408, 429 and server errors retain the
original request. A later user-initiated Add task is a separate action.

Editing sends only changed fields. Clearing notes, assignment, due date or the
repeat preference produces explicit JSON null. Unchanged timestamps, complex
recurrence rules and other values are not resent. An interrupted edit keeps the
original sparse patch in the current form for explicit retry. The PUT response
must match that patch and exact task; a final current authorized read is required
before completion. An inaccessible follow-up read cannot produce a success toast.

## Verification

The final 20 Swift files pass Swift parsing, SwiftFormat and strict SwiftLint
with zero findings. Independent review passes after the late-picker,
async-return lifetime, compare-and-save, known-proof retention and single-use
corrections. `git diff --check` passes.

There are **107 current behavioral checks** across the affected suites:

| Suite | Current checks | Final relevant app run |
| --- | ---: | --- |
| Creation recovery | 12 | R6 |
| Form mutation/current lifetime | 12 | R6 |
| Protected saved requests | 8 | R6 |
| Existing form behavior | 16 | R5 |
| Exact task access/actions | 27 | R4 |
| Existing task list behavior | 32 | R2 |

The final R6 actual app build passed its 32 creation/edit recovery checks with
zero failures. The other 75 unchanged checks passed in their relevant prior
actual app runs; 107 is the current combined coverage, not a claim of one
107-test run. R5 passed 28 affected cases, R4 passed 73, and R2 passed all 100
then-current selected cases. The first build found a test helper collision with
inherited `NSObject.hash`; renaming it to `payloadHash` fixed test compilation.
No runtime guard was relaxed to make a fixture pass.

Behavioral tests include exact replay after a lost response, changed receipt
identity/hash, new sessions, simultaneous forms, late picker callbacks, a
completed form's second queued save, storage read/write/cleanup failure, another
saved request appearing during an await, scoped Keychain round trips, intentional
null clears and unchanged-field preservation. A deterministic return-boundary
regression keeps the original after access is retired between response checking
and the coordinator's continuation. Another test keeps already observed proof
through failed proof persistence, hiding, restoration and a changed-hash retry.
Synthetic Keychain fixtures use a random test-only service and exact removal.

The operator manifests are `/private/tmp/pantopus-home-ios-task-create-files.txt`
(20 Swift files) and `/private/tmp/pantopus-home-ios-task-create-owned-files.txt`
(the same files plus this report). Actual build evidence remains in the private
`/private/tmp/pantopus-home-ios-task-create-r2.log` through `-r6.log` operator logs;
logs themselves are not committed. The final source aggregate is
`b498b65bb8e55d956b5ebe1dcce216eed42cf30c5ab2eb30e9cdf4e2d688e7c9`.

## Remaining limits and next work

- If protected storage cannot save newly observed proof before process death,
  the previously saved original UUID/payload still governs recovery; no local
  storage system can claim that an unacknowledged write became durable. The
  surviving form retains the observed identity/hash for explicit retry.
- Editing recovery is retained within the existing form lifetime. Cold app restart
  rereads the current task; it does not resume an edit from disk.
- Private task attachment listing, immutable upload retries, exact byte reads and
  removal controls are the next native slice. The form opens the saved task first.
- Automatic recurring-task generation remains unimplemented. The form and detail
  explicitly call the saved value a repeat preference and state that new tasks
  are not generated automatically.
- The durable backend assignment outbox is pushed separately as `92a35b7f9`.
  Exact task notification routing is the next bounded native milestone, followed
  by private attachments and installed native journey acceptance. Provider
  transport remains at-least-once, as documented in that outbox report.
- Neither native build tests nor this source checkpoint constitute hosted
  migration application or full household acceptance. No new role default,
  subscription, paid service or hosted data change is included.
