# Home authority and deletion transactions — September 9, 2026

This is the next source checkpoint in draft [PR #32](https://github.com/WangPantopus/skinny-pantopus/pull/32),
after effective permissions (`2fabe0c94`) and finance RLS (`a248b15c1`). It closes
the repaired member-mutation and Home-deletion boundaries. It is not full Home
acceptance: enrollment, resource sharing, record access and client controls still
need the work listed below. No hosted Home migration, ordinary role grant,
verification-age rollout or production deployment ran.

## Result

Member role, preset, permission override, removal, detach and move-out routes now
call one service-only database transaction. The transaction locks the Home,
current membership/ownership/override rows and role/preset reference data before
checking the actor and target. Current verification, active state, access dates,
age ceiling, recorded target rank, ownership facts and explicit actor denies all
apply. An actor cannot promote themselves, assign ownership through a role or
preset, modify an equal/higher target without owner authority, or introduce
permissions they do not currently hold. A pending target's potential future
permissions also count when checking delegation.

Role/preset changes preserve existing verification state, age and both access
windows. Presets preserve existing explicit denies; they add only their bounded
grants and restrictions. Historical null age retains the existing compatibility
behavior. No reference defaults or existing membership rows are rewritten by
the migration.

Removal atomically deactivates the occupancy, clears its permission overrides,
expires its scoped grants, revokes issued residency letters and records the
audit. Exact self-removal can normalize an inactive or unknown-role historical
row. A legitimate legacy primary owner or current verified primary owner must
transfer ownership before leaving. If their only ownership proof is explicitly
revoked/disputed and no current verified proof remains, self-removal clears the
proven stale legacy pointer in the same transaction. Historical revoked rows do
not invalidate a current verified owner. Current remaining recipients and
vacancy are evaluated after lock waits; expired recipients are not notified.

Direct client DML on HomeOccupancy, HomeOwner, HomePermissionOverride,
HomeScopedGrant, HomeRolePermission and HomeRolePreset is revoked, including
PUBLIC grants. Direct Home creation/update/deletion also goes through the
backend. The unsafe legacy preset RPC is closed to clients and service_role.
The legacy `transfer-admin` shortcut returns `OWNERSHIP_FLOW_REQUIRED` (409)
instead of rewriting pointers and roles sequentially. Legacy residency claim
approval rejects owner/admin/manager promotion before modifying the claim;
the full enrollment transaction remains a separate next milestone.

Home deletion uses a service-only advisory eligibility RPC and an atomic delete
RPC that locks and rechecks current authority and data history. Verified deletion
requires the primary owner's effective `home.edit` and `security.manage`, with
age/status/time/explicit-deny and revoked-ownership checks. An exact creator can
still remove their own unfinished private setup only when the narrow bootstrap
and history conditions hold. Another occupant, ownership record, foreign item
or established household history prevents that private-creator shortcut.

The delete transaction preserves Payment records by unlinking them atomically
with deletion. Failure rolls back the Home, payments and calendar changes.
Four restrictive `NOT VALID` foreign keys fence new mail/map references without
rewriting historical orphans; a Home-scope calendar attachment trigger prevents
late orphan rules and leaves non-Home calendar scopes unchanged. File,
HomeDocument or verification-evidence history blocks deletion with a truthful
cleanup-required response. This preserves storage records and tombstones until
full byte retirement is implemented; it does not claim storage cleanup is done.

Database/transport/lock failures in the repaired mutation routes return a
retryable 503 instead of partial success. The Home detail/dashboard deletion
capability projection also propagates an unavailable authorization state.

## Verification

- Full backend: **4,661 passed, 16 skipped**, **290 passing suites**. Privacy
  gates pass, including **15 E2E checks**. The first full run identified six
  expectations/fixtures tied to the old transport; all existing scenarios were
  retained and adapted, and the complete rerun passed. One unrelated Beacon
  HTTP parser failure passed its focused rerun and the complete rerun unchanged.
- Focused effective-access, route/service, lifecycle and exploit regressions:
  **151 passed**. HTTP fixtures assert the authenticated actor and exact target
  sent to the transaction. Actual policy decisions use the real SQL contracts.
- **22 raw SQL contracts and 22 generated pgTAP wrappers pass** in the disposable
  local database. The authority contract uses the shipped 24 role rows, including
  explicit denies, pending/null-age preservation, child/teen ceilings, exact
  self-grant exploits, owner demotion of an ordinary admin, direct-DML/RPC denial,
  and rollback after an injected final audit failure. References and fixtures
  roll back.
- **11 real authority concurrency races pass**: actor expiry/revocation, inserted
  or changed denies, target promotion/age restriction, changed preset role/grants,
  ownership revocation behind a legacy pointer, recipient/vacancy expiry during
  self-removal, and atomic stale-pointer exit after competing revocation.
- **13 real deletion concurrency races pass**: actor/owner revocation, explicit
  denies, foreign occupancy/ownership/rule history, file/map attachment, access
  expiry and verified-history changes. When deletion wins, later map/pickup
  insertion waits and then fails the reference check. Exact fixtures are cleaned.
- Application SQL lint: **131 functions, 74 trigger bindings, zero errors** and
  **five existing warnings**. Generated wrappers and whitespace checks pass.
- Independent review and the root review found no remaining actionable P1/P2
  within this bounded core checkpoint. No source checks were waived.

Source evidence is in
[`home-authority-transactions.sql`](../scripts/db/contracts/home-authority-transactions.sql),
[`home-delete-transaction.sql`](../scripts/db/contracts/home-delete-transaction.sql),
their generated pgTAP wrappers and the focused backend tests. Operator logs,
temporary concurrency harnesses and database fixtures stay outside Git.
These results are local/source evidence, not hosted household acceptance.

## Required next work

1. Finish transactional enrollment and authority lifecycle gateways: attach,
   household request/invite creation and acceptance, residency claim admission
   and approval, challenge/removal, and the remaining system lifecycle services.
   Preserve existing owner facts, age, restrictive overrides and access state;
   the small legacy claim restriction above is not a full enrollment repair.
2. Repair the reproduced WiFi creation defect and finish exact resource/guest
   sharing. The current `sync_home_access_secret_value` BEFORE INSERT trigger
   writes HomeAccessSecretValue before its immediate parent FK exists, so a
   normal nonnull WiFi-secret insert fails. Separately, guest/scoped grants must
   check current actor rights and the exact resource/recipient/visibility before
   granting access. Do not reopen direct authority DML as a workaround.
3. Complete task/calendar record visibility and mutations across every entry
   point, attachments and derived/dashboard data. Include notification recipient
   limits and the explicit private creator's own first task. Protect same-record
   mail/task/media alternatives and overlapping RLS policies together.
4. Complete Home storage retirement so attached files can be safely removed
   before Home deletion. Until then, the cleanup-required guard is intentional.
5. Align web/native permission controls, especially finance read-only navigation
   and sensitive document/access controls. Then review ordinary role defaults
   and run the full integrated household journey against the reviewed runtime.

Do not merge this partial Home journey as a final release or expand ordinary
role grants while those access paths remain unfinished. Payment work remains
separate; completed Beacon device acceptance must not be repeated.
