# Pantopus Relationship + Identity Execution Plan

Last updated: 2026-02-15  
Scope baseline: current code in `backend/database/schema.sql`, `backend/routes/*`, `frontend/apps/web/src/app/*`

## 1. Product Contract (Do Not Violate)

Pantopus is a multi-graph coordination system with one identity and three graphs:

1. Residency Graph (authority): `Home` + `HomeOccupancy` (+ `HomeInvite`)
2. Trust Graph (mutual): `Relationship` (+ `RelationshipPermission`)
3. Distribution Graph (asymmetric): `UserFollow`

Core rules:

- Follow never grants private access.
- Connect never grants home authority.
- Home membership gates mailbox/private home functions.
- Business is a user identity (`User.account_type='business'`) plus `BusinessProfile`.
- Professional is user mode, not a separate account.

## 2. Reality Check Against Current Codebase

### Already implemented (usable now)

- Home authority stack is strong:
  - `Home`, `HomeOccupancy`, `HomeInvite`, rich home permission model and RLS helpers.
  - `can_view_mail()` and mailbox routes already tied to home permission checks.
- Distribution graph exists:
  - `UserFollow` table and follow/unfollow logic in `backend/routes/posts.js`.
  - Feed function `get_neighborhood_feed(...)` already uses follow relationships.
- Trust primitives exist:
  - `Relationship`, `RelationshipPermission`, `is_friends()`, `can_proxy_post()`.
- Business profile system exists:
  - `User` row with `account_type='business'` + `BusinessProfile`, `BusinessTeam`, business IAM.
- Notifications exist:
  - `Notification` table + notification service and routes.
- Map and gig surfaces exist:
  - map page + `find_gigs_in_bounds(...)` endpoint path.

### Gaps to close (critical)

- No dedicated connection (trust graph) API/UX flow.
- No professional-mode entity (`UserProfessionalProfile` missing in schema snapshot).
- Follow API surface mismatch:
  - frontend uses `/api/users/:id/follow` but backend follow endpoints live in `/api/posts/follow/:userId`.
- Home API contract mismatch:
  - frontend `homes.ts` includes endpoints/payloads not aligned with backend (`/verify`, `/invite`, attach/detach payload shape).
- Map ranking is currently recency-first, not trust/quality weighted.
- Verification tiers are not modeled for professional discovery.
- No explicit visibility matrix enforcement by graph in API layer.

## 3. Canonical Data Decisions

### 3.1 Home vs UserPlace

- `Home` remains canonical shared address object (membership, mailbox, permissions).
- `UserPlace` remains personal location records (temporary/frequent/rv/etc).
- Do not replace `Home` with `UserPlace`.
- If needed, build a read-model/view that combines them for search/UI.

### 3.2 Professional Mode

Add table `UserProfessionalProfile` (new first-class table, same user identity):

- `user_id` PK/FK -> `User.id`
- `headline`, `categories[]`, `bio`, `service_area` (geojson/jsonb), `pricing_meta`, `is_public`
- `verification_tier` smallint (0/1/2)
- `verification_status` (`none|pending|verified|rejected`)
- `boost_multiplier` numeric
- `is_active`, timestamps

No separate auth/account. Deleting profile disables mode only.

### 3.3 Trust Graph Hardening

Enhance `Relationship` with:

- uniqueness guard for unordered pair (functional unique index using least/greatest)
- optional `blocked_by` and `block_reason`
- `accepted_at` (or reuse `responded_at`)

Keep `RelationshipPermission` for delegated and location visibility controls.

### 3.4 Residency Graph Friction Handling

Add provisional residency without blocking value:

- Option A (preferred): `HomeResidencyClaim` table (`pending|verified|rejected`) linked to user + home
- Option B: status fields on `HomeOccupancy` (`is_active=false` with `verification_status`)

Policy:

- provisional user gets local/public discovery access
- mailbox/private-home surfaces remain locked until verified membership

## 4. Visibility Matrix (Enforcement Spec)

| Scope | Public | Followers | Connections | Home Members |
|---|---|---|---|---|
| Public pro posts | yes | yes | yes | yes |
| Public business posts | yes | yes | yes | yes |
| Personal follower-only posts | no | yes | yes | yes |
| Personal connection-only posts | no | no | yes | yes |
| Home private content | no | no | no | yes |
| Mailbox items (home recipient) | no | no | no | home permission only |
| Exact residential address | no | no | optional (if allowed) | yes |
| Professional service area | yes (if public profile) | yes | yes | yes |

Required implementation:

- central policy helper module in backend (single source of truth)
- route-level checks must call helper (not inline ad-hoc conditions)
- add unit tests for each row in matrix

## 5. API Blueprint (Incremental)

### 5.1 Trust Graph APIs (new)

- `POST /api/relationships/requests` (send request)
- `POST /api/relationships/:id/accept`
- `POST /api/relationships/:id/reject`
- `POST /api/relationships/:id/block`
- `DELETE /api/relationships/:id` (disconnect)
- `GET /api/relationships` (mine by status)

### 5.2 Follow APIs (normalize)

Keep backend behavior, but consolidate to one canonical route family:

- `POST /api/users/:id/follow`
- `DELETE /api/users/:id/follow`
- `GET /api/users/:id/followers`
- `GET /api/users/:id/following`

Implementation can delegate to existing `UserFollow` logic; remove duplicate frontend usage of posts follow endpoints.

### 5.3 Professional Mode APIs (new)

- `POST /api/professional/profile` (enable/update)
- `GET /api/professional/profile/me`
- `GET /api/professional/:username` (public)
- `POST /api/professional/verification/start`
- `GET /api/professional/verification/status`

### 5.4 Home Onboarding/Claim APIs (new or normalized)

- `POST /api/homes/:id/claim` (provisional claim)
- `POST /api/homes/:id/claim/:claimId/approve`
- `POST /api/homes/:id/claim/:claimId/reject`
- Keep invite flow for low-friction household add.

## 6. Ranking + Map Strategy (Implementable v1)

Current `find_gigs_in_bounds` returns recency order only.  
Add ranked variant with deterministic score:

`score = w_distance*D + w_rating*R + w_completion*C + w_verification*V + w_recency*T + w_boost*B`

Guardrails:

- paid boost caps at max contribution (cannot dominate poor trust metrics)
- hidden exact addresses remain hidden (use approximate/proxy location for public map)
- include explainable components in debug payload for tuning

Implementation path:

- add SQL function `find_ranked_gigs_in_bounds(...)`
- optionally materialize denormalized worker quality stats for fast ranking
- return `score` and component breakdown in internal mode

## 7. Monetization Trigger Map

Implement as event-triggered hooks, not ad-hoc route logic.

- Mailbox Ads:
  - trigger on verified home attachment + mailbox opt-in
- Gig Commission:
  - already aligned with payment flow; add reporting dimensions by graph
- Professional Boosts:
  - add boost subscription table and multiplier application in ranking
- Verification Fees:
  - charge when requesting Tier 1/2 checks
- Business Ads:
  - tie to map/search placement with sponsored label

## 8. Fraud, Safety, and Privacy Controls

- Enforce home-address privacy split:
  - professional service area visible
  - residential exact address hidden unless explicit allowed context
- Add abuse controls:
  - relationship request rate limits
  - follow spam throttles
  - invite abuse throttles
- Use `StripeAccount` and payment risk signals for trust moderation.

## 9. Global-Scale Readiness

Add now (small schema/API additions, large future upside):

- `currency` on gigs/quotes if not set everywhere
- localization fields for public business/professional content
- verification provider abstraction by country
- timezone normalization in onboarding and notifications

## 10. AI Tie-ins (Pragmatic)

Ship only where measurable:

- follow recommendations (local relevance + trust signals)
- verification nudges ("verified pros get X% more accepts")
- gig matching suggestions
- abuse anomaly detection (request/follow/invite patterns)

## 11. KPIs by Graph

Residency Graph:

- address attachment rate
- provisional->verified conversion
- mailbox weekly active households

Trust Graph:

- request acceptance rate
- connection density per active user
- connection->message or connection->gig conversion

Distribution Graph:

- follow->profile visit
- follow->gig view
- follow->gig conversion

Cross-graph:

- 30/60/90 day retention by onboarding intent
- trust-tier impact on completion/review outcomes

## 12. 90-Day Execution Plan

### Phase 0 (Week 1): Contract + Cleanup

- Freeze graph definitions in docs and tests.
- Resolve route contract drift (`users follow` and `homes endpoint` mismatches).
- Add integration tests for existing follow and home invite flows.

Exit criteria:

- API contracts match frontend SDK
- no duplicate follow paths in production clients

### Phase 1 (Weeks 2-3): Trust Graph Launch

- Add relationship endpoints + DB hardening (unique pair, block handling).
- Add connection request UI on public profile.
- Add notification types for request/accept/block.

Exit criteria:

- end-to-end request/accept/block works
- visibility matrix tests for connection-only surfaces pass

### Phase 2 (Weeks 4-5): Professional Mode v1

- Add `UserProfessionalProfile` schema + CRUD APIs.
- Add profile toggle in onboarding/settings.
- Public professional discovery cards on map/search.

Exit criteria:

- user can enable/disable professional mode without account split
- public discoverability honors `is_public`

### Phase 3 (Weeks 6-7): Verification Tiering

- Tier 0 default.
- Tier 1 identity verification workflow (manual or provider-backed).
- Tier 2 placeholders and admin tools.
- Trust score UI nudges instead of hard onboarding gate.

Exit criteria:

- verification status visible in pro card/profile
- ranking consumes tier signal

### Phase 4 (Weeks 8-9): Residency Friction Fix

- Add provisional residency flow and claim approvals.
- Unlock value before full verification (public/local discovery).
- Keep mailbox/private home gated.

Exit criteria:

- bounce on home join reduced
- mailbox access only for verified authority paths

### Phase 5 (Weeks 10-11): Ranking + Monetization Hooks

- Ship ranked map function and feature flag rollout.
- Add boost multiplier and sponsored labeling.
- connect monetization events to reporting pipeline.

Exit criteria:

- ranking function replaces recency-only for target surfaces
- paid boost cannot outrank low-trust floor rules

### Phase 6 (Week 12): Growth Loop + Hardening

- notification strategy by lifecycle stage
- first 90-day loop instrumentation and dashboards
- fraud and abuse guardrails tuning

Exit criteria:

- weekly KPI dashboards live
- rollback-safe flags for ranking and boosts

## 13. Engineering Backlog Starter (Concrete Tickets)

Database:

- Add `UserProfessionalProfile`
- Add relationship pair uniqueness index
- Add provisional residency table/status
- Add ranking function and supporting indexes

Backend:

- Create relationship routes/service
- Normalize follow endpoints under `/api/users/*`
- Add professional routes + verification workflow
- Build central visibility-policy helper and tests

Frontend:

- professional onboarding flow
- connection request and state UI
- follow behavior normalization
- visibility-aware profile sections (address vs service area)

Data/Analytics:

- event taxonomy for graph actions
- KPI dashboard queries
- ranking telemetry (score components)

## 14. Non-Negotiable Anti-Drift Rules

- Follower count never primary UI KPI.
- No infinite algorithmic feed as default surface.
- Map/Mailbox/Home remain top-level utility flows.
- Professional content must be clearly labeled.

## 15. Immediate Next Actions (This Week)

1. Align API contracts (follow + homes SDK drift) and ship tests.
2. Implement trust graph endpoints using existing `Relationship` tables.
3. Add `UserProfessionalProfile` migration and minimal edit/view UI.
4. Add provisional residency claim model and mailbox gate checks.
5. Draft visibility policy tests before adding more social UI.


3. Misalignments Between Requirements and Execution Plan
3a. Table Naming: UserConnection vs Relationship
The requirements PDF calls the Trust Graph table UserConnection. The execution plan and the actual schema use Relationship. The plan correctly identifies the existing table and proposes hardening it rather than creating a new one. This is the right call -- keep Relationship and don't rename. Just note the terminology difference so the team doesn't get confused.
3b. HomeMembership vs HomeOccupancy
The requirements PDF uses HomeMembership. The schema has HomeOccupancy. Same entity, different name. The execution plan correctly uses HomeOccupancy. No action needed, but the naming should be settled in docs.
3c. Missing from Execution Plan: Onboarding Intent
The requirements PDF has a detailed onboarding flow with intent selection ("I want to hire", "I want to offer services", "I run a business", "I just want to connect"). The execution plan doesn't address this at all. This should be at least a Phase 2 or Phase 4 item since it drives UI prioritization.
3d. Missing from Execution Plan: Notification Strategy per Graph Action
The execution plan mentions notifications in Phase 6 ("notification strategy by lifecycle stage") but the requirements PDF lists notification strategy as one of the 10 design deliverables. Given that connection requests, follow events, and home claims all generate notifications, notification types should be defined in Phases 1-4 alongside their features, not deferred to Phase 6.
4. Risks and Pressure Points
Risk 1: Schema Migration Complexity
The git status shows deleted migration files (001-009). If those were already applied to production, the schema.sql is the source of truth. New migrations for UserProfessionalProfile, HomeResidencyClaim, and relationship hardening should be cleanly sequenced and idempotent.
Risk 2: Frontend Double-Follow Code
Both frontend/packages/api/src/endpoints/users.ts and endpoints/posts.ts export follow/unfollow functions. When normalizing to /api/users/:id/follow, both callers need updating simultaneously or one path will break. The execution plan should explicitly call this out as a coordinated frontend+backend change.
Risk 3: Scope Creep on Professional Mode
The requirements PDF keeps Professional simple (toggle + profile). The execution plan adds verification tiers, boost multipliers, and ranking integration across Phases 2-5. This is fine architecturally, but Phase 2 should ship the minimal UserProfessionalProfile with CRUD only, and verification/ranking should be strictly Phase 3+.
Risk 4: No Tests for Existing Graph Primitives
The test directory has payment-related tests only (leakyPipe, paymentStateMachine, postTransferRefund). There are zero tests for:
Follow logic
Relationship logic
Home permission logic
Post visibility logic
Phase 0 should include writing tests for these existing flows before modifying them. The plan says "add integration tests for existing follow and home invite flows" which is correct, but I'd expand it to also include is_friends(), can_proxy_post(), and canViewPost().
5. Recommended Adjustments to the 90-Day Plan
Phase	Plan Says	I'd Adjust
Phase 0 (Week 1)	Resolve route drift + add tests	Also: write tests for is_friends(), canViewPost(), home permissions. Delete duplicate follow exports in frontend.
Phase 1 (Weeks 2-3)	Trust graph endpoints	Also: define notification types for request/accept/block. Add GET /api/users/:id/relationship convenience endpoint.
Phase 2 (Weeks 4-5)	Professional mode v1	Keep minimal: CRUD + toggle + public card. No verification or ranking here. Add onboarding intent capture.
Phase 3 (Weeks 6-7)	Verification tiering	Fine as-is. Add verification notification types.
Phase 4 (Weeks 8-9)	Residency friction fix	Add claim-by-address (not just by home_id).
Phase 5 (Weeks 10-11)	Ranking + monetization	Fine as-is.
Phase 6 (Week 12)	Growth loop	Fine, but notification strategy should already be done by now per Phases 1-4.
6. Architecture Recommendation: Visibility Policy Module
This is the single most important new piece of infrastructure. I'd recommend creating it as backend/utils/visibilityPolicy.js with these functions:
// Core checkscanViewContent(viewerId, content) // dispatches based on content.visibilitycanViewProfile(viewerId, profileUserId) // full vs limited profilecanViewAddress(viewerId, homeId) // exact vs approximatecanMessageUser(senderId, recipientId) // requires connectioncanViewGig(viewerId, gig) // public vs trust-gated// Graph queries (cached/memoized)getRelationshipStatus(userA, userB) // none/pending/connected/blockedisFollowing(followerId, followingId)isHomeMember(userId, homeId)
Every route handler would call these instead of inline checks. This is what makes the visibility matrix enforceable and testable.
Verdict
The execution plan is well-structured and mostly accurate against the codebase reality. The 90-day phasing is reasonable. The main things to tighten:
Phase 0 is underscoped -- add more test coverage for existing primitives before modifying them
Follow normalization is a coordinated frontend+backend change that needs explicit tracking
Notification types should be defined alongside their features, not deferred to Phase 6
The visibility policy module is the keystone -- it should be specced in Phase 0 and built incrementally across Phases 1-4
Onboarding intent from the requirements PDF is missing from the execution plan entirely