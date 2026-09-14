# Browser member removal recovery

September 13, 2026. Source prepared on top of committed/pushed `d3c3e0f`.
The [actual four-platform baseline](home-member-removal-baseline-2026-09-13.md)
is complete. The browser repair below passes actual production HTTP/SDK/SQL/browser
acceptance against the separately owned candidate database. Integrated exact-head
CI and native acceptance remain separate gates; earlier green CI does not verify
this later removal source.

## Behavior

Members, the dashboard's member details, My Homes Leave and both verification
self-leave entrypoints now open a dedicated
removal page. The server supplies a fresh authorized review of the selected
Home, username, role and access dates. Cancelling that review sends no command.
The page preserves primary-owner transfer and separate ownership-flow refusals;
it no longer promises re-invitation of an ended membership.

Confirmation first saves an encrypted original under the API origin and actor.
It retains the exact serialized request bytes, UUID, occupancy identity, reviewed
display summary and prepared decision hash. IndexedDB compare-and-write protects
the slot across tabs. Corrupt storage is kept and cannot look empty. An uncertain
initial write prevents dispatch and requires reopening the saved slot.

Explicit check, retry, cancellation of an unseen original, and acknowledgement
use that same original. A completed removal wins a cancellation race. A read's
unknown result is not cancellation proof. Every accepted receipt must match all
original identities, decision hash, live session and state/status/timestamp
rules. Required nulls, enum values, dates and canonical roles are validated.
Raw account names cannot replace the household username projection.

Receipt persistence failure can be repaired without posting another removal.
Acknowledgement only clears the matching durably saved terminal result. The
page stays reachable from My Homes even if the Home/member row or management
authority has disappeared. Foreground, account, session, origin and page
lifetimes retire old replies and reviews while keeping the protected original.

Current roster checks are separate from historical results. A denied or failed
read leaves current membership unknown. A delayed old success cannot overwrite
a newer failed or changed read. The Members page also clears stale rows and
management controls before refresh; unavailable data is not displayed as zero
members. Neither historical removal proof nor acknowledgement deletes a current
cached Home/member row. Current navigation performs its own authorized read.

Inline confirmations focus their review text, support Escape before submission
and keep a visible Cancel action. They are marked as nonmodal confirmation
regions, with the selected username visible and wrapped on narrow screens.
Actual Chrome review and recovery screens pass at 390px, with a 320px review
and unobstructed confirmation hit target. The floating message panel is suppressed
on this focused route after the first run exposed text overlap; Messages remains
in the app header, and the panel remains available on My Homes. Escape cancels
review and restores focus. Broader screen-reader, browser-zoom and release-build
accessibility acceptance remain U02/U05.

## Verification and remaining gates

The current browser regression passes 1,260 checks in 100 suites. The removal
checks cover canonical role display and management-control gating, exact-byte cold recovery,
named Cancel/Escape without mutation, lost/foreign/malformed proof, failed
original/receipt/acknowledgement storage, independent current reads, stale reply
ordering and account/session/origin retirement. TypeScript passes with no errors;
new removal source has no lint errors or warnings. The full existing source lint
reports no errors and 1,107 warnings; the expanded removal/verification path
check has no errors and seven existing waiting-room type warnings. These local results include the latest
username-only review, named entry actions and read-envelope binding. The final browser run binds this source; integrated exact-head CI remains pending.

Actual Chrome candidate r2 passes normal controlled login, named Members review,
Cancel/Escape with zero commands, primary-owner transfer refusal, a committed
lost reply, different-account isolation, process restart and fresh same-account
login. The repeated original uses one UUID and byte-identical HTTP body across
two session sequences, with one saved command and one audit. Real IndexedDB
contains encrypted envelopes with nonextractable AES-GCM keys.

Five originals finish as two completed, one cancelled and two rejected, all
acknowledged. Unseen cancellation records a tombstone before a held submit is
released; it produces no removal or audit. Actual supported role changes A→B→A
invalidate the old review. An actual permission denial produces a recoverable
rejected receipt, which remains rejected after another authorized owner restores
permission. Neither case removes the member.

Historical completion stays visible beside a failed current roster read. A later
fresh roster confirms the removed target is absent. Ordinary self-leave through
My Homes also loses its committed reply, then recovers from My Homes after a cold
new login with no current Home access. Its roster returns forbidden while the
historical result remains accessible. Fresh My Homes displays the retained
residency request separately and no saved Home or Leave button. There are no
legacy DELETE/move-out requests, fabricated re-admissions or current-membership
cache deletions. Existing claims and all four reviewer receipts stay unchanged.
Controlled initial-review notices are preserved; the lost self-leave RPC reply
causes no additional notice admission. The separate backend proof establishes
best-effort first-response notification behavior, not eventual delivery.

Candidate r1 already passed the same functional five-original journey; root
visual inspection found the floating message button could cover recovery text.
R2 binds its focused suppression and the 320px check. Both functional runs and
all screenshots are retained. Root inspected final review, uncertain completion,
cancellation, current-read failure, self-leave history and fresh My Homes.

Both fixture cleanups pass all five preservation flags across all 374 candidate
and 366 retained tables, complete role rows, ledger, functions and logical schema
provenance. Physical PostgreSQL maintenance counters are excluded as documented
by the backend. Both owned HTTP servers and Chrome instances stopped; browser
profiles, database and PostgREST runtime remain retained for the native lease.
No physical iPhone was used.

Malformed/foreign proof, corrupt/failed storage, queued-write fencing and late
current-read ordering have focused automated coverage; this browser run does not
claim each of those injected cases as actual HTTP/UI acceptance. Authentication,
shell and delivery are controlled. Waiting-room/Verification Center routing is
component-tested; their pending-applicant leave journey remains in the broader
combined R03 lifecycle. Provider signup, hosted adoption, release web
build, the paid/Home migration union and wider R03 lifecycle remain open.

Private working evidence: `pantopus-home-member-removal-r1/browser-ui-candidate-r1`
and `browser-ui-candidate-r2`, their separate `browser-fixture-candidate-r*` proofs,
`web-*` checks and `browser-candidate-preparation` source/driver bindings. Durable
source, screenshots, results, exact cleanup and verification limits are indexed
under `member-removal-20260913/browser-recovery-r1` in the operator recovery area.

The primary integration also passes all 1,260 browser checks, TypeScript, backend
privacy gates and deployment/database/staging safeguards. Its 25 backend/shared
files match the final accepted backend binding. The actual browser r2 binding
precedes the shared API index's new unused removal export; the integrated check
run covers that source difference. This is not a claim that a later native
candidate or production web build was installed during the browser run.
