# Authentication and Authorization Production Audit

Date: 2026-03-08

Scope reviewed:
- `backend/middleware/verifyToken.js`
- `backend/middleware/requireAuthority.js`
- `backend/middleware/requireBusinessSeat.js`
- `backend/routes/users.js`
- `backend/routes/landlordTenant.js`
- `backend/routes/homeIam.js`
- `backend/routes/businessIam.js`
- `backend/routes/businessSeats.js`
- `backend/routes/businesses.js`
- `backend/services/addressValidation/landlordAuthorityService.js`
- `backend/utils/homePermissions.js`
- `backend/utils/businessPermissions.js`
- `backend/utils/seatPermissions.js`
- `backend/app.js`
- `backend/database/schema.sql`
- `supabase/migrations/20260301000001_identity_firewall_tables.sql`
- `supabase/config.toml`
- `frontend/packages/api/src/client.ts`
- `frontend/packages/api/src/endpoints/auth.ts`
- `frontend/apps/web/src/components/mailbox/MailItemDetail.tsx`
- `frontend/apps/mobile/src/contexts/AuthContext.tsx`
- `backend/tests/unit/registerRoutes.test.js`
- `backend/tests/unit/oauthRoutes.test.js`
- `backend/tests/unit/requireAuthority.test.js`
- `backend/tests/unit/landlordTenantRoutes.test.js`

Tests run:
- `npm test -- --runInBand tests/unit/registerRoutes.test.js tests/unit/oauthRoutes.test.js tests/unit/requireAuthority.test.js tests/unit/landlordTenantRoutes.test.js`
- Result: 4 suites passed

## Bottom line

This authentication and authorization stack is not production-ready.

The login and registration entry points are not the main failure point. The larger risk is authorization integrity after authentication. The codebase currently allows high-impact state changes based on weak caller binding, caller-supplied authority identifiers, transferable invite tokens, and inconsistent permission models across legacy and new business identity systems.

Current state by dimension:
- Authentication correctness: fair
- Authorization correctness: weak
- Session hardening: weak
- Architecture consistency: weak
- Test protection against regressions: weak
- Operational readiness: low

Release readiness:
- Status: blocked
- Confidence to release safely: low
- Minimum work before release: close the blocking issues below, consolidate business authorization paths, harden token/session handling, and add exploit-oriented integration tests

## Threat model summary

The most realistic bad outcomes in the current state are:
- one logged-in user modifying another household's lease state
- a lower-privilege operator escalating inside a home or business
- leaked or forwarded invite links granting unintended access
- business access behaving differently depending on whether a route uses legacy team logic or seat-based logic
- XSS turning into full account takeover because web tokens are stored in `localStorage`
- production incidents that tests will not catch because the most sensitive paths are mocked or wired to nonexistent tables

## Blocking issues

### P0-1 Any authenticated user can end another user's active lease

Impact:
- Any logged-in user who learns a `leaseId` can terminate an active lease they do not own and do not control.
- The operation also detaches occupancy records, which means the blast radius includes loss of home access, downstream permission changes, and tenant disruption.

Evidence:
- `POST /api/v1/landlord/lease/:leaseId/end` in `backend/routes/landlordTenant.js` requires `verifyToken` but does not require `requireAuthority`.
- `landlordAuthorityService.endLease()` in `backend/services/addressValidation/landlordAuthorityService.js` accepts `initiatedBy` only for audit and detach metadata. It never verifies that the initiator owns the lease, is the primary resident, or holds verified authority for the home.

Why this blocks release:
- This is a direct authorization bypass on a destructive action.
- The exploit path is simple and does not require admin access.

Required fix:
- Enforce authorization before state change.
- `endLease()` must resolve the lease, then verify one of:
  - the caller is the primary resident ending their own lease, or
  - the caller holds verified `HomeAuthority` for the same `home_id`, or
  - the caller is a business actor whose active seat is mapped to a business that holds verified authority.
- Reject any caller-supplied authority context for this route. Resolve authority server-side from `req.user`.
- Add integration tests for:
  - unrelated user cannot end lease
  - resident can end own lease if policy allows
  - verified landlord can end lease
  - business-authorized landlord can end lease

### P0-2 Lease approve and deny flows trust caller-supplied `authority_id`

Impact:
- A user can approve or deny a pending lease request if they know a valid `authority_id` for the same home.
- This is an insecure direct object reference problem on a high-impact authorization boundary.

Evidence:
- `POST /api/v1/landlord/lease/:leaseId/approve` and `POST /api/v1/landlord/lease/:leaseId/deny` in `backend/routes/landlordTenant.js` both accept `authority_id` from the request body.
- `landlordAuthorityService.approveTenantRequest()` and `denyTenantRequest()` only verify that the authority exists, is `verified`, and belongs to the same home as the lease.
- The service never verifies that the authenticated caller is actually the authority subject or is bound to the business subject behind that authority.

Why this blocks release:
- Approval and denial are control-plane actions for household membership.
- A leaked identifier is enough to impersonate property authority.

Required fix:
- Remove `authority_id` from the public API contract for approve and deny.
- Resolve the acting authority inside the route or service from `req.user`.
- Centralize a helper such as `resolveVerifiedAuthorityForActor({ userId, homeId })`.
- If multiple authorities exist for the same actor and home, resolve deterministically server-side or require an actor-owned authority selection that is validated against `req.user`.
- Add tests for:
  - caller cannot approve or deny with another actor's authority id
  - caller with valid direct authority can approve or deny
  - caller with business-backed authority can approve or deny only if bound to that business

### P0-3 Home and business IAM routes allow privilege escalation through missing rank checks

Impact:
- A manager or admin with `members.manage` or `team.manage` can modify peers or superiors in routes that do not compare actor rank versus target rank.
- A non-owner can demote a higher-privilege member and then remove them.

Evidence:
- `backend/routes/homeIam.js` protects role and permission mutation by `members.manage` but does not verify actor rank against target rank before role changes or removals.
- `backend/routes/businessIam.js` protects role and permission mutation by `team.manage` but likewise does not enforce target-rank limits.
- `backend/routes/businessSeats.js` already contains stronger rank checks in the seat-based patch route, which confirms the intended policy exists elsewhere but is not consistently applied.

Why this blocks release:
- This breaks one of the core invariants of production IAM: a lower-rank actor must not be able to mutate equal or higher-rank principals.
- It enables hostile takeovers inside shared homes and business accounts.

Required fix:
- Define one canonical rank enforcement utility and use it in:
  - home role changes
  - home member removal
  - business role changes
  - business member removal
  - permission override writes
- Recommended rule set:
  - only owner can create or transfer owner
  - non-owner cannot modify equal or higher rank
  - non-owner cannot grant a role equal to or above their own
  - self-demotion of sole owner is forbidden
- Prefer migrating all business member mutation to the seat-based model and make legacy routes thin compatibility wrappers.
- Add exploit tests for admin-vs-owner, admin-vs-admin, manager-vs-admin, and self-modification cases.

### P0-4 Invite acceptance is not bound to the invited identity and business invites do not expire

Impact:
- Any authenticated user who obtains a valid invite token can accept it.
- Forwarded, leaked, intercepted, or reused links act as bearer credentials.
- Business invites can remain valid indefinitely because the schema has no invite expiry field.

Evidence:
- `backend/routes/businessSeats.js` accepts invite tokens in `POST /seats/accept-invite` and binds the seat to `req.user.id`, but does not verify that `req.user.email` matches `invite_email`.
- `supabase/migrations/20260301000001_identity_firewall_tables.sql` defines `BusinessSeat` with `invite_email`, `invite_token_hash`, and `invite_status` but no expiry timestamp.
- `landlordAuthorityService.acceptInvite()` in `backend/services/addressValidation/landlordAuthorityService.js` validates the home invite token state and expiry, but does not verify that the accepting user matches the invited email identity.

Why this blocks release:
- Invitation links are acting as long-lived shared secrets instead of identity-bound invitations.
- This is a common real-world access-control failure mode.

Required fix:
- Bind invite acceptance to identity:
  - compare normalized `req.user.email` to invited email where invite-email semantics are expected
  - if account does not exist yet, drive an email-first invitation flow that preserves the intended recipient
- Add `expires_at` for `BusinessSeat` invites and enforce it on preview, accept, and decline.
- Rotate and invalidate tokens aggressively on resend.
- Log invite acceptance with actor email and user id for audit.
- Add tests for:
  - wrong-email user cannot accept
  - expired invite cannot be previewed or accepted
  - accepted or declined invite cannot be replayed

## Major architecture and security gaps

### P1-1 Business-backed authority still relies on a table that does not exist in the current schema

Impact:
- Legitimate business actors can be denied access even when they should have authority.
- Tests can pass against a fake model while production fails against the real schema.

Evidence:
- `backend/middleware/requireAuthority.js` falls back to `BusinessMember`.
- `backend/routes/landlordTenant.js` also queries `BusinessMember` in landlord authority paths.
- `backend/database/schema.sql` does not define `BusinessMember`.
- The current schema direction is `BusinessTeam` plus `BusinessSeat` and `SeatBinding`.
- Unit tests seed `BusinessMember`, which masks the mismatch.

Why this matters:
- This is not only a bug. It means the authorization model cannot be reasoned about reliably because code, schema, and tests disagree.

Required fix:
- Remove all `BusinessMember` references from production code and tests.
- Decide on one canonical business-actor resolution path:
  - short-term: `BusinessTeam`
  - target state: `BusinessSeat` plus `SeatBinding`
- Add schema-aware integration tests that run against the real tables used in production.

### P1-2 Business authorization is split across legacy team IAM and new seat-based IAM

Impact:
- Access outcomes depend on which route family a user happens to hit.
- Users added through legacy team flows may not gain access to seat-gated features.
- Operators and support will see inconsistent membership state between tables.

Evidence:
- `businessIam.js` mutates `BusinessTeam`.
- Seat-gated access resolves from `BusinessSeat` and `SeatBinding` in `backend/utils/seatPermissions.js`.
- Some seat routes attempt dual-write back into `BusinessTeam`, but legacy team routes do not create or bind seats.

Why this matters:
- Split-brain authorization models are a major source of production incidents.
- Permission bugs become difficult to reproduce because state can drift by table.

Required fix:
- Pick a canonical business IAM model and route all writes through it.
- Recommended target: `BusinessSeat` plus `SeatBinding`.
- During migration:
  - create a single write service
  - dual-write from that service only
  - backfill missing seats for current `BusinessTeam` rows
  - add drift detection jobs comparing `BusinessTeam` and `BusinessSeat`
- Remove direct mutation of `BusinessTeam` from public routes after cutover.

### P1-3 Route mount order causes seat discovery endpoints to be shadowed

Impact:
- Static seat routes such as `/api/businesses/my-seats` can be captured by `/:businessId` handlers earlier in the router stack.
- Users can receive confusing 404 or authorization behavior for valid seat endpoints.

Evidence:
- `backend/app.js` mounts `businessRoutes` before `businessSeatRoutes`.
- `backend/routes/businesses.js` exposes a generic `GET /:businessId`.
- `backend/routes/businessSeats.js` defines `GET /my-seats`.

Why this matters:
- This makes core IAM endpoints partly unreachable depending on route order.
- It also signals insufficient contract tests around static-versus-param route precedence.

Required fix:
- Mount specialized seat routes before generic `/:businessId` routes, or namespace seat routes under `/api/business-seats`.
- Add a route regression test that explicitly verifies `/api/businesses/my-seats` resolves to the seat handler.

### P1-4 Web token storage plus unsafe HTML rendering creates account-takeover risk

Impact:
- Any XSS in web surfaces can extract access and refresh tokens and take over accounts.
- Mailbox-style rich content is a particularly high-risk surface because HTML is rendered directly.

Evidence:
- `frontend/packages/api/src/client.ts` stores access and refresh tokens in `localStorage`.
- `frontend/apps/web/src/components/mailbox/MailItemDetail.tsx` renders HTML with `dangerouslySetInnerHTML` for text and rich content blocks.

Why this matters:
- `localStorage` is readable by injected JavaScript.
- Even if the mailbox content source is currently intended to be trusted, this is not a safe production assumption.

Required fix:
- Move web session handling to `httpOnly`, `secure`, `sameSite` cookies.
- Remove long-lived refresh tokens from browser JavaScript storage.
- Sanitize all rendered HTML using a vetted allowlist sanitizer before rendering, or eliminate raw HTML rendering entirely.
- Add CSP, Trusted Types if feasible, and security tests for stored HTML rendering paths.

### P1-5 Token verification adds avoidable latency and remote dependency per request

Impact:
- Every authenticated request performs:
  - Supabase token introspection
  - a second database lookup for role resolution
- This increases p50 and p95 latency and widens the blast radius of transient auth-provider latency.

Evidence:
- `backend/middleware/verifyToken.js` calls `supabase.auth.getUser(token)`.
- It then calls `supabaseAdmin.from('User').select('role')` for the same request.

Why this matters:
- This is not a correctness bug by itself, but it will cause measurable delay and scaling cost.
- Auth middleware sits on the hot path of the entire API.

Required fix:
- Decide whether platform role should live in signed claims or in a low-latency cache.
- Short-term:
  - keep token verification with Supabase
  - cache role resolution by user id for a short TTL
- Medium-term:
  - shift role to claims or a dedicated authz cache
  - separate platform-admin checks from ordinary authenticated requests

### P1-6 Email confirmation may be disabled outside local development

Impact:
- If the checked-in Supabase config is used in a shared or production-like environment, accounts may be able to authenticate without email confirmation.

Evidence:
- `supabase/config.toml` includes `enable_confirmations = false`.

Why this matters:
- This weakens identity assurance for signup and invite flows.
- It also increases the risk of burner-account abuse.

Required fix:
- Ensure dev-only config cannot leak into production configuration.
- Make environment-specific confirmation policy explicit in deployment docs and CI checks.

### P1-7 Mobile logout appears to call an endpoint that is not implemented in the backend

Impact:
- Mobile logout may clear local state without invalidating the backend session.
- That creates inconsistent expectations about session revocation.

Evidence:
- `frontend/packages/api/src/endpoints/auth.ts` posts to `/api/users/logout`.
- `frontend/apps/mobile/src/contexts/AuthContext.tsx` swallows logout errors and clears local state.
- A route match for `/logout` was not found in `backend/routes/users.js` during review.

Why this matters:
- This is weaker than the authorization bugs above, but it is an operational session-management gap.

Required fix:
- Either implement a real logout/revocation endpoint or stop implying that server-side logout exists.
- Align web and mobile session semantics.

## Test coverage gaps

What passed:
- register route tests
- OAuth route tests
- `requireAuthority` tests
- landlord/tenant route unit tests

What is missing or misleading:
- `backend/tests/unit/landlordTenantRoutes.test.js` mocks `verifyToken`
- the same test suite mocks `requireAuthority`
- the same suite seeds `BusinessMember`, which is not part of the current schema
- there is no strong integration coverage for:
  - lease approve and deny authorization binding
  - lease end authorization
  - home IAM rank enforcement
  - business IAM rank enforcement
  - business seat invite identity binding
  - route precedence for `/my-seats`
  - XSS-sensitive mailbox rendering paths

Why this matters:
- The current tests mostly prove handler happy paths under mocked auth assumptions.
- They do not prove that the real authz invariants hold in the live stack.

## Root causes

The failures are not random. They come from a few systemic patterns:

1. Caller identity is authenticated, but actor authority is not consistently resolved server-side.
2. Sensitive state transitions trust user-supplied identifiers instead of resolving ownership from `req.user`.
3. Authorization policy is duplicated across legacy and new models instead of centralized.
4. The business identity migration is incomplete, so routes, middleware, schema, and tests disagree.
5. Security hardening for the web session model was deferred while risky rendering patterns already exist.
6. Tests validate mocked route behavior more than real enforcement boundaries.

## Production hardening plan

### Phase 0: Immediate containment (same day to 2 days)

Goals:
- reduce the easiest exploit paths immediately
- stop further authz drift while fixes are in progress

Actions:
- Disable or temporarily gate these endpoints behind an internal admin flag if immediate patching is not possible:
  - lease approve
  - lease deny
  - lease end
  - home role mutation
  - business role mutation
- Remove `authority_id` from client payload usage immediately, even before backend cleanup.
- Announce a temporary freeze on adding new authz-dependent routes until the shared policy helpers are in place.
- Add structured audit logging around all membership and role changes if not already present.

### Phase 1: Close the critical authorization bugs (2 to 4 days)

Goals:
- make destructive and membership-changing actions actor-bound
- enforce role hierarchy

Work items:
- Implement `resolveVerifiedAuthorityForActor(userId, homeId)` and use it in:
  - invite tenant
  - approve tenant request
  - deny tenant request
  - end lease
- Add explicit policy checks for lease actions:
  - `canApproveLease(actor, lease)`
  - `canDenyLease(actor, lease)`
  - `canEndLease(actor, lease)`
- Add shared rank enforcement helpers for home and business IAM.
- Reject attempts to mutate equal or higher-rank users unless owner policy explicitly allows it.
- Remove trust in caller-supplied authority identifiers for all public APIs.

Exit criteria:
- unrelated authenticated users cannot change lease state
- non-owner admins cannot demote or remove owners or peers above policy
- integration tests cover the exploit paths that originally existed

### Phase 2: Consolidate business authorization architecture (3 to 5 days)

Goals:
- eliminate split-brain business identity state
- align runtime code with the real schema

Work items:
- Replace all `BusinessMember` references with the chosen real model.
- Decide canonical business actor representation:
  - recommended: `BusinessSeat` plus `SeatBinding`
- Implement one write service for all business membership changes.
- Backfill seats for legacy `BusinessTeam` rows and create missing bindings where appropriate.
- Fix route order so static seat endpoints are reachable.
- Add drift detection and migration metrics:
  - members with team row but no seat
  - seats with no team compatibility row during transition
  - bindings with inactive or mismatched seats

Exit criteria:
- one business authorization model is authoritative
- all routes resolve access through the same actor representation
- seat discovery and seat mutation routes are reachable and tested

### Phase 3: Harden invitations and session handling (3 to 5 days)

Goals:
- stop bearer-link access leaks
- reduce account takeover risk from browser compromise

Work items:
- Bind invite acceptance to invited email identity.
- Add `expires_at` to `BusinessSeat` invites.
- Sanitize or remove raw HTML rendering in mailbox detail views.
- Move web auth tokens out of `localStorage` and into secure cookies.
- Align logout semantics across web and mobile.
- Enforce environment-specific email confirmation policy.

Exit criteria:
- forwarded invite links do not grant access to the wrong user
- browser JavaScript cannot read long-lived session credentials
- mailbox rendering no longer accepts unsanitized HTML

### Phase 4: Test, observe, and prepare for production (3 to 5 days)

Goals:
- make future regressions visible before release
- make auth incidents diagnosable in production

Work items:
- Add integration tests for every exploit class listed in this document.
- Add route precedence tests for static versus param collisions.
- Add security tests for invite replay, role escalation, and lease state tampering.
- Instrument metrics and alerts:
  - lease state changes by actor type
  - role changes and removals by actor role
  - invite acceptances by mismatched email attempt
  - authorization failure rate by endpoint
  - token verification latency
- Write runbooks:
  - emergency revoke for invite tokens
  - emergency disable for dangerous endpoints
  - authorization incident triage

Exit criteria:
- exploit-oriented test suite passes in CI
- dashboards and alerts exist for sensitive auth events
- rollback and emergency-disable procedures are documented

## Recommended release gate

Do not call this auth/authz stack production-ready until all of the following are true:
- lease approve, deny, and end actions are actor-bound and fully tested
- home and business IAM mutations enforce hierarchy rules
- business authorization no longer depends on `BusinessMember`
- seat routes are reachable and business membership writes are centralized
- invite acceptance is identity-bound and expiring
- web sessions no longer depend on `localStorage` for long-lived credentials
- mailbox HTML rendering is sanitized or eliminated
- CI includes real exploit-regression coverage, not only mocked route tests

## Suggested ownership split

Backend:
- landlord and home authority fixes
- business IAM consolidation
- invite expiry and identity binding
- auth middleware performance and logging

Frontend:
- cookie-based session migration
- removal or sanitization of unsafe HTML rendering
- client contract changes to stop sending authority ids
- logout semantic alignment

Infra and DevOps:
- environment-specific Supabase confirmation policy
- secret and config separation
- observability and alerting

QA and Security:
- exploit-driven test cases
- regression validation for invite flows, lease flows, and role mutation flows
- XSS validation on mailbox-rich content

## Rough distance to production readiness

Assuming one strong engineer focused primarily on backend authz and one part-time frontend/supporting engineer:
- critical authz fixes: a few days
- business IAM consolidation and migration cleanup: about a week
- session hardening and frontend cleanup: several more days
- integration coverage, observability, and final QA: several more days

Rough estimate: about 2 to 3 weeks of focused work to reach a defensible production baseline.

That estimate assumes no major hidden schema drift beyond what was already found. If more legacy-versus-seat inconsistencies appear during migration, the schedule will stretch.
