# Backend Documentation Master Plan

## Purpose

This document defines how to produce truly comprehensive backend documentation for the Pantopus repository.

The target is not "developer notes" or "route summaries." The target is documentation that can take a smart newcomer with weak software-engineering context and get them to the point where they can:

- understand what the backend does
- understand how the major domains fit together
- trace user actions through routes, services, database calls, jobs, sockets, and third-party systems
- understand failure modes, side effects, and operational behavior
- find exact implementation entry points in the codebase without reading the whole repo first

This documentation set must work for two audiences at once:

- beginners who need plain-English explanations and mental models
- experienced engineers who need exact technical references and cross-links

## Baseline Scope Observed In The Codebase

The plan below is based on current backend structure, not on a generic template.

- Main runtime wiring is in `backend/app.js`.
- Route handlers are spread across roughly 50 files under `backend/routes/`.
- The backend currently contains roughly 721 `router.*` handlers.
- Background jobs are centralized in `backend/jobs/index.js`, with 29 job files.
- Realtime behavior is centered in `backend/socket/chatSocketio.js`, with 11 socket event handlers.
- Stripe behavior is concentrated in `backend/stripe/stripeService.js` and `backend/stripe/stripeWebhooks.js`.
- Stripe webhooks currently handle 28 event types.
- Stripe service logic currently exposes 26 major async methods.
- The Supabase layer includes 66 migrations under `supabase/migrations/`.
- Backend code currently contains 78 RPC call sites.
- The repo already has useful but partial domain docs in `docs/`, especially for payments, auth/authz, and chat.

These counts are large enough that comprehensive documentation must be executed as a structured project.

## Documentation Principles

### 1. Layered Explanations

Every major document must have three layers:

1. plain-English explanation
2. exact technical behavior
3. implementation references

The same doc should answer:

- "What is this feature for?"
- "How does it behave?"
- "Where is it implemented?"

### 2. Evidence-Based Writing

No statement should be included merely because it sounds plausible or because an older doc says it.

Every important statement must be supported by one or more of:

- route code
- service code
- middleware code
- job code
- socket code
- Stripe code
- SQL migrations
- RPC definitions
- tests
- runtime wiring in `backend/app.js`

### 3. Beginner-First Structure

Each document should begin with:

- what this area is for
- who uses it
- why it exists
- the main ideas to remember

Only then should it move into technical details.

### 4. Side Effects Are First-Class

The docs must not stop at request and response contracts.

For each important action, documentation must also describe:

- tables touched
- RPCs invoked
- emitted notifications
- websocket events
- background job dependencies
- Stripe side effects
- wallet effects
- logging and audit effects
- external service interactions

### 5. One Source Of Truth Inventory

Before prose docs are written, the team must build a complete backend inventory. This prevents missed endpoints, silent gaps, and stale assumptions.

### 6. Clear Separation Between Reference And Narrative

The final documentation set must include both:

- reference docs: exact endpoint, job, socket, webhook, and RPC catalogs
- narrative docs: how the system works, domain concepts, user journeys, state machines, and failure modes

## Non-Negotiable Coverage Areas

The final documentation must cover all of the following:

- all mounted REST API surfaces
- all route groups and endpoint families
- middleware and auth/permission behavior
- request lifecycle
- validation behavior
- service-layer logic
- background cron jobs
- websocket events and room behavior
- Stripe payment flows
- Stripe webhook processing
- wallet and payout behavior
- refunds, disputes, transfers, and reversals
- database tables relevant to each major domain
- RPC usage and dependencies
- major migrations and schema shifts
- side effects and cross-system coupling
- external integrations
- operational and failure behavior
- tests that define or validate behavior

## Recommended Documentation Information Architecture

Create a dedicated backend documentation tree under `docs/backend/`.

Recommended structure:

- `docs/backend/00-start-here.md`
- `docs/backend/01-system-map.md`
- `docs/backend/02-request-lifecycle.md`
- `docs/backend/03-glossary.md`
- `docs/backend/04-domain-overviews/`
- `docs/backend/05-api-reference/`
- `docs/backend/06-logic-guides/`
- `docs/backend/07-payments/`
- `docs/backend/08-realtime/`
- `docs/backend/09-jobs/`
- `docs/backend/10-database/`
- `docs/backend/11-user-journeys/`
- `docs/backend/12-runbooks/`
- `docs/backend/13-maintenance-model.md`

## Required Document Types

### Start Here Docs

These are for newcomers.

- what Pantopus is
- what the backend owns
- the main entities and domains
- how requests, jobs, sockets, and webhooks fit together
- where to start reading

### System Docs

- runtime architecture
- middleware order
- request lifecycle
- error handling
- auth model
- side-effect model

### Domain Overviews

One overview per major backend domain:

- users and auth
- privacy and blocks
- homes, ownership, and landlord flows
- gigs, offers, and reviews
- payments and wallet
- chat and mailbox
- businesses, seats, IAM, and discovery
- listings and marketplace
- AI and magic task
- files, upload, geo, location, and notifications
- admin, internal, and debug

### API Reference

Each endpoint entry must include:

- method and path
- mount location
- purpose in plain English
- auth requirements
- role or permission requirements
- request params
- query params
- body schema
- response shape
- major status codes
- tables touched
- RPCs called
- important service functions
- side effects
- related websocket events
- related jobs or webhooks
- related tests
- source code locations

### Logic Guides

These explain how the hard parts actually work across multiple files.

Examples:

- gig lifecycle
- bid and assignment flow
- home invite and claim flows
- business seat and IAM behavior
- listing offer and trade lifecycle
- chat room, unread, and reaction behavior

### Payments Docs

Payments need a dedicated documentation package, not just endpoint entries.

Required contents:

- payment domain map
- state machine explanation
- setup intent vs payment intent
- capture flow
- transfer flow
- wallet credit flow
- payout flow
- refund flow
- dispute flow
- webhook event handling
- cron dependencies
- recovery and reconciliation behavior
- key tables and RPCs
- failure modes and operator concerns

### Realtime Docs

- socket auth
- connection lifecycle
- room join behavior
- typing behavior
- read receipt behavior
- reaction behavior
- message creation and direct chat behavior
- REST and socket coupling

### Job Docs

For each cron job:

- schedule
- purpose
- trigger conditions
- tables and RPCs touched
- external services used
- side effects
- failure risks
- idempotency assumptions
- related routes and domains

### Database Docs

- core tables by domain
- important relationships
- major migration history
- RPC catalog
- which routes/jobs/services depend on which DB objects
- security and ownership notes where relevant

### User Journey Docs

These are tutorial-style and beginner-friendly.

Examples:

- new user signs up and gets authenticated
- user joins a home
- user posts a gig
- bid gets accepted
- payment gets authorized, captured, transferred, and paid out
- two users open a direct chat and exchange messages
- business creates a profile and connects Stripe
- listing gets created, offered on, and traded

### Runbooks

These are for operators and maintainers.

Examples:

- payment stuck in intermediate state
- webhook processing fails
- wallet numbers look wrong
- socket delivery looks inconsistent
- cron job appears broken
- migration created behavior drift

## Documentation Writing Standard

Every major document should follow the same internal order:

1. What this is
2. Why it exists
3. Main concepts
4. Happy path
5. Code path
6. Data path
7. Side effects
8. Failure modes
9. Related docs
10. Exact source references

Every complex subsystem should include at least one diagram.

Recommended diagram types:

- architecture diagrams
- sequence diagrams
- state transition diagrams
- dependency maps

## Execution Plan

### Phase 0: Standards, Templates, And Folder Layout

Goal:

Create the documentation rules before content creation starts.

Deliverables:

- backend docs folder structure
- documentation style guide
- endpoint template
- job template
- websocket event template
- webhook event template
- RPC template
- logic guide template
- user journey template
- runbook template

Checkpoint:

One sample document of each type exists and is approved as the quality bar.

### Phase 1: Backend Inventory And Coverage Matrix

Goal:

Produce a complete machine-assisted inventory of the backend surface.

Deliverables:

- route mount map from `backend/app.js`
- endpoint inventory across all route files
- middleware and auth matrix
- cron job inventory
- websocket event inventory
- webhook event inventory
- service inventory
- external integration inventory
- RPC inventory
- database dependency matrix
- env/config dependency inventory
- test reference index

Checkpoint:

There is a single coverage matrix showing every known backend surface and its documentation status.

### Phase 2: Beginner Onboarding Pack

Goal:

Give newcomers a mental model before they hit the reference docs.

Deliverables:

- `00-start-here.md`
- system map
- glossary
- request lifecycle
- major domain map
- "how to read this backend" guide

Checkpoint:

A newcomer can answer what the backend does, what the main domains are, and where payments, sockets, cron, and the database fit in.

### Phase 3: Runtime Architecture Documentation

Goal:

Translate boot and runtime wiring into human-readable docs.

Deliverables:

- middleware order doc
- auth and permission flow doc
- route mounting and precedence doc
- webhook raw body handling doc
- socket startup doc
- cron startup doc
- error handling doc
- external dependency map

Checkpoint:

A reader can trace an incoming request from ingress to response and understand where jobs and sockets are attached.

### Phase 4: REST API Reference By Domain

Goal:

Document every endpoint in a structured reference.

Deliverables:

- users/auth/privacy/blocks reference
- homes/ownership/landlord/address reference
- gigs/offers/reviews reference
- payments/wallet reference
- chat/mailbox/notifications reference
- businesses/IAM/seats/discovery/public-page reference
- listings/marketplace/trades reference
- AI/magic-task reference
- files/upload/geo/location/saved-places reference
- admin/internal/debug reference

Checkpoint:

Every endpoint in the coverage matrix has a completed reference entry.

### Phase 5: Logic Guides For Complex Domains

Goal:

Explain behavior that cannot be understood from endpoint entries alone.

Deliverables:

- auth and authorization model guide
- home and ownership logic guide
- gig lifecycle guide
- payment lifecycle guide
- wallet and payout guide
- chat lifecycle guide
- mailbox logic guide
- business IAM and seat model guide
- listing and trade lifecycle guide
- AI and magic task guide

Checkpoint:

A reader can understand core domain behavior without reading giant route files first.

### Phase 6: Realtime, Jobs, And Webhooks

Goal:

Document all asynchronous systems as first-class behavior.

Deliverables:

- websocket contract reference
- websocket behavior guide
- cron job catalog
- Stripe webhook catalog
- side-effect map linking routes, jobs, sockets, and webhooks

Checkpoint:

A reader can answer what happens after the request returns and which systems may continue or react asynchronously.

### Phase 7: Database And RPC Documentation

Goal:

Document the actual data and RPC dependencies behind the backend behavior.

Deliverables:

- core schema overview
- domain data maps
- RPC reference
- migration history summary by domain
- dependency maps from routes/jobs/services to tables and RPCs

Checkpoint:

A reader can identify which DB objects matter for each major backend subsystem.

### Phase 8: User Journeys And Tutorials

Goal:

Convert the reference set into learnable, scenario-based documentation.

Deliverables:

- auth journey
- home journey
- gig and payment journey
- chat journey
- business onboarding journey
- listing and trade journey
- operator troubleshooting examples

Checkpoint:

A newcomer can learn the system by following end-to-end examples instead of reading raw API docs first.

### Phase 9: Verification, Gap Closure, And Maintenance Model

Goal:

Prevent the final docs from being incomplete or stale on day one.

Deliverables:

- full doc/code verification sweep
- unresolved ambiguity list
- stale-doc risk list
- documentation ownership model
- PR checklist updates
- maintenance instructions for future contributors

Checkpoint:

There is a documented way to keep the docs current, and every known ambiguity is either resolved or explicitly called out.

## Execution Backlog

This backlog is ordered. Some work can overlap, but the project should follow this sequence.

### Backlog Item 1: Create The Documentation Foundation

Order:

First.

Specific deliverables:

- create `docs/backend/` structure
- create style guide
- create all document templates
- define naming conventions
- define citation and cross-linking rules
- define diagram standards

Checkpoint:

Sample docs are reviewed and approved as the standard for the rest of the project.

### Backlog Item 2: Build The Coverage Matrix

Order:

Second.

Specific deliverables:

- route inventory
- mount map
- job inventory
- websocket inventory
- webhook inventory
- RPC inventory
- service inventory
- external dependency inventory
- test index

Checkpoint:

Every backend surface area is listed exactly once in the tracking matrix.

### Backlog Item 3: Write The Newcomer Orientation Pack

Order:

Third.

Specific deliverables:

- `00-start-here.md`
- glossary
- system map
- request lifecycle
- domain map
- recommended reading order

Checkpoint:

Someone new to the repo can explain the major backend domains and how the system is stitched together.

### Backlog Item 4: Document Runtime And Cross-Cutting Behavior

Order:

Fourth.

Specific deliverables:

- middleware order
- auth model
- route precedence
- error handling
- raw webhook handling
- socket startup and auth
- cron startup
- external services map

Checkpoint:

The runtime model is understandable before domain reference docs begin.

### Backlog Item 5: Document Auth, Users, Privacy, And Blocks

Order:

Fifth.

Specific deliverables:

- domain overview
- endpoint reference
- permission notes
- related RPC and DB notes
- user journey examples

Checkpoint:

The identity and access foundation is documented well enough to support later docs.

### Backlog Item 6: Document Homes, Ownership, Address, And Landlord Flows

Order:

Sixth.

Specific deliverables:

- home domain overview
- ownership logic guide
- landlord flow guide
- endpoint reference
- DB and RPC dependency notes
- relevant journeys

Checkpoint:

Home and address behavior can be followed end to end.

### Backlog Item 7: Document Gigs, Offers, Reviews, And Their Logic

Order:

Seventh.

Specific deliverables:

- gig lifecycle guide
- offers and acceptance guide
- reviews coverage
- endpoint reference
- side-effect notes

Checkpoint:

The gig system is understandable from creation through completion.

### Backlog Item 8: Document Payments, Wallet, Stripe, And Operational Recovery

Order:

Eighth.

Specific deliverables:

- payment system overview
- state machine guide
- route reference
- Stripe service guide
- Stripe webhook guide
- wallet and payout guide
- refund and dispute guide
- cron coupling docs
- recovery and runbook docs

Checkpoint:

An engineer can explain the entire money flow without reading the code first.

### Backlog Item 9: Document Chat, Mailbox, Notifications, And Realtime

Order:

Ninth.

Specific deliverables:

- chat and mailbox overviews
- endpoint references
- websocket contract doc
- websocket behavior guide
- notification side-effect notes
- relevant user journeys

Checkpoint:

A reader can trace a messaging action across REST, DB, socket, and notification layers.

### Backlog Item 10: Document Businesses, IAM, Seats, Discovery, And Public Pages

Order:

Tenth.

Specific deliverables:

- business domain overview
- IAM and seat model guide
- business endpoint reference
- discovery and public page docs
- Stripe connect coverage for business flows

Checkpoint:

Business identity and permissions are understandable as a coherent subsystem.

### Backlog Item 11: Document Listings, Marketplace, Trades, AI, Files, Geo, And Supporting Domains

Order:

Eleventh.

Specific deliverables:

- listings and marketplace docs
- trade lifecycle guide
- AI and magic task docs
- file/upload docs
- geo/location docs
- saved places and related support domains

Checkpoint:

All remaining product domains are covered in the same documentation standard.

### Backlog Item 12: Document Jobs, RPCs, Database Maps, And Side-Effect Matrices

Order:

Twelfth.

Specific deliverables:

- cron catalog
- RPC reference
- schema overview
- migration summaries
- side-effect matrix
- dependency maps

Checkpoint:

The backend is documented not just by endpoint, but by data and asynchronous behavior.

### Backlog Item 13: Write End-To-End Learning Paths And Runbooks

Order:

Thirteenth.

Specific deliverables:

- scenario walkthroughs
- troubleshooting guides
- operator runbooks
- "how to debug this area" notes

Checkpoint:

A new engineer and an operator both have practical entry points into the system.

### Backlog Item 14: Final Verification And Maintenance Setup

Order:

Last.

Specific deliverables:

- coverage audit
- code-to-doc spot checks
- unresolved questions list
- doc ownership model
- maintenance instructions
- PR checklist additions

Checkpoint:

The docs are verified, complete against the inventory, and maintainable.

## Recommended Weekly Throughput

The request was not for a week-by-week calendar, but for how much work should be accomplished in a typical week. The numbers below assume one focused engineer doing the documentation project full-time.

### Weekly Throughput Target For Foundation Work

While creating templates, structure, and coverage tracking, a good weekly target is:

- complete the entire docs folder structure
- complete the full template set
- complete the initial coverage matrix
- complete 2 to 4 core architecture docs

This is a setup-heavy week and should not be judged by endpoint count alone.

### Weekly Throughput Target For Steady-State Reference Writing

Once the foundation exists, a good weekly target is:

- 80 to 120 simple or moderate endpoints fully documented and verified
- or 40 to 60 complex endpoints fully documented and verified
- 1 to 2 deep logic guides
- 1 subsystem diagram set
- 1 verification pass against tests and DB/RPC usage

The large route files in this repo mean some weeks will be slower but deeper.

### Weekly Throughput Target For Complex Systems Weeks

For weeks focused on payments, chat, or business IAM, a good weekly target is:

- 1 major subsystem package completed end to end
- 30 to 50 complex endpoints
- 1 to 3 sequence or state diagrams
- 1 side-effect matrix for that subsystem
- 1 runbook or troubleshooting guide

These weeks are heavier because behavior spans routes, services, jobs, sockets, webhooks, and DB state.

### Weekly Throughput Target For Finalization Weeks

For verification and polish weeks, a good weekly target is:

- 1 full coverage audit pass
- 100 percent cross-link completion for finished docs
- closure of the highest-risk ambiguities
- 3 to 5 user journey docs
- maintenance model and PR workflow updates

## Quality Gates

The project should not be called complete unless all of the following are true:

- every endpoint in the inventory is documented
- every cron job is documented
- every socket event is documented
- every Stripe webhook event handled by the code is documented
- every major RPC dependency is documented
- every major domain has both a beginner overview and a technical reference
- every complex lifecycle has at least one diagram
- every major subsystem has side effects explicitly documented
- every document has exact implementation references
- the docs include learning paths, not just references

## Risks And Mitigations

### Risk: Existing Docs Are Stale Or Partial

Mitigation:

Use existing docs only as leads. Verify everything against current code, SQL, and tests.

### Risk: Monolithic Route Files Hide Logic

Mitigation:

Write logic guides in addition to endpoint references. Do not expect route listings alone to explain behavior.

### Risk: DB/RPC Behavior Gets Missed

Mitigation:

Build an explicit route-to-table and route-to-RPC dependency matrix.

### Risk: Side Effects Are Under-Documented

Mitigation:

Require every endpoint and job doc to include side effects and downstream dependencies.

### Risk: Docs Become Stale Immediately

Mitigation:

End the project by adding a maintenance model, ownership, and a PR checklist.

## Practical Definition Of Success

This project succeeds if:

- a newcomer can learn the backend through the docs instead of giant route files
- a senior engineer can trust the docs as a technical reference
- an operator can use the docs to debug major runtime issues
- the documentation mirrors the real backend shape, including asynchronous and data-layer behavior

## Recommended Next Step

The next execution step after approving this plan is:

1. create the `docs/backend/` folder structure
2. generate the coverage matrix
3. create the document templates
4. write the newcomer orientation pack first

That sequence gives the project a stable backbone before reference writing begins.
