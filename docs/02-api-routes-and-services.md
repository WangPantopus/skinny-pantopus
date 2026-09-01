# API Routes & Services

> Complete documentation of all API endpoints, backend services, 3rd-party integrations, and data flow patterns.

---

## 1. Route Organization (53 Route Files)

All routes mounted under `/api` prefix in `app.js`.

```
 /api
  +-- /users              (auth, profile, blocks)
  +-- /gigs               (task marketplace)
  +-- /homes              (property management, IAM, claims)
  +-- /posts              (community feed)
  +-- /chats              (real-time messaging)
  +-- /listings           (goods marketplace, offers, trades)
  +-- /marketplace        (price intel, reputation)
  +-- /businesses         (profiles, IAM, seats, catalog, pages, verification)
  +-- /b/:username        (public business pages)
  +-- /offers             (work offers with scoring)
  +-- /reviews            (transaction reviews)
  +-- /wallet             (earnings, withdrawals)
  +-- /notifications      (push/in-app)
  +-- /upload / /files    (S3 media)
  +-- /geo                (geocoding, maps)
  +-- /ai                 (chat agent, drafts, vision, property intel)
  +-- /mailbox*           (mail/package tracking, v1-v3)
  +-- /activities         (support trains)
  +-- /relationships      (trust graph, connections)
  +-- /professional       (professional mode)
  +-- /privacy            (settings, blocks)
  +-- /hub                (mission control dashboard)
  +-- /location           (location sharing)
  +-- /link-preview       (OG metadata)
  +-- /saved-places       (saved locations)
  +-- /admin              (platform admin, verification queue)
  +-- /v1/address         (address validation pipeline)
  +-- /v1/landlord-tenant (landlord portal)
  +-- /v1/webhooks/lob    (Lob postcard webhooks)
  +-- /webhooks/stripe    (Stripe payment webhooks)
  +-- /internal           (Lambda -> Backend communication)
  +-- /debug              (dev-only diagnostics)
  +-- /health             (system health + metrics)
```

---

## 2. Endpoint Catalog by Domain

### 2.1 Authentication & Users (`/api/users`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/signup` | None | Create account (sets cookies) |
| POST | `/signin` | None | Login (sets cookies) |
| POST | `/refresh` | Cookie | Refresh access token |
| POST | `/logout` | Token | Clear session |
| POST | `/password-reset-request` | None | Request reset email |
| POST | `/password-reset` | None | Reset with token |
| POST | `/verify-email` | None | Verify email address |
| GET | `/me` | Token | Current user profile |
| PATCH | `/me` | Token | Update profile |
| GET | `/:userId` | None | Public profile |
| GET | `/me/residency-summary` | Token | Residency profile |
| POST | `/:userId/block` | Token | Block user |
| DELETE | `/:userId/block` | Token | Unblock user |
| GET | `/blocked` | Token | List blocked users |
| POST | `/notifications/push-token` | Token | Register Expo push token |
| DELETE | `/notifications/push-token` | Token | Unregister push token |

### 2.2 Gigs / Task Marketplace (`/api/gigs`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | Token | Create gig/task |
| GET | `/:gigId` | Optional | Get gig detail |
| GET | `/browse` | Optional | Browse gigs (filtered, paginated) |
| GET | `/search` | Optional | Full-text search |
| PATCH | `/:gigId` | Token+Owner | Update gig |
| DELETE | `/:gigId` | Token+Owner | Cancel gig |
| POST | `/:gigId/refresh` | Token+Owner | Bump posting (5d cooldown) |
| POST | `/:gigId/offers` | Token | Submit bid |
| GET | `/:gigId/offers` | Token+Owner | List bids |
| POST | `/:gigId/offers/:offerId/accept` | Token+Owner | Accept bid (triggers payment) |
| POST | `/:gigId/offers/:offerId/decline` | Token+Owner | Decline bid |
| POST | `/:gigId/instant-accept` | Token | Accept gig instantly (no bidding) |
| POST | `/:gigId/share-status` | Token | Generate shareable status link |
| GET | `/status/:token` | None | View status via public link |
| POST | `/:gigId/update-location` | Token+Worker | Real-time location update |
| POST | `/:gigId/mark-complete` | Token+Worker | Mark complete |
| POST | `/:gigId/approve-complete` | Token+Owner | Approve completion |
| POST | `/:gigId/save` | Token | Bookmark gig |
| DELETE | `/:gigId/save` | Token | Remove bookmark |
| GET | `/my-saved` | Token | List bookmarked gigs |

### 2.3 Homes & Property (`/api/homes`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | Token | Create home |
| GET | `/:homeId` | Token+Access | Get home detail |
| GET | `/my-homes` | Token | List user's homes |
| PATCH | `/:homeId` | Token+home.edit | Update metadata |
| DELETE | `/:homeId` | Token+Owner | Delete home |
| POST | `/:homeId/validate-address` | Token | Validate address |
| POST | `/:homeId/guest-passes` | Token+home.share | Create guest pass |
| GET | `/:homeId/guest-passes` | Token+home.share | List guest passes |
| DELETE | `/:homeId/guest-passes/:id` | Token+home.share | Revoke pass |
| GET | `/guest/:token` | None | View via guest pass |
| GET | `/shared/:token` | None | View via scoped grant |

**Ownership & Claims:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/:homeId/ownership/claims` | Token | Submit claim |
| GET | `/:homeId/ownership/claims` | Token+Access | View claims |
| POST | `/:homeId/ownership/claims/:id/evidence` | Token | Upload evidence |
| GET | `/:homeId/ownership/claims/:id/evidence` | Token+Owner | List evidence |

**Home IAM:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/:homeId/me` | Token | My access & permissions |
| GET | `/:homeId/members` | Token+Access | List occupants |
| POST | `/:homeId/members` | Token+Permission | Add member |
| POST | `/:homeId/members/:userId/role` | Token+home.manage | Update role |
| DELETE | `/:homeId/members/:userId` | Token+home.manage | Remove member |
| GET | `/:homeId/audit-log` | Token+home.manage | View audit log |
| POST | `/:homeId/lockdown` | Token+home.security | Enable lockdown |
| DELETE | `/:homeId/lockdown` | Token+home.security | Disable lockdown |
| POST | `/:homeId/transfer-admin` | Token+Owner | Transfer ownership |

**Home Tasks/Bills/Packages/Events:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET/POST | `/:homeId/tasks` | Token+Access | List/create tasks |
| GET/POST | `/:homeId/issues` | Token+Access | List/report issues |
| GET | `/:homeId/bills` | Token+finance | List bills |
| GET | `/:homeId/packages` | Token+Access | List packages |
| GET | `/:homeId/events` | Token+Access | List events |

### 2.4 Business Management (`/api/businesses`)

**CRUD & Profile:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | Token | Create business |
| POST | `/create-full` | Token | Create + location + hours atomic |
| GET | `/my-businesses` | Token | List user's businesses |
| GET | `/:id` | Token+Perm | Get business profile |
| GET | `/:id/dashboard` | Token+Perm | Dashboard metrics |
| PATCH | `/:id` | Token+Perm | Update profile |
| DELETE | `/:id` | Token+Owner | Delete business |

**Locations & Hours:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/:id/validate-address` | Token+Perm | Validate via decision engine |
| POST | `/:id/locations` | Token+Perm | Add location |
| GET | `/:id/locations` | Token+Perm | List locations |
| PATCH | `/:id/locations/:lid` | Token+Perm | Update location |
| DELETE | `/:id/locations/:lid` | Token+Perm | Delete location |
| PUT | `/:id/locations/:lid/hours` | Token+Perm | Set weekly hours |
| POST | `/:id/locations/:lid/special-hours` | Token+Perm | Add special hours |

**Catalog:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/:id/catalog/categories` | Token+Perm | Create category |
| GET | `/:id/catalog/categories` | Token+Perm | List categories |
| POST | `/:id/catalog/items` | Token+Perm | Create item |
| GET | `/:id/catalog/items` | Token+Perm | List items |
| PATCH | `/:id/catalog/items/:iid` | Token+Perm | Update item |
| POST | `/:id/catalog/items/reorder` | Token+Perm | Reorder items |

**Pages & Blocks:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/:id/pages` | Token+Perm | Create page |
| GET | `/:id/pages` | Token+Perm | List pages |
| GET | `/:id/pages/:pid/blocks` | Token+Perm | Get blocks |
| PUT | `/:id/pages/:pid/blocks` | Token+Perm | Save draft |
| POST | `/:id/pages/:pid/publish` | Token+Perm | Publish revision |

**Business IAM (Seats):**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/:id/seats` | Token+team.view | List seats |
| POST | `/:id/seats/invite` | Token+team.invite | Create seat + invite |
| POST | `/seats/accept-invite` | Token | Accept invite |
| POST | `/seats/decline-invite` | None | Decline invite |
| PATCH | `/:id/seats/:sid` | Token+team.manage | Update seat |
| DELETE | `/:id/seats/:sid` | Token+team.manage | Deactivate seat |
| GET | `/my-seats` | Token | All user's seats |

**Verification & Founding:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/:id/verify/self-attest` | Token+Perm | Self-attest identity |
| POST | `/:id/verify/upload-evidence` | Token+Perm | Upload verification doc |
| GET | `/:id/verify/status` | Token+Perm | Verification status |
| GET | `/founding-offer/status` | Token | Founding slot availability |
| POST | `/:id/founding-offer/claim` | Token+Owner | Claim founding slot |

**Public Business Pages:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/b/:username` | None | Public business profile |
| GET | `/b/:username/:slug` | None | Public business page |

### 2.5 Marketplace & Listings (`/api/listings`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/` | Token | Create listing |
| GET | `/:id` | Optional | Get listing detail |
| GET | `/` | Optional | Browse listings |
| GET | `/search` | Optional | Full-text search |
| PATCH | `/:id` | Token+Creator | Update |
| DELETE | `/:id` | Token+Creator | Delete |
| POST | `/:id/refresh` | Token+Creator | Bump (5d cooldown) |
| POST | `/:id/save` | Token | Save to favorites |
| DELETE | `/:id/save` | Token | Unsave |
| GET | `/my-saved` | Token | List saved |
| POST | `/:id/message` | Token | Send inquiry |
| POST | `/:id/reveal-address` | Token | Reveal full address |
| POST | `/:id/offers` | Token | Make offer |
| GET | `/:id/offers` | Token+Creator | List offers |
| POST | `/:id/offers/:oid/accept` | Token+Creator | Accept offer |
| POST | `/:id/offers/:oid/counter` | Token | Counter offer |
| POST | `/:id/trades` | Token | Propose trade |

### 2.6 Chat (`/api/chats`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/direct` | Token | Create DM |
| POST | `/group` | Token | Create group chat |
| GET | `/` | Token | List chats (paginated) |
| GET | `/:roomId` | Token+Access | Room detail |
| PATCH | `/:roomId` | Token+Access | Update room |
| POST | `/:roomId/messages` | Token | Send message |
| GET | `/:roomId/messages` | Token+Access | Get messages (cursor) |
| PATCH | `/:roomId/messages/:mid` | Token+Author | Edit message |
| DELETE | `/:roomId/messages/:mid` | Token+Author | Delete message |
| POST | `/:roomId/messages/:mid/reactions` | Token | Add reaction |
| POST | `/:roomId/topics` | Token+Access | Create topic |
| POST | `/:roomId/participants` | Token+Access | Add participant |
| DELETE | `/:roomId/participants/:uid` | Token+Access | Remove/leave |

### 2.7 AI Services (`/api/ai`)

| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|------|------------|---------|
| GET | `/health` | None | - | AI service health |
| POST | `/chat` | Token | 20/hour | Streaming multi-turn chat |
| POST | `/draft/gig` | Token | 30/hour | Draft gig from text |
| POST | `/draft/listing` | Token | 30/hour | Draft listing from text |
| POST | `/draft/listing-vision` | Token | 30/hour | Draft listing from images |
| POST | `/draft/post` | Token | 30/hour | Draft post from text |
| POST | `/summarize/mail` | Token | 30/hour | Summarize email |
| GET | `/place-brief` | Token | - | Location intelligence |
| GET | `/property-profile` | Token+Access | - | Property intel |
| GET | `/pulse` | Token+Access | - | Neighborhood pulse |
| GET | `/conversations` | Token | - | List AI conversations |
| DELETE | `/conversations/:id` | Token | - | Delete conversation |

### 2.8 Payments & Wallet

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/card/add` | Token | Add payment card |
| GET | `/cards` | Token | List saved cards |
| DELETE | `/cards/:id` | Token | Remove card |
| POST | `/payout-setup` | Token | Initiate Stripe Connect onboarding |
| GET | `/payout-status` | Token | Check payout setup |
| POST | `/charges/:id/refund` | Token | Request refund |
| GET | `/wallet` | Token | Get wallet balance |
| GET | `/wallet/transactions` | Token | List transactions |
| POST | `/wallet/add-credits` | Token | Add credits |

### 2.9 Admin (`/api/admin`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/pending-claims` | Admin | List ownership claims |
| GET | `/claims/:id` | Admin | Full claim detail |
| POST | `/claims/:id/review` | Admin | Approve/reject claim |
| GET | `/verification/queue` | Admin | Pending business verifications |
| POST | `/verification/:id/approve` | Admin | Approve evidence |
| POST | `/verification/:id/reject` | Admin | Reject evidence |
| PATCH | `/verification/businesses/:id/fee-override` | Admin | Set fee override |

### 2.10 Internal (Lambda -> Backend)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/internal/briefing/send` | API Key | Trigger daily briefing |
| POST | `/internal/briefing/alert-push` | API Key | Send alert push |
| POST | `/internal/briefing/reminder-push` | API Key | Send reminder push |

### 2.11 Webhooks

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/webhooks/stripe` | Signature | Stripe payment events |
| POST | `/v1/webhooks/lob` | Signature | Lob postcard events |

---

## 3. Services Architecture

### 3.1 Service Domains

```
 services/
 +-- addressValidation/          Address normalization, validation, verification
 |   +-- addressValidationService.js
 |   +-- pipelineService.js
 |   +-- addressDecisionEngine.js
 |   +-- canonicalAddressService.js
 |   +-- mailVerificationService.js
 |   +-- googleProvider.js
 |   +-- smartyProvider.js
 |   +-- parcelIntelProvider.js
 |   +-- secondaryAddressProvider.js
 |   +-- placeClassificationProvider.js
 |   +-- placeShadowComparison.js
 |   +-- parcelShadowComparison.js
 |   +-- mailVendorService.js
 |
 +-- ai/                         OpenAI integration
 |   +-- agentService.js           Multi-turn chat, drafts, summarization
 |   +-- tools.js                  Function definitions for AI tool calling
 |   +-- schemas.js                Structured output schemas
 |   +-- prompts.js                System prompts
 |   +-- propertyIntelligenceService.js   ATTOM property data
 |   +-- neighborhoodPulseComposer.js     Neighborhood insights
 |   +-- seasonalEngine.js         Seasonal recommendations
 |   +-- propertySuggestionsService.js    AI property suggestions
 |   +-- supportTrainDraftService.js      Support train drafts
 |
 +-- marketplace/                Listing, offers, trades
 |   +-- marketplaceService.js     Browse, search, autocomplete
 |   +-- priceIntelligenceService.js  Price suggestions
 |   +-- reputationService.js      Seller reputation scoring
 |   +-- savedSearchService.js     Saved search alerts
 |   +-- tradeService.js           Trade/barter logic
 |   +-- listingOfferService.js    Offer negotiation
 |   +-- discoveryCacheService.js  Browse result caching
 |   +-- locationPrivacy.js        Coordinate obfuscation
 |
 +-- context/                    Briefing & environmental data
 |   +-- contextCacheService.js    Geohash-keyed provider cache
 |   +-- eveningBriefingService.js Briefing composition
 |   +-- briefingComposer.js       Content assembly
 |   +-- briefingHistoryService.js Delivery tracking
 |   +-- providerOrchestrator.js   Multi-provider coordination
 |   +-- weatherProvider.js        Apple WeatherKit
 |   +-- aqiProvider.js            AirNow
 |   +-- alertsProvider.js         NOAA
 |   +-- usefulnessEngine.js       Signal relevance scoring
 |   +-- locationResolver.js       User location resolution
 |
 +-- external/                   External API adapters
 |   +-- noaa.js                   NOAA weather alerts
 |   +-- airNow.js                 EPA air quality
 |   +-- cacheHelper.js            Shared cache logic
 |
 +-- gig/                        Gig lifecycle
 |   +-- rankingService.js         Composite relevance scoring
 |   +-- affinityService.js        User category preferences
 |   +-- clusterService.js         Geographic grouping
 |   +-- browseCacheService.js     Browse result cache
 |   +-- jaccardUtils.js           Similarity metrics
 |
 +-- (root services)
     +-- walletService.js          Earnings wallet + Stripe transfers
     +-- earningsService.js        Earnings aggregation
     +-- notificationService.js    In-app + Socket.IO notifications
     +-- pushService.js            Expo push notifications
     +-- badgeService.js           Unread count badges
     +-- feedService.js            Feed ranking + social filtering
     +-- s3Service.js              S3 upload/download/presigned URLs
     +-- emailService.js           Transactional email (SMTP)
     +-- alertingService.js        Slack + PagerDuty ops alerts
     +-- blockService.js           Cached user block checks
     +-- occupancyAttachService.js HomeOccupancy gateway
     +-- homeClaimComparisonService.js  Claim conflict resolution
     +-- homeClaimCompatService.js      Household claim compat
     +-- homeClaimMergeService.js       Merge claims
     +-- homeClaimRoutingService.js     Route to verification
     +-- propertyDataService.js    ATTOM + CoreLogic property lookups
     +-- businessEntityService.js  Entity-type logic + fees
     +-- businessMembershipService.js   Team management
     +-- businessSignalService.js  Verification signals
     +-- businessAddressService.js Business address handling
     +-- magicTaskService.js       AI-powered task generation
     +-- offerScoringService.js    Work offer matching
     +-- seederProvisioningService.js   Test data seeding
```

### 3.2 Key Data Flows

#### Gig Creation -> Payment -> Completion

```
User creates gig
  |
  v
POST /api/gigs -> validate -> geocode address -> insert Gig
  |
  v
Worker bids (POST /api/gigs/:id/offers)
  |
  v
Owner accepts bid -> createPaymentIntentForGig (Stripe, manual capture)
  |                   -> status: authorized
  v
Worker completes -> mark-complete
  |
  v
Owner approves -> capturePayment (Stripe capture)
  |               -> status: captured_hold
  v
[48h cooling-off via processPendingTransfers cron]
  |
  v
Credit wallet -> Stripe Connect transfer
  |              -> status: transferred
  v
Worker withdraws -> walletService.withdraw -> Stripe payout
```

#### Address Verification Pipeline

```
User provides address
  |
  v
[normalize + SHA-256 hash for dedup]
  |
  v
[Google Address Validation API] -> geocode, components
  |
  v
[Smarty Postal API] -> DPV match code, RDI type
  |
  v
[Decision Engine] -> classify verdict:
  |   OK, MISSING_UNIT, LOW_CONFIDENCE, UNDELIVERABLE, BUSINESS
  |
  +--[Shadow: Google Places]-> compare place classification
  +--[Shadow: ATTOM Parcel] -> compare unit/parcel data
  |
  v
[Canonical Address Service] -> find-or-create HomeAddress
  |
  v
If verification needed -> Mail verification flow:
  Generate code -> LOB postcard -> user enters code -> HomeOccupancy
```

#### Feed Ranking Algorithm

```
Post enters feed query
  |
  v
[computeUtilityScore] (0-10 scale)
  |
  +-- Intent bonus (+2.0): ask, offer, heads_up, event, deal
  +-- Location bonus (+0.5): has coordinates
  +-- Media bonus (+0.5): has images/video
  +-- Engagement: saves weighted 3x over likes
  +-- Solved bonus (+0.75): marked as resolved
  +-- Not helpful penalty (-0.5 each flag)
  +-- Time decay: -2.0 max after 7 days
  |
  v
[Social filtering]
  +-- Mute/hide/block filter (cached 60s)
  +-- Visibility policy (public/followers/connections/home)
  +-- Trust state check (verified_resident, visitor, etc.)
  |
  v
[Location privacy]
  +-- Obfuscate coordinates based on reveal policy
  |
  v
Ranked feed returned to client
```

---

## 4. 3rd-Party API Integration Details

### 4.1 How We Call Each API

| API | HTTP Client | Auth | Timeout | Error Handling |
|-----|-------------|------|---------|----------------|
| **Supabase** | `@supabase/supabase-js` | Service role key | Default | Throws on error |
| **Stripe** | `stripe` npm | Secret key | Default | Webhook idempotency |
| **OpenAI** | `openai` npm | API key | 20-30s | Retry on 429, fallback |
| **Google Address** | `fetch` | API key in URL | 5s | Fallback to cache |
| **Smarty** | `fetch` | auth-id + auth-token | 1.5s | Outage fallback |
| **ATTOM** | `fetch` | API key header | 10s | Cache 30d TTL |
| **Mapbox** | `fetch` | Access token | 5s | Log warning, return null |
| **Lob** | Webhook (inbound) | Signature verify | N/A | Idempotent |
| **Expo** | `expo-server-sdk` | None (server-side) | Default | Chunked sends |
| **Twilio** | `twilio` npm | Account SID + token | Default | Log error |
| **NOAA** | `fetch` | None (free) | 5s | Skip on error |
| **AirNow** | `fetch` | API key | 5s | Skip on error |
| **WeatherKit** | `fetch` | Apple token | 5s | Cache + fallback |
| **Nominatim** | `httpx` (Python) | None (free) | 5s | Fallback to coords |
| **Google News** | RSS via `feedparser` | None | 10s | Skip on error |
| **USGS** | `httpx` (Python) | None (free) | 10s | Skip on error |

### 4.2 Data Ingestion Patterns

| Source | Ingestion Method | Frequency | Storage |
|--------|-----------------|-----------|---------|
| **News feeds** | Lambda Fetcher pulls RSS | Every 2 hours | seeder_content_queue |
| **Weather alerts** | Lambda AlertChecker polls NOAA | Every 10 min | AlertNotificationHistory |
| **AQI data** | Lambda AlertChecker polls AirNow | Every 10 min | AlertNotificationHistory |
| **Earthquake data** | Lambda Fetcher polls USGS | Every 2 hours | seeder_content_queue |
| **Property data** | On-demand via ATTOM API | Per request | PropertyIntelligenceCache (30d) |
| **Weather context** | On-demand via providers | Per briefing | ContextCache (TTL varies) |
| **Stripe events** | Webhook push from Stripe | Real-time | StripeWebhookEvent |
| **Lob events** | Webhook push from Lob | Real-time | Processed inline |
| **User content** | API POST from clients | Real-time | Supabase tables |

### 4.3 How Data Is Served to Users

| Data Type | Delivery Method | Caching |
|-----------|----------------|---------|
| **Feed posts** | REST API (paginated, cursor) | Utility score recomputed every 15m |
| **Gig listings** | REST API (paginated, filtered) | Browse cache (5-10m TTL) |
| **Chat messages** | REST API + Socket.IO (real-time) | None (DB authoritative) |
| **Notifications** | REST API + Socket.IO + Expo push | Badge counts computed on connect |
| **Property intel** | REST API | PropertyIntelligenceCache (30d) |
| **Weather/AQI** | Push notification + briefing | ContextCache (geohash-keyed) |
| **Business pages** | REST API (public, no auth) | None |
| **Media files** | S3 presigned URLs / CloudFront CDN | CloudFront edge cache |
| **Seeded content** | Posted as regular posts via API | Same as user posts |
| **Briefings** | Push notification + in-app | DailyBriefingDelivery (idempotent) |

---

## 5. Utilities Layer

### Core Utilities (`utils/`)

| Utility | Purpose |
|---------|---------|
| `logger.js` | Winston structured logging (console + file rotation) |
| `normalizeAddress.js` | Deterministic address normalization + SHA-256 hashing |
| `locationPrivacy.js` | Coordinate obfuscation (exact, approx, neighborhood, none) |
| `fuzzyCoordinates.js` | Jittered coordinates for privacy |
| `verifiedCoordinateGuard.js` | Validate coordinates are user-authorized |
| `feedRanking.js` | Utility score computation (0-10 scale) |
| `discoveryScoring.js` | Marketplace item scoring for discovery |
| `visibilityPolicy.js` | Visibility matrix (public/followers/connections/home) |
| `trustState.js` | Compute trust level (verified_resident/visitor/etc.) |
| `homePermissions.js` | Home IAM permission resolution |
| `businessPermissions.js` | Business IAM permission resolution |
| `seatPermissions.js` | Seat-based business access |
| `authorityResolution.js` | Home authority chain resolution |
| `homeSecurityPolicy.js` | Home security enforcement |
| `businessConstants.js` | Entity types, verification statuses, reserved usernames |
| `businessCompleteness.js` | Profile completion % calculation |
| `publicResidencyProfile.js` | Public-facing residency info |
| `homeOwnerRowLookup.js` | Direct home owner DB lookup |
| `csrf.js` | CSRF token generation/verification |
| `columns.js` | Explicit Supabase column selections |
| `moduleSchemas.js` | Shared validation schemas |

---

## 6. Constants (`constants/marketplace.js`)

| Constant | Values |
|----------|--------|
| **LISTING_CATEGORIES** | furniture, electronics, clothing, kids_baby, tools, home_garden, sports_outdoors, vehicles, books_media, collectibles, appliances, free_stuff, food_baked_goods, plants_garden, pet_supplies, arts_crafts, tickets_events, other |
| **LISTING_CONDITIONS** | new, like_new, good, fair, for_parts |
| **LISTING_STATUSES** | draft, active, pending_pickup, sold, archived, reserved, traded |
| **LOCATION_PRECISIONS** | exact_place, approx_area, neighborhood_only, none |
| **VISIBILITY_SCOPES** | neighborhood, city, radius, global |
| **LISTING_LAYERS** | goods, gigs, rentals, vehicles |
| **LISTING_TYPES** | sell_item, free_item, wanted_request, rent_sublet, vehicle_sale, vehicle_rent, service_gig, pre_order, recurring, trade_swap, flash_sale |

---

*See [03-jobs-stripe-realtime.md](./03-jobs-stripe-realtime.md) for background jobs, payment processing, and real-time communication.*
