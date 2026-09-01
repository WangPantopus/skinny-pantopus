# Pantopus Identity Firewall Engineering Design

Last updated: 2026-05-04
Status: Proposed engineering design
Scope baseline: current code in `backend/database/schema.sql`, `backend/routes/*`, `backend/services/*`, `backend/utils/*`, `frontend/apps/web`, `frontend/apps/mobile`, and `frontend/packages/*`

## 1. Executive Summary

Pantopus should support one real, verified private account while letting the user present different public identities in different contexts:

```text
Private Pantopus Account
  -> Local Profile
  -> Audience Profile / Public Persona
  -> Business Seat
  -> Home Identity
```

The product promise is:

> Pantopus knows who you are. Other people only see the identity you choose for that context.

This is verified pseudonymity by context, not anonymity. The system must allow users to verify homes, hire help, sell items, post nearby, manage mail, talk to neighbors, and communicate with public or permissioned audiences without automatically connecting those worlds.

The current codebase already has several strong pieces:

- `User` is the private account and legacy public profile surface.
- `Relationship` is the local trust graph.
- `UserFollow` is the current local/personal distribution graph.
- `Home`, `HomeOccupancy`, `HomeOwner`, and home permission helpers form the home authority graph.
- `BusinessSeat` and `SeatBinding` are the strongest existing identity firewall implementation.
- `Post.post_as` and `Post.audience` already support personal, business, and home posting contexts.
- Location privacy utilities exist for posts, gigs, listings, and homes.
- Privacy settings and profile blocks exist, but are not enforced consistently on every public surface.

The primary product gap is that the audience/persona layer does not exist. There is no `PublicPersona`, no `PersonaFollow`, no audience profile page, no persona follower feed, no one-way broadcast channel, no identity bridge settings, and no context-specific public serializer layer that reliably prevents raw `User` fields from leaking into public surfaces.

This design introduces a durable identity architecture that:

1. Keeps `User` private.
2. Adds explicit public identity records for local and audience-facing persona surfaces.
3. Separates local trust, local following, persona following, home membership, and business seats.
4. Replaces public `User` response shapes with context-specific serializers.
5. Adds an Identity Center and View As Preview UX.
6. Adds guardrails to composer, feed, profile, gig, listing, and chat surfaces.
7. Ships incrementally without breaking existing public links or local workflows.

## 2. Product Contract

These rules are non-negotiable.

### 2.1 One Private Account

`User` remains the authenticated private account record. It may contain real name, legal name, phone, email, address, KYC state, payment state, moderation metadata, and verification state.

Raw `User` records must never be returned from public, local, follower, marketplace, gig, feed, listing, chat, or audience-persona-facing APIs.

Allowed direct `User` exposure:

- Current authenticated user's own account settings.
- Internal trusted services.
- Admin/moderation surfaces with explicit authorization.
- Payment, KYC, and verification integrations.

### 2.2 Multiple Public Faces

The user may present as:

- Local Profile: nearby life, gigs, marketplace, neighborhood posts, reviews, local chat.
- Audience Profile / Public Persona: public, follower, customer, patient, student, client, subscriber, or community-audience communication.
- Home Identity: household and home-authorized actions.
- Business Seat: business/team actions without exposing the real person behind the seat.

Each public face has its own serialized response contract.

### 2.3 No Automatic Bridges

Default state:

```text
Local profile does not link to audience profile.
Audience profile does not link to local profile.
Follower relationships do not imply local trust.
Local connections do not imply persona follows.
Home membership does not imply audience-profile visibility.
Business seat identity does not expose the bound user.
```

Users may explicitly create a bridge later, with clear warnings and reversible settings.

### 2.4 Separate Graphs

Do not use one generic "follow user" relationship for both local and audience-facing behavior.

Canonical graphs:

```text
LocalConnection / Relationship
  Real-life trust: neighbors, collaborators, gig participants, marketplace trust.

UserFollow
  Local/personal distribution only, if retained.

PersonaFollow
  Audience/persona distribution only.

HomeMembership
  Household and private home access.

BusinessSeatBinding
  Business work identity and authority.
```

### 2.5 Audience Broadcast Is Not Normal Chat

Audience-facing communication starts as a one-way broadcast channel.

The persona owner can post to followers or approved audience members. Followers cannot reply by default. Later features can include reactions, polls, paid channels, subscriber-only posts, customer/patient/student-only posts, and Q&A submissions.

No audience profile should have a default "message me" path that opens direct chat with the underlying `User`.

### 2.6 Not Influencer-Only

The audience/persona layer is not only for influencers. "Creator" is one product category, not the architecture.

`PublicPersona` should support any context where a verified real person or team needs to face many people without exposing their local/private life:

- A doctor or clinic professional sharing general updates with patients.
- A tutor, teacher, or coach sharing class updates with students or parents.
- A consultant, therapist, lawyer, accountant, or advisor communicating with clients.
- A real estate agent, contractor, trainer, organizer, or community leader publishing updates to an audience.
- A writer, streamer, YouTuber, musician, public figure, or influencer communicating with followers.

For regulated or sensitive contexts, the same identity firewall applies, but the product must add stricter controls before enabling broad use:

- Audience membership may need to be private and permissioned, not public.
- Broadcasts should avoid sensitive personal information by default.
- Two-way replies should remain off until the product has the right consent, retention, moderation, and compliance model.
- Persona categories may need credential verification, organization affiliation, disclaimers, audit logs, and stricter data retention.

This means the durable product concept is:

```text
PublicPersona
  A verified audience-facing identity for one-to-many communication.

PersonaFollow
  The audience relationship for that persona.

BroadcastChannel
  The safe one-to-many communication surface for that persona.
```

## 3. Current Codebase Reality

### 3.1 Existing Foundation Map

| Area | Current implementation | Assessment |
|---|---|---|
| Private account | `User` in `backend/database/schema.sql` | Strong but currently mixed with public profile fields |
| Local trust | `Relationship`, `RelationshipPermission`, `backend/routes/relationships.js` | Useful foundation, but auto-follow coupling must change |
| Local following | `UserFollow`, user follow routes, feed following surface | Should remain local/personal only, not audience/persona |
| Home identity | `Home`, `HomeOccupancy`, `HomeOwner`, `backend/utils/homePermissions.js` | Strong foundation |
| Business identity | `BusinessSeat`, `SeatBinding`, `backend/utils/seatPermissions.js`, `backend/routes/businessSeats.js` | Best existing identity firewall pattern |
| Privacy settings | `UserPrivacySettings`, `UserProfileBlock`, `backend/routes/privacy.js` | Exists but not consistently enforced |
| Feed composer | `Post.post_as`, `Post.audience`, `backend/routes/posts.js`, web/mobile composers | Good shape, missing audience persona identity |
| Location privacy | `backend/utils/locationPrivacy.js`, marketplace location privacy, feed location masking | Good local safety foundation |
| Public profile | `frontend/apps/web/src/app/[username]`, `backend/routes/users.js` | Currently a local/general user profile, unsafe for audience persona use |
| Marketplace | `backend/routes/listings.js`, marketplace service/cards | Local user identity, should never show on audience persona surface |
| Gigs | `backend/routes/gigs.js`, gig detail/profile tabs | Local user identity, should never show on audience persona surface |
| Chat | `backend/routes/chats.js`, socket code | Business-aware, not audience-persona-aware; audience personas need broadcast |
| Professional mode | `UserProfessionalProfile`, `backend/routes/professional.js` | User mode, not an audience persona identity |

### 3.2 High-Risk Current Behaviors

1. Public profile is a single `User` surface.
   - Web route: `frontend/apps/web/src/app/[username]/page.tsx`
   - Client: `frontend/apps/web/src/app/[username]/PublicProfileClient.tsx`
   - Backend: `backend/routes/users.js`
   - Shows or loads local data such as gigs, reviews, residency, activity, followers, and message/request actions.

2. `UserFollow` is currently generic.
   - Used by user profile follow buttons, feed following, follower-only posts, profile counts, and relationship side effects.
   - This cannot power audience/persona following.

3. Relationships auto-create follows.
   - `backend/routes/relationships.js` accepts a relationship and creates mutual `UserFollow` rows.
   - This couples local trust and distribution.

4. Nested user summaries are returned broadly.
   - Posts, gigs, listings, professional profiles, chat messages, feed items, and profile pages all select user fields directly.
   - Examples: `creator:user_id (id, username, name, first_name, last_name, profile_picture_url, city, state)`.

5. No serializer boundary exists.
   - There is no enforced backend contract like `serializeLocalProfileForViewer()` or `serializeAudienceProfileForViewer()`.
   - This makes it easy for future endpoints to leak city, state, name, gig history, social links, or home affiliation into the wrong context.

6. Root public URL is already occupied.
   - `/:username` maps to the legacy public user profile.
   - Product wants `/local/:localHandle` and `/@:personaHandle`.
   - We need a compatibility plan.

## 4. Target Architecture

### 4.1 Identity Layers

```text
User
  Private account only.
  Auth, verification, payment, safety, legal/account data.

LocalProfile
  Public local identity for nearby life.
  Backed by verified private account.
  May use alias and verified resident badges.

PublicPersona
  Audience-facing identity for followers, customers, patients, students, clients, subscribers, or public audiences.
  Backed by verified private account.
  Does not expose local/home/gig/marketplace context.

BusinessSeat
  Business role identity.
  Bound to private account through SeatBinding.

HomeIdentity
  Contextual home/household author identity.
  Derived from Home + HomeOccupancy + home permissions.
```

### 4.2 Graphs

```text
Relationship
  Mutual local trust.

UserFollow
  Local/personal distribution only.
  Optional long-term. Not audience/persona.

PersonaFollow
  Audience/persona distribution.

HomeOccupancy / HomeOwner
  Home authority and private household access.

SeatBinding
  Business authority and business identity.
```

### 4.3 Public Surface Split

Canonical public profile URLs:

```text
/local/:localHandle
  Local profile for gigs, marketplace, neighbors, local activity.

/@:personaHandle
  Audience profile for a public persona, follower/member posts, and broadcast.
```

Compatibility:

- Keep `/:username` temporarily as a legacy route.
- Resolve legacy `/:username` to the user's local profile.
- Add redirects or canonical metadata to `/local/:localHandle`.
- Do not use `/:username` for audience profiles.

Next.js implementation detail:

- App Router treats `@` specially for parallel routes, so implement the public audience profile URL using middleware/rewrite.
- Public URL remains `/@maya`.
- Internal route can be `/persona/maya` or `/persona/[personaHandle]`.
- Middleware rewrites requests matching `^/@[A-Za-z0-9_.-]+$` to the internal route.

### 4.4 Context-Specific Serialization

Add a dedicated backend serializer layer.

Recommended file:

```text
backend/serializers/identitySerializers.js
```

Exports:

```js
serializePrivateAccount(user)
serializeLocalProfileForViewer(localProfile, viewerContext)
serializeAudienceProfileForViewer(persona, viewerContext)
serializeCreatorProfileForViewer(persona, viewerContext) // compatibility alias if needed
serializeBusinessSeatForViewer(seat, viewerContext)
serializeHomeIdentityForViewer(homeIdentity, viewerContext)
serializePostAuthorForViewer(post, viewerContext)
serializeGigAuthorForViewer(gig, viewerContext)
serializeListingAuthorForViewer(listing, viewerContext)
serializeChatSenderForViewer(message, viewerContext)
```

Rules:

- Private account serializer is used only for the authenticated owner/admin.
- Local profile serializer may show local alias, local avatar, verified resident badge, local city/neighborhood if allowed.
- Audience profile serializer may show persona handle, display name, avatar, bio, public links, follower/member count, persona posts, broadcast channel, category, and credential badges where applicable.
- Audience profile serializer must never show home, city, neighborhood, gig history, marketplace listings, local reviews, local connections, local comments, mailbox activity, or private account fields.
- Business seat serializer must not expose the bound `User`.
- Home identity serializer must preserve exact address rules.

The serializer layer should be backed by tests that fail if forbidden keys appear in the wrong context.

## 5. Proposed Data Model

### 5.1 Keep `User` as Private Account

Do not delete existing public-ish columns immediately. The current code depends on `username`, `name`, `first_name`, `last_name`, `city`, `state`, `profile_picture_url`, `bio`, social links, and counts.

Instead:

1. Introduce new public identity tables.
2. Backfill them from `User`.
3. Move public endpoints to read from the new tables.
4. Mark legacy public `User` fields as private/compatibility fields.
5. Remove or lock down direct usage later.

### 5.2 `LocalProfile`

Purpose: local identity for nearby life.

Recommended table:

```sql
CREATE TABLE "LocalProfile" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE,
  handle_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  tagline TEXT,
  public_city TEXT,
  public_state TEXT,
  public_neighborhood TEXT,
  show_verified_resident_badge BOOLEAN NOT NULL DEFAULT TRUE,
  show_home_affiliation BOOLEAN NOT NULL DEFAULT FALSE,
  show_neighborhood BOOLEAN NOT NULL DEFAULT FALSE,
  show_gig_history BOOLEAN NOT NULL DEFAULT TRUE,
  profile_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public', 'followers', 'connections', 'private')),
  search_visibility TEXT NOT NULL DEFAULT 'everyone'
    CHECK (search_visibility IN ('everyone', 'mutuals', 'nobody')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Notes:

- `handle` replaces the local/public meaning of `User.username`.
- Backfill `handle` from `User.username`.
- Backfill `display_name` from `User.name`, `first_name`, or username.
- `public_city`, `public_state`, and `public_neighborhood` are display fields, not authoritative address fields.
- Real home address remains in home/private account systems.
- This table lets us avoid returning `User.city` and `User.state` on public surfaces.

### 5.3 `PublicPersona`

Purpose: audience-facing identity.

Recommended table:

```sql
CREATE TABLE "PublicPersona" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE,
  handle_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  public_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  category TEXT,
  audience_label TEXT NOT NULL DEFAULT 'followers',
  audience_mode TEXT NOT NULL DEFAULT 'open'
    CHECK (audience_mode IN ('open', 'approval_required', 'invite_only', 'organization_managed')),
  professional_category TEXT,
  credential_status TEXT NOT NULL DEFAULT 'none'
    CHECK (credential_status IN ('none', 'pending', 'verified', 'rejected', 'expired')),
  organization_name TEXT,
  organization_affiliation_status TEXT NOT NULL DEFAULT 'none'
    CHECK (organization_affiliation_status IN ('none', 'pending', 'verified', 'rejected')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'suspended')),
  follower_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  broadcast_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_searchable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, handle_normalized)
);
```

Notes:

- Multiple personas per account can be supported later. MVP should allow one audience persona per user unless product explicitly wants multi-persona.
- `handle_normalized` should enforce lowercase canonical matching.
- `public_links` are persona-owner-approved external links only.
- `category` is broad product taxonomy, such as `creator`, `doctor`, `tutor`, `coach`, `consultant`, `community_leader`, `public_figure`, or `other`.
- `audience_label` controls product copy, such as followers, patients, students, clients, subscribers, members, or customers.
- `audience_mode` controls whether following is open, approved, invite-only, or organization-managed.
- `credential_status` and `organization_affiliation_status` are optional but important for professional and regulated categories.
- No city, state, home, gig, marketplace, or local-review fields.

### 5.4 `PersonaFollow`

Purpose: audience/persona follower graph.

```sql
CREATE TABLE "PersonaFollow" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES "PublicPersona"(id) ON DELETE CASCADE,
  follower_user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'follower'
    CHECK (relationship_type IN ('follower', 'patient', 'student', 'client', 'customer', 'subscriber', 'member')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'muted', 'blocked', 'removed')),
  source TEXT NOT NULL DEFAULT 'self_follow'
    CHECK (source IN ('self_follow', 'follow_request', 'request_approved', 'invite', 'import', 'organization_managed')),
  notification_level TEXT NOT NULL DEFAULT 'all'
    CHECK (notification_level IN ('all', 'highlights', 'none')),
  public_visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (public_visibility IN ('private', 'visible_to_owner', 'public')),
  approved_by_user_id UUID REFERENCES "User"(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(persona_id, follower_user_id)
);

CREATE INDEX idx_persona_follow_follower ON "PersonaFollow"(follower_user_id, created_at DESC);
CREATE INDEX idx_persona_follow_persona ON "PersonaFollow"(persona_id, created_at DESC);
```

Rules:

- Following an audience persona never follows the underlying `User`.
- Persona owner cannot be discovered through `PersonaFollow` APIs.
- Audience membership should expose member local profiles only if the persona category allows visible membership and those users have allowed public/local visibility. Otherwise expose counts only.
- For doctors, tutors, advisors, and other sensitive categories, membership lists default to owner-only or fully private.
- `relationship_type` is product copy and policy input, not proof of a legal/professional relationship by itself.
- `status = pending` supports request-to-follow, invite approval, and organization-managed audience lists.

### 5.5 `IdentityBridgeSetting`

Purpose: explicit opt-in bridges between local and audience persona.

```sql
CREATE TABLE "IdentityBridgeSetting" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES "PublicPersona"(id) ON DELETE CASCADE,
  show_persona_on_local BOOLEAN NOT NULL DEFAULT FALSE,
  show_local_on_persona BOOLEAN NOT NULL DEFAULT FALSE,
  bridge_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, persona_id)
);
```

UX requirements:

- Defaults are both off.
- Changing either setting should show a clear warning.
- Changes should be audit logged.
- Bridge settings should be reversible.

### 5.6 Broadcast Tables

```sql
CREATE TABLE "BroadcastChannel" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL UNIQUE REFERENCES "PublicPersona"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "BroadcastMessage" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES "BroadcastChannel"(id) ON DELETE CASCADE,
  persona_id UUID NOT NULL REFERENCES "PublicPersona"(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  body TEXT,
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  visibility TEXT NOT NULL DEFAULT 'followers'
    CHECK (visibility IN ('public', 'followers', 'subscribers')),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived', 'removed')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_broadcast_message_channel_published
  ON "BroadcastMessage"(channel_id, published_at DESC);
```

Optional later:

- `BroadcastReaction`
- `BroadcastPoll`
- `BroadcastQuestionSubmission`
- `PaidPersonaSubscription`

### 5.7 Posts: Add Identity Context

Current post fields:

- `user_id`
- `home_id`
- `business_id`
- `business_author_id`
- `post_as`
- `audience`
- `distribution_targets`
- `profile_visibility_scope`

Current `post_as` supports:

```text
personal | business | home
```

Recommended evolution:

```sql
ALTER TYPE post_as_type ADD VALUE IF NOT EXISTS 'persona';

ALTER TABLE "Post"
  ADD COLUMN identity_context_type TEXT,
  ADD COLUMN identity_context_id UUID,
  ADD COLUMN author_user_id UUID;
```

Better long-term model:

```text
Post.author_user_id
  Private authenticated actor. Never public by default.

Post.identity_context_type
  local | persona | home | business

Post.identity_context_id
  LocalProfile.id | PublicPersona.id | Home.id | BusinessSeat.id or BusinessProfile.id

Post.audience
  nearby | followers | connections | household | public | target_area | neighborhood
```

Compatibility plan:

- Keep `Post.user_id` during migration.
- For legacy rows, `identity_context_type = 'local'` and `identity_context_id = LocalProfile.id`.
- For home posts, context is `home`.
- For business posts, context is `business`.
- For audience persona posts, context is `persona` and `audience = followers`, `audience`, or `public` depending on persona category and audience mode.

Important:

- `persona + nearby` is blocked or requires strong warning.
- `local + persona followers/audience` is invalid.
- `persona followers/audience` always means `PersonaFollow`.
- `local followers` always means `UserFollow`, if local following remains.

### 5.8 Optional Feed Distribution Table

Current feed uses `distribution_targets` JSON and query-specific logic.

For scale and clarity, add a typed table:

```sql
CREATE TABLE "PostDistributionTarget" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES "Post"(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('place', 'local_followers', 'relationships', 'persona_followers', 'household', 'public')),
  target_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_distribution_target_lookup
  ON "PostDistributionTarget"(target_type, target_id, created_at DESC);
```

This can be v2. MVP can extend existing `distribution_targets` if serializer and graph separation are strict.

## 6. Backend Design

### 6.1 New Backend Modules

Add:

```text
backend/serializers/identitySerializers.js
backend/utils/identityContext.js
backend/utils/identityPolicy.js
backend/routes/localProfiles.js
backend/routes/personas.js
backend/routes/personaFollows.js
backend/routes/broadcastChannels.js
backend/routes/identityCenter.js
```

Responsibilities:

- `identitySerializers.js`: response shapes and redaction.
- `identityContext.js`: resolve actor identity from request payload.
- `identityPolicy.js`: validate identity/audience combinations and viewer permissions.
- `localProfiles.js`: local public/private profile APIs.
- `personas.js`: audience profile APIs.
- `personaFollows.js`: audience membership/follow APIs.
- `broadcastChannels.js`: one-way broadcast APIs.
- `identityCenter.js`: private account's identity overview and View As Preview.

### 6.2 Backend Identity Context Resolver

All authoring routes should resolve identity through one helper.

```js
async function resolvePostingIdentity({ actorUserId, postAs, identityContextId }) {
  switch (postAs) {
    case 'local':
    case 'personal':
      return resolveLocalProfile(actorUserId);
    case 'persona':
    case 'creator': // compatibility alias while older clients migrate
      return resolvePublicPersona(actorUserId, identityContextId);
    case 'home':
      return resolveHomeIdentity(actorUserId, identityContextId);
    case 'business':
      return resolveBusinessSeat(actorUserId, identityContextId);
    default:
      throw new ValidationError('Unsupported posting identity');
  }
}
```

The helper should return:

```js
{
  contextType: 'local' | 'persona' | 'home' | 'business',
  contextId: string,
  actorUserId: string,
  publicAuthor: object,
  permissions: object
}
```

No route should infer identity through ad-hoc combinations of `homeId`, `businessId`, or `user_id` once this helper is available.

### 6.3 Identity/Audience Policy

Add `canPostWithIdentityToAudience(identity, audience, target)` to `identityPolicy.js`.

Rules:

| Identity | Audience | Decision |
|---|---|---|
| persona | followers/audience | allowed, uses `PersonaFollow` |
| persona | public | allowed if persona category and settings permit |
| persona | nearby | blocked by default |
| persona | neighborhood | blocked by default |
| persona | household | blocked |
| persona | connections | blocked unless explicit future feature |
| local | nearby | allowed |
| local | connections | allowed, uses `Relationship` |
| local | followers | allowed only for local followers, uses `UserFollow` |
| local | persona followers/audience | impossible |
| home | household | allowed if member has permission |
| home | nearby/neighborhood | allowed only approximate and with home permission |
| business | followers | allowed as business audience |
| business | target_area | allowed with business authority |

The policy should return structured reasons for UI:

```js
{
  allowed: false,
  code: 'PERSONA_NEARBY_BLOCKED',
  message: 'Audience persona posts cannot be sent to nearby audiences because that can reveal local context.'
}
```

### 6.4 Public Profile APIs

#### Local Profile

```text
GET /api/local-profiles/:handle
GET /api/local-profiles/:handle/activity
GET /api/local-profiles/:handle/reviews
GET /api/local-profiles/:handle/gigs
GET /api/local-profiles/:handle/listings
PATCH /api/local-profiles/me
```

Response:

```json
{
  "id": "local_profile_id",
  "handle": "riverhome",
  "displayName": "RiverHome",
  "avatarUrl": "...",
  "bio": "...",
  "badges": ["verified_resident"],
  "locality": {
    "city": "Seattle",
    "state": "WA",
    "neighborhood": null,
    "precision": "city"
  },
  "stats": {
    "reviews": 12,
    "gigsCompleted": 6,
    "marketplaceSales": 4
  },
  "viewer": {
    "relationshipStatus": "connected",
    "isFollowingLocal": true,
    "canMessage": true
  },
  "bridges": {
    "audienceProfile": null
  }
}
```

Forbidden:

- Private email
- Phone
- Legal/real name unless explicitly chosen as display name
- Exact address
- Audience/persona handle unless bridge is on
- Audience/persona follower count unless bridge is on

#### Audience Profile

```text
GET /api/personas/:handle
GET /api/personas/:handle/posts
GET /api/personas/:handle/broadcast
POST /api/personas
PATCH /api/personas/:id
```

Response:

```json
{
  "id": "persona_id",
  "handle": "mayabuilds",
  "displayName": "Maya Builds",
  "avatarUrl": "...",
  "bannerUrl": "...",
  "bio": "...",
  "publicLinks": [],
  "category": "tutor",
  "audienceLabel": "students",
  "audienceMode": "approval_required",
  "followerCount": 12800,
  "postCount": 42,
  "credential": {
    "status": "verified",
    "label": "Verified tutor"
  },
  "viewer": {
    "isFollowing": true,
    "relationshipType": "student",
    "notificationLevel": "all"
  },
  "bridges": {
    "localProfile": null
  }
}
```

Forbidden:

- Real name
- Email
- Phone
- Home address
- City/state/neighborhood unless user explicitly puts it in persona bio or bridge
- Gig history
- Marketplace listings
- Local posts
- Local comments
- Local reviews
- Household info
- Mailbox activity
- Local connections

### 6.5 Follow APIs

Keep current local follow endpoints, but rename internally and in docs as local follow:

```text
POST /api/users/:id/follow
DELETE /api/users/:id/follow
GET /api/users/:id/followers
GET /api/users/:id/following
```

These remain compatibility endpoints for local `UserFollow`.

Add audience/persona follow endpoints:

```text
POST /api/personas/:personaId/follow
DELETE /api/personas/:personaId/follow
PATCH /api/personas/:personaId/follow
GET /api/personas/:personaId/follow/status
GET /api/personas/:personaId/followers
```

Rules:

- `POST /api/personas/:id/follow` inserts `PersonaFollow`.
- It never inserts `UserFollow`.
- It never creates or modifies `Relationship`.
- It never exposes `PublicPersona.user_id`.
- For `audience_mode = approval_required`, follow creates a pending audience relationship.
- For `audience_mode = invite_only` or `organization_managed`, self-follow is blocked unless the viewer has an invitation or organization entitlement.

### 6.6 Relationship Changes

Current issue:

- Accepting a relationship creates mutual `UserFollow` rows.

Design:

- Stop auto-creating follows for new relationships.
- Add optional transition field to `UserFollow`:

```sql
ALTER TABLE "UserFollow"
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'relationship_auto', 'legacy', 'import'));
```

Migration strategy:

- Existing rows default to `legacy`.
- New manual local follows use `manual`.
- Existing auto-created rows can remain until users unfollow.
- Remove the auto-follow side effect from `backend/routes/relationships.js`.
- If product wants a convenience path, the accept screen can show "Also follow local updates" as an explicit checkbox.

### 6.7 Posts and Feed Changes

Update:

- `backend/routes/posts.js`
- `backend/services/feedService.js`
- `backend/utils/trustState.js`
- `backend/utils/visibilityPolicy.js`
- Web/mobile post composer and feed cards.

Required behavior:

- `GET /api/posts/identities` returns local, audience persona, home, and business identities.
- `POST /api/posts` uses `resolvePostingIdentity`.
- Audience persona posts are stored with persona context.
- Audience/persona feed queries `PersonaFollow`.
- Local following feed queries `UserFollow`.
- Connection feed queries `Relationship`.
- Household feed queries home membership.

Author serialization:

```json
{
  "author": {
    "type": "persona",
    "id": "persona_id",
    "handle": "mayabuilds",
    "displayName": "Maya Builds",
    "avatarUrl": "...",
    "href": "/@mayabuilds"
  }
}
```

Not:

```json
{
  "creator": {
    "id": "user_id",
    "username": "local_user",
    "city": "Seattle",
    "state": "WA"
  }
}
```

### 6.8 Gigs and Marketplace

Gigs and listings are local surfaces.

Update:

- `backend/routes/gigs.js`
- `backend/routes/listings.js`
- `backend/services/marketplace/marketplaceService.js`
- Gig/listing frontend cards and detail pages.

Rules:

- Gig poster author is a local profile or business identity.
- Listing seller author is a local profile or business identity.
- Do not link gig/listing sellers to audience profiles unless an explicit bridge is enabled.
- `GET /api/gigs?user_id=...` and `GET /api/listings/user/:userId` should be replaced or wrapped by local profile handles:

```text
GET /api/local-profiles/:handle/gigs
GET /api/local-profiles/:handle/listings
```

Compatibility can remain internally, but public clients should not depend on raw user IDs.

### 6.9 Chat and Broadcast

Direct chat remains local/business/home-workflow oriented.

Audience persona communication is separate:

```text
POST /api/broadcast/channels/:channelId/messages
GET /api/broadcast/channels/:channelId/messages
POST /api/broadcast/messages/:messageId/reactions
POST /api/broadcast/channels/:channelId/questions
```

MVP:

- Persona owner can publish messages.
- Followers can read.
- Public viewers can read public messages.
- Followers cannot reply in normal chat.
- Optional reaction count can be added later.

Do not add "Message persona" unless it is explicitly a controlled persona inbox feature with its own moderation and privacy model.

### 6.10 Search

Current user search selects and searches private-ish fields such as email.

Design:

- Local search searches `LocalProfile` plus allowed privacy settings.
- Persona search searches `PublicPersona`.
- Private email/phone discovery must use `UserPrivacySettings`.
- Search result serializer must be context-specific.

New routes:

```text
GET /api/search/local-profiles?q=
GET /api/search/personas?q=
```

Existing `/api/users/search` should become authenticated compatibility only and should not expose private discoverability unless settings allow it.

### 6.11 View As Preview

Add backend-backed preview.

```text
GET /api/identity-center/view-as?surface=local&handle=riverhome&viewer=public
GET /api/identity-center/view-as?surface=persona&handle=mayabuilds&viewer=audience_member
```

Viewer modes:

```text
public
persona_audience_member
neighbor
connection
household_member
gig_participant
marketplace_counterparty
owner
```

The endpoint should call the same serializers and policy helpers as production views. It must not be a frontend-only preview.

## 7. Frontend Product Design

### 7.1 Information Architecture

Add:

```text
/app/identity
  Identity Center.

/local/:localHandle
  Local public profile.

/@:personaHandle
  Audience public profile.

/app/persona
  Audience persona dashboard.

/app/persona/broadcast
  Broadcast composer and history.
```

Compatibility:

- `/:username` redirects or canonicalizes to `/local/:localHandle`.
- `/u/:username` redirects to `/local/:localHandle`.

### 7.2 Identity Center

Purpose: make identity separation understandable and trustworthy.

Sections:

```text
Private Account
  Only you and Pantopus can see this.
  Verification, phone, email, legal/payment/security state.

Local Profile
  Used for nearby posts, gigs, marketplace, neighbors, and local reviews.
  Shows local handle, display name, avatar, verified resident badge, privacy controls.

Audience Profile
  Used for followers, customers, patients, students, clients, subscribers, members, and public audiences.
  Shows handle, display name, avatar, bio, public links, audience label, follower/member count, and credential badges where applicable.

Homes
  Home identities and household membership.

Business Profiles
  Business seats and business identities.

Bridges
  Explicit local <-> audience persona link settings, default off.

View As
  Preview each public surface from important viewer contexts.
```

Primary copy:

```text
Verify privately. Show up safely.
```

Onboarding copy:

```text
Pantopus verifies your real identity and address to keep the community safe.
Other users will see your chosen profile name, not your private information.
```

Post-verification copy:

```text
You are verified. Your real name and address stay private.
```

### 7.3 Local Profile UX

Local profile should feel like a trust and coordination surface, not an audience page.

Shows:

- Local display name and handle.
- Verified resident / verified neighbor badges.
- Approximate locality if enabled.
- Reviews and local reputation.
- Gigs posted/completed if enabled.
- Marketplace seller history if enabled.
- Local posts visible to this viewer.
- Connect, Follow local updates, Message, Request/Hire when allowed.

Does not show:

- Audience/persona handle, follower/member count, broadcast, public links, or persona posts unless bridge is enabled.

### 7.4 Audience Profile UX

Audience profile should feel public or permissioned according to its category, clean, and separate from local life.

Shows:

- Persona handle.
- Persona display name.
- Avatar and optional banner.
- Bio.
- Persona-owner-approved public links.
- Audience label and follower/member count when appropriate.
- Credential or affiliation badges when applicable.
- Persona posts.
- Broadcast channel.
- Follow, request access, or invitation state plus notification level.

Does not show:

- Home/residency block.
- Local city/state unless explicitly written by the persona owner.
- Gigs, marketplace listings, local reviews, local relationship status, local message CTA.
- "Hire/request" local actions.

### 7.5 Composer UX

Every composer should expose two primary controls:

```text
Post as: Local Profile / Audience Profile / Home / Business
Audience: Nearby / Followers / Connections / Household / Public
```

UX behavior:

- Selecting an identity filters valid audiences.
- Dangerous combos are hidden or disabled with explanation.
- If a user tries to post audience persona content nearby, show a strong warning or block by default.
- If a user chooses Local Profile, persona followers/audience members are not an audience option.
- If a user chooses Audience Profile, local nearby and household audiences are not available.
- If a user chooses Home, exact location is never exposed to nearby audiences.

### 7.6 View As UX

The preview must be prominent in Identity Center and profile settings.

Supported previews:

- Public viewer.
- Persona audience member.
- Neighbor.
- Connection.
- Household member.
- Gig participant.
- Marketplace counterparty.

The preview should clearly label:

```text
Viewing as: Persona audience member
```

But it should not overwhelm users with implementation details.

### 7.7 Mobile Parity

Mobile already has identity-switching concepts in:

- `frontend/apps/mobile/src/contexts/IdentityContext.tsx`
- `frontend/apps/mobile/src/components/IdentityProfileSwitcher.tsx`
- mobile post composer files.

Update mobile with the same identity model:

- Add audience persona identity option.
- Add audience profile route.
- Add local profile route.
- Add Identity Center.
- Add View As.
- Keep copy and guardrails consistent with web.

## 8. File-by-File Implementation Plan

### 8.1 Database and Migrations

Add migration files under:

```text
backend/database/migrations/
supabase/migrations/
```

Add:

- `LocalProfile`
- `PublicPersona`
- `PersonaFollow`
- `IdentityBridgeSetting`
- `BroadcastChannel`
- `BroadcastMessage`
- Optional `PostDistributionTarget`
- `UserFollow.source`
- Post identity context fields

Update schema snapshots:

```text
backend/database/schema.sql
```

### 8.2 Backend Routes

Modify:

```text
backend/routes/users.js
backend/routes/relationships.js
backend/routes/posts.js
backend/routes/gigs.js
backend/routes/listings.js
backend/routes/chats.js
backend/routes/professional.js
backend/routes/privacy.js
```

Add:

```text
backend/routes/localProfiles.js
backend/routes/personas.js
backend/routes/personaFollows.js
backend/routes/broadcastChannels.js
backend/routes/identityCenter.js
```

Register new route files in the backend app/server route registry.

### 8.3 Backend Utils and Services

Modify:

```text
backend/utils/visibilityPolicy.js
backend/utils/trustState.js
backend/utils/homePermissions.js
backend/utils/seatPermissions.js
backend/services/feedService.js
backend/services/marketplace/marketplaceService.js
```

Add:

```text
backend/serializers/identitySerializers.js
backend/utils/identityContext.js
backend/utils/identityPolicy.js
backend/services/broadcastService.js
backend/services/personaService.js
```

### 8.4 Frontend API Package

Modify:

```text
frontend/packages/api/src/endpoints/users.ts
frontend/packages/api/src/endpoints/posts.ts
frontend/packages/api/src/endpoints/chat.ts
frontend/packages/types/src/gig.ts
frontend/packages/types/src/listing.ts
frontend/packages/utils/src/index.ts
```

Add:

```text
frontend/packages/api/src/endpoints/localProfiles.ts
frontend/packages/api/src/endpoints/personas.ts
frontend/packages/api/src/endpoints/broadcast.ts
frontend/packages/api/src/endpoints/identityCenter.ts
frontend/packages/types/src/identity.ts
frontend/packages/types/src/persona.ts
frontend/packages/utils/src/profilePaths.ts
```

### 8.5 Web App

Modify:

```text
frontend/apps/web/src/app/[username]/page.tsx
frontend/apps/web/src/app/[username]/PublicProfileClient.tsx
frontend/apps/web/src/app/u/[username]/page.tsx
frontend/apps/web/src/components/feed/PostComposer.tsx
frontend/apps/web/src/components/feed/PostCard.tsx
frontend/apps/web/src/components/feed/PostDetailPanel.tsx
frontend/apps/web/src/components/user/UserIdentityLink.tsx
frontend/apps/web/src/app/(app)/app/marketplace/ListingCard.tsx
frontend/apps/web/src/app/(app)/app/marketplace/[id]/_components/SellerSection.tsx
frontend/apps/web/src/app/(app)/app/gigs/[id]/page.tsx
frontend/apps/web/src/app/gigs/[id]/page.tsx
```

Add:

```text
frontend/apps/web/src/app/local/[localHandle]/page.tsx
frontend/apps/web/src/app/local/[localHandle]/LocalProfileClient.tsx
frontend/apps/web/src/app/persona/[personaHandle]/page.tsx
frontend/apps/web/src/app/persona/[personaHandle]/AudienceProfileClient.tsx
frontend/apps/web/src/app/(app)/app/identity/page.tsx
frontend/apps/web/src/app/(app)/app/persona/page.tsx
frontend/apps/web/src/app/(app)/app/persona/broadcast/page.tsx
frontend/apps/web/src/middleware.ts
```

`middleware.ts` handles public `/@handle` rewrites.

### 8.6 Mobile App

Modify:

```text
frontend/apps/mobile/src/contexts/IdentityContext.tsx
frontend/apps/mobile/src/components/IdentityProfileSwitcher.tsx
frontend/apps/mobile/src/components/feed/PostComposerModal.tsx
frontend/apps/mobile/src/hooks/feed/usePostComposer.ts
frontend/apps/mobile/src/app/user/[id].tsx
frontend/apps/mobile/src/app/u/[username].tsx
```

Add:

```text
frontend/apps/mobile/src/app/local/[handle].tsx
frontend/apps/mobile/src/app/persona/[handle].tsx
frontend/apps/mobile/src/app/settings/identity.tsx
frontend/apps/mobile/src/app/persona/broadcast.tsx
```

## 9. Privacy and Safety Contract

### 9.1 Audience Persona Surface Forbidden Fields

Audience-persona-facing APIs must never return:

- `email`
- `phone_number`
- `address`
- `city`
- `state`
- `zipcode`
- exact or inferred home location
- local neighborhood
- home membership
- home ownership
- mailbox activity
- gig posts
- gig completion history
- marketplace listings
- local reviews
- local comments
- local connections
- local follower list based on `UserFollow`
- `User.id` unless it is the authenticated owner's private view

### 9.2 Local Surface Forbidden Fields

Local-facing APIs must never return audience persona data unless bridge is enabled:

- persona handle
- persona display name
- persona follower/member count
- persona posts
- broadcast channel
- persona public links
- public audience activity

### 9.3 Business Seat Contract

Business surfaces must not expose:

- bound user's private account
- real name behind the seat
- personal/local profile unless explicit product bridge exists

Existing `SeatBinding` pattern should be treated as the reference architecture.

### 9.4 Logging and Analytics

Analytics events may include:

- `user_id` internally.
- `identity_context_type`.
- `identity_context_id`.

Analytics events shown to other users or exported to public tooling must use public identity IDs only.

Logs should avoid writing raw home addresses, phone numbers, private names, and private account fields in request/response payloads.

## 10. Authorization and RLS

### 10.1 Table Access

RLS policies should follow this pattern:

- `User`: owner only, service role/admin for trusted systems.
- `LocalProfile`: public read only through allowed columns or views; owner write.
- `PublicPersona`: public read when active/searchable; owner write.
- `PersonaFollow`: follower can see own follow row; persona owner can see aggregate/counts; service role for moderation.
- `IdentityBridgeSetting`: owner only; public effects only through serializers.
- `BroadcastChannel`: public or follower read by channel/message visibility.
- `BroadcastMessage`: public/follower/subscriber read by visibility and persona follow state.

### 10.2 Views for Safe Reads

Prefer safe SQL views for public read paths:

```text
PublicLocalProfileView
PublicAudienceProfileView
PublicBroadcastMessageView
```

Do not expose raw private fields through these views.

### 10.3 Service Role Usage

Routes that use service role or elevated Supabase clients must call serializers before returning responses.

Any service-role route returning raw DB rows should be treated as a privacy bug unless explicitly admin-only.

## 11. Migration and Rollout Strategy

### Phase 0: Guardrails and Audit

Goal: make future leaks harder before adding audience persona surfaces.

Tasks:

- Add `identitySerializers.js` with current local/business/home serializers.
- Add tests that forbid private keys in public responses.
- Add lint-like tests that scan route responses for raw `User` return patterns in high-risk files.
- Add feature flag:

```text
IDENTITY_FIREWALL_ENABLED
PERSONA_ENABLED
PERSONA_BROADCAST_ENABLED
```

Deliverable:

- No product-visible audience persona UX yet.
- Public responses begin moving through serializers.

### Phase 1: Local Profile Extraction

Goal: stop treating `User` as the public local profile.

Tasks:

- Add `LocalProfile`.
- Backfill from `User`.
- Add local profile APIs.
- Move web public profile reads to `/api/local-profiles/:handle`.
- Keep `/:username` and `/u/:username` as compatibility redirects.
- Update author cards to use local profile author objects.

Deliverable:

- Existing user profile experience still works.
- Backend now has a clean local/public profile boundary.

### Phase 2: Audience Persona MVP

Goal: add audience-facing identity with no local leakage.

Tasks:

- Add `PublicPersona`.
- Add persona profile CRUD.
- Add `/@handle` public route via middleware rewrite.
- Add audience profile page.
- Add audience persona identity to Identity Center.
- Add bridge settings default off.

Deliverable:

- User can create and view an audience profile.
- Audience profile exposes only persona fields.

### Phase 3: Persona Audience and Feed

Goal: separate persona audience membership from local following.

Tasks:

- Add `PersonaFollow`.
- Add persona follow APIs.
- Add follower/member count.
- Add persona posts or extend `Post` identity context.
- Add persona audience feed using `PersonaFollow`.
- Ensure local `UserFollow` does not affect persona visibility.

Deliverable:

- A viewer can follow or join a persona audience without becoming a local follower.
- A local follower does not become a persona audience member.

### Phase 4: Composer Guardrails

Goal: make identity/audience simple and safe.

Tasks:

- Update `GET /api/posts/identities`.
- Add audience persona identity to web and mobile composers.
- Enforce identity/audience policy on backend.
- Add disabled/warning states on frontend.
- Update feed author serialization.

Deliverable:

- Users choose "Post as" and "Audience".
- Dangerous combinations are blocked by default.

### Phase 5: Broadcast Channel

Goal: give audience personas one-to-many communication without normal direct chat.

Tasks:

- Add `BroadcastChannel` and `BroadcastMessage`.
- Auto-create channel for active audience persona.
- Add broadcast composer.
- Add follower/public read views.
- Add notification hooks.

Deliverable:

- Persona owner can publish one-way updates.
- Followers can read without opening direct chat.

### Phase 6: View As Preview and Bridge Polish

Goal: make privacy legible and trustworthy.

Tasks:

- Add backend View As endpoint.
- Add Identity Center preview UI.
- Add explicit bridge settings with warnings.
- Add audit logging for bridge changes.
- Add profile preview from local and persona settings.

Deliverable:

- User can verify what each audience sees.

### Phase 7: Legacy Cleanup

Goal: reduce long-term maintenance risk.

Tasks:

- Remove direct public `User` response usage.
- Rename or document `UserFollow` as local follow.
- Remove relationship auto-follow side effect.
- Move gig/listing user-history APIs to local profile handles.
- Deprecate root `/:username` as canonical public profile.

Deliverable:

- Identity model is explicit and maintainable.

## 12. Backfill Plan

### 12.1 Local Profiles

For every active user:

```text
LocalProfile.user_id = User.id
LocalProfile.handle = User.username or generated handle
LocalProfile.display_name = User.name || User.first_name || User.username
LocalProfile.avatar_url = User.profile_picture_url
LocalProfile.bio = User.bio
LocalProfile.public_city = User.city only if existing privacy allows
LocalProfile.public_state = User.state only if existing privacy allows
```

Handle collision strategy:

```text
existing: maya
collision: maya-2, maya-3
```

Store mapping for redirects if needed.

### 12.2 Audience Personas

Do not auto-create audience personas for every user.

Audience persona creation is explicit:

- User chooses handle.
- User chooses display name/avatar/bio.
- User chooses category and audience label where applicable.
- User confirms local and audience persona are separate by default.

### 12.3 Posts

Legacy posts:

```text
post_as = personal -> identity_context_type = local
post_as = home -> identity_context_type = home
post_as = business -> identity_context_type = business
```

Backfill `identity_context_id` using:

- `LocalProfile.id` for personal/local posts.
- `Home.id` for home posts.
- Business profile/seat context for business posts.

### 12.4 UserFollow

Existing rows:

```text
source = legacy
```

Do not migrate any `UserFollow` row into `PersonaFollow`.

Persona audience membership must be explicit.

## 13. Testing Strategy

### 13.1 Unit Tests

Add:

```text
backend/tests/unit/identitySerializers.test.js
backend/tests/unit/identityPolicy.test.js
backend/tests/unit/identityContext.test.js
backend/tests/unit/personaFollow.test.js
backend/tests/unit/broadcastService.test.js
```

Test:

- Audience persona serializer excludes local/private fields.
- Local serializer excludes audience persona fields by default.
- Bridge setting opt-in changes only allowed fields.
- Invalid identity/audience combinations are blocked.
- Business seat serializer never exposes bound user.
- Home identity serialization respects exact address policy.

### 13.2 Integration Tests

Add:

```text
backend/tests/integration/audience-persona.test.js
backend/tests/integration/identity-center.test.js
backend/tests/integration/profile-surface-separation.test.js
backend/tests/integration/persona-broadcast.test.js
backend/tests/integration/post-identity-context.test.js
```

Must cover:

- A persona audience member cannot see the persona owner's local profile unless bridge is on.
- A local connection cannot see audience profile unless bridge is on or profile is public by handle.
- A persona audience member does not appear in `UserFollow`.
- A local follow does not appear in `PersonaFollow`.
- Persona post to followers or audience members appears in persona feed.
- Local nearby post does not appear on audience profile.
- Gig/listing history does not appear on audience profile.
- Direct chat cannot be started from audience profile by default.

### 13.3 Contract Tests

Add response-shape contract tests for high-risk routes:

```text
GET /api/personas/:handle
GET /api/personas/:handle/posts
GET /api/local-profiles/:handle
GET /api/posts/:id
GET /api/gigs/:id
GET /api/listings/:id
GET /api/chat/rooms
```

Forbidden key checks:

```text
email
phone_number
address
zipcode
legal_name
home_id where not allowed
user_id where public context should use profile/persona id
city/state on audience persona surfaces
gigs_completed on audience persona surfaces
followers_count from User on audience persona surfaces
```

### 13.4 Frontend Tests

Add:

- Identity Center render tests.
- Composer identity/audience tests.
- Audience profile route tests.
- Local profile route tests.
- Bridge settings tests.
- View As Preview tests.

E2E flows:

1. User creates local profile and audience profile.
2. Viewer follows, requests, or joins persona audience.
3. Viewer cannot see local gigs/listings/home.
4. Neighbor connects locally.
5. Neighbor does not become persona audience member.
6. Persona owner sends broadcast.
7. Audience member sees broadcast.
8. Audience member cannot open direct chat with persona owner by default.

### 13.5 Regression Tests for Existing Features

Protect:

- Gig creation and discovery.
- Marketplace listing creation/detail.
- Business seat posting.
- Home posting.
- Feed nearby/following/connections.
- Profile privacy settings.
- Chat business seat behavior.

## 14. Observability and Operations

Add metrics:

```text
identity_center_opened
local_profile_created
audience_persona_created
identity_bridge_enabled
identity_bridge_disabled
persona_follow_created
persona_follow_removed
persona_post_published
broadcast_message_published
composer_identity_combo_blocked
view_as_preview_opened
privacy_serializer_violation_detected
```

Add dashboards:

- Persona creation funnel.
- Persona follow/join conversion.
- Broadcast publish/read rates.
- Blocked dangerous composer combinations.
- Serializer contract failures.
- Local/persona bridge enablement rate.

Add logs:

- Identity/audience policy denial code.
- Bridge setting changes.
- Suspicious follow bursts.
- Suspicious profile scraping.

Avoid logs that contain:

- Exact home address.
- Phone/email.
- Legal name.
- KYC/payment details.

## 15. Scalability Considerations

### 15.1 Persona Feed

MVP can use pull-based reads:

```text
viewer follows or belongs to personas -> query recent persona posts for those persona IDs
```

Scale path:

- Add fanout table for high-volume personas.
- Use async job for broadcast notifications.
- Cache public persona profile response by persona handle.
- Cache follower/member counts with trigger or async counter.

### 15.2 Public Profile Reads

Use:

- `handle_normalized` indexes.
- CDN/cache for public audience profiles.
- Short TTL for follower/member counts.
- ETags where frontend supports it.

### 15.3 Search

Separate indexes:

- `LocalProfile(handle_normalized, display_name)`.
- `PublicPersona(handle_normalized, display_name)`.

Future:

- Dedicated search service for ranking.
- Safety filters for blocked/scoped-blocked users.

### 15.4 Data Retention

When audience persona is paused:

- Public route shows paused/unavailable.
- Existing follows remain unless deleted.
- Broadcast history can remain hidden or archived.

When user deletes account:

- Delete `LocalProfile`, `PublicPersona`, `PersonaFollow`, broadcasts, bridge settings according to privacy/deletion policy.

## 16. Security Review Checklist

Before launch:

- No public route returns raw `User`.
- No persona route selects or serializes `User.city`, `User.state`, address, phone, email, gig stats, marketplace stats, or home data.
- No persona follow API exposes `PublicPersona.user_id`.
- No persona audience feed uses `UserFollow`.
- No local feed uses `PersonaFollow`.
- No relationship action auto-follows or auto-joins an audience persona.
- No audience profile opens direct chat to underlying user.
- No bridge is enabled by default.
- Bridge setting changes are audited.
- View As Preview uses backend serializers.
- Existing privacy block logic applies to local profile, audience profile, and follow/join actions.
- Rate limits exist for follows, profile lookups, and broadcast publishing.

## 17. API Response Shape Guidelines

Every public author object should follow this pattern:

```json
{
  "type": "local",
  "id": "local_profile_id",
  "handle": "riverhome",
  "displayName": "RiverHome",
  "avatarUrl": "...",
  "href": "/local/riverhome",
  "badges": ["verified_resident"]
}
```

or:

```json
{
  "type": "persona",
  "id": "persona_id",
  "handle": "mayabuilds",
  "displayName": "Maya Builds",
  "avatarUrl": "...",
  "href": "/@mayabuilds"
}
```

or:

```json
{
  "type": "business",
  "id": "business_seat_or_profile_id",
  "displayName": "Maya Builds Studio",
  "avatarUrl": "...",
  "href": "/business/maya-builds-studio"
}
```

Do not return mixed legacy objects like:

```json
{
  "id": "user_id",
  "username": "maya",
  "name": "Maya",
  "city": "Seattle",
  "state": "WA",
  "followers_count": 100
}
```

for public context surfaces.

## 18. UX Acceptance Criteria

The feature is ready when:

1. A user can verify privately and choose a local display identity.
2. A user can create an audience profile without exposing local profile data.
3. A viewer can follow, request, or join the audience profile without becoming a local follower.
4. A neighbor can connect locally without becoming a persona audience member.
5. A persona post to followers or audience members reaches only `PersonaFollow` audience members.
6. A local nearby post never appears on the audience profile.
7. An audience profile never shows gigs, marketplace listings, home, mailbox, local reviews, or local relationship data.
8. A local profile never shows persona handle/follower count/broadcast unless bridge is explicitly enabled.
9. The composer makes valid identity/audience choices obvious and blocks dangerous ones.
10. Identity Center lets the user preview what different audiences see.
11. Business seat behavior remains private and does not regress.
12. Home exact address privacy remains intact.

## 19. Engineering Acceptance Criteria

The implementation is ready when:

1. Public APIs use context-specific serializers.
2. Contract tests fail on forbidden response keys.
3. Persona follow/join uses `PersonaFollow` only.
4. Local follow uses `UserFollow` only.
5. Relationship code no longer silently creates persona or generic follows.
6. Post author identity is represented by `identity_context_type` and `identity_context_id`.
7. Feed service branches explicitly by distribution graph.
8. Web and mobile use typed author objects instead of raw user summaries.
9. Legacy profile routes are compatibility wrappers, not canonical public surfaces.
10. Feature flags allow staged rollout and rollback.

## 20. Open Product Questions

These should be answered before final implementation, but they do not block the core architecture:

1. Should MVP allow only one audience persona per user, or multiple personas?
2. Which categories should MVP support: creator, doctor, tutor, consultant, community leader, other?
3. Should audience profiles be searchable by default, or should sensitive categories default to unlisted?
4. Should audience lists be public, private, owner-only, or category-dependent?
5. Should persona posts support public posts at MVP, or only follower/member posts?
6. Should local `UserFollow` remain as a product concept, or should local distribution be mostly `Relationship` and nearby?
7. Should a persona owner be allowed to manually show a city in bio without enabling a formal bridge?
8. Should business profiles be allowed to link to audience personas?
9. Should professional mode eventually merge into local profile, business profile, or audience persona?

## 21. Recommended First PR Sequence

### PR 1: Serializer Boundary

- Add `identitySerializers.js`.
- Wrap selected user/profile/feed responses.
- Add forbidden-key tests.
- No visible UX changes.

### PR 2: LocalProfile Table and Backfill

- Add `LocalProfile`.
- Backfill from `User`.
- Add `localProfiles` routes.
- Move web public profile fetch to local profile API.

### PR 3: Audience Persona Table and API

- Add `PublicPersona`.
- Add persona CRUD.
- Add audience public route.
- Add Identity Center audience persona card.

### PR 4: PersonaFollow

- Add `PersonaFollow`.
- Add follow/unfollow/status routes.
- Add follower counts.
- Add tests proving separation from `UserFollow`.

### PR 5: Post Identity Context

- Add persona posting identity.
- Update `GET /api/posts/identities`.
- Update composer.
- Enforce identity/audience policy.

### PR 6: Persona Feed and Broadcast

- Add persona feed.
- Add broadcast tables/routes.
- Add persona broadcast UI.
- Add notification hooks.

### PR 7: View As and Bridges

- Add `IdentityBridgeSetting`.
- Add View As API.
- Add Identity Center preview.
- Add explicit bridge settings.

### PR 8: Legacy Cleanup and Mobile Parity

- Redirect legacy public profile routes.
- Update mobile.
- Remove unsafe raw user selectors from public contexts.
- Remove relationship auto-follow side effect or gate it behind explicit UI.

## 22. Design Principle for Future Work

Any new feature that displays another person must answer these questions before implementation:

```text
Which private account owns this action?
Which public identity is being shown?
Which graph controls access?
Which serializer returns the response?
Can this create an automatic bridge?
Can this reveal home, local, business, or audience persona context accidentally?
```

If the answer is unclear, the feature should not ship until the identity context is explicit.
