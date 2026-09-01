# Identity Firewall Profile Discovery Design

Date: 2026-05-07

Related docs:

- `docs/pantopus-identity-firewall-engineering-design-2026-05-04.md`
- `docs/identity-firewall-ui-ux-redesign-2026-05-06.md`
- `docs/identity-firewall-ui-ux-redesign-engineering-plan-2026-05-06.md`
- `docs/identity-firewall-migration-smoke-runbook-2026-05-05.md`

## Summary

Pantopus should stop using general user search as the product search surface for Identity Firewall profiles.

The product model is:

- A private account is the real user record.
- A Local Profile is the nearby identity.
- A Public Profile is the audience/follower identity.
- A Business/Home identity is a separate acting context.

Search should reflect that model. Users should search for profiles, not raw users, when they are in discovery surfaces. Recipient and invite flows can continue to search accounts.

## Implementation Status

Implemented in this branch:

- Added `GET /api/identity/search` for profile-safe Local Profile and Public Profile discovery.
- Mounted the endpoint behind the existing Identity Firewall feature flag.
- Migrated Discover profile search away from `/api/users/search`.
- Replaced the Discover `People` scope with separate `Local Profiles` and `Public Profiles` scopes.
- Routed global app search to `/app/discover?q=...` instead of the legacy Network account-search page.
- Preserved account lookup search for chat, mailbox, home invites, business team invites, and admin/account flows.
- Added backend tests covering raw `User` field non-discovery, local/public bridge opt-ins, local search privacy, public profile `is_searchable`, and search-only blocks.
- Added web tests covering the profile-safe Discover search API and Public Profile result rendering.

Still intentionally future work:

- Public Profile search visibility schema (`PublicPersona.search_visibility`) beyond the existing `is_searchable` boolean.
- Dedicated search settings UI for Local Profile and Public Profile discoverability.
- Network page cleanup after product decides whether Network remains local/account-oriented or becomes another profile-discovery surface.
- Homes as first-class identity search results.
- Search analytics, subject to privacy review for query logging.

## Problem

User A can have:

- A Local Profile for neighbors, local posts, gigs, marketplace, reviews, and nearby trust.
- A Public Profile for followers, clients, students, patients, customers, subscribers, members, or public updates.

A may want any combination of these:

- Neighbors can find A's Local Profile.
- Neighbors cannot discover A's Public Profile from A's local identity.
- Public audience can find A's Public Profile by public handle or public display name.
- Public audience can optionally discover A's Local Profile if A chooses to expose it.
- A's Public Profile may use a sensitive category, pseudonym, distinct avatar, or public brand.

Before this branch, the app could not model that cleanly in search because `/api/users/search` searched the `User` table and returned person results. That endpoint is still used by Network, chat, mailbox, home invites, and team invite flows. Updating it to return Public Profiles would risk mixing public audience identities with account lookup.

## Current Codebase State

Existing primitives:

- `LocalProfile` has `handle`, `display_name`, public locality fields, profile visibility, and `search_visibility`.
- `PublicPersona` has `handle`, `display_name`, `bio`, public links, audience label/mode, follower counts, status, and `is_searchable`.
- `IdentityBridgeSetting` has `show_persona_on_local` and `show_local_on_persona`.
- `serializeLocalProfileForViewer()` and `serializeAudienceProfileForViewer()` already produce safe public identity shapes.
- `/local/:handle` serves Local Profile pages.
- `/@:handle` rewrites to `/persona/:handle` and serves Public Profile pages.
- Public pages already honor bridge settings:
  - Local Profile shows Public Profile only when `show_persona_on_local` is on.
  - Public Profile shows Local Profile only when `show_local_on_persona` is on.

Previous search behavior before this branch:

- `frontend/apps/web/src/components/discover/useUniversalSearch.ts` calls `api.users.searchUsers()` for people.
- `api.users.searchUsers()` calls `GET /api/users/search`.
- `backend/routes/users.js` searches `User.username`, `User.name`, `first_name`, `last_name`, and `email`.
- Discover search maps those user results to `type: 'person'`, `href: /${username}`.
- Network search also uses `api.users.searchUsers()` and adds account relationship actions.
- Chat, mailbox, home invite, and team invite flows also use `api.users.searchUsers()` or equivalent account lookup.

That meant Public Profiles were not first-class search results before this branch.

## Product Principle

Search results must represent identities, not private accounts.

Rules:

1. Local Profile and Public Profile are independently searchable.
2. Search must not infer or reveal that two profiles belong to the same account unless A explicitly enabled that direction of profile link.
3. Public Profile search must not search the owner's raw `User` name, email, username, city, or state.
4. Local Profile search must not search Public Profile fields unless `show_persona_on_local` is enabled.
5. Public Profile search must not search Local Profile fields unless `show_local_on_persona` is enabled.
6. Direct profile URLs remain separate from search visibility. A profile can be reachable by direct link but not returned in search.
7. Recipient/invite flows may search account records, but must not present that as public profile discovery.

## Search Surfaces

### Profile Discovery Search

Used by:

- Discover page
- Public Profile discovery
- Local Profile discovery
- Feed/profile search entry points that are about finding someone to follow or view

Should call a new endpoint:

```http
GET /api/identity/search?q=maya&scope=all&limit=20
```

Implemented endpoint scopes:

```text
all
local_profiles
public_profiles
```

Discover still composes businesses, tasks, and listings client-side through their existing endpoints. Homes remain future work.

Planned broader discovery scopes:

```text
businesses
homes
tasks
listings
```

The important part is that people/profile discovery no longer uses `/api/users/search`.

### Account Lookup Search

Used by:

- Chat recipient search
- Mail recipient search
- Home member invites
- Business team invites
- Admin/account management flows

Should continue to use `/api/users/search`, but the API and frontend copy should treat it as account lookup, not public discovery.

## Discovery Result Model

Add a shared result type to `frontend/packages/types/src/identity.ts` or a new discovery type file.

```ts
export type ProfileDiscoveryResultType =
  | 'local_profile'
  | 'public_profile'
  | 'business'
  | 'home'
  | 'task'
  | 'listing';

export interface ProfileDiscoveryResult {
  id: string;
  type: ProfileDiscoveryResultType;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  imageUrl?: string | null;
  href: string;
  badges?: string[];
  action?: {
    kind: 'open' | 'follow_public_profile' | 'follow_local_profile' | 'connect' | 'claim_home';
    label: string;
    disabled?: boolean;
    state?: string | null;
  };
  linkedProfile?: {
    type: 'local_profile' | 'public_profile';
    title: string;
    href: string;
  } | null;
}
```

Local Profile result:

```json
{
  "type": "local_profile",
  "title": "Michael Doe",
  "subtitle": "/local/ypantopus",
  "meta": "Seattle, WA",
  "href": "/local/ypantopus",
  "badges": ["verified_resident"],
  "action": { "kind": "connect", "label": "Connect" }
}
```

Public Profile result:

```json
{
  "type": "public_profile",
  "title": "Popular guy",
  "subtitle": "@popularguy",
  "meta": "0 followers",
  "href": "/@popularguy",
  "action": { "kind": "follow_public_profile", "label": "Follow" }
}
```

If profile links are enabled, add the linked profile as secondary metadata only in the allowed direction.

## Visibility Contract

### Local Profile

Search source:

- `LocalProfile.handle`
- `LocalProfile.display_name`
- optionally `LocalProfile.tagline`
- optionally public locality fields

Visibility:

- `search_visibility = everyone`: discoverable to authenticated searchers.
- `search_visibility = mutuals`: discoverable only to accepted connections or another locally trusted relationship.
- `search_visibility = nobody`: excluded from profile discovery search.
- Existing block rules must apply.
- Exact home address is never searched or returned.

Bridge behavior:

- If `show_persona_on_local = true`, Local Profile result can show a secondary "Public Profile" link.
- If false, no Public Profile hint appears, even if the same account has an active searchable Public Profile.

### Public Profile

Search source:

- `PublicPersona.handle`
- `PublicPersona.display_name`
- optionally `PublicPersona.bio`
- optionally `PublicPersona.category`
- never `User.email`
- never owner `User.username`
- never owner `User.name`
- never owner `LocalProfile.display_name`
- never owner local city/state

Visibility:

- `status = active`
- `is_searchable = true`
- blocked viewers are excluded where applicable
- `audience_mode = invite_only` can still be discoverable if `is_searchable = true`, but the action should be "Request access" or "Open", not direct active follow.

Bridge behavior:

- If `show_local_on_persona = true`, Public Profile result can show a secondary "Local Profile" link.
- If false, no Local Profile hint appears.

Recommended near-term schema improvement:

```sql
ALTER TABLE "PublicPersona"
ADD COLUMN IF NOT EXISTS search_visibility text NOT NULL DEFAULT 'everyone'
CHECK (search_visibility IN ('everyone', 'direct_link', 'nobody'));
```

Then treat the current `is_searchable` as compatibility:

- `is_searchable = true` maps to `search_visibility = everyone`.
- `is_searchable = false` maps to `search_visibility = direct_link`.

Reason: a boolean does not distinguish "not in search but direct link works" from "not publicly discoverable at all."

## UX Design

### Discover Page

Replace the current People tab with profile-aware tabs:

```text
All
Local Profiles
Public Profiles
Businesses
Homes
Tasks
Listings
```

If this is too wide for mobile, use:

```text
All
Local
Public
Businesses
More
```

Cards must be visibly different:

- Local Profile: nearby/trust icon, local handle, city/state/neighborhood-safe metadata.
- Public Profile: broadcast/follow icon, `@handle`, follower count and audience label.
- Business: store icon.
- Home: home icon.

Do not show a merged "Michael Doe / Popular guy" card unless a bridge explicitly allows it.

### Search Input Guidance

Use context-specific placeholder copy:

- All: `Search profiles, businesses, homes, tasks, or listings`
- Local Profiles: `Search nearby profiles`
- Public Profiles: `Search public handles, creators, teachers, clients, or communities`

Avoid "Search people" for profile discovery, because it implies raw accounts.

### Empty States

Local Profiles empty:

```text
No Local Profiles found.
Try a local display name or handle.
```

Public Profiles empty:

```text
No Public Profiles found.
Try a public handle, profile name, or category.
```

### Privacy Settings Copy

In Profiles & Privacy, add explicit discoverability settings separate from profile links.

Local Profile:

```text
Who can find my Local Profile in search?
[Everyone on Pantopus] [Connections only] [Nobody]
```

Public Profile:

```text
Who can find my Public Profile in search?
[Everyone] [Direct link only] [Hidden from search]
```

Profile links remain directional:

```text
Let neighbors find my Public Profile
If on, your Local Profile will show a link to your Public Profile.

Let followers find my Local Profile
If on, your Public Profile will show a link to your Local Profile.
```

Add a clarifying note:

```text
Search and profile links are separate. A searchable Public Profile can still be found in Public Profile search, but it will not be connected to your Local Profile unless you link it.
```

## Backend API Design

### New Route

Create `backend/routes/identitySearch.js`.

Mount:

```js
app.use('/api/identity', identitySearchRoutes);
```

Endpoint:

```http
GET /api/identity/search?q=<query>&scope=all|local_profiles|public_profiles&limit=20
```

Authentication:

- Require `verifyToken` for app discovery.
- Optional future: allow unauthenticated Public Profile search only if product wants web-indexed discovery.

Flow:

1. Validate `q.length >= 2`.
2. Normalize query and tokens.
3. For local scope:
   - Query `LocalProfile`.
   - Apply `search_visibility`.
   - Apply `UserProfileBlock` and legacy block checks.
   - Serialize with `serializeLocalProfileForViewer()`.
   - Attach bridge persona only if `show_persona_on_local`.
4. For public profile scope:
   - Query `PublicPersona`.
   - Require active status.
   - Require searchable status.
   - Do not join `User` for searchable text.
   - Serialize with `serializeAudienceProfileForViewer()`.
   - Attach bridge local profile only if `show_local_on_persona`.
   - Include viewer follow state from `PersonaFollow`.
5. Score and combine results.
6. Return a typed result list.

### Response Shape

```json
{
  "results": [],
  "counts": {
    "local_profiles": 0,
    "public_profiles": 0,
    "businesses": 0,
    "homes": 0
  }
}
```

### Ranking

Within each type:

1. Exact handle match.
2. Handle prefix match.
3. Exact display name match.
4. Display name prefix match.
5. Token match.
6. Relevance boosters:
   - Local Profile: verified resident badge, connection/relationship proximity, locality match.
   - Public Profile: follower count, credential status, public category match.

Across `all` scope, preserve type diversity:

- Show up to 3 Local Profiles.
- Show up to 3 Public Profiles.
- Show up to 3 Businesses.
- Then fill remaining slots by score.

This avoids Public Profiles burying local identity results or vice versa.

## Frontend Implementation

### API Package

Add `frontend/packages/api/src/endpoints/identitySearch.ts`.

```ts
export async function searchProfiles(params: {
  q: string;
  scope?: 'all' | 'local_profiles' | 'public_profiles';
  limit?: number;
}) {
  return get('/api/identity/search', params);
}
```

Export it from `frontend/packages/api/src/index.ts`.

### Discover Search

Change `frontend/apps/web/src/components/discover/useUniversalSearch.ts`:

- Replace `api.users.searchUsers(trimmed, { type: 'people', limit })`.
- Call `api.identitySearch.searchProfiles({ q: trimmed, scope, limit })`.
- Map `local_profile` and `public_profile` into `UnifiedResult`.
- Extend `UnifiedResult.type` from `person` to profile-specific result types.

Update `UnifiedResultCard`:

- Label `Local Profile` instead of `Person`.
- Label `Public Profile` instead of `Person`.
- Use different icons.
- Public Profile click target should be `/@handle`.
- Local Profile click target should be `/local/handle`.

### Network Page

`frontend/apps/web/src/app/(app)/app/network/page.tsx` currently mixes search and account relationship actions.

Recommended direction:

- Rename page copy to clarify it is local network/search.
- For Local Profiles, use profile discovery and local/connection actions.
- For account-level invite/connect flows, keep `/api/users/search`.
- Do not show Public Profile follow actions in a Local Network people card unless the Public Profile appears as its own result.

### Chat, Mailbox, Home Invites, Team Invites

Keep `/api/users/search`.

Do not replace account lookup in these flows with Public Profile discovery. These flows need a real account target.

## Privacy Examples

### A wants Public Profile separate from neighbors

Settings:

- Local Profile search: everyone or connections.
- Public Profile search: everyone.
- `show_persona_on_local = false`.
- `show_local_on_persona = false`.

Result:

- Local search for A's local name returns Local Profile only.
- Public Profile search for A's public handle/name returns Public Profile only.
- Searching the local name does not search Public Profile fields unless A used the same public display name.
- Pantopus does not show a cross-link.

Important product truth: if A uses the same name/avatar/handle on both identities, people may infer the connection. Product can prevent platform-assisted linking, not real-world inference.

### A wants audience to find Local Profile

Settings:

- Public Profile search: everyone.
- `show_local_on_persona = true`.

Result:

- Public Profile result can show `Also has Local Profile`.
- Public Profile page shows Local Profile link.
- Local Profile itself still obeys its own `search_visibility` for standalone local search.

### A wants neighbors to find Public Profile

Settings:

- Local Profile search: everyone.
- `show_persona_on_local = true`.

Result:

- Local Profile result can show `Also has Public Profile`.
- Local Profile page shows Public Profile link.

### A wants Public Profile direct-link only

Settings:

- Public Profile search: direct link only.

Result:

- `/@handle` remains available to people with the link.
- Public Profile does not appear in Public Profile search.
- Existing followers may still navigate from their following lists if such a feature exists.

## Analytics

Track:

- `identity_profile_search_performed`
  - `scope`
  - `queryLength`
  - `resultCountsByType`
- `identity_profile_search_result_opened`
  - `resultType`
  - `rank`
  - `hasLinkedProfile`
- `identity_public_profile_follow_from_search`
  - `audienceMode`
  - `status`
- `identity_local_profile_connect_from_search`
  - `relationshipState`

Do not log raw queries if query logging is not already privacy-reviewed.

## Implementation Plan

### Phase 1: Contract And Endpoint

- Add `backend/routes/identitySearch.js`.
- Add local profile search using `LocalProfile`.
- Add Public Profile search using `PublicPersona`.
- Use existing serializers.
- Apply bridge settings only as secondary profile links.
- Add backend unit tests for:
  - Public Profile search does not search `User.email`.
  - Public Profile search does not search `User.name` unless that name is also Public Profile display name.
  - Local Profile search does not return linked Public Profile unless `show_persona_on_local`.
  - Public Profile search does not return linked Local Profile unless `show_local_on_persona`.
  - `is_searchable = false` excludes Public Profile from search.
  - `LocalProfile.search_visibility = nobody` excludes Local Profile from search.

### Phase 2: API Package And Discover UI

- Add `api.identitySearch.searchProfiles`.
- Add shared TypeScript result types.
- Replace `api.users.searchUsers` in `useUniversalSearch`.
- Extend `UnifiedResultCard`.
- Rename People scope to Local Profiles/Public Profiles.
- Add web tests for Discover search rendering both profile types separately.

### Phase 3: Settings UI

- Add Local Profile search setting to Local Profile management.
- Add Public Profile search setting to Public Profile management.
- Add clarifying copy near Profile links in Profiles & Privacy.
- Add Privacy Preview notes for search/link differences.

### Phase 4: Network Page Cleanup

- Decide whether Network is account/local-only or part of profile discovery.
- If local-only, use Local Profiles only and keep connect/follow-local actions.
- If profile discovery, split Local Profiles and Public Profiles into separate sections.

### Phase 5: Optional Schema Improvement

- Add `PublicPersona.search_visibility`.
- Backfill from `is_searchable`.
- Keep `is_searchable` for compatibility until callers migrate.

## Acceptance Criteria

- Discover search can return Local Profile and Public Profile as separate cards.
- A Local Profile result never exposes Public Profile unless `show_persona_on_local = true`.
- A Public Profile result never exposes Local Profile unless `show_local_on_persona = true`.
- Public Profile search never searches raw `User` email.
- Public Profile search never searches raw `User` name/username unless those values are explicitly copied into Public Profile fields.
- Chat/mail/invite flows continue to find real accounts.
- Public Profile follow uses `PersonaFollow`, not `UserFollow`.
- Local connect/follow actions do not follow the Public Profile.
- Tests cover the unlinked dual-profile case.

## Open Decisions

1. Should Public Profile search be available to logged-out web visitors, or authenticated users only?
2. Should `PublicPersona.is_searchable = false` mean direct-link-only or fully hidden?
3. Should Local Profile `search_visibility = mutuals` mean accepted relationships only, or include neighbors with shared home/building context?
4. Should Public Profiles support explicit owner-managed search aliases?
5. Should the main Discover default show both Local and Public Profiles in `All`, or require users to choose Local/Public tabs first?

## Recommendation

Implement the new profile discovery endpoint and migrate Discover to it before changing any account lookup flows.

The safest product contract is:

```text
Discovery searches profiles.
Invites and messaging search accounts.
Profile links create explicit cross-discovery.
No search joins identities unless the owner opted in.
```
