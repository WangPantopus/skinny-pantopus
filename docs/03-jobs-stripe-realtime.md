# Background Jobs, Stripe Payments & Real-Time Communication

> Detailed documentation of all cron jobs, payment processing, Socket.IO real-time system, and operational scripts.

---

## 1. Background Job System

### Scheduler: `node-cron` (in-process)

- **Timezone**: UTC for all schedules
- **Error isolation**: Each job wrapped with try/catch; one failure doesn't cascade
- **Timing**: All jobs emit `[CRON] jobName completed in Xms` logs
- **Test environment**: All jobs disabled when `NODE_ENV === 'test'`

### Job Reference (All 35 Jobs)

```
 Schedule Timeline (UTC)
 ========================================================
 Every 1m:  mailPartyExpiry
 Every 2m:  organicMatch, refreshDiscoveryCache, expirePendingPaymentBids
 Every 5m:  autoRemindWorker, mailInterruptNotification
 Every 10m: processClaimWindows (:07/:17/:27/:37/:47/:57)
 Every 15m: retryCaptureFailures (:05/:20/:35/:50)
             expireGigs (:08/:23/:38/:53)
             expireListings (:03/:18/:33/:48)
             expireOffers (:01/:16/:31/:46)
             recomputeUtilityScores (:10/:25/:40/:55)
             earnRiskReview
 Every 30m: communityModeration
             computeReputation (:07/:37)
             reconcileHomeHouseholdResolution (:14/:44)
             validateHomeCoordinates (:12/:42)
             supportTrainReminders (:09/:39)
 Hourly:    authorizeUpcomingGigs (:05)
             processPendingTransfers (:15)
             vacationHoldExpiry (:25)
             chatRedactionJob (:30)
             expirePopupBusinesses (:45)
             expireInitiatedHomeClaims (:11)
 Every 2h:  notifyClaimWindowExpiry (:20)
 Every 6h:  trustAnomalyDetection (:45)
             stampAwarder (:35)
 Daily:     expireUncapturedAuthorizations (3:00 AM)
             autoArchivePosts (4:00 AM)
             computeAvgResponseTime (5:00 AM)
             mailDayNotification (8:00 AM)
             cleanupGhostBusinesses (2:30 AM)
             draftBusinessReminder (10:00 AM)
 Weekly:    vaultWeeklyDigest (Monday 9:00 AM)
```

---

### 1.1 Payment & Transaction Jobs

#### `authorizeUpcomingGigs` (Hourly :05)

```
Purpose: Pre-authorize payment for gigs starting within 24 hours
Flow:
  1. Query gigs: status=assigned, starts_within_24h, has saved card
  2. Create off-session PaymentIntent (Stripe, manual capture)
  3. On failure: auto-cancel gigs within 2h of start
  4. Notify users of auth success/failure
```

#### `processPendingTransfers` (Hourly :15)

```
Purpose: Release escrow for captured payments past 48h cooling-off
Flow:
  1. Recover stranded transfer_scheduled/transfer_pending states
  2. Query: status=captured_hold, captured_at > 48h ago
  3. Credit provider's wallet (gig income + tips)
  4. Create Stripe Connect transfer
  5. Notify both payer and payee
```

#### `retryCaptureFailures` (Every 15m)

```
Purpose: Retry failed payment captures
Flow:
  1. Query: gigs with owner confirmation but capture_attempts < 3
  2. Retry capturePayment via Stripe
  3. On 3rd failure: notify payer, flag for ops review
```

#### `expireUncapturedAuthorizations` (Daily 3:00 AM)

```
Purpose: Cancel gigs with expiring authorizations
Flow:
  Part 1: Cancel non-started gigs with auth expiring in 24h
  Part 2: Alert ops for in-progress gigs with expiring auth (manual intervention)
```

#### `expirePendingPaymentBids` (Every 2m)

```
Purpose: Revert GigBids stuck in pending_payment
Flow:
  1. Query: status=pending_payment, created_at > 10 minutes
  2. Cancel Stripe PaymentIntent
  3. Revert bid status
```

---

### 1.2 Content & Feed Jobs

#### `autoArchivePosts` (Daily 4:00 AM)

```
Purpose: Auto-archive expired posts
TTL Rules:
  - Stories: 24h
  - Events: 24h after event_end_date
  - Deals: 3d or deal_expires_at (whichever first)
  - Questions: 14d
  - Lost & Found: 14d
  - Home Neighborhood: 7d
Scope: Only "nearby" audience posts (local content)
```

#### `recomputeUtilityScores` (Every 15m)

```
Purpose: Refresh feed ranking scores
Flow:
  1. Query: posts created in last 7d OR updated in last 24h
  2. Compute utility_score via feedRanking.js
  3. Update in batches of 100 (only if delta >= 0.01)
  4. Max 20 concurrent updates
```

#### `communityModeration` (Every 30m)

```
Purpose: Flag items with 3+ "concerned" reactions for admin review
```

#### `organicMatch` (Every 2m)

```
Purpose: Match businesses to community posts
Scoring: 35% neighbor count + 25% distance + 20% rating + 20% category match
Rule: No paid_boost or sponsored flag (must be separate module)
```

---

### 1.3 Home & Property Jobs

#### `processClaimWindows` (Every 10m)

```
Purpose: Promote provisional occupancies past challenge window
Flow:
  1. Query: occupancies past challenge_window_end
  2. Apply occupancy template
  3. Reset home security_state
  4. Write audit log
  5. Notify user of verified status
```

#### `expireInitiatedHomeClaims` (Hourly :11)

```
Purpose: Expire claims past evidence deadline
Flow:
  1. Query: state=initiated, past evidence deadline
  2. Set state=revoked, phase=expired, reason=expired_no_evidence
  3. Recalculate household resolution
```

#### `reconcileHomeHouseholdResolution` (Every 30m)

```
Purpose: Recompute household resolution for homes with claim activity
Candidates: contested, disputed, pending_single_claim, verified_household states
```

#### `validateHomeCoordinates` (Every 30m)

```
Purpose: Reverse-geocode new homes, flag mismatches
Flow:
  1. Query: homes created in last 7d with NULL coordinate_validation
  2. Reverse geocode via Mapbox (rate-limited 100ms/req)
  3. Flag: state/city mismatch, outside US
```

---

### 1.4 Business Management Jobs

#### `cleanupGhostBusinesses` (Daily 2:30 AM)

```
Purpose: Remove abandoned draft businesses
Criteria: 48h+ old, never published, no locations/catalog, <=10% completeness
Action: Delete User row (cascades to all business tables)
```

#### `expirePopupBusinesses` (Hourly :45)

```
Purpose: Unpublish pop-up businesses past active_until
```

#### `draftBusinessReminder` (Daily 10:00 AM)

```
Purpose: Remind users to complete business setup
Criteria: Draft businesses <7 days old
Cap: 3 reminders per business
```

#### `computeAvgResponseTime` (Daily 5:00 AM)

```
Purpose: Compute business response time
Window: Last 90 days
Metric: First customer message -> first business reply
Cap: Response time capped at 7 days
```

---

### 1.5 Notification Jobs

#### `mailDayNotification` (Daily 8:00 AM)

```
Purpose: Daily mailbox summary push notification
Content: Count of bills, packages, offers, urgent items
```

#### `mailInterruptNotification` (Every 5m)

```
Purpose: Real-time mail alerts
Triggers: Package "out for delivery", time-sensitive items, certified mail
```

#### `autoRemindWorker` (Every 5m)

```
Purpose: Remind workers before gig start
Rules:
  - 30 min before scheduled start
  - 30 min and 90 min after acceptance (ASAP gigs)
  - 15-min cooldown between reminders
  - Max 2 auto-reminders per assignment
  - Respects ack status (running_late, starting_now)
```

#### `supportTrainReminders` (Every 30m)

```
Purpose: Support Train activity reminders
Types:
  - 24h reminder for tomorrow's slots
  - Day-of reminder for slots starting within 4h
  - Open slots nudge (max once per 48h)
```

---

### 1.6 Trust & Risk Jobs

#### `earnRiskReview` (Every 15m)

```
Purpose: Risk assessment and tier transitions
Tiers:
  normal (0-29) -> pending_review (30-59) -> under_review (60-84) -> suspended (85+)
Actions:
  - Auto-lift expired suspensions
  - Create EarnSuspension records (7d default)
  - Set User.earn_suspended_until
```

#### `trustAnomalyDetection` (Every 6h)

```
Purpose: Flag suspicious account behavior
Detection: Provider neighbor_count growth >5 in 7 days
Filter: Only homes <60 days old, only gigs with payments >$10
Output: TrustAnomalyFlag (advisory, non-blocking)
```

---

### 1.7 Cleanup Jobs

#### `chatRedactionJob` (Hourly :30)

```
Purpose: Permanently redact deleted messages past retention
Default Retention: 180 days (CHAT_DELETED_REDACT_DAYS)
Per-Room Override: CHAT_ROOM_RETENTION_DAYS JSON env var
Batch Size: 200 messages
Action: Replace with '[deleted message]', clear attachments
```

#### `vacationHoldExpiry` (Hourly :25)

```
Purpose: Manage vacation holds
Actions:
  - Expire completed holds (active + end_date passed)
  - Activate scheduled holds (scheduled + start_date reached)
  - Update User.vacation_mode flag
```

#### `stampAwarder` (Every 6h)

```
Purpose: Award achievement stamps for milestones
Stamps: first_mail, ten_items, fifty_items, hundred_items, first_package, vault_organizer
Rarity: common, uncommon, rare
```

---

## 2. Stripe Payment System

### 2.1 Architecture

| Setting | Value |
|---------|-------|
| **Pattern** | Separate Charges and Transfers (manual capture) |
| **Platform Fee** | 15% default (configurable per entity type) |
| **Cooling-Off Period** | 48 hours |
| **Auth Hold Window** | 7 days |
| **Max Capture Attempts** | 5 |
| **Connect Type** | Express accounts |

### 2.2 Payment State Machine

```
                          +------+
                          | none |
                          +--+---+
                             |
                     +-------v--------+
                     | setup_pending  |
                     +-------+--------+
                             |
                  +----------v-----------+
                  | ready_to_authorize   |
                  +----------+-----------+
                             |
                  +----------v-----------+
                  | authorize_pending    |
                  +----------+-----------+
                             |
              +--------------+---------------+
              |                              |
    +---------v----------+      +------------v-----------+
    | authorized         |      | authorization_failed   |
    +---------+----------+      +------------------------+
              |
    +---------v----------+
    | capture_pending    |
    +---------+----------+
              |
    +---------v----------+
    | captured_hold      |  <-- 48h cooling-off
    +---------+----------+
              |
    +---------v-----------+
    | transfer_scheduled  |
    +---------+-----------+
              |
    +---------v----------+
    | transfer_pending   |
    +---------+----------+
              |
    +---------v----------+
    | transferred        |  (final success state)
    +--------------------+

  Alternative paths:
    authorized ---------> canceled
    captured_hold ------> refund_pending -> refunded_partial / refunded_full
    any captured state -> disputed
```

### 2.3 Stripe Connect Accounts

| Function | Purpose |
|----------|---------|
| `createConnectAccount(userId, userData)` | Create Express account |
| `createAccountLink(userId, returnUrl, refreshUrl)` | Onboarding link |
| `getConnectAccount(userId)` | Retrieve from DB |
| `syncConnectAccount(userId)` | Sync details from Stripe |

### 2.4 Entity Type Fee Schedule

| Entity Type | Default Fee |
|-------------|-------------|
| for_profit | 15% |
| home_service | 15% |
| sole_proprietor | 10% |
| nonprofit_501c3 | 3% |
| religious_org | 0% |
| community_group | 5% |
| pop_up_temporary | 15% |
| franchise_location | 15% |
| Founding offer | 10% (with founding badge) |

### 2.5 Webhook Events Handled

| Event Category | Events |
|----------------|--------|
| **Account** | account.updated, account.application.authorized, account.application.deauthorized |
| **Setup Intent** | setup_intent.succeeded, setup_intent.setup_failed |
| **Payment Intent** | payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, payment_intent.requires_action, payment_intent.amount_capturable_updated |
| **Charge** | charge.succeeded, charge.failed, charge.refunded |
| **Dispute** | charge.dispute.created, charge.dispute.updated, charge.dispute.closed |
| **Transfer** | transfer.created, transfer.paid, transfer.failed, transfer.reversed |
| **Payout** | payout.created, payout.paid, payout.failed |

### 2.6 Dispute Evidence Auto-Submission

When `charge.dispute.created` fires, the system auto-compiles evidence from:

1. Gig details (title, description, price, address, timestamps)
2. Accepted bid information
3. Payer/payee user profiles
4. Reviews (if any)
5. Chat messages (last 50 between parties)
6. Completion proof (photos, checklists, notes)

Then submits to Stripe dispute API.

### 2.7 Wallet Service

```
Wallet Model (earnings-only):
  - Users CANNOT deposit from card
  - Balance accumulates from: gig income, tips, refunds
  - Users CAN withdraw to bank (min $1.00)

Withdrawal Flow:
  1. User requests withdrawal
  2. Atomic wallet debit (PostgreSQL RPC)
  3. Stripe Connect transfer to provider account
  4. Stripe payout to bank per schedule
```

---

## 3. Real-Time Communication (Socket.IO)

### 3.1 Architecture

```
 Client (Web/Mobile)
    |
    | WebSocket upgrade
    |
    v
 Socket.IO Server (same HTTP server as Express)
    |
    +-- Authentication: JWT from handshake or cookie
    +-- Connected Users: Map<userId, Set<socketId>>
    +-- User Rooms: Map<userId, Set<roomId>>
    |
    +-- Namespace: /socket/chatSocketio
```

### 3.2 Authentication Flow

1. Client connects with `auth.token` (Bearer) or `pantopus_access` cookie
2. Server middleware verifies JWT via `supabase.auth.getUser(token)`
3. Attaches `socket.userId` and `socket.userEmail`
4. Rejects connection on invalid/missing token

### 3.3 Events

#### Connection Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `connection` | Client -> Server | Auto-join all user's rooms, compute badge counts |
| `disconnect` | Client -> Server | Cleanup rate limit counters, update presence |
| `user:online` | Server -> All | Broadcast user presence on first socket connect |

#### Room Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `room:join` | Client -> Server | Join room, load last 50 messages, mark read |
| `gig:join` | Client -> Server | Join gig detail room for updates |
| `gig:leave` | Client -> Server | Leave gig detail room |

#### Message Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `message:new` | Server -> Room | Broadcast new message (sent via REST) |
| `typing:start` | Client -> Server | Start typing indicator (rate: 10/60s) |
| `typing:stop` | Client -> Server | Stop typing indicator |
| `message:react` | Client -> Server | Add/remove reaction (rate: 60/60s) |

#### System Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `badge:update` | Server -> User | Unread counts (messages, offers, notifications) |

### 3.4 Rate Limiting (Socket-Scoped)

| Event | Limit | Window |
|-------|-------|--------|
| `message:react` | 60 | 60 seconds |
| `typing:start` | 10 | 60 seconds |

Counters auto-reset on disconnect.

### 3.5 Typing Indicators

- `typing:start` -> Upsert `ChatTyping` record (expires after 10s)
- `typing:stop` -> Delete `ChatTyping` record
- Broadcasts `typing` event to all room participants except sender

### 3.6 Badge Service Integration

On every new socket connection:
1. Compute unread message count (ChatParticipant.unread_count)
2. Compute pending offer count (GigBid.status = pending)
3. Compute notification count (Notification.read = false)
4. Emit `badge:update` with `{ unreadMessages, pendingOffers, notifications }`

---

## 4. Operational Scripts

### `scripts/backfill-business-locations.js`

```
Purpose: Geocode BusinessLocation rows with NULL coordinates
Rate: 10 req/sec (100ms delay between Mapbox calls)
Output: OK/FAIL/MISS status per location
```

### `scripts/geocode-provenance-backfill.js`

```
Purpose: Backfill geocode metadata for all location-storing tables
Tables: Home, HomeAddress, BusinessLocation, BusinessAddress, SeededBusiness,
        Gig, GigPrivateLocation, Listing, Post, UserPlace, SavedPlace
Features:
  - --dry-run mode
  - Re-geocodes legacy rows (before 2026-03-01)
  - Flags coordinate shifts >200m
  - JSON report generation
```

### `scripts/seedBusinesses.js`

```
Purpose: Seed 35 sample local service providers
Coverage: Handyman (10), Cleaning (6), Gardening (6), Pet Care (4), Moving (4), Other (5)
Region: Clark County WA + Portland Metro
Idempotent: Upsert on (source, source_id)
```

---

## 5. Error Handling & Resilience

### Global Error Handler (`errorHandler.js`)

```javascript
// All unhandled errors caught here
errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', { message, stack, url, method, userId });
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
    ...(dev && { stack, details: err })
  });
}
```

### Custom Error Class

```javascript
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    this.isOperational = true; // distinguishes from programmer errors
  }
}
```

### Process-Level Handling

| Event | Action |
|-------|--------|
| `uncaughtException` | Log + `process.exit(1)` |
| `unhandledRejection` | Log + `process.exit(1)` |
| `SIGTERM` / `SIGINT` | Close HTTP -> Close Socket.IO -> Exit (10s timeout) |

### Resilience Patterns

| Pattern | Where Used |
|---------|-----------|
| **Idempotency** | Stripe webhook events (StripeWebhookEvent table) |
| **Retry with backoff** | Payment capture (max 3 attempts, 15m interval) |
| **Circuit breaker** | Address provider timeouts (1.5s, fallback to cache) |
| **Rate limiting** | All API endpoints + Socket events |
| **Graceful degradation** | AI features return null if OpenAI unavailable |
| **Atomic operations** | Wallet transactions via PostgreSQL RPC |
| **Recovery jobs** | processPendingTransfers recovers stranded states |
| **Batch processing** | Score recomputation, redaction in batches of 100-200 |

---

*See [04-lambda-functions-seeder.md](./04-lambda-functions-seeder.md) for the serverless content seeding system.*
