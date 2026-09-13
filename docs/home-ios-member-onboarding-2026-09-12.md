# iOS ordinary-member onboarding and first use — September 12, 2026

The installed ordinary Member journey now proves invitation creation, recipient
acceptance, fresh My Homes identity, matching Home entry and useful household
Task first use. The accepted continuation edits, reopens and completes its first
Task; current permission denial and membership removal retire access. A second
explicitly intended Task preserves its exact title and notes through a lost
reply, cold restart and Retry. These are bounded local H07/H08 subjourneys,
not completion of their full exit criteria. The accepted sender milestone remains
preserved in [the iOS sender report](home-ios-invitation-sender-2026-09-12.md).

## Shipped baseline and truthful identity

The native invitation form defaults to `member`, with an email field and
Member/Guest picker. The driver leaves the role untouched and checks reviewed
`Role: member`. A fresh `member-onboarding` fixture has no seeded invitations or
recipient membership; its optional `member-tasks` policy argument is omitted.
No positive permission override is injected. Through normal sender UI, sign-out,
recipient login, acceptance and current-access check, the actual invitation is
accepted. Both protected originals are acknowledged through UI. Dynamic private
capabilities are matched by recipient actor and sender request ID.

Fresh My Homes shows the exact named Home with Member role; entry opens that
same Home UUID dashboard. The dashboard deliberately displays its address,
while My Homes prefers its nickname. SQL records one completed sender create,
one completed recipient acceptance and zero Tasks. The active member occupancy
has `verification_status = verified`, but there are no residency claims,
ownership claims or recipient HomeOwner rows. The original default grants only
`home.view`. The actual dashboard has Overview only, without Tasks or Add-task
entry. Real Task-route refusal is independently covered by backend/browser
baseline; this native baseline does not bypass the missing entry to claim a
denied native Task page.

The captured My Homes pixels incorrectly say “Residency verified.” Invitation
acceptance can produce verified household occupancy without independent
residency evidence; the native DTO has independent ownership status/tier but no
independent residency-proof field. The narrow repair labels that occupancy chip
**Household access**, preserving the independent Ownership verified chip and
role labels. A semantic API-response regression distinguishes an invited member
with verified occupancy/no ownership proof from an independently verified owner
without occupancy. The final installed My Homes pixels show Member and Household
access without a false residency or ownership badge.

The initial baseline attempt, ui-baseline-r1, fails after **153.044 seconds** on
an incorrect nickname-based dashboard selector, after admission, acknowledgement
and fresh My Homes have succeeded. The bounded driver-only ui-baseline-r2
continuation passes in **23.109 seconds**, reopening the existing member's
matching Home by its expected address and asserting missing Task entry. It issues
no additional invitation or acceptance. Aggregate baseline counts are therefore
**one sender create, one recipient accept, zero Tasks**. Both source/build and
signed product sets remain preserved; their production app bytes match accepted
sender r19. The failed initial test is not described as a complete passing run.

## Candidate Task input and roster repair

A fresh `member-onboarding member-tasks` fixture applies the deliberate production
member-task policy for this candidate journey, with no synthetic user grants.
Installed ui-first-use-r1 on signed candidate-r3 completes one normal default
Member invitation and acceptance, checks current access, acknowledges both
originals and displays Household access. Matching Home entry exposes Tasks.
One Task commits after a deliberately lost reply; cold restart and actual Retry
saved request return the same Task and one creation receipt.

That attempt fails an incorrect raw request-hash equality assertion. Both POSTs
use the same UUID, but the fixture hashes JSON wire ordering while SQL protects
canonical `jsonb` intent. SQL rejects a changed canonical payload before replay.
The retained receipt and successful replay support canonical intent recovery.
Raw request bodies were not retained: independent byte equality or a specific
key-order explanation is not claimed. The driver now compares exact SQL Task
and receipt values before/after replay while preserving distinct wire hashes.

The same attempt later fails to open Edit through its driver. An independent
ordinary UI follow-up opens the existing Task afresh and normal Edit works; no
product edit-route defect is established. It does reproduce garbled saved notes
and input loss: entering “Simple household notes” yields “Ssehold notesu.” The
unsaved diagnostic edit is discarded through the normal confirmation, with zero
Task-update requests. A screenshot also shows “No assignable members are
available” despite an actual roster HTTP 403.

The production repair uses live Title, Notes and custom-interval bindings in
place of captured render-time text snapshots. Current roster loading,
unavailable and verified-empty states have distinct accessible explanations.
A denied optional roster says “Household members could not be loaded. You can
leave this task unassigned.” It neither grants roster access nor blocks an
independently authorized unassigned Task. Three meaningful tests cover repeated
reads/writes through one binding and retirement, 403/503 roster refusal, cached
member retirement and verified-empty recovery. Custom interval is covered by
that unit test; it is not exercised in this installed one-time Task journey.

The first post-repair continuation, ui-first-use-r2, opens Edit and displays the
correct roster explanation. It fails after **42.186 seconds**, before Save,
when the exact-value guard finds an old title suffix. Its screenshot shows the
complete intended replacement followed by an old trailing word: the shared
backward-Delete helper started at the tapped caret, not the end of the
prepopulated field. There are still zero Task updates at that boundary. The
Task-specific driver switches to normal Select All, keeping its exact-value
guard. This driver correction is separate from the independently reproduced
predecessor notes-loss defect; product source remains frozen.

## Final installed continuation

**ui-first-use-r3 passes in 251.588 seconds**, with zero failures on the same
admitted member and existing Task. It does not repeat admission. Normal Edit
preserves exact intended Title and Notes before Save; SQL and the reopened
completed detail agree on “Shared household task updated” and “Updated by the
member who created this household task.” The user marks it Done through the
Task list and reopens its completed detail.

Current-access scenarios pass through real production readers and UI:

- Task-edit denial preserves readable content while removing Edit, Add-task and
  status-edit controls.
- Separate Task permission remains valid when `home.view` alone is denied.
- Task-view denial removes the previously visible Task and editing control;
  explicit Retry restores it after the fixture restores the original access.
- Membership removal makes the prior Task unavailable and removes the Home from
  a fresh My Homes read. Restoring the original membership allows a fresh matching
  Home read and reopens the same Task. No positive permission is invented.

Only after those checks does the member explicitly create a second Task:
“Prepare household recycling,” with notes “Rinse containers and place them in
the shared household bin.” Exact field values are checked before Save and in
SQL. Its deliberately lost committed reply preserves a new original. Cold
restart restores the same exact Title and Notes in locked fields; actual Retry
opens the correct Task with both complete strings visible. The completed first
Task and both receipt values are preserved across this retry.

Aggregate candidate counts are **one sender create, one recipient accept,
two deliberate Task originals, two Task rows and two canonical receipts**.
There are four Task-create POST attempts: exactly two per original UUID, with
one receipt and one Task for each UUID. The first Task has one explicit content
update and one status update; the second remains Open. Both have household
`members` visibility and the admitted member as creator. There are zero residency
and ownership claims. Sender/recipient originals were acknowledged in r1; both
Task retries resolve their retained originals and open the exact saved details.
No unresolved original remains at cleanup.

The first original's initial notes defect and failed assertions remain in
predecessor evidence. The second is a separately intended useful Task that
verifies corrected creation inputs, not a duplicate retry of the first. The
first original's canonical receipt remains its creation receipt even after the
separate authorized content/status updates. Per-original UUIDs, canonical SQL
hashes, wire-order-sensitive hashes and row/attempt counts remain private in
first-use-acceptance-r3.json. No byte-equality claim is inferred from them.

Saved first/second Title and Notes, Done/Open state, readable roster explanation
and Member/Household access screenshots were visually inspected by the native
owner and root integrator. This is bounded first-use visual proof; app-wide
layout, accessibility and physical-device acceptance remain separate.

## Source, signed products and gates

Candidate-r4 contains the final production/input/roster and unit changes.
It builds and passes **63 focused checks, four skips, zero failures (67 total)**.
The full run passes **4,402 checks, 168 skips, zero failures (4,570 total)**.
Candidate-r5 adds only driver continuation/new-original checks; r6 adds only
Task-driver Select All. Their signed app and embedded unit bundle bytes remain
identical to r4. Installed app and UI runner match the separately preserved
signed candidate-r6 products. SwiftFormat, strict SwiftLint, all 60 bound source
hashes, privacy scan and diff checks pass. No full suite is repeated solely for
these runner changes.

The earlier first full candidate run is retained as failed: **4,394 passed,
168 skipped, five failed cases / seven assertions**. Retained synthetic login
exposed shared-auth dependencies in two PasswordChange suites and PublicProfile
sequenced stubs. After observed normal Settings logout, those tests use retained
in-memory AuthManager/API providers and explicit viewer identity through existing
DI seams. Existing assertions and explicit owner/viewer cases are preserved;
production authentication source is unchanged. Candidate-r2 passes 42 focused
and 4,399 full checks/168 skips. That accepted chip/test-isolation predecessor,
failed full-r1 and all signed intermediate products remain distinct from final
Task-input evidence.

Private evidence root: `/private/tmp/pantopus-home-ios-member-onboarding-r1/`.
The verified durable private archive is
`/Users/yingpengwang/skinny-pantopus/.pantopus-recovery/20260907/home-invitation-handoff-20260912/member-onboarding-20260912/ios-member-tasks/`.
Its APFS clone preserves all signed products, baseline/failed/current evidence,
60 exact current source snapshots and both independent root reviews. The
size/SHA-256 manifest verifies every copied file; earlier source manifests and
products remain explicit predecessors rather than reconstructed source bytes.
The final entry point is candidate-verification-summary.json. Current bindings:
source-candidate-r6.json, candidate-r6-products, build-candidate-r6.xcresult,
product-candidate-r6-comparison.json, installed-binding-first-use-r3.json and
candidate-r6-style-privacy.json. Production/unit binding is source-candidate-r4.json,
targeted-candidate-r4.xcresult, full-candidate-r4.xcresult/summary and
installed-binding-candidate-unit-r4.json. The final UI result and screenshots are
ui-first-use-r3.xcresult/summary and ui-first-use-r3-attachments. Failed
ui-first-use-r1/r2, manual input/copy captures and diagnosis state remain linked
in first-use-acceptance-r3.json. baseline-verification-summary.json preserves the
unchanged-policy baseline. The source starts from committed
`fdbd378dea04f0822a5ca0590b0a516dfdf6efe1`; later integration commits do not replace
these exact native source/product bindings.

## Cleanup and verification limits

Both baseline and candidate fixtures are exactly cleaned. Each proves all five
preservation checks: owned fixtures removed, complete role rows restored,
complete migration ledger preserved, exact function definitions/properties
preserved, and all populated rows/schema preserved across **366 tables**. The
candidate process exits zero and port 18084 is closed and released. The owned
F9BBAB33-BAA0-4A00-9ECE-E3B1343627A8 simulator is shut down with userdata retained.
No unrelated device or physical phone is changed, cleared or reset. Evidence:
fixture-first-use-r1/cleanup.json, process-final.json, final-state.json and
device-first-use-final-r3.json; baseline equivalents remain preserved.

Household Tasks are shared within their authorized household scope, not
personally private. Synthetic existing-account login does not prove new-account
or provider onboarding, live delivery, hosted readiness or all H07/H08 criteria.
Custom-interval input has a meaningful binding regression but no new installed
recurrence journey here. Existing media, recurrence, Gig publication and broader
Task-policy effects retain their separate evidence and limits. Raw Task request
byte equality is not established; protected canonical intent and single-receipt
replay are the verified recovery contract. No hosted deployment or live paid
provider activation is claimed.
