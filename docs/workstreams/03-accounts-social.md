# Stream 3 — Accounts, social and notifications

Updated September 15, 2026. Owner: accounts/social stream (`/root/accounts_social`).
State: discovery complete; next baseline verification is queued.

Acknowledged the clarified [working agreement](README.md#working-agreement) and
[reuse rules](../../AGENTS.md#verify-existing-work-before-changing-it): preserve
iOS/Android/web appearance, verify existing journeys, repair proven failures in
place and retest; justify any new/replacement artifact, reuse accepted evidence,
and label unverified provider/device boundaries.

## Scope and source

- Inventory: N01–N05 and A01–A05. First milestone: N04, existing personal profile
  block → direct-message admission → owned unblock, including current room entry.
- Worktree: `/private/tmp/pantopus-workstream-accounts-social`.
- Branch: `codex/workstream-accounts-social`; verified clean at master
  `e775af9ae393c1e961df8f0043e3aed734326196` during setup.
- Generic A03 storage/upload services require coordinator ownership. Route A05
  feature-specific cases to the relevant stream; this scope does not take over
  Home or payment workflows. Final release/device acceptance remains separate.

## Existing implementation and reusable evidence

- Native PublicProfile calls POST `/api/users/:userId/block` through existing
  Blocks endpoints/repository. `backend/routes/blocks.js` writes/lists/deletes
  `UserBlock`; `backend/services/blockService.js` caches bidirectional admission.
- `backend/routes/chats.js` checks direct creation and message sending;
  `backend/socket/chatSocketio.js` checks socket direct creation. The canonical
  baseline already defines UserBlock, directional uniqueness and owner RLS.
- Native Settings → Blocked users reads/deletes `UserProfileBlock` through
  `/api/privacy/blocks`; Connections separately uses `Relationship`. Personal
  unblock intentionally retains propagated PersonaBlock rows. Direct-message
  checks explicitly exclude gig/group chats; do not expand that policy here.
- Existing `backend/tests/integration/chatAccessControl.test.js` covers UserBlock
  creation/send denial with an in-memory database. Native PublicProfile and
  BlockedUsers model tests cover their separate request and rollback contracts.
- Preserve [chat continuation](../chat-notification-continuation-2026-09-09.md)
  and [Beacon access evidence](../beacon-full-journey-2026-09-08.md) within their
  limits. The inspected personal block routes/service and native profile,
  blocked-list and chat models are unchanged from chat source `699c531a86`.
  Those reports do not prove the complete personal block/unblock journey.

## Owned candidate files and boundaries

Conditional repair candidates, only after reproduction:

- `backend/routes/blocks.js`, `backend/services/blockService.js`,
  `backend/routes/chats.js`, `backend/tests/integration/chatAccessControl.test.js`.
- `frontend/apps/ios/Pantopus/Features/Settings/Blocks/BlockedUsersViewModel.swift`
  and `frontend/apps/ios/PantopusTests/Features/Settings/BlockedUsersViewModelTests.swift`.
- `frontend/apps/android/app/src/main/java/app/pantopus/android/ui/screens/settings/blocks/BlockedUsersViewModel.kt`
  and `frontend/apps/android/app/src/test/java/app/pantopus/android/ui/screens/settings/blocks/BlockedUsersViewModelTest.kt`.

These candidates are unchanged from master to paid integration `3e93cd167`.
Existing profile callers and endpoint adapters are dependencies; no edit is
proposed yet. Socket source and `backend/tests/e2e/chatSocket.test.js` contain
Stream 1's private-Gig delivery additions: request coordinator ownership before
editing either. Shared auth, navigation, notifications and schema remain coordinated.

## Findings, unknowns and next verification

The profile's UserBlock write and Settings' UserProfileBlock reader are a source
mismatch to reproduce, not a demonstrated defect or permission to unify tables.
No complete personal profile block → Settings unblock → direct-message acceptance
report was found. Existing room entry does not imply a promise to hide old messages.

Next: with isolated synthetic personal accounts, exercise the existing block and
own-list routes, direct creation/send denial in both directions, owner-only
unblock and restored admission when no reverse block remains. Check warm-cache
transitions and inspect Settings after that same profile block. Verify old-room
entry against current membership; reuse accepted session-continuation evidence.

Completion criterion: source-bound actual route/persistence proof and one existing
screen journey, no denied message/notification side effects, exact fixture cleanup,
and focused regressions for any demonstrated repair. Preserve layouts and existing
block scopes. Broader reporting/moderation and final-release N04 remain open.

## Coordination and handoff

- Resources reserved: none. Obtain a reservation before runtime or fixture use.
- Blocker: none for baseline planning; socket edits need coordinator assignment.
- Setup changes: this status document only; no application changes or tests run.
- Next action: reserve the bounded fixture and run the baseline before any repair.
- Peer request: retain paid socket changes; no notification/session rebuild planned.
