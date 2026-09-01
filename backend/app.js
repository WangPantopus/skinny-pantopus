const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const dotenvPath = fs.existsSync('.env') ? '.env' : '.env.dev';
require('dotenv').config({ path: dotenvPath });

// Import routes
const userRoutes = require('./routes/users');
const gigRoutes = require('./routes/gigs');
const mailboxRoutes = require('./routes/mailbox');
const homeRoutes = require('./routes/home');
const postRoutes = require('./routes/posts');
const fileRoutes = require('./routes/files');
const chatRoutes = require('./routes/chats');
const payRoutes = require('./routes/pays');
const stripeWebhooksRouter = require('./stripe/stripeWebhooks');
const lobWebhookRouter = require('./routes/lobWebhook');
const debugRoutes = require('./debug');
const geoRoutes = require('./routes/geo');
const offersRoutes = require('./routes/offers');
const notificationRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/upload');       // NEW: S3 uploads
const reviewRoutes = require('./routes/reviews');       // NEW: Reviews
const businessRoutes = require('./routes/businesses');   // Business profiles
const businessIamRoutes = require('./routes/businessIam'); // Business IAM
const businessSeatRoutes = require('./routes/businessSeats'); // Business Seats (Identity Firewall)
const privacyRoutes = require('./routes/privacy'); // Privacy settings & blocks (Identity Firewall)
const magicTaskRoutes = require('./routes/magicTask'); // Magic Task (AI-powered task posting)
const aiRoutes = require('./routes/ai');               // AI Agent (chat, drafts, place brief)
const supportTrainRoutes = require('./routes/supportTrains'); // Support Train (activities)
const businessVerificationRoutes = require('./routes/businessVerification'); // Business verification
const businessFoundingRoutes = require('./routes/businessFounding'); // Founding business offer
const walletRoutes = require('./routes/wallet');           // Wallet/balance
const relationshipRoutes = require('./routes/relationships'); // Trust graph (connections)
const professionalRoutes = require('./routes/professional'); // Professional mode
const localProfileRoutes = require('./routes/localProfiles'); // Local Profile identity surface
const personaRoutes = require('./routes/personas'); // Audience Profile / PublicPersona
const broadcastChannelRoutes = require('./routes/broadcastChannels'); // Persona broadcast
const identityCenterRoutes = require('./routes/identityCenter'); // Identity Center + View As
const identitySearchRoutes = require('./routes/identitySearch'); // Identity Firewall profile discovery
const { isIdentityFirewallEnabled, isPersonaEnabled, isPersonaBroadcastEnabled } = require('./utils/featureFlags');
const hubRoutes = require('./routes/hub');                     // Hub (Mission Control)
const locationRoutes = require('./routes/location');           // Viewing Location
const listingRoutes = require('./routes/listings');             // Marketplace Listings
const listingOfferRoutes = require('./routes/listingOffers');   // Listing Offers
const listingTradeRoutes = require('./routes/listingTrades');   // Listing Trades
const businessDiscoveryRoutes = require('./routes/businessDiscovery'); // Neighbor trust + discovery
const businessPublicPageRoutes = require('./routes/businessPublicPage'); // Public business page
const blockRoutes = require('./routes/blocks'); // User block/unblock
const transactionReviewRoutes = require('./routes/transactionReviews'); // Transaction reviews (marketplace)
const marketplaceRoutes = require('./routes/marketplace');               // Marketplace (price intel, reputation)
const linkPreviewRoutes = require('./routes/linkPreview');               // Link preview (OG metadata extraction)

// Import rate limiting middleware
const {
  globalWriteLimiter, financialWriteLimiter, contentCreationLimiter,
  homeCreationLimiter, ownershipClaimLimiter, postcardLimiter,
  verificationAttemptLimiter, authEndpointLimiter, previewLimiter,
} = require('./middleware/rateLimiter');

// Import APM middleware
const { apmMiddleware, getMetrics } = require('./middleware/apm');
const { getSnapshot: getAddressVerificationMetrics } = require('./services/addressValidation/addressVerificationMetrics');

// Import socket server
const chatSocketio = require('./socket/chatSocketio');

// Import background jobs
const { startJobs } = require('./jobs');
const { initPgBoss, stopPgBoss } = require('./jobs/pgBossManager');
const { registerPgBossJobs } = require('./jobs/pgBossJobs');

// Import logger
const logger = require('./utils/logger');

// Verify Supabase connection
const supabase = require('./config/supabase');
const supabaseAdmin = require('./config/supabaseAdmin');

// Initialize Express app
const app = express();
const server = http.createServer(app);

function parseTrustProxy(value) {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', 'yes', 'on'].includes(normalized)) return 1;
  if (['false', 'no', 'off'].includes(normalized)) return false;
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isFinite(parsed)) return parsed;
  return value;
}

function envFlagEnabled(name, defaultValue = true) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return defaultValue;
  return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:4010',
  'http://127.0.0.1:4010',
];

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function parseAllowedOrigins() {
  const fromAppUrl = normalizeOrigin(process.env.APP_URL);
  const fromList = String(process.env.APP_URLS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  const fromAppUrlSiblingPorts = [];
  if (fromAppUrl) {
    try {
      const parsed = new URL(fromAppUrl);
      const baseHost = `${parsed.protocol}//${parsed.hostname}`;
      fromAppUrlSiblingPorts.push(`${baseHost}:3000`, `${baseHost}:3001`, `${baseHost}:4010`);
    } catch {
      // ignore invalid APP_URL format
    }
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const merged = [
    ...(isProduction ? [] : DEFAULT_DEV_ORIGINS), // localhost only in non-production
    ...(fromAppUrl ? [fromAppUrl] : []),
    ...fromAppUrlSiblingPorts,
    ...fromList,
  ];
  return Array.from(new Set(merged));
}

const allowedOrigins = parseAllowedOrigins();
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // same-origin/non-browser clients
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.includes(normalized);
};

const configuredTrustProxy = String(process.env.TRUST_PROXY || '').trim();
const trustProxy = parseTrustProxy(
  configuredTrustProxy || (process.env.NODE_ENV === 'production' ? '1' : 'false')
);

if (configuredTrustProxy && ['true', 'yes', 'on'].includes(configuredTrustProxy.toLowerCase())) {
  logger.warn(
    'TRUST_PROXY=true is too permissive for IP-based rate limiting; treating it as 1 trusted proxy hop. Set TRUST_PROXY to an exact hop count or subnet list if your deployment uses a different proxy chain.'
  );
}

app.set('trust proxy', trustProxy);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ============ MIDDLEWARE ============

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    logger.warn('CORS blocked request origin', { origin, allowedOrigins });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.)
app.use(helmet());

// Stripe webhooks must use raw body for signature verification.
// Mount BEFORE JSON/urlencoded parsers and before 404/error handlers.
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhooksRouter
);

// Lob webhooks also need raw body for HMAC signature verification.
app.use(
  '/api/v1/webhooks/lob',
  express.raw({ type: 'application/json' }),
  lobWebhookRouter
);

// Internal email-inbound webhook (P2.9 / §17 #8). The Lambda signs the
// raw body, so this route MUST receive the raw bytes — mount before
// the JSON body parser, same pattern as the Stripe + Lob webhooks.
app.use(
  '/api/internal/email-inbound',
  express.raw({ type: '*/*', limit: '5mb' }),
  require('./routes/internalEmailInbound'),
);

// Body parsing middleware
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }));

// Cookie parsing (AUTH-3.3) — after body parsers, after webhook routes
app.use(cookieParser());

// NOTE: CSRF protection is applied per-route AFTER verifyToken (which
// sets req._authMethod). See verifyToken.js for the combined middleware.

// Request logging middleware.
//
// Public bearer-code URLs are redacted before logging: a fridge card,
// (case-INSENSITIVE, because Express routing is — /API/Public/... reaches
// the same handler and must not log the code either.)
// residency claim/letter, or invite opt-out code IS the credential, and
// writing it next to an IP + user agent would turn the log stream into
// a directory of live codes.
const BEARER_CODE_PATH = /^(\/api\/public\/(?:fridge-cards|residency-claims|residency-letters|block-invites\/opt-out))\/[^/]+/i;

// Paths where the REQUEST ITSELF is the sensitive fact, so no caller
// identifiers are recorded alongside it.
//
// Unlisted is "get my address off the internet". Its readers are
// disproportionately hiding from a specific person, the feature promises
// in writing that we do not record that they looked, and the route
// deliberately persists nothing and sends nothing to a third party — all
// of which an IP + user-agent + timestamp row quietly undoes. The typed
// address was never logged (it is a query param; `req.path` excludes the
// query string), but "this IP opened the page for people hiding their
// address" is itself the disclosure worth avoiding.
//
// The path is still logged, so volume, latency and errors stay visible,
// and abuse control is unaffected — the mount-level previewLimiter rate
// limits per IP without reading this log.
const NO_CALLER_ID_PATH = /^\/api\/public\/unlisted$/i;
app.use((req, res, next) => {
  const path = req.path.replace(BEARER_CODE_PATH, '$1/:code');
  logger.info(`${req.method} ${path}`, NO_CALLER_ID_PATH.test(req.path)
    ? {}
    : { ip: req.ip, userAgent: req.get('user-agent') });
  next();
});

// APM: response time tracking (before routes, after body parsing)
app.use(apmMiddleware);

// ============ HEALTH CHECK ============

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Pantopus Backend Running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    // Test Supabase connection
    const { data, error } = await supabase
      .from('User')
      .select('count')
      .limit(1);

    if (error) throw error;

    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============ APM METRICS ENDPOINT ============

app.get('/api/health/metrics', (req, res) => {
  // Optionally require admin auth in production
  res.json({
    uptime_seconds: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    routes: getMetrics(),
    address_verification: getAddressVerificationMetrics(),
  });
});

// ============ REQUEST ID ============
const requestIdMiddleware = require('./middleware/requestId');
app.use('/api', requestIdMiddleware);

// ============ GLOBAL RATE LIMITING (write endpoints) ============
app.use('/api', globalWriteLimiter);

// Stricter limiters for financial and content endpoints
app.use('/api/payments', financialWriteLimiter);
app.use('/api/wallet', financialWriteLimiter);
app.use('/api/posts', contentCreationLimiter);
app.use('/api/listings', contentCreationLimiter);
app.use('/api/reviews', contentCreationLimiter);

// Home ownership and verification limiters
app.use('/api/homes', homeCreationLimiter);
app.use('/api/users/login', authEndpointLimiter);
app.use('/api/users/register', authEndpointLimiter);

// ============ API ROUTES ============

// Calendarly public booking flow (own per-route limiters) — mounted before the generic public
// router so /book and /booking paths use bookingWriteLimiter, not the read previewLimiter.
app.use('/api/public', require('./routes/schedulingPublic'));

// Public preview endpoints (no auth, rate-limited by IP)
app.use('/api/public', previewLimiter, require('./routes/public'));

// Calendarly host APIs — personal/business via owner_type (home alias under /api/homes/:id/scheduling).
app.use('/api/scheduling', require('./routes/scheduling'));

app.use('/api/users', blockRoutes);    // Block routes (must be before userRoutes for /blocked static path)
app.use('/api/users', userRoutes);
app.use('/api/auth', require('./routes/authDevices')); // Persistent login: trusted devices, sessions, resume, step-up
app.use('/api/gigs', magicTaskRoutes);  // Magic Task routes (must be before gigRoutes for static paths)
app.use('/api/gigs', require('./routes/gigSavedSearches')); // P6 saved searches (static paths before /:id)
app.use('/api/gigs', gigRoutes);
app.use('/api/gigs', require('./routes/gigsV2'));     // Gigs MVP v2 endpoints (instant-accept, share-status, etc.)
app.use('/api/v2', require('./routes/offersV2'));      // Offers v2 with scoring & trust capsules
app.use('/api/mailbox/compose', require('./routes/mailCompose'));   // Mail Compose — four-moment flow
app.use('/api/mailbox', mailboxRoutes);
app.use('/api/mailbox/v2/mailday', require('./routes/mailDay'));   // My Mail Day physical-mail triage (before v2 so /mailday/* matches)
app.use('/api/mailbox/v2', require('./routes/mailboxV2'));
app.use('/api/mailbox/v2/p2', require('./routes/mailboxV2Phase2'));
app.use('/api/mailbox/v2/p3', require('./routes/mailboxV2Phase3'));
// Mount specialized /api/homes sub-routers before generic homeRoutes (which has /:id)
// so paths like /api/homes/my-ownership-claims don't get captured as an :id.
app.use('/api/homes', require('./routes/homeGuest'));    // Public guest/shared endpoints (no auth)
app.use('/api/homes', require('./routes/homeIam'));
app.use('/api/homes', require('./routes/homeOwnership'));
app.use('/api/homes', require('./routes/homePrivacy'));   // Per-home privacy/security toggles (/:id/privacy)
app.use('/api/homes', require('./routes/placeIntelligence')); // Place dashboard contract (/:id/intelligence)
app.use('/api/homes', require('./routes/residencyLetters')); // Server-attested residency letters (/:id/residency-letters)
app.use('/api/admin/address-review', require('./routes/adminAddressReview')); // SCN-11: manual_review queue
app.use('/api/homes', require('./routes/residencyClaims')); // Scoped live residency claims (/:id/residency-claims)
app.use('/api/homes', require('./routes/fridgeCards'));   // 911-ready household cards (/:id/fridge-cards)
app.use('/api/homes', require('./routes/mailboxCheck'));  // Mailbox reality check (/:id/mailbox-check)
app.use('/api/homes', require('./routes/homeRecordWatch')); // Rate watch (/:id/record-watch)
app.use('/api/homes', require('./routes/blockFounders')); // Founding ranks + postcard invites (/:id/block-founders)
app.use('/api/homes', require('./routes/realRent')); // Real Rent Benchmark contribution (/:id/rent-report)
app.use('/api/homes', require('./routes/unlisted')); // Unlisted removal tracking (/:id/unlisted)
app.use('/api/scout', require('./routes/scout')); // Before-You-Sign Scout (T1, no home)
app.use('/api/homes/:homeId/scheduling', require('./routes/scheduling')); // Calendarly home-scoped (before catch-all /:id)
app.use('/api/homes', homeRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/sports', require('./routes/sports'));  // Sports topic lane (active events)
app.use('/api/files', fileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', payRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/geo', geoRoutes);
// Wedge Phase 1 — the density-gated Neighborhood door's meter.
app.use('/api/neighborhood', require('./routes/neighborhood'));
app.use('/api/offers', offersRoutes);
app.use('/api/notifications', notificationRoutes);
// P0.8 — feature flags. Mounts both /api/feature-flags/:flagName (read,
// authenticated) and /api/admin/feature-flags/:flagName (write, admin).
app.use('/api', require('./routes/featureFlags'));
app.use('/api/upload', uploadRoutes);        // NEW: S3 upload routes
app.use('/api/reviews', reviewRoutes);       // NEW: Review routes
app.use('/api/transaction-reviews', transactionReviewRoutes); // Transaction reviews (marketplace)
// Mount routers with static paths BEFORE businessRoutes so they don't get
// captured by /:businessId (AUTH-2.2)
app.use('/api/businesses', businessDiscoveryRoutes); // Neighbor trust + discovery search (static: /search, /map)
app.use('/api/businesses', businessFoundingRoutes); // Founding business offer (static: /founding-offer/status)
app.use('/api/businesses', businessSeatRoutes); // Business Seats — MUST be before businessRoutes (static: /my-seats, /seats/*)
app.use('/api/businesses', businessVerificationRoutes); // Business verification (param: /:businessId/verify/*)
app.use('/api/businesses', businessRoutes);   // Business profile + CRUD (has /:businessId catch-all)
app.use('/api/businesses', businessIamRoutes); // Business IAM (team, roles)
app.use('/api/b', businessPublicPageRoutes);  // Public business page (SEO-friendly)
app.use('/api/wallet', walletRoutes);          // Wallet/balance
app.use('/api/relationships', relationshipRoutes); // Trust graph (connections)
app.use('/api/privacy', privacyRoutes);            // Privacy settings & blocks (Identity Firewall)
if (isIdentityFirewallEnabled()) {
  app.use('/api/local-profiles', localProfileRoutes); // Local Profile identity surface
  app.use('/api/identity-center', identityCenterRoutes); // Private Identity Center + View As
  app.use('/api/identity', identitySearchRoutes); // Profile-safe search and discovery
}
if (isPersonaEnabled()) {
  // P1.5 — owner-only tier CRUD. Mounted FIRST so requests like
  // GET /api/personas/UUID/tiers route here. The router itself rejects
  // non-UUID :id values via next('router'), letting handle-shaped URLs
  // fall through to the public GET /api/personas/:handle/tiers in
  // personaRoutes below. (Express 5 / path-to-regexp 8 dropped the
  // inline :id(regex) shorthand, so the UUID gate lives in the router.)
  app.use('/api/personas/:id/tiers', require('./routes/personaTiers'));
  // P1.7 — Stripe Connect onboarding + status. Same UUID gate pattern.
  app.use('/api/personas/:id/payments', require('./routes/personaPayments'));
  // P1.12 — DM threads + messages. Same UUID gate pattern.
  app.use('/api/personas/:id/dms', require('./routes/personaDms'));
  // P1.13 — fan membership lifecycle (cancel/upgrade/downgrade/refund-request).
  app.use('/api/personas/:id/membership', require('./routes/personaMembership'));
  // P1.14 — persona blocks (creator-driven /fans/:membershipId/block +
  // /blocks list). The router has its OWN UUID gate; mounted at
  // /api/personas/:id last among the UUID-gated routers because its
  // internal paths (/fans/:membershipId/block, /blocks) can't be
  // expressed as more-specific external mounts without conflicting
  // with the others.
  app.use('/api/personas/:id', require('./routes/personaBlocks'));
  app.use('/api/personas', personaRoutes);            // Audience Profile / PublicPersona
}
if (isPersonaBroadcastEnabled()) {
  app.use('/api/broadcast', broadcastChannelRoutes);  // One-way persona broadcast
}
app.use('/api/professional', professionalRoutes);  // Professional mode
app.use('/api/hub', hubRoutes);                        // Hub (Mission Control)
app.use('/api/location', locationRoutes);              // Viewing Location
app.use('/api/listings', listingRoutes);                // Marketplace Listings
app.use('/api/listings', listingOfferRoutes);           // Listing Offers
app.use('/api/listings', listingTradeRoutes);           // Listing Trades (nested under listings)
app.use('/api', listingTradeRoutes);                    // Listing Trades (standalone /trades/:tradeId/* actions)
app.use('/api/marketplace', marketplaceRoutes);          // Marketplace (price intel, reputation)
app.use('/api/link-preview', linkPreviewRoutes);         // Link preview (OG metadata extraction)
app.use('/api/saved-places', require('./routes/savedPlaces')); // Saved Places
app.use('/api/neighbor-messages', require('./routes/neighborMessages')); // Place — verified-only neighbor messaging (W2.6)
app.use('/api/v1/address', require('./routes/addressValidation')); // Address validation pipeline
app.use('/api/v1', require('./routes/landlordTenant'));            // Landlord portal + tenant flows
app.use('/api/admin', require('./routes/admin'));             // Platform admin
app.use('/api/admin/verification', require('./routes/adminVerification')); // Admin verification queue
app.use('/api/admin/payment-ops', require('./routes/paymentOps')); // Payment ops (stuck detection, manual triggers)
app.use('/api/internal/briefing', require('./routes/internalBriefing')); // Lambda briefing scheduler (must be before /api/internal)
app.use('/api/internal', require('./routes/internal'));       // Internal/cron triggers
app.use('/api/ai', aiRoutes);                                // AI Agent (chat, drafts, place brief)
app.use('/api/activities/support-trains', supportTrainRoutes); // Support Train (activities)

// ============ SOCKET.IO ============

// Make io accessible to route handlers via req.app.get('io')
app.set('io', io);

chatSocketio(io);

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============ SERVER STARTUP ============

// Phase 0 / P0.1: refuse to boot if the deployment claims PersonaFollow is
// pre-migration (PERSONA_FOLLOW_VIEW_ACTIVE explicitly false). This catches
// the SQL-rolled-back-but-code-not-rolled-back case before the first request
// touches PersonaMembership.
const { assertPersonaFollowViewActive } = require('./utils/personaFollowViewGuard');
assertPersonaFollowViewActive();

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0'; // 0.0.0.0 = accept connections from LAN (e.g. mobile device)

// Validate address verification config BEFORE accepting traffic. This used to
// run inside the listen callback, so in production the process bound the port,
// began serving requests, and only then process.exit(1)'d on missing keys.
require('./config/addressVerification').validate();

server.listen(PORT, HOST, async () => {
  logger.info(`🚀 Pantopus Backend Server started`, {
    host: HOST,
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });

  // Log Supabase connection status
  logger.info('📡 Supabase configuration loaded', {
    url: process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing',
    anonKey: process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'
  });

  // Log AWS S3 status
  logger.info('☁️ AWS S3 configuration', {
    region: process.env.AWS_REGION ? '✓ Set' : '✗ Missing',
    bucket: process.env.AWS_S3_BUCKET_NAME ? '✓ Set' : '✗ Missing',
    accessKey: process.env.AWS_ACCESS_KEY_ID ? '✓ Set' : '✗ Missing',
    secretKey: process.env.AWS_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Missing',
  });

  // Begin polling the address rollout flags so enforcement posture can be
  // changed at runtime through the admin feature-flag route instead of
  // requiring an environment change and a redeploy.
  require('./utils/addressRolloutFlags').startRolloutFlagRefresh();

  // Start pg-boss queue workers (Tier 2 jobs)
  // Set PGBOSS_ENABLED=false when running a separate worker container.
  let pgBossBackedJobsStarted = false;
  if (process.env.NODE_ENV !== 'test' && envFlagEnabled('PGBOSS_ENABLED', true)) {
    try {
      const boss = await initPgBoss();
      if (boss) {
        await registerPgBossJobs(boss);
        pgBossBackedJobsStarted = true;
      }
    } catch (err) {
      logger.error('[pg-boss] Failed to initialize:', { error: err.message, stack: err.stack });
      // pg-boss failure should not prevent server from running —
      // Tier 2 jobs fall back to node-cron (still registered below)
    }
  }

  // Start cron-based jobs unless a deployment runs them in a separate worker.
  if (envFlagEnabled('CRON_ENABLED', true)) {
    startJobs({ skipPgBossBackedJobs: pgBossBackedJobsStarted });
  } else {
    logger.info('[CRON] Skipping job startup because CRON_ENABLED=false');
  }
});

// ============ GRACEFUL SHUTDOWN ============

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown`);

  // Stop pg-boss workers first (allows in-flight jobs to complete)
  await stopPgBoss().catch((err) => {
    logger.error('[pg-boss] Error during shutdown:', { error: err.message });
  });

  server.close(() => {
    logger.info('HTTP server closed');

    // Close Socket.io connections
    io.close(() => {
      logger.info('Socket.io connections closed');

      // Exit process
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
  process.exit(1);
});

module.exports = { app, server, io };
