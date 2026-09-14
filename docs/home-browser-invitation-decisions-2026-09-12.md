# Browser Home invitation decisions — September 12, 2026

The authenticated invitation page now retains one encrypted original decision per
API origin and account before submission. Accept and decline require explicit
confirmation of reviewed invitation terms. Interrupted replies, cold starts,
failed reads and cancellation recover that exact original. A second link cannot
replace it. Public preview and login/registration preserve the invitation target.

Historical acceptance is separate from current household access. Open Home checks
current access again, acknowledges the retained proof, then navigates. Done
acknowledges a completed decision and returns to My Homes. Removed or denied
membership cannot be restored by reading an accepted receipt. Signing out keeps
the earlier account's original protected; returning through sign-in retains the
invitation destination. Session, visibility and page changes retire stale reads,
confirmation callbacks and navigation results.

## Actual acceptance

Final Chrome r3 passes production HTTP routes, SDK and SQL with six decisions:
three accepted, one declined, one cancelled and one rejected. Every original is
acknowledged at the end. Actual scenarios include unavailable/malformed context,
first protected-write failure blocking POST, proof-write repair without another
POST, lost acceptance/decline replies across restart, failed cold read, unseen
cancellation, wrong-account isolation and switchback, explicit deny and later
removal, changed reviewed terms, acknowledgement failure and committed clear with
lost callback, and a held acceptance response retired after another link opens.
A same-account session refresh while confirmation is open prevents the old
confirmation from submitting. Explicit sign-out and sign-in return to the same
invitation. An open Home navigation reaches the actual member dashboard.

The protected slot contains only an AES-GCM envelope with a 12-byte IV and a
nonextractable 256-bit key. Compare-and-write prevents a different tab from
replacing or erasing an original. Browser diagnostics contain neither invitation
tokens nor Home API exchanges. Narrow 390×844 recovery, current-access and
sign-in-return screens were visually reviewed.

Web regression: **93 suites / 1,193 passed**. Final types, changed-surface lint,
privacy gates and diff checks pass. Browser r1/r2 also passed their bounded
scenarios; r3 adds the final session-confirmation and sign-in-return acceptance.
All three exact fixture runs are cleaned: complete role rows and ledger preserved,
exact function definitions/properties preserved, and owned commands removed.
The command migration was temporary within each fixture, without ledger adoption.

## Evidence and limits

Private evidence: `/private/tmp/pantopus-home-browser-invitation-decision-r1/`.
The `browser-r3/result.json`, screenshots, encrypted-storage inspection, command
observations and source/evidence digest bind the accepted candidate. Fixture
cleanup is recorded independently in each `fixture-r*/cleanup.json`. Raw token
capabilities, browser profiles and operator logs remain private and out of Git.

The fixture uses synthetic accounts and controlled authentication/delivery around
real production routes, SDK and SQL. It does not certify live email delivery,
provider authentication, physical devices, every browser/accessibility combination
or full member-dashboard services. The isolated dashboard's Home-help read has a
retry error because HomeGig is outside this fixture; dashboard entry alone does
not close that service's acceptance. Native invitation recovery, invitation
creation/resend/cancellation/delivery and complete member onboarding remain open.
H07/H08 remain partial: **7 of 80 acceptance rows closed, 73 partial/open**.
These counts do not measure app completion or remaining effort.

## Git and continuation

Predecessor `ab0a6644d56440f3504fc22e10023d5655fa5caa` has every job passing in
[CI 34712404106](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34712404106).
Browser source milestone `b638389e16880629f67bcb1c7de9fba885ad3e7b` binds nine
sources and 29 private evidence anchors. Push it with the documentation checkpoint
and verify the new head separately. Native invitation work remains an unaccepted
local candidate with first build/installed checks in progress.
Fetched master remains `6a1013784db69bf339535a2f4b33b328f2bbf40c`. #32 is an open
mergeable draft and #34 an unfinished conflicting draft. No merge. Migration
inventories remain **44 Home / 21 paid / 53 combined**, 12 identical shared
versions and zero collisions; combined replay/adoption remains open.

Continue with both native resolvers and protected original decisions, then
truthful invitation delivery and ordinary-member onboarding, legacy compatibility
and the full backlog. Paid services remain one final launch bundle. The physical
iPhone remains 1.0.0 (2); no native build/device update is part of this milestone.
Owner work, databases, devices, accepted artifacts and private evidence remain
preserved.
