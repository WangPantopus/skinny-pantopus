# Members removal and lost-reply baseline

September 13, 2026. These are actual backend and browser reproductions against
unchanged removal source at `767fbb2278774bcd092f2e1b425cc43325bda8a9`.
The repair and installed native acceptance remain pending.

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
request removes the member. Shipped invitation preparation then refuses with
409 `MEMBERSHIP_RENEWAL_REQUIRED`. The held original is discarded before RPC.
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

Earlier failed attempts remain recorded. Backend r1 stopped after a real lost
committed reply because its private driver expected the audit target to be the
user UUID; the real target is the occupancy UUID. Browser r1 stopped before any
removal because its heading locator matched both the page and member group.
Corrected r2 drivers preserve these distinctions; no failed run is relabeled as
complete acceptance. Every fixture restores all 366 populated tables, original
role rows, full ledger and exact function/schema provenance, then stops its
owned server. No migration is adopted and no physical device is changed.

Read-only native preparation also records transport limits. iOS treats DELETE
as idempotent and retries transient failures twice; a future installed baseline
must count one confirmation separately from up to three HTTP/SQL attempts.
Android's complete 503 without `Retry-After` is not automatically retried, while
some connection failures have separate OkHttp behavior. These are source-derived
expectations, not installed removal acceptance.

Next: finish the retained native baselines and implement a reviewed original
removal with recoverable outcome, current authority and target membership
fencing. Legacy terminal retries must not repeat side effects or consume later
legitimate access. Historical results remain separate from current membership.
Do not promise renewed membership or broaden ownership/self-leave behavior
without its own actual proof. R03's applicant/reviewer history and broader
lifecycle remain open; sender withdrawal and H07 fixture-controlled removal
remain separate accepted subjourneys.

Private working evidence is under `pantopus-home-member-removal-r1`. Durable
backend/browser source, failure, result and cleanup evidence is indexed in the
`member-removal-20260913` sibling of the invitation handoff evidence directory.
Raw credentials, capabilities, SQL snapshots and operator logs remain outside Git.
