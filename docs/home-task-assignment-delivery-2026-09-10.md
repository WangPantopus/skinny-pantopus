# Recoverable Home task assignment notifications — September 10, 2026

Saving an assigned Home task previously returned success before starting a
best-effort notification. A process interruption could permanently lose that
notification; retrying a retained creation receipt did not recover it. Changing
the assignee on an existing task also did not create an assignment notification.

The protected task mutation now commits the task, audit, original creation
receipt (when supplied), in-app Notification and delivery record together.
Creation and actual assignment changes notify another current authorized
recipient. Self-assignment, unassigned tasks, ordinary field edits and replaying
an existing creation receipt do not create additional notifications. Existing
tasks and notifications are not backfilled or rewritten by the migration.

The existing task authorization/validation/audit function is preserved exactly
under a private name. The public boundary remains service-only. Both private
Home setup/deletion guards explicitly treat assignment history as household
data; their other conditions and role defaults are unchanged.

## Delivery and privacy

Both scheduler modes register the same bounded minute relay. Leases and
`SKIP LOCKED` prevent concurrent workers from claiming the same current event.
Unknown or partial provider outcomes retain the original event and Notification
identity, with bounded retry backoff. Expired leases recover worker crashes.
Only a current lease can acknowledge delivery.

Every delivery rereads the exact task under the existing Home, authority,
source-mail and task lock order, then binds the exact Notification and delivery
snapshot. Revoked/expired recipient access, changed or deleted notifications,
reassignment, completed tasks and deleted tasks prevent queued old delivery.
Changing assignment A → B → A does not revive the first A event. Notification
deletion and delivery use the same Notification-before-delivery lock order.
Deleting a Home also removes pending delivery without an intermediate foreign
key failure during its task cascade.

Push must be enabled both at assignment time and immediately before transport.
An assignment created while global or Home push is off remains in-app and is
never replayed when the preference is restored. Preference read failures remain
retryable. The shared push transport receipt implementation matches the one
already verified on the paid-gig branch; unrelated send methods are unchanged.

Notification text contains no task title, Home address, source-mail content or
actor name. The exact Home/task identifiers remain in metadata. The existing
Home tasks dashboard link is retained. **Opening exact task detail from all
notification surfaces is a separate remaining client milestone.**

## Verification

- Final clean replay: **29 migrations, all 35 SQL contracts and 35 pgTAP
  wrappers**. Application function checks: **207 functions, 84 attached trigger
  bindings, zero errors, five existing warnings**.
- Populated upgrade: **12 existing tables preserved exactly**, including task,
  original creation receipt, audit and notification rows. Upgrade and historical
  receipt replay create no backfill; a new reassignment after upgrade creates
  its notice. All synthetic upgrade fixtures were removed.
- **Seven observed concurrency scenarios** use independent real database
  connections: same-request creation, rollback, recipient revocation,
  reassignment, distinct relay claims, lease expiry during a lock wait, and
  concurrent Notification deletion. Exact fixture cleanup passed.
- The **actual production relay through 49 real SQL connections** recovered
  unknown and partially accepted transport, retained one Notification, suppressed
  revoked access and disabled-at-assignment events, and recovered an expired
  worker lease. Transport was synthetic; no provider or device was contacted.
- Eight current function bodies plus the preserved original mutator match the
  source exactly in the final contract, fresh-replay and upgrade databases.
  Both existing Home guard bodies differ only by their explicit new dependency.
- Full backend regression: **5,121 passed, 16 skipped, one socket-hang-up failure**
  in an unchanged push-registration HTTP test. The unchanged affected suite plus
  assignment, creation, route and push-dispatch checks then passed **100/100**.
  No cause for the socket failure is claimed. All privacy gates passed.
- Independent review identified the Notification/FK lock inversion; its final
  repair and observed race passed review. The populated upgrade exposed the
  pending-Home-deletion cascade issue; its repair and dedicated regression also
  passed independent review. Source syntax and `git diff --check` pass.

Migration SHA-256:
`9a9995c0b5d631694ab20deb4127461671dbe0382ec686c86a5851812631e327`.
Nine runtime-body aggregate SHA-256:
`37c16b627d6d6b01644bbea65a1a2e5cfceefa90f8d37e510c939b0b387e4131`.

Reproducible SQL scenarios are in
[`home-task-assignment-delivery.sql`](../scripts/db/contracts/home-task-assignment-delivery.sql),
[`test-home-task-assignment-concurrency.py`](../scripts/db/test-home-task-assignment-concurrency.py)
and [`test-home-task-assignment-service.cjs`](../scripts/db/test-home-task-assignment-service.cjs).
Private evidence uses `/private/tmp/pantopus-home-assignment-` with
`replay-r3.log`, `upgrade-r3.log`, `concurrency-r3.log`, `service-r1.log`,
`body-proof-r2.json`, `backend-full-r1.log`, `focused-r2.log` and
`privacy-r2.log`. Database dumps and operator logs are outside Git.

## Remaining limits

Provider delivery is **at least once**. A crash after acceptance but before the
database acknowledgement, or partial multi-device acceptance, may retry the same
notification on a device that already received it. There is no durable per-device
receipt or exactly-once claim. Provider acceptance also does not prove display
on a phone. Native/browser exact-task navigation, hosted scheduler/provider
acceptance, retention/capacity and complete household acceptance remain open.
No hosted migration, scheduler flag, paid subscription or owner-phone update
was performed. All paid dependencies remain together for final launch preparation.
