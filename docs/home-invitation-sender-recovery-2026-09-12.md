# Home invitation sender recovery — September 12, 2026

## Implemented backend scope

Authenticated sender commands bind account, request UUID, Home, action, reviewed
terms and capability hash. Creation, explicit resend and withdrawal use one
transactional receipt protocol, with read, exact retry and cancellation of an
unseen original. Account/session scope must be refreshed before reads or writes.
Changing the original under its UUID conflicts. A committed result wins over a
late cancellation; cancellation never means withdrawing an already saved invite.

`20260912040000_home_invitation_sender_recovery.sql` adds service-only commands
and additional hashed invitation capabilities. Neither stores raw links, contact
addresses or messages. Explicit resend adds a capability for the same invitation;
all old links retain their validity and prepared recipient decision terms remain
unchanged. Expiry and access dates are retained. Withdrawal changes only pending
invitation status and writes an audit entry. It never deletes or modifies an
existing membership; accepted or otherwise resolved invitations reject a new
withdrawal. Historical receipts remain recoverable after lost authority or Home
deletion and grant no current authority or membership.

Current `members.manage` is checked for sender preparation and commands, including
original inviters. The legacy decline transaction also removes the original
inviter's stale-authority exemption while preserving recipient and viewer-only
open-link decline. Username-only creation resolves an actual account instead of
silently creating an open invite; ambiguous historical case variants must fail
closed. Selected user IDs remain the preferred client identity.

Delivery is independent of saved creation. A one-shot dispatch claim rechecks
current authority and invitation state immediately before provider work. Exact
replays and reads never resend. The receipt records only email transport
acceptance (`provider_accepted`) and a returned matching in-app notification row
(`saved`); neither claims inbox, push or device delivery. Failed or lost dispatch
and proof writes leave conservative `unconfirmed` status without converting
saved creation into failure. An explicit new resend is required to try again.

The [client contract](home-invitation-sender-contract-2026-09-12.md) describes the
exact endpoints, protected originals and response validation. A direct current
sender list is available independently of dashboard and roster loading.

## Verification

Actual local HTTP/SDK/PostgREST/SQL r6 passes saved creation with a lost reply,
immutable replay, failed/malformed reads, account/session checks, cancellation
before submit, receipt-write rollback, concurrent submit/cancel, changed reviewed
terms, explicit resend with truthful controlled proof, preserved old/alias links
and prepared recipient originals, accepted membership preservation, lost resend
and withdrawal replies, username identity, current authority and legacy sender
denial, and historical recovery after Home deletion. Twenty-five sender originals
are retained in the private accepted-state record. No raw capability is stored in
commands or historical responses.

The first run passed the feature cases but its cleanup SQL lacked a semicolon
after the exact restored recipient function. The cleanup transaction rolled back;
the guarded recovery cleanup then restored the complete original provenance.
The corrected r2 run passes feature cases and cleanup in one execution.

Full backend regression passes **5,186 tests / 16 skips / zero failures**, in
**318 passed suites and one skipped suite**. All privacy gates pass. The first full repeat had one unrelated delete-account
socket hang-up; its full 89-test file passed immediately, and the final complete
regression is green. Those full-regression counts belong to the preceding service
source; the later SQL compatibility change passes the 16 focused sender tests
and fresh actual SQL acceptance. The populated
migration rehearsal preserves every row value in **366 existing public, auth,
storage and migration tables** and reports zero PL/pgSQL lint issues. Its DDL
and temporary lint installation roll back. HTTP cleanup restores introduced role
rows, full ledger, relation identities and complete function definitions,
owners, ACLs and configuration.

Final r3 adds ambiguous-username rejection and pins the prepared recipient ID
for insertion, validates safe sender-list/context recipient labels and rejects
changed displayed identity, and proves that expired or former-manager pending
invitations stay available for authorized withdrawal. Lost delivery-claim replies
produce no external attempt; lost delivery-proof replies recover saved provider
handoff without sending again. Direct deletion of the owned Home exercises the
Home → HomeInvite → HomeInvitationCapability cascade while retaining commands.
The sender command has no foreign key by design, following earlier recipient,
creation and residency histories. Existing private-delete eligibility already
blocks any live HomeInvite; an alias cannot independently bypass that check.
Final service projection also strips unexpected fields before sender-list
responses; final r4 passes and binds that narrow privacy hardening to the full
actual run.

Final integration review identified older invitations that could still be
accepted but could not be resent: null admission-policy snapshots, canonical
role fields differing from legacy display labels, and approved
`access_request:<UUID>` presets. Final r6 aligns resend policy derivation with
recipient admission, preserving null legacy snapshots only when current policy
is valid. It validates a genuine approved source against Home, recipient,
original resolver and effective role, including the UUID suffix on older rows
without a source-request foreign key. Conflicting or malformed sources, invalid
policies, changed non-null snapshots, claim-merge and owner flows remain rejected.
No existing invitation row or recipient function changes in this compatibility
repair. The client review and internal email-delivery projection use canonical
role before the legacy label; actual delivery capture verifies that role.

The 25-command actual r6 run proves legacy resend, unchanged invitation rows
and prepared recipient decisions, canonical member admission, matching
legacy/current source shapes (with and without the legacy prefix), rejected
changed-source history, and membership preservation. It also exercises
policy/owner rejection, cancelled or wrong requester/resolver/role sources,
malformed/mismatched/orphan prefixes, and withdrawal preparation despite an
invalid source. A source or policy change after saved completion makes the
one-shot delivery claim refuse dispatch; exact command replay retains the saved
result without sending. The fresh populated upgrade again preserves all 366
tables with zero lint issues. HTTP cleanup restores complete
ledger/schema/function provenance and introduced role rows.

Shared browser/native fixture `scripts/ios/home-invitation-ui-fixture.cjs` gains
`sender-recovery`, sender command faults, safe request hashes, authority changes,
recipient acceptance, separate delivery controls, and roster failures on both
`members` and `occupants`. Its actual session/context/create smoke passes and
complete cleanup is verified. Final browser acceptance found and fixed a harness
null-fault guard: list RPCs now have an explicit `sender_list` action and an absent
fault cannot trigger failure after a successful SDK response. This required no
production service or SQL change. Native and browser feature acceptance are separate
from this backend scope and are owned by their reports.

Private evidence root:
`/private/tmp/pantopus-home-sender-invitations-r1/` — backend-http-r1/r2/r3/r4 and
backend-http-r5-compatibility are predecessors; current evidence is
`backend-http-r6-final`, `backend-upgrade-r6-final.log`,
`backend-sender-r5-focused.json`, and `backend-source-binding-r6-final.json`.
The sender fixture smoke and full backend regression retain their recorded
scopes. Current privacy and migration-policy logs have the `r6` suffix. Raw originals,
fixture configuration, operator logs and any contact records stay out of Git.

## Remaining limits

No hosted provider sends, paid activation, permanent migration adoption,
deployment, merge, owner checkout mutation or physical-device update occurred.
Notification transports in local acceptance are controlled; no live delivery is
claimed. Browser/iOS/Android installation and full sender UX need their own
acceptance. H07/H08 remain partial until full onboarding and first-use exit
criteria pass. Source inventory gains one Home migration; combined replay and
per-environment ledger adoption remain unfinished.
