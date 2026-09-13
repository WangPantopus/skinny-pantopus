# Native Home effective navigation — September 9, 2026

Both native clients now use the effective permissions returned by
`GET /api/homes/:id/me` for the Home dashboard's tab strip and quick actions.
A person with `finance.view` can open Bills without `finance.manage`. Recorded
owner/admin roles, an empty permission list or a failed access read no longer
grant private navigation. Document and member-management helpers respect the
same rule. Packages use `packages.view`, distinct from mailbox access.

When a refresh loses a tab's permission, selection returns to Overview. An old
tab callback cannot select the now-unavailable section. The iOS Members fallback
can open its legacy owner-invitation form only with `ownership.manage`.

## Source and verification

- iOS: `HomeAdminDTOs.swift`, `HomeDashboardProjection.swift`,
  `HomeDashboardViewModel.swift` and its view binding.
- Android: `HomeAdminDtos.kt`, `HomeDashboardProjection.kt` and
  `HomeDashboardViewModel.kt`.
- **53 iOS simulator tests pass**: 5 navigation/document entry, 13 dashboard
  state transitions and 35 member-list cases. Changed-file SwiftFormat and
  strict SwiftLint pass.
- **54 Android JVM tests pass**: 5 navigation/document entry, 15 dashboard
  state transitions and 34 member-list cases. Formatting, `ktlintCheck`, Detekt
  and debug assembly pass under JDK 17.
- Independent review found no blocker in this bounded diff. Cases include
  missing/denied access, recorded owner/admin without a grant, finance viewer
  navigation, package/mailbox separation, member read/manage separation and
  access loss after selecting Bills.

## Remaining work and limits

This source checkpoint covers effective access helpers and dashboard navigation.
It does not complete Home client acceptance. Bill forms, mutation controls/FABs,
other direct/deep-link entry points, overview/hero/timeline/attention projections
and account-switch recovery still need their own boundary checks. Server-side
authorization remains required for every read and write. No new role defaults,
hosted Home migration or owner-device change ran. Full combined current-head CI
is required before source integration.
