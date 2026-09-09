# Modern mail unit binding — September 9, 2026

Worktree `/private/tmp/pantopus-staging-mail-unit-binding`, branch
`codex/staging-mail-unit-binding`, starts from PR #28 source `95842b119`.
PR #28 contains completed native postcard simulator acceptance and is separately
awaiting current-head full CI/integration. No new hosted changes or mail fixtures
have been created for this next milestone.

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

## Next required work before integration

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
