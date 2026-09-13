# Browser reviewer history and combined residency cycle

September 13, 2026. The browser now offers a supported own-decision history after
review acknowledgement. Its list and exact detail show recorded decisions
separately from the current applicant/request reference and current household
access. See the [backend contract and acceptance](home-residency-review-history-backend-2026-09-13.md).

## Browser behavior

The residency claims and protected review screens link to **Your past residency
decisions**. History has its own current-session GET reader and does not reuse,
write or recreate an original command. It supports an exact receipt link,
20-item pages, older pages, explicit refresh/retry, returning to the current
request and separate recovery of an unfinished original.

The reader validates actor/Home/session, the safe item projection, all canonical
recorded roles, actual calendar dates, microsecond ordering and canonical
cursor bounds. Account, session, visibility and lifecycle changes retire old
content and pending publications. Failed refresh or pagination clears old rows;
only a successful empty response displays an empty history. Delayed replies
cannot overwrite newer authority or error state.

Actual visual review found the floating Messages control covering a decision
card on a narrow screen. History now keeps Messages in the app header and omits
that floating control. Recovery and refresh actions have explicit wrapping and
spacing. Installed Chrome checks at 320px and 390px verify unobstructed list,
detail and failure/retry states, separate action rectangles, minimum 44px action
heights and no horizontal overflow.

## Actual reader continuation

The reader uses the same HTTP-created population of 23 first-reviewer decisions
and one independent-reviewer decision. Actual normal browser login opens 20
rows; Load older decisions produces exactly 23 in SQL timestamp/UUID order.
The oldest own exact detail loads. A real 503 displays failure and Retry, with
no old rows and no false empty state. Retry obtains fresh history. Normal
account switching exposes only the second reviewer's one decision.

For current authority, the fixture holds the actual serialized successful list
response after real route/SDK/SQL execution. A separate, normally authenticated
owner uses the shipped permission endpoint to deny review authority. A
controlled browser focus event triggers a newer request and real 403. Releasing
the old 200 cannot replace that denial or restore rows. Actor/session, exact
known request path, held/released body digest and byte count, and actual finish
order are independently checked. The focus signal is not independent OS/window
focus acceptance. Restoring permission through the shipped endpoint permits a
fresh read, and a cold browser/account return again shows only the original
reviewer's own history.

This final reader run records 31 history responses with real no-store headers
and no browser errors. It makes zero history mutations. Explicit permission
setup may update an owned override and legacy occupancy flags/version; those
changes are not described as read-only. Every history-only interval preserves
the owned claims, memberships, originals, decisions, audits, grants and notices.
The later narrow-layout follow-up creates zero commands and preserves that
same domain state.

## Fresh full applicant/reviewer cycle

A separate fixture starts with zero claims and command/decision receipts. The
actual browser journey performs:

1. Applicant selected-address submission, saved confirmation and pending status.
2. First reviewer rejection, acknowledgement that clears the local original,
   then supported own-history list and exact detail.
3. Applicant resubmission through the real address flow, reusing the claim but
   creating a new protected submission. The prior decision and original remain
   unchanged. The first reviewer's old rejection now separately shows the
   current request waiting for review.
4. A second reviewer's approval and acknowledgement, followed by only that
   reviewer's own approval history. The applicant checks current access and
   explicitly enters the Home.
5. The owner's protected member removal and acknowledgement. Cold applicant
   login retains the review record but shows **Household access needs review**
   and no Open Home action.
6. Cold reviewer return retains the saved approval, explicitly without current
   access proof. Each reviewer can read only their own decision; both attempts
   to open the other reviewer's exact receipt return actual 404 and show no row.

The final state has one claim, two protected submissions, two immutable
independent review decisions and one completed protected removal. All remain
unchanged through subsequent history reads. The cycle records 59 history
responses, including both foreign-receipt refusals, with no-store headers and
zero browser errors. It does not attempt renewal or needs-more-information.

Both the shared populated-reader fixture and this fresh cycle finish with exact
374 candidate/366 retained table and logical-schema restoration, all five cleanup
flags, process exit 0 and a closed API port. Their databases, source products,
failed attempts and private evidence are retained. Authentication, unrelated
app-shell responses and providers are controlled; Home routes, SDK and SQL are
actual. Browser routing disables HTTP caching, so this does not establish an
independent stored-cache behavior claim.

## Source checks and preserved failures

The reader/model/view source passes 52 focused checks, the complete 1,312-check
browser regression in 102 suites, typecheck and focused/entry lint. The later
two-file visual repair changes widget visibility and action layout only; its
52 focused checks, typecheck, zero-warning lint and actual 320/390px checks pass.
The full regression result remains explicitly bound to the earlier layout;
the new pushed-head CI must be verified separately.

Reader attempt 1 stopped before authority setup because private held metadata
used a router-relative path while the assertion expected the full URL. Attempt
2 preserved the corrected path checks but encountered an ambiguous global alert
selector: Next's route announcer and the actual permission-denial alert both
matched. Both failures and their screenshots/state are retained. Only the
obsolete owned held read was discarded between attempts; actual owner authority
restoration was used when needed and the same 24 decisions were preserved.
Attempt 3 scopes the product alert to the named history landmark and completes
the actual held-success case. These were private driver repairs, not changes to
the history service or reader logic. The fresh cycle uses that known alert
scoping correction before its first run.

Root review independently verifies 70 reader/layout artifacts and 104 fresh-cycle
artifacts, actual held-response ordering, privacy/no-store responses, visual
screens and both cleanup pairs. The default fixture's first raw snapshot
comparison reports 37 changes confined to pre-documented PostgreSQL relation
maintenance fields; the diagnostic remains preserved and all logical values
match after only those established exclusions.

Private evidence is under `/private/tmp/pantopus-home-residency-cycle-r1/`, with
source/test evidence also under
`/private/tmp/pantopus-home-residency-review-history-web-r1/`. The operator index
binds the durable `residency-cycle-20260913/history-backend-browser-r1/` copy and
the exact committed/pushed source and CI. No private bodies, tokens or row
snapshots are committed.

Native history and native combined-cycle parity remain separate installed gates.
The current claims queue still exposes the independently observed excessive
projection and has failure/lifetime gaps; its repair is next. Broader onboarding,+renewal, needs-more-information, paid integration and launch readiness remain
open. This bounded milestone does not close another acceptance row.
