# Pantopus project handoff

Updated September 16, 2026. The user resumed verification and development with full
permission: inspect existing implementations, repair demonstrated bugs/security
issues, preserve working behavior and screen designs, then cover the remaining
features. The [80-row inventory](REMAINING_WORK_2026-09-11.md) is the ordered backlog;
its8 locally closed/72 partial or open rows are not an effort/completion percentage.
Follow [AGENTS.md](../AGENTS.md). R05 and the app remain incomplete.

## Current integration gate — September21

Master e8b49c963 includes documentation PR78. PR70 at07827d2b0 and PR77 ate11123328
passed their applicable checks. Strict branch protection requires PR70 to include
current master. Its author merged the five documentation files in the isolated
checkout and pushed **21b93aa62**; coordinator independently verified zero
backend/frontend/supabase diff. Required CI is running on that updated head. Hold further documentation merges
until70→72→73→75→77 integrate, preserving the live runtime and accepted UI proof.
The separate worker repair is PR80 at6e422bd91, with reviewed actual worker/SQL/
localSMTP candidate proof and exact cleanup, pending required CI/dependencies.
Stream1 has begun isolated P09 refund-session verification on unchanged8825;
18132/18133 and64561–67 are active/reserved, no new acceptance yet. Stream3 has the
sole owned simulator slot for a capability-first N04/N03 installed-screen attempt. See live README and Stream3 status.

## Latest integration — September21,00:21UTC

Paid branch **8825c1928** is clean/pushed. It includes reviewed master61080b399 and
the one-line Offers status refresh repair proven with actual Stripe authorization
and reopening. The combined account-switch check, actual assigned hold releases,
and partial500c/remaining750c refunds all passed through existing browser/UI/API/SQL.
Prior9ae full CI35542623560 passed; current8825 CI35545431059 fully passed15
applicable checks/one Seeder skip, including Android and all three iOS simulators.
Current source, evidence and precise limits are in [Stream1 status](workstreams/01-gigs-payments.md).
All Stream1 owned rows and runtimes are cleaned/stopped; five Stripe TEST captures
fully refunded, five unpaid intents cancelled, four owned customers deleted. Provider
history remains. Native/live/hosted/payout and broader backlog scopes remain open.

Coordinator merged PR65/66/67/69 after each current-head checks and bounded UI/API
proof; mastercefdadd3e contains those reviewed scopes and published coordination. PR70 comment privacy/draft
retention is separately reviewed. Its iPhone16 CI failed on the existing expired
InviteeManageBooking fixture, matching already accepted paid commits9ecf66fc7 and
9ae1edb3b. Stream3 reused those exact commits in an isolated checkout and pushed PR70
**07827d2b0** without changing its live423 runtime or combining dependent drafts.
The repaired head requires fresh CI before integration; PR72/73 passed their own
current-head checks and remain dependent drafts. Do not repeat the fixture repair. Stream3 continues actual
SMTP reminder verification under its existing service/runtime grant. PR72 atcbfba3503
and PR73 at423176969 publish separate dependent drafts for reminder recovery and
personal profile/draft retention. Current CI and precise retained fixture limits are
in Stream3 status; own-post visibility after reload remains a separate unresolved gap.
Documentation PR68 merged4f951d29c, PR71 mergedcefdadd3e and PR74 merged707f8e2be.
PR75 publishes the separate two-file preference database-failure repair5e3a8b963;
real UI/API failure/retry and worker refusal are verified, exact-head CI passes;
dependency integration remains. PR77 e11123328 now aligns the three existing web
reminder callers with canonical BookingPage timing. Actual UI save/reload/failure/
ordering evidence and source hashes are reviewed; required CI remains pending.
Empty[] and0 persist correctly, but their delivery behavior is still unaccepted
and requires separate worker verification/repair. PR76 mergedfd2c5d9d7. A subsequent held offers
read ended correct without another app repair; browser serialization limits its ordering evidence. Stream3 reminder
and personal composer repairs have separate bounded grants in the live README.

## Resumed coordination — September 20, 2026

Active coordinator/Stream1 task `01a0c0d1-0703-70c3-b842-6d01bc8ca48b` restored the
missing registered paid worktree at `3657af97d`, adopted the later September16
milestones, and merged current master `38f00dcc8` as **`aa168017e`** (documentation
only; application bytes unchanged). PR47/PR34 remain draft, PR46 separate. See
[active sessions](workstreams/README.md#active-sessions-and-runtime-ownership--september-20-2026)
for all three resumed streams and nonoverlapping runtime/browser ownership.

New bounded [browser tip acceptance and real-provider repair](workstreams/01-gigs-payments.md)
uses existing UI/SDK/routes/service and full-schema PostgREST/SQL. Synthetic-provider
phases verified8 gigs/7 originals/5 successes/2 cancellations with session/concurrency/
transport failures. Actual Stripe TEST checkout then reproduced captured-but-unrecognized
tip: optional charge.transfer was omitted, strict-null check refused it. In-place
receipt fixbe13cd7ba recovered that same capture; real decline/retry, failed/successful
3DS with dropped committed reply/reload, and zero-charge cancellation pass. Current
paid head **9ae1edb3b** includes a separate expired existing iOS fixture correction;
no new unit tests/screens/layout/schema. Current CI35542623560 running; affected
64 backend regressions pass. Superseded CI exposed September17 fixture expiry,
not app scheduling regression; never report current green from prior evidence.

Additional actual paid-bid UI journey authorizes selected12.50 against20budget,
worker starts/completes while hold remains, ownerapproval captures exact1250.
Separate7.50checkoutcancel restorespendingbid/opengig with0charge, no appchange.
All Stream1 local rows0, own API/web/Supabase stopped. Across both providerphases,
four Stripe TEST captures fully refunded, two unpaid intents canceled, two customers
deleted; provider history
retained. Synthetic identity/notification transport limits remain. Native tip
attempts lack functioning supported device control, not accepted; native slot free.
Live/hosted/Connect payout boundaries and P03/P08/P09/app remain incomplete.

Stream2 PR60 **3dc226983** passed combined CI35543397030 and was merged as
**ebeea43d5** at 23:07 UTC. Home source remained unchanged while adopting the
shared session repair; one focused browser journey verified delayed creation,
recovery, viewing, revocation and list-error retry through actual API/SQL. The
broader native, hosted, clipboard and M02/D08 limits remain open. Its final02
handoff is published separately from application code.

Stream3 safety PR64 **f387cd480** passed exact-head CI and was merged as
**2d6ff2069** on September 20 at 23:00 UTC. Source review and real local GoTrue
browser/API evidence cover inert Report/Block controls, account-state retirement,
wrong-account retry after a delayed401, and an old refresh response overwriting a
new login's cookies. Existing client code now cancels the old refresh and preserves
new-account state. Storage-event delivery, frozen tabs, other browsers and native
limits remain explicit; no broad safety row closed. The separately verified A02
Settings step-up and two UserBlock FK repairs passed e96be1ea4 CI35543817853.
PR65 is ready; f30c7fe7a integrates required docs-only master8ed60f6ed for GitHub
up-to-date protection, with CI35544236662 running. Source reviewed; the new `20260916012000` migration follows Home11000. Single-writer scopes and migration20260916012000 are in
README. Frozen03 was published; later dirty updates are author-owned.

Next: finish paid current-head CI and A02 merge, then verify payment session recovery
on the combined paid branch. Home is already merged. Continue remaining provider/native acceptance. Fee payer/recipient/timing decision
is pending. Documentation PR63 merged as8ed60f6ed; subsequent milestones publish separately from feature code.
Preserve PR34 draft and unrelated PR46; paid PR47 remains draft.

## Current coordination and next action — September 16, 2026

The September 15/16 cutoff was resumed by the coordinator/Stream 1 session on September 16
(the user confirmed the iOS Start Work receipt guard and its test correction are fixes to
keep). Read the live [coordination guide](workstreams/README.md) and
[Stream 1 status](workstreams/01-gigs-payments.md#milestone-ios-start-work-candidate-verified-locally-and-installed--september-16-2026)
before editing or using resources. The only live coordination location is
`/Users/yingpengwang/pantopus-coordination`.

Master is **`c14657e35`** after Stream 2's PR53 (`4cc9d3787`), Stream 3's PR51 and the
documentation PRs 52/54/55/56. Paid worktree `/private/tmp/pantopus-paid-gig-integration`
is clean and pushed at **`3657af97d`** (master integrated as `6e106d9d0`, then the 21
paid-only migrations renumbered after master's newest version because the migration
policy failed on the integrated head) in draft
[PR47](https://github.com/WangPantopus/skinny-pantopus/pull/47); CI is green on
`a65411758`, `4ad88ec11` and `3657af97d` (15 applicable checks each). PR34
remains draft at `c9cb69825`; user PR46 stays separate. No paid application merged.

Stream 1 evidence today: the correction that repairs CI 35103180556's three iOS test
failures; SwiftLint/SwiftFormat at the pinned versions; 59/59 `GigDetailViewModelTests` on
the owned iOS 26.5 simulator; and installed candidate journeys through the real sign-in UI,
the existing GigDetail screen, the real start route, PostgREST and PostgreSQL with synthetic
identity and intercepted providers: invalid receipt, lost reply, retry recovery, ordinary
start, double tap, and the stale-assignment-before-read boundary. That last journey showed the
route starting a newer same-worker assignment the client never displayed. The follow-up
milestone `a65411758` binds Start Work to the displayed terms (optional expected fields on
the existing route, passed by the existing iOS/Android/web callers) and is verified by
backend/web/Android/iOS suites, a real HTTP/SQL harness and the installed iOS candidate,
where the stale screen now gets 409 with no write or notice and a reopened screen starts
normally. The installed Android candidate then passed the same journeys on a new owned emulator.
Later on September 16 the existing completion, owner-confirmation and reopen/release
policies (immutable displayed terms included) passed 32/32 real HTTP → route → PostgREST →
PostgreSQL checks on a private full-schema project with no application change; the paid
confirmation is verified to the provider boundary. The existing tip implementation (P01–P03)
then passed the tracked service harness (22/22) and a route-level harness (15/15) on the same
project, which was released with zero owned rows. See the Stream 1 status for limits
(my-bids card, providers, fee policies). Real provider authorization, the fee payer/recipient
decision and the wider P04/P08/P09 scope remain open. Fixtures are cleaned to zero, HTTP18132 is stopped, the owned simulator is shut
down and the heavy native slot is released.

Coordinator dispositions: Stream 2's `70e079543..88d076e56`
([PR53](https://github.com/WangPantopus/skinny-pantopus/pull/53)) was source-reviewed with
green CI and merged as `4cc9d3787`; its disposable SQL project is reported stopped.
Documentation PR52 merged as `949d4dbb1` and PR54 as `b46934c92`. Stream 3's
[PR51](https://github.com/WangPantopus/skinny-pantopus/pull/51) (safety repair, native
lifetime, N05 reminder failure contract, retry privacy, transactional block admission)
was source-reviewed, its PostgREST smoke check reported passing, and it merged as
`c14657e35` after green CI on the master-updated head; N04/N05 rows stay open per its
status. Retained SQL64522 schema may not be changed. P04/P08/P09, M02, N04/N05, R05 and
launch remain open; inventory counts are unchanged. No hosted deployment, provider
activation or physical-device change ran.

## Superseded cutoff record — September 15/16, 2026

The user requested immediate wrap-up. Stream1/coordination work is handed off;
read the [exact resume point, failed checks and evidence](workstreams/01-gigs-payments.md#immediate-cutoff-handoff--september-1516-2026)
and the live [coordination guide](workstreams/README.md) before editing or using resources.
The only live coordination location is `/Users/yingpengwang/pantopus-coordination`.

Fresh master is **`82430954038ec6e74b72b54192aaad8117bcc363`**, documentation-only
PR50, four applicable checks/seven path skips. Paid worktree
`/private/tmp/pantopus-paid-gig-integration` is clean and pushed at
**`9af5dcf7417760c9483c4f7b1e1008722350daf8`**, an **unverified iOS WIP** in draft
[PR47](https://github.com/WangPantopus/skinny-pantopus/pull/47).
PR34 remains draft at `c9cb69825`; user PR46 stays separate. No application merged.

Next: inspect the three existing iOS ContentDetail files, fix the one strict
SwiftLint trailing-closure violation, reserve the heavy native slot, then run the
candidate iOS tests/build and installed Start Work failure/retry journeys.
Baseline59 tests had53 passes/6 new failing cases (28 assertions); the installed
baseline ordinary Start Work journey persisted successfully through actual API/SQL
with synthetic auth, a free gig, old schema and intercepted providers. Candidate
parsing passed, but **candidate compilation/tests and installed acceptance have
not run**. Preserve the failed evidence and do not equate this WIP with completion.
Earlier backend229 regressions/13 HTTP cases and Android54 JVM tests retain their
source limits. CI35049746982 is green only for prior `41c75d49a`, not the WIP.

Stream1's exact fixtures are removed, HTTP18132 stopped and isolated simulator
C2BCF36A-F300-48C1-9BA7-876CA9F61E55 shut down. Heavy native slot released.
Private evidence is mirrored in the owner's recovery audit directory; see Stream1
for exact paths. Existing owner and peer work/resources are preserved.

Coordinator also resumes review of Stream2 `70e079543` (no PR; browser slice/SQL
boundary simulated) and draft [Stream3 PR51](https://github.com/WangPantopus/skinny-pantopus/pull/51)
currently `22adc728512b8dd0f261c0aaf02e255123dc7f50`. Later native-lifetime, reminder
and cross-room retry repairs are reported and await full coordinator review;
[reviewed dfc860bfe evidence](VERIFICATION_FIRST_2026-09-13.md#existing-profile-safety-and-blocked-user-journeys)
retains its narrow limits. Neither stream is approved for merge. Their dirty live
status files remain author-owned and unstaged by this cutoff publication.

Stream3 continues its explicitly granted block/send transactional repair in the
new isolated SQL64532/API64531 runtime; exact forward-migration/contract ownership
is recorded in the guide. Retained SQL64522 schema may not be changed. Stream3 reported its HTTP18130/web18131 stopped and exact fixture cleanup zero at
cutoff; its isolated canonical-empty SQL64532 database remains healthy and reserved.
No transactional migration/test code has been written. Docker is responsive.
Read fresh peer status/CI before any integration; do not duplicate its work.
P04/P08/P09, M02, N04/N05, R05 and overall launch remain open; inventory counts are
unchanged. No hosted deployment, provider activation or physical-device change ran.

## Historical state and next action — September 14

**Master:** `f6dbbe2ebdc2d63405aaac4f23cd2759ca0852be`, after reviewed
[PR43](https://github.com/WangPantopus/skinny-pantopus/pull/43) and
[PR44](https://github.com/WangPantopus/skinny-pantopus/pull/44) merges on September14.
Home PR43 passed all16 checks in [CI34879088468](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34879088468);
master0cb4f3c60 exactly matched tested d18120a8c and retains all seven Home heads.
PR32 is also marked merged; PR38–42 are closed as incorporated through PR43, with
branches retained. File-picker PR44 passed all6 applicable checks/five path skips
in [CI34885279768](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34885279768).
It fixes the existing replacement/count and preview-URL lifetime defects; eight
regressions/types/lint and bounded Chrome checks pass. Actual native chooser and
provider upload remain outside that component acceptance. No deployment or
migration activation was performed. Owner checkout and unrelated work are intact.

**Active:** `/private/tmp/pantopus-home-permission-boundaries`, branch
`codex/residency-letter-expiry`, based on the actual merged master. The existing
issuer-list projection now reports elapsed letters as expired without waiting
for a public verification request. Existing web/iOS/Android cards distinguish
Expired, Revoked and unknown/unavailable statuses. Historical PDFs, explicit
revocation and existing designs are preserved. All changes extend existing files;
no replacement screen, table or migration. See [expiry evidence and limits](VERIFICATION_FIRST_2026-09-13.md#existing-residency-letter-expiry-projection-and-labels).

Baseline failures reproduce the list/status defects. Current checks pass12 backend,
20 selected web,20 iOS and6 Android tests, web types/lint and native static checks.
All8 actual local HTTP/SQL cases pass, including issuance, issuer/member/departed
access, pre-public-read expiry, byte-identical frozen PDF, and redacted public
verification. Chrome renders the actual existing card from the captured synthetic
issuer-list response: Expired, Mail disabled, PDF enabled, no Revoke button.
This browser check injects a query-cache fixture; it is not authenticated browser
API acceptance. Native checks cover DTOs and compilation, not installed letter
journeys. R06/R05 and the app remain open; inventory counts are unchanged.

The first HTTP cleanup used a malformed email filter and left three fixture users;
exact-ID/email cleanup corrected it, and all4 table counts are now zero. The
private Next18119 is stopped, its temporary page and browser tab removed, generated
route/build output preserved privately, and all tracked configuration restored.
Web types pass after regenerating stale references from the earlier temporary
file-picker page. The owned iOS simulator is already stopped; other devices are
untouched. Private evidence lives under residency-letter-expiry-r1.

**Paid candidate:** `/private/tmp/pantopus-paid-gig-integration`, branch
`codex/paid-gig-integration`, is preserved remotely at `6d0fc6dec`. It incorporates
PR43's merged Home master and the existing TipModal repair from0334ffeca. The
Home merge changed only three approved PNG references and documentation; one
append-only report conflict preserved both sections. Earlier combined backend5808,
web59 and tip10 tests/types/lint remain source-specific evidence. PR34 itself is
still draft at e9ef2decbb. Cancellation presentation/custom reason, durable tip
creation/recovery, combined native/DB CI and actual provider acceptance remain
open. Add PR44's merged master before combined CI. Paid activation stays in the
final launch bundle. Preserve the paused renewal/two-table draft.

**Current repairs reuse existing implementations.** The one existing unmerged
service-only lease transaction uses existing leases, invitations, residents,
occupancies and audit records. No replacement screens or tenancy tables were
added. Current Home/authority checks and atomic decisions protect approval,
acceptance, end/move-out, tenant cancellation and request/invitation creation.
Existing web/native callers preserve original dates, recover saved requests and
retire old Home/account/departure work. Reuse unchanged accepted evidence.

Recent follow-ups: existing unit vacancy reuses lease-end and per-unit authority;
old invitation URLs reach the existing recipient screen; the existing sharing
modal keeps the link; real multi_unit parent Homes cannot admit tenants. Creation
now rejects invalid dates/revoked authority, saves invitation/audit atomically and
recovers the same row from a retained random proof. Web closing/reloading uses the
existing encrypted recovery database, scoped to origin/account/unit, and POST
binds the observed actor. Notification recovery uses the existing Notification
idempotency column/index; duplicate retries do not re-emit or reset a read notice.

Detailed source-specific evidence is in the [verification report](VERIFICATION_FIRST_2026-09-13.md):
[creation](VERIFICATION_FIRST_2026-09-13.md#existing-lease-invitation-creation-boundaries),
[protected reload](VERIFICATION_FIRST_2026-09-13.md#existing-lease-invitation-retained-recovery),
[notice recovery](VERIFICATION_FIRST_2026-09-13.md#existing-lease-invitation-notification-recovery).
Latest bounded checks pass186 backend/notification tests,70 rendered web lease
tests, standalone web TypeScript/scoped lint, full lease SQL contract and generated
pgTAP wrapper. Application-function lint has266 functions/85 trigger bindings,
zero errors/eight existing warnings. Actual browser/SDK/HTTP/SQL and9 actual
IndexedDB/WebCrypto checks pass within their documented synthetic boundaries.

**Git/CI:** PR38 at c51740fce passes all15 applicable checks/one unchanged
Seeder skip in [CI34840961607](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34840961607), including both native platforms.
PR39 at461120fca passes all8 applicable checks/three path-based skips in
[CI34843857113](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34843857113).
Their commits are now in master through PR43; both stacked PRs are closed as
already incorporated. Preserve the earlier failed runs as failed: CI34836085491
had a stale generated SQL wrapper; CI34843214305 caught an immutable migration
edit. Existing generator synchronization and the forward function update fix those
issues. Before migration changes check the actual PR base; all54 wrappers synchronize.

**Next:** submit the bounded residency-letter expiry repair, check its required CI
and merge only if green. Continue PR34's existing cancellation presentation and
tip/recovery/provider gaps. R06 still needs its wider remaining lifecycle/device
acceptance; trace existing/archived callers before adding anything. Existing web
“Upload your lease” links use the separate residency-claim flow; do not merge
those contracts or invent screens from an inventory row. The existing iOS controls and web landlord reader are now locally verified within the [client evidence limits](VERIFICATION_FIRST_2026-09-13.md#existing-ios-lease-attachment-and-web-landlord-reader). Inspect each existing caller before editing; preserve screen design.
See [attachment evidence](VERIFICATION_FIRST_2026-09-13.md#existing-private-lease-file-storage-and-request-binding).
The request-controls follow-up is verified on draft PR42. The previously open installed Android request journey is now verified
within the [recorded limits](VERIFICATION_FIRST_2026-09-13.md#existing-native-lease-request-controls-and-calendar-validation).
Existing shell state binding fixes stale step/action controls; existing native
validators reject impossible calendar dates, and existing dirty-form guards cover
date-only, phone-only and message-only edits. Five existing product files change;
the only new file is an Android rendered regression test. Android passes74 final
checks and static checks; all52 final iOS request model/snapshot checks and
SwiftLint/SwiftFormat pass. No screen/layout/schema
replacement. Other wizard callers remain candidates for rendered verification.
Draft [PR41](https://github.com/WangPantopus/skinny-pantopus/pull/41) now includes
`1ed6f6793`, which fixes an existing Support Train test's shared FIFO response race
using the already available session-scoped route stubs. All13 selected tests pass.
Original [CI34851208086](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34851208086)
remains failed for that iPhone16 fixture; the other original applicable checks pass.
Replacement [CI34855898348](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34855898348)
passes all11 applicable checks/five path-based skips. No product Support Train
change or disabled assertion. PR42 at e16c0c499 passed all original applicable
checks except its iOS build: Sentry binary download hit a runner cache collision
before compilation. Original [CI34857194083](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34857194083)
remains a failed attempt; the failed build/dependent jobs were retried as attempt2
on the same source. Attempt2 now passes all11 applicable checks/five path skips, including all three iOS devices, Android and database replay. No app change or cache-policy workaround.
Draft [PR40](https://github.com/WangPantopus/skinny-pantopus/pull/40) at a1069e1de
repairs existing private document delivery and generic uploads; all6 applicable
[CI34845551425](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34845551425)
checks pass/five path-based jobs skip. Seven document and12 generic-upload actual
HTTP/SQL cases,115 selected tests and privacy gates pass, with exact fixture cleanup.
See [document evidence](VERIFICATION_FIRST_2026-09-13.md#existing-private-document-download-authorization)
and [upload evidence](VERIFICATION_FIRST_2026-09-13.md#existing-standalone-file-upload-compatibility).

Both native routers interpreted /invite/lease/<proof> as a token literally named
lease. The Android baseline reproduces it. The native candidate keeps
the complete proof and lease kind through the existing root navigation/invitation
screen. It calls only authenticated recipient-only preview/acceptance bodies and
validates the returned Home, actor and active membership. Not now closes without
a recorded decision. Existing recovery/session lifetimes and screen designs are
preserved. All134 selected Android routing/model/unchanged snapshot checks and
static checks pass. All88 selected iOS tests pass. Installed iOS verifies the
existing offer layout/dates, Not now without a decision, sign-in replay, and lost
acceptance response recovery with the same SQL lease/occupancy. Android also passes the installed offer, Not now, saved-response-loss recovery
and signed-out replay with no automatic acceptance or duplicate lease/occupancy.
The installed APK hash matches the candidate; an initial IDE snapshot restored an
older APK and was corrected before acceptance. See
[native evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-lease-invitation-links).
No screen, schema or new tracked file is added by the candidate.

Private lease client coverage remains partial. Its backend reuses File,
HomeLease, homeDocumentStorage and the existing recovery worker; the new route
only supplies the missing applicant/current-authority boundary. One forward
migration extends existing functions and permits an ownerless File only for a
retired private lease upload. Parent deletion preserves immutable cleanup keys;
no new tables or screen/layout changes. An abandoned draft's Home-delete blocker
was reproduced and repaired in the existing eligibility function. All244 selected
backend tests/privacy gates, eight SQL contracts and16 actual HTTP/SQL checks pass.
The populated forward rehearsal preserves374 table fingerprints and all existing
function identities/grants; application lint checks270 functions/88 trigger
bindings with zero errors/eight existing warnings. Actual storage and login are
synthetic in these bounded checks; hosted provider/rollout criteria stay open.
The subsequent iOS-to-web journey and Android attachment journey are locally verified within their reports; web tenant entry, remaining native readers and real provider acceptance stay open. Legacy generic S3 direct URLs remain unaccepted private evidence.

The current client milestone passes248 selected backend tests,148 web tests,60 iOS tests and18 actual HTTP/SQL cases, plus types/lint/format/privacy gates. The existing iOS file picker/card/removal/Submit controls reuse the existing multipart uploader and session lifetime. Lost upload/request replies recover the same File/request. The existing web property query omitted request metadata; its safe projection now exposes message and File ID, and RequestsTab reuses the private byte renderer. An installed iOS request opens in the actual browser reader; revocation during delivery and account changes prevent old private content appearing. All679 installed app files match the final tested product. Drafts are in memory, not durable across restart. Login/object storage/notices are synthetic, with real local API/database behavior; hosted delivery and all-platform completion remain open.

The Android follow-up passes69 selected tests and static/build checks. Installed
Android verifies real picker selection with a Unicode filename, committed-upload
response-loss retry, explicit failed-removal retry and committed-request recovery
without a second lease. Its final caption-only correction passes three Details
rendering checks and static/build gates; the final installed APK hash matches.
The installed functional journey is the preceding candidate, with all other
application/test source identical. No new screen, migration or table. See
[the source-specific Android evidence](VERIFICATION_FIRST_2026-09-13.md#existing-android-lease-attachment-controls).

**Native evidence/limits:** unchanged request/display source passes50 iOS/49
Android focused/rendering tests and static checks. Installed iOS covers Back/
Discard, saved-request/account/foreground recovery, correct calendar/status,
the earlier unavailable Attach feedback and invalid-date rejection/corrected save.
Live forms no longer insert sample files/data or promise email delivery. iOS and Android Attach are now connected and locally verified within their reports; all-platform completion remains open. Installed Android now passes the actual request route/SQL journey and real
Compose control/discard regressions under the recorded native request limits. Reuse the retained
products; one heavy native build at a time. Provider identity/delivery, combined
populated adoption and hosted rollout remain open. Notification recovery is
best effort and requires retry after a lost process; no eventual-push claim.

**Owned runtime:** private root `/private/tmp/pantopus-lease-transaction-r1`;
Next18110 is stopped after restoring its private harness page. The invitation fixture on API18109 is stopped. Exact owned Home, HomeLease,
HomeOccupancy, HomeLeaseInvite, HomeAuthority, HomeAddress and User cleanup is zero
under native-invitation-r1. Unit API18117
and notice API18116 are stopped.
The unit fixture has zero remaining owned Home, User, address or command rows;
source/evidence and exact cleanup are recorded in the private checkpoint. Earlier unit/invitation/sharing/building/
creation/retention/native API fixtures are stopped with exact row cleanup. The
owned iOS simulator, Android AVD and this session Android Studio are stopped;
owned Android registration was released and device data/products retained.
Android request verification finished on the matching calendar candidate APK.
API18109/fb23 is stopped, with exact Home/lease/occupancy/invitation/authority/
address/User cleanup zero under android-request-r2. Owned Android AVD and IDE are
stopped; only its owned registration was released, retaining device data/products.
The owned iOS simulator is stopped after its final bounded regression suite. The
incomplete worktree-only Gradle accessor cache was quarantined; no shared/user
cache was cleared. Owner iPhone17,
Bill Acceptance and Home Recurrence Acceptance devices remain untouched. The
schema-only `home_landlord_verify_20260913_r1` database/REST18089 remain reserved;
direct PostgreSQL64522 responds. Its existing Home-create function includes the
unit candidate body, with unchanged signature and passing generated SQL contract. Docker control stalls: use the private direct-SQL
helper that verifies the exact database, not repeated Docker calls/global restart.
The private lease File candidate is now applied only to this owned rehearsal
database (including the existing Home-delete eligibility extension). All fb26
HTTP fixtures are cleaned. Subsequent attachment API18109, browser proxy18117 and owned simulator are stopped. Both installed-client fb27 cycles have zero remaining owned rows/objects. The exact synthetic picker file was removed. Build/test products and source bindings are retained privately.
Android fb28 attachment fixtures are also exactly cleaned (all eight row/object
counts zero), API18109 is stopped, the owned emulator is stopped and registration
released, and its exact synthetic picker file/reverse mapping are removed. R6/R7
products and evidence are retained. Inspect the private current-checkpoint/runtime leases before reuse; clean exact
owned fixtures afterwards. Credentials, tokens, archives and operator logs stay
outside Git/chat. Evidence is mirrored to the owner's private
`.pantopus-recovery/audits/20260913-lease-transaction` directory.

**PR disposition:** PR43 and PR32 are merged; PR35/36/37 were already merged into
the preserved Home chain. PR38–42 are closed as incorporated through PR43, not
individually marked merged. PR34 remains draft and needs the recorded fixes and
acceptance gates. Verify fresh remote state before further integration.

## Accepted native history

Both installed own-review history readers and both separate fresh native
applicant/reviewer cycles pass. Each fresh cycle retains two submissions, two
immutable decisions and one completed removal, followed by denied old Home-link
access. Current authority and historical decisions remain distinct. All history
fixtures are exactly cleaned; accepted products and private evidence are preserved.

The [iOS report](home-ios-residency-review-history-2026-09-13.md) binds the signed
product and all 679 installed app files, reader pagination/detail/account/retry
behavior, delivered old 200 responses after newer denials, and the fresh cycle.
Its lost rejection reply uses one UUID with canonical SQL replay; wire hashes differ.
The [Android report](home-android-residency-review-history-2026-09-13.md) binds Debug
and optimized Release products, installed readers and its fresh cycle. Android's
held reads cancel or abandon their sockets; they are not proof of delivered stale
bytes. Its lost rejection reply uses one UUID and one wire hash. Secure dialog
capture and driver-only interruptions retain their stated limits.

See [the integration report](home-native-history-wip-2026-09-13.md). Reader/product
source `9350896c4` also passed all 16 checks in CI 34768705945. The later iPhone 16
failure in CI 34774032459 was a global request-count assertion; the repaired test
filters history routes. It changes no accepted application or migration bytes.

## Preserved current-claims acceptance and paused work

The pre-restoration PR #36 acceptance checkpoint is
`1c5f7bb1bc4686ea41f411f6bf554dbf7dd2efe1`, preserved in
`/private/tmp/pantopus-home-current-residency-claims`. Final exact-head
[CI 34781479982](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34781479982)
passes (15 successes and one unchanged Seeder skip). Its accepted
privacy/recovery application source is `4d4183a79111ba06f1df8e713dbcbc4dd9502ad8`.
Read its [accepted report at the candidate head](https://github.com/WangPantopus/skinny-pantopus/blob/1c5f7bb1bc4686ea41f411f6bf554dbf7dd2efe1/docs/home-current-claims-wip-2026-09-13.md).

Recorded actual HTTP/SDK/SQL, both browser consumers and both installed native
queue journeys pass, including populated/error/retry, account/background/restart
and stale responses after newer denial. Protected rejection commands drain the
queue. Exact fixture cleanup, preserved products and three durable evidence
archives are recorded. Owned current-claims REST/API/web and native devices are
stopped with data retained and leases released. Inspect leases before reuse.

The additive migration creates a service-only reader over existing tables; it
creates no tables. Populated upgrade preservation passes, but combined paid/Home
adoption and hosted rollout remain open. Browser type checking has zero errors;
standalone API checking retains 39 baseline diagnostics and no candidate-only
errors. Android optimized codec verification is not Release UI acceptance. Preserve
all other report limitations. Primary now includes the privacy repair. Combined migration inventory is
50 Home / 21 paid / 59 combined, with 12 identical shared versions and zero
collisions at this source checkpoint; combined adoption remains open.

The uncommitted renewal worktree `/private/tmp/pantopus-home-residency-renewal`
stays paused at #36's head. Its proposed two-table renewal migration and contract
are neither applied nor pushed. Compare existing claims, occupancy, submission
commands and review receipts before deciding whether any new schema is needed.
Its small storage-check/test patch is also unaccepted; larger storage consolidation
was deferred and preserved privately. Do not treat this draft as an implementation
requirement. The reconciliation retains exact paths and dispositions. The supplementary
read-only reuse review is preserved in the owner checkout at
`.pantopus-recovery/audits/20260913-claims-presentation/R03_REUSE_REVIEW.md`.

The older documentation run 34784251075 at `a1d278e33` failed one iPhone SE
`HomeTaskMediaViewModelTests.testSessionReplacementDuringUploadCannotPublishOldCompletion`
setup wait: the attachment request did not start within the fixture's 100 × 5ms
poll. It failed before the session-change assertions. The current candidate
passes that test on all three iOS devices; do not relabel the older run green.
Keep a bounded test-stability follow-up in G05 instead of repeating unchanged
app journeys or assuming a production defect from that timeout.

## Preserve and continue

Keep owner work in `/Users/yingpengwang/skinny-pantopus`, every other worktree,
accepted products, database state, devices and private evidence intact. Before
using a device, API or database, inspect the current explicit lease. One heavy
native build at a time; never install loopback builds on a physical iPhone.
Credentials, tokens, database archives and operator logs stay outside Git and chat.

The private index is
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/OPERATOR_HANDOFF.md`.
Durable evidence is under its linked `home-invitation-handoff-20260912` root.

Preserve accepted invitation, Task first-use and removal journeys instead of
repeating them. Their reports and the inventory retain each boundary. The
[previous primary handoff](https://github.com/WangPantopus/skinny-pantopus/blob/f149896378893c6e8308b8790085695c5dd9c449/docs/PROJECT_HANDOFF.md)
and [handoff history](HANDOFF_HISTORY_THROUGH_2026-09-12.md) retain detailed earlier
milestones. Paid/provider activation belongs in one final launch bundle; concrete
production release/rollback preparation precedes any required cutover authorization.
