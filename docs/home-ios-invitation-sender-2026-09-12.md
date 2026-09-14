# iOS Home invitation sender recovery — September 12, 2026

The native member invitation flow now retains the sender's exact original
request in non-synchronizing, device-only Keychain storage before submitting it.
Recovery is scoped to the API origin and signed-in account. Create, explicit
resend and explicit withdrawal use the reviewed sender command contract;
recovery checks and retries retain the request ID, original JSON and capability.
Closing a sheet or losing a reply does not discard the original.

Resend no longer calls invitation creation. Withdrawal no longer hides a row
optimistically or calls membership deletion for a resolved recipient. A current
manager reviews the current invitation and confirms the intended action.
Historical completion, current invitation eligibility, list freshness and
delivery proof are separate. Acknowledging a completed original can leave a
saved-success banner beside a failed list refresh.

The manager list uses the current-session sender list, including expired
pending invitations that remain withdrawable. It validates the actor, Home,
invitation and displayed profile rather than treating an unavailable list as
empty. Reviews and rows prefer the effective base role; approved access-request
presets display as Household approval while retaining their original values.
The wizard no longer describes an invitation as residency or ownership proof.

## Sharing and protected recovery

A completed historical receipt alone does not expose a share link. Check link
for sharing reads fresh sender context for the retained invitation. Share checks
again before opening the system sheet. Exposed links expire after at most 60
seconds, or at invitation expiry if sooner; failures, account changes and
lifecycle retirement remove them. These reads do not issue a resend command or
request delivery.

Public web origins are explicit build configuration. Production and staging
origins must match their documented API counterparts. Loopback acceptance uses
an explicit loopback web origin; an unknown or mismatched environment does not
fall back to a production invitation URL.

Storage refusal, malformed proof, impossible delivery states, changed sessions
and stale callbacks fail closed. Proof-write repair does not send another POST,
and a lost clear acknowledgement can recover a committed local clear. These
storage fault cases use an injected store in focused tests; installed acceptance
uses the production Keychain and normal sign-in UI.

## Actual installed acceptance

The eight-command sender predecessor was frozen at private source-r8.json.
Installed command acceptance continued against that production source and the final
backend sender migration/service, using the owned simulator and an isolated
production HTTP/SDK/SQL fixture. Eight commands finish as **five completed, one
cancelled and two rejected**. Every retained original is acknowledged through
the native UI before fixture cleanup.

The accepted subjourneys cover:

- Malformed review context and a confirmation retired by backgrounding.
- An unseen create cancelled after restart and an unavailable recovery read.
- A committed create with a lost reply, failed cold read and recovered saved
  result, displaying unconfirmed email and in-app delivery honestly.
- Historical sharing hidden until a fresh check; later expiry retires sharing
  without erasing the saved creation result.
- A → B → A account isolation through ordinary sign-out/sign-in, with logout
  replies held and the app terminated before releasing them. The other account
  cannot see the owner's original; the original returns after switchback.
- Explicit acknowledgement followed by a 503 member-list refresh. The native
  screen visibly retains the saved-success banner alongside the list error.
- Explicit resend with a lost committed reply and the actual Retry original
  action button. Two HTTP POSTs retain the same request UUID and request hash.
- Recipient acceptance after withdrawal review. The rejected withdrawal leaves
  the complete legitimate membership rows unchanged.
- An expired pending invitation that remains visible and withdrawable, with
  withdrawal recovered after a lost reply and cold launch.
- Loss of current manager authority after review, producing a retained rejected
  original, and a held committed create whose retired reply cannot replace the
  original recovered by a new sheet.
- A separate eighth, reviewed resend with a lost committed reply and actual
  Retry. Notification, email-attempt and command snapshots are unchanged by the
  replay. Read-only SQL records exactly one additional alias and one additional
  command. A fresh sharing check and Share open UIKit's ActivityListView; its
  native Close control dismisses the sheet, followed by acknowledgement.

No recipient, provider send action or Copy action was selected in the system
share sheet. The clipboard was not changed. No invitation action called the
membership-delete endpoint.

The HTTP request hash is the fixture's hash of parsed request JSON. Exact
encoded Data reuse is separately asserted in coordinator/network tests and
implemented by the API client's original-body path; the HTTP evidence is not a
capture of every raw wire byte.

## Driver continuations and source binding

This is aggregate installed acceptance with preserved checkpoints, not a claim
that one fresh, uninterrupted UI test passed all eight commands.

- UI r1 found an actual accessibility identifier collision on the visible
  Invitation recovery button. A containing accessibility group fixes it.
  No command had been created. Generic row behavior remains unchanged; actual
  resend and withdrawal buttons were reachable without changing that behavior.
- UI r2 stopped before commands because the driver required the launch Sign-in
  button when the app correctly displayed its direct expired-session login.
- UI r3 completed the unseen cancellation and lost-create/sharing checkpoints,
  then stopped because an eager root-menu fallback did not await restoration.
  Its completed original stayed protected.
- UI r4 completed the cold account switches and saved-success/failed-refresh
  checkpoint. Its assertion expected raw fixture wording, while the app
  correctly rendered its ordinary safe 503 message. The screenshot and HTTP/SQL
  state retain that actual outcome; the original was acknowledged through UI.
- UI r5 resumes after that checkpoint and **passes in 120.709 seconds**, adding
  the remaining five primary commands and verifying all seven primary outcomes.
- UI r6 verifies the eighth resend's Retry and opens the native share sheet.
  The driver expected Copy to be a Button; iOS exposes it as a Cell. The receipt
  remained protected, and no Copy action was attempted.
- UI r7 uses the observed native sheet/Close identifiers, reopens that same
  retained eighth receipt, closes sharing and acknowledges it. It **passes in
  31.016 seconds**, without creating another command. Final hierarchy and image
  show the member list and saved-result banner, with no sender or share sheet.

Only the UI driver differs between source-r8 and source-r14. Signed app and
runner executable/Info digests match their installed simulator counterparts in
the recorded r5 and r7 bindings. Candidate product clones, runner configurations,
source manifests, failed attempts and attachments remain private. Source-r15
adds only notification test timing isolation after installed acceptance;
production sender behavior and the accepted UI driver remain unchanged.

## Pending recipient identity follow-up

Retained UI r6 video review subsequently found a real visual defect: two pending
recipients both appeared as the same truncated “Residency fixture (@resi…” title.
Accessibility identifiers let the earlier driver choose their actions, but that
did not prove a person could visually distinguish the recipients. The original
frame remains preserved; the eight-command evidence does not close that defect.

The preserved source-r17 checkpoint adds a bounded renderer repair. Pending invitation titles allow
full wrapping; Resend and Withdraw use the existing card footer below identity.
One role subtitle replaces the duplicate role pill. All other rows retain their
default two-line title and existing layout. Sender command, storage, validation,
sharing and backend logic are unchanged from the accepted predecessor.

A fresh fixture and normal native sign-in pass the installed layout follow-up
in **63.289 seconds**. Both full usernames are visibly distinguishable. Each
recipient's Resend and Withdraw opens a prepared review with the matching full
recipient; all four reviews close without submitting. The Pending screenshot
and all four review screenshots were visually inspected, not only checked via
accessibility text. This follow-up issues **zero sender commands**, preserves
membership and delivery snapshots, and adds no retained original. The eight
accepted sender commands were not rerun for the renderer change.

Build r16's new test extension initially could not access its private helper
extension; build r17 corrects only test-helper visibility and passes. A runner
setup attempt assumed a newer xctestrun shape and stopped before installation;
layout-ui-r2 uses the generated legacy shape and is the passing installed run.
These setup failures remain in private evidence. Signed candidate-r17 app and
runner binaries match the installed products in installed-binding-layout-r2;
the final unit host matches the same candidate in installed-binding-layout-full-r3.
Source-r16 and r17 have identical production source; only helper visibility
changes between them.

## Member-list refresh ordering follow-up

Final production source-r18 stages the complete member read before publishing it.
Each fetch has a generation and the opening account/session lifetime. Every
awaited result is checked against both; an older reply cannot partially publish
access, occupants, invitations or secondary queues after a newer refresh.
The two initial view loads share one fetch. A current failure retires cached
rows and management access, and changing tabs preserves that failure. Pending
has no count until a current sender queue is confirmed. Ordinary members retain
their authorized roster without treating legacy occupants invitations as a
confirmed sender queue. Invitation recovery stays reachable independently.

Five new member-reader tests cover an older success after a newer denial,
an older success after a newer success, session retirement, concurrent initial
loads and an ordinary member's roster with an unconfirmed invitation queue.
The denial test also changes tabs and explicitly retries after the error.
Focused regression passes **99 tests**: 41 member-reader, 21 sender, 27 shared
renderer and 10 network tests.

The installed list-ui-r2 follow-up passes in **77.458 seconds** against that
production source and the driver-only source-r19 update. Through normal native
navigation, dismissing two Review claims sheets starts two complete refreshes.
The fixture holds A's successful SDK sender-list reply. B reaches the current
access endpoint and then fails with three safe 503 sender-list attempts. The
held success is released only after the newer error, within the driver's
15-second bound and before the request's 20-second timeout. Switching Members
and Pending retains the error; no stale rows or management actions return and
Pending does not falsely show zero. The recovery entry opens normally; clearing
the fault and tapping Try again restores the complete, distinguishable recipient
identities. Both outcome screenshots were visually inspected. This follow-up
creates **zero sender commands** and no retained original.

The preceding list-ui-r1 assertions passed but its swipe did not start a second
whole fetch. Its held request instead timed out and retried into the injected
failure. It proves error persistence, recovery access and explicit retry only;
it is preserved and is not counted as late-success ordering proof. The r19
driver requires a new current-access request before releasing the old reply,
closing that ambiguity. Source-r18 and r19 have identical production and unit
source; only the bounded UI driver changes. Build r19 passes, and the signed
candidate-r19 app and runner match their installed simulator counterparts.
The accepted eight-command recovery journey and four recipient reviews were
not rerun for this reader-only change. Installed ordering covers a newer 503;
newer permission denial, successful replacement and session retirement are
also covered by deterministic member-reader tests.

## Regression and cleanup

Focused sender/member/network regression passes **67 tests** (21 sender,
36 member-list, 10 network). The network test class now owns an isolated empty
auth manager instead of using the simulator's retained account.

The first full run exposed three pre-existing notification-test assertions that
read mutable router state after the live app host could consume it. The tests
now capture the emitted route synchronously in their existing selection
callback. All five notification tests pass with that correction. The corrected
predecessor full regression passes **4,393 checks / 168 skips / zero failures (4,561 total)**.
The xcresult summary includes 4,553 XCTest entries (168 skipped) and eight Swift
Testing checks. The earlier full-r1 result with three timing-test failures is
retained; full-r2 is the passing pre-layout result. After the renderer repair,
full-r3 again passes **4,393 checks / 168 skips / zero failures**. Its 36
member-list checks include footer action routing, and 27 shared-renderer checks
retain the legacy default contract. All 19 changed Swift files pass
SwiftFormat and strict SwiftLint; source digests, diff checks and a scan for
private fixture capability literals in the changed source/report also pass.

After the member-reader fix, final full-r4 passes **4,398 checks / 168 skips /
zero failures (4,566 total)** against source-r19. Build r19 and all 19 changed
Swift files pass formatting and strict lint. The final source manifest matches,
diff checks pass and no private fixture capability literal appears in the
changed source or report. The signed installed UI app/runner and final unit host
match candidate-r19-products in their separate recorded bindings.

The earlier three iOS sender fixtures are exactly cleaned. Command fixture-r2/cleanup.json
records fixtures removed, complete role rows restored, the complete migration
ledger preserved and exact function definitions/properties preserved. Temporary
command schema is removed without ledger adoption. The database and port 18084
were released before full unit regression so browser/Android acceptance could
continue independently. Visual fixture-r3 also records all four preservation
flags as true, with zero sender commands; its process exited cleanly and port
18084 was released to Android before full-r3 regression. Member-reader
fixture-r4 also records all four preservation flags as true, with zero sender
commands and no retained original. Its process exited successfully and port
18084 was closed and released to Android before full-r4 regression.

The owned F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8 simulator is shut down and its
userdata directory is retained. Final unit results identify that same simulator;
its signed installed app/test host was compared with the retained products
without rebooting it for the earlier checkpoint. The bounded layout follow-up
reused that same simulator; it is shut down again with userdata retained and
no active iOS fixture. The reader follow-up and full-r4 reuse that same device;
it is again shut down with userdata retained. No physical iPhone or unrelated simulator was used, erased
or reset. Products and private evidence remain preserved.

## Evidence and verification limits

Private evidence root: /private/tmp/pantopus-home-ios-invitation-sender-r1/.
The principal predecessor artifacts are source-r8/r12/r14/r15.json,
installed-binding-ui-r5/r7.json, targeted-r3.xcresult, ui-r3 through ui-r7.xcresult,
their exported attachments, full-r1.xcresult, full-r2.xcresult,
full-r2-summary.json, installed-binding-full-r2.json,
notification-targeted-r1.xcresult, fixture-r2/final-state.json,
fixture-r2/sharing-sql-before.json, fixture-r2/sharing-sql-after-retry.json and
fixture-r2/cleanup.json. candidate-r14-products preserves the accepted UI build;
candidate-r15-products also includes the final unit-test host. The production
debug dylib, Info.plist and UI runner/test executable match between these
products; the app entrypoint differs only in its code-signature block after the
unit-test bundle rebuild, recorded in product-r14-r15-comparison.json.
Preserved layout artifacts are source-r16/r17.json, build-r16/r17.xcresult,
layout-ui-r2.xcresult and its six exported screenshots,
installed-binding-layout-r2.json, installed-binding-layout-full-r3.json,
full-r3.xcresult, full-r3-summary.json, fixture-r3/final-state.json,
fixture-r3/cleanup.json, layout-final-style-privacy.json and layout-final-device.json.
candidate-r17-products preserves the accepted layout app, unit host and UI runner.
Current reader artifacts are source-r18/r19.json, build-r18/r19.xcresult,
list-focused-r1.xcresult, list-ui-r1/r2.xcresult and their attachments,
list-ordering-acceptance.json, installed-binding-list-ui-r19.json,
installed-binding-list-unit-r19.json, full-r4.xcresult, full-r4-summary.json,
fixture-r4/final-state.json, fixture-r4/cleanup.json,
list-final-style-privacy.json and list-final-device.json. Candidate-r19-products
preserves the final signed app, unit host and UI runner. The private top-level
verification-summary.json points to this current source/product checkpoint;
the layout and eight-command recovery evidence remain explicit predecessors.
retained-ui-r6-frame-17.png records the predecessor identity defect.
Raw capabilities, authentication material, operator logs and system-share
attachments stay outside Git and chat.

The fixture controls authentication, shell data and delivery around actual
production sender HTTP routes, SDK and SQL. This does not verify real provider
login, inbox/push delivery, physical devices, every accessibility/display
configuration, native UI for every legacy approved-request policy variant, or
hosted deployment readiness. Canonical legacy-policy compatibility is covered
by backend acceptance and native model regression. Native creation currently
uses its email-and-role form; browser username/open-link creation and wider
ordinary-member onboarding remain separate acceptance scopes.

Full ordered backlog, migration replay/adoption, final paid-provider launch
bundle and exact pushed-head CI remain governed by the current handoff and
remaining-work inventory. This sender milestone does not close H07/H08 or imply
overall app completion.
