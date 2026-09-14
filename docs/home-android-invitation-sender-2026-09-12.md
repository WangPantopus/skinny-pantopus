# Android Home invitation sender recovery

September 12, 2026. This bounded milestone implements the
[sender contract](home-invitation-sender-contract-2026-09-12.md) alongside the
accepted [recipient recovery](home-android-invitation-decisions-2026-09-12.md).
The final Android production candidate is **r11**. Sender command acceptance
uses r10; the subsequent reader-only change has its own installed r11 checks.

## Behavior

Create, resend and withdraw first obtain current server authority and reviewed
terms, then require explicit confirmation. Before submission, Android retains
the immutable request and exact serialized request JSON in Keystore-backed
encrypted preferences, excluded from backup and device transfer. Recovery is
bound to the account and API origin. Failed or corrupt protected storage cannot
be treated as an empty slot, and there is no plaintext fallback.

Check status, retry, cancellation and acknowledgement preserve the original
request across lost replies, process death, changed accounts and newer actions.
The original action and a different-Home warning remain explicit. Lifecycle and
session changes retire confirmation and late callbacks. Acknowledgement follows
validated terminal proof; a failed members refresh cannot change a completed
command into an unsuccessful creation.

Resend targets the existing invitation through its own command. Withdraw targets
the pending invitation and never invokes membership deletion. Expired pending
invitations remain visible for withdrawal. Their Resend control is currently
visible: preparation refuses the expired invitation before creating an original
or permitting confirmation. Delivery wording distinguishes a saved invitation,
provider acceptance and unconfirmed delivery; it does not claim inbox, push or
device delivery.

A historical completed receipt alone cannot expose a shareable link. A fresh,
read-only current-context check must confirm the original invitation, Home and
account; Share checks again. Exposure expires and is retired on refresh failure,
lifecycle or account change. The link uses a validated configured public web
origin, including an explicit acceptance loopback origin. These checks do not
submit a resend command or trigger delivery.

Reviewed terms prefer validated effective `proposed_role_base`, with legacy role
fallback only when absent or null. Invalid role or preset types reject review.
Household-approval presets use a readable label while the protected original
retains the exact contract value. Invitation wording does not claim that an
ordinary recipient has completed membership onboarding.

## Visible recipient selection and list ordering

The initial installed Pending screen exposed a real safety/usability defect:
two long recipient identities were visually indistinguishable next to their
actions, although accessibility text contained the full names. The r10 repair
gives pending invitations a wrapping, full-width identity with Resend and
Withdraw beneath it. Role appears once. Other row layouts retain their defaults.

Actual raster inspection verifies both complete usernames at the owned
emulator's tested size. Four native preparations cover both recipients and both
actions; each review identifies the matching recipient and is closed without a
command. Accessibility text alone is not counted as visible identity proof.

The r11 reader stages the whole members fetch before publication and fences it
by generation and current session. Duplicate initial loads are suppressed.
Latest failed or denied reads retire cached pending rows and management access;
switching tabs cannot restore them. Recovery of a protected original remains
available independently of the list. Seven focused regressions cover overlapping
reads, later endpoint failures, session changes, duplicate loads and tab changes.

One uninterrupted installed r11 follow-up holds three older successful sender
list responses while newer refreshes produce, respectively, a controlled 503,
current authority denial, and a successful list after a recipient accepts.
After each old reply is released, subsequent audit traffic proves the older
client flow resumed. Repeated tab changes preserve the newer outcome. Explicit
retry restores current data after the failures; the resolved recipient does not
reappear after the newer success. Recovery entry remains usable. This follow-up
creates **zero sender commands**, retains no original and includes current Pending
raster inspection. Existing fixture controls suffice; no protocol change is
part of this reader repair.

## Installed sender acceptance

The r10 `ui-r4` run uses normal native sign-in, production HTTP routes, SDK and
SQL, with controlled delivery. Its **eight commands** finish as five completed,
one cancelled and two rejected, with every original acknowledged:

1. Creation commits but loses its reply. Cold restart and a failed status read
   retain the original. Actual Retry sends the same request UUID and request
   hash; command and delivery snapshots do not change. Later list failure is
   shown separately from the completed creation.
2. Expired resend preparation refuses submission; explicit withdrawal completes
   without changing the fixture membership projection.
3. Explicit resend completes against the existing invitation without increasing
   invitation row count; delivery wording reflects the returned proof.
4. A recipient accepts after withdrawal review. Confirmation is rejected and
   the legitimate membership projection is preserved.
5. Withdrawal commits with a lost reply, then recovers after cold restart while
   preserving membership.
6. A creation never reaches SQL. Normal sign-out, a held logout reply, process
   death and account changes preserve its account isolation. Returning to the
   original account cancels the unseen command without creating an invitation.
7. Authority is removed after creation review; confirmation rejects and the
   original remains recoverable until acknowledgement.
8. Username creation commits while its reply is held. Cold restart recovers the
   terminal result before the late reply is released, with truthful wording.

The same run performs a fresh sharing check and opens the actual Android system
share chooser for the configured loopback link. It closes with Back without
choosing a recipient, sending or copying. No sender POST occurs in that sharing
segment. Failed and expired sharing checks retire link exposure.

No membership-removal request occurs. Native membership comparisons cover the
fixture's ID, user, active/verification state, role and access-window projection;
the backend report owns broader SQL preservation proof. HTTP request hashes
cover the parsed JSON body, not every raw wire byte. Exact stored JSON reuse is
separately exercised by coordinator and codec tests.

## Final verification and preservation

Final r11 focused tests pass **104/104**. Debug and Release each pass **518
suites: 4,577 passed, 80 skipped, zero failures/errors** (4,657 total per variant).
Ktlint and Detekt pass. Full Debug/Release Lint reports zero errors/fatals;
existing totals are 214/189 warnings and 17 informational findings respectively,
with no sender, wizard or member-reader finding. The final offline full-variant
build, both Lints and optimized Release assembly pass in **18m 34s**.

Both retained final APK signatures verify. The installed Debug digest matches
the retained r11 APK. A separate process on the owned emulator loads the exact
optimized Release APK and executes its actual generated Moshi adapters. Sender
intent, nullable withdrawal token, exact request JSON and protected original
survive round trips. The probe follows the actual R8-merged Moshi constructor
from retained optimized bytecode. It makes no network call, does not install
Release and keeps the authenticated app stopped.

Private evidence is retained under
`/private/tmp/pantopus-home-android-sender-r1/`. `verification-status.json` is the
current index. `candidate-r10-final-products.json`, `installed-binding-r10.json`,
`ui-r4-source-binding.json` and `layout-r10` bind the eight-command and identity
acceptance. `candidate-r11-final-products.json`, `installed-binding-r11.json`
and `list-ui-r1-source-binding.json` bind the reader-only follow-up and final
checks. `release-codec-r11/result-r11.json` binds the optimized runtime proof.
All 2,334 source entries in the final Android source manifest still match.

All three owned fixtures are exactly cleaned: fixture rows removed, complete
role rows restored, complete migration ledger preserved, and function
definitions/properties restored. The database and port are released. The owned
emulator is stopped with its data retained; no app uninstall, data reset or
physical-device installation occurs. Earlier candidates, the interrupted
storage-pause build and operator evidence remain separate from accepted results.
Credentials, capabilities and operator logs are not committed.

Protected wizard capture remains enabled; native control hierarchies and
HTTP/SQL outcomes support those screens, and zero-byte capture placeholders are
not pixel evidence. Other device sizes, font sizes, TalkBack, live delivery
providers and hosted deployment remain verification limits. This milestone does
not complete ordinary-member onboarding/private first use, older-client
residency compatibility, combined migration adoption or launch readiness.
Acceptance-area counts remain 7 closed and 73 partial/open; these are not an
app-completion percentage. Exact-head CI and integration are recorded by the
current project handoff after commit.
