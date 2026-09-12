# Browser Home invitation recovery — September 12, 2026

## Accepted bounded scope

The public browser invitation page now distinguishes an unavailable read from
an unavailable link. Failed and malformed responses offer Retry, clear stale
Home details and cannot offer acceptance. Expired, accepted and revoked public
previews have distinct screens; terminal previews reveal no household details
and make no claim about the viewer’s membership. Valid legacy null expiration
and Home type remain readable.

Reads are retired by navigation, visibility, focus, authentication changes and
cross-tab session markers. A late pending preview cannot replace a newer expired
result. Confirmation and mutation replies retain their original read lifetime;
a changed session cannot publish their success. Invitation access dates are
shown, the dark header has readable supporting text, and role copy no longer
promises full access or ownership. Login/registration explicitly return for review.

Decline must return a valid response before showing success. Failed decisions
keep both actions disabled until the invitation is rechecked. Acceptance checks
the returned Home/occupancy binding and reports only that acceptance was saved.
The former unconditional two-second dashboard redirect is removed; My Homes
checks current account access. Accepted public links also lead to My Homes,
without assuming that this viewer is the person who accepted.

## Actual acceptance and verification

The committed fixture uses production Home routes/services and real local SDK
calls into SQL. Only synthetic authentication, ancillary shell data, injected
failures and notification/email delivery are controlled. Four invitations are
created through actual HTTP, with emailSent false. No real recipient is messaged.

The baseline reproduces a valid pending invitation becoming “Invitation Not
Found” after a temporary read failure, without Retry. Final Chrome r3 (390 × 844)
passes unavailable/malformed retry, missing link, nullable legacy metadata,
failed decline followed by confirmed decline and cold revoked status, wrong
recipient denial, committed acceptance with lost reply and recheck, and
future-dated acceptance with no automatic navigation. A held real pending
preview released after expiration and a cross-tab lifecycle change stays retired.
Final SQL has exactly two acceptance audit rows, one decline audit row and two
recipient occupancies. No duplicate admission occurs. Narrow screenshots were
reviewed; an observed low-contrast header was corrected before final r3.

Browser regression: **93 suites / 1,193 passed / zero failures**. Final direct
TypeScript and changed-surface ESLint pass. Backend privacy gates pass. Browser
r1 stopped on a driver locator ambiguity with Next’s own route announcer, before
any decision committed; that locator was corrected. r2 passes, and final r3 also
covers the nullable legacy fields and final visual correction. The initial pnpm
test alias rejected its argument before running tests; direct Jest r2/r3 pass.

All three exact fixture runs are cleaned. Their complete role-row preimages,
full migration ledger rows/columns and exact function definitions, OIDs, owners,
ACLs and configuration match the originals. No schema adoption, new migration,
physical device update, native rebuild, hosted deployment or paid activation.
The physical iPhone remains 1.0.0 (2). Owner work and existing artifacts remain.

Private evidence: `/private/tmp/pantopus-home-invitation-recovery-r1/` — final
`browser-candidate-r3/`, final type/style/regression logs, privacy log and all
three fixture cleanup proofs. Capability files and operator diagnostics remain
private and must not be copied into Git or chat. Source/artifact binding is saved
privately after the milestone commit.

## Remaining work and Git checkpoint

This is a bounded browser recovery repair, **not closure of H07 or H08**. Full
account-bound retained decision recovery, authenticated historical decisions,
current authority destinations after removal/denies, open-link decline semantics,
complete sign-in/registration returns, native resolver/decision recovery and
creation/cancel/resend/delivery flows still need acceptance. Business seats and
guest passes remain separate scopes. Continue those next, then legacy submission
compatibility and the full backlog. Inventory remains 7 closed / 73 partial/open
out of 80; it is not a whole-app completion or effort percentage.

Fetched origin/master remains `6a1013784db69bf339535a2f4b33b328f2bbf40c`. #32 is an
open mergeable draft; #34 is a conflicting draft at
`e9ef2decbb7ec435589bb3b92639041cfc4618a6`. No merge. Private-first-use predecessor
`ff4c82609e37203031df32daa3a3a9378723b2d3` has backend, database, browser, all iOS
checks and Android instrumented checks passing in
[CI 34708716883](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34708716883);
Android lint/test/assembly is still running at this checkpoint. The workflow
cancels older runs when a new head is pushed, so finish that current run while
continuing useful local work, then push this milestone and verify its own CI.
Migrations remain 43 Home / 21 paid / 52 combined, with 12 identical shared
versions and zero collisions. Combined replay/adoption remains open. Paid
services stay in the final launch bundle.
