# Ordinary Home invitation decision commands — September 12, 2026

## Accepted backend scope

New authenticated invitation decision endpoints bind the original account,
request UUID, invitation token hash, Home/invitation identity, action and reviewed
terms. A fresh session scope is required for context, command reads and writes;
a changed account/session cannot dispatch the previous screen’s action.

The additive `20260912020000_home_invitation_decision_recovery.sql` migration adds
service-only commands and prepared-context/read/resolve functions. The reviewed
terms hash includes the actor, invitation policy/dates and public Home identity.
Changes require a fresh explicit review. Ownership/claim-merge invitations remain
in their separate gateway. Existing public preview and legacy routes keep their
shapes and behavior.

Decisions and receipts commit atomically through the existing invitation SQL.
Exact retries return saved history without reapplying membership. A failed
receipt write rolls back membership, invitation and audit changes. Cancelling an
unseen original writes a tombstone under the same lock as submission; a committed
decision wins. Cancellation never means declining an invitation. An opposite
intent under the same UUID conflicts instead of overwriting the original.

Accepted history remains readable after explicit access denial, removal and Home
deletion. It never grants current access. Historical responses include only
allowlisted identifiers, decision, timestamps and error state; the command stores
no raw invite token, address, email, profile or permissions. Open-link decline is
a durable decision for that viewer and does not revoke the link for everyone.

## Actual acceptance

Final HTTP/SDK/SQL r3 uses production routes, services and real local PostgREST.
Only synthetic authentication, notification/email transports and injected failure
boundaries are controlled. It passes fresh session and account binding, wrong
recipient/foreign receipt denial, lost accepted reply and exact replay, original
history after denied/removed access, failed/malformed reads, cancel-before-submit,
opposite-intent collision, receipt-write rollback, concurrent accept/decline/
cancel, changed terms, lost decline reply, viewer-only open-link decline followed
by a different viewer’s acceptance, and history after Home deletion.

Final state has eight immutable commands. The three-way race records one accepted
winner; cancellation-before-submit independently proves the tombstone path. No
raw invitation token appears in persisted commands or historical responses. Home
detail deliberately returns its existing 403 privacy response after deletion;
the exact owned Home row is independently confirmed absent.

The first harness run exceeded its buffer while reading full provenance, before
setup/mutation. The harness now compares a database-side hash over every complete
ledger row, relation identity/owner/ACL and function definition/OID/owner/ACL/
configuration. The second run passed the decision cases but expected 404 rather
than the established 403 Home privacy response. Both runs are cleaned; final r3
passes and also exercises changed-session and three-way decision races.

Full backend regression: **317 suites passed, one suite skipped; 5,170 checks
passed, 16 skipped, zero failures**. Privacy gates pass. Populated upgrade rehearsal
preserves every row value in **366 public/auth/storage/migration tables**, reports
zero PL/pgSQL lint issues, and rolls back all rehearsal DDL. Final exact fixture
cleanup restores introduced role rows and full schema/ledger provenance. No
migration ledger adoption or persistent schema/data change remains.

Private evidence: `/private/tmp/pantopus-home-invitation-decision-r1/` — HTTP r3
results and cleanup, populated upgrade/lint proof, regression/privacy logs and
migration inventory. Operator details stay private. The post-commit source
binding is saved beside those artifacts.

## Continuation and integration limits

Connect browser and native protected original storage, restart/read/retry/cancel/
acknowledgement and separate current-access reads to this contract. No client
uses the new endpoints yet. Native resolver/failed-decline recovery, complete
login/registration return, invitation creation/cancel/resend/truthful delivery,
ordinary-member onboarding and legacy mutation compatibility remain unfinished.
Acceptance notification transport remains the existing best-effort behavior;
these command receipts do not claim notification delivery. H07/H08 stay partial;
7 of 80 rows are closed and 73 remain partial/open, not a whole-app percentage.

Browser predecessor `2da002ae8fd17cd7bb175843c80f0a37c12c920e` has every job passing
in [CI 34710572692](https://github.com/WangPantopus/skinny-pantopus/actions/runs/34710572692).
Backend source milestone `30958f8420cf0b50e66cae8ea950bbe5e0a41afb` binds seven
source files and 12 artifact anchors privately. It is ready to push with this
checkpoint; verify that new head independently. The protected browser candidate
is uncommitted and undergoing final actual acceptance. Private-first-use
`ff4c82609e37203031df32daa3a3a9378723b2d3` is also fully green.
#32 remains a draft; #34 remains an unfinished conflicting draft with passing
checks at its own head. No merge, hosted migration/release, native build or device
update. The physical iPhone remains 1.0.0 (2). Source inventory is now 44 Home /
21 paid / 53 combined, 12 identical shared versions, zero timestamp collisions.
Combined replay/adoption remains open. Paid services remain one final launch
bundle; owner work, databases/devices and private artifacts are preserved.
