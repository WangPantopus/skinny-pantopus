# iOS claimant relationship review and recovery — September 10, 2026

## Result and next action

Prepared iOS household responses now retain the original command and confirmed
receipt in Keychain, with permanent recovery after claims leave the pending
queue. The final installed app → production HTTP/service → local SQL journey
passes, including ordinary navigation, lost replies, two app restarts, current
later rejection, stale review, revocation/restoration and background interruption.
Six distinct final screens were visually reviewed. Android parity is in progress;
its new API/store/controller/UI source still needs integration and acceptance.
Residency receipts, ownership and lease/resource work remain next. PRs #32/#34
remain unfinished drafts, combined migration dependencies remain open, and all
paid services remain in one final launch-preparation bundle.

## Implemented behavior

- Ownership claim decline/flag actions open a prepared current review, with
  explicit evidence eligibility, private note and review acknowledgement.
  Invite actions retain their existing flow. Editing a field resets review.
- One protected original per origin/account/Home is stored before dispatch.
  The Keychain service is `app.pantopus.ios.pending-home-claim-relationship`,
  unlocked-only, device-only and non-synchronizing. A different claim opens the
  saved original first. Compare-before-save/clear prevents replacing it.
- Current ordinary authority is checked before exposing protected recovery,
  submitting, retrying or acknowledging. The opening server session proof is
  carried on subsequent requests. The original request UUID, action, note and
  review token are retained unchanged when retrying.
- A confirmed historical receipt stays distinct from the claim's current state.
  Confirmation remains protected until explicit acknowledgement. A permanent
  relationship recovery entry remains reachable after the pending queue empties.
- Background/account changes hide private claim, note and receipt content and
  invalidate outstanding callbacks. Resume reloads current authority and the
  protected original without automatically submitting a decision.
- Corrupt/unreadable storage blocks a new decision without deleting the data.
  A definitive stale/ineligible/challenge-review response permits explicit
  acknowledgement and a fresh review; collisions and uncertain replies do not.
- Ownership/residency collection failures are represented separately. A denied
  ownership list plus an empty residency list cannot claim there is no work.

## Findings resolved

Installed navigation exposed a Place loading/error dead end: the view hid the
native navigation bar and only its loaded state supplied a menu. Loading/error
states now offer Back and Menu. Installed Back navigation is verified.

An invisible debug five-tap overlay intercepted ordinary Hub avatar touches.
Accessibility activation bypassed it, explaining why a manual accessibility
press opened Profile while XCTest's normal touch did not. The debug gesture now
observes simultaneous spatial taps without placing a touch target over Profile.
The Owners screen explicitly restores its navigation bar under the Me root.
The installed r8 journey now passes ordinary touch navigation through Profile,
Home identity and Owners into claim review. It stopped on missing accessibility
identifiers despite the correct visible screen. Parent identifiers overwrote
child actions, and flag buttons announced internal identifiers. Container
grouping and meaningful flag labels are repaired and verified by the final r10
journey. No coordinate bypass or direct destination shortcut was needed.

The preceding browser head `330254adf` passed every required job except the
iPhone 16 job (and its aggregate CI gate). Its only case failure was the existing
media background-recovery assertion exhausting a fixed 500 ms wait. The check
now observes the same expected media ID with a bounded five-second deadline.
All 27 affected native cases passed, including actual Keychain roundtrip,
compare-and-save conflicts and corrupt-data retention. The repaired media case
also passed three repetitions, one taking 887 ms. Assertions and app media
behavior were unchanged; final-head remote checks remain required.

The first complete journey reached all five submissions and three receipts but
incorrectly expected the challenged V2 claim's older `state` column to change.
Its canonical `claim_phase_v2` and `challenge_state` were both `challenged`, while
`state` correctly remained `submitted`. The fixture/assertions now preserve this
distinction, and the UI displays the current phase for both current claim and
historical receipt. An unqualified flag explicitly says it was sent for admin
review. Final screenshots confirm the later rejection, original under-review
receipt and challenged outcome without conflicting primary status labels.

## Actual acceptance and evidence

Final installed `HomeClaimRelationshipJourneyUITests` run r10 passes on the
owned iPhone 17/iOS 26.5 simulator:

1. Normal login → Place error Back → Hub Profile → Me Home identity → Owners →
   claim review. A pending deed shows 0 of 1 eligible; submission requires an
   explicit review. Enter the private note, dismiss the keyboard and submit.
2. Commit the decline but lose the reply. SQL contains one original receipt.
   Reject the claim separately, terminate/relaunch, use the permanent recovery
   entry on the empty queue, and retry the exact original command. The historical
   receipt remains under review while the current claim is rejected.
3. Terminate/relaunch with the confirmed receipt. Read it without another POST,
   acknowledge it and verify terminal claims offer no new household submission.
4. Change the next claim after review. Its stale request yields no new receipt;
   explicit acknowledgement resets the review. Review and flag the pending deed.
   The result goes to admin review, with no qualifying dispute.
5. Revoke actual occupancy, background/foreground, and verify private claim,
   note, receipt and retry are hidden. Restore authority, reload and acknowledge.
6. Review eligible title evidence on the third claim. Hold the real preflight,
   background the app, release the response and return. Resume does not POST.
   Explicit original retry produces the qualifying challenge. Exactly five POSTs
   yield three receipts; the Home security state stays normal.
7. Acknowledge the last receipt, verify the permanent recovery entry is empty,
   revoke authority again and return to the list. Ownership is unavailable,
   rather than falsely reporting no pending claims. Restore the exact fixture.

The loopback fixture uses production relationship Express/Joi/read/write
services against local PostgreSQL. Identity/authentication, Hub shell and list
comparison hydration are synthetic. The installed journey uses normal sign-in,
normal navigation and the actual simulator Keychain. Place intelligence is
intentionally unavailable. Owner roster CRUD, physical devices, hosted providers
and release-wide acceptance are outside this fixture's evidence.

The final acceptance database has the relationship migration applied on the
existing Gig replay schema; its ledger still contains 33 versions. This run is
not a new fresh 34-version replay. The unchanged backend migration's prior fresh
34-version replay and populated upgrade remain recorded in the backend report.

Final local checks: signed build r12, Keychain host verification, full SwiftLint
(0 violations in 2,142 files), SwiftFormat (0 of 2,145 require formatting), fixture
syntax and diff hygiene pass. The 27 affected regression cases pass in r2; the
subsequent view-only status wording changes pass the final installed journey.
Actual simulator Keychain checks exercise cold store instances, scope isolation,
compare-and-save conflicts and corrupt-byte retention. Native storage write
failure UI, competing scenes, account-switch fault injection, physical devices,
small-screen/dynamic-type and provider-wide release acceptance are not claimed
by this checkpoint. Their broader release matrix remains open.

Private local evidence (not checked into Git):

- `/private/tmp/pantopus-home-relationship-ios-ui-r10.xcresult` and its log;
  screenshots in `/private/tmp/pantopus-home-relationship-ios-ui-r10-attachments`.
- `/private/tmp/pantopus-ios-relationship-ui-evidence-final.json`: original
  commands, three SQL receipts, current claim phases and final normal security.
- `/private/tmp/pantopus-home-relationship-ios-regression-r2.xcresult`;
  `/private/tmp/pantopus-home-relationship-ios-media-repeat.xcresult`.
- `/private/tmp/pantopus-ios-relationship-build-r12.log` and
  `/private/tmp/pantopus-ios-relationship-final-{lint,format}.log`.

Exact fixture SQL cleanup passes, the loopback listener is stopped, and the two
owned iOS simulators are shut down. The owned Gig database remains running for
Android acceptance. Owner files, simulators and runtimes remain untouched.
No hosted deployment or paid service was activated. The new pushed head's CI
must pass before any eventual merge; this milestone alone does not finish PR #32.
