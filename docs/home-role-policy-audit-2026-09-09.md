# Home role policy audit — September 9, 2026

This is a proposed, bounded repair for existing Home journeys. No runtime code,
reference rows, permissions, hosted data or deployment configuration changed.
The audit uses source `a6b1b574883fbb8e4c430a4ab75cab4bd48c46de` in
`codex/staging-adoption-plan`, whose application stream includes PR #29.
The shared remote reference subsequently advanced through PR #30; its rollback
binding change does not alter the code examined here. Root owns final Git/CI
integration and the project handoff.

The [release inventory](staging-release-inventory-2026-09-09.md) already proves
that canonical replay and Free staging have the same 24 Home role permission
rows. Reapplying that reference baseline will not fix ordinary Home access.
**Adding the missing grants alone would also broaden access for pending members
and minors. Repair effective authorization before adding defaults.**

Scope follows the [v1 release brief](v1-release-brief-2026-09-06.md): private Home
usefulness, correct household boundaries and truthful reachable actions. It
does not incorporate PR #24, the owner's separate design proposals, a full
mailbox redesign or new ownership policy.

## Current behavior and demonstrated gaps

An in-memory probe loaded the actual `homePermissions.js` module with the
repository's Supabase mock and parsed all 24 role rows from the committed
reference migration. It made no network request or database mutation. Results
below establish helper behavior; they are not live HTTP or PostgreSQL evidence.

| Case | Observed result |
| --- | --- |
| Verified adult `member`, no overrides, exact baseline rows | `home.view`, `tasks.edit`, `calendar.view`, `docs.view`, `docs.upload` and `sensitive.view` all deny. |
| Verified child `lease_resident`, `can_manage_tasks=false`, exact baseline rows | `tasks.edit` allows. |
| Active lease resident whose `access_end_at` has passed | `tasks.edit` allows. |
| Pending-postcard restricted member after adding only `restricted_member/tasks.edit` | Task editing allows despite the all-false template. This is a proposed-seed simulation, not current hosted policy. |
| Verified teen member after adding only `member/sensitive.view` | Sensitive access allows despite `can_view_sensitive=false`. Also a proposed-seed simulation. |
| Child with IAM owner role, provisional-bootstrap status, false finance flag and explicit finance deny | `hasPermission(finance.manage)` denies, while `checkHomePermission(finance.manage)` allows. This synthetic row demonstrates inconsistent helpers; it does not establish that ordinary onboarding creates such an owner row. |

The current [templates](../backend/utils/homePermissions.js) and their
[unit tests](../backend/tests/unit/homePermissions.test.js) explicitly intend
verified members/lease residents to manage tasks, managers to manage the Home
without finance/access/sensitive powers, and children/teens to have reduced
authority. Runtime permission resolution does not enforce these ceilings.
Existing tests often supply their own role rows or mock the permission helper,
so their success does not certify the shipped reference policy.

### Effective access resolution

- `getActiveOccupancy` requires `is_active=true` and respects `start_at` and
  `end_at`. It ignores `access_start_at`, `access_end_at`, `verification_status`
  and `age_band`. Failed occupancy reads currently collapse to absence.
- `hasPermission` reads an explicit grant/deny first, then a role row. It does
  not apply verification or age ceilings. An override lookup error can fall
  through to a base grant because the error is ignored; this must not bypass a
  deny that could not be read.
- `checkHomePermission` grants every permission to a legacy `Home.owner_id`
  match, verified `HomeOwner`, or active IAM `owner`. That bypass occurs before
  overrides. A named legacy boolean such as `can_manage_tasks` maps to **any**
  of `tasks.edit` and `tasks.manage`; the stored boolean is not checked.
- `getUserAccess` assembles grants without the ceilings. Conversely,
  [GET `/me`](../backend/routes/homeIam.js) derives navigation booleans from
  stored occupancy booleans, with an owner shortcut. A tab can therefore be
  visible while its API denies, or remain visible after an effective deny.
- SQL `home_has_permission`, `home_get_user_permissions`,
  `home_is_active_member` and `home_my_role` use the occupancy/time approach but
  omit age, verification and access-window ceilings. Legacy SQL
  `has_home_permission` and `home_member_can` read booleans and only
  `is_active`, omitting even `start_at`/`end_at`. These are distinct contracts,
  not interchangeable helpers.
- The shared JS/SQL role rank omits `lease_resident` and `service_provider`.
  JS returns zero and SQL returns null. The attachment service separately uses
  rank 35 for lease residents. Direct IAM role assignment accepts only keys of
  the incomplete shared rank object, so it rejects the two valid enum roles.
  Unknown legacy roles currently fall back to `member`; granting member rights
  makes that fallback consequential.

Ordinary move-out already deactivates the occupancy, stamps `end_at` and clears
the legacy owner pointer. Preserve that behavior. Pending/suspended/moved-out
rows should still deny when a partial failure or imported row leaves
`is_active=true`; the boolean must not be the sole revocation signal.

Verification **age** is separate from membership validity. The existing
[`verificationAge`](../backend/utils/verificationAge.js) rollout deliberately
leaves expiration enforcement disabled by default and treats historical missing
timestamps as unknown, not expired. Its current effect is on attested artifacts
and physical mail. Do not silently expire the entire resident base or switch
that flag as part of filling role defaults.

### Reachable task, calendar and document differences

These are source findings; no live exploit or new route test ran in this audit.

| Surface | Current mismatch | Minimal repair before broader defaults |
| --- | --- | --- |
| [Task list](../backend/routes/home.js) | GET tasks queries rows even when the permission result denies. Creator, assignee, viewer-list and `public` branches can return rows without current Home access. Manager/sensitive branches check `access.role`, which the helper does not return. | Deny absent current membership before querying; use effective `tasks.view`, current visibility and an explicit scoped grant where supported. A Home record marked public must not turn this private Home API into anonymous household discovery. |
| Task update/delete | Both use the legacy tasks boolean mapping. `tasks.edit` therefore updates or deletes any task in that Home, including a task the editor cannot read. | Match the SQL distinction: editing requires creator ownership or a narrowly authorized assignment/scoped action; managing/deleting another person's task requires `tasks.manage`. Check record visibility, and constrain visibility/assignee/viewer-list changes. |
| Task creation/notifications | Accepts arbitrary assignee, viewer IDs and visibility without checking their Home access. | Require permitted visibility and eligible recipients. A notification must not disclose a task title to an unrelated account merely because its ID was submitted. |
| [Calendar events](../backend/routes/home.js) | Event list/detail/CRUD use membership only; they do not honor calendar denies. Listing returns event records without applying their visibility. Only the booking union checks `calendar.view`. | Use `calendar.view` for reads/RSVP eligibility and `calendar.edit`/`calendar.manage` plus ownership for writes. Apply visibility to ordinary events, bookings and notification content consistently. |
| [Pickup calendar](../backend/routes/addressCalendar.js) | Deliberately supports an active member's household-confirmed schedule without ownership verification. It is not the source of the missing role-row failure. | Preserve the private first-value path. Distinguish its narrow creator/personal entitlement from entry into an established household; do not require an ownership claim simply to save a private schedule. |
| [Documents](../backend/routes/homeDocumentFiles.js) | List/content/upload correctly require `docs.view`/`docs.upload`; no non-owner baseline role has those grants. Existing byte-delivery fixtures used explicit grants. | Add reviewed ordinary defaults only after the effective ceilings. Keep manager visibility role-based and sensitive visibility permission-based. Both are additional to document-operation permission. |
| Document deletion/replacement | Current routes require `docs.manage`; upload permission does not grant global document management. | Preserve this distinction. An ordinary member's upload success must not imply permission to remove everybody's files. Hide unavailable actions or separately authorize a scoped own-file operation; do not grant global management merely to make a button succeed. |
| Dashboard | Requires `home.view`, which ordinary members/managers lack. After that check it queries task/event summaries and counts without their corresponding permission/visibility filters. Document and finance branches already have distinct gates. | Filter summaries/counts/activity with the same effective access as detail routes before adding `home.view` to restricted roles. Denied content must not leak through titles, totals or audit metadata. |

The absence of a guest-wide grant is not by itself a defect: temporary guests
and service providers have scoped-grant/guest-pass mechanisms. Likewise finance,
ownership, security and sensitive access denied to a manager or restricted member
are intended boundaries, not missing ordinary-task features.

## Proposed minimal default matrix

This table specifies the intended default **after the guards below**, for current
verified adults. It is a proposal, not evidence that these permissions already
exist. `Y` means the listed permission is allowed; `—` means no new grant. Existing
explicit role-row denials and per-user overrides must be inventoried and preserved.
Owner powers remain a separately checked ownership entitlement; never synthesize
ownership from a saved address or a successful residency postcard.

| Exact permissions | Admin | Manager | Lease resident | Member | Restricted member | Guest | Service provider |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `home.view` | Y | Y | Y | Y | Y | — | Y (existing) |
| `members.view` | Y | Y | Y | Y | — | — | — |
| `home.edit` | Y | Y | — | — | — | — | — |
| `tasks.view`, `tasks.edit` | Y | Y | Y | Y | Y | — | View only (existing) |
| `tasks.manage` | Y | Y | — | — | — | — | — |
| `calendar.view`, `calendar.edit` | Y | Y | Y | Y | Y | — | — |
| `calendar.manage` | Y | Y | — | — | — | — | — |
| `docs.view`, `docs.upload` | Y | Y | Y | Y | Y | — | — |
| `docs.manage` | Y | Y | — | — | — | — | — |
| `sensitive.view` | Y | — | Y | Y | — | — | — |
| `members.manage`, `access.manage` | Y, only after mutation repair | — | — | — | — | — | — |

The ordinary resident task/calendar pair follows the existing lease-resident
reference and task template. Read/upload supports the already-shipped documents
journey without granting deletion of others' files. The manager/admin management
distinction follows their current Home/task flags. Adult member/lease sensitive
access follows their explicit verified template, but is conditional on the age
ceiling and existing visibility checks; it is not justified by a mere role name
on an unverified row.

Preserve the existing lease `packages.view` and `access.view_wifi`, provider
`maintenance.view`/`maintenance.edit`, and the existing owner/admin
ownership/dispute/quorum rows. This package proposes **no other new grants**:
finance, access codes, verification, mailbox, security, ownership, dispute,
quorum, devices, assets, vendor and package management remain unchanged. Do not
expand the historical 24-row matrix to every enum permission speculatively.

### Ceilings and precedence

1. Resolve the exact Home and current membership/verified ownership. Reject
   inactive, revoked, suspended, moved-out and ended access, honoring both
   occupancy and access time windows. Fail on unreadable authorization state
   with a retryable error, not an inferred grant or misleading empty list.
2. Apply a verification ceiling **before** role defaults and explicit grants.
   Pending/unverified/rejected household claims receive no shared task, event,
   file, member, access, finance or sensitive entitlement. Claim/status and
   recovery pages remain available to their exact claimant.
3. Preserve private first use through an explicit narrow creator/personal
   entitlement. `provisional_bootstrap` must not inherit a full manager/owner
   role. Establish the creator and absence of conflicting household authority
   from current server data; allow only that actor's private schedule/own task
   scope. Neither a new pending claim nor a matching address authorizes existing
   occupants' records. A blanket verified-only check without this separation
   would violate v1's private setup contract.
4. For verified adults, combine role defaults with explicit per-user overrides;
   an explicit deny wins. Then intersect with the age and verification ceiling.
   Legacy flags exposed by `/me` must be derived from this same result. A grant
   cannot override a child's hard safety ceiling. Owner operational shortcuts
   must not bypass age restrictions or a deliberate record-access deny; any
   retained ownership-only bypass must be explicit and tested separately.
5. For teens, allow permitted ordinary task/calendar editing but no sensitive,
   finance, access-management or Home-management permission. No membership,
   role, ownership, security, grant-delegation or manager-only file authority.
   For children, ordinary assigned/readable records only; no task/calendar
   mutations or uploads/management by default. Apply these ceilings even if a
   stale row says admin/owner or a stored legacy boolean says true. Do not infer
   adulthood from a default role; preserve existing age data and separately
   inventory unknown age rather than rewriting it.
6. Require record visibility, authorship/assignment and scoped permission after
   operation permission. A stale viewer ID, old task notification or remembered
   document URL does not outlive revoked membership. Keep genuinely scoped
   external-provider access in its existing explicit grant path; it does not
   become full household membership.

Calendar and document minor rules are a conservative extension of the existing
task/sensitive template, not a claim that the current boolean model already
specifies them. They should be encoded in tests and consumer behavior together.
Do not repurpose the separate verification-expiry rollout to implement age-band
rules or silently turn it on.

## Escalation prerequisites

Hosted policy reconciliation is a separate prerequisite even for a plain
manager `home.edit` grant. Root's fresh, read-only staging inventory found that
`home_delete_authorized` allows either `owner_id=auth.uid()` **or**
`home_has_permission(id, 'home.edit')`. Canonical `home_delete_owner` deliberately
allows only the owner. Thus granting manager Home editing on the current hosted
policy would also enable direct database deletion. Do not copy or approve the
broader hosted rule as equivalent. Reconcile to the tested canonical deletion
boundary before new editor defaults. Hosted Home SELECT also adds
`created_by_user_id` visibility beyond member/owner; classify that separately,
preserving the narrow private first-use workflow without blanket access to an
established household after a creator loses membership. No hosted policy changed
in this audit.

Do not seed admin `members.manage` until these current paths are repaired:

- The [role route](../backend/routes/homeIam.js) skips target/new-role rank
  checks on self-edits. Its preset path validates the target's old role but
  does not validate the resolved preset's new role or grant ceiling. A preset
  also deletes all existing overrides before applying its grants/denies,
  without a transaction or complete error checks.
- Direct role updates bypass `applyOccupancyTemplate`, retaining stale flags
  and disregarding the target's existing age/verification state. Even paths
  that call the template can omit the existing `age_band`; a role change must
  retain it rather than accidentally calculating adult booleans.
- Grant validation checks the actor's base role, not their current effective
  deny/age/verification restrictions. Verify both authority to manage the target
  and authority to delegate the particular effective permission.
- SQL `homeocc_*_membersmanage`, `hpo_write_membersmanage` and
  `hsg_write_manage` policies admit direct authenticated mutation based only on
  `members.manage`. They do not replicate target-rank/new-role/grant ceilings.
  Protect this path with a checked transactional mutation boundary or equivalent
  policy enforcement; securing the Express route alone is insufficient.
- Define all valid role comparisons consistently. Use the existing attachment
  rank of 35 for lease residents; explicitly classify service-provider rank
  without giving it delegation rights. Unknown roles must fail authorization,
  rather than inherit the newly useful member defaults.

## Small implementation sequence and required evidence

1. **Effective access:** add one explicit policy evaluator and matching SQL
   contract for eligibility, time windows, overrides and age ceilings. Route
   `hasPermission`, `checkHomePermission`, `getUserAccess` and `/me` through it.
   Preserve current verified-owner and first-use behavior with dedicated tests;
   do not mass-retemplate occupancies or edit the immutable baseline.
2. **Reachable record boundaries:** fix tasks, calendar and dashboard to enforce
   operation plus record access. Preserve exact Home identity and retry states.
   Repair role/preset/delegation transactions and direct SQL mutation paths
   before adding management defaults.
3. **Add defaults:** create an additive migration only for the reviewed matrix.
   Insert absent rows; do not overwrite a pre-existing explicit role denial or
   any `HomePermissionOverride`. Produce before/after counts and an exact changed
   key list. Rehearse against both empty replay and a populated clone with custom
   grants/denies and minors before any hosted application.
4. **Acceptance:** use synthetic adult member, manager, restricted adult, teen,
   child, guest, pending claimant and outsider against two Homes. Verify UI access
   booleans, API data, SQL/PostgREST results and old-link behavior agree. Repeat
   ordinary tasks/calendar/docs without fixture-wide role overrides. Record
   source/runtime identity and clean exact fixtures; current storage byte tests
   remain valid evidence for storage, not for this new default policy.

Required regressions are behavioral, not assertions that implementation text
contains a particular string:

- Every matrix row with actual shipped reference data; no hidden test-only role
  seeds. Include legacy aliases and invalid roles.
- Verified, provisional, bootstrap, pending variants, explicit suspended/moved
  out/inactive statuses; future start and exact expiry boundaries for both pairs
  of timestamps. Rejected exact membership proof does not restore access.
- Adult/teen/child and unknown-age compatibility; stale true booleans, stale
  admin/owner roles and explicit grants cannot evade hard ceilings.
- Explicit denies survive defaults, preset retry and lookup failure. `/me`,
  dashboard, direct content and SQL resolve the same effective rights.
- Other people's tasks, manager/sensitive records, arbitrary recipients,
  visibility escalation, deleted/blocked notifications and removed membership.
  Calendar denies cover event detail, booking union, RSVP and changes, while
  the private creator's pickup workflow still works without ownership proof.
- Self-promotion, equal/higher target mutation, owner/powerful presets, ignored
  actor deny, minor role changes and direct authenticated table/RPC bypasses.
  Competing role/revocation/override writes either serialize or deny; failure
  leaves the previous complete policy intact.
- SQL clone tests retain original occupancies, age/status/times, documents,
  explicit overrides, balances and ownership rows across migration/retry.

No migration, new permission row, production reconciliation or global feature
flag change is part of this audit milestone. This is an actionable prerequisite
to normal Home acceptance, not evidence that all Home IAM has been repaired.
