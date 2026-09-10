# Modern mail unit binding — September 9, 2026

Worktree `/private/tmp/pantopus-staging-mail-unit-binding`, branch
`codex/staging-mail-unit-binding`, starts from PR #28 source `95842b119`.
PR #28 contains completed native postcard simulator acceptance and merged as
`2259b8ee9` after full current-head CI `34401283503` passed. Hosted acceptance and
exact cleanup are now complete; the earlier checkpoints below retain their
historical state. See the final milestone for current source/runtime evidence.

## Destination and apartment milestone

The end-to-end tests first reproduced four failures: a correctly mailed apartment
could not attach in a shared building, a code for one apartment could attach the
only Home belonging to another apartment, conflicting requested/canonical units
were silently ignored, and changing the address record could move a mailed proof.

Dispatch now saves the actual destination before calling the provider. A resend
retains it and refuses a changed destination before another vendor request. The
same unit key is used to reject conflicting canonical/requested apartments,
select exactly one Home, scope pending claim updates, and pass the unit into the
shared membership service. Only apartment/unit/# prefixes, letter case and
whitespace are normalized; floor/suite labels, punctuation, leading zeros and
suffixes remain distinct. A neighbor in another apartment no longer blocks this
apartment; known apartments require a unit before postage is requested. Current
frozen/removed/suspended/timed-out access is denied before attachment.

The focused mail suites plus the unchanged review-notification regression pass
193 tests. The first full backend run had one unrelated review-notification
socket hang-up; its focused rerun passed. The second full run passed 4,521 tests with 16 skips but hit a different
unrelated `publicPlace` HTTP parse error. That unchanged suite then passed all
48 tests on its own. Privacy gates pass. No complete green full-suite result is
claimed for this unfinished checkpoint; fresh current-head CI remains required.

New destination snapshots remain absent from the public status response. Legacy
jobs without snapshots retain only the old single-address, no-unit path. Legacy
multi-unit jobs need support; their historical printed destination cannot be
reconstructed safely. No snapshot is represented as proof of physical delivery.

## Earlier checkpoint limits (superseded by the atomic milestone)

Modern code consumption and membership still use separate writes. A failure can
leave a consumed proof with no membership, and the current route's old
`Attempt is verified` shortcut can then misleadingly report confirmed. Address,
unit and access can also change between the JavaScript check and attachment.
Finish atomic confirmation, exact current-membership retry, rollback/concurrency
contracts and live scoped test acceptance before treating this path as complete.
Preserve the completed native path and its source/runtime evidence. Do not merge
this unfinished modern-mail milestone or deploy it as a release candidate yet.

The private candidate remains source `26102bfb2`, image `312b5a382fd6`, with both
native additive migrations already applied only to Free staging. The completed
native/API test fixtures are cleaned, sessions revoked and original Home documents
preserved. Public/browser/production runtimes and hosted migration ledger remain
unchanged. Smarty activation/retest, payment/OAuth acceptance and release gates
remain in the project handoff.


## Atomic confirmation milestone

The additive service-only `confirm_mail_verification` RPC now owns code attempts,
exact destination/Home resolution, membership, matching claim updates, completion
metadata and audit in one transaction. It locks the owned mail attempt/token/job,
canonical address and selected Home; native and modern mail share the Home lock.
A later household authority, frozen Home, rejected unit claim or ended/removed/
suspended/timed-out member cannot be bypassed. New grants use the shared member
permission templates, preserve minor restrictions and cannot acquire management
rights. Independently verified membership retains its role and verification age.

A correct retry requires the same proof and the original active membership; it
cannot reattach a removed member or extend verification. Legacy consumed proofs
with missing membership can recover once while the proof remains valid and its
safe destination is identifiable. Legacy jobs without destination evidence are
limited to one Home with no unit; ambiguous or multi-unit legacy mail needs
support. No historical address snapshot is invented.

The API has no separate-write fallback when the RPC is unavailable. It returns
retryable 503 and does not falsely consume proof. The old route shortcut that
reported `Attempt is verified` as confirmed is removed. Read-only confirmed
status checks the recorded original membership and current address/access;
a partial proof requests same-code recovery instead of claiming usable residency.

Verification:

- Full backend: 4,540 passed, 16 skipped; privacy gates pass. Two older tests
  expecting partial proof consumption were updated to require atomic preservation.
  The earlier unrelated HTTP failures belong to the preceding checkpoint, not
  this successful full run.
- All 16 SQL contracts pass; function lint checks 122 application functions and
  73 trigger bindings, with six reviewed stock PostGIS findings and 38 existing
  warnings. The expanded real-SQL contract also covers child permissions,
  later household ownership, rejected claims and expired proofs.
- Four competing correct confirmations create one exact-Home membership with
  three unchanged retries. Eight wrong guesses stop at five; the correct code
  cannot bypass the lock. Two concurrent connections prove a Home freeze wins
  before membership can commit. All 14 competing connections and cleanup pass.
- A forced audit failure rolls back proof, token, claim and membership together.
  Correct retry, changed unit, freeze and revoked-membership denial pass against
  the actual PostgreSQL function, with all contract rows rolled back.

Next apply this additive function only to existing Free staging, refresh the
private candidate from committed source, and run real Lob test + HTTP multi-unit/
recovery/access acceptance with exact fixture cleanup. The migration has only
been applied to the disposable local `mail_confirmation_contract` database so
far. Source CI/integration and hosted acceptance remain; no production or public
runtime change is authorized by this engineering checkpoint.

## Independent review and concurrency repair

Review found that webhook metadata replacement could erase the newly recorded
membership IDs; a Home address edit could leave its `address_id` unchanged; and
existing pending owners/inactive occupants could transition after the household
check. Confirmed status also overlooked a later rejected unit claim.

The confirmation transaction now compares the locked Home's street, city, state
and ZIP to the mailed destination and locks existing owner/occupancy rows in
stable order before evaluating authority. It explicitly rejects a child template
that grants task management. Status applies the same destination and latest
matching-unit claim restrictions, failing closed on a claim read outage.

The second additive migration provides service-only dispatch/webhook updates
that merge into current metadata under the row lock. Dispatch preserves its
pending/no-receipt claim and additionally rejects a unit/destination changed
since the caller read it. No stale vendor read can erase the completion IDs.
Neither migration rewrites historical rows; apply both before the new backend.

Verification at this milestone: 4,554 backend tests pass (16 skipped), privacy
gates pass, all 17 SQL contracts pass, and lint checks 124 application functions
and 73 trigger bindings with the same six reviewed PostGIS findings/38 existing
warnings. The original 14-connection same-code/lockout/freeze matrix passes again.
Real competing transactions also prove pending-owner promotion and inactive
resident reactivation block confirmation until they commit, then deny without
consuming proof. Separate two-writer checks prove webhook/dispatch metadata
preservation and stale-unit rejection. All exact local fixtures are cleaned.

[PR #29](https://github.com/WangPantopus/skinny-pantopus/pull/29) is draft. Its
first backend/image checks passed; the migration prerequisite required the
literal compatibility annotation `Backwards compatible: yes`. The annotation
now passes locally without changing the guard. Fresh current-head CI remains
required. PR #28 merged-master CI passed. Hosted multi-unit acceptance is next;
the private API still runs `26102bfb2`/`312b5a382fd6` at this checkpoint.

Known limits: no physical mail or externally delivered Lob callback is certified.
Delivery-status ordering when a webhook beats a provider response is an existing
separate display-state concern; these changes protect proof/membership metadata.
Source tests do not certify the modern printed web link or provider eligibility;
Smarty activation and its real retest remain a launch prerequisite.

## Hosted multi-unit acceptance and cleanup

Committed/pushed source `694a213e2ba58945b35e7c088803e65e489bc42f` runs in the
private loopback candidate as image
`sha256:68e3e052a578f7dd5a3a52d3dd1afbf2906b382044496c8f31e22ab015b02ae8`.
Previous image `312b5a382fd6` is retained stopped. The two additive migrations
were applied only to Free staging `ptudkfqdhqpkbkzqlabu`, with full before/after
record fingerprints unchanged and the hosted migration ledger still absent:

- `20260909204500`: SHA-256 `7835ba9390667605e553bed618fe95efaa4ce9ed9e558b0280f14be68821b77c`.
- `20260909213000`: SHA-256 `4a57866dd4c63aafc9f2f8fd18eb9457046eaaec891b6ed49e6a4fdff35f54fb`.

One real operational Lob **test-mode** postcard preserved Unit 4 and its exact
code while another resident occupied Unit 5 of the same canonical building.
Repeated HTTP start returned the same attempt. Anonymous/foreign reads and
foreign confirmation were denied; one wrong code reduced remaining attempts.
Home-only street changes, frozen Home and rejected Unit 4 claim denied correct
proof without consuming it or creating membership.

Three simultaneous correct HTTP confirmations plus a locally signed synthetic
Lob callback produced one Unit 4 member and preserved both completion IDs and
callback metadata. Only the Unit 4 claim became verified. Management permissions
remained false. Same-code retry preserved the whole membership row; status
denied later Home city edits, rejected claims and inactive membership. A completed
retry after proof expiry still returned the original active member without
extending verification or increasing the two attempts (one wrong, one correct).

Cleanup deleted the exact Lob test card, both temporary Homes, claims,
attempt/token/job, audit and synthetic callback. Normal supported logout revoked
both actor sessions; no push tokens or memberships remain. Original HomeDocument
IDs are unchanged. The first cleanup reached logout with an unsupported operator
scope; the supported local scope completed the remaining cleanup and all final
assertions passed. Never rerun these completed publishers or migration appliers.

[Full current-head CI](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34424933888)
passes at `694a213e2`: backend/privacy, image, safeguards and full database replay.
Only this private candidate changed; public API/worker, browser API/web and
production containers were verified unchanged. Physical delivery, an external
Lob callback and the modern browser printed-link journey remain unverified by
this API acceptance. The separately completed native printed-link simulator
journey remains recorded in the native mail report.
