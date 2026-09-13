# Members removal and lost-reply baseline

September 13, 2026. Backend/browser reproductions bind unchanged removal source
at `767fbb2278774bcd092f2e1b425cc43325bda8a9`. Both installed native baselines
now pass against the same retained H07 app source at `d3c3e0f`; the later R02
commit changes no native app or removal behavior. The later protected
[backend](home-member-removal-recovery-backend-2026-09-13.md) and
[browser repair](home-browser-member-removal-recovery-2026-09-13.md) are now
locally accepted; native product/installed acceptance remains open.

The production DELETE ends household occupancy and scoped grants, removes
permission overrides, revokes issued residency letters and writes an audit.
Claims and prior review receipts remain historical evidence. The retained
`mutate_home_member` body exactly matches accepted migration `20260910013000`.
The older shared UI fixture stubs its service; this baseline explicitly enables
the real route, service, local Supabase SDK and SQL, with controlled
account authentication and no provider delivery.

Backend r2 passes four HTTP DELETE attempts and three actual committed removal
RPCs. Target 1's first removal commits and loses its reply, returning 503.
Repeating the same DELETE returns 200 but adds a second removal audit and rewrites
occupancy and scoped-grant timestamps, including an already-ended grant.
Existing claims/review receipts and already-revoked letters remain unchanged.

For target 2, a held original DELETE has not reached SQL when another authorized
request removes the member. Shipped invitation preparation succeeds; the actual
sender command then refuses with 409 `MEMBERSHIP_RENEWAL_REQUIRED`, retaining
one rejected sender original. The held DELETE original is discarded before RPC.
No re-admission is forced, and deletion of a newly admitted membership is not
proved. The iOS confirmation's promise that the person can be re-invited later
is therefore unsupported by this actual flow. Separate renewal work must not
be silently replaced by synthetic fixture restoration.

Browser r2 uses normal controlled sign-in and the actual 390px Members page.
Cancel issues no DELETE and preserves membership/audits. One named confirmation
issues one DELETE, one successful SQL removal and one audit. The lost committed
reply leaves the member visibly listed with a could-not-confirm error. Explicit
page reload shows the actual remaining two members, with no second DELETE.
Root visually checked both states and verified all source bindings. No current
browser 503 retry is configured in this API path.

The frozen private backend report incorrectly described the renewal refusal as
context rejection with no sender command. Its original HTTP events and driver
prove context 200 followed by command 409. A separately bound correction retains
the original evidence; the refusal and absence of re-admission remain valid.

Earlier failed attempts remain recorded. Backend r1 stopped after a real lost
committed reply because its private driver expected the audit target to be the
user UUID; the real target is the occupancy UUID. Browser r1 stopped before any
removal because its heading locator matched both the page and member group.
Corrected r2 drivers preserve these distinctions; no failed run is relabeled as
complete acceptance. Every fixture restores all 366 populated tables, original
role rows, full ledger and exact function/schema provenance, then stops its
owned server. No migration is adopted and no physical device is changed.

Android's installed retained signed APK proves Cancel with zero DELETEs, then
one named confirmation, one DELETE, one successful removal RPC and one audit.
The complete committed 503 has no `Retry-After`; the client silently restores
the removed member row. A failed current roster read retires its controls, and
an explicit successful read shows the target gone. The removed account's fresh
My Homes shows zero saved Homes beside its retained review history. Initial
Android ui-r1 stopped before DELETE because the driver expected a raw name;
ui-r2 uses the observed username. Both attempts remain in the evidence.

The installed iOS H07 app proves Cancel with zero DELETEs. One confirmation then
produces three DELETEs, three successful RPCs, three lost committed 503 replies
and three removal audits because its default transport retries transient DELETE
failures twice. It silently restores the old row. Current roster 503 remains
an error across tab changes; explicit read retry shows the target absent without
another DELETE. One already-ended grant retains its original end_at value,
but both target grants have updated_at rewritten. Intermediate per-attempt grant
timestamps were not captured by this native run. A misleading zero-member count
during an unavailable list is also recorded for repair.

The iOS runner was compiled separately against the exact accepted app; no app
build or physical-device install was needed. Root independently verified all
679 accepted app files, Android's retained APK, 1,042 Android/backend source
files against committed d3 plus five private driver files, both five-flag
366-table cleanups, and 90 Android/337 iOS durable evidence files. Android's
transport caveat remains: some connection failures have separate OkHttp retry
behavior; the accepted complete 503 scenario is one request. Both owned devices
are stopped with app and userdata retained. A later protected candidate is a
separate source/product/installed boundary.

Next: finish native product and installed acceptance of reviewed removal
originals. Backend and browser recovery with current authority and semantic
membership versions pass their separately bound acceptance. All three native/browser
baselines are complete; do not repeat them. Legacy terminal retries must not
repeat side effects or consume later legitimate access. Historical results
remain separate from current membership. A transactional populated upgrade
must preserve old column values; committed candidate acceptance uses an isolated
database so the retained database keeps its exact column/catalog provenance.

Do not promise renewed membership or broaden ownership/self-leave behavior
without its own actual proof. R03's applicant/reviewer history and broader
lifecycle remain open; sender withdrawal and H07 fixture-controlled removal
remain separate accepted subjourneys.

Private working evidence is under `pantopus-home-member-removal-r1`. Durable
backend/browser/Android/iOS source, failure, result and cleanup evidence is indexed in the
`member-removal-20260913` sibling of the invitation handoff evidence directory.
Raw credentials, capabilities, SQL snapshots and operator logs remain outside Git.
