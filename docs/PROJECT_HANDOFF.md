# Pantopus project handoff

Updated September15,2026. The user resumed verification and development with full
permission: inspect existing implementations, repair demonstrated bugs/security
issues, preserve working behavior and screen designs, then cover the remaining
features. The [80-row inventory](REMAINING_WORK_2026-09-11.md) is the ordered backlog;
its8 locally closed/72 partial or open rows are not an effort/completion percentage.
Follow [AGENTS.md](../AGENTS.md). R05 and the app remain incomplete.

## Three concurrent workstreams — September 15

The user approved three feature streams with shared instructions/status. Start at
[docs/workstreams/README.md](workstreams/README.md) for the live coordination
location, worktree/branch ownership, shared-file requests and runtime reservations.
Each stream writes its own status; the primary coordinator also owns Stream 1 and
integrates shared handoff/backlog updates. Existing reports and the 80-row inventory
remain authoritative; no replacement task tracker or app infrastructure is added.

- Stream 1, gigs/payments: P04 Start Work recovery and assignment lifetime, using
  the existing paid integration checkout and accepted web evidence.
- Stream 2, Home/household: M02 existing browser guest-pass issue/view/revoke,
  reusing accepted sharing-service/database evidence.
- Stream 3, accounts/social/notifications: N04 personal block/unblock and direct
  message admission, preserving distinct existing block contracts/policies.

The two new streams have isolated branches from master `e775af9ae`; their first
scoped files are unchanged in the paid candidate. Their independent discovery
audits and this setup do not claim a newly reproduced defect or completed flow.
Baseline verification is queued in the three status files; no new runtime/device
reservation has been granted. PR #46 (`place-design`) remains the user's separate
scope. The owner's master checkout now matches remote master and is clean; its
design work is committed on `place-design`, so older dirty-checkout notes below
are historical. Keep the three-stream guide and live Git state ahead of those notes.

## Current state — September15

**Requested physical iPhone update:** all code through `c9cb69825` is committed and
pushed to both integration/canonical branches. Pantopus1.0.0(3) is now installed
in place over build2 on the owner's iPhone16Pro, using the existing HTTPS staging
configuration and matching app/Keychain/app-group/APNs identities. Device inventory
confirms build3. The signed product and private evidence are durably mirrored; no
uninstall/data clear, launch, hosted migration/deployment or provider activation ran.
See [the installation record](physical-iphone-refresh-2026-09-11.md#september-15-2026--latest-committed-client).
CI run 34998717315 on c9cb69825 passes 15 applicable jobs/one Seeder skip.
Integration 3e93cd167 adds only the installation documentation to that source.
Backend-dependent features and the broader app acceptance remain incomplete.

**Master:** `e775af9ae393c1e961df8f0043e3aed734326196` after authorized
[PR45](https://github.com/WangPantopus/skinny-pantopus/pull/45). All15 applicable
checks pass/one Seeder path skip in [CI34886464860](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34886464860).
The master tree exactly matches tested `a25b5df61`. This repairs existing expired
residency-letter projections and labels across web/iOS/Android. Historical PDFs
and screen layouts are preserved. R06 remains open; see the [expiry evidence](VERIFICATION_FIRST_2026-09-13.md#existing-residency-letter-expiry-projection-and-labels).

The Home chain merged through [PR43](https://github.com/WangPantopus/skinny-pantopus/pull/43)
at `0cb4f3c600` (all16 CI checks passed). PR32 is also marked merged; PR38–42
were closed as incorporated, preserving source branches. Existing file-picker
repair [PR44](https://github.com/WangPantopus/skinny-pantopus/pull/44) merged at
`f6dbbe2eb` (six applicable checks/five path skips). Their reviewed trees exactly
matched master. No hosted deployment, migration adoption or provider activation ran.

**Open verification PR:** [PR34](https://github.com/WangPantopus/skinny-pantopus/pull/34)
remains draft. Its isolated integration worktree is
`/private/tmp/pantopus-paid-gig-integration`, branch `codex/paid-gig-integration`;
the canonical PR branch is `codex/staging-paid-gig`. Both branches include Home-history and web lifetime checkpoint `88082fdde`. Its
[CI34952128109](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34952128109)
passes all15 applicable jobs/one Seeder skip.
The preceding completion-delivery checkpoint `1a8a7d549` in
[CI34947875754](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34947875754)
passes all15 applicable jobs/one Seeder skip. The preceding
private-proof checkpoint `ca097cd85` passes all15 applicable jobs/one Seeder skip in
[CI34944635449](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34944635449).
Integration includes loaded-review checkpoint `b65dc6f3b` and the locally verified
MyTasks follow-up below. Their combined canonical-branch head `48df046f6` passes all15 applicable jobs/one
Seeder skip in [CI34957710591](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34957710591).
The integration branch includes installed iOS checkpoint `d6a0194ea` after
cold-entry checkpoint `7791bb16f`, following legacy recovery
`e700862f1` and coordinated Android `c6b1f830e`, iOS `b98cc283c`,
web `1b9ff598e` and backend `410ae2767`. It incorporates actual PR43/44/45 master.
The preceding coordinated head `8203a3ea7db551cce24041815aa7cd4302a9502d` passes
all15 applicable checks/one Seeder skip in [CI34907347192](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34907347192).
Current cold-entry `7791bb16f` [CI34920129205](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34920129205)
passes all applicable jobs, including complete schema replay and native checks. The prior `14b8c3ae5` run was superseded/canceled by the new push.
The durable-notice checkpoint `161aaf529` is now pushed to both branches and
passes all15 applicable checks/one Seeder skip in [CI34922146452](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34922146452).
Installed-tip checkpoint `4c8f11114` passes all applicable jobs in [CI34924470956](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34924470956). Owner-date checkpoint `addebe757` passes all15 applicable jobs/one Seeder skip in [CI34926992422](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34926992422). Creator-authority checkpoint `428243241` passes all15 applicable checks/one Seeder skip in [CI34929051683](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34929051683).
Worker-retry checkpoint `f58f322e4` passes all15 applicable checks/one Seeder skip in [CI34931505743](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34931505743).
Do not merge/deploy PR34 yet.

**Current original-tip behavior:** the existing Payment.id and financial fields
reserve one request before provider creation. Metadata retains missing original
terms and control state; `20260914040000_gig_tip_original.sql` adds no table or
column. The existing StripeService freezes provider parameters, serializes work,
retains the same provider key and rejects unsafe retries beyond23 hours. Fresh
matching PaymentIntent/Charge proof and a committed matching receipt are required
for success or zero-charge cancellation. A late initial submission cannot bypass
a same-UUID canceled receipt. Preview/local-read routes and the existing tip POST
use current actor/session and exact original terms. Previous clients without that
command are rejected before provider work; matching clients/backend deploy together.

Backend evidence passes86 focused assertions,12 actual-service/local-SQL scenarios
(129 queries with synthetic provider/notice transport),65 SQL contracts, generated
pgTAP and eight separate-connection cases. Function lint checks358 functions/107
bindings with zero errors/eight existing warnings. Full backend repeat passes5879
with16 skips; the later cancellation-before-admission case passes focused/SQL
checks. The first full run's unrelated Home socket interruption and successful
unchanged-file rerun remain recorded in the [verification report](VERIFICATION_FIRST_2026-09-13.md).
All schema work is limited to the owned local database; no hosted change ran.

**Current client evidence:** existing web/iOS/Android pickers and SDK flows now
retain one nonsecret original, keep its amount/UUID through lost replies/reopening,
and require current identity, stored original and receipt before cleanup/success.
No screen/layout is replaced. Web reuses encrypted IndexedDB and iOS the existing
KeychainStore. Android uses the existing platform encrypted-preference mechanism
through one narrow typed adapter; its existing Home/card/refund stores have other
contracts and are not repurposed. SDK credentials and server session proof are
never retained with the original.

- Web156 assertions and TypeScript pass; scoped lint has zero errors and the
  recorded warnings. Actual Chrome verifies encrypted reload, same-ID retry,
  exact cleanup and stale adoption denial across two tabs, with synthetic API/provider.
- iOS21 final tip tests plus29 unchanged authorization/bid checks pass (50 distinct
  selected checks across two runs). Real simulator Keychain persistence,
  this-device-only/unsynchronized attributes and cleanup pass; SwiftLint/SwiftFormat
  pass. This is not an installed tip UI or real-provider journey.
- Android `c6b1f830e` passes124 selected unit tests on R3, including existing bid,
  authorization, saved-task and stop-entry compatibility. R4 changes only the
  screen's retirement cleanup and its actual control test. R4 format/detekt and
  both APK builds pass. All5 emulator checks pass: four actual Compose control
  checks and one real Keystore/encrypted-preference check. Both installed APKs
  match the candidate hashes. Frozen amounts, retired-account clearing, scoped
  reopening and exact cleanup pass. Typed API/SDK outcomes remain synthetic.

See the [Android evidence](VERIFICATION_FIRST_2026-09-13.md#existing-android-tip-handler-original-recovery-and-controls),
[web evidence](VERIFICATION_FIRST_2026-09-13.md#existing-web-tip-confirmation-and-protected-original-recovery),
and [iOS evidence](VERIFICATION_FIRST_2026-09-13.md#existing-ios-tip-handler-and-protected-recovery).
Private source/product/run bindings are under `existing-tip-provider-proof-r1`.
Android format/static failures in R1/R2 are preserved; the corrected R3/R4 runs pass.

**Existing legacy-tip recovery:** `e700862f1` extends the same Payment/service
and three existing pickers. Local historical reads retain the existing Payment.id,
amount and worker with unknown confirmation time. Fresh matching provider evidence
and a locked unchanged Payment snapshot register that same row; legacy commands
can only check or explicitly cancel the existing intent. They never create another
intent or expose SDK confirmation. Historical currency, capture/cooldown, refund,
dispute and transfer fields are preserved. One forward function/index migration
`20260914050000_gig_tip_legacy_recovery.sql` adds no table or column; the preceding
reservation migration is unchanged. Multiple old pending rows stay recoverable and
continue blocking a new tip until each is reconciled.

Focused checks pass100 backend assertions,53 web assertions,24 iOS tests and41 Android
unit tests. Web types/scoped lint and native format/static checks pass within the
recorded warning limits. Actual service/local SQL passes19 scenarios with synthetic
provider/notice transport,10 separate-connection cases pass, all65 SQL contracts
pass and function lint has359 functions/107 bindings, zero errors/eight existing
warnings. See the [legacy evidence](VERIFICATION_FIRST_2026-09-13.md#existing-legacy-tip-recovery-without-replacement-charges).
Full installed/provider acceptance remains open. The next locally verified
checkpoint repairs cold historical discovery in the existing detail screens. A
fresh personal-payer session can reach an existing payment after the current
worker/confirmation disappears; an empty preview does not admit a new charge.
Web87 assertions, Android76 unit checks and iOS26 tests pass, with source-bound
static checks. Seven existing source/test files change; no migration or layout
change. See the [cold-entry evidence](VERIFICATION_FIRST_2026-09-13.md#existing-tip-entry-without-a-saved-client-request).

**Other paid work preserved:** the existing cancellation Other explanation is
private in the original GigStopRequest and encrypted web recovery. Public receipts
carry only its hash; the forward14030000 function update removes public free text.
Its65 backend/57 web/38 Android/22 iOS checks and real local SQL/synthetic-provider
journeys pass within the report limits. The nine previously unmerged paid migration
versions moved byte-for-byte to14020100–14020900 after current Home master. No
master migration was rewritten; correct `MIGRATION_BASE_SHA` policy and prior
complete-schema CI validate ordering. Earlier failed attempts remain recorded.

**Durable tip delivery:** the existing Payment capture now atomically stores its
existing Notification and retry state in Payment metadata. The existing scheduled
wallet-delivery worker also leases these tip notices and uses its stored-notice
transport. Same-ID retries preserve read/deleted notices, current financial proof,
capture-time/current push preferences and newer Payment metadata. The competing
best-effort StripeService notice write is removed. One forward function/trigger/
index migration `20260914060000_gig_tip_notification_delivery.sql` adds no table or
column and does not backfill historical captures. See the [delivery evidence](VERIFICATION_FIRST_2026-09-13.md#existing-tip-notifications-reuse-the-payment-delivery-worker).

Local checks pass181 backend assertions,65 SQL contracts,22 actual-service/local-SQL
scenarios (235 queries) and13 separate-connection cases. Eight actual local notices
survive16 synthetic transport attempts including unknown delivery and lost final
acknowledgement. Function lint:363 functions/108 bindings, zero errors/eight existing
warnings. Actual push/provider and full installed tip acceptance remain open.

**Installed iOS tip recovery:** one complete simulator journey now passes against
actual tip HTTP routes, StripeService and owned SQL, with synthetic authentication/
provider responses. The existing screen recovers the same$10 historical payment,
retains it through restart, issues two check commands for that UUID, stores one
capture receipt/notification and clears its recovery entry on the next restart.
There are zero replacement intent creates. All679 installed app-bundle files match
the tested build. The actual accessibility tree exposed inherited parent identifiers;
three `children: .contain` modifiers repair the existing shell/dock/picker grouping
without changing visuals. An existing payment UI test file carries the journey.
Source-bound format/strict lint pass. See the [installed iOS evidence](VERIFICATION_FIRST_2026-09-13.md#installed-ios-historical-tip-recovery-and-accessibility).

**Installed Android/web tip recovery:** Chrome's actual completion/tip controls
pass historical discovery, frozen$10/reload, two same-ID checks, one capture/notice
and exact recovery cleanup against actual local HTTP/SQL. Its wrapper/auth/provider
are synthetic. Android passes two installed success/cancel journeys with the same
original through restart, disabled amount changes and exact encrypted-entry cleanup;
success stores one notice and cancellation stores none, with zero replacement
creates. The installed APK matches the tested build. A reproduced stale Android dock
now refreshes from the existing detail loader after a committed receipt;38 focused
tests and static/build checks pass. Three existing Android files change; no new
screen/table/migration. See [installed Android/web evidence](VERIFICATION_FIRST_2026-09-13.md#installed-android-and-web-historical-tip-recovery).

**No-show admission:** five reproduced direct-report bypasses now use the same
existing eligibility rules as the read-only preview. Early/boundary/in-progress,
invalid timestamp, missing counterpart, self-report and recorded-start cases reject
before incident/task changes.54 route tests, privacy gates (including15 audience
checks) and nine actual local HTTP/SQL denials pass with unchanged rows/no notices/
provider work and exact cleanup. Two existing backend files change, with no schema
or screen change. See [admission evidence](VERIFICATION_FIRST_2026-09-13.md#existing-no-show-report-admission).

**Worker completion:** the existing mark-completed update now binds the observed
worker/owner/payment/price/status and assignment/start times. A delayed request
cannot overwrite a replacement assignment, cancellation or prior completion.
Six initial route failures are reproduced;93 route checks/privacy gates now pass.
Ten actual HTTP/SQL interleavings preserve exact current rows; an unchanged task
saves its existing note/photos/checklist with one synthetic notice attempt. No
migration/new screen/file is added. See [completion evidence](VERIFICATION_FIRST_2026-09-13.md#existing-worker-completion-preserves-current-assignment).

**Owner confirmation:** three additional reproduced races are fixed by extending
the existing conditional update to observed worker-completion/assignment/start
times. A reused concurrent receipt must match those times and completed status.
101 route assertions and six actual HTTP/StripeService/local-SQL cases pass,
including synthetic lost provider replies: captured financial truth is retained,
changed work is not owner-confirmed, and matching retries do not recapture. No
migration/screen/table is added. See [owner confirmation evidence](VERIFICATION_FIRST_2026-09-13.md#existing-owner-confirmation-preserves-reviewed-completion).

**Owner-confirmation effects:** an actual HTTP/SQL reproduction returned success
on confirmation and retry while losing the worker's completed-job increment.
The existing route now calls one service-only transaction over existing Gig,
Payment, User, GigBid and Notification records. Current ownership, assignment dates
and capture proof are checked under locks; the confirmation, increment, standby
closure and in-app notices commit together. One forward function migration adds no
table/column/screen. Historical confirmations and read/deleted notices are preserved.
116 focused backend checks/privacy gates,65 SQL contracts/generated pgTAP,
14 actual HTTP/service/SQL scenarios and five observed lock-wait cases pass.
Function lint:364 functions/108 bindings, zero errors/eight existing warnings.
See [completion effects evidence](VERIFICATION_FIRST_2026-09-13.md#existing-owner-confirmation-commits-its-records-together).
In-app storage is durable; push/socket transport and Home service-history capture
remain best effort after commit, including a lost RPC reply. No eventual-delivery
claim is made. The transaction milestone `506820ead` is pushed on the integration branch;
canonical CI now covers the following creator-authority checkpoint.

**Completion proof reads:** six public-detail denial tests reproduced disclosure
of completion notes/photos/checklists and owner confirmation feedback. The existing
serializer now exposes those fields only to the current owner, worker or authorized
business manager/poster. A reproduced failed permission-override read now fails
closed in the existing business helper.155 focused backend tests/privacy gates and
11 actual HTTP/SQL reads pass, with source rows preserved and no provider calls.
Four existing backend/test files change; no migration or UI change. See
[proof-read evidence](VERIFICATION_FIRST_2026-09-13.md#existing-public-gig-detail-protects-completion-evidence).

**Raw Gig proxy access:** authenticated SQL reproduced a revoked business creator
reading and replacing private completion proof. The existing Gig SELECT/UPDATE
policies now require that creator's current authority, through one caller-bound
wrapper around existing friend/business permission functions. A second observed
row-lock race required a fresh permission read in UPDATE WITH CHECK; revocation
now rejects that waiting write and preserves proof.65 SQL contracts/generated
pgTAP, real-role denial/preservation checks and the observed race pass. One forward
function/policy migration adds no table/column/data rewrite. See
[raw access evidence](VERIFICATION_FIRST_2026-09-13.md#existing-gig-policies-retire-revoked-creators).

**Completion file admission:** four reproduced unowned/external URL submissions
now fail before worker completion. The existing S3 service checks the configured
origin, task/uploader key path and native File record, then reads current object
metadata through the SDK. Existing image/video/document types and safe older
basenames are retained. Provider uncertainty leaves completion unset and retryable;
the existing assignment comparison still protects a changed worker.178 backend
checks/privacy gates and13 actual HTTP/upload/SQL/S3-SDK scenarios pass, with
synthetic auth/object provider/notice transport. Three existing source/test files
change; no schema or client/layout change. See
[file admission evidence](VERIFICATION_FIRST_2026-09-13.md#existing-completion-submission-verifies-uploaded-files).

**Proof storage finding:** two tiny synthetic objects under the existing web/native
proof paths were anonymously readable through the configured CDN, although direct
S3 reads returned403 and all four S3 public-access-block flags were enabled. Both
exact created object versions were deleted and their absence verified. No app
records/user files or provider configuration changed. The existing private Supabase
bucket could not be verified with local configuration. Private proof storage and
historical object reconciliation remain release requirements; see [provider evidence](VERIFICATION_FIRST_2026-09-13.md#existing-completion-storage-provider-check).

**Worker completion recovery:** matching retries now return the existing saved
proof/time without another write, object check or notice attempt. A concurrent
result must also match the observed assignment/payment/date fields. Two reproduced
failures are repaired in three existing source/test files; no schema/client/layout
changes.196 focused tests/privacy gates and eight actual HTTP/SQL/S3-SDK scenarios
pass, including a lost committed SQL acknowledgement. The following transaction
repair closes the reproduced missing in-app notice. See [retry evidence](VERIFICATION_FIRST_2026-09-13.md#existing-worker-completion-recovers-its-saved-result).

**Worker completion notices:** the existing route now commits proof and owner
notices through one service-only function over existing Gig/Notification records.
Current worker/assignment terms are checked under lock; failed notice writes roll
back completion. Matching receipts preserve read/deleted notices. Existing stored
notice transport replaces the competing insert.222 focused assertions/privacy
gates,65 SQL contracts/generated pgTAP, eight actual HTTP/SQL scenarios and seven
observed lock waits pass. Function lint:365 functions/108 bindings, zero errors/eight
existing warnings. One function migration adds no table/column/trigger/screen.
See [atomic worker notice evidence](VERIFICATION_FIRST_2026-09-13.md#existing-worker-completion-commits-its-notices).
Push/socket transport remains best effort after commit; lost replies preserve
in-app notices but do not yet guarantee transport recovery.

**Client completion verification:** existing web/iOS/Android handlers now retain
acknowledged upload references through an open-form retry and retire old identity/
departure callbacks.96 web,72 Android and89 distinct iOS selected checks pass,
with scoped static checks. Actual Chrome verifies a committed503 followed by a
matching200: one upload request, one saved completion/notice and the original time.
Installed iOS also passes the actual picker, lost-reply retry and existing
confirmation controls against owned HTTP/SQL; all679 installed app files match
the tested build. iOS exposed inherited container identifiers on the existing proof
controls; two accessibility grouping modifiers preserve the design. Installed
Android also passes the actual picker, empty-proof denial, retained note/photo,
lost-response retry and confirmation/Back controls. Its installed APK matches the
tested build. Each native journey uses one upload, two identical completion
requests and one stored notice. No new client file, screen, table or migration is
added. Source/product bindings and accepted archives are preserved privately.
Current-head CI and full provider acceptance remain required.
See [client retry evidence](VERIFICATION_FIRST_2026-09-13.md#existing-client-completion-retries-reuse-uploaded-proof).

**Current private-storage checkpoint:** repairs extend existing File/quota, storage
helpers, upload/download routes, private-file recovery worker and client callers.
One forward function/policy/trigger migration adds no table or replacement screen.
New uploads require an explicitly private Supabase bucket and authenticated bytes;
web keeps its three existing photo treatments with temporary blob URLs.206 focused
backend checks,112 web checks/types/lint,65 SQL contracts, eight actual HTTP/SQL/
Storage-SDK cases and six observed concurrency cases pass locally. The full backend
run passes6015/16 skips with one obsolete compatibility expectation; its corrected
33-test suite passes (6016 distinct checks verified). iOS46/Android72 focused checks
and static/build gates pass. Installed iOS and Chrome private-photo submission/retry
and all three browser owner views pass; Android also passes its installed private
upload/retry/confirmation/Back journey. Forward
migration replay and function lint pass (372 functions/112 bindings,0 errors/8
existing warnings). Full fresh-schema/current-head CI is still required. No hosted
bucket is configured or claimed verified. See [private proof evidence](VERIFICATION_FIRST_2026-09-13.md#existing-completion-proof-uses-private-bytes).

**Completion-delivery checkpoint:** existing Notification metadata now commits
retry state with new worker/owner/standby completion notices. The existing acceptance
worker leases and delivers them; no new table, column, service or screen is added.
Private event terms are hashes; transport strips queue metadata. Commit-time and
current push preferences, current assignment/authority, read/deletion state and
exact leases are respected.204 focused checks,65 SQL contracts, privacy gates,
complete forward replay and function lint (376 functions/113 bindings,0 errors/8
existing warnings) pass. Actual HTTP/SQL/job/service acceptance passes two lost-reply/
unknown-delivery scenarios (58 SQL calls/3 synthetic push attempts); concurrency
passes six observed row-lock waits and two claim/rollback cases. Full backend passes6035 tests/16 skips across339 passing suites. CI34947875754 passes all15 applicable jobs/one Seeder skip. Live provider delivery remains unverified.
See [completion delivery evidence](VERIFICATION_FIRST_2026-09-13.md#existing-completion-notifications-reuse-the-delivery-worker).

**Home-history checkpoint `dd788e03a`:** actual SQL exposed seven missing columns from
existing migration151, despite existing screens/routes. One forward migration
restores that original HomeMaintenanceLog shape, preserves performed legacy rows
and already-adopted values, and extends confirmation to commit eligible history
under current Home authority. No new table/service/screen is added. The unused
best-effort helper is removed. Existing maintenance edits preserve saved performer/
time, reject changed automatic costs and return409 after a competing edit.
202 focused checks, privacy gates,65 SQL contracts (plus final guard/FK cases),
legacy/already-adopted forward replay and lint377 functions/114 bindings/0 errors/
8 existing warnings pass. Five actual HTTP/StripeService/SQL scenarios use124 SQL
calls and one synthetic capture; lost capture/confirmation replies, history-write
rollback/retry, ordinary maintenance CRUD, stale cancellation and exact cleanup pass.
Six observed Home/Gig lock waits pass. No browser/native source or layout changes.
See [history evidence](VERIFICATION_FIRST_2026-09-13.md#existing-home-maintenance-history-commits-with-completion).

**Owner-confirmation web checkpoint:** six reproduced late-response failures are
repaired in the existing CompletionFlow using its existing account/request scope.
Sign-out, session/origin changes, owner-role loss, dismissal and departure retire
callbacks; a current success still opens the existing tip flow. No layout or schema
change.106 focused checks, TypeScript and scoped lint (0 errors/6 existing warnings)
pass; five Chrome scenarios pass using the actual component/API client and synthetic
responses. See [web lifetime evidence](VERIFICATION_FIRST_2026-09-13.md#existing-owner-review-retires-late-web-responses).

**Loaded owner-review checkpoint:** actual HTTP/StripeService/SQL reproduced
three confirmations of changed completion time, proof and price before request;
a$12.50 review captured$20 with synthetic Stripe. The existing acceptance helper
now fingerprints the loaded completion. Existing detail/private owner list return
it, all seven web/iOS/Android owner callers send their loaded value, and both
confirmation aliases reject missing/stale values before capture. No schema, new
service/file, screen or layout is added. Full backend6053 passes/16 skips; privacy
gates,107 web,82 Android and78 iOS checks pass with source-bound static/build
checks. Actual Chrome/HTTP/SQL verifies two stale409s/capture0, then explicit fresh
review/one capture/tip entry. Three further HTTP/SQL cases verify both aliases,
matching receipt reuse and private projections. Native SDK tests are not installed
owner lifecycle UI acceptance. See [review evidence](VERIFICATION_FIRST_2026-09-13.md#existing-owner-confirmation-binds-the-loaded-review).

**MyTasks completion checkpoint:** the existing web/iOS/Android lists now keep
worker-submitted work active until owner confirmation, prevent premature/duplicate
commands, and refresh from a matching receipt. Existing card layouts are preserved.
Literal SQL projections exposed two missing fields from original migration149;
one forward migration restores those nullable boost fields and their existing
index, preserving already-adopted values and absent history.45 Android and43 iOS
checks/static/build gates,15 backend checks/privacy gates,65 SQL contracts, paid
pgTAP and migration policy pass. Two actual Chrome/HTTP/StripeService/SQL journeys
(normal/lost reply,37 SQL calls/one synthetic capture each) pass. The owned iOS
simulator is shutdown and all679 test-host files match the retained build. Native
SDK tests are not installed paid-lifecycle UI or actual-provider acceptance.
See [MyTasks evidence](VERIFICATION_FIRST_2026-09-13.md#existing-mytasks-waits-for-owner-confirmation).

**Native owner callback checkpoint:** `c12c55e099` is pushed to both integration
and canonical PR branches; all15 applicable jobs/one Seeder skip pass in
[CI34960015092](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34960015092).
The existing detail handlers now require a
matching receipt and current owner/session/screen before success/refetch, suppress
pending duplicate requests, and distinguish ignored callbacks from success.42
Android and50 iOS detail checks/static/build gates pass, including existing worker
proof behavior. Five existing native files change; layouts are preserved. All679
iOS test-host files match the retained build; this is not installed full owner UI
or actual provider acceptance. See [native callback evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-owner-confirmation-retires-stale-callbacks).

**Owner capture original checkpoint:** the reproduced post-server-read race is
locally repaired in the existing Payment, capture functions, confirmation transaction
and retry job. One private nullable Payment field holds the original approval; no
new table, service or screen. Current authority admits the complete reviewed
snapshot before provider work. Pending originals fence proof changes, preserve
feedback and serialize capture; fresh matching provider proof commits capture and
confirmation effects together. The existing job recovers lost responses and
known-zero canceled authorization without inventing a confirmation. Existing-column
reads and historical rows remain intact; API projections omit the private field.

Validation:6081 full backend tests/16 existing skips,296 focused checks,65 SQL
contracts/generated paid pgTAP and privacy gates pass. Ten actual HTTP/service/SQL
cases use synthetic provider/auth, including four blocked mutations and lost-response
recovery; seven observed lock waits and a forced effect rollback pass. Forward replay
preserves four historical payments/gigs without approval backfill. Function lint381
functions/116 bindings has zero errors/eight existing warnings. See the
[original capture evidence](VERIFICATION_FIRST_2026-09-13.md#existing-owner-capture-original-and-recovery).
Checkpoint0654e856e passes all15 applicable jobs/one Seeder skip in
[CI34964238115](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34964238115),
including complete schema replay and native checks.
Drain old capture handlers and coordinate the new backend/schema before hosted
admission; no hosted activation ran. Real-provider, refund/dispute/cap-exhaustion
operations and full installed paid lifecycle remain release gates.

**MyTasks refresh/cancellation checkpoint:** the existing Android Active tab now
refreshes after a matching confirmation receipt. Both native list loaders ignore
older responses; iOS ignores canceled confirmation callbacks. The prior Android
happy-path fixture had selected an empty Open tab and missed the Active-tab no-op.
The corrected baseline reproduced that defect, stale Android refresh replacement,
and canceled iOS navigation.46 Android and45 iOS checks plus native static/build
gates pass. Four existing native source/test files change; no layout, endpoint or
schema change. See [the bounded evidence](VERIFICATION_FIRST_2026-09-13.md#existing-mytasks-refresh-order-and-canceled-confirmation).
These compiled-model checks do not verify actual screen departure or account
switching. The owned iOS simulator is shut down; the separate user simulator is
preserved. The follow-up is committed at f32c8e66b and is included in the next
combined native checkpoint.

**Native MyTasks account/lifetime checkpoint:** the existing main list and its
row actions now retire reads/commands after session changes, departure and
rebinding. iOS uses the existing GigStop identity resolver and Android the existing
GigPaymentIdentitySource. Current Android identity signals clear the old list and
load the current account; an iOS session change requires a fresh list entry.
The three iOS navigation callers now append destinations directly after the guard.
52 Android and50 iOS checks plus static/compilation gates pass. Ten existing native
files change and one focused Android test file is added to preserve the unchanged
test-class size limit; no new application screen, service or schema. See
[account/lifetime evidence](VERIFICATION_FIRST_2026-09-13.md#existing-native-mytasks-account-and-view-lifetime).
These are compiled-model/APIClient checks; full installed account-switch/owner UI
is still open. The combined checkpoint a943a0dab passes all15 applicable jobs/one
Seeder skip in [CI34969633236](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34969633236).

**Rebooking/boost follow-up:** both existing native rebook readers now retire
history/actions with their session and view, and ignore older refresh responses.
A failed boost no longer restores an obsolete whole list; successful boosts refresh
the existing list from the server. Baselines reproduce two Android defects and
three iOS failures. Final57 Android/55 iOS checks, static gates and builds pass.
All nine changed source/test files already existed; no layout, backend or schema
change. See [the evidence and limits](VERIFICATION_FIRST_2026-09-13.md#existing-native-rebooking-history-and-boost-refresh).
The owned iOS simulator is shut down; the separate user simulator is preserved.
Both branches now contain 8ea69bbe4, with
[CI34972981459](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34972981459)
passes all15 applicable jobs/one Seeder skip. PR34 remains draft.

**Web My Gigs lifetime:** both existing pages now retire private lists and pending
actions with the current session/page. Five baseline cases reproduce retained
same-cookie history, shared-cache reuse, departed bid rejection and stale filter
reads.101 focused tests, TypeScript and scoped lint pass (zero errors/five existing
warnings). Seven Chrome cases pass with the actual pages, API client/session signals
and root confirmation; transport and fixture entry controls are synthetic. One small
shared hook joins the existing auth signals; three other source/test files already
existed. Layouts, routes, backend and schema are preserved. See
[web evidence](VERIFICATION_FIRST_2026-09-13.md#existing-web-my-gigs-cache-reads-and-actions).
The temporary route/build are removed, original tsconfig restored and port3107
released. This web follow-up is committed locally at4ddcdaa65 and will share the next CI push with the worker-receipt fix.

**Worker completion receipts:** the existing web, iOS and Android proof handlers
now require the matching saved task, worker, completion time, note and photo URLs
before clearing their draft or reporting success. All three baselines reproduced
false success from an empty200 reply. Final46 Android/53 iOS/107 web checks and
native build/static plus web types/lint pass; Android has zero failed retries.
Nine existing source/test files change, with no new backend, schema or screen.
The SDK reuses the existing raw GigSchema type, and notes respect the existing
server2000 UTF-16-unit limit. See [receipt evidence](VERIFICATION_FIRST_2026-09-13.md#existing-worker-completion-receipt-validation).
The owned iOS simulator is shut down; the separate user simulator is preserved.
This locally accepted follow-up needs CI with the preceding web4ddcdaa65 commit.

**My bids follow-up:** the existing page now retires private rows, cached reads and
pending bid/task actions with its session/page. Completion requires the matching
worker receipt; a held withdrawal cannot close a newly reopened modal. Six baseline
failures are reproduced, then129 selected web tests, TypeScript and scoped lint
pass (zero errors/two existing warnings, including the existing ts-nocheck).
Five actual Chrome cases pass with synthetic responses and the real query provider,
API client/session signals and root confirmation. Two existing source/test files
change; no new screen, hook, backend or schema. See [My bids evidence](VERIFICATION_FIRST_2026-09-13.md#existing-my-bids-reader-and-command-lifetime).
Owned browser fixture/port3107 are cleaned; configs restored exactly. This and worker60bdd6ba6/web4ddcdaa65 are pushed together atb513c8184 on both
branches. CI34980516319 now passes all15 applicable jobs/one Seeder skip.

**V2 detail/active-panel follow-up:** ten reproduced failures are repaired in the
existing page/panel: session/departure/rebinding, stale reads, neighboring socket
listeners, completion/status receipt validation and premature owner confirmation.
Ordinary tasks now use their existing task status; only urgent tasks call the
urgent-only endpoint and show its controls.187 tests, types and lint pass (zero
errors/the same27 baseline warnings), plus six Chrome cases. Five existing files
change, with no new screen, backend or migration. See [v2 evidence](VERIFICATION_FIRST_2026-09-13.md#existing-v2-task-detail-and-active-panel-lifetime).
The owned fixture/port3107 are stopped and original configs restored. Current-head
CI is still required for this local follow-up; PR34 remains draft.

**ETA tracker/share lifetime:** seven baseline failures are repaired in the existing
tracker and entrypoint tests.201 focused tests, types and lint pass (zero errors/one
existing warning), plus five Chrome cases using the actual page/SDK/session/toast.
Late links cannot be copied after departure, session or work-relationship changes;
missing/expired receipts fail, and only matching/current ETA events update the card.
Existing styles are intact. See [ETA evidence](VERIFICATION_FIRST_2026-09-13.md#existing-eta-tracker-and-share-lifetime).
Owned port3107/fixture/build are removed and original configs restored exactly.
This and v2 checkpoint4611b261c are pushed at75ea51867; CI34985637885 passes all15 applicable jobs/one Seeder skip.

**General task tracking privacy:**20 failing baseline checks reproduce raw share-token,
helper-coordinate/ETA, cache and sharing-entry gaps. The existing serializer/list
responses now omit share credentials and exact helper coordinates, gate ETA by the
current work relationship and use no-store headers. The four affected lists reuse
one helper in the existing route file; the existing consent-gated active-status
reader remains available. The v2 sharing card is offered only to owner/worker.
264 backend/204 web checks, types/lint/privacy gates and actual local HTTP/SQL checks
pass: six detail viewers, four lists, two active-status reads and two raw RLS denials,
with unchanged stored Gig and exact fixture cleanup. No schema/native/layout change.
See [tracking privacy evidence](VERIFICATION_FIRST_2026-09-13.md#existing-general-task-response-tracking-privacy).
The API18109 fixture is stopped. This2ef9772be follow-up is pushed on integration and
will share canonical CI with the status-link checkpoint below. Prior75ea51867 CI is green.

**Status link endpoint/destination:** ten new baseline failures and seven actual local
HTTP/SQL interleavings reproduce stale share writes and revoked/expired public reads.
The existing POST now compares its observed owner/worker/link and requires a matching
stored receipt. The existing public GET rechecks the link after helper lookup and
returns a limited expiring payload with no-store headers. Read outages remain retryable.
276 backend/212 web checks, types/lint/privacy and nine actual HTTP/SQL cases pass.
Seven Chrome checks open actual generated links without an account, refresh, expire,
rotate and retry them, and verify narrow/long-title layouts. The only new app file is
`/status/[token]/page.tsx`, whose absence was confirmed by route/history inventory and
actual404. It reuses current shared-page spacing, cards, status badges and error states;
no existing screen is redesigned. See [status-link evidence](VERIFICATION_FIRST_2026-09-13.md#existing-status-links-authority-expiry-and-missing-destination).
The owned API/Next servers and exact ab13 fixtures are cleaned, original configs are
restored and compiled entries retained. The combined d01a2f248 head passes all15
applicable jobs/one Seeder skip in CI34990349201.

**Private task socket delivery:** the actual Socket.IO baseline reproduced both ETA
and urgent fulfillment/ETA broadcasts reaching an unrelated authenticated subscriber.
The two existing producers now reuse one helper in the existing socket module. It
rechecks the owner/worker and emits only to their still-subscribed authenticated
socket IDs; changed/deleted/failed authority reads suppress private delivery. Public
room admission and the existing task-acceptance marker remain available.247 backend
checks across five suites and privacy gates pass. Twelve actual local HTTP/Socket.IO/
SQL audience cases plus a public acceptance event pass, with exact ab14 cleanup and
API18109 stopped. Four existing source/test files change; no schema/client/layout
change. See [socket evidence](VERIFICATION_FIRST_2026-09-13.md#existing-private-task-socket-delivery).
Socket checkpoint1b8d1c227 is pushed on integration; it will share canonical CI with
the location-writer checkpoint below. The prior d01a2f248 status-link CI34990349201
passes all15 applicable jobs/one Seeder skip.

**Existing location writer:**16 failing unit baselines,13 actual local HTTP/SQL
cases and a two-request concurrency baseline reproduce unsafe inputs/late writes,
missing geography ETA, retained obsolete ETA and duplicate competing successes.
The existing endpoint now reuses the shared geography decoder, checks finite numeric
input and active assignment, compares its observed task/location fields when saving,
and requires a matching stored receipt. The existing30-second interval uses the
stored timestamp instead of a process-local map.266 backend checks/five suites and
privacy gates pass;13 actual HTTP/SQL cases and a separate simultaneous-request
case pass, preserving newer rows and exactly one winner. Exact ab15 fixtures and
API18109 are cleaned. Three existing source/test files change; no schema/client/
layout change. See [writer evidence](VERIFICATION_FIRST_2026-09-13.md#existing-helper-location-writer).

**Existing urgent status writer:**21 failing baseline cases (20 initial plus a
separate string-false sharing check) reproduce stale/inactive writes, false receipts,
helper-field spoofing, ignored partial coordinates, mutation/read disclosure and
zero-ETA/cache errors. The existing route now compares its current work/JSONB snapshot,
requires a matching stored receipt, and keeps helper data with the helper. It reuses
the existing redactor and retains the original response shape. The reader preserves
zero ETA and requires an active task plus boolean sharing opt-in for exact location.
289 compatibility checks/five suites and privacy gates pass; the final route suite
passes202 including the additional opt-in regression (overlapping totals).
Thirteen actual local HTTP/SQL cases and a separate five-case concurrency/compatibility
run pass. One of two competing snapshots wins with one notification attempt; ASAP,
legacy JSON and poster-null-ETA callers still work. All ab16 fixtures/API18109 are
cleaned. Four existing source/test/mock files change; no schema/client/layout change.
See [urgent evidence](VERIFICATION_FIRST_2026-09-13.md#existing-urgent-status-writer-and-private-reader).

**Existing urgent notice retries:** two failing route/service tests and three actual
HTTP/Notification-service/SQL scenarios reproduce duplicate notices after ordinary
retries, destroyed HTTP replies and lost committed insert replies. The existing
producer now supplies the already-supported idempotency key, scoped to the Gig,
owner/worker/assignment, actor, recipient and fulfillment step. It reuses the existing
Notification unique index and never replaces read notices.243 backend/notification
checks and privacy gates pass; six actual HTTP/service/SQL cases preserve one notice,
allow distinct steps/assignments and preserve an unkeyed historical notice exactly.
All ab17 fixtures/API18109 are cleaned. Two existing source/test files change; no
new schema/client/layout/control metadata. See [notice evidence](VERIFICATION_FIRST_2026-09-13.md#existing-urgent-notification-retry-identity).
Transport remains best effort; saved state is not proof of push delivery. Historical
unkeyed events are preserved, without a claim of deduplication across old/new handlers.
The c7d45dd09 [CI34993419890](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34993419890)
and combined c9cb69825 [CI34998717315](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34998717315)
each pass15 applicable jobs/one Seeder skip. The latter includes urgent341da82c6,
notice4c5655217 and the Start Work follow-up below. PR34 remains unfinished/draft.

**Existing web Start Work control:** ten failing baselines reproduce duplicate
pending requests, stale success and acceptance of invalid receipts. The existing
CompletionFlow now reuses its session guard, retires changed assignment/payment
contexts, admits one pending request and verifies the returned Gig/worker/status/
start timestamp. The SDK type now matches the existing raw Gig response.180 web
regressions, TypeScript and scoped lint pass (zero errors/six existing warnings).
Seven compiled Chrome checks pass with synthetic HTTP/authentication, including
actual cross-tab retirement. Three existing source/test files change; screen labels,
styles, layouts, upload recovery and backend/schema remain unchanged. See
[Start Work evidence](VERIFICATION_FIRST_2026-09-13.md#existing-web-start-work-control).
This is bounded client acceptance; backend lost-reply/concurrency, native and full
installed/provider Start Work acceptance remain open.

**Next:** verify the existing Start Work endpoint and native callers for saved-result
recovery, assignment changes and truthful completion before extending them. Then
verify existing completion draft/restart behavior against the actual forms
and their current storage before changing it. Preserve accepted upload recovery and
saved-completion journeys; absence of unsent-draft autosave alone does not establish
a broken promised feature. Check lost replies/restart against canonical saved state
and retained file identities first. The broader consent/raw participant-read question
and installed tracking remain open. Completion draft/restart
continues after that boundary; content-addressed File upload recovery already exists
and must be reused. There is no active web rebook/boost caller to rebuild.
Full installed native MyTasks/owner lifetime remains open. Continue completion
draft/restart verification using existing storage first. Generic maintenance granular authority/raw RLS, Home-origin admission
and full maintenance UI acceptance remain separate follow-ups; this bounded history
checkpoint does not close them. Continue completion/reopen policy flows, hosted
private-byte adoption/historical CDN reconciliation and other private File purposes.
No-show execution still requires atomic concurrent/retry handling and
verified fee/financial outcomes. The repo's fee rates do not specify who owes and
receives worker cancellation/no-show fees; one policy clarification is pending.
Continue independent completion/security verification while that remains pending. Finish current-head CI
and real-provider acceptance before activation. The new iOS journey is not actual
Stripe/push acceptance. Recheck existing implementations before each change.
P01–P03/P07–P09, R05/R06 and the wider80-row inventory remain open within their
stated limits. After the paid scope, continue the remaining existing-feature
inventory; preserve accepted subjourneys and screen designs.

**Runtime/ownership:** web/Chrome and native completion fixtures are cleaned and
stopped;18109 is released. The isolated Android AVD and owned iOS simulator are
shut down. Accepted APK/app archives match installed products; the exact owned
Android photo is removed. A separate booted simulator
EB5AD759-4699-481F-8A9F-0D650B074623 is not owned by this task and is preserved.
One heavy native build runs at a time. Prior tip fixture cleanup remains valid.
Exact fixture cleanup reports zero actors/gigs/payments/notifications. The private
web wrapper was removed and pre-run configs restored. Device data and accepted
products are retained. The Android verification
used its private AVD home and created no global registration. Exact random tip
storage-key cleanup passes. Direct PostgreSQL64522 and the owned Home rehearsal
REST18089 remain reserved; inspect private leases before use. Owner checkout,
other worktrees and the paused renewal/two-table draft remain untouched. No hosted
deployment, migration adoption or provider activation ran.

## Earlier Home verification context

The details below retain accepted evidence and historical next-action wording.
The current state above takes precedence; do not repeat already accepted work
solely because an older paragraph says next.

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
