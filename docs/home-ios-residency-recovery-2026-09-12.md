# iPhone existing-Home joining and personal status — September 12, 2026

Accepted local milestone after `022e3c086b60e3b75dadd11812ab75848776fb21`.
The installed checks below are on the owned simulator. The physical iPhone stays
on the separately verified Pantopus 1.0.0 (2); no device update or hosted rollout
is part of this work.

## Resulting behavior

Existing-Home joining retains the original request UUID, Home, complete selected
street/apartment and ordinary residency role in the same account/origin-scoped,
this-device-only Keychain slot as new-Home creation. A failed protected write
blocks submission. Reopening checks the original command; an unknown result can
be checked, retried exactly or cancelled through the server before editing.
Completed/rejected/cancelled outcomes require matching actor, command, Home and
record identities. Recovery never grants access or requests a postcard.

Both My Homes entries lead residency applicants to personal status. The list
reads the person's own submitted-address history separately from current Home
access, preserves requests after removal, and supports all 50-row pages with
explicit retry/load-more controls. A failed history read does not erase usable
Home entries, and a failed Home read does not erase personal request history.
Rejected requests say “Request not approved”; historical approval says “Review
recorded.” Neither label asserts current household access. Missing identities
use distinct request references; unlinked history explains its missing Home.

Status distinguishes household review, address verification, ownership review,
resubmission, access review and an unavailable Home. It shows the submitted
address rather than current private Home details. Navigation is permitted only
by the latest validated status. Refresh, background, disappearance and account
changes remove old data/actions and retire delayed replies. The `/homes/:id/residency`
notification link also opens this status surface.

Actual resubmission exposed the existing-Home dialog propagating its parent
accessibility identifier over both buttons and the address label. The dialog
now contains its children and identifies itself as modal. Its wording says the
address has an existing Home; an active occupancy alone is not evidence of
verified members.

## Verification

Signed simulator build r8 and strict/deep code-sign verification pass. All changed
Swift sources pass formatting and strict lint; the final modal correction passes
its own style check. Final privacy gates pass. The accepted products are preserved
in `/private/tmp/pantopus-home-native-artifacts-after-ios-residency/Products`.

Installed r3 passes four actual UI/HTTP/SDK/SQL journeys: delayed-submission
cancellation/restart (100.287 s), changed-apartment refusal (72.940 s), original
lost-result recovery with sustained failed/malformed reads, retry, later removal
and held-reply retirement (124.420 s), and complete personal history beyond
50 rows with failed-read recovery (45.927 s). R3's fifth case found the modal
accessibility defect described above. Its targeted r4 rerun passes on final r8
(73.213 s), reusing the rejected claim/occupancy while preserving restricted role,
age and future dates. This is five accepted journeys across r3/r4, not a claim
that the earlier r3 bundle was entirely green.

The existing installed creation regression passes all three cases on final r8:
cancellation/restart, lost-commit recovery, and optional-access refusal followed
by correction and a fresh original request. Full iOS regression r3 passes
**4,372 checks, zero failures, 168 skips (4,540 total)**.

The first full regression found nine failing cases around auth and notification
routing after the fixture stopped while the owned simulator retained a synthetic
session. API tests that fall back to the global auth manager saw a transport
failure; the live app could also consume notification routes. The same compiled
products pass with the controlled loopback fixture active. No production auth
behavior or assertions were weakened. This remains a local test-environment
dependency; the report does not certify those tests as independent of app/session
state. R2 was only a failed runner setup (missing output file); r3 is the completed
passing rerun. The optional push-disable flag was not applied to the version-1
runner; simulator registration attempts stayed on loopback, with no device push
or provider delivery acceptance.

Private evidence uses `/private/tmp/pantopus-home-ios-residency-`: build
`build-r{1..8}.log`, `ui-r3.xcresult`, `ui-r4.xcresult`, exported summaries and
attachments, `create-regression-r1.xcresult`, `regression-r{1,3}.xcresult`, and
`fixture-r{1..3}.{json,log}`. Visual review includes rejected and removed-request
cards, household-review status, selected apartment/role review, and the successful
resubmission confirmation. Source/evidence hashes remain private.

Earlier build r1 found a fileprivate helper reference; r2 found an invalid theme
color name. Both were corrected. Build r3 compiled but disabled simulator signing;
its installed run stopped at authentication with missing Keychain entitlement.
Signed builds restore authentication. Installed r2 reached actual recovery, but
its one-time injected outage was transparently retried by networking; that did
not exercise an unavailable screen. The fixture now supports an explicit
persistent read fault, cleared only by the acceptance driver. Existing default
single-fault behavior is preserved.

All three owned fixtures cleaned their exact synthetic records and temporary
command schema/functions, preserving the migration ledger at `20260910220000`.
No active fixture or held request remains from this milestone.

## Remaining scope and preservation

Android joining is being implemented independently and has an initial successful
Kotlin/app-test compilation. Android personal status is in progress; its complete compilation and installed
acceptance remain open. Both native postal/prepared-review flows, invitations, complete
private/ordinary-member first use and legacy-client compatibility remain open;
H07/H08/R01/R02 are not closed. Actual creation records also expose the next H08
gap: a new private Home has no residency claim or verified occupancy, and its
native list only offers private tasks. It needs a truthful verification entry;
ordinary users must establish the selected-address request before mail, while
ownership remains a separate review. The postal link currently leads to the older,
unaccepted native screen. Broader accessibility, provider delivery and lifecycle
combinations remain explicit acceptance limits.

There is no new migration. The Home/paid/combined source inventory remains
43/21/52, with 12 identical shared migrations and no timestamp collision;
combined replay/adoption is separate work. The pushed predecessor's entire
[CI run 34683643763](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34683643763)
is green. The new native source has not yet been committed or given its own CI.
Both PRs remain drafts; no merge, hosted release or paid activation occurred.
Owner work, physical devices, database archives and private evidence are preserved.
