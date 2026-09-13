# iOS own-review residency history — September 13, 2026

The installed reader passes on the owned iOS 26.5 simulator. This is a bounded
reader milestone on the separate native-history branch, not yet integration into
PR #32. A separate fresh native applicant/reviewer cycle remains pending.

The six new actor-isolation warnings in the frozen candidate came from synchronous
test setup. Asynchronous setup removes them without changing production behavior.
The signed two-architecture rebuild has no history diagnostics; all 31 focused
checks pass. Full regression passes 4,459 checks, with 168 skips and zero failures.

Actual installed acceptance uses 23 rejection receipts for one reviewer and one
approval for the other, created through real HTTP/SDK/SQL commands in a fresh
isolated fixture. Native UI proves first-page and older-page reading, exact saved
detail, current-reference wording, normal logout/cold login to the other account,
unavailable versus empty, explicit retry, foreground refresh, and an empty local
review-recovery store independently of server history. Complete domain rows stay
unchanged during reader-only intervals.

The separate installed race phase holds actual serialized successful list and
detail responses after SQL, changes the second reviewer's current permission
through the authorized owner route, and observes a newer 403. Both old 200s are
released before the native deadline with identical held/released byte lengths and
SHA256 values. Neither restores rows, detail, counts, or authority. The explicit
permission mutations are separately bracketed; they are not counted as read-only
SQL preservation. All 24 original decision receipts remain unchanged.

The list and approval-detail screenshots were visually inspected. At the observed
size, the applicant labels and recorded/current distinctions wrap without clipping;
the detail explicitly says current household access has not been checked. This
does not establish the wider accessibility, device-size, or release UI matrix.

All 679 installed app files match the retained signed product, and both app/runner
signatures are verified. The original removal products, first history build with
warnings, source inputs and result bundles remain separately preserved. The
simulator is stopped with data retained. No physical phone was installed.

Private evidence is under
`/private/tmp/pantopus-home-residency-cycle-r1/ios-history-candidate-r2/`, including
`source-r2.json`, `products-binding.json`, focused/full result bundles, both
installed result bundles and `installed-reader-binding.json`. Raw fixture data,
credentials, operator logs and products are excluded from Git.

The populated fixture is retained under the exclusive root runtime lease for
Android reader acceptance; final exact fixture cleanup and durable archive
verification remain required. Fresh native cycles, Android product/installed
acceptance, final source reconciliation and exact pushed-head CI remain open.
These local results do not prove hosted deployment, provider delivery, renewal,
complete R03, or launch readiness.
