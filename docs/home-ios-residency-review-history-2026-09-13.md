# iOS own-review residency history — September 13, 2026

The installed reader passes on the owned iOS 26.5 simulator. This is a bounded
reader milestone on the separate native-history branch, not yet integration into
PR #32. The separate fresh iOS applicant/reviewer cycle now also passes.

The six new actor-isolation warnings in the frozen candidate came from synchronous
test setup. Asynchronous setup removes them without changing production behavior.
The signed two-architecture rebuild has no history diagnostics; all 31 focused
checks pass. Full regression passes 4,459 checks, with 168 skips and zero failures.

Actual installed acceptance uses 23 rejection receipts for one reviewer and one
approval for the other, created through real HTTP/SDK/SQL commands in a fresh
isolated fixture. Native UI proves first-page and older-page reading, exact saved
detail, current-reference wording, normal logout/cold login to the other account,
unavailable versus empty, explicit retry, foreground refresh, and an empty local
review-recovery store independently of server history. Complete domain rows stay
unchanged during reader-only intervals.

The separate installed race phase holds actual serialized successful list and
detail responses after SQL, changes the second reviewer's current permission
through the authorized owner route, and observes a newer 403. Both old 200s are
released before the native deadline with identical held/released byte lengths and
SHA256 values. Neither restores rows, detail, counts, or authority. The explicit
permission mutations are separately bracketed; they are not counted as read-only
SQL preservation. All 24 original decision receipts remain unchanged.

The list and approval-detail screenshots were visually inspected. At the observed
size, the applicant labels and recorded/current distinctions wrap without clipping;
the detail explicitly says current household access has not been checked. This
does not establish the wider accessibility, device-size, or release UI matrix.

All 679 installed app files match the retained signed product, and both app/runner
signatures are verified. The original removal products, first history build with
warnings, source inputs and result bundles remain separately preserved. The
simulator was stopped with data retained at the reader boundary; the later fresh
cycle has its own lease and evidence. No physical phone was installed.

Private evidence is under
`/private/tmp/pantopus-home-residency-cycle-r1/ios-history-candidate-r2/`, including
`source-r2.json`, `products-binding.json`, focused/full result bundles, both
installed result bundles and `installed-reader-binding.json`. Raw fixture data,
credentials, operator logs and products are excluded from Git.

The iOS durable archive independently verifies 10,260 files. The shared populated
fixture is now exactly cleaned after [Android reader acceptance](home-android-residency-review-history-2026-09-13.md),
restoring all 374 candidate and 366 retained tables and logical catalogs. Its
cleanup evidence is also preserved in the Android durable archive. The fresh Android
cycle also passes separately; final source reconciliation and exact pushed-head CI remain required.
These local results do not prove hosted deployment, provider delivery, renewal,
complete R03, or launch readiness.

## Separate fresh iOS cycle

The installed accepted app starts against a separate zero-command fixture. Actual
UI and HTTP/SDK/SQL prove selected-address household submission, acknowledgement,
waiting without Home access, rejection with a controlled lost reply after commit,
normal cold-login recovery of that original, and post-acknowledgement own history.
Two rejection POST attempts carry one request UUID and return the same complete
receipt; SQL reports the second as a replay. Their wire-body hashes differ, so
byte-identical payload preservation is not claimed. The SQL canonical intent hash
checks Home, claim, actor, action, role, trimmed reason and review token before replay.

Resubmission retains the same claim and occupancy and the unchanged rejection
receipt. An independent reviewer explicitly approves Member; the applicant then
sees household access and enters the actual Home dashboard through successful
current-authority and dashboard requests. Approval grants no ownership.
The owner's prepared removal names the exact member, Home and role, creates one
completed removal command and one removal audit, and is acknowledged.

The removed applicant returns through normal cold login, sees that household access
needs review and has no Open Home action. Opening the old Home dashboard link shows
Home access unavailable, receives current-authority 403 responses, and never
requests the private dashboard. Each reviewer still sees only their own unchanged
decision. Final state has two completed submissions, two immutable decisions and
one completed removal; ownership is unchanged and no DELETE or invitation command
was issued. All three observed protected original stores are empty after acknowledgement.
Keychain verification counts SHA1-indexed service rows without reading encrypted
values; an earlier plaintext-service query was invalid and is explicitly superseded.

Driver-only interruptions are preserved: target configuration, blank-unit handling,
the actual Household member selector, virtualized review rows, recovery navigation,
the supported requests link followed by Members, and an accessibility identifier
hidden by its parent. Accepted earlier subsegments are retained rather than replaying
committed originals. The final denied-link selector checks the observed title and
Reload current Home access control. No production change or app rebuild was needed;
all 679 installed app files still match the accepted signed product.

The fresh fixture is exactly cleaned, restoring complete rows and logical catalogs
for 374 candidate and 366 retained tables. The owned iOS simulator is stopped with
userdata retained. Private `ios-fresh-cycle-r1/final-validation.json`, phase result
bundles and fixture preservation snapshots are archived with 26,871 verified files;
manifest SHA256 is `11ef590537b867509ffe7ae0d58875773d684b1367b1a9ec13d9bf50b8f9765f`.
Address providers, authentication and delivery remain controlled local boundaries.
