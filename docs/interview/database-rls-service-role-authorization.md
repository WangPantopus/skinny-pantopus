# Interview Notes: RLS, Service Role, and Privacy Authorization

This document answers a recurring database and backend authorization question for this repository:

> The docs emphasize Row Level Security (RLS), but the backend often uses `supabaseAdmin`. What is the real enforcement boundary, which data can clients access directly, and how do we prevent privacy leaks?

The short answer is:

> RLS is important defense-in-depth, but it is not the primary enforcement boundary for backend flows that use the Supabase service-role key. The real boundary is the backend authorization layer: authenticated request, domain-specific visibility check, minimal service-role query, and explicit serializer/projection.

This is the answer I would give in an interview as the engineer responsible for the system.

## 1. Mental Model

There are three distinct trust zones:

| Zone | Credential | RLS Applies? | Intended Usage |
| --- | --- | --- | --- |
| Public/anonymous client | Supabase anon key or unauthenticated API request | Yes, if querying Supabase directly | Public read-only projection views only |
| Authenticated client | User JWT with anon key or authenticated backend request | Yes for direct Supabase access | Prefer backend APIs; direct Supabase access only for explicitly safe views |
| Backend service-role | `SUPABASE_SERVICE_ROLE_KEY` via `supabaseAdmin` | No | Trusted server-side code only |

The dangerous misunderstanding is to say "the database has RLS, so data is protected" while the application uses `supabaseAdmin`. Supabase service-role bypasses RLS. That is expected and useful for trusted backend operations, but it means every service-role read must be treated as privileged code.

In this repository, the backend starts from an authenticated request, verifies the Supabase JWT, resolves the current user, and then performs domain authorization before querying or returning data. The relevant files are:

- `backend/config/supabaseAdmin.js`: creates the service-role client.
- `backend/config/supabase.js`: creates the anon client used for auth flows.
- `backend/middleware/verifyToken.js`: validates the JWT and attaches `req.user`.
- `backend/middleware/optionalAuth.js`: attaches an optional viewer for public-but-personalized endpoints.
- `backend/serializers/identitySerializers.js`: explicit public/privacy-safe response projections.

## 2. The Real Enforcement Boundary

The real enforcement boundary is:

```text
HTTP request
  -> JWT/cookie validation
  -> req.user / optional viewer identity
  -> route-level domain authorization
  -> constrained service-role query
  -> serializer / response allowlist
  -> response
```

That means the system is only safe if all of the following are true:

1. The route knows who the actor is.
2. The route knows which object is being requested.
3. A domain-specific authorizer proves the actor can see or mutate the object.
4. The database query is scoped to that authorization decision.
5. The response is serialized through an explicit allowlist.
6. Tests and CI prevent new fields or joins from leaking private data.

RLS still matters, but its role is narrower:

- It protects any direct Supabase access using anon/authenticated roles.
- It protects safe public views.
- It reduces blast radius if a frontend accidentally points at Supabase.
- It documents intended data boundaries at the database layer.
- It is a second line of defense for future code paths that do not use the service-role client.

For backend flows using `supabaseAdmin`, RLS is not the final guardrail. The backend authorization and serializer layer is.

## 3. Why `supabaseAdmin` Exists

Using service-role access is not automatically wrong. This codebase has legitimate reasons to use it:

- APIs often need to fetch data across multiple users or homes after application-level authorization.
- Some workflows are system initiated: webhooks, background jobs, notifications, payment reconciliation, and migrations.
- Some reads need internal columns to make an authorization decision but must not return those columns.
- Supabase RLS can become hard to express for cross-domain visibility such as home membership, persona tiers, scoped address grants, and block propagation.

The engineering rule is:

> Service-role reads are allowed only when the route or service has an explicit subject, an explicit scope, an explicit authorization check, and an explicit response projection.

Service-role code should be reviewed like kernel code. It can see everything, so every line that queries private data must prove why that access is safe.

## 4. Which Tables Are Safe to Access Directly From Clients?

In practice, first-party clients should not access raw application tables directly. They should call backend APIs.

The only client-safe database surfaces are explicitly designed read-only projection views with:

- named public columns;
- no raw personal/account identifiers beyond intended public IDs;
- restrictive `WHERE` clauses;
- grants to `anon` and/or `authenticated`;
- no dependency on hidden backend filtering.

The primary safe direct surfaces are defined in `supabase/migrations/20260506000002_identity_firewall_rls_safe_views.sql`:

| View | Safe Because |
| --- | --- |
| `PublicLocalProfileView` | Public local profile projection only; filters to public/searchable profiles |
| `PublicAudienceProfileView` | Public persona/audience profile projection only; filters to active searchable personas |
| `PublicBroadcastMessageView` | Public broadcast message projection only; filters to published public messages |

These are views, not raw tables. They are safe because adding a new sensitive column to a base table does not automatically expose it through the view.

If a legacy migration grants direct access to a raw table, I would not treat that as a product contract. I would treat it as debt unless the table has a current reviewed RLS policy, explicit grants, tests, and a documented frontend use case.

## 5. Which Tables Must Only Be Accessed Through Backend APIs?

The default is backend-only. Any table with private identifiers, exact location, membership, payment state, block state, or internal workflow state must not be queried directly by clients.

### Identity And Account

Backend-only:

- `User`
- `UserPrivacySettings`
- `UserBlock`
- `UserProfileBlock`
- `LocalProfile`
- `PublicPersona`
- `PersonaMembership`
- `PersonaTier`
- `PersonaBlock`
- `PersonaQuotaUsage`
- `IdentityBridgeSetting`
- `AudienceIdentity`
- `IdentityAuditLog`
- `AdminAccessLog`

Reason: these tables connect public surfaces to private user identity, local identity, creator identity, block state, and audit history.

### Home, Address, And Household

Backend-only:

- `Home`
- `HomeOccupancy`
- `HomeOwner`
- `HomeAuthority`
- `HomeLease`
- `HomeLeaseResident`
- `HomeLeaseInvite`
- `HomeDispute`
- `HomeAuditLog`
- `HomeAddress`
- `AddressClaim`
- `AddressVerification*`
- `MailVerificationJob`
- provider/cache/shadow address tables

Reason: these tables expose household membership, address claims, exact location, authority relationships, and verification state.

### Mailbox And Physical Mail

Backend-only:

- `Mail`
- `MailPackage`
- `BookletPage`
- `MailAlias`
- `MailEvent`
- mail assets
- mail maps
- mail vault/wallet/stamp tables

Reason: mail data is tied to specific people, homes, aliases, and physical-world delivery metadata.

### Social, Feed, And Chat

Backend-only:

- `Post`
- `PostLike`
- `PostSave`
- `PostHide`
- `PostMute`
- `Relationship`
- `RelationshipPermission`
- `ChatRoom`
- `Message`
- reactions and read receipts
- direct chat RPCs

Reason: visibility depends on viewer, blocks, persona membership, place, relationship, distribution targets, and local/privacy context.

### Persona And Broadcast

Backend-only except for explicit public views:

- `BroadcastChannel`
- `BroadcastMessage`
- `PersonaDmThread`
- `PersonaDmMessage`
- `PersonaFollow` compatibility view for new client usage should be avoided in favor of APIs

Reason: persona data has separate fan/creator privacy boundaries. Fan identity must not collapse into local identity.

### Marketplace, Gigs, Payments, And Business

Backend-only:

- `Gig`
- `GigBid`
- `GigPrivateLocation`
- `Listing`
- `ListingAddressGrant`
- offers and trades
- `Payment`
- `PaymentMethod`
- `StripeAccount`
- `Refund`
- `Payout`
- `BusinessInvoice`
- `Wallet`
- `Business*`
- `BusinessSeat`
- `SeatBinding`
- `BusinessTeam`
- `BusinessPermissionOverride`
- `BusinessRolePermission`
- `BusinessAuditLog`

Reason: these tables contain ownership, payment, exact address, KYC, business membership, and authorization state.

### Support, Jobs, Queues, And Internal State

Backend-only:

- `SupportTrain*`
- `SupportTrainAddressGrant`
- seeder/source/queue tables
- notification internals
- feature flags if writable
- audit logs
- background job state
- internal cache/context tables

Reason: these are operational or privileged workflow tables.

## 6. How To Audit Service-Role Queries For Privacy Leaks

The audit process is both mechanical and semantic.

### Mechanical Audit

Search every service-role read:

```bash
rg "supabaseAdmin\\.from|supabaseAdmin\\.rpc" backend
```

For each occurrence, classify:

- table or RPC being accessed;
- actor identity;
- object scope;
- operation type: read, write, admin, background, webhook;
- whether route requires auth, optional auth, admin auth, or system auth;
- selected columns;
- nested relational selects;
- response serializer;
- tests that cover visibility and forbidden fields.

### Questions Every Service-Role Query Must Answer

1. Who is the actor?
2. Is the actor authenticated, optional, admin, system, or webhook?
3. What is the requested object?
4. Which authorization function proves visibility?
5. Is the query constrained by actor/object scope?
6. Are nested child rows separately authorized?
7. Is the selected column list minimal?
8. Does the response pass through a serializer?
9. Could a newly added column leak?
10. Does CI catch this pattern if copied elsewhere?

### Existing CI Privacy Gates

The current repository has privacy gates in `backend/scripts/ci/run-privacy-gates.js`. Important checks include:

- `backend/tests/unit/privacy/serializerForbiddenKeys.test.js`
- `backend/tests/unit/notificationContextFirewall.test.js`
- `backend/scripts/ci/check-legacy-identity-aliases.js`
- `backend/scripts/ci/check-legacy-ui-terms.js`
- `backend/scripts/ci/check-creator-select.js`
- `backend/scripts/ci/check-raw-personal-selects.js`
- `backend/scripts/ci/check-nested-user-selects.js`
- integration tests for audience profile behavior

The two most important static guards are:

- `check-raw-personal-selects.js`: blocks raw SQL selections of personal `User` columns and audience-side access to local profile data.
- `check-nested-user-selects.js`: blocks new nested `User(...)` selects that hydrate personal fields such as name, city, or state outside of controlled legacy allowlists.

The presence of an allowlist is an important reality check: some legacy code paths may still exist. The correct interview answer is not "everything is perfect"; it is "we know where the risky patterns are, we gate new ones, and we migrate old ones behind serializers."

### Serializer Audit

The serializer layer is the final response firewall.

Important examples:

- `SAFE_CREATOR_SELECT`
- `serializePrivateAccount`
- `serializeLocalProfileForViewer`
- `serializeAudienceProfileForViewer`
- `serializeFanForCreator`
- `serializeMembershipForFan`
- `serializeBusinessSeatForViewer`
- `serializeUserAsLocalIdentity`
- `serializePostAuthorForViewer`
- `sanitizePersonaPostForViewer`

The service-role query may fetch private columns internally, but the returned JSON must be an allowlisted shape.

### Runtime Audit Improvements

The next hardening step I would add is a small service-role wrapper:

```js
privacyRead({
  actorId,
  purpose: 'persona.broadcast.list',
  table: 'BroadcastMessage',
  scope: { personaId },
  select: 'id, persona_id, visibility, body, created_at',
  execute: () => supabaseAdmin.from('BroadcastMessage')...
})
```

That wrapper can log:

- actor;
- purpose;
- table;
- selected columns;
- route;
- request ID;
- row count;
- whether a serializer was applied.

This makes privacy review and incident response much faster.

## 7. How To Keep RLS Policies And Backend Authorization From Drifting

Drift happens when the database policy says one thing and backend code says another.

Because the backend uses service-role, I cannot rely on RLS alone. I need contract tests and shared authorization definitions.

### Preferred Pattern

For each domain, choose one source of truth:

| Domain | Source Of Truth |
| --- | --- |
| Home permissions | `backend/utils/homePermissions.js` |
| Mail visibility | DB RPC `can_view_mail`, called from `backend/services/ai/mailAccess.js` |
| Profile/search visibility | `backend/utils/visibilityPolicy.js` |
| Persona membership/tier visibility | persona route helpers and identity profile helpers |
| Feed visibility | `backend/services/feedService.js` |
| Business permissions | business seat and permission utilities |
| Support train permissions | support train middleware |

When a database function exists, backend code should call it rather than reimplement it. When backend logic must exist in JavaScript, tests should compare it against the expected database/RLS behavior.

### Contract Test Matrix

Every private domain should have a matrix like:

| Actor | Object | Relationship | Expected |
| --- | --- | --- | --- |
| anonymous | public persona post | none | visible |
| anonymous | follower persona post | none | hidden |
| follower | follower persona post | active membership rank 1 | visible |
| lower-tier member | higher-tier broadcast | insufficient rank | locked teaser only |
| blocked fan | persona DM thread | blocked | hidden/forbidden |
| home non-member | exact address | none | hidden |
| verified resident | home record | active occupancy | visible according to role |
| pending resident | sensitive record | pending occupancy | hidden |

Then test both:

- the API response;
- the DB/RPC policy result where applicable.

### CI Drift Gates

CI should fail on:

- new grants to `anon` or `authenticated` on private raw tables;
- direct raw `User` selections in public/audience code;
- new nested `User(...)` selects outside approved patterns;
- new `select('*')` in privacy-sensitive response paths;
- serializers returning forbidden keys;
- public views adding columns without review;
- migrations that enable broad grants without RLS tests.

## 8. Tests For Block Lists

Blocks are especially sensitive because they are both authorization data and privacy data. A block can reveal a relationship between two people.

### Behavior To Test

1. A user cannot block themselves.
2. Blocking a nonexistent user fails.
3. A personal block inserts or updates `UserBlock`.
4. Personal block checks are bidirectional for interaction surfaces.
5. A personal block prevents chat, search discovery, feed interaction, and direct profile access where applicable.
6. Personal blocks propagate to persona blocks for personas owned by the blocker.
7. Persona blocks do not create reverse `UserBlock` rows.
8. Persona block lists do not expose local `user_id`, email, legal name, local profile, or block source.
9. Creator-side unblock only removes owner-removable block sources.
10. Platform safety, chargeback, and system blocks cannot be silently removed by the creator.
11. Block deletion invalidates caches.
12. Errors in block-cache lookup do not leak data through partial enforcement.

### Why Persona Blocks Are One-Way

If a creator blocks a fan persona membership, that should not necessarily create a local account block. Creating a local `UserBlock` from a persona action could reveal that a particular fan handle maps to a particular local account.

The privacy boundary is:

- local/user block may propagate into persona block;
- persona/fan block must not expose or mutate local identity unless explicitly designed and authorized.

### Relevant Implementation

- `backend/routes/blocks.js`
- `backend/services/blockService.js`
- `backend/services/personaBlockService.js`
- `backend/routes/personaBlocks.js`
- `backend/tests/unit/personaBlockPropagation.test.js`
- `backend/tests/unit/identitySearch.test.js`
- `backend/tests/integration/audienceProfile.e2e.test.js`

## 9. Tests For Home Membership Visibility

Home visibility is not a single boolean. It depends on ownership, verified occupancy, role, explicit grants, and resource sensitivity.

### Actors To Test

- owner;
- verified resident;
- verified manager/admin role;
- pending resident;
- expired resident;
- invited but not accepted user;
- non-member;
- blocked user;
- public-preview viewer;
- service/system actor.

### Objects To Test

- home profile;
- exact address;
- household members;
- home records;
- tasks;
- mailbox/mail;
- leases;
- authority actions;
- scoped address grants;
- sensitive documents;
- public preview data.

### Expected Rules

1. Non-members cannot see private home data.
2. Public preview never exposes exact address or private household state.
3. Verified active occupancy can see member-visible data.
4. Pending or expired occupancy does not confer full sensitive access.
5. Role rank prevents lower-ranked users from mutating higher-ranked members.
6. Explicit permission overrides are honored but cannot exceed grantor authority.
7. Mailbox visibility agrees with `can_view_mail`.
8. Sensitive records require elevated permission or ownership.
9. Exact address requires membership or a scoped address grant.
10. Home APIs must not leak member private profile data through nested selects.

### Relevant Implementation

- `backend/utils/homePermissions.js`
- `backend/routes/home.js`
- `backend/services/ai/mailAccess.js`
- `backend/tests/homePermissions.test.js`
- `backend/tests/unit/homePermissions.test.js`
- `backend/tests/unit/homeIam.test.js`
- `backend/tests/homeProfileV2.test.js`
- `backend/tests/integration/home-mailbox.test.js`
- `backend/tests/scopedGrant.test.js`
- `backend/tests/guestPass.test.js`

## 10. Tests For Persona Visibility

Persona visibility has a separate identity model from local accounts. That is one of the most important privacy boundaries in the system.

### Actors To Test

- anonymous viewer;
- logged-in non-follower;
- follower;
- paid member;
- higher-tier member;
- creator/owner;
- blocked fan;
- suspended persona;
- platform/admin actor.

### Objects To Test

- persona public profile;
- bridge fields to local identity;
- public posts;
- follower posts;
- member/tier posts;
- broadcast messages;
- locked broadcast teasers;
- persona DM threads;
- membership records;
- creator audience list;
- search results.

### Expected Rules

1. Public persona profile is visible only if the persona is active/searchable.
2. Suspended personas are hidden from public viewers.
3. Bridge fields appear only when `IdentityBridgeSetting` explicitly allows them.
4. Public posts are visible to everyone.
5. Follower posts require active follower/member status.
6. Tier posts require sufficient tier rank.
7. Lower-tier viewers may get locked teaser metadata but not private body/media.
8. Creator can see owner-only draft/analytics surfaces where intended.
9. Blocked viewers cannot follow, DM, read gated content, or appear in audience flows.
10. Creator audience lists expose fan persona data, not raw local account data.
11. Persona responses do not include raw `User.email`, legal name, exact address, local profile, or internal payment fields.

### Relevant Implementation

- `backend/routes/personas.js`
- `backend/routes/broadcastChannels.js`
- `backend/routes/personaDms.js`
- `backend/routes/personaBlocks.js`
- `backend/serializers/identitySerializers.js`
- `backend/tests/unit/privacy/serializerForbiddenKeys.test.js`
- `backend/tests/integration/identityCenter.viewAs.test.js`
- `backend/tests/integration/audienceProfile.e2e.test.js`
- `backend/tests/unit/identitySearch.test.js`

## 11. Where "Can This User See This Object?" Is Implemented

| Domain | Authorization Location | Notes |
| --- | --- | --- |
| Request identity | `backend/middleware/verifyToken.js`, `backend/middleware/optionalAuth.js` | Establishes `req.user` or optional viewer |
| Admin | `verifyToken.requireAdmin`, admin middleware/routes | Must be explicit; service-role alone is not admin auth |
| Home | `backend/utils/homePermissions.js`, `backend/routes/home.js` | Owner, occupancy, role, overrides, role defaults |
| Home authority/lease | `backend/utils/authorityResolution.js`, authority middleware, landlord/tenant routes | Caller-supplied authority IDs are not trusted |
| Mail | DB RPC `can_view_mail`, `backend/services/ai/mailAccess.js`, mailbox routes | Mail visibility is home/user scoped |
| Local profile/search | `backend/utils/visibilityPolicy.js`, `backend/routes/identitySearch.js` | Searchability, scoped blocks, profile visibility |
| Feed/posts | `backend/services/feedService.js`, post routes | Surface, distribution target, location, blocks, persona rank |
| Persona profile/posts | `backend/routes/personas.js` | Public/follower/tier/owner visibility |
| Persona broadcast | `backend/routes/broadcastChannels.js` | Public/follower/subscriber/tier gates, locked teasers |
| Persona DMs | `backend/routes/personaDms.js` | Owner or membership participant only |
| Persona blocks | `backend/services/personaBlockService.js`, `backend/routes/personaBlocks.js` | Fan identity separation from local identity |
| User blocks | `backend/services/blockService.js`, `backend/routes/blocks.js` | Bidirectional interaction gate |
| Chat | chat routes/socket services plus block service | Participants and block checks |
| Marketplace/listings | listing routes, location privacy utilities, address grants | Exact address requires owner/grant |
| Gigs | gig routes, location precision utilities, private location table | Exact location only for authorized participants |
| Business | business seat middleware and business permission utilities | Seat status, role, overrides |
| Support trains | `backend/middleware/supportTrainPermissions.js` | Role-based support train viewing/mutation |
| Payments | Stripe/payment services and route ownership checks | Backend-only, no direct client table access |
| Notifications/email | notification template registry, email service, privacy tests | Context-specific placeholder allowlists |

## 12. Authorization For Nested Relational Selects

Nested relational selects are one of the biggest risks in a Supabase service-role backend.

Example risk:

```js
supabaseAdmin
  .from('Post')
  .select('*, User(*)')
```

With service-role access, that can hydrate private `User` columns even if the viewer should only see a public author card.

The safe pattern is:

1. Authorize the parent rows first.
2. Fetch related rows separately when their visibility rules differ.
3. Select only the columns needed for the response.
4. Use safe select constants for repeated projections.
5. Pass all related objects through serializers.
6. Add deep forbidden-key tests for the final JSON.

Where nested selects are unavoidable, the selected child relation must be treated like its own API response. It needs a named projection and tests.

The current repository already recognizes this risk:

- `check-nested-user-selects.js` prevents new unsafe nested user selects.
- `SAFE_CREATOR_SELECT` prevents broad creator/user projections.
- `feedService` uses controlled author hydration and serialization.
- persona DM and persona block code often fetches related data in steps to avoid leaking local identity.

The interview phrasing I would use:

> Parent authorization does not authorize every child row or every child column. A nested select needs both row authorization and column projection authorization.

## 13. Preventing Accidental Exposure When Adding New Columns

New columns default to private.

Adding a column to a base table must not automatically expose it to clients. The system prevents that by using:

- backend APIs instead of raw table access;
- public views with explicit column lists;
- serializers with explicit output keys;
- tests that search for forbidden fields;
- CI checks for unsafe select patterns;
- migration review for grants and policies.

### New Column Checklist

For every new column:

1. Classify it:
   - public;
   - local identity;
   - audience/persona identity;
   - home/private household;
   - exact location/address;
   - payment/KYC;
   - moderation/safety;
   - internal/operational.
2. Decide whether it can ever be public.
3. Do not expose it through public views by default.
4. Do not add it to serializers by default.
5. If a backend service needs it internally, select it only in that service.
6. If a response needs it, add a specific serializer field and a visibility test.
7. If sensitive, add it to forbidden-key tests.
8. Run privacy gates.
9. Review grants in the migration.

### Good Default

The safe default for a new column on a private table is:

```sql
-- No client grants.
-- No public view exposure.
-- Backend reads only after route authorization.
-- Serializer exposure requires separate review.
```

This is why views are safer than direct table grants. If `User` gets a new `legal_name` column, `PublicLocalProfileView` does not leak it unless someone intentionally adds it to the view.

## 14. Emergency Response If A Policy Exposes Private Data

Treat it as a security incident.

### Step 1: Contain

Immediately stop the exposure:

- revoke the bad grant;
- drop or disable the bad policy;
- remove public view access;
- feature-flag or disable the leaking route;
- deploy a serializer hotfix;
- pause jobs/webhooks that copy or fan out the leaked data.

For database exposure, the fastest containment is usually a migration like:

```sql
revoke all on table "PrivateTable" from anon, authenticated;
revoke all on table "PrivateTable" from public;
```

For API exposure, remove the field from the serializer or block the route while the patch is deployed.

### Step 2: Stop Secondary Exposure

Depending on what leaked:

- invalidate CDN/API caches;
- expire signed URLs;
- rotate exposed tokens or keys;
- revoke temporary grants;
- delete derived notification/email payloads if possible;
- pause search indexing or background sync jobs.

### Step 3: Determine Blast Radius

Answer:

- which table/view/route leaked;
- which fields leaked;
- which users or homes were affected;
- when exposure started;
- when exposure ended;
- whether data was accessed;
- whether data was cached or copied elsewhere.

Use:

- API logs;
- database/PostgREST logs;
- CDN logs;
- application request IDs;
- service-role audit logs;
- notification/email job payloads;
- search/indexing logs.

### Step 4: Patch And Prove

The patch must include:

- policy/grant fix;
- serializer/projection fix;
- regression test that fails before the patch;
- migration smoke test if grants changed;
- privacy gate update if a new field pattern leaked.

Do not only patch the symptom. Add a CI check so the same class of leak cannot return.

### Step 5: Notify And Postmortem

Follow security/privacy incident handling:

- severity assessment;
- legal/compliance review;
- user notification if required;
- root cause;
- timeline;
- permanent prevention tasks;
- owner and deadline for each task.

## 15. Interview-Ready Answer Summary

If I had to compress the answer into a few strong statements:

1. RLS protects direct Supabase access. It does not protect service-role backend queries.
2. The backend authorization layer is the real enforcement boundary.
3. Raw private tables are not client-safe. Only explicit public projection views are.
4. Every service-role query must have an actor, object, authorization check, scoped query, and serializer.
5. Nested relational selects are treated as separate privacy decisions.
6. New columns default private and are exposed only through reviewed views or serializers.
7. Drift is prevented with contract tests comparing domain visibility behavior across API and DB/RPC policies.
8. Block, home, and persona visibility require matrix tests because simple owner checks are not enough.
9. Emergency response starts with revoking access, then blast-radius analysis, regression tests, and postmortem hardening.

## 16. Practical Review Checklist

Use this checklist for any new API, migration, or feature:

- Does this route use `verifyToken`, `optionalAuth`, admin auth, webhook auth, or system auth?
- What is the actor ID?
- What object is being accessed?
- Which function proves visibility?
- Does the query use `supabaseAdmin`?
- Is the query scoped by actor, object, home, persona, membership, grant, or role?
- Are there nested selects?
- Are nested rows independently authorized?
- Is the selected column list minimal?
- Is `select('*')` avoided on private response paths?
- Does the response pass through a serializer?
- Could the response include newly added columns?
- Are block lists applied?
- Are home membership rules applied?
- Are persona membership/tier rules applied?
- Are exact address/location fields protected?
- Are payment/KYC/internal fields protected?
- Are public views explicit and narrow?
- Are grants to `anon`/`authenticated` intentional?
- Are tests present for allow and deny cases?
- Are forbidden fields tested deeply in JSON responses?
- Do privacy gates pass?

## 17. Final Position

The mature position is not "we use RLS, therefore we are safe." The mature position is:

> RLS, grants, backend authorization, serializers, and tests are layered controls. In this repository, any code path using `supabaseAdmin` moves the enforcement boundary from the database policy engine into the backend. That is acceptable only because we centralize visibility decisions, minimize projections, serialize responses explicitly, and continuously test the privacy contract.

