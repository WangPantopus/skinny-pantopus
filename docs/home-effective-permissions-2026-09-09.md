# Home effective permissions — September 9, 2026

This source checkpoint repairs effective authorization before ordinary household
role defaults are expanded. No reference grant, hosted Home data, production
runtime or deployment flag changed. It is not complete Home release acceptance.

## Result

JavaScript and PostgreSQL now agree on known roles, verified/current occupancy,
both access windows, age ceilings, owner entitlement and explicit denies. Failed
permission reads return a retryable failure rather than falling through to a
base grant. Invalid or expired membership cannot be restored by a stale owner
pointer. Legacy null age retains the existing adult compatibility behavior.

The current-user permission response and web permission hooks use the effective
permission list. The repaired access, dashboard, finance and membership-review
consumers no longer recover a denied permission from ownership or stored flags.
Document visibility uses the effective role and sensitive permission ceiling.
Finance read permission remains separate from mutation permission: the legacy
`manage_finance` alias requires `finance.manage`.

Private first-use pickup remains available only to the exact provisional creator
without another occupant, authority or foreign schedule. Transactional RPCs lock
the relevant records and reject concurrent changes. This narrow entitlement does
not grant access to an established household. Existing private Unlisted progress
and verification status remain reachable without exposing household mail.

## Verification

- Full backend: **4,620 passed, 16 skipped**, 288 passing suites; privacy gates pass.
- Focused effective-policy and actual-handler regressions: **63 passed**.
- Web permission hooks: **29 passed**; full web TypeScript check passes.
- **19 SQL contracts** pass; generated pgTAP wrappers match their sources.
- The finance regression first reproduced a read-only viewer inserting a bill.
  After the repair, reads remain available, all six bill/subscription mutations
  deny, and the six matching finance-manager controls succeed. Fixtures roll back.
- Six competing private-pickup transactions pass; function lint reports zero
  errors across 126 functions and 73 trigger bindings, with five existing warnings.
- Independent review found no further blocker within this bounded checkpoint.

These are source/local database checks, not hosted ordinary-household acceptance.
Operator logs stay private outside Git.

## Required next work

Do not add ordinary role grants or claim full Home restrictions yet. Repair direct
Home/IAM mutation, delegation ceilings, the legacy preset RPC and transactional
Home deletion first. Replace overlapping financial RLS policies, including the
`manage_home` bypass and broad `FOR ALL` read behavior. Then align task/calendar
record visibility, authorship/assignment actions, attachment routes, dashboard
counts and notification recipients. Split finance read-only navigation from write
controls. Preserve an explicit private first-task path. Run real-role SQL and API
regressions, then review defaults and perform ordinary household acceptance.

PaymentSheet work remains separate in draft PR #31. Its current source checks
pass; actual native SDK acceptance and provider cleanup are still in progress.
