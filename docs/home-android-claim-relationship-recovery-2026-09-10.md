# Android claimant relationship review and recovery — September 10, 2026

## Result and next action

Android prepared household responses and Keystore-backed original/confirmation
recovery are implemented and exercised through the installed app, production
relationship HTTP/service and local PostgreSQL. Five POSTs produce three
receipts. Current later rejection, two restarts, corrupt storage/restoration,
stale review, revoked/restored authority and held preflight/background return
pass. The final run's empty-recovery capture timed out; the remaining capture
and denied-list checks were resumed against that same unchanged fixture and
passed. This is complete functional evidence across those two segments, not a
claim that the final driver ran uninterrupted.

Next is [residency review receipts and submission recovery](home-residency-review-continuation-2026-09-10.md),
then remaining ownership/lease/resource and broader handoff work. The residency
migration/service/SQL contract have started locally but are unverified, unapplied
and excluded from this Android source milestone. Home/payment PRs remain drafts;
all paid dependencies stay one final launch-preparation bundle.

## Implemented behavior

- Decline and unknown-claimant flags open current claim/evidence review, with an
  explicit response choice, private note and acknowledgement. Editing resets
  review. Invitations retain their existing completed flow.
- Dedicated Keystore-backed encrypted preferences retain one original per
  origin/account/Home: exact claim, action, note, request UUID and displayed
  review token. Compare-before-save/clear prevents replacement. Cloud backup
  and device transfer exclude this store. It has no plaintext fallback.
- Save the original before POST. Check current ordinary authority and opening
  account/session identity before exposing recovery, submitting, retrying or
  acknowledging. Retain confirmed receipts until explicit acknowledgement.
- Display historical outcome separately from current canonical claim phase.
  Pending evidence flags explain admin review; qualifying evidence can establish
  a challenge. Permanent recovery remains after claims leave the pending queue.
- Background/session changes hide private content and invalidate outstanding
  callbacks. Resume reloads without submitting. Corrupt/unreadable recovery
  blocks new actions without deletion. Definite stale/ineligible replies permit
  explicit fresh review; collisions and uncertain replies retain the original.
- Failed claim collections clear stale rows and show separate unavailable states,
  including when the other collection is empty. Flag controls use human labels.

## Findings resolved

Installed r1 signed in but ordinary Profile taps stayed on Hub: an invisible
debug five-tap overlay consumed them. The parent now observes initial pointer
passes without consuming touches. Subsequent installed runs pass normal Profile
→ Home → Owners → claim review, with no destination shortcut. The developer
five-tap gallery itself was not separately exercised.

Run r2 reached the form and crashed while Material interpolated em-based mapped
text styles with sp-based default styles for a floating label. The shared
Material typography mapping now converts design tracking to equivalent sp at
the declared font size. The original design ramp stays in em. Actual outlined
and filled fields render, focus, edit and clear at normal and 150% font size;
both installed checks pass in 17.943 seconds. The relationship form also passes
normal note entry, keyboard dismissal, action changes and acknowledgement.

Earlier runs encountered transient missing accessibility roots after process
replacement. The driver now waits for OS Activity startup and bounded current
hierarchy readiness. A separate immediate held-request assertion ran before
protected storage finished saving; it now waits for the actual fixture hold.
These changes preserve the outcome assertions. Run r6 then passed all decision,
recovery and interruption assertions, and verified empty recovery. A subsequent
UIAutomator evidence capture exceeded 30 seconds while a separate local iOS
build was running. That owned build was interrupted; the final capture and
remaining list-denial assertions passed on the same fixture. No new app crash
was observed after the typography repair. Automation timing and cold-start
performance under load are not certified by these functional results.

## Actual acceptance

1. Normal sign-in/navigation, pending deed 0/1 eligible, disabled unreviewed
   submission, private note, action changes resetting review, explicit decision.
2. Lose a committed decline reply; confirm one SQL receipt and encrypted on-disk
   storage without the original note/Home/request UUID in plaintext. Reject the
   claim separately. Restart, reach recovery on the empty queue and retry the
   exact original. Historical outcome stays under review; current claim is rejected.
3. Restart with the confirmed receipt: no new POST. Damage one ciphertext slot
   in the owned debug app, verify visible storage failure and hidden protected
   content/actions, restore exact bytes, restart and recover the same confirmation.
4. Acknowledge; change the next claim after review. Stale POST creates no receipt.
   Fresh review resets acknowledgement. Flag a pending deed: admin review only.
5. Revoke real occupancy, background/return, verify note/current claim/receipt and
   retry are hidden. Restore authority, reload and acknowledge the original.
6. Review eligible title evidence, hold actual preflight, background, release and
   return. No automatic POST occurs. Explicit retry establishes a qualifying
   challenge. Exactly five POSTs/three receipts remain, with Home security normal.
7. Acknowledge the last receipt and verify recovery is empty. Revoke authority,
   close recovery and verify ownership claims are unavailable instead of falsely
   empty. Restore the fixture; final SQL counts and states remain unchanged.

Ten private accessibility-state captures support these cases. FLAG_SECURE stays
enabled; private dialog pixel/visual acceptance was not bypassed or claimed.
One nonprivate Place error screen was visually inspected during restart diagnosis.

## Checks, evidence and limits

Final app and instrumentation build r5, formatting/Detekt, full lint r3, twelve
affected claim-review model cases, two installed Material typography cases,
driver syntax and source diff hygiene pass. An earlier lint indentation report
was produced while RootTabScreen was changing; a stable-source rerun passed
without suppression or unrelated deep-link edits.

Private local evidence (outside Git):

- `/private/tmp/pantopus-android-relationship-journey-r6/` and its `.log` contain
  the core installed sequence, eight state captures and the final capture timeout.
- `/private/tmp/pantopus-android-relationship-journey-r6-finish/` and its `.log`
  contain the resumed two captures, final SQL state and passing completion result.
- `/private/tmp/pantopus-android-material-typography-installed-r1.log` records the
  two installed field cases; build/lint logs are `...relationship-build-r5.log`
  and `...relationship-lint-r3.log` in the same private temporary directory.
- `/private/tmp/pantopus-android-relationship-ui-evidence-r1.json` is the final
  native fixture snapshot. Exact SQL cleanup passes; its listener and owned
  emulator 5556 are stopped. The owned Gig database remains for residency work.

Sign-in identity, Hub shell and comparison hydration are synthetic. Relationship
read/write services, SQL decisions/current authority and the emulator Keystore
are real. This is API 34 emulator acceptance, not physical Android or hosted
provider acceptance. Native concurrent windows, account-switch fault injection,
disk-write failure, whole-dialog large-text/dark pixel review and release-wide
workflows remain broader acceptance limits; ciphertext corruption/restoration
was actually exercised. No paid service, owner file or owner device changed.

The database uses the verified relationship schema on the existing 33-version
Gig replay ledger; this is not another fresh 34-version replay. The backend
report retains fresh replay, populated preservation and concurrency evidence.
The preceding iOS head `3393baa18` passes all required CI. The new Android head
must pass its own checks. Design archive PR #24 merged as `cd764458f`; privacy
PR #7's current refresh is `8c2eaa110`, with CI pending after its old test-hook
repair. Feature #32/#34 scope and combined migrations remain open.
