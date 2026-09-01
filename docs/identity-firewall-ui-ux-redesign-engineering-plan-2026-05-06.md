# Identity Firewall UI/UX Redesign Engineering Plan

Last updated: 2026-05-06
Status: Research complete, ready for phased implementation
Primary source: `docs/identity-firewall-ui-ux-redesign-2026-05-06.md`
Related:

- `docs/pantopus-identity-firewall-engineering-design-2026-05-04.md`
- `docs/identity-firewall-migration-smoke-runbook-2026-05-05.md`

## 1. Goal

Implement the Identity Firewall redesign so users understand one thing quickly:

```text
Pantopus knows who I am. Other people only see the version of me I choose for this context.
```

The implementation must make the product feel simple and trustworthy while preserving the privacy guarantees already designed into the backend. This is not a cosmetic rename. It is an information architecture, copy, interaction, accessibility, and reliability pass across web and mobile.

## 2. Current Codebase Findings

The branch already has most of the backend and API foundation needed for the redesign:

- Backend serializers exist in `backend/serializers/identitySerializers.js`.
- Identity management API exists in `backend/routes/identityCenter.js`.
- Public profile APIs exist in `backend/routes/personas.js`, `backend/routes/localProfiles.js`, and `backend/routes/broadcastChannels.js`.
- Frontend API clients exist in `frontend/packages/api/src/endpoints/identityCenter.ts`, `frontend/packages/api/src/endpoints/personas.ts`, and `frontend/packages/api/src/endpoints/broadcast.ts`.
- Shared types exist in `frontend/packages/types/src/identity.ts`.
- Web and mobile already support local profile, public/persona profile, bridge settings, privacy preview, follower management, updates/broadcast, and persona composer payloads.

The highest UX debt is in naming, navigation, screen structure, and progressive disclosure.

## 3. UX Problems Confirmed In Code

### 3.1 Duplicated Navigation

Web:

- `frontend/apps/web/src/components/AppShell.tsx` shows a bottom sidebar item named `Identity`.
- `frontend/apps/web/src/app/(app)/app/profile/settings/page.tsx` separately exposes `Identity Center`, `Audience Profile`, and `Broadcast`.
- `/app/identity`, `/app/persona`, and `/app/persona/broadcast` are separate destinations with separate mental models.

Mobile:

- `frontend/apps/mobile/src/components/HamburgerMenu.tsx` exposes `Identity Center`, `Audience Profile`, and `Broadcast` as separate Manage items.
- `frontend/apps/mobile/src/components/IdentityProfileSwitcher.tsx` exposes `Audience Profile`.
- `frontend/apps/mobile/src/app/identity/index.tsx`, `persona.tsx`, and `broadcast.tsx` are separate management screens.

### 3.2 Internal Terminology Leaks

User-facing strings still include:

- `Identity Center`
- `Audience Profile`
- `Broadcast`
- `Bridges`
- `View As`
- `Advanced Privacy Preview`
- `Audience Members`
- `persona` in some public/mobile copy and debug language
- `surface` in preview copy

System terms can remain in API names, types, database records, and internal code. Product UI should map them to the redesign language.

### 3.3 Management Screens Are Too Dense

`frontend/apps/web/src/app/(app)/app/persona/page.tsx` and `frontend/apps/mobile/src/app/identity/persona.tsx` combine:

- setup/edit fields
- media upload
- category policy
- sensitive professional category policy
- audience label
- audience mode
- public links
- copy/view actions
- updates/broadcast entry
- follower management

This should become a first-time setup stepper and task-based existing-profile tabs.

### 3.4 Privacy Preview Is Almost Ready But Under-positioned

Backend preview is real and useful. It already returns:

- `viewerLabel`
- `visibleSections`
- `protectedSections`
- `counts`
- `sample.posts`
- `sample.broadcasts`

Web hides non-public viewers behind `Advanced Privacy Preview` in `frontend/apps/web/src/app/(app)/app/identity/page.tsx`.

Mobile shows viewer chips, but does not filter viewer choices by selected profile relevance and still uses labels such as `Audience`.

### 3.5 Profile Links Need Explicit Confirmation

Bridge APIs are available:

- `PATCH /api/identity-center/bridges/:personaId`
- API client `updateBridgeSettings`

Current UI toggles immediately:

- Web: direct toggle in `identity/page.tsx`
- Mobile: optimistic `Switch` in `identity/index.tsx`

The redesign requires confirmation before enabling and clear confirmation when disabling.

### 3.6 Composer Has The Right Payload Model But A Noisy UI

Web `frontend/apps/web/src/components/feed/PostComposer.tsx` already supports:

- `postAs: persona`
- `identityContextId`
- persona audience options `followers` and `public`
- no location for persona posts
- invalid identity/post-type protection

Mobile `frontend/apps/mobile/src/hooks/feed/usePostComposer.ts` also strips local location fields for persona posts.

The remaining work is UX:

- Replace chip rows with a short summary.
- Use `Posting as` and `Visible to`.
- Move detailed selection into a focused picker.
- Rename feed tab `Audience` to `Public Profiles` or `Profiles`.

### 3.7 Public Pages Need Visitor-first Polish

Public persona page:

- Web: `frontend/apps/web/src/app/persona/[personaHandle]/AudienceProfileClient.tsx`
- Mobile: `frontend/apps/mobile/src/app/persona/[personaHandle].tsx`

Local profile page:

- Web: `frontend/apps/web/src/app/local/[localHandle]/LocalProfileClient.tsx`
- Mobile: `frontend/apps/mobile/src/app/local/[localHandle].tsx`

Current gaps:

- Owner actions are visible in the sticky nav area and use old `Broadcast` wording.
- Public local page links to `Identity Center` in public nav, even for visitors.
- Web local `Connect` and `Message` buttons appear inert instead of being hidden or wired by permission.
- Bridge labels still say `Audience Profile`.

### 3.8 Feature Flags Default On

Current files default identity features on when env vars are missing:

- `frontend/apps/web/src/lib/featureFlags.ts`
- `frontend/apps/mobile/src/lib/featureFlags.ts`
- `backend/utils/featureFlags.js`

The redesign spec recommends explicit production enablement. This needs an environment-aware default strategy so development and staging can stay convenient without accidentally turning production on.

## 4. Product Naming Map

Use the new label in normal product UI. Keep current names in code where renaming would increase risk.

| System or current term | User-facing term |
| --- | --- |
| Identity Center | Profiles & Privacy |
| Audience Profile | Public Profile |
| Persona | Public Profile |
| Broadcast | Updates |
| Broadcast message | Update |
| Bridges | Profile links |
| View As Preview | Privacy Preview |
| Audience Members | Followers, or selected audience label |
| Surface | Profile or place, depending context |
| Identity Firewall | Profiles & Privacy or privacy system |

## 5. Recommended Architecture For The Redesign

### 5.1 Keep Routes Stable Initially

Use existing routes in the first implementation pass:

- Web management shell: keep `/app/identity`, title it `Profiles & Privacy`.
- Web public profile editor: keep `/app/persona`, label it `Public Profile`.
- Web updates route: keep `/app/persona/broadcast`, label it `Updates`.
- Mobile management shell: keep `/identity`, title it `Profiles & Privacy`.
- Mobile editor: keep `/identity/persona`, label it `Public Profile`.
- Mobile updates: keep `/identity/broadcast`, label it `Updates`.

Add `/app/profiles` and mobile route aliases later only if product wants route cleanup. Route churn is not necessary for the user-facing redesign.

### 5.2 Add Shared Copy Helpers Before Large Refactors

Create small UI-only label helpers to avoid repeated string drift:

- Web candidate: `frontend/apps/web/src/lib/identityLabels.ts`
- Mobile candidate: `frontend/apps/mobile/src/utils/identityLabels.ts`
- Shared package candidate if both platforms need the exact same mapping: `frontend/packages/ui-utils/src/identity-labels.ts`

Recommended minimum exports:

```ts
export const identityCopy = {
  profilesPrivacyTitle: 'Profiles & Privacy',
  publicProfile: 'Public Profile',
  updates: 'Updates',
  profileLinks: 'Profile links',
  privacyPreview: 'Privacy Preview',
};

export function audienceLabelSingular(label?: string | null): string;
export function audienceLabelPlural(label?: string | null): string;
export function viewerLabel(viewer: string, audienceLabel?: string | null): string;
```

Do not rename backend `persona`, `broadcast`, or `bridge` records in this UI pass.

### 5.3 Use Existing Archetype Primitives Where Practical

Reusable components already exist:

- Web `TabStrip`: `frontend/apps/web/src/components/archetypes/primitives/TabStrip.tsx`
- Web `ProgressSegments`: `frontend/apps/web/src/components/archetypes/primitives/ProgressSegments.tsx`
- Mobile `TabStrip`: `frontend/apps/mobile/src/components/archetypes/primitives/TabStrip.tsx`
- Mobile `ProgressSegments`: `frontend/apps/mobile/src/components/archetypes/primitives/ProgressSegments.tsx`

Use these for the management tabs and setup stepper where they fit. Avoid building a second tab/stepper pattern unless the existing primitive blocks required accessibility or layout behavior.

## 6. Implementation Phases

### Phase 0: Safety, Copy, And Navigation Cleanup

Goal: collapse duplicate destinations and remove the worst terminology leaks without changing behavior.

Primary files:

- `frontend/apps/web/src/lib/featureFlags.ts`
- `frontend/apps/mobile/src/lib/featureFlags.ts`
- `backend/utils/featureFlags.js`
- `frontend/apps/web/src/components/AppShell.tsx`
- `frontend/apps/web/src/app/(app)/app/profile/settings/page.tsx`
- `frontend/apps/mobile/src/components/HamburgerMenu.tsx`
- `frontend/apps/mobile/src/components/IdentityProfileSwitcher.tsx`
- related tests

Acceptance:

- Web sidebar says `Profiles & Privacy`.
- Web settings has one `Profiles & Privacy` entry, not three identity rows.
- Mobile Manage menu has one `Profiles & Privacy` entry, not separate Identity/Public Profile/Updates rows.
- Mobile profile switcher says `Public Profile`.
- Production feature flags do not silently enable if no env var is set.

Notes:

- Be careful with tests that intentionally assert route names.
- Keep settings Privacy page separate from Profiles & Privacy. It handles account privacy and blocking; Profiles & Privacy handles identity presentation.

### Phase 1: Profiles & Privacy Shell

Goal: make `/app/identity` and `/identity` feel like one coherent destination.

Primary files:

- `frontend/apps/web/src/app/(app)/app/identity/page.tsx`
- `frontend/apps/mobile/src/app/identity/index.tsx`

Recommended tabs:

```text
Overview
Public Profile
Profile Links
Privacy Preview
Followers
Updates
```

Behavior:

- If no Public Profile exists, show Overview and Public Profile setup CTA.
- Disable or hide Followers and Updates until a Public Profile exists.
- Keep Privacy Preview visible when there is any public-facing profile.
- Keep Profile Links visible but disable controls until required profiles exist.

Acceptance:

- The first screen answers what is private, what neighbors see, what followers see, and whether profiles are linked.
- There is one recommended next action.
- Advanced controls do not dominate the first viewport.

### Phase 2: Privacy Preview Redesign

Goal: make preview central, fast, and understandable.

Primary files:

- `frontend/apps/web/src/app/(app)/app/identity/page.tsx`
- `frontend/apps/mobile/src/app/identity/index.tsx`
- `backend/routes/identityCenter.js` only if copy returned by backend must change

Required changes:

- Rename `View As` to `Privacy Preview`.
- Remove `Advanced Privacy Preview` gate on web.
- Show relevant viewer presets for selected profile:
  - Local Profile: Public, Neighbor, Connection, Household, Gig participant
  - Public Profile: Public, Follower or selected label
- Use `Visible to this viewer` and `Kept private from this viewer`.
- Replace `broadcast` in preview UI with `updates`.
- Show profile-link warnings when a link is visible.

Acceptance:

- User can preview follower view without opening an advanced section.
- UI clearly shows both visible and hidden information.
- Backend preview remains the source of truth.

### Phase 3: Profile Links

Goal: replace Bridges with explicit, reversible profile links.

Primary files:

- `frontend/apps/web/src/app/(app)/app/identity/page.tsx`
- `frontend/apps/mobile/src/app/identity/index.tsx`

Required changes:

- Rename section to `Profile links`.
- Show two directional controls:
  - `Let neighbors find my Public Profile`
  - `Let followers find my Local Profile`
- Confirm before enabling either direction.
- Confirm or clearly acknowledge disabling.
- On failure, revert UI state and show error.
- Offer `Preview after linking`.

Acceptance:

- Enabling a link requires an explicit confirmation.
- The user sees who can discover what before the link changes.
- Mobile no longer silently flips a switch without confirmation.

### Phase 4: Public Profile Setup Stepper

Goal: turn first-time setup from a long admin form into a guided publish flow.

Primary files:

- `frontend/apps/web/src/app/(app)/app/persona/page.tsx`
- `frontend/apps/mobile/src/app/identity/persona.tsx`

First-time steps:

1. Basics: display name, handle, avatar, banner, bio, public links
2. Audience: audience label, follow mode, optional category
3. Preview: realistic public profile preview and profile-link-off confirmation

Important behavior:

- Sensitive categories should be behind an informational affordance:
  `Need a healthcare, legal, classroom, or minor-facing profile?`
- Do not block low-risk setup with sensitive policy grids.
- Keep save/publish status inline.
- Normalize public links to `https://`.

Acceptance:

- A new user can publish a Public Profile in three steps or fewer.
- Profile links are clearly off by default.
- The user previews before publishing.

### Phase 5: Existing Public Profile Management Tabs

Goal: make maintenance task-based for users who already have a Public Profile.

Primary files:

- `frontend/apps/web/src/app/(app)/app/persona/page.tsx`
- `frontend/apps/mobile/src/app/identity/persona.tsx`

Recommended sections:

```text
Profile details
Audience settings
Preview
```

Move out of this long form:

- Followers management
- Updates management
- Profile links

Acceptance:

- Existing users can edit details without passing follower management.
- `View Public Profile` appears in a stable place, not repeated in header, success banner, body, and footer.

### Phase 6: Followers Management

Goal: make access management simple and pending-first.

Primary files:

- Web current component inside `frontend/apps/web/src/app/(app)/app/persona/page.tsx`
- Mobile current component inside `frontend/apps/mobile/src/app/identity/persona.tsx`

Recommended implementation:

- Extract dedicated components:
  - Web: `frontend/apps/web/src/app/(app)/app/identity/_components/FollowersPanel.tsx` or colocated under persona if tabs remain split
  - Mobile: `frontend/apps/mobile/src/app/identity/_components/FollowersPanel.tsx`
- Use segmented controls for Active, Pending, Muted, Blocked.
- Pending requests appear first.
- Remove and Block require confirmation.
- Row-level loading stays visible.

Acceptance:

- Pending followers are prominent.
- Counts update after actions, either from response or reload.
- Destructive actions cannot be triggered accidentally.

### Phase 7: Updates

Goal: rename Broadcast to Updates and integrate it into the management mental model.

Primary files:

- `frontend/apps/web/src/app/(app)/app/persona/broadcast/page.tsx`
- `frontend/apps/mobile/src/app/identity/broadcast.tsx`
- Public pages showing broadcasts

Required changes:

- Page title: `Updates`
- Action: `Post update`
- Composer label: `Visible to: Followers` or `Visible to: Public`
- Button: `Post update`
- Recent section: `Recent updates`
- Metrics: `Updates`, `Delivered`, `Reads`
- Public warning for public visibility:
  `Anyone with the link can see this update.`

Acceptance:

- No primary UI says Broadcast.
- Existing API remains `broadcast`.
- New update appears at top after publishing.

### Phase 8: Composer Identity UX

Goal: make posting identity and visibility obvious at the moment of creation.

Primary files:

- Web: `frontend/apps/web/src/components/feed/PostComposer.tsx`
- Mobile: `frontend/apps/mobile/src/components/feed/PostComposerModal.tsx`
- Mobile picker: `frontend/apps/mobile/src/components/feed/PostTargetPicker.tsx`
- Mobile hook: `frontend/apps/mobile/src/hooks/feed/usePostComposer.ts`
- Feed tabs: `frontend/apps/web/src/app/(app)/app/feed/page.tsx`
- Mobile tabs: `frontend/apps/mobile/src/components/feed/FeedSurfaceTabs.tsx`

Required UX:

```text
Posting as: Maya Builds
Visible to: Followers
Change
```

The Change picker should expose:

- Post as: Personal, Local Profile, Public Profile, Home, Business
- Visible to: Nearby, Followers, Connections, Household, Public
- Only valid combinations for the selected identity

Acceptance:

- Persona/Public Profile posts never request location.
- Invalid identity/audience combinations are not selectable.
- Final API payload matches visible `Posting as` and `Visible to`.
- Feed tab `Audience` becomes `Public Profiles` or `Profiles`.

### Phase 9: Public Pages Polish

Goal: public pages feel like visitor-facing profiles, not management consoles.

Primary files:

- `frontend/apps/web/src/app/persona/[personaHandle]/AudienceProfileClient.tsx`
- `frontend/apps/web/src/app/local/[localHandle]/LocalProfileClient.tsx`
- `frontend/apps/mobile/src/app/persona/[personaHandle].tsx`
- `frontend/apps/mobile/src/app/local/[localHandle].tsx`

Required changes:

- Rename Audience Profile to Public Profile.
- Rename Broadcasts to Updates.
- Group owner actions in a toolbar or action menu.
- Do not show management links to non-owners.
- Local Profile only links to Public Profile when enabled.
- Public Profile only links to Local Profile when enabled.
- Hide or wire Connect and Message actions. Do not show inert buttons.

Acceptance:

- Non-owner visitors see a clean public page.
- Owner tools are available but visually secondary.
- Profile-link behavior obeys backend bridge settings.

### Phase 10: Analytics, Accessibility, And QA

Goal: verify the redesign as a product-critical privacy workflow.

Analytics:

- No broad generic analytics client is currently obvious in web.
- Mobile has mailbox-specific analytics helpers.
- Recommendation: create a small best-effort identity analytics wrapper only after product confirms event sink.

Accessibility:

- Web toggles, tabs, segmented controls, and modals must be keyboard reachable.
- Confirmation modals must trap focus and return focus to the trigger.
- Mobile touch targets must be at least 44 points.
- Toggle labels must be complete when read alone.
- Status messages should use `aria-live` on web.

QA:

- Update web unit tests in `frontend/apps/web/tests/identityFirewallWeb.test.tsx`.
- Update web e2e in `frontend/apps/web/tests/e2e/identity-firewall.spec.ts`.
- Update mobile tests in `frontend/apps/mobile/src/app/identity/__tests__/personaNavigation.test.tsx`.
- Keep backend unit privacy tests green.

## 7. Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Terminology changes break tests only by copy | Medium noise | Update tests phase by phase with explicit old-to-new mapping. |
| Feature flag defaults change dev/staging behavior | Medium | Use environment-aware defaults, document env vars, and test explicit true/false cases. |
| Profile link optimistic UI shows wrong privacy state after failure | High | Confirm first, then update; revert on failure; reload identity center after save. |
| First-time setup stepper accidentally drops media upload or public links | High | Preserve existing save/upload flow; add tests for media and links. |
| Followers moved out of form and counts go stale | Medium | Reload followers after actions until API returns updated counts. |
| Composer redesign changes payload semantics | High | Keep payload builder logic intact; add tests asserting persona has no location fields and correct visibility. |
| Public pages expose owner tooling to visitors | High | Gate owner toolbar strictly on `viewer.isOwner`; add public visitor tests. |
| Backend preview copy still says Audience/Broadcast | Low to medium | Prefer UI mapping first; adjust backend labels only if copy cannot be mapped cleanly. |
| Mobile dense chips wrap badly | Medium | Use bottom sheets and existing `TabStrip`; test small-screen dynamic text. |

## 8. Test Strategy

### Web Unit And Integration

Run from `frontend/apps/web`:

```bash
pnpm test -- identityFirewallWeb.test.tsx
pnpm type-check
pnpm lint
```

Coverage to update or add:

- Profiles & Privacy replaces Identity Center in normal UI.
- Settings shows one Profiles & Privacy row.
- Privacy Preview viewer buttons are visible without advanced toggle.
- Profile link confirmation appears before update.
- Public Profile setup stepper validates required fields and saves.
- Updates page posts update and updates metrics.
- Composer submits persona/Public Profile payload with `audience: followers`, `postAs: persona`, and no location.
- Public pages hide owner management links for non-owners.

### Web E2E

Run from `frontend/apps/web`:

```bash
pnpm test:e2e -- tests/e2e/identity-firewall.spec.ts
```

Update the existing mocked identity test to cover:

- Profiles & Privacy overview route
- Public Profile setup or management route
- Privacy Preview follower viewer
- Profile Links confirmation
- Updates publish flow

### Mobile Tests

Run from `frontend/apps/mobile`:

```bash
pnpm test -- identity
pnpm test -- useFeedData.compose
```

Coverage to update or add:

- Hamburger menu has one Profiles & Privacy item.
- Profile switcher says Public Profile.
- Public Profile editor keeps a clear view action after save.
- Profile link confirmation before enabling.
- Updates page uses Post update copy.
- Persona/Public Profile composer payload still strips local location fields.

### Backend Tests

Run from `backend`:

```bash
pnpm test -- identityFirewall
pnpm test -- personaCompliance
```

Backend changes should be minimal. If feature flag defaults change, update tests around:

- `IDENTITY_FIREWALL_ENABLED`
- `PERSONA_ENABLED`
- `PERSONA_BROADCAST_ENABLED`

## 9. Suggested First Implementation PR

Start with a tight PR that proves the direction without touching data flow:

1. Add shared UI label helpers.
2. Rename navigation and settings labels.
3. Collapse web settings identity rows into one Profiles & Privacy row.
4. Collapse mobile hamburger Manage identity rows into one Profiles & Privacy row.
5. Rename AppShell bottom sidebar `Identity` to `Profiles & Privacy`.
6. Rename mobile profile switcher `Audience Profile` to `Public Profile`.
7. Update tests that assert these labels.

This first PR should not change the identity center layout, persona editor, bridge behavior, composer, or public pages. It lowers user confusion immediately and creates a stable naming foundation for the larger screen refactors.

## 10. Final Acceptance Checklist

The redesign is complete when:

- Normal UI no longer shows `Identity Center`, `Audience Profile`, `Broadcast`, `Bridges`, `View As`, `Surface`, or `Identity Firewall`.
- Profiles & Privacy is the single management destination.
- Public Profile creation is a three-step guided flow.
- Profile links require confirmation and explain directionality.
- Privacy Preview is prominent and shows visible plus hidden sections.
- Followers management is pending-first and destructive actions are confirmed.
- Updates are posted from Public Profile management with clear visibility.
- Composer always shows Posting as and Visible to before submit.
- Public pages are visitor-first and owner actions are grouped.
- Web and mobile use the same mental model and labels.
- The identity firewall backend remains the source of truth for visibility.
