# API Contracts And Shared Package Boundaries

This document is an interview-ready explanation of how API types, request and
response contracts, validation schemas, shared packages, database schema
alignment, and monorepo package boundaries work in this repository.

The short version: Pantopus currently uses a pragmatic, layered contract model.
The backend owns runtime behavior. `@pantopus/api` owns the frontend-facing API
client surface. `@pantopus/types` owns shared domain/entity types and constants.
Those contracts are mostly handwritten and defended by tests, smoke checks, and
package boundaries rather than generated from a single OpenAPI/tRPC source.

## Repository Context

Pantopus is a pnpm/Turborepo monorepo with these main areas:

- `backend/`: Express 5, Supabase/Postgres, Socket.IO, backend services,
  serializers, route validation, jobs, migrations, and tests.
- `frontend/apps/web/`: Next.js web app.
- `frontend/apps/mobile/`: Expo/React Native app.
- `frontend/packages/api/`: shared API client for web and mobile.
- `frontend/packages/types/`: shared TypeScript domain and DTO-adjacent types.
- `frontend/packages/utils/`: shared platform-neutral helpers.
- `frontend/packages/ui-utils/`: shared presentation helpers and UI contracts.
- `frontend/packages/theme/`: shared design tokens.

Relevant files:

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `backend/app.js`
- `backend/middleware/validate.js`
- `backend/database/migrations/`
- `backend/database/schema.sql`
- `frontend/packages/api/src/index.ts`
- `frontend/packages/types/src/index.ts`
- `frontend/packages/ui-utils/src/marketplace-contract.ts`

## 1. Which Package Owns API Types: Backend, `@pantopus/api`, Or `@pantopus/types`?

The clean answer is that ownership is layered:

| Layer | Owns | Why |
| --- | --- | --- |
| Backend | Runtime contract | It is the executable source of truth: routes, authz, serializers, validation, database reads/writes, and response JSON. |
| `@pantopus/api` | Frontend API client contract | It owns endpoint functions, request parameter shapes, return types, auth/client utilities, compatibility wrappers, and route string centralization for web/mobile. |
| `@pantopus/types` | Shared domain and entity vocabulary | It owns portable types and constants used by both web and mobile, such as `Gig`, `Listing`, `Home`, identity types, wallet types, category constants, and common response helper types. |

So if an interviewer asks "who owns API types?", the best answer is:

> The backend owns the real runtime contract. `@pantopus/api` owns the client
> contract exposed to web and mobile. `@pantopus/types` owns shared domain
> vocabulary. We intentionally avoid making backend route internals or database
> rows the public client surface directly.

That distinction matters because a database row, an internal backend model, and
a public API response are not always the same thing. For example, identity and
privacy surfaces deliberately serialize public identity shapes instead of
returning raw `User` rows. In that case the backend serializer owns the privacy
contract, while `@pantopus/types` can describe the safe frontend shape.

### Practical Examples

`@pantopus/types` owns domain types:

- `frontend/packages/types/src/gig.ts`
- `frontend/packages/types/src/listing.ts`
- `frontend/packages/types/src/home.ts`
- `frontend/packages/types/src/identity.ts`
- `frontend/packages/types/src/wallet.ts`
- `frontend/packages/types/src/categories.ts`

`@pantopus/api` owns endpoint client functions:

- `frontend/packages/api/src/endpoints/gigs.ts`
- `frontend/packages/api/src/endpoints/listings.ts`
- `frontend/packages/api/src/endpoints/homes.ts`
- `frontend/packages/api/src/endpoints/chat.ts`
- `frontend/packages/api/src/endpoints/payments.ts`
- `frontend/packages/api/src/endpoints/addressValidation.ts`

The backend owns runtime routes and response assembly:

- `backend/routes/gigs.js`
- `backend/routes/listings.js`
- `backend/routes/home.js`
- `backend/routes/chats.js`
- `backend/routes/addressValidation.js`
- `backend/serializers/identitySerializers.js`

## 2. Are Request/Response Schemas Generated Or Manually Duplicated?

They are currently manual.

There is no repo-wide OpenAPI, tRPC, ts-rest, GraphQL codegen, Prisma typegen, or
Supabase-generated TypeScript contract driving both sides. Instead:

- Backend request schemas are mostly Joi objects written next to routes.
- Backend AI structured-output schemas use JSON Schema with Ajv.
- Frontend API endpoint types are handwritten in `@pantopus/api`.
- Shared domain types are handwritten in `@pantopus/types`.
- Some constants are duplicated across backend and frontend with explicit parity
  tests.

### Backend Request Validation

The canonical runtime validation path is:

- Route defines a Joi schema.
- Route applies `validate(schema)` middleware.
- `backend/middleware/validate.js` validates `req.body` with:
  - `abortEarly: false`
  - `allowUnknown: false`
  - `stripUnknown: true`
- On error, backend returns a normalized 400 response.

Example schema locations:

- `backend/routes/addressValidation.js`
- `backend/routes/chats.js`
- `backend/routes/home.js`
- `backend/routes/mailbox.js`
- `backend/routes/personas.js`
- `backend/routes/professional.js`

### Backend JSON Schema/Ajv Usage

AI structured outputs are validated in:

- `backend/services/ai/schemas.js`

Those schemas are used for OpenAI structured output and server-side validation
before returning AI-generated drafts to clients.

### Frontend Request/Response Types

Endpoint client functions in `@pantopus/api` typically type their `get`, `post`,
`put`, `patch`, or `del` calls manually. For example:

```ts
export async function getGigs(...): Promise<{ gigs: GigWithDetails[]; ... }> {
  const response = await get<{ gigs: GigWithDetails[]; ... }>('/api/gigs', ...);
  ...
}
```

Some endpoint files import shared domain types from `@pantopus/types`; others
define endpoint-specific DTOs locally.

### Why Manual Duplication Exists

This codebase has evolved quickly across several product domains: homes,
identity, mailbox, gigs, marketplace, payments, support trains, and AI. A
handwritten API package gave the team velocity and a stable import surface for
web/mobile before a formal IDL existed.

The tradeoff is that manual duplication requires explicit drift controls. The
repo has those in some critical areas, but it is not as mechanically strong as a
generated end-to-end contract.

## 3. How Do We Prevent Backend/Frontend Contract Drift?

Pantopus prevents drift with a combination of package boundaries, central API
client usage, runtime validators, backend contract tests, schema smoke checks,
and CI gates.

There is no single magic mechanism. The strategy is defense in depth.

### 3.1 Central API Client

Web and mobile depend on `@pantopus/api` rather than scattering raw route strings
everywhere.

`frontend/packages/api/src/index.ts` exports:

- configured Axios client utilities
- auth helpers
- endpoint namespaces
- endpoint convenience functions
- selected endpoint types

That package is the frontend-facing API facade. When an endpoint changes, client
callers should update through that package instead of duplicating HTTP calls in
each app.

### 3.2 Shared Domain Types

Web and mobile import shared domain types from `@pantopus/types`, reducing drift
between frontend applications.

For example:

- `GigListItem`
- `ListingDetail`
- `HomeOwnershipClaim`
- `IdentityCenterPayload`
- `Wallet`
- `BroadcastMessage`

This does not prove the backend still returns the exact shape, but it prevents
web and mobile from inventing different local interpretations.

### 3.3 Backend Runtime Validation

Joi validation prevents clients from sending invalid or stale request shapes.
The `validate` middleware also strips unknown fields, which reduces accidental
server behavior caused by old or experimental frontend payloads.

This protects inbound contracts. Outbound response contracts still need tests and
serializers.

### 3.4 Backend Serializers

For privacy-sensitive domains, backend serializers are treated as contract
boundaries. Identity is the clearest example.

Relevant file:

- `backend/serializers/identitySerializers.js`

The serializers prevent raw private fields from leaking into public responses.
That is not just type hygiene; it is a product/security invariant.

### 3.5 Contract And Privacy Tests

The repo has strong privacy and response-shape tests for identity/firewall
surfaces.

Examples:

- `backend/tests/unit/privacy/serializerForbiddenKeys.test.js`
- `backend/tests/unit/identitySerializers.test.js`
- `backend/tests/unit/rawUserIdentityResponses.test.js`
- `backend/tests/unit/feedIdentityAuthors.test.js`
- `backend/scripts/ci/run-privacy-gates.js`

These tests are important because TypeScript cannot catch "we accidentally
returned `email` in a nested JSON response from a Node backend."

### 3.6 Schema Validation Tests

`backend/tests/integration/schema-validation.test.js` queries selected columns
against the database to ensure backend column selections are still valid.

This catches bugs like:

- column renamed in DB but backend still selects old column
- backend expecting `is_current` while schema has `is_active`
- stale selected fields in list/detail queries

### 3.7 Migration Smoke Checks

`backend/scripts/identity-firewall-migration-smoke.js` checks required tables,
columns, enum values, RLS state, safe views, and migration invariants for the
Identity Firewall work.

This is operational drift protection: it verifies a live migrated database
matches what the application expects.

### 3.8 Constant Parity Tests

Marketplace has explicit frontend/backend enum parity tests:

- frontend contract: `frontend/packages/ui-utils/src/marketplace-contract.ts`
- backend constants: `backend/constants/marketplace.js`
- test: `backend/tests/unit/marketplaceContractParity.test.js`

That test compares categories, conditions, listing layers, listing types,
location precisions, reveal policies, and visibility scopes.

This is a good example of a targeted guardrail where full codegen does not yet
exist.

### 3.9 CI

CI runs backend tests, privacy gates, selected web tests, Playwright identity
tests, mobile tests, and type checks.

One caveat: the web type-check step is currently marked `continue-on-error`.
That means type checking is still useful for visibility, but not yet a hard
global contract gate.

## 4. Why Are Some Endpoint Methods Deprecated But Still Present In The API Package?

Deprecated API methods remain because `@pantopus/api` is a compatibility facade
for multiple clients and multiple rollout stages.

Removing an export is a breaking change for web, mobile, tests, or old screens.
Deprecating lets the codebase move callers to a canonical endpoint without
breaking everything in the same PR.

Examples:

- `frontend/packages/api/src/endpoints/payments.ts`
  - `getBalance()` is deprecated in favor of `wallet.getWallet()`.
  - `requestPayout()` is deprecated in favor of `wallet.withdraw()`.
- `frontend/packages/api/src/endpoints/chat.ts`
  - several room-management/search/archive methods are marked deprecated because
    no server-side route exists.
- `frontend/packages/api/src/endpoints/posts.ts`
  - older map marker aliases are deprecated in favor of canonical methods.

The rule is:

> Deprecated means "do not add new usage." It does not always mean "delete this
> now."

Keeping deprecated methods is especially useful in a monorepo with web and
mobile because both clients may not migrate at the same pace. The API package
absorbs transition cost and keeps the import surface stable.

The better long-term process is:

1. Mark deprecated with a replacement.
2. Move all call sites.
3. Add a lint or grep guard if the method must not be used again.
4. Remove after the supported clients no longer need it.

## 5. Where Do Validation Schemas Live, And Are They Shared?

Most validation schemas live in the backend and are not shared with frontend.

### Backend Route Schemas

Common pattern:

```js
const Joi = require('joi');

const createThingSchema = Joi.object({
  ...
});

router.post('/thing', verifyToken, validate(createThingSchema), async (req, res) => {
  ...
});
```

This pattern appears across routes such as:

- `backend/routes/users.js`
- `backend/routes/home.js`
- `backend/routes/gigs.js`
- `backend/routes/chats.js`
- `backend/routes/mailbox.js`
- `backend/routes/addressValidation.js`
- `backend/routes/personas.js`

### Backend Shared Validation Helpers

Some backend validation schemas are factored out when multiple routes need them:

- `backend/utils/moduleSchemas.js`

This includes JSONB module validation for task/gig detail sections:

- `careDetailsSchema`
- `logisticsDetailsSchema`
- `remoteDetailsSchema`
- `urgentDetailsSchema`
- `eventDetailsSchema`

### AI Structured Output Schemas

AI draft schemas live in:

- `backend/services/ai/schemas.js`

These are JSON Schemas compiled with Ajv.

### Frontend Validation

Frontend validation is usually local UI validation or shared UI helper logic.
It is not the authoritative request validator.

There are some mirrored shapes in shared packages. For example,
`frontend/packages/types/src/mailCompose.ts` has `ComputedBackendPayload`, which
explicitly says it mirrors backend Joi and the API package payload type.

That is useful documentation and type safety for clients, but it is not
mechanically shared with backend runtime validation.

### Should Validation Schemas Be Shared?

Some could be shared, but not all should be.

Good candidates for sharing:

- pure enum lists
- request DTO schemas with no secrets or server-only policy
- client-side form validation derived from the same public contract
- safe public response schemas

Bad candidates for sharing:

- authorization rules
- privileged backend checks
- service-role database logic
- Stripe/Twilio/OpenAI payload internals
- private identity/privacy policy details that clients should not control

The ideal future direction is to define public request/response schemas once
using a type-safe runtime schema library or OpenAPI generation, then generate
client types and validators where appropriate.

## 6. How Are Shared Packages Versioned Inside The Monorepo?

Shared packages are private workspace packages with version `0.0.0`.

Examples:

- `frontend/packages/api/package.json`
- `frontend/packages/types/package.json`
- `frontend/packages/utils/package.json`
- `frontend/packages/ui-utils/package.json`
- `frontend/packages/theme/package.json`

Apps consume them using pnpm workspace protocol:

- `workspace:*`
- `workspace:^`

The repo-level package manager is pnpm, and workspace membership is declared in:

- `pnpm-workspace.yaml`
- root `package.json`

### What "Versioning" Means Here

Inside this private monorepo, the real version boundary is the git commit/PR,
not semver. Web, mobile, and shared packages are developed atomically in the same
repository.

So when `@pantopus/types` changes, web and mobile get that change in the same
workspace install. There is no published package resolution problem.

### Why `0.0.0` Is Acceptable Here

Because these packages are private and not published independently, semver is
not carrying compatibility information. The lockfile and git SHA carry the
actual version.

If these packages become externally published or consumed by separately deployed
repos, I would introduce:

- Changesets
- real semver versions
- generated changelogs
- package-level compatibility rules
- explicit deprecation/removal windows
- contract tests run against released artifacts

## 7. What Code Should Never Enter Shared Packages?

Shared packages should stay portable, deterministic, and safe to run in both web
and mobile contexts. They should not become a dumping ground for backend or
application internals.

### Never Put These In Shared Packages

- Supabase service-role clients
- raw SQL execution
- database migrations
- Express route handlers
- backend middleware
- cron/job code
- filesystem access
- server-only environment secrets
- Stripe secret-key logic
- Twilio secret-key logic
- OpenAI server credentials
- S3 signing credentials
- authorization decisions
- privileged privacy policy enforcement
- direct imports from `backend/`
- direct imports from `frontend/apps/web`
- direct imports from `frontend/apps/mobile`
- app-specific screen/component state
- Node-only code unless the package explicitly targets Node
- browser-only globals without platform guards

### What Belongs In `@pantopus/types`

- shared domain types
- DTO-adjacent public types
- shared enum unions
- public constants that describe product vocabulary
- simple type-only relationships between domains

It should avoid runtime dependencies and platform assumptions.

### What Belongs In `@pantopus/api`

- API client configuration
- auth token handling
- endpoint functions
- endpoint parameter and response types
- response normalization that is purely client-facing
- backward-compatible wrappers during migrations

It should not contain backend policy logic or database access.

### What Belongs In `@pantopus/utils`

- platform-neutral utility functions
- URL builders
- generic validation helpers
- formatting helpers
- safe constants

It should not contain UI-specific rendering decisions when those belong in
`@pantopus/ui-utils`.

### What Belongs In `@pantopus/ui-utils`

- shared UI formatting
- status labels and styles
- marketplace UI constants
- post type presentation config
- client-side form helpers
- platform-neutral presentation logic

It should not depend on React DOM or React Native components unless intentionally
split by platform.

### What Belongs In `@pantopus/theme`

- colors
- spacing
- typography
- radii
- shadows
- Tailwind config bridge
- CSS variable generation

It should not contain product data or API concepts.

## 8. How Do We Manage Circular Dependencies Between Product Domains?

The package graph is intentionally one-way:

```text
apps
  -> @pantopus/api
  -> @pantopus/ui-utils
  -> @pantopus/utils
  -> @pantopus/theme
  -> @pantopus/types

@pantopus/api -> @pantopus/types, @pantopus/utils
@pantopus/ui-utils -> @pantopus/types
@pantopus/utils -> @pantopus/types
@pantopus/types -> no local package dependencies
```

The important rule is:

> Shared primitive types go downward. Domain orchestration stays upward.

### Product Domain Cycle Example

Suppose marketplace listings can create gigs, gigs can reference posts, and
posts can reference listings. That can easily produce cycles like:

- listing imports gig
- gig imports post
- post imports listing

The correct approach is not to make every domain import every other domain.
Instead:

1. Put shared identifiers or small unions in `@pantopus/types`.
2. Keep aggregate response DTOs in the API endpoint package that returns them.
3. Put orchestration in backend service/route layers.
4. Use serializers to build public response shapes at the boundary.
5. Keep UI composition in app code or UI helpers, not in base domain types.

### Backend Domain Cycles

Backend cycles are managed by separating:

- routes: HTTP boundary
- services: business logic
- serializers: output contracts
- utils: pure helper logic
- middleware: auth/validation/request concerns
- jobs: async/cron behavior

When two services start importing each other, the better move is usually to
extract the shared policy into a third module or move orchestration up to the
route/job layer.

### TypeScript Type Cycles

For shared TypeScript packages:

- prefer `import type` for type-only dependencies
- avoid re-exporting huge cross-domain barrels unless the barrel is the public
  API surface
- define small shared references like `{ id: string }` or specific summary
  types instead of importing full detail shapes across domains
- avoid putting endpoint-specific response wrappers into base entity files

## 9. What Is The Public API Surface Of Each Package?

### Backend: `pantopus-backend`

The backend is not a shared TypeScript package. Its public surface is runtime:

- REST routes mounted in `backend/app.js`
- Socket.IO chat events in `backend/socket/chatSocketio.js`
- operational scripts and jobs

Main REST route areas include:

- `/api/users`
- `/api/gigs`
- `/api/homes`
- `/api/posts`
- `/api/chat`
- `/api/payments`
- `/api/wallet`
- `/api/listings`
- `/api/mailbox`
- `/api/businesses`
- `/api/privacy`
- `/api/personas`
- `/api/identity-center`
- `/api/identity`
- `/api/broadcast`
- `/api/v1/address`
- `/api/v1/landlord`
- `/api/v1/tenant`
- `/api/ai`
- `/api/activities/support-trains`

Backend internal modules are not public package APIs. A route can be public even
if the service implementation behind it is private.

### `@pantopus/api`

Package manifest:

- `frontend/packages/api/package.json`

Public exports:

- `.`
- `./src/endpoints/*`

The root export includes:

- `apiClient`
- auth/session helpers
- token storage configuration
- HTTP helpers: `get`, `post`, `put`, `del`, `uploadFile`, `apiRequest`
- endpoint namespaces like `auth`, `users`, `gigs`, `homes`, `chat`, `listings`
- convenience endpoint functions like `login`, `getGigs`, `getHomes`
- selected endpoint-specific response/request types
- re-exported shared types from `@pantopus/types`

The package is intentionally the frontend API facade.

### `@pantopus/types`

Package manifest:

- `frontend/packages/types/package.json`

Public exports:

- `.`
- `./post`
- `./notification`
- `./home`
- `./wallet`
- `./business`
- `./identity`
- `./relationship`
- `./mailCompose`

It exports:

- shared entity/domain interfaces
- enum unions
- product constants such as gig categories
- AI draft types
- identity/firewall public types
- mailbox compose types
- wallet/payment-facing types

### `@pantopus/utils`

Package manifest:

- `frontend/packages/utils/package.json`

Public export:

- `.`

It exports:

- app constants
- API and websocket base URL constants
- public/deep-link URL builders
- date/time helpers
- currency helpers
- string helpers
- validation helpers
- distance helpers
- file helpers
- local storage helpers
- error helpers
- Attom display helpers
- US state constants

### `@pantopus/ui-utils`

Package manifest:

- `frontend/packages/ui-utils/package.json`

Public export:

- `.`

It exports:

- UI time/text/price/distance formatters
- status styles
- post type configs
- filter helpers
- marketplace constants
- canonical marketplace enum contract
- search/mailbox/wallet UI config
- compose payload builder
- stationery config
- auth form helpers

### `@pantopus/theme`

Package manifest:

- `frontend/packages/theme/package.json`

Public exports:

- `.`
- `./tailwind`

It exports:

- colors
- spacing
- typography
- radii
- shadows
- CSS variable generators
- Tailwind bridge config

## 10. How Do We Know A Shared Type Still Matches The Database?

The honest answer is:

> We do not rely on TypeScript alone. Shared types are manually maintained, and
> the repo uses database migrations, integration tests, smoke scripts, backend
> serializers, and route tests to keep them honest.

### The Database Source Of Truth

`backend/database/schema.sql` explicitly says it is a frozen snapshot and not
the source of truth.

The runnable migrations live in:

- `backend/database/migrations/`
- `supabase/migrations/`

For current migrated environments, migration smoke scripts are more important
than the frozen snapshot.

### How Type/Database Alignment Is Checked Today

1. Migrations define real database changes.
2. Backend code selects explicit column lists for important views.
3. Integration tests query those columns with `.limit(0)` to catch stale column
   names.
4. Smoke scripts check required tables/columns/enums/views for high-risk
   migrations.
5. Route tests assert response behavior.
6. Privacy contract tests assert forbidden keys never leave serializers.
7. Frontend type-check catches client-level mismatches once `@pantopus/api` and
   `@pantopus/types` are updated.

### Important Limitation

This does not mechanically prove that every `@pantopus/types` interface matches
every database row.

For example, a field in `frontend/packages/types/src/gig.ts` can become stale if:

- a migration changes a column name
- a backend serializer stops returning that field
- a route returns a derived field instead of a raw DB field
- the type is broader than the actual response for compatibility

The current approach relies on high-value tests and disciplined updates. It is
appropriate for velocity, but not perfect.

### Stronger Future Model

If I were hardening this further, I would do one of these:

1. Generate database types from Supabase/Postgres and check backend row access
   against them.
2. Generate OpenAPI from backend route schemas and generate `@pantopus/api`
   DTOs from OpenAPI.
3. Move public schemas to a shared runtime schema layer, such as Zod or TypeBox,
   and derive both TypeScript types and validators from the same source.
4. Add API contract tests that call running backend routes and validate response
   JSON against schemas.
5. Add package-level checks that prevent `@pantopus/types` from depending on
   higher-level packages.

The ideal architecture would still keep backend policy private. It would only
generate public contracts, not privileged implementation details.

## 11. Interview Framing: What I Would Say Out Loud

If I were answering in an interview, I would frame it like this:

> I separate runtime ownership from client type ownership. The backend owns the
> executable API contract because it is the only layer that can enforce auth,
> validation, serialization, and privacy. `@pantopus/api` owns the web/mobile
> client surface, so apps do not scatter route strings and wire DTOs. 
> `@pantopus/types` owns shared product vocabulary and domain shapes.

Then I would add:

> Today those schemas are mostly manual. That is a tradeoff we made for speed
> across a broad product surface. We compensate with Joi validation, explicit
> serializers, integration schema tests, parity tests, smoke scripts, and privacy
> gates. For public API stability, I would eventually move toward generated
> contracts or shared runtime schemas, but I would still keep backend authz and
> private policy out of shared packages.

That answer is strong because it admits the system's actual limitations without
pretending manual TypeScript types are a perfect contract.

## 12. Rules Of Thumb For Future Changes

Use these rules when adding or changing an API:

1. Backend route owns validation, authorization, and serialization.
2. `@pantopus/api` owns the client function and endpoint-specific request/return
   type.
3. `@pantopus/types` gets the type only if it is reusable domain vocabulary, not
   a one-off endpoint wrapper.
4. Public constants used by frontend and backend need a single source or a
   parity test.
5. Never return raw DB rows from privacy-sensitive routes.
6. Never put backend secrets or privileged policy in shared frontend packages.
7. Add contract tests for high-risk response shapes.
8. Add schema-validation tests for new explicit backend column selections.
9. Deprecate old API package methods before removing them.
10. Keep package dependencies one-way: shared primitives down, orchestration up.

## 13. Current Architecture Strengths

- Web and mobile share one API facade.
- Shared types prevent frontend app divergence.
- Backend validation is explicit and close to route handlers.
- Privacy-sensitive identity responses are serializer-driven.
- CI includes dedicated privacy gates.
- High-risk enum contracts have parity tests.
- Database/schema drift has targeted smoke checks.
- Deprecated endpoint methods provide compatibility during migrations.
- Package dependencies are mostly acyclic and understandable.

## 14. Current Architecture Risks

- Request/response DTOs are not generated.
- Some endpoint types live in `@pantopus/api`, others in `@pantopus/types`,
  which can blur ownership.
- Backend Joi schemas are not shared with frontend form validation.
- Some shared types are described as based on database schema but are not
  mechanically generated from the database.
- Deprecated API methods can linger if there is no removal plan.
- CI currently does not make every type-check a hard gate.
- Manual constants require parity tests everywhere they are duplicated.

## 15. Recommended Improvements

I would prioritize improvements in this order:

1. Document package ownership rules in the repo so future changes know where
   types belong.
2. Add lint/import-boundary rules so `@pantopus/types` cannot import higher-level
   packages and apps cannot bypass `@pantopus/api` for normal backend calls.
3. Move duplicated enum contracts to a single source or add parity tests.
4. Add route-level response contract tests for critical endpoints.
5. Generate database types from Supabase/Postgres for backend row access.
6. Introduce OpenAPI or a shared schema library for public request/response DTOs.
7. Turn web type-check into a required CI gate once existing errors are cleaned
   up.
8. Track deprecated API exports with owner, replacement, and removal criteria.

## 16. Final Summary

Pantopus has a pragmatic monorepo contract architecture:

- Backend owns the live runtime truth.
- `@pantopus/api` owns frontend endpoint access and wire-level client DTOs.
- `@pantopus/types` owns shared domain vocabulary.
- Validation lives primarily on the backend.
- Request/response schemas are mostly handwritten.
- Drift is managed through central client code, backend validators, serializers,
  contract tests, schema smoke scripts, and CI.
- Shared packages are private workspace packages versioned by git/lockfile, not
  independently published semver.
- Shared packages must remain portable and must never contain server secrets,
  privileged policy, or app-specific code.
- Circular dependencies are avoided by keeping shared primitives low and
  orchestration high.
- The database contract is verified by migrations, integration tests, and smoke
  scripts, not by TypeScript alone.

