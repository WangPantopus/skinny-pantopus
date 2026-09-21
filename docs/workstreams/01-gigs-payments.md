# Stream 1 — Gigs and payments

## September 21, 03:57 UTC — wallet release return repaired and verified

Paid branch is clean and pushed at **2a05e797e853b81df71e122f57f014c2e15b40e5**.
Focused repair **02706ba39** changes only existing wallet/page.tsx and
WalletTransactionList.tsx: refresh history when the displayed balance changes,
preserving the selected filter and page. Baseline actual wallet-credit notification
return updated balance to1063c but retained false empty history; SQL held one income
row and HTTP showed no history refresh. Existing page is identical across master,
paid/web staging, place and initial archive; all history variants lacked this refresh
input. Reuse in place, no new files/schema/backend/style or unit tests.

Fresh Chrome/IAB UI→SDK→routes→Stripe TEST→full77 SQL: first1250c and second750c
bid authorization→worker Start Work/completion→owner approval/capture. Existing
worker did not release before cooling elapsed; owned clocks were then advanced.
Concurrent/repeated workers left exactly two settlements/two income rows and four
settlement notices/outbox events. Credits1063c+638c produce1701c wallet balance.
Candidate kept Task Income selected. New-credit notification return fetched history;
actual SELECT500 showed existing error/retry, restored SELECT plus same Retry showed
both exact credits. Payer notice returned to the exact second completed gig with
owner controls. No bank payout or real48-hour waiting claim.

Private wallet-release-r1/f9200290 evidence:36 mirrored/hash-verified files under
owner `.pantopus-recovery/audits/20260921-stream1-wallet-release-r1`.
Synthetic local identity/socket/push; actual payment/SQL and in-app notification
returns. Existing unchanged relay/concurrency evidence reused; outbox transport
not newly run. Unknown-balance-neutral changes and overlapping delayed history
reads remain unverified. Initial missing test publishable key and mixed127/localhost
cookie setup corrected in the harness; no app repair for either setup issue.

Both Stripe TEST captures fully refunded, one owned customer deleted, SQL aggregate0
and seven-table explicit counts0; original history SELECT restored. Owned API/Next/
Supabase stopped, all three owned browser tabs closed, own cache retained privately,
generated tsconfig restored. Cumulative15 originals:8 captures fully refunded9250c,
7 unpaid cancels,7 customers deleted. Immutable TEST provider history retained.

Reviewed master **ef7382ea13f2b99e25458a6ddf535064642c2335** (through PR91) merged into
paid as2a05e797e. Wallet/payment source hashes unchanged by integration; current
[combined CI35559173441](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35559173441)
is pending. Earlier03bf9 CI35556379254 passed all15 applicable checks/one skip.
PR34/47 remain draft; no broad acceptance row closed. PR91 exactea8e8603c passed
CI35558601157 before integration, with one resolver source hash and real destination
proof reviewed. Separate next marketplace message-destination findings stay unedited
until documentation publication/ownership grant. Next: current combined CI and
remaining source-bound P08/P09/P10, native/provider/policy limits.

## September21,03:08UTC — pending wallet read failure repaired

Latest03:46UTC: paid **03bf9bd1b4a3504b8a71eb1f835c1bc3a3e59169** completed
[CI35556379254](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35556379254)
**SUCCESS:15 applicable checks passed/one Seeder skip**, including Android quality,
emulator and all three iOS simulators. Final CI receipt expands pending-wallet durable
manifest to15 verified files. No new unit tests. PR34/47 remain draft for open scopes.
PR90 exactfdb37a904 passed CI35558194245 and merged
**fd04ae43cc7b8ebe5b93e6bbd8a7aa753982ea83** after three source hashes and real Q&A
failure/retry/order/navigation/cleanup review. Destination repair is separate/liveREADME.
Root now runs owned wallet-release-r1/f9200290 on unchanged03bf9: actual Stripe TEST
1250c UI authorization/start/completion/capture succeeded; next verify worker wallet
release and both notification returns. No release acceptance yet; fixture remains active.

Latest03:37UTC: PR88 passed CI35557360294 and merged cc28ddd3e78eccd24dd7615f4bfe7cbbc938feb4.
PR89 canonical seller identity at216e533af passed CI35557699093 and merged
 a1261027024cad7171348813e9dc750b8cf07b58. Both existing source hashes and unchanged
integration app diff were verified; actual public navigation and unavailable href
fallback evidence reused. Separate Q&A read grant is in live README. Paid03bf9
CI35556379254 has all three iOS simulators and Android emulator passed; Android
lint/test/assemble remains running. Root runtime remains stopped; no duplicate tests.

Latest03:25UTC: PR88 marketplace report956dab1d1 reviewed (2sourcehashes, actual7
UIreasons→SQL, error/draft/retry, invalidHTTPboundaries and exact8tablecleanup0).
CI35557360294 pending. Frozen03 ab18fb6e captured at6ffb331c7/writerreleased for
separate canonical seller card grant. Rootpaid03bf9 CI35556379254 Androidemulator
passed; Androidquality and three iOSsimulators remain, no failures so far.

Latest03:21UTC: documentation-onlyPR79 exactda0ff5f46 passed CI35556990529 and
merged **bc06d6b3956ba4a0497d37c07d6ecbff96820d82**. Current5doc checkpoint published;
paid03bf9 stays separate with CI35556379254 nativejobs pending and allother checks
passed. New marketplace report grant is liveREADME; no unreviewed feature merged.

Latest03:16UTC: PR86 exactc5802b4a1 passed CI35556598901 and merged
**3277477fc73e8588c0975fafa7f5a417c3b0e9af**. Coordinator verified3sourcehashes,
actualfailure/retry/lostcommittedresponse/keyboard/cachedfilter recovery and exact4
fixturecleanup with13originalrows/readflagsunchanged. Crossaccount response was
disconnected, not intact-delivery evidence. Frozen03 4aa01061 captured at e97b1257d.
Currentpaid03bf9 CI35556379254 has allnon-native checks passed; Android/iOS run.
Nextpublishdocumentation-onlyPR79 at this feature-batch boundary; retain currentpaid
source/CI instead of churning it for unrelatednotification changes. FurtherStream3
A05 catalog work is read-only until a verified gap receives ownership.

Paid clean/pushed **03bf9bd1b4a3504b8a71eb1f835c1bc3a3e59169** adds only three lines
in existing WalletBalanceCard.tsx: treat rejected pending-release read as existing
carderror, and set existingloading while retrying both wallet reads. Baseline actual
UI showed available500c/pending1275inreview+850releasing; PaymentSELECTdenial made
pending-release500 whilewallet/history succeeded. ColdUI silently removed pending
funds with noerror/retry. Same component bytes across master/staging/archive/place
branches; in-place reuse, no newfile/schema/style/backend/newtests.

Candidate IAB UI→SDK→real wallet routes/services→PostgREST/SQL: pending500 now shows
existingerror/Clicktoretry; repeated500 staysretryable; restoredSELECT samebutton
restoresallamounts. Separate get_or_create_wallet EXECUTEdenial shows primarywallet
error; restoredEXECUTE/retry restoresallamounts. Actualotheraccount200empty shows0/
no funds towithdraw/noerror. Seeded500c adjustment/two held-payment reader fixtures;
no actualcapture/release/withdrawal/provider/native acceptance. Existing history
repair/evidence75f372 reused. Scoped2fileESLint exit0/sixexistingwarnings.

Private `/private/tmp/pantopus-stream1-wallet-pending-r1`;14files mirrored/hash-verified
at owner's `.pantopus-recovery/audits/20260921-stream1-wallet-pending-r1`. Reused clean
owned wallet-read-r1 Supabase/full77schema; bothSQLgrants restored, exactownedrows0,
API/Next/ownedSupabase stopped/IABtabclosed, owncachepreserved/tsconfigrestored.
Providercreates/customers/refunds0; previousStripe totals unchanged. Peerresourcesuntouched.
Current required[CI35556379254](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35556379254)
queued/running on03bf9. Previous75f372 CI35555446600 superseded/cancelled after web/
backend/schema/webE2Epassed and nativejobsstillrunning; not a green run. No further
app changes planned before this gate unless a failure justifies them. Broader
native/provider/fee-policy/P01–P10 remain open, PR34/47 draft.

## September21,02:52UTC — wallet history failure/retry repaired

Latest02:54UTC: PR85 exacted5b4a8bb passed CI35555390569 and merged
**d2b83304922b28ff1f12ceaab70d284b1bec3682**. Coordinator verified both source hashes,
13before/after notification rows identical, actual failure/retry/partial/ordering
proof and its disconnected-only crossaccount limit. Paid75f372 remains separate/current
CI35555446600 running; do not invalidate this gate for unrelated further social edits.

Clean/pushed paid head **75f372833c4383dad9192a6620656863b8e0c314**, includes reviewed
masterc1c03a3c6 via cfb9b9d80. Existing WalletTransactionList.tsx alone changed:
show existing loading/error/retry states for every query, including a new filter or
page after earlier data. Actual baseline Refunds GET500 left20Adjustment rows under
Refunds/Showing1-20of25 with no error/Retry. Existing component/source hashes identical
across master, paid staging, web staging, place-design and initial archive; reuse
in-place, no file/schema/backend/style change or new unit tests.

Candidate real IAB UI→SDK→wallet route/service→PostgREST/full77SQL: failed filter
shows error/retry; repeated500 stays retryable; restoredSELECT same query returns
exact2Refunds. Withdrawals200 shows genuineempty. Page2 failure500 displays error;
samequeryretry200 returns rows21–25/Nextdisabled. Coldreload500/retry200 restores
page1. Actual Settingslogout/otherlogin wallet shows0/empty, no owner history. No
intact delayed wallet/account response or arbitrary ordering claim. Scoped ESLint
exit0/one existing warning. Required current
[CI35555446600](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35555446600)
running; prior combined35555007933 superseded/cancelled, not green.

Private `/private/tmp/pantopus-stream1-wallet-read-r1`;12files mirrored/hash-verified
at owner's `.pantopus-recovery/audits/20260921-stream1-wallet-read-r1`.
Synthetic local identities and25history records through existingwallet_creditRPC;
real reads/UI, no earned-release/withdrawal/Connect/provider acceptance. Provider
creates/customers/refunds0. Original table SELECT restored; SQL aggregate including
Wallet/WalletTransaction0. API/Next/ownedSupabase stopped; Chrome+IABownedtabs closed;
owncache preserved privately/tsconfig restored. Initial Chrome remained prehydration
disabled during bounded attempt; IAB worked, no login repair or Chrome claim.

Coordinator PR85 notification read/error scope reviewed against actual cold/warm/
partial/ordering evidence, currentCI pending. Frozen03 d93562fd captured at e20229545;
writerreleased for separate granted mutation feedback. Next: current paidCI, PR85
strict gate and existing P08/P09/provider/native limits; no broad backlog row closed.

## September21,02:38UTC — intact refund reply after account switch verified

Latest02:44UTC: PR84 strictf19349e38 passed CI35554806445 and merged
**c1c03a3c62944c0a07570db285f945a338c9f1c5**. Paid master batch integrated cleanly and
pushed **cfb9b9d804bdad7a3cdc75fdf165c64a0338397e**; payment routes/services/UI and
shared API source unchanged, so accepted payment evidence is reused. Required
[combined CI35555007933](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35555007933)
is running; no completed-current-CI claim yet. Next bounded P08 wallet read/history
verification reserves owned18132/18133/64561–67, private wallet-read-r1/f9200270,
full77SQL and real wallet UI/routes/service. Seeded wallet history is synthetic and
cannot establish earnings release/withdrawal. No new app code or tests yet.

Paid branch remains clean/pushed at **6d40d8b2a1b60675f8cf1ff182abd48720b3fc15**.
No application change or new tests: reused current green
[CI35551123265](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35551123265).
Fresh owned Chrome journey accepted1250c, authorized actual Stripe TEST card, worker
Start Work/completion, owner capture, then500c partial and750c remaining refunds.
Both provider refunds succeeded. During the second request, SQL/provider committed
02:29:33.293; another account completed profile200 at02:29:43.310 and visibly loaded
02:29:43.482; original200 released02:29:44.381 and finished02:29:44.383 with socket
intact/destroyedfalse/writableFinishedtrue, within the SDK30s deadline. New account
remained intact; original tab retired to login without owner refund data. Original
payer returned02:35:52 to both saved receipts, Refunded1250c/Net0/no further refund
action, without resubmitting. Exactly1intent/2refund calls/2successful SQL requests;
no refund requests by the other account. First500c hold exceeded30s and disconnected:
retained as recovery-only evidence, not intact-delivery proof.

Private evidence `/private/tmp/pantopus-stream1-refund-session-r2`;19 files mirrored
and hash-verified at owner's `.pantopus-recovery/audits/20260921-stream1-refund-session-r2`.
Full77SQL, actual app UI/routes/SDK/Stripe TEST; local auth/ancillary transport synthetic.
Expected fake-Connect lookup errors remain outside payout scope; stub assertions0.
One test customer deleted, SQL aggregate0, no extra cleanup refund needed. Owned
API18132/Next18133/Supabase64561–67 stopped, both owned Chrome tabs closed, own cache
preserved privately/generated tsconfig restored. No peer resources touched.
Cumulative session13 Stripe TEST originals:6 captures fully refunded7250c,
7 unpaid cancelled intents,6 customers deleted. Provider history retained.
This supersedes earlier P09 browser-control limitation for this bounded scenario only.
Native/live/hosted/Connect and broader acceptance remain open; PR34/47 remain draft.

Coordinator: PR82 strict914e68764 passed CI35553548674 and merged01e842aef;
PR83 exactbf595fa80 passed CI35554056362 and merged
**0fb600391ea6bd88c8f39e9f72bfa6b0b059f765**. Report two-handler source hashes,
real fullpage/feed failure/retry/SQL and cleanup reviewed; no new tests/design changes.
PR84 archived/draft visibility two-field selector repair source/evidence reviewed,
retargeted master and updating for required current-head CI. Keep documentation PR79
draft during feature integration. Frozen03 2f9ae27c captured at ea2781251; writer released.
Next: finish PR84 strict gate, then appropriate paid/master integration; reuse unchanged
accepted payment evidence and preserve native/provider/policy limits.

## Current checkpoint — September 21, 2026, 00:21 UTC

Worktree `/private/tmp/pantopus-paid-gig-integration`; branch
`codex/paid-gig-integration`; clean and pushed at **8825c192866498a6ab065a5d53f007b0abd637a7**.
PR47 and PR34 remain draft. PR46 and the owner's unrelated checkout are untouched.
The branch includes reviewed master61080b399 (Home PR60, session safety PR64 and
account deletion PR65). Subsequent social merges remain on master until the next
justified batch integration; their unrelated journeys need no duplicate payment run.

[Current CI35545431059](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35545431059)
completed **SUCCESS** on8825c1928:15 applicable checks pass/one Seeder skip,
including Android quality/emulator and all three iOS simulators. Previous combined
CI35544523207 was superseded; its backend,
web and database checks passed, but it is not a completed green run. Earlier paid
9ae1edb3b [CI35542623560](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35542623560)
fully passed, including Android and all three iOS simulators. No new unit tests
were written. Only necessary existing expired/stale fixtures were maintained.

Two focused application repairs this session:
- `be13cd7ba`, existing `backend/stripe/gigTipProof.js`: an actual Stripe platform
  Charge omitted optional transfer; strict-null proof incorrectly left a captured
  tip pending. Accept absent/null only. The same original capture then recovered.
- `8825c1928`, existing `OffersPanel.tsx`: actual authorized assignment left the
  offer labeled PENDING despite SQL accepted. Manual Refresh proved the existing
  reader was correct. Adding gigStatus to the existing effect refreshes that list
  after assignment changes. A fresh Stripe checkout automatically showed ACCEPTED;
  reopening automatically showed REJECTED. Scoped ESLint passed. No layout change.

## September21,01:33UTC — checkout cancellation refresh repair

Current clean/pushed paid head **6d40d8b2a1b60675f8cf1ff182abd48720b3fc15**.
Changed only existing `frontend/apps/web/src/app/(app)/app/gigs/[id]/page.tsx`:
reuse offersRefreshKey in handleRefresh after local mutations. Actual baseline
Cancel correctly cancelled Stripe and restored SQL bid pending, but Offers retained
AUTHORIZING/Resume payment until manual Refresh. Existing checkout onAccepted→
PaymentSection onChanged→page handleRefresh reloaded only Gig, whose open status
was unchanged. No new files, schema, UI design or tests. Candidate actual second
checkout/reload recovered AUTHORIZING; Cancel payment setup automatically restored
PENDING/Accept/Counter/Reject without Refresh. Both Stripe TEST intents cancelled,
zero charge, two SQL canceled acceptances/pending bids, no app errors. Scoped
ESLint exit0/five existing warnings; exact-head
[CI35551123265](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35551123265)
completed **SUCCESS**,15 applicable checks/one Seeder skip including Android and all three iOS simulators. Prior8825 greenCI remains prior-source evidence.

Original held-refund/new-login P09 scenario remains **unverified**: Chrome extension
navigation/control timed out; native Chrome control briefly worked then AX/screenshot
became unavailable. In-app browser worked for app controls but its Stripe card frame
was blank. No capture/refund/account-switch outcome claimed. Initial private web
launcher omitted test publishable key; fixed launcher and resumed same intent,
not an app defect. Existing paid/refund proofs remain accepted within recorded scope.

Private evidence `/private/tmp/pantopus-stream1-refund-session-r1`,15 source-bound
files mirrored/hash-verified at owner's `.pantopus-recovery/audits/20260921-stream1-refund-session-r1`.
Full77migrations; synthetic local auth/ancillary transport, actual Stripe SDK/routes/
SQL. Owned SQL aggregate0, one test customer deleted; API/Next/owned Supabase stopped,
Next caches preserved privately and generated tsconfig restored. IAB tab closed;
Chrome owned tab subsequently confirmed absent by fresh coordinator inventory; no shared cleanup.
Cumulative session:12 Stripe TEST originals,5 captures fully refunded6000c,
7 unpaid cancelled intents,5 customers deleted. RequiredCI passed. Next: resume
held-refund session UI only when usable checkout control returns; retain broader
native/hosted/Connect and policy boundaries. Stream3 native slot released after
capability-only failure; no build/install or native acceptance.

## Coordinator integration gate — September21,02:07UTC

Latest02:16UTC: PR81 strict8dd0cd01d passed CI35553310103 and merged
**6f4703065055f42a9def558e0e72c1e09024a03a**. PR82 now master/updated
**914e68764c525fc60a6e78c8f7c9a7e7fd4c2951**, verified app bytes unchanged,
exact three app files plus two existing assertions. CI35553548674 queued/running.
Root Chrome page control recovered on a fresh owned blank tab. Isolated refund-session
r2 now reserves18132/18133 and64561–67, f9200260, source6d40; setup only, no new
acceptance/cleanup claim. Earlier completed r1 remains cleaned/accepted within limits.

Latest02:11UTC: PR80 exact05acf4031 passed CI35553066162 and merged
**e92aeab69044ea3eeccbd6e2c4ebe096e26cb0cb**. PR81 retargeted master/updated
**8dd0cd01db36bd5d5491cbb36ebdc660b5421668**, accepted application bytes unchanged,
exact two reviewed host-choice web files; currentCI35553310103 running. PR82 final
**afe8d2f4c** changes only two existing assertions over verified57e application;
three source hashes and corrected read/global UI/SQL evidence reviewed, CI35553113322
pending. Frozen03 3bcd7d52 captured. Repeated refresh500 in operator evidence is a
read-only triage lead, not a proven new app defect or clean-auth acceptance.

Coordinator integrated PR70→72→73→75→77 after each exact updated-head required CI
passed and its source/evidence review remained valid. Current master is
**b49dd59224d38c060d726a11bc45148f36404fcf** (PR77,02:06:41UTC); earlier merge SHAs
70=358daaa17,72=703e70508,73=ae85bad59,75=cc560bce6. No unfinished payment scope merged.

PR80 retargeted master and updated to **05acf40319313d935edc682535623402386caa02**;
accepted backend/web/packages/SQL bytes unchanged from6e422, diff exactly two worker/
notification files. Current CI35553066162 queued/running. Continue80→81→82 with strict
current-head gates; freeze documentation merges until integration finishes. Reviewed
PR81 dd805 has greenCI and corrected disconnection-only overlap evidence. PR82
57e495460 fixes the actual candidate global-signout regression and expanded-history
refresh; author updates only two stale existing assertions before final CI/review.
No new tests, provider policy, schema or design changes; failed202a retained.

Paid head **6d40d8b2a** is clean/pushed and exact CI35551123265 fully SUCCESS:
15 applicable checks/one Seeder skip, Android and all three iOS simulators. Actual
cancellation UI/API/Stripe TEST/SQL proof accepted; ownfixtures0/runtime stopped.
P09 held-refund/new-login remains unverified due checkout control; native/hosted/
Connect/policy boundaries remain open. Stream3 native slot released after capability
failure, live social runtime/retained fixtures remain owned and must be preserved.

## Newly verified combined and provider journeys

All use existing Chrome UI, SDK, routes/services and isolated PostgREST/PostgreSQL.
The combined and subsequent provider projects replayed all77 migrations. Identity,
ancillary shell feeds and notification transports are synthetic; Stripe TEST is
real only where specified. No live funds, Connect transfers/payouts, hosted or
installed-native acceptance is implied.

- **Combined session recovery on f0a98a974:** owner confirms completion and submits
  a500c tip with a deliberately unknown synthetic-provider outcome. Another tab's
  Settings Logout retires the old tip. A different account sees no tip and sends
  zero payment requests. Returning owner recovers the exact original, one create,
  captured_hold500 and one tip notice. No additional source repair.
- **Actual Stripe assigned stops:**1250c authorization→Reopen Bidding releases the
  hold and commits the task open. Dropped final response leaves UI unknown; reload
  and saved action status confirm the same request's release. Separate750c grace
  cancellation with Changed my plans confirms task cancelled and zero capture.
  The500c offer-status candidate also reopens successfully. Three originals,
  three completed stop UUIDs, three provider cancels, zero captured funds.
- **Actual Stripe partial/full refunds on8825c1928:** chosen1250c bid→authorization,
  worker Start Work/completion with note, owner review/approval→exact capture.
  Refund0.49 and12.51 are rejected before any provider call.500c partial refund
  with a dropped committed response stays unknown; reload recovers that original.
  A blank-amount request freezes the remaining750c and completes it. Fresh Stripe
  receipt reads match both request IDs/amounts; the1250c charge is fully refunded.
  UI shows both receipts, no remaining worker earnings and no further refund action.
  No refund repair was needed. Worker Connect lookup's synthetic-account failures
  are fixture boundaries, not payout acceptance.

- **Delayed offers read on8825c1928:** held a real pending offers response across
  existing free-bid UI acceptance; SQL committed assigned/accepted, released reply
  followed by a fresh real read ended ACCEPTED/no PENDING. Identical browser reads
  serialized, so this does not prove reversed-response ordering. No demonstrated
  defect and no speculative application change. Zero Stripe transactions.

Earlier actual tip decline/retry, failed/successful3DS, lost-response recovery,
zero-charge cancellation and ordinary paid capture evidence remains accepted within
its recorded source/runtime limits. It was not repeated solely for coverage.
Across this session's four actual provider phases: ten originals, five captures
fully refunded (6000c total), five unpaid intents cancelled, four owned customers
deleted. Stripe's immutable test history remains; it is not claimed erased.

Private durable evidence under the owner's `.pantopus-recovery/audits/`:
- `20260920-stream1-tip-ui-r1`:71 files previously hash verified; earlier provider phases.
- `20260920-stream1-session-integration-r1`:7 files hash verified; combined account switch.
- `20260920-stream1-stop-stripe-r1`:18 files hash verified; stop receipts and Offers repair.
- `20260920-stream1-refund-stripe-r1`:13 files hash verified; partial/full refund proof.
- `20260920-stream1-offers-race-r1`:13 phase files plus final CI receipt hash verified; delayed read and11 zero counts.
Each has EVIDENCE.md, source/state/provider details and cleanup. Credentials, caches
and operator logs stay private and outside Git/chat. CUA observations are in active
task `01a0c0d1-0703-70c3-b842-6d01bc8ca48b`.

Cleanup: exact owned rows zero in every phase; stop project13 entity counts and
refund project18 counts and offers project11 counts all zero. Own browser tabs, API18132/web18133 and isolated
API64561/SQL64562 projects stopped. Generated tsconfig restored; own Next caches
preserved privately. An earlier native Chrome window's closure is unconfirmed; its
retired fixture cannot authorize and the backend is stopped. Peer/retained resources
were not changed. Native build slot is free; previous Simulator/Android control
failures still prevent installed tip acceptance.

Coordinator merged reviewed PR65/66/67/69 as61080b399/2d12b85a7/d69482d3f/5eab68ab7
only after their current checks and bounded UI/API evidence passed. PR70 comment
privacy/draft/native mapping is separately reviewed. iPhone16 CI failed on the same
expired booking fixture already fixed in paid9ecf66fc7/9ae1edb3b. Stream3 reused
those exact commits in an isolated checkout and pushed PR70 at07827d2b0; live423
runtime stayed unchanged. Fresh current-head CI is required, not another fixture
repair. PR72/73 current-head checks passed; dependency integration remains open.
Stream3's
real-SMTP reminder repair and personal composer repair are separate dependent
draft PR72 atcbfba3503 and PR73 at423176969. Coordinator source and exact-source
evidence review found no issue within those bounded scopes; CI/dependency merges
remain required. The separate PR75 at5e3a8b963 repairs swallowed preference
database errors; coordinator reviewed actual UI/API recovery and worker refusal
with source hashes. Its exact-head CI passed; dependency integration remains.
PR77 e11123328 publishes the three existing web timing callers using BookingPage;
source-bound UI/SQL evidence reviewed, CI pending. Empty/zero delivery is still
open and no native/provider acceptance is implied. No new storage or design.
Live README contains exact shared-file/runtime grants.

Documentation PR68 merged as4f951d29c and PR71 ascefdadd3e after all applicable checks passed.

Next: publish this green-CI documentation checkpoint, then continue existing
provider/native/backlog acceptance. Required paid CI is complete; PR47 remains draft.
Historical transfer/reversal,
disputes, disabled storage and native journeys remain open. Fee payer/recipient/timing
still needs the pending product decision. No broad inventory row is closed.

The historical snapshot below records earlier states and their original limits.

## Current resumed state — September 20, 2026

State: **real Stripe TEST browser tip milestone verified and repaired; current-head
CI running; native tip acceptance remains open.** Sole Stream1/coordinator task
`01a0c0d1-0703-70c3-b842-6d01bc8ca48b` works only in
`/private/tmp/pantopus-paid-gig-integration`, branch `codex/paid-gig-integration`,
clean/pushed **9ae1edb3bf2647cd8a9d276d0f210d5b201f5eac**. Adopted later September16
Start Work/my-bids/native/completion/tip work at3657af97d and durable evidence;
merged documentation-only master38f00dcc8 asaa168017e. Receipt repairbe13cd7ba and
existing scheduling fixture maintenance9ecf66fc7 follow below. PR47/PR34 remain
draft, PR46 separate; no feature merged. Owner checkout/untracked work preserved.

New browser acceptance reuses existing screens and actual SDK/routes/service/SQL.
First two phases use synthetic provider (8 gigs/7 originals/5 successes/2 canceled).
Actual Stripe TEST tip phase:4 originals/3 captured and1 canceled; ordinary
recovery, actual decline/retry,3DS failure/retry, lost committed reply/reload and
zero-charge cancellation pass. Additional paid-bid authorization→workerStartWork/
completion→ownerCapture and separate checkoutcancel pass with2 originals. No screen/design/schema
change or new unit test. Synthetic app identity, native/hosted/live provider,
Connect transfers/payouts and notification delivery remain explicit boundaries.

[CI35542623560](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35542623560)
is running on9ae1edb3b. Existing fixture pinned-format follow-up is included;
SwiftFormat0.61.1/SwiftLint0.63.3 scoped checks pass. Superseded manual35540452604 exposed expired September17
iOS scheduling fixtures (application correctly says past); it was canceled after
separate fixture correction. Existing64 affected backend regressions pass. Do not
call current CI green until its current-head run finishes.

Owned browser/API18133/18132 and SQL64562/API64561 project are stopped; exact fixture
rows0. Across actual provider phases4 Stripe TEST charges fully refunded,2 unpaid intents
canceled,2 owned customers deleted; provider history retained. Heavy native slot released;
owned iOS Simulator/emulator shut down. Peer resources untouched. Active Stream2/
Stream3 grants and shared single-writer scopes are in live README. Stream2 final02
snapshot published; Stream3 frozen03 safety handoff captured for publication; subsequent updates
remain author-owned.

Next: finish current-head native CI before batching the next paid-branch integration.
Master's reviewed Stream3 safety merge2d6ff2069 is not yet in paid9ae1edb3b;
Home/A02 integration review is active. Recheck the affected payment session journey
on the combined source. Then resume native
tip acceptance when supported device control works; continue remaining paid-gig
provider/P08/P09 scope. Fee payer/recipient/timing product decision remains pending.
No broad inventory row closed; reuse accepted unchanged journeys.

The historical snapshot below retains its original source and acceptance limits.

## Milestone: browser tip recovery through real UI/HTTP/SQL — September 20, 2026

- Branch `codex/paid-gig-integration`, pushed **`aa168017e`** (current master
  `38f00dcc8` merged; application bytes equal accepted `3657af97d`). PR47/PR34 stay
  draft; PR46 separate. CI35540452604 explicitly dispatched because no automatic
  run appeared on the merge head; backend/web/database gates pass, native jobs
  still running. No feature merged.
- Existing GigDetail → `CompletionFlow` → `TipModal` → SDK → real `gigs.js`/`pays.js`
  → `stripeService` → PostgREST → PostgreSQL on all75 migrations. Existing sign-in
  form used a synthetic identity handler. Reused September16 route/provider harness
  and its frozen-parameter/idempotency assertions. No app file, screen, layout,
  schema or unit test added/changed; no application failure reproduced.
- Browser verified ordinary confirmation/tip, minimum/maximum amount refusal,
  duplicate click, lost committed response/reload recovery, unknown provider result,
  retained reload, cross-tab sign-out retirement, other-account isolation (zero tip
  reads/submits), original-account return, unknown cancellation staying pending,
  discovered-original success, missing Connect refusal, unavailable-before-submit
  zero-charge cancellation, corrupted receipt refusal/retry, concurrent second-tab
  retry, departure before delayed result, pending processing and explicit provider
  cancellation. Exact originals and amounts remained bound throughout.
- SQL/private traces confirm **8 owner-confirmed gigs, 7 original Payments,
  5 successful tips/5 stored tip notices, 2 canceled originals, 6 synthetic provider
  creates and 1 synthetic cancel, zero provider assertion failures** across two
  independently cleaned phases. UI transient reload toast was not captured; exact
  recovery GET/modal retirement plus unchanged payment/provider counts were.
- Limits: local development browser; synthetic auth/provider and ancillary shell
  feeds; no Stripe checkout/3DS, real provider, delivery worker, hosted deployment,
  cold browser profile/disabled storage or installed native tip claim. P03/P08/P09
  remain partial. Start Work source-bound evidence reused, no duplicate unit suites.
- Private evidence: `/private/tmp/pantopus-stream1-tip-ui-r1`, mirrored to
  `/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260920-stream1-tip-ui-r1`.
  Read `EVIDENCE.md`, `source.json`, `phase1-final.json`, `phase2-final.json`, request/RPC
  traces and both cleanup records. Credentials/raw logs stay outside Git/chat.
- Cleanup: phase1 exact rows0; phase2 exact rows0 (`cleanup.json`).
  Browser/API18133/18132 stopped; owned SQL64562/API64561 project stopped after
  the native attempt below; all listeners free and peer containers preserved.
  Next: resume installed tip journeys when the local Simulator is usable, then
  remaining Stripe checkout/provider and P08/P09 scope; no broad row closed.


## Installed iOS tip attempt and verification limit — September 20, 2026

The owned simulator still contained the previously installed `a65411758` candidate.
Recorded binary hashes/configuration in `ios-installed-provenance.json`; existing
ContentDetail/payment endpoints and relevant session/storage paths have no diff
from that source to current paid head. Separate social/settings changes entered
master later, so this would be candidate-specific acceptance, not a current full
native rebuild. Existing real login UI succeeded with synthetic local identity.
No tip command ran. The first Safari entry truncated the UUID (actual HTTP path
`/api/gigs/f9200180-0000`,404): a harness input error, not an application defect.

Before retrying the full link, the simulator shut down externally. An exact-device
restart first returned SimLaunchHostService XPC Connection invalid; bootstatus
later reported booted, but the GUI stayed black. Reopening the GUI reported
Simulator app unavailable. No license accepted, system service/cache reset, owner
device or peer device modification. **Installed native tip acceptance remains
unverified.** Stop this attempt rather than claim the browser result proves native.

Exact native prefix `f9200180` cleanup0; no Payment rows/provider calls. Owned
simulator explicitly shut down, native slot released, HTTP18132/web18133 stopped,
owned Supabase project stopped; ports64561–64567 free and retained/peer containers
unchanged. Private attempt, source and cleanup evidence mirrored with the browser
milestone. Recheck actual Simulator availability at resume; do not repeat browser
acceptance for unchanged application bytes.

Android fallback also attempted: existing owned `Pantopus_Stream1_Start_R2` AVD
booted and contains `app.pantopus.android.debug`. The computer-use surface cannot
attach its non-bundled qemu app (not in app inventory; exact executable rejected),
so no UI/native-tip acceptance ran. No APK rebuild/install, unit tests, screenshots
claimed or unsupported input automation used. Owned emulator stopped; briefly
recreated isolated full-schema project stopped again without seeding. Native slot
released. Native verification needs a functioning supported device-control surface.

Coordinator review in progress: Stream2 PR60 `0f663dc32` includes the already
approved Emergency migration `20260916011000` and a newly reproduced stale-create
UI repair; Stream3 PR64 `e83eaac91` wires existing chat Report/Block controls.
Inspected both new diffs, no Stream1 file overlap; author handoff/CI gates still
apply, neither feature merged. Stream3 runtime extension64534–64537 granted;
`users.js` account-delete/SDK scope and forward version20260916012000 are reserved
conditionally, pending actual UI/API reproduction and comparison before edits.

## Milestone: actual Stripe TEST checkout and receipt repair — September20

- **Source:** be13cd7ba modifies only existing `backend/stripe/gigTipProof.js`.
  Current head9ecf66fc7 separately maintains the existing iOS scheduling fixture;
  both pushed to draftPR47. No new application file, unit test, schema or design.
- **Reproduced failure:** Chrome PaymentElement4242 captured500c at Stripe, while
  app UI said needs_review and SQL original stayed pending. Actual charge omits
  optional `transfer`; strict null comparison incorrectly refused it. Existing
  validator/history/paid branches and installed Stripe type compared; official
  [Charge contract](https://docs.stripe.com/api/charges/object) applies transfer
  to destination charges. Small in-place repair accepts absent/null only and
  continues refusing any transfer value.
- **Real end-to-end:** existing completion→TipModal→Stripe PaymentElement→actual
  provider→existing POST tip/check→PostgREST/full75-migration SQL. Same original500c
  recovered through Check tip status, one create/no second charge; reload retired
  modal. Fresh1000c actual generic card decline showed safe retry, valid4242 then
  succeeded SAME intent.2000c actual3DS Fail showed authentication error; retry
  Complete with final app response deliberately lost after commit showed unknown,
  reload recovered terminal SAME original.50c checkout Cancel returned unpaid
  original; explicit Cancel tip canceled provider with no charge and retired UI.
  Fourth fixture was assigned connected worker before confirmation; historical
  title still says no connect. Cold Chrome storage recovered preexisting original.
- **Proof:**4 provider creates/4 originals,3 captured500/1000/2000c,1 canceled50c,
  exactly3 stored tip notices,1 customer,0 assertions/errors. Stripe charge list
  confirms declined then successful1000c attempt and authenticated3DS2000c.
  Existing64 affected backend regressions pass. No new test written.
- **Limits:** actual Stripe TEST only, synthetic local app identity and ancillary
  shell/notification transports. No real Connect account/transfer/payout/live funds,
  delivery worker/hosted deployment/native tip/disabled-storage acceptance. IAB
  PaymentElement did not render; real browser provider proof uses Chrome extension.
  Native browser attempt interrupted. Success toasts transient; terminal UI and
  provider/SQL receipt proof recorded. Do not close P01–P10 broadly.
- **Evidence:** durable private September20 mirror above, `EVIDENCE.md`,
  `stripe-source.json`, `stripe-after-charge-state.json`,
  `stripe-charge-proof-fields.json`, `stripe-recovered-state.json`,
  `stripe-decline-retry-*`, `stripe-3ds-lost-*`, `stripe-final-*`,
  `stripe-provider-attempts.json`, `stripe-runtime-evidence.json`, regression log,
  cleanup records and manifest. Credentials/operator logs excluded from Git/chat.
- **Cleanup:** exact local rows0;3 Stripe TEST refunds succeeded and read-back proved
  fully refunded; fourth intent canceled/zero received; owned customer deleted.
  Provider test PI/charge/refund history remains. Owned payment tabs closed, API/web
  and own Supabase stopped; native slot free; peer runtime/caches/fixtures untouched.
- **CI:** current35542203259 running. Prior35540452604 failed two existing iOS
  scheduling future-action tests on all3 devices because hardcoded September17 is
  past.9ecf66fc7 changes only the fixture to future-relative dates; no app behavior
  or coverage expansion. Source-bound earlier native evidence retained.

## Milestone: actual paid authorization, Start Work and capture — September 20

- **Source:** unchanged application `9ae1edb3bf2647cd8a9d276d0f210d5b201f5eac`;
  current [CI35542623560](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35542623560)
  is running. No application defect, source change, new file or new unit test.
  Located the existing GigDetail, GigBidCheckout and GigPaymentSetup callers,
  accept/finalize/start/completion routes, gigPaymentAcceptance/stripeService and
  existing persistence contracts. Reused earlier synthetic concurrency/error
  evidence; this milestone adds the actual Stripe TEST provider boundary.
- **Actual Chrome workflow:** the owner accepts a $12.50 bid on a $20-budget gig
  and authorizes Stripe's public 4242 test card. Stripe reports `requires_capture`,
  1,250 cents capturable and zero received. SQL has one authorized Payment, an
  accepted bid and an assigned gig priced at $12.50; UI says Bid accepted.
  After signing in as the worker, Start Work saves `in_progress`; submitting the
  completion note saves `completed` while the payment remains authorized and the
  owner confirmation is absent. The owner signs in, reviews the persisted note and
  selects Confirm & Approve. Stripe then captures 1,250 cents, SQL records
  `captured_hold` and owner confirmation, and UI shows Payment Held. Optional tip
  skipped. The card was charged only after owner confirmation in this journey.
- **Cancellation:** a separate $10-budget gig has a $7.50 bid. Cancel in the
  existing checkout invokes the abort route and cancels the same Stripe intent.
  The bid returns to pending and the gig stays open; its attempt and payment are
  canceled with zero received. Reload offers an explicit new Continue action but
  creates no payment. Final count: two provider creates, one cancel, one captured
  original and one canceled original; no duplicate payment.
- **Limits:** actual Stripe TEST and local payment persistence; synthetic app
  identity, ancillary shell reads and notification transports. The worker's
  Connect-account lookup fails for the synthetic account and UI shows Set Up.
  This does not establish Connect, payout, hosted, live-mode or native readiness.
  Acceptance/chat/delivery rows persisted; external delivery is not claimed.
  Fee decisions and the wider P04/P08/P09 scope remain open.
- **Evidence and cleanup:** same durable September 20 mirror, `paid-*.json`,
  `runtime-paid-stripe.cjs`, EVIDENCE.md and manifest. All 11 checked owned entity
  counts are zero. The test $12.50 refund succeeded and a fresh provider read
  confirmed the full refund; the $7.50 intent is canceled and the owned customer
  deleted. Provider history remains. Own payment tab, API18132/web18133 and
  Supabase project stopped; native slot free and peer resources preserved.

Updated September 16, 2026. Owner: coordinator / Stream 1.
State: ready for review — displayed-terms binding delivered at `a65411758` and the
my-bids follow-up at `4ad88ec11` (backend projection guard + existing web card), both
verified; heavy native build slot **released**; owned simulator and emulator shut down;
fixtures cleaned. PR47 CI is green on `4ad88ec11` (15 applicable checks); master
`c14657e35` is integrated as `6e106d9d0` with combined regressions green locally, and the
paid-only migrations are renumbered after master's newest version at **`3657af97d`** (G03),
whose CI passed all 15 applicable checks. **Evening (afternoon PDT) milestone:** the
existing completion, owner-confirmation and reopen/release policies passed 32/32 checks over
real HTTP → route → PostgREST → PostgreSQL on a private full-schema project (no application
change needed; see the [completion/reopen milestone](#milestone-completion-confirmation-and-reopen-policies-verified-over-real-httpsql--september-16-2026)).
The existing tip implementation (P01–P03) then passed the tracked service harness (22/22)
and a new route-level harness (15/15) on the same project (see the
[tip milestone](#milestone-existing-tip-implementation-verified-over-real-httpsql--september-16-2026));
the project was released at 17:20 PDT with zero owned rows. Real provider authorization, the
fee policies (product decision) and the wider P04 scope remain open; PR47 stays draft.

Preserve existing iOS, Android and web screen designs. Verify existing behavior,
repair demonstrated failures in place, and retain the evidence limits below.
P04 and the wider P01–P10/launch backlog remain open; no inventory row closes.

## Milestone: existing tip implementation verified over real HTTP/SQL — September 16, 2026

- **Branch/commit:** `codex/paid-gig-integration` unchanged at **`3657af97d`**. No application
  code, schema or test changed; verification only. The backlog rows P01–P03 were written when
  the tip work was a draft; the source now carries the implementation, so the rows are
  re-stated below from today's evidence rather than re-implemented (no duplicated work).
- **Existing implementation located:** routes `backend/routes/pays.js` (`GET /api/payments/tip-preview`,
  `GET /api/payments/tip-requests/:requestId`, `POST /api/payments/tip` with the original UUID,
  displayed terms, session scope and `resume|check|cancel` modes, legacy `POST /tip/:paymentId/refresh-status`),
  service `backend/stripe/stripeService.js` (`previewTip`, `readTipRequest`, `createTipPayment`)
  with `backend/stripe/gigTipProof.js`, SQL `20260916021100..021300` (16 `*gig_tip*` functions),
  contract `backend/contracts/gig-tip-contract.md`; clients iOS `PaymentsEndpoints` +
  `GigDetailViewModel` tip commands, Android `PaymentsApi` + `GigTipViewModel`, SDK `payments.ts`
  + web tip modal.
- **Reproduced failure:** none in the application. The only defects were in the new private
  harness (a request-string interception that missed `stripeService`'s relative
  `./getStripeClient` require, so two early runs built the real provider client with a synthetic
  test key and had one `customers.create` rejected by the provider as an invalid key; corrected
  to resolve by filename, and the recorded run uses no network provider).
- **Reused evidence, executed today on the fresh full-schema replay:** a `pantopus_stream1_contract`
  template copy of the disposable project's database ran the tracked
  `scripts/db/test-gig-tip-original-service.cjs` **22/22 scenarios** (real service + real SQL,
  synthetic provider/notice transport, exact cleanup verified) and `scripts/db/test-gig-stop.cjs`
  (full scenario list) unchanged. Web `tip-modal` was part of today's 289-test web run.
- **New evidence (private, `verify-tip-routes-r1.cjs` → `tip-routes-http-sql.json`, prefix
  `f9150460`, mirrored with the completion evidence):** real `pays.js` → real `stripeService` →
  supabase-js → PostgREST → PostgreSQL, synthetic identity, synthetic provider carrying the tracked
  harness's assertions (frozen parameters equal the saved `provider_params`, idempotency key per
  request, provider reachable only after `provider_started_at`): **15/15 passed, 0 fixture rows
  remaining, 6 provider creates, 0 cancels, 1 customer, 0 stub failures.** Worker preview 403;
  worker without a Connect account `CONNECT_REQUIRED`; owner preview terms, 3 slots, 50/99999999
  cents, session scope; missing terms / wrong actor / wrong scope / 10 cents refused with no row;
  resume → succeeded receipt, Payment `tip` 500/500/fee 0, one intent, customer bound once, one
  committed `tip_received` notice; identical retry same receipt with no provider call; different
  amount `TIP_REQUEST_CONFLICT`; owner read with scope, worker read 403; lost provider create →
  202 pending retryable with the Payment reserved and its parameters frozen before the provider
  was reached; check discovers the exact intent and records the receipt without creating again;
  cancel before first submission → canceled with zero charge and no provider call, later resume
  stays canceled, slot not consumed; after three successful tips `TIP_LIMIT` with 0 slots and a
  fourth command refused without a reservation; two concurrent identical commands → one intent,
  one row, second pending not retryable; lost HTTP reply after the committed capture recovers
  through the status read and the retry; legacy refresh-status leaves a succeeded original intact.
- **Limits:** synthetic identity/session scope and synthetic provider (exact provider proof
  against Stripe test mode remains P02/L01); free tasks; no installed native or browser tip
  journey (client tip commands remain unit-level: iOS `GigTipTests`/`GigTipRecoveryTests`,
  Android `GigTipViewModelTest`/`GigTipRecoveryTest`, not re-run today); cold historical
  discovery beyond the 24-hour provider window only synthetic; the notification relay verified
  only by the tracked harness's scheduled relay, not a running worker.
- **Shared-file effects:** backlog P01–P03 rows re-stated; guide runtime row marked released;
  handoff paragraph.
- **Cleanup:** fixture rows 0 (harness count and direct SQL); runtime released as recorded in
  the completion milestone's cleanup bullet.

## Milestone: completion, confirmation and reopen policies verified over real HTTP/SQL — September 16, 2026

- **Branch/commit:** `codex/paid-gig-integration` unchanged at **`3657af97d`** (draft PR47, CI
  35142787582 green). This milestone changed no application code, screen, schema or test;
  it verified the existing implementation. Coordination docs only (this file, the guide's
  request/runtime rows, the backlog P04 row, the handoff).
- **Existing implementation located and verified:** `backend/routes/gigs.js` `POST
  /:gigId/mark-completed` (worker proof, `mark_gig_completed` RPC bound to the assignment
  snapshot), `confirmCompletionHelper` behind `POST /:gigId/confirm-completion` and its
  `/complete` alias (`expectedReview` digest from the loaded detail, `confirm_gig_completion` /
  `prepare_gig_completion_original`), and the stop command family (`GET /:gigId/stop-preview`,
  `POST /:gigId/stop-requests`, legacy `POST /:gigId/reopen-bidding` and `/worker-release`)
  through `services/gigStopService.js` and the `gig_stop_*` SQL. Clients: web
  `CompletionFlow` (receipt guards, `completion_review` from detail, `GigStopDialog` →
  `useGigStopRequest`), iOS `GigDetailViewModel.submitDeliveryProof` / owner confirm /
  `GigStopViewModel`, Android `GigDetailViewModel.markCompleted` / `completeGigAsPoster` /
  `GigStopCoordinator`, SDK `markGigCompleted`, `confirmGigCompletion`, `completeGig`,
  `reopenBidding` → `submitGigStopRequest`.
- **Why a new runtime, not the retained one:** the retained replay database (SQL 64522) is at
  `20260910220000` and has none of the paid SQL functions these routes call. A private
  disposable project `pantopus-stream1-complete-r1` (SQL 64562 / API 64561, 75 migrations
  from this branch, only db/kong/postgrest/gotrue/storage) was created; the retained
  64521-64533 resources were not connected to or changed.
- **Reproduced failure:** none in the application. Every policy in the backlog row behaved as
  specified on the real chain. The only defects found were in the new private harness
  (a constant reassignment and a teardown that hit the product's immutable pending-approval
  guard; both corrected and the full run repeated).
- **New evidence (private, `/private/tmp/pantopus-p04-complete-20260916-r1`, mirrored to the
  owner's `.pantopus-recovery/audits/20260916-p04-complete-r1`):** `verify-complete-reopen-r1.cjs`
  → `complete-reopen-http-sql.json`, **32/32 passed, 0 fixture rows remaining (`f9150450`),
  2 provider attempts (both the intercepted capture)**. Worker completion: before start 400;
  non-worker 403; commit with one owner notice; identical retry `reused:true` without a
  second notice; different proof 409 `COMPLETION_CHANGED`; lost reply after commit then retry
  reused. Owner confirmation: stale or missing `expectedReview` 409; the digest is visible to
  owner and worker only; non-owner 403; the displayed review commits confirmation, rating,
  the worker counter and one worker notice with no provider call on a free task; retry and
  the `/complete` alias return the same receipt without a second counter, notice or rating
  change; a task edited after the owner loaded the review is refused until the refreshed
  review is used (immutable displayed terms). Paid task: worker completion binds the payment;
  owner confirmation stops at the intercepted provider with 503, the original approval stays
  pending for the same owner/review across a retry, and a direct edit of the reviewed task is
  refused by the guard. Reopen/release: worker preview 403; owner preview eligible with the
  accepted bid, zero fee, no financial action and the session scope; missing terms / changed
  actor / changed scope 409; stale terms 409 `STOP_TERMS_CHANGED` with no request row; the
  displayed terms complete the reopen (task open, worker and acceptance cleared, bid rejected,
  request completed, one worker notice); retry returns the same receipt; lost reply after
  commit recovers through the status read and the retry; after work started the preview is
  ineligible (`STARTED_POLICY_REVIEW`) and the command is refused with that code; worker
  release reopens with one owner notice; two concurrent identical commands produce one
  request row and one transition; the legacy `/reopen-bidding` route refuses an empty body
  (`STOP_TERMS_REQUIRED`) and completes the full command.
- **Reused evidence:** backend `paidGigLifecycleRoute` (240) and `gigStopRoute` unit suites
  and the tracked real-SQL stop harness `scripts/db/test-gig-stop.cjs` + pgTAP
  `scripts/db/contracts/gig-stop.sql` (CI green on this head); web suites re-run locally today
  (`assigned-gig-authorization`, `gig-acceptance-entrypoints`, `gig-stop-recovery-entry`,
  `gig-stop-recovery`, `tip-modal`: 5 suites, 289 tests passed); native unit coverage cited
  by file in the evidence (not re-run today; CI green on `3657af97d`).
- **Findings without code change:** (1) the retained iOS `GigReassignmentEndpoints.reopenBidding`
  and Android `GigReassignmentRepository.reopenBidding` DTO callers post an empty body to
  routes that now require the full stop command and would get 409, but no shipped screen
  calls them (every screen uses the stop preview → command flow); recorded as dead client
  code, not a failure, and left untouched under the design-preservation rule. (2) A pending
  paid completion approval is immutable by design; the product's only release path is a
  provider-canceled intent (`stripeService.capturePayment` → `record_gig_completion_canceled`),
  which belongs to the provider bundle (P02/L01).
- **Limits:** synthetic identity and session scope; providers intercepted (paid confirmation
  verified only up to the capture boundary); free tasks for the completed paths; no photos
  (storage provider stubbed; photo verification stays unit-tested); no installed native or
  browser journey in this milestone; no notification delivery worker run; disposable local
  project, not a hosted environment. No-show and cancellation-fee policy rows still need the
  fee payer/recipient product decision.
- **Shared-file effects:** guide request table (Stream 2 migration version grant) and runtime
  table (this reservation); backlog P04 row; handoff current-state paragraph.
- **Cleanup:** fixture rows 0 by the harness's own count and by direct SQL; owned runtime
  `pantopus-stream1-complete-r1` kept up for the tip milestone below, then **released at 17:20 PDT**
  (`supabase stop --no-backup` in the workdir): owned rows `f9150450`/`f9150460` = 0 by direct
  SQL before the stop, no `stream1-complete` container remains, ports 64561-64567 free, the
  retained `pantopus-home-gig-replay` (64521-64527) and `pantopus-stream3-block-r1` (64532)
  containers still up (Kong 64521 answered 200 afterwards). The workdir stays for cheap recreation.

## Peer findings received from the earlier Stream 1 session — September 16, 2026

Recorded from the retired Stream 1 session's handoff after independent checks:

- **Native guards can hide a truthful recovery after a post-start price change.** An
  approved change order updates `Gig.price` while the gig is `in_progress`
  (`backend/routes/gigs.js` approve handler). If a worker retries Start after a lost reply
  and the price changed in between, the route's saved-start recovery is correct, but the
  iOS/Android receipt guards compare the full displayed snapshot and refuse to show
  success; with `a65411758` the retry now gets `409 ASSIGNMENT_CHANGED` from the route
  instead, with the same "refresh" guidance, and the reopened screen shows the committed
  In progress state. Conservative and truthful, not a defect; the native Start Work
  journey is accepted with this limit stated.
- **Silent CI loss on conflicting shared docs** is now a rule in the guide (see the
  feature-branch paragraph): PR47 had no pull_request runs at `f437dfd20` because its
  own copies of the coordination documents conflicted with master.
- **The repo's `backend/tests/integration/gig-lifecycle.test.js` cannot run against the
  retained replay database (64522):** its helper seeds `account_type: 'personal'`, which
  that older schema's check rejects (`individual|business|curator`), and each failed
  attempt leaks one `auth.users` row before cleanup tracking starts. Do not change the
  helper to fit the stale fixture; the peer removed the row it created.
- **Paid-path HTTP evidence on the final head.** The peer's self-cleaning harness (real
  HTTP → real route → PostgREST 64521 → PostgreSQL 64522, free and paid, only
  `verifyGigAuthorization` stubbed, mutation injected at that await) was copied into
  Stream 1's evidence as `e2e-start-recovery-peer.js` and re-run on `3657af97d`:
  **28/28 checks pass**, 9 gigs / 13 users / 6 payments created and removed, 0 remaining
  (`e2e-start-recovery-peer-final-head.log`). This adds paid-gig coverage to the free-gig
  harnesses above; provider verification itself stays stubbed.
- The peer's derived data (`.../b16f36ca-.../scratchpad/p04/DerivedData`, several GB) is
  reclaimable at any time; nothing references it.

## Integration: current master merged into the paid branch — September 16, 2026

- **Branch/commit:** `codex/paid-gig-integration` at **`6e106d9d0`**, a merge of master
  `c14657e35` (Stream 2 PR53 `4cc9d3787`, Stream 3 PR51, docs PR52/54/55/56) with no
  conflicts; 40 application/script files from the streams entered the paid branch. The
  paid `emitPrivateGigUpdate` socket helper and export are preserved; Stream 3's `PT403`
  admission mapping is present; migrations now number 75 (`20260916010000` added);
  `sync-sql-contracts.cjs --check` verifies 66 pgTAP wrappers.
- **Combined regressions on the merged tree:** backend Jest **340 suites / 6256 passed /
  16 skipped** (Stream 3's chat-access suite now included); web
  `assigned-gig-authorization`, `gig-acceptance-entrypoints`, `homeSharingLinks`,
  `blockedUsersPage`, `publicProfileSafety` **153/153**; typecheck gate 0 errors. PR47 CI
  on this head is the remaining gate (native jobs).
- **Migration order reconciled (G03, concrete):** CI 35141268492 on `6e106d9d0` failed
  only "Protect migration history": the policy (`scripts/db/check-migrations.cjs`) requires
  migrations new relative to the PR base to sort after the base's newest version, and
  master now carries Stream 3's `20260916010000`, so all 21 paid-only migrations
  (`20260914020100`..`20260915050000`) violated it. `3657af97d` moves them to
  `20260916020100`..`20260916022100` with `git mv`, preserving order and bytes; no master
  migration is touched and none of these versions was ever applied to a hosted
  environment. The only non-doc reference (`backend/contracts/gig-tip-contract.md`) now
  cites the new tip names; historical reports keep the old names as history. Verified:
  policy check passes against the master base, `node --test` for scripts/deploy, scripts/db
  and scripts/staging 72/72, 66 contract wrappers verify.
  [CI 35142787582](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35142787582)
  on `3657af97d` passed all 15 applicable checks, including the fresh-database replay
  with the renumbered chain and all native jobs on the integrated tree; the failed run
  35141268492 on `6e106d9d0` is retained as failed. Draft PR34
  (`codex/staging-paid-gig`) still carries the old version names and will need the same
  reconciliation or closure as incorporated when its disposition is decided.
- **No screen or application-behavior edit** in this integration; PR47 stays draft.

## Follow-up: my-bids Start Work card bound to the terms it rendered — September 16, 2026

- **Branch/commit:** `codex/paid-gig-integration` at **`4ad88ec11`**, pushed after the
  `a65411758` CI run completed;
  [CI 35134153318](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35134153318)
  passed all 15 applicable checks (one Seeder path skip) on this head.
- **Changed paths:** `backend/routes/gigs.js` (existing `GET /my-bids` projection),
  `backend/tests/unit/paidGigLifecycleRoute.test.js`,
  `frontend/apps/web/src/app/(app)/app/my-bids/page.tsx`,
  `frontend/apps/web/tests/gig-acceptance-entrypoints.test.tsx`. No screen, layout or schema
  change; no new file.
- **Concrete requirement:** the my-bids card is the second existing Start Work entry and
  its list projection carried no assignment terms, so after `a65411758` it still started
  without binding.
- **Repair:** the projection now includes `accepted_by`, `accepted_at`, `payment_id`, with
  `accepted_at`/`payment_id` exposed only to the bidder who is the assigned worker (other
  bidders receive null); the existing card passes the rendered terms when present, keeps the
  legacy call for an older backend, and on `409 ASSIGNMENT_CHANGED` shows the server
  guidance and reloads the list.
- **Evidence:** lifecycle suite 240/240 (new worker-vs-other-bidder projection case); full
  backend Jest 6213 passed / 16 skipped; `gig-acceptance-entrypoints` 80/80 (two new cases);
  typecheck gate 0. Rendered-test evidence only for this card; the real HTTP/SQL and installed
  checks of the binding are the ones recorded for the detail entry.
- **Cleanup/shared effects:** none (no runtime used); SDK unchanged.

## Milestone: Start Work bound to the displayed assignment terms — September 16, 2026

- **Branch/commit:** `codex/paid-gig-integration` at **`a65411758`**, pushed to draft
  [PR47](https://github.com/WangPantopus/skinny-pantopus/pull/47);
  [CI 35130607463](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35130607463)
  passed all 15 applicable checks (one Seeder path skip), including the three iOS device
  jobs, Android lint/test/assemble and instrumented tests, and the database replay. The
  previous head `74c01bf49` also passed all 15 applicable checks in
  [CI 35126983681](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35126983681).
- **Changed paths (all existing files except two small DTOs):** `backend/routes/gigs.js`
  (start handler + three helpers), `backend/tests/unit/paidGigLifecycleRoute.test.js`;
  `frontend/packages/api/src/endpoints/gigs.ts` (`startGig(gigId, expected?)`);
  `frontend/apps/web/src/components/gig-detail/CompletionFlow.tsx`,
  `frontend/apps/web/tests/assigned-gig-authorization.test.tsx`; iOS
  `GigsEndpoints.swift` (new `StartGigBody`), `GigDetailViewModel.swift`,
  `GigDetailViewModelTests.swift`; Android `GigDtos.kt` (new `StartGigBody`), `GigsApi.kt`,
  `GigsRepository.kt`, `GigDetailViewModel.kt`, `GigDetailSaveViewModelTest.kt`. No screen,
  layout, styling, navigation, table, migration, RPC, service or new screen file.
- **Reproduced requirement:** installed journey D above and `stale-before-read-http-sql.json`:
  the route started a newer same-worker assignment the client never displayed (200 with a
  new `accepted_at`, owner notified). Change orders already mutate `Gig.price` while
  assigned, so displayed terms can drift in practice. Existing pattern reused: the route
  family already binds flat `expected*` body fields (confirmation/authorization).
- **Repair:** the existing handler accepts optional `expectedAcceptedAt`, `expectedPrice`,
  `expectedPaymentId`; when any is present all three are compared with the route's own
  read (timestamps by instant, so PostgREST `+00:00` matches a client `Z`) before recovery,
  provider verification or the write, answering the existing conflict copy with
  `409 ASSIGNMENT_CHANGED`; malformed terms are 400; callers that send none keep the
  prior behavior. iOS sends every key (null included); Android's Moshi omits nulls and the
  route reads an absent key as a displayed null; web passes the rendered `accepted_at`,
  `price`, `payment_id` and shows the server guidance plus the existing reload on 409.
- **Evidence (source-bound):** backend lifecycle suite 239/239 (10 new cases); full backend
  Jest 6212 passed / 16 skipped; real HTTP → route → PostgREST → PostgreSQL harness 8/8
  (`displayed-terms-http-sql.json`: stale re-stamp refused with no write or notice, saved
  start not recovered under old terms, lost-reply recovery under the same terms, legacy
  caller unchanged, timestamp formatting, malformed 400, exact cleanup); web
  `assigned-gig-authorization` + `gig-acceptance-entrypoints` 126/126 and the typecheck
  gate at 0 errors; Android ktlint/detekt and `GigDetailSaveViewModelTest` 55/55; iOS
  SwiftLint strict/SwiftFormat (pinned) and `GigDetailViewModelTests` 61/61 on the owned
  iOS 26.5 simulator. Two first attempts were test-compile errors (stray MockK import;
  SwiftFormat-hoisted `await`) and are retained as attempts, not counted.
- **Installed rebuilt iOS candidate** (same runtime, real route with the change):
  stale assignment re-stamped after the screen loaded → **409, row stayed assigned, no
  notice**, screen stayed "Assigned"; reopen → screen shows the new assignment → Start →
  200, one notice, "In progress"; lost reply after commit → error path → retry with the
  same displayed terms → `reused: true`, same timestamp, one notice, "In progress".
- **Installed Android candidate** (previously open): `app-debug.apk` from `a65411758` with the
  API/socket URL pointed at the fixture runtime, on a **new owned AVD
  `Pantopus_Stream1_Start_R2`** (pixel_5, android-34 google_apis arm64; the existing
  acceptance AVD untouched), real Android sign-in UI backed by the synthetic login fixture,
  existing GigDetail via `pantopus://gigs/<id>`, same real route/PostgREST/PostgreSQL runtime,
  driven with adb: stale assignment re-stamped after the screen loaded → **409, row
  assigned, no notice**, snackbar "The task changed before work could start. Refresh its
  details." captured; reopen → Start → 200, one notice, "In progress"/"Mark as delivered";
  invalid `{}` receipt after commit → the existing network-failure branch ("Received an
  unexpected response.", Moshi cannot decode it as a detail response), screen stayed
  Assigned, no refresh → retry `reused: true`, one notice; lost reply after commit → stayed
  Assigned → retry `reused: true`; two taps 0.4 s apart under a 4 s held reply → exactly one
  request, one transition, one notice.
- **Limits:** synthetic identity, intercepted providers, free gig, older retained schema,
  simulator/emulator rather than physical devices; local web lint could not run in this worktree (symlinked node_modules farm) —
  CI's web lint job is the gate for that; the web my-bids card still starts without terms
  because its list projection carries no assignment terms (separate bounded follow-up);
  P04 stays open (fee policies, provider authorization, P05–P10).
- **Shared-file effects:** additive optional parameter on `@pantopus/api` `startGig`
  (Stream 1 scope per the guide); no peer paths touched.
- **Cleanup:** runtime 18132 stopped, exact owned rows 0 by direct SQL (`f91504x0` prefixes),
  simulator shut down, owned emulator killed (AVD retained), own Gradle daemon stopped,
  heavy slot released.
- **Evidence:** `/private/tmp/pantopus-p04-start-20260916-r2` (`EVIDENCE.md` second section),
  mirrored to the owner's private `.pantopus-recovery/audits/20260916-p04-start-r2`.

**Next bounded milestone (Stream 1):** P04 policy verification (existing no-show,
cancellation-fee and completion/reopen implementations) per the backlog order, starting
with reproduction against the existing routes; the fee payer/recipient policy still needs
the product decision recorded in the guide. PR47 stays draft until its CI on the latest
head is green and the recorded gaps are reviewed.

## Milestone: iOS Start Work candidate verified locally and installed — September 16, 2026

- **Branch/commit:** `codex/paid-gig-integration` at **`74c01bf49`**, pushed; draft
  [PR47](https://github.com/WangPantopus/skinny-pantopus/pull/47) now carries a scope
  description. CI 35126983681 was running at this update (backend/web/database/iOS lint
  green, native test jobs pending); do not treat it as final until it completes.
- **Changed path:** only `frontend/apps/ios/PantopusTests/Features/ContentDetail/GigDetailViewModelTests.swift`
  (3 lines). No application code, screen, layout, styling, navigation, schema or new file.
- **Reproduced failure:** CI 35103180556 on `e531074e4` failed `testStartTaskTransitionsToInProgress`
  on all three simulators (line 364, "In-progress worker gets the delivery affordance"):
  the trailing-closure rewrite no longer bound the closure to `tipIdentity:`, so
  `startTask()` used the default identity and returned `.ignored`. The correction hoists
  the closure into a typed local constant passed with the explicit label.
- **Reused evidence:** backend 13/13 HTTP/SQL cases and 229 regressions (`599de1586`),
  Android 54/54 JVM (`9397e39a7`), CI 35054602607 simulator runs of the six WIP cases,
  and the accepted web browser evidence at `c9cb69825`. Unchanged sources are bound by
  hash in `ios-candidate-source.json`.
- **New evidence (source-bound):** SwiftLint 0.63.3 strict 0 violations; SwiftFormat 0.61.1
  0/2248 files. `PantopusTests/GigDetailViewModelTests` on the owned simulator
  `Pantopus Stream1 Start R2` (iOS 26.5): **59 executed, 0 failures**, including the six
  Start Work cases and the previously failing case. A first attempt hung before XCTest
  attached (the host launched with a persisted r1 session) and is retained as a hung
  attempt, not counted; attempt 2 after a simulator shutdown/boot passed.
- **Installed candidate journeys** on the same Debug build (`Pantopus.debug.dylib` contains
  the receipt guard; API/socket 127.0.0.1:18132): real sign-in UI backed by a synthetic
  login fixture → existing GigDetail via `pantopus://gigs/<id>` → real `backend/routes/gigs.js`
  → supabase-js → PostgREST 64521 → PostgreSQL 64522; providers intercepted; push/badge/socket
  stubbed; free gig; retained older schema; fixture prefix `f9150420`.
  - A. Invalid receipt (200 `{}` after commit): SQL `in_progress` and one `gig_started`
    notice; the screen stayed "Assigned"/"Start task" and did not refresh from the invalid
    receipt. Retry → `reused: true`, same `started_at`, still one notice → "In progress"
    with "Mark as delivered".
  - B. Lost reply (socket destroyed after commit): committed with one notice; client error
    path with no automatic POST retry (non-idempotent by design); screen stayed "Assigned".
    Explicit retry → `reused: true`, same timestamp, one notice → "In progress".
  - C. Ordinary start: one POST, `in_progress`, one notice, refresh → "In progress".
  - D. **Stale assignment before the server's first read** (`accepted_at` re-stamped in SQL
    after the screen loaded): the route **started the newer assignment** (200, new
    `accepted_at`) and notified the owner; the candidate refused to show success and stayed
    at "Assigned"; a retry returned `reused: true` for the newer assignment and was refused
    again. The same boundary is reproduced over pure HTTP (`stale-before-read-http-sql.json`:
    200 with the new `accepted_at`; a free→paid change before the read is refused 402).
    This is the previously unproven scope, now concretely reproduced; it stays open.
  - E. Two taps within a 4 s held reply: exactly one POST reached the route, one transition,
    one notice; the second tap was ignored.
  - Toast text was not captured by simulator screenshots; state transitions and SQL records
    are the accepted evidence.
- **Limits:** synthetic sign-in/identity, intercepted providers, free gig, older retained
  schema, stubbed delivery, simulator rather than a physical device. Session replacement and
  departure mid-request remain unit-test-only. Installed Android was not run. P04 stays open.
- **Shared-file/integration effects:** none (test file only); no peer source touched.
- **Cleanup:** runtime 18132 stopped; exact `f9150420`/`f9150430` rows 0 by direct SQL;
  owned simulator shut down; heavy native slot released; no schema/reset/container change;
  owner iPhone17 and peer devices untouched.
- **Evidence:** `/private/tmp/pantopus-p04-start-20260916-r2` (harness, logs, xcresult,
  screenshots, `EVIDENCE.md`), mirrored to the owner's private
  `.pantopus-recovery/audits/20260916-p04-start-r2`.
- **Process:** the earlier Stream 1 session (`pantopus-paid-gig-integration-c8`) is still
  alive with two stuck background loops in this worktree; it was told that this session is
  the sole Stream 1 writer. One writer per worktree.

**Next bounded milestone (Stream 1, assigned in the guide): displayed-terms binding for
Start Work.** Journey D shows the route can start terms the client never displayed. The
smallest repair in the existing implementation: accept an optional expected-assignment
snapshot (`accepted_at`, `price`, `payment_id`) in the existing `POST /:gigId/start` body,
compare it with the route's own read before the provider check and answer the existing 409
conflict on mismatch; pass the displayed snapshot from the existing iOS/Android/web callers
and `frontend/packages/api` `startGig`. Existing clients that send no body keep today's
behavior. No new file, table, screen or migration. Change orders already mutate `Gig.price`
while assigned, so displayed terms can drift in practice.

## Resumed from the cutoff — September 16, 2026

The cutoff section below set the resume point: fix the trailing-closure lint, then
validate the iOS candidate. Both are now done, and no heavy native slot was needed
because CI had already exercised the candidate on simulators.

- **Lint repaired, after one wrong attempt.** `e531074e4` rewrote the offending
  call to trailing-closure form. That satisfied SwiftLint but was wrong: `tipIdentity`
  is followed by `makeTipRequestId`, `liveActivity`, `roomEvents` and `emitRoom`, so
  a trailing closure no longer binds to `tipIdentity`. It compiled, `ios / Lint`
  went green, and `testStartTaskTransitionsToInProgress` then returned `.ignored`
  instead of `.confirmed` on all three simulators in CI 35103180556 — one green job
  traded for three failing ones. Lint passing is not evidence the change is correct.
  The correction keeps the explicit `tipIdentity:` label and hoists the closure into
  a typed local constant, so there is no closure literal for the rule to flag and
  the semantics match the form that passed on `9af5dcf74`. Verified with the versions
  CI pins (SwiftLint 0.63.3, SwiftFormat 0.61.1): 0 violations in 2245 files, 0 of
  2248 files needing formatting, `verify-icons` and `verify-overline` pass.
  No screen, layout, styling or navigation change.
- **The iOS candidate is no longer unvalidated.** CI run 35054602607 on the WIP
  `9af5dcf74` failed *only* the lint job and its aggregate; `ios / Build iOS test
  bundles` and all three device jobs succeeded. The executed-test log for
  `ios / Tests on iPhone 16` contains all six new cases —
  `testStartRejectsMissingOrMismatchedSavedReceipt`, `testStartDebouncesPendingRequest`,
  `testStartRetiresReplyAfterSessionReplacement`, `testStartRetiresReplyAfterDeparture`,
  `testStartRetiresReplyAfterSameWorkerReassignment` and
  `testStartDoesNotApplyRefreshAfterSessionReplacement` — on iPhone 16, 16 Pro and SE.
  This supersedes the cutoff note that no candidate build or test had run. It is
  **simulator** evidence from CI, not an installed-device journey.
- **The `accepted_at` binding in `599de1586` was independently re-verified.** That
  commit adds a timestamp equality predicate to `bindGigPaymentSnapshot`, which a
  mocked suite cannot prove safe: a microsecond round trip through PostgREST and
  supabase-js that truncated would break every real start, because the real
  acceptance RPCs stamp `accepted_at` with PostgreSQL `now()`. Confirmed against
  real PostgreSQL that a gig stamped `2026-09-16 13:39:21.846253+00` still starts
  (200) and still recovers its saved start (200, `reused: true`), free and paid.
  The helper has exactly two callers, both inside the start handler, so the wider
  lifecycle is unaffected. Its preserved recovery-read 503 is a real improvement
  over the inherited patch, which treated a failed recovery read as "no saved start".
- **End-to-end re-run on the combined tree**: 28/28 checks over real HTTP through
  the existing route against real PostgreSQL, free and paid. Backend Jest 6202
  passed / 16 skipped / 0 failed. Fixtures removed exactly: 9 gigs, 13 users,
  6 payments; 0 remaining; no schema, reset or migration.

**Process finding — two writers shared one worktree.** While this task held
`/private/tmp/pantopus-paid-gig-integration`, another Stream 1 session committed and
pushed to the same branch, including a WIP commit that broke CI, and swept this
task's uncommitted 409/503 repair into `599de1586`. The work itself is sound and is
kept; the hazard is that neither writer could see the other's in-flight edits, and a
"WIP" commit reached a shared branch. One writer per worktree, and no WIP commits on
a branch with an open PR.

**Still open, unchanged by this resumption**: an installed iOS and Android Start Work
journey, real provider authorization, the stale-client assignment boundary before the
server's first read, and the unspecified cancellation/no-show fee payer/recipient
policy. P04 does not close.

## Immediate cutoff handoff — September 15/16, 2026

The user requested immediate wrap-up. Implementation and testing have stopped.
The next agent resumes **Stream1 and coordination**; the previous Stream1 writer
has stopped and ownership was explicitly transferred to this task.

- Paid worktree: `/private/tmp/pantopus-paid-gig-integration`, branch
  `codex/paid-gig-integration`, clean and pushed at **`9af5dcf7417760c9483c4f7b1e1008722350daf8`**.
  [PR47](https://github.com/WangPantopus/skinny-pantopus/pull/47) remains draft.
  This is an **unverified iOS WIP**, not an accepted repair or merge candidate.
- Master is **`82430954038ec6e74b72b54192aaad8117bcc363`**, documentation-only
  [PR50](https://github.com/WangPantopus/skinny-pantopus/pull/50), with four applicable
  checks/seven path skips. Paid merge `4aaa08546` preserved both append-only report
  sections; application bytes before the WIP match `41c75d49a`.
- The iOS baseline ran59 tests:53 existing tests passed; all6 new distinct cases
  failed, with28 assertions. Cases cover invalid/missing/mismatched receipts,
  duplicate pending requests, late session/departure/reassignment replies and a
  session change during refresh. Baseline exit65 is expected failure evidence.
- Actual installed **baseline**: normal sign-in UI with synthetic local auth →
  existing GigDetail via deep link → Start task → In progress/Task started/Mark as
  delivered. Real route/PostgREST/PostgreSQL saved `started_at` and exactly one
  Notification; provider calls intercepted. Free gig, older retained schema.
  This proves the ordinary baseline journey only.
- WIP changes only three existing files: `GigDetailViewModel.swift`,
  `GigDetailView.swift` and `GigDetailViewModelTests.swift` under the existing iOS
  ContentDetail feature/test folders. It validates the saved receipt, binds the
  pending attempt to identity/assignment, retires callbacks on departure and uses
  existing `ConfirmationResult` to suppress stale success. Refresh guards are
  threaded through existing readers. The screen callback changed; its appearance,
  layout and navigation did not. No new application file/schema was added.
- Swift parse passed and SwiftFormat ran. Scoped strict SwiftLint currently fails
  **one `trailing_closure` at test line355**. **No candidate Xcode build/test or
  installed candidate journey has run.** Current-head CI was not accepted; green
  [CI35049746982](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35049746982)
  applies only to `41c75d49a` (15 applicable checks/one Seeder skip).

This shared cutoff is published for review in documentation-only
[PR52](https://github.com/WangPantopus/skinny-pantopus/pull/52); its checks/merge
remain pending at handoff. Do not resume work merely to finish that PR now.

**Resume here:** inspect the three-file WIP and private baseline/candidate logs,
fix the trailing-closure lint issue, then reserve the heavy native slot before
running the59-test iOS suite and affected static checks. Reuse the baseline command
from `ios-baseline.log` and source metadata. Review any compile/behavior failures;
then rerun installed invalid/late/retry and valid journeys through existing UI,
real caller/API and persistence. Do not label the WIP accepted from parsing or CI.
Android54 JVM tests and backend229 regressions/13 HTTP cases remain source-bound
accepted evidence; installed Android, stale-client assignment before the server's
first read, paid providers and broader P04/P08/P09/R05 remain open.

Private evidence: `/private/tmp/pantopus-p04-start-20260915-r1`, mirrored to
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/audits/20260915-p04-start-r1`.
Start with `EVIDENCE.md`, `ios-baseline-source.json`, `ios-baseline.log`,
`ios-baseline.xcresult`, `ios-installed-baseline.json`, `ios-candidate-lint.log`
and `ios-runtime.cjs`. Derived build output remains only in the temporary source
folder. Raw credentials, logs and device tokens stay outside Git/chat.
The first truncated Safari deep link was a harness entry error; reopening the full
URL worked. A reused-view deep-link lead and MyTasks500 on the older schema are
unverified/outside this acceptance, not reasons to expand the current patch.

**Cleanup confirmed:** own HTTP18132 stopped; exact `f9150410` fixtures removed
(`ios-runtime-cleanup.json` reports zero); new owned simulator
`C2BCF36A-F300-48C1-9BA7-876CA9F61E55` is Shutdown. Earlier `f9150400` cleanup was
also zero. The heavy native slot is released. No other simulator, physical device,
container or schema was changed by Stream1. Preserve the owner's checkout and
other streams' fixtures.

**Coordinator pickup:** the live guide remains
`/Users/yingpengwang/pantopus-coordination/docs/workstreams/README.md`; application
copies are snapshots. Stream2's dirty02 and Stream3's dirty03 are author-owned and
were deliberately not staged with this cutoff. Review their live files and fresh
remote state before integration. Stream2 is at `70e079543`, no PR; its broader M02
and two unverified callback/scope leads remain open. Stream3 draft PR51 is freshly
observed at **`22adc728512b8dd0f261c0aaf02e255123dc7f50`**. Its later native lifetime,
N05 reminder and cross-room retry milestones are reported, not fully coordinator
reviewed. Earlier reviewed `dfc860bfe` evidence is in the existing verification
report. No peer or paid application merge is approved.

Stream3 task **Resume Stream 3 verification**
(`01a0a824-301b-74e3-a1d9-b205714ed7a1`) was notified of the cutoff and native-slot
release. Its existing grants continue. The guide now records the exact forward
migration/contract assignment for the reproduced block-versus-send race, restricted
to its new isolated SQL64532/API64531 database. Do not apply it to retained64522.
Stream3 also received immediate cutoff: it reports HTTP18130/web18131 stopped and
exact `f9150300` cleanup zero at21:13:58 PDT. Its simulator
`0AE16FA0-E244-414F-86C8-24893BDFD979` remains stopped. Isolated canonical-empty
SQL64532 is retained healthy; API64531 has not started. No transactional migration
or SQL-test code has been written. Current PR51 CI35054358217 was still running
at peer cutoff, not accepted. Its final dirty live03 includes the remaining matrix
and76-file private evidence mirror; the successor must publish that author snapshot.
Docker is now responsive; old Docker-blocked notes do not establish a current block.

## Earlier accepted milestones and preparation snapshot

The cutoff section above supersedes current-source, preparation and resource claims
in this retained milestone history.

## Source and ownership

- Application worktree: `/private/tmp/pantopus-paid-gig-integration`, branch
  `codex/paid-gig-integration`. The user confirmed the previous writer stopped.
- Backend milestone: **`599de1586`**, on prior integration `959e147e6`.
  Changed only `backend/routes/gigs.js` and its existing
  `backend/tests/unit/paidGigLifecycleRoute.test.js`.
- Android milestone: **`9397e39a7`**, changing only the existing
  `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/contentdetail/GigDetailViewModel.kt`
  and `frontend/apps/android/app/src/test/java/app/pantopus/android/ui/screens/contentdetail/GigDetailSaveViewModelTest.kt`.
- Current pushed head: **`41c75d49a`**, integrating master `0616d6e79`. This merge
  changes documentation snapshots only; the shared handoff/backlog take master’s
  authoritative versions. Earlier paid history remains in Git and the linked
  source-specific reports. Application bytes match `9397e39a7`.
- PR34 remains draft at `c9cb69825`. PR47 is now also draft because it contains
  unfinished paid scope. User PR46 remains separate. No paid feature was merged.
- Shared documentation PR50 merged as **`824309540`** after four applicable
  checks/seven path skips. It publishes the reviewed Stream3 milestone without
  merging application code. Its tree matches tested `123d11437`.
- Shared documentation PR49 merged as **`0616d6e79`** after four applicable
  checks passed/seven path skips. Its tree equals tested `3c4f1f721`; no application
  changed. The neutral coordination branch is synchronized with that master.

iOS follow-up is in preparation: six regression cases added to the existing
GigDetailViewModelTests cover receipt, duplicate, reassignment, departure and
session/refresh lifetime. They have not run yet; application code is unchanged.
Waiting for Stream3 to release the heavy native slot. No native acceptance claim.

## Reproduced backend failures and repair

Actual HTTP → production route → real Supabase client → PostgREST → PostgreSQL
reproduced seven failures against `959e147e6` before this repair:

- Concurrent owner/worker/price replacement returned 500 instead of conflict.
- A pending start started a newer assignment to the **same worker**, because
  `accepted_at` was omitted from the existing conditional update.
- An unavailable write returned 500 rather than a retryable unavailable response.
- An unavailable saved-result read returned 400 for already-committed work.
- A committed write with a lost reply and unavailable recovery returned 500.

The inherited uncommitted 409/503 patch fixed five of these. Reused it, then bound
both the conditional write and recovery read to existing `accepted_at`, and
preserved the recovery read's error as 503. Reused the route's existing recovery
helper and the existing lifecycle test harness. No table, migration, RPC, service,
screen or test file was added. The older conclusion that same-worker free-task
reassignment needed no repair is superseded by this reproduced race.

Final evidence: **12 HTTP cases plus exact cleanup pass (13/13)**, **229 lifecycle
regressions pass**, and backend privacy gates pass. Lost-reply retries keep the
saved timestamp; two concurrent HTTP starts produce one stored transition and
one stored notification; foreign/replaced workers are refused. The notification
writer is real, while push/badge/socket delivery is stubbed. Identity and transport
faults are synthetic. These new HTTP checks cover free gigs on the retained older
schema; paid provider and full UI acceptance are not implied. No schema was changed.

The two preliminary private harness attempts overlapped their own fixtures; their
results remain recorded as invalid attempts. Final runs are sequential, with
ownership checked before seeding and exact cleanup afterward. The four newly added
unit checks first fail against the inherited patch (225 pass/4 fail), then all 229
pass after the repair. Earlier failures are not relabeled passing.

## Native verification correction and current follow-up

Discarding a response and refetching does **not** establish stale/invalid-result
safety. The earlier source-reading conclusion is withdrawn. Android emitted
"Task started" for any successful decoded response. iOS still decodes
`EmptyResponse` and its caller treats a nil error as success even when silent
refresh fails; it needs its own baseline and repair.

Six distinct Android baseline tests reproduced five defects: invalid receipts,
duplicate pending requests, and late results after session change, departure or
reassignment. The ordinary valid case passed. Gradle retried the five failing
cases, producing 16 recorded executions; these are five distinct failures.

The Android candidate reuses the existing session/read-scope guard and the existing
view-model. It retains one pending start, checks the current assignment and saved
receipt, and retires callbacks on departure or assignment replacement. A stale
failure cannot clear a newer request. The existing screen and controls are
unchanged. The final functional suite passes **54/54**, and **ktlint and detekt pass**
after extracting the receipt predicate into a small helper in the same file. The initial complexity failure remains a
failed attempt. Repository responses and identity are mocked in these JVM tests;
**no installed native journey is accepted by this result**.

## Reused evidence, limits and next action

- Accepted web Start Work component, SDK and regression source is unchanged from
  `c9cb69825`; reuse its [browser evidence with the original synthetic HTTP/auth
  limits](https://github.com/WangPantopus/skinny-pantopus/blob/b4b783f8d42027e22c113a3cfd301f5eb7b4c54b/docs/VERIFICATION_FIRST_2026-09-13.md#existing-web-start-work-control).
- The [prior Start Work record](https://github.com/WangPantopus/skinny-pantopus/blob/82025bc092d09fd288a9a462ca48d5ebbc67fd3f/docs/workstreams/01-gigs-payments.md)
  retains the original `f437dfd20` paid/free evidence and old schema/provider
  limits. Its native acceptance and same-worker-race conclusions are superseded
  above. Prior private artifacts that were not available in this resumed session
  are not claimed as newly inspected.
- The backend binds the assignment observed by its own initial read. A request
  based on a client assignment already stale **before** that read needs further
  verification; neither this patch nor the original web guard proves that scope.
- iOS invalid/late callbacks, both installed native journeys and real provider
  authorization remain open. Native JVM success and green CI are not end-to-end
  acceptance. Cancellation/no-show fee payer/recipient policy is still unspecified.
- Next: verify iOS and the installed Start Work
  journeys, including the stale-client assignment boundary, before claiming
  native or P04 completion. No feature merge while scope
  is unfinished.

## CI, runtime and coordination

- Prior [CI35046049526](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35046049526)
  on `959e147e6` passed 15 applicable checks/one Seeder skip.
  Backend [CI35048472265](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35048472265)
  on `599de1586` was superseded and cancelled by the new push; its aggregate
  check reported failure on cancellation, so it is not a green result. Current combined
  [CI35049746982](https://github.com/WangPantopus/skinny-pantopus/actions/runs/35049746982)
  on `41c75d49a` passes15 applicable checks/one Seeder skip. Do not treat a prior
  source’s CI as final-head evidence.
- PostgreSQL64522/API64521: only exact owned synthetic rows were written. Three
  users, one gig and its notifications are removed; final remaining count zero.
  The private HTTP listener is closed. No container/schema/database reset, cache
  cleanup, physical device or simulator mutation. Heavy native build slot is
  **released** after the successful Android test/static run. No new device
  reservation remains.
- Private scripts, results, source hashes and failed attempts:
  `/private/tmp/pantopus-p04-start-20260915-r1`, mirrored to the owner’s private
  `.pantopus-recovery/audits/20260915-p04-start-r1`. Keep raw logs/credentials outside Git.
- Stream2 handoff reviewed at `70e079543`: browser slice only, SQL decision boundary
  simulated, broader M02 open. Source review leaves token/Home transitions and
  old revoke callbacks as **unreproduced leads** to verify before merge: existing
  content is not cleared on scope change, and a late revoke calls its captured
  old-Home loader. Stream2 owns that follow-up; no peer source was edited here.
- Stream3 pushed `dfc860bfe` in draft PR51. Coordinator inspected source and
  private test/persistence artifacts:42 backend,10 web,13 Android JVM,13 iOS model,
  and9 HTTP/SQL cases pass within synthetic auth/older-schema/intercepted-delivery
  limits. Its installed iOS phase is underway; no full native/N04 acceptance.
  Android CI fails ktlint indentation before later Android gates. The new SDK
  application file and an unreproduced profile-navigation callback lead were sent
  back for author reconciliation. See the [shared review](../VERIFICATION_FIRST_2026-09-13.md#existing-profile-safety-and-blocked-user-journeys).
  Stream3 remains sole writer for blockService, direct-chat socket handlers,
  chats.js and bounded Jest inclusion; paid private-gig helper/export are separate.
  Its exclusive native slot and isolated simulator `0AE16FA0-E244-414F-86C8-24893BDFD979`
  remain reserved. HTTP18130/web18131 and three `f9150300` fixture users are active.
  Earlier exact cleanup reports zero between phases; final cleanup is still owed.
  No schema/reset/cache changes, REST18089 or existing/physical-device install are
  granted. Preserve the owner iPhone17 and other acceptance devices.
- Stream2's SDK guest-status type widening and Stream3's additive SDK exports
  conflict with no Stream1 change. Neither peer branch is approved for merge.
  Their uncommitted live status updates are preserved and not staged by this task.
