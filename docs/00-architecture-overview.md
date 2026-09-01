# Pantopus Backend Architecture Overview

> Comprehensive design document for the Pantopus platform backend systems.
> Generated from full codebase analysis (April 2026).

---

## Table of Contents

| Document | Scope |
|----------|-------|
| [00-architecture-overview.md](./00-architecture-overview.md) | This file. High-level system architecture, tech stack, hosting, database |
| [01-authentication-authorization.md](./01-authentication-authorization.md) | OAuth, JWT, CSRF, RBAC, middleware chain, identity firewall |
| [02-api-routes-and-services.md](./02-api-routes-and-services.md) | All API endpoints, services, 3rd-party integrations, data flow |
| [03-jobs-stripe-realtime.md](./03-jobs-stripe-realtime.md) | Cron jobs, Stripe payments, Socket.IO, background workers |
| [04-lambda-functions-seeder.md](./04-lambda-functions-seeder.md) | AWS Lambda functions, EventBridge rules, content pipeline, alerting |

---

## 1. System Architecture Diagram

```
                                    +-------------------+
                                    |   Mobile Clients   |
                                    |   (iOS / Android)  |
                                    +--------+----------+
                                             |
                                    Bearer Token (JWT)
                                             |
+-------------------+               +--------v----------+               +-------------------+
|   Web Clients     | --- Cookie -->|                    |<-- Webhooks -|   Stripe API      |
|   (Next.js SPA)   |   (httpOnly)  |   Express 5.1     |              +-------------------+
+-------------------+               |   Backend API      |
                                    |   (Node.js 20)     |<-- Webhooks -+-------------------+
                                    |                    |              |   Lob (Postcard)   |
                                    +--+-----+-----+----+              +-------------------+
                                       |     |     |
                          +------------+     |     +-------------+
                          |                  |                   |
                 +--------v------+  +--------v-------+  +--------v--------+
                 |   Supabase    |  |   AWS S3       |  |   Socket.IO     |
                 |   PostgreSQL  |  |   + CloudFront |  |   (WebSocket)   |
                 |   (DB + Auth) |  |   (Media CDN)  |  |   Real-time     |
                 +---------------+  +----------------+  +-----------------+

                                    +-------------------+
                                    |  AWS Lambda (SAM)  |
                                    |  pantopus-seeder   |
                                    |  (Python 3.12)     |
                                    +--------+----------+
                                             |
                          +------------------+------------------+
                          |                  |                  |
                 +--------v------+  +--------v-------+  +------v----------+
                 |  EventBridge  |  |  Secrets Mgr   |  |  CloudWatch     |
                 |  (Cron Rules) |  |  (Credentials) |  |  (Metrics)      |
                 +---------------+  +----------------+  +-----------------+
```

## 2. Technology Stack

### Backend API

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 20 (Alpine) | Server runtime |
| **Framework** | Express | 5.1.0 | HTTP framework |
| **Language** | JavaScript | ES2022+ | Backend logic (CommonJS modules) |
| **Database** | PostgreSQL | 15+ | Primary data store (via Supabase) |
| **ORM/Client** | Supabase JS | 2.91.0 | DB client with RLS |
| **Real-time** | Socket.IO | 4.8.1 | WebSocket for chat & notifications |
| **Job Scheduler** | node-cron | 4.2.1 | Background cron jobs (in-process) |
| **Validation** | Joi + AJV | 17.13 / 8.18 | Request schema validation |
| **Logging** | Winston | 3.17.0 | Structured logging with file rotation |

### Serverless Layer (pantopus-seeder)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Python | 3.12 | Lambda runtime |
| **IaC** | AWS SAM | - | Infrastructure as Code |
| **Triggers** | EventBridge | - | Cron schedules |
| **Secrets** | AWS Secrets Manager | - | Credential storage |
| **Metrics** | CloudWatch | - | Operational monitoring |
| **AI** | OpenAI (gpt-4o-mini) | 1.0+ | Content humanization |
| **HTTP** | httpx | 0.27+ | Async HTTP client |
| **RSS** | feedparser | 6.0+ | Feed parsing |
| **Validation** | Pydantic | 2.0+ | Data models |

### 3rd-Party Services (Full Inventory)

| Service | Purpose | Used In |
|---------|---------|---------|
| **Supabase** | PostgreSQL DB + Auth + RLS + Realtime | Backend (core) |
| **Stripe** | Payments, Connect, Disputes | Backend (payments) |
| **AWS S3 + CloudFront** | File storage + CDN | Backend (media) |
| **OpenAI** | GPT-4o chat, drafts, vision, summarization | Backend (AI), Seeder (humanizer) |
| **Twilio** | SMS / Phone verification | Backend (auth) |
| **Mapbox** | Geocoding, maps, tiles | Backend (geo) |
| **Google Address Validation** | Address normalization + geocoding | Backend (address pipeline) |
| **Google Places** | Place type classification (shadow) | Backend (address pipeline) |
| **Smarty (SmartyStreets)** | USPS DPV deliverability + RDI type | Backend (address pipeline) |
| **ATTOM Data** | Property intel (value, beds/baths, owner) | Backend (property, AI) |
| **CoreLogic** | Property records (alternative to ATTOM) | Backend (property) |
| **Lob** | Physical postcard mailing | Backend (mail verification) |
| **Expo** | Push notifications (iOS/Android) | Backend (notifications) |
| **NOAA** | Severe weather alerts | Backend + Seeder (alerts) |
| **AirNow (EPA)** | Air quality index | Backend + Seeder (AQI) |
| **Apple WeatherKit** | Weather data | Backend (briefing) |
| **OpenMeteo** | Weather + AQI data | Seeder (sources) |
| **USGS** | Earthquake data | Seeder (sources) |
| **Google News** | Local news RSS | Seeder (sources) |
| **Wikipedia** | "On This Day" events | Seeder (sources) |
| **Nominatim (OSM)** | Reverse geocoding (free) | Seeder (discovery) |
| **Slack** | Operational alerts (webhook) | Backend (alerting) |
| **PagerDuty** | Critical incident paging | Backend (alerting) |
| **Nodemailer (SMTP)** | Transactional email | Backend (email) |

---

## 3. Database Architecture

### Provider
**Supabase-managed PostgreSQL** with Row-Level Security (RLS) policies on all tables.

### Access Patterns

| Client | Key | RLS |
|--------|-----|-----|
| Web/Mobile (via API) | `SUPABASE_ANON_KEY` | Enforced |
| Backend Server | `SUPABASE_SERVICE_ROLE_KEY` | Bypassed |
| Direct SQL | `DATABASE_URL` (pg driver) | N/A |

### Schema Overview (~95 migration files)

```
 Core Identity               Homes & Residency            Marketplace
 +------------------+        +------------------+         +------------------+
 | User             |        | Home             |         | Listing          |
 | StripeAccount    |        | HomeAddress      |         | ListingSave      |
 | PushToken        |        | HomeOccupancy    |         | ListingOffer     |
 | UserFollow       |        | HomeAuthority    |         | ListingMedia     |
 | UserBlock        |        | HomeAuditLog     |         | ListingCategory  |
 | Relationship     |        | HomeClaim        |         +------------------+
 | UserMute         |        | AddressClaim     |
 | UserAffinity     |        | AddressVerif...  |         Gigs & Work
 +------------------+        | MailVerifJob     |         +------------------+
                             | HomeBill         |         | Gig              |
 Business                    | HomeTask         |         | GigBid           |
 +------------------+        | HomeCalendarEvt  |         | GigMedia         |
 | BusinessProfile  |        | HomeLease        |         | Payment          |
 | BusinessTeam     |        | HomeLeaseResid.. |         | PaymentAudit     |
 | BusinessSeat     |        +------------------+         | Wallet           |
 | SeatBinding      |                                     | WalletLedger     |
 | BusinessRolePerm |        Content & Feed               +------------------+
 | BusinessPermOvr  |        +------------------+
 | BusinessLocation |        | Post             |         AI & Context
 | BusinessHours    |        | PostComment      |         +------------------+
 | BusinessCatalog  |        | PostLike         |         | AIConversation   |
 | BusinessPage     |        | PostMedia        |         | AIRequestLog     |
 | BusinessVerif..  |        | Notification     |         | PropertyIntelCch |
 +------------------+        +------------------+         | ContextCache     |
                                                          +------------------+
 Chat & Real-time            Seeder
 +------------------+        +------------------+
 | ChatRoom         |        | seeder_config    |
 | ChatMessage      |        | seeder_sources   |
 | ChatParticipant  |        | seeder_content_q |
 | ChatTyping       |        | AlertNotifHist   |
 | MessageReaction  |        | DailyBriefDlvr   |
 +------------------+        +------------------+
```

### Key RLS Policies
- All tables have RLS enabled
- Users can only read/write their own data (enforced via `auth.uid()`)
- Service role key bypasses RLS for server-side operations
- Business data scoped by team membership via `BusinessSeat`

---

## 4. Hosting & Deployment

### Backend API

```
 Deployment Target
 +----------------------------------------+
 |  Docker Container (Node 20 Alpine)     |
 |  Port: 8000                            |
 |  Health: /health (DB check)            |
 |  Graceful shutdown: SIGTERM/SIGINT     |
 |  Timeout: 10s force-exit               |
 +----------------------------------------+

 Docker Compose (Development)
 +----------------------------------------+
 |  Service: pantopus-backend             |
 |  Port: 8000:8000                       |
 |  Volume: ./:/app (hot-reload)          |
 |  Env: .env.dev                         |
 |  Network: pantopus-network (bridge)    |
 |  Restart: unless-stopped               |
 +----------------------------------------+
```

- **Development**: `docker-compose up` with nodemon hot-reload
- **Production**: `node app.js` in minimal Docker image
- **Trust Proxy**: Configurable via `TRUST_PROXY` env var (for load balancer)

### Lambda Functions (pantopus-seeder)

```
 AWS SAM Template
 +------------------------------------------------+
 |  Runtime: Python 3.12                           |
 |  Region: Configurable (default us-west-2)       |
 |  Secrets: pantopus/seeder/{Environment}         |
 |  Metrics: CloudWatch custom namespaces          |
 +------------------------------------------------+
 |                                                 |
 |  8 Lambda Functions:                            |
 |  - Fetcher        (every 2h,   256MB, 120s)    |
 |  - Poster         (hourly,     256MB, 600s)    |
 |  - Discovery      (daily,      256MB, 120s)    |
 |  - Briefing       (every 15m,  256MB, 300s)    |
 |  - BriefingClean  (daily,      256MB, 120s)    |
 |  - AlertChecker   (every 10m,  256MB, 120s)    |
 |  - HomeReminders  (2x daily,   256MB, 120s)    |
 |  - MailNotifs     (every 5m,   256MB, 120s)    |
 +------------------------------------------------+
```

- **Deployment**: `sam deploy` via `deploy/build.sh`
- **Triggering**: All via EventBridge schedule rules (no API Gateway)
- **Communication with Backend**: HTTP calls to `/api/internal/*` endpoints with `x-internal-api-key` header

---

## 5. Communication Between Backend API & Lambda Functions

```
+------------------+                              +------------------+
|  Lambda Function |  --- HTTP POST ------------> |  Backend API     |
|  (Python)        |  /api/internal/briefing/send |  (Express)       |
|                  |  Header: x-internal-api-key  |                  |
+------------------+                              +------------------+
        |                                                  |
        |  Reads from / Writes to                          |  Reads from / Writes to
        v                                                  v
+------------------+                              +------------------+
|  Supabase DB     |  <--- Shared database -----> |  Supabase DB     |
|  (service role)  |                              |  (service role)  |
+------------------+                              +------------------+
        |
        v
+------------------+
|  AWS Secrets Mgr |  (Lambda reads credentials)
+------------------+
```

### Communication Patterns

| Pattern | Direction | Mechanism |
|---------|-----------|-----------|
| **Lambda -> API** | Seeder -> Backend | HTTP POST to `/api/internal/*` with `x-internal-api-key` |
| **Shared State** | Both directions | Supabase PostgreSQL (shared tables) |
| **Lambda Triggers** | EventBridge -> Lambda | Cron schedule rules |
| **Backend Jobs** | In-process | node-cron (same process as API) |
| **Real-time** | Backend -> Client | Socket.IO WebSocket |
| **Webhooks** | External -> Backend | Stripe, Lob webhook endpoints |
| **Push** | Backend -> Mobile | Expo push notification service |
| **Email** | Backend -> User | Nodemailer (SMTP) |
| **Alerts** | Backend -> Ops | Slack webhooks, PagerDuty Events API |

### Internal API Endpoints (Lambda -> Backend)

| Endpoint | Lambda Caller | Purpose |
|----------|--------------|---------|
| `POST /api/internal/briefing/send` | Briefing Scheduler, Briefing Cleanup | Trigger daily briefing delivery |
| `POST /api/internal/briefing/alert-push` | Alert Checker | Send weather/AQI push notifications |
| `POST /api/internal/briefing/reminder-push` | Home Reminders, Mail Notifications | Send reminder push notifications |
| `POST /api/posts` | Poster | Create seeded community post |

---

## 6. Environment Configuration

### Required in Production

| Variable | Service |
|----------|---------|
| `SUPABASE_URL` | Supabase |
| `SUPABASE_ANON_KEY` | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase |
| `DATABASE_URL` | PostgreSQL direct |
| `JWT_SECRET` | Supabase JWT |
| `STRIPE_SECRET_KEY` | Stripe |
| `STRIPE_WEBHOOK_SECRET` | Stripe |
| `CSRF_SECRET` | CSRF protection |
| `GOOGLE_ADDRESS_VALIDATION_API_KEY` | Google |
| `SMARTY_AUTH_ID` + `SMARTY_AUTH_TOKEN` | Smarty |
| `LOB_API_KEY` + `LOB_WEBHOOK_SECRET` | Lob |
| `OPENAI_API_KEY` | OpenAI |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | AWS S3 |
| `MAPBOX_ACCESS_TOKEN` | Mapbox |

### Optional / Feature-Gated

| Variable | Default | Purpose |
|----------|---------|---------|
| `ATTOM_API_KEY` | - | Property intelligence |
| `TWILIO_ACCOUNT_SID` | - | SMS |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | - | Transactional email |
| `ENABLE_ADDRESS_PLACE_PROVIDER` | false | Google Places shadow |
| `ENABLE_ADDRESS_PARCEL_PROVIDER` | false | Parcel intel shadow |
| `HOUSEHOLD_CLAIM_*` | varies | Household claim feature flags |

---

## 7. High-Level Data Flow

```
 User Action                   Backend Processing                    External
 +-----------+                +----------------------+              +-----------+
 | Create    | -- POST /api -->| Validate (Joi)      |              |           |
 | Gig       |                | Auth (JWT + CSRF)    |              |           |
 |           |                | Rate Limit check     |              |           |
 |           |                | Service logic        | -- Geocode -->| Mapbox   |
 |           |                | DB write (Supabase)  |              |           |
 |           |                | Notification send    | -- Push ----->| Expo     |
 |           |                | Socket.IO emit       |              |           |
 |           | <-- 201 JSON --|                      |              |           |
 +-----------+                +----------------------+              +-----------+

 Cron Job                     Background Processing
 +-----------+                +----------------------+              +-----------+
 | node-cron | -- trigger --->| authorizeUpcoming    | -- Auth ----->| Stripe   |
 | (hourly)  |                | Gigs job             |              |           |
 |           |                | Query upcoming gigs  |              |           |
 |           |                | Create PaymentIntent | -- Intent --->| Stripe   |
 |           |                | Update gig status    |              |           |
 |           |                | Notify user          | -- Push ----->| Expo     |
 +-----------+                +----------------------+              +-----------+

 Lambda                       Seeder Pipeline
 +-----------+                +----------------------+              +-----------+
 | EventBrdg | -- invoke ---->| Fetcher Lambda       | -- RSS ------>| News     |
 | (2h cron) |                | Fetch sources        | -- API ------>| NOAA     |
 |           |                | Dedup + filter       | -- API ------>| USGS     |
 |           |                | Queue to DB          |              |           |
 +-----------+                +----------------------+              +-----------+
 | EventBrdg | -- invoke ---->| Poster Lambda        | -- AI ------->| OpenAI   |
 | (hourly)  |                | Select best item     |              |           |
 |           |                | Humanize via Claude  |              |           |
 |           |                | POST to API          | -- HTTP ----->| Backend  |
 +-----------+                +----------------------+              +-----------+
```

---

## 8. Security Architecture Summary

| Layer | Mechanism |
|-------|-----------|
| **Transport** | HTTPS (TLS), secure cookies |
| **Authentication** | Supabase JWT (Bearer + httpOnly cookie) |
| **CSRF** | Double-submit cookie + HMAC session binding |
| **Authorization** | Role-based (user/admin) + Resource-based (home/business IAM) |
| **Rate Limiting** | 14 endpoint-specific rate limiters |
| **Data Access** | Supabase RLS on all tables |
| **Input Validation** | Joi + AJV schemas on all mutations |
| **Headers** | Helmet (HSTS, X-Frame-Options, CSP, etc.) |
| **Secrets** | Environment variables (backend), AWS Secrets Manager (Lambda) |
| **Webhook Auth** | HMAC signature verification (Stripe, Lob) |
| **Internal API** | `x-internal-api-key` header (Lambda -> Backend) |
| **Audit** | HomeAuditLog, BusinessAuditLog, SeatAuditLog tables |

---

## 9. Monitoring & Observability

| System | Tool | Details |
|--------|------|---------|
| **API Performance** | APM middleware | p50/p95/p99 latencies, slow request alerts (>500ms) |
| **Logging** | Winston | Console + file (`combined.log`, 50MB rotation, 5 files) |
| **Request Tracing** | Request ID middleware | Unique ID per request for correlation |
| **Lambda Metrics** | CloudWatch | Custom metrics per function (latency, counts, errors) |
| **Operational Alerts** | Slack + PagerDuty | CRITICAL = page + Slack, WARNING = Slack only |
| **Health Checks** | `/health` endpoint | DB connectivity check, Docker healthcheck every 10s |
| **Metrics API** | `/api/health/metrics` | APM snapshot (per-route stats) |

---

*Continue to the module-specific documents for detailed coverage of each subsystem.*
