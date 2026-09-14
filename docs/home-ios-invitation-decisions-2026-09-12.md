# iOS Home invitation decisions — September 12, 2026

The iPhone invitation screen now saves the original accept/decline decision in
device-only Keychain storage before submitting it. Recovery belongs to the API
origin and signed-in account. A restarted app, another invitation link or a lost
reply recovers that original instead of starting a replacement. Acceptance,
decline and cancellation require explicit confirmation; cancellation cancels the
attempt and does not decline the invitation.

The resolver distinguishes missing invitations from unavailable or malformed
reads, and keeps retry and Close reachable. Terminal Home previews still lead to
protected recovery. Business-seat and guest-pass offers remain separate; an
unsuccessful business decline no longer dismisses the screen as successful.

Historical acceptance does not grant current access. Check current Home access
reads the current account's residency state, and Open Home checks again before
acknowledging the retained proof and navigating. Explicit denials and later
membership removal leave the historical result visible without an Open Home
button. Session and visibility changes invalidate old confirmations and replies.

## Protected sign-in handoff

Deferred links can contain invitation capabilities. The shared iOS deep-link
store now keeps the complete handoff in non-synchronizing,
`whenUnlockedThisDeviceOnly` Keychain storage. Existing preference records migrate
only after the protected write succeeds, retaining their original account binding
and 24-hour lifetime. New handoffs never write plaintext preferences.

Use another account saves the exact unbound invitation before ending the local
session. A failed secure write leaves the account signed in with a retryable
message. Ordinary logout still clears deferred content; server-ended sessions
retain only the original account's eligible content arrival. The logout network
reply is not required for the prepared invitation to survive a process restart.

## Actual acceptance

Final installed UI r3 passes in **308.125 seconds** against production invitation
HTTP routes, SDK and SQL. Five commands finish as two accepted, one declined,
one cancelled and one rejected; every retained original is acknowledged through
the native UI. The fresh journey includes:

- Unavailable preview and malformed context, retry, and a confirmation retired
  by backgrounding before it can submit.
- An unseen original cancelled after restart; acceptance with a lost reply,
  failed cold read and recovery of the saved result.
- Wrong-account isolation and switchback, explicit Home-view denial, later
  removal, and acknowledgement without restoring access.
- Lost decline recovery after restart and invitation expiry while confirmation
  is open, retaining the rejected original for review.
- A committed acceptance whose reply is held while another link opens; the
  earlier original wins, the late reply cannot navigate, and explicit current
  access checking reaches the member dashboard.
- Five account switches with the logout reply held, app termination before that
  reply, and sign-in after a cold launch. All five return to the invitation.
  Inspection of the owned simulator's preferences finds zero owned invitation
  capabilities and no legacy deferred-link keys at every restart.

The signed r7 build and installed main executable, production debug dylib and
Info.plist match by digest. Recovery, cancellation, wrong-account, removed-access
and member-entry screenshots were visually reviewed. Source style, privacy gates
and diff checks pass. Full iOS regression passes **4,383 checks / 168 skips /
zero failures (4,551 total)**, including protected write refusal, proof-write
repair without another POST, committed-clear recovery, secure legacy migration
and account-bound deep-link regression. The controlled loopback fixture remains
active during regression for the previously documented global-auth test dependency.

## Evidence and limits

Private evidence: `/private/tmp/pantopus-home-ios-invitation-decisions-r1/`.
`ui-r3.xcresult`, exported attachments, `ui-r3-final-state.json`, the five
`fixture-r4/native-storage-check-*.json` records, source digests and installed
image bindings preserve the final journey. Candidate r7 app and test runner are
retained using filesystem clones. All four exact fixtures are cleaned with full
role rows, full migration ledger, and exact function definitions/properties
preserved. Temporary command schema is removed without ledger adoption. The
owned simulator is shut down with its userdata preserved. Capabilities, operator logs and raw evidence
stay out of Git and chat.

Earlier UI r1 exposed an accessibility identifier collision; r2 exposed the
driver selecting a hidden sign-in button. The grouping and driver were repaired.
The retained r2 fixture then passed its bounded continuation in 177.883 seconds.
Final r3 starts fresh and adds the secure cold sign-in handoffs; it is the final
acceptance. Build and failed runner attempts remain available as private history.

The fixture controls authentication, shell data and delivery around actual
production invitation routes/SDK/SQL. It does not certify provider login, live
email/push delivery, physical devices, all display/accessibility combinations or
every member-dashboard service. Protected-write/proof-repair fault checks use an
injected store in regression; actual UI acceptance uses the production Keychain.
Android recovery, invitation creation/resend/withdrawal/delivery and complete
member onboarding remain open. H07/H08 stay partial: **7 of 80 acceptance rows
closed; 73 partial/open**, not a measure of app completion or remaining effort.

## Git and continuation

Browser predecessor `b39fb17304deb183393a93f916e0ac2d58343a1a` has every job passing
in [CI 34714175285](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34714175285).
The native milestone needs its own pushed-head CI verification. #32 is still an
open mergeable draft; #34 remains an unfinished conflicting draft at
`e9ef2decbb7ec435589bb3b92639041cfc4618a6`. No merge or permanent migration adoption.
Source inventories remain **44 Home / 21 paid / 53 combined**, 12 identical shared
versions and zero collisions; combined replay/adoption stays open.

Continue with Android protected invitation decisions and secure login return,
then invitation management/delivery, complete ordinary-member onboarding, legacy
compatibility and the full backlog. Paid services remain one final launch bundle.
The physical iPhone stays 1.0.0 (2). Owner work, databases, devices and private
evidence remain preserved.
