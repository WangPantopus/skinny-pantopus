# iOS protected member removal and self-leave — September 13, 2026

The installed iOS app completes five protected removal originals through normal
login, reviewed UI and actual HTTP/SDK/SQL. All five originals are acknowledged,
the owner and departed member recovery slots are empty, and the fixture is
exactly cleaned. The subsequent current-reader repair also passes focused/full regression and
installed before/after dismissal acceptance using one separate original.

## Product behavior

Members → Remove and Home Settings → Leave this home use a prepared server
review and one account/origin-scoped original in device-only Keychain storage.
The original contains the exact request bytes and reviewed Home/member/occupancy
identity. Only explicit confirmation submits it. Check, exact Retry, unseen
cancellation and acknowledgement preserve that original across reply loss,
normal new login, restart and account changes. Another account cannot recover
its private target. The server rechecks current membership and authority.

Historical completion or refusal does not establish current Home access. The
original remains recoverable after self-leave, without requiring access to the
old Home. Removal never uses invitation withdrawal or the old DELETE/move-out
transport. Context and receipts strictly validate their shapes, session, actor,
Home, target, occupancy, effective role and original token. Unknown historical
self roles are allowed only with the server's explicit self relationship.

Confirmation uses a native alert with visible Cancel; the self action says
Confirm leave. This repairs the actual predecessor popover in which the safe
exit depended on outside dismissal. Local Cancel performs zero commands.

## Installed five-original matrix

| Original | Actual accepted result |
| --- | --- |
| Owner removes member1, held before RPC | Normal cold owner login recovers unknown status; explicit cancellation wins durably. Releasing the held submission returns cancelled without a membership write. |
| Fresh owner removal of member1, committed reply lost | Other account recovery is empty. Fresh owner login plus unavailable status read leads to actual Retry: the same UUID and raw-body SHA across two POSTs and different sessions; one SQL command, one removal/audit mutation, no replay notification/delivery mutation. |
| Owner removal of member2 after real Member→Guest→Member role changes | The old review is rejected as MEMBER_REMOVAL_CHANGED. The rejected command leaves membership and mutation audit unchanged. |
| Owner removal of member3 after real management permission denial | MEMBERS_MANAGE_REQUIRED is retained. A fresh owner login recovers the historical refusal despite current denial; a separately authorized existing owner restores the permission. |
| Ordinary member4 leaves from real Home Settings | A lost committed reply recovers from global My Homes after current membership ends. The visible alert names the self action and offers Cancel. The result is acknowledged, fresh My Homes has no current Home card, and the owner roster has no departed member. |

Aggregate: five command rows, two completed, one cancelled and two rejected;
six submission POSTs and one cancellation POST; zero legacy DELETE/move-out.
The final current-list/empty-original continuation adds zero commands and leaves
the complete owned SQL unchanged. The two completed removals produce two removal
audits. Claims, review receipts and ownership are preserved exactly; ended
occupancies stay in place. Previously ended grants and revoked letters remain
byte-for-byte unchanged; active credentials retire. Unrelated member rows and
credentials are preserved. This does not prove legitimate readmission or renewal.

The matrix is accepted across bounded continuations, not one uninterrupted
passing test. ui-r3 accepts cancellation and the committed loss, then stops on an
accessibility identifier assumption. The actual My Homes button exposes the
visible label Member removal recovery under its parent identifier. Driver-only
r7 continues the existing second original and accepts the remaining matrix,
then ui-r4 fails an invented zero-Homes banner expectation. The shipped screen
retains Review recorded history at zero current Homes. Driver-only r8's ui-r5
passes the fresh-current-list and empty-original checks without any new command.
All failed results and source/product distinctions remain preserved.

Earlier ui-r1 stopped on a pre-launch screenshot call and ui-r2 exposed the
missing visible Cancel in the old popover; both had zero commands. The first
focused unit run had one stale legacy test that expected optimistic deletion;
its setup now loads an actually empty current roster while the independent
review-only/no-DELETE assertions remain.

## Current-reader dismissal follow-up

A separate fresh fixture and the preserved app6 reproduce the source finding:
a reviewed removal commits, its reply is lost, and Close followed by tab changes
restores the removed member without issuing a fresh roster read. That is an
actual installed baseline, distinct from the older three-DELETE baseline.

Source-r9 retires Members and My Homes readers when removal recovery opens,
refreshes on every Close or interactive dismissal, and clears cached Members
rows, counts and management authority before each fresh read. Delayed-read,
suspension and error/retry regressions pass. The protected-command source is
unchanged. Recovery remains available independently of current reader authority.

The same original survives app6 → app9 installation with userdata and Keychain
retained, followed by normal new owner login. Actual Close starts a real held
roster read; Members/Guests/Pending tab changes show unknown counts and no cached
rows or manager actions. Interactive swipe dismissal starts a newer refused
read. Releasing the older real 200 response does not replace that refusal.
Explicit Retry recovers the current roster with the removed member absent. UI
acknowledgement and Empty recovery pass, as does a fresh My Homes read on Close.

The first fixed driver waited beyond the shipped 20-second request timeout
before releasing its held response. That response was abandoned; no delivered
old-success claim is made for that failed run. Its final raster still shows
current 503/Try again, unknown counts, no cached rows and available recovery.
Driver-only r10 separates full tab observation and the newer-denial race into
two short holds. Both real 200 replies release with exact matching body digests
and lengths, and the corrected continuation passes. No product change or full
suite repetition was needed for this driver timing correction.

This separate follow-up uses one deliberate original, one submission POST and
one removal audit. It adds zero commands after the original lost commit.
Complete owned SQL remains exactly unchanged through installation, current-list
reads and acknowledgement. Claims, review receipts and ownership remain exact.
The original is acknowledged and its recovery slot is empty. The accepted
five-original matrix is preserved separately; this is not another execution of
that matrix or another admission.

## Source, products and gates

The five-original command matrix uses app source-r6 and signed candidate-r6;
final driver source-r8 runs its preserved standalone runner. All 679 installed
app files match the accepted app clone. The matrix's full core run on source-r3
passes 4,425 checks and 168 skips; renderer-only alert r6 additionally passes 78
focused checks and actual named-Cancel interactions. The final reader source-r9
now passes generic app/runner compilation, 81 focused checks, and 4,428 full
checks plus 168 skips (4,596 total), with zero failures. All 16 owned Swift files
pass formatting, strict lint, diff and focused private-material checks.

Both candidate-r6 and candidate-r9 retain 715 signed app/runner files in verified
APFS clones; deep/strict signing passes. The app uses owned loopback API 18084 and
web 18080 only. Source-r9 binds 2,548 source/config/test files; its generated
project registration is recorded separately. Final driver source-r10 changes
only its dismissal timing sequence and uses a signed standalone runner. All 679
finally installed app files still match app9. Seven signed product files differ
from r6. The accepted five-original matrix and earlier failed products remain
intact. No loopback product was installed on the physical phone.

Units use the established explicitly signed-out preview and stubbed shared API
launch, with notifications disabled. They do not clear retained app credentials
or data. Fixture events lack user-agent attribution, so this is not a claim of
per-process packet capture. The separate installed journey uses normal UI auth
and actual routes, without synthetic permission grants or auth injection.

Private operator evidence: `/private/tmp/pantopus-home-member-removal-r1/ios-candidate-r1`.
Verified durable source, signed products, results and failed/predecessor evidence:
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/home-invitation-handoff-20260912/member-removal-20260913/ios-recovery-r1`.
`DURABILITY_MANIFEST.json` records selected file sizes/SHA digests and separately
preserved predecessor products. Root independently verifies installed/signed
bytes, SQL/HTTP counts, exact cleanup and critical native rasters.
The principal indices are five-original-verification-summary.json,
five-original-boundary.json, matrix-sql-http-verification.json,
verification-summary.json, dismissal-http-sql-verification.json,
dismissal-fixed-installed-final.json and reader-r9-delta.json. The five-original
fixture exits 0 after all five preservation flags pass: 374 candidate and 366
retained tables, catalog/function/role/ledger preservation, candidate DB retained.
The separate dismissal fixture also exits 0 with all five flags and the same
374/366-table preservation. Port 18084 is closed and the owned F9BB simulator is
stopped with userdata retained; the lease returns to root for scheduling.
Source-r9's offline unit gate also ends with only F9BB stopped and data retained.

This is bounded local iOS acceptance. It does not establish hosted migrations,
production release/rollback readiness, live notification arrival, renewal,
app-wide accessibility/layout correctness, or complete Home lifecycle/onboarding.
The ordinary Home Settings viewer-role/footer semantics remain separately
unverified; a header capture alone does not prove its unseen footer.
