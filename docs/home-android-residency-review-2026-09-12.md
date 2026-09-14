# Android prepared residency review — September 12, 2026

Accepted local milestone after iOS milestone `e207b4b846cf3b002f27758a063155d2e644d0fa`.
Final r3 Debug/Release builds, full lint/regression and the complete fresh installed
HTTP/SDK/SQL journey pass. Verify this milestone’s own pushed-head CI. Together
with accepted browser/backend and iOS review, this closes inventory row R01
within the limits recorded below.

## Resulting behavior

Both owner and household member entries open prepared residency review. The
current claim, applicant, selected role and membership/date/verification limits
are visible before a reviewer explicitly confirms approval or rejection. Editing
an action, ordinary role or optional rejection reason clears confirmation.
Close and Reload remain outside the scrolling review. The rejection field has
a persistent label, character count and keyboard Done action; the whole labeled
confirmation row toggles its checkbox. Offline, loading, unavailable, empty and
session-change states retain clear recovery controls.

One original decision is synchronously committed in account/origin/Home-scoped
encrypted preferences before dispatch. The store uses compare-and-swap, retains
uncertain originals on failed commits, and is excluded from cloud/device backup.
Current session and reviewer authority are checked before each decision or
acknowledgement. Historical proof binds actor, Home, claim, UUID, action and review
token; current claim/membership data never enters the saved original. A known
receipt repairs a failed local write without another POST. Later access removal
or a resubmitted claim remains separate from the old receipt.

Background/account changes hide private state and retire in-flight reads.
Unexpectedly missing originals block replacement. Explicit acknowledgement can
reconcile cancellation after an IO commit has already removed the original.
The dialog keeps its secure-screen flag; no capture protection is disabled.

## Actual installed acceptance

UI r1 stopped before a decision when cold launch restored an older Home destination.
The corrected driver returns through normal Back and Profile; it does not reset
data, alter authentication or bypass the actual entry. Full UI r2 passes all
three phases; fresh UI r3 repeats them on the final rebuilt app through production
HTTP, the local Supabase SDK and SQL. Sign-in and unrelated shell responses are
synthetic; no provider or hosted service is contacted:

- Owner entry, cancel without POST, unavailable/malformed reads, explicit review,
  role-change reconfirmation, lost approval and cold exact replay. Later move-out
  stays inactive alongside historical approval; a second cold receipt read sends
  no POST. The native acknowledgement clears the saved original.
- Member entry, stale-claim refusal without a receipt, explicit acknowledgement,
  lost rejection and cold replay after resubmission. Current pending claim and
  original rejection reason remain distinct. Revoked authority hides private
  data and decision/recovery actions; restored access permits acknowledgement.
- Held preflight plus background sends no decision and retains the original.
  Explicit retry confirms once. A retired authorized read cannot restore access
  after revocation. Restored access reads current state; final recovery is empty.

Final SQL: six POST attempts, three receipts, identical bodies/paths for the two
replays, no held work and restored authority. Encrypted XML contains no plaintext
address, reason or command UUID. All protected originals are acknowledged via
native controls, leaving zero command slots. Actual accessibility hierarchies
are preserved. A host-window capture attempt was unavailable; it is not visual
acceptance evidence and secure-screen behavior was left enabled.

## Checks and evidence

Final Debug/Release builds pass. Full final regression passes **515 suites per
variant: 4,545 passed / 80 skips / zero failures**, 4,625 total each. Five focused
checks cover protected-write refusal, known-proof repair without another POST,
retired preflight, committed acknowledgement cancellation, unexpected missing
originals and mismatched historical actor/claim proof. The first full regression
also passed; its later static-analysis findings remain separate evidence. A
complex condition, broad exception catch and unnamed suffix lengths were corrected
without suppressing rules. Final Ktlint, Detekt, full Lint, privacy and both APK
signatures pass after those corrections.

The final optimized APK directly round-trips Approve and Reject through its actual
Moshi enum adapter on the owned emulator. This verifies the retained reflective
fields in the shrunk product, beyond unshrunk unit classes. The earlier r2
optimized product passes the same runtime probe and is preserved separately.

Private directory: `/private/tmp/pantopus-home-android-residency-review-r1/`.
Final `source-build-r3.json` binds the candidate sources and both APKs;
`installed-binding-r3.json` verifies the actual installed Debug APK hash. Evidence
includes `final-build-checks-r3.log`, final style/privacy/signing logs,
`regression-r3-summary.json` and preserved XML, UI r3 and its hierarchies/storage/
HTTP/SDK/SQL proof, `release-enum-r2`, exact final fixture cleanup and
`accepted-products-r3`. `source-evidence-r1.json` binds these to the committed
source. First builds, UI r1/r2, `ui-r2-binding.json`, `reviewed-products-r2` and
`release-enum-r1` remain separate. Private evidence is excluded from Git.

The owned emulator is `Pantopus_Home_Recurrence_Acceptance`, serial
`emulator-5556`. It is stopped after acceptance with userdata, installed app and
owned artifacts retained. No app-data reset, authentication replacement or
snapshot restore was used for either accepted journey.

## Preservation and remaining scope

Both exact fixture instances are cleaned, with review-function OIDs/definitions/
owners/ACL/config and fingerprints of every migration-ledger row/column unchanged.
There is no source migration, hosted release, physical-device change or paid
activation. Source inventories remain 43 Home / 21 paid / 52 combined, with 12
identical shared versions and no timestamp collisions; combined replay/adoption
remains open. Owner work, databases, devices and earlier artifacts are preserved.
The physical iPhone remains Pantopus 1.0.0 (2). Paid services remain one final
launch bundle.

R01 is locally verified; seven of 80 tracked rows are closed and 73 remain partial
or open. That count is not whole-app completion or remaining engineering effort.
Invitations/private first use, no-claim address submission, legacy compatibility,
broader native review history/authority/accessibility/provider combinations and
the full backlog remain open. A separate unaccepted browser first-use candidate
is preserved outside this milestone's staging scope.
