const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter for all write (mutating) endpoints.
 *
 * - POST / PUT / PATCH / DELETE requests only
 * - 60 requests per minute per authenticated user (keyed by user ID)
 * - 30 requests per minute per IP for unauthenticated requests
 *
 * Per-route limiters (auth, uploads, connection requests) are stricter
 * and take precedence — express-rate-limit uses the most restrictive
 * applicable limiter when multiple apply.
 */
const globalWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: (req) => (req.user ? 60 : 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Too many requests. Please try again shortly.' },
});

/**
 * Stricter limiter for sensitive financial/payment endpoints.
 * 10 write requests per minute per user.
 * Read-only requests are skipped.
 */
const financialWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Too many payment requests. Please try again shortly.' },
});

/**
 * Limiter for content creation (posts, comments, listings, reviews).
 * 20 requests per minute per user. GET/HEAD/OPTIONS (reads) are not counted.
 */
const contentCreationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Too many submissions. Please slow down.' },
});

/**
 * Limiter for home creation.
 * 5 homes per hour per user — prevents spam home creation.
 */
const homeCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  // Count ONLY the actual home-creation request. This limiter is mounted on
  // ALL of /api/homes, and the old blocklist-style skip ('/check-address',
  // then '/:homeId/scheduling/**' when Calendarly hit it) meant every NEW
  // home-scoped POST silently burned the 5-per-hour home-CREATION budget —
  // the Wave 1 claim/fridge-card issue AND revoke endpoints 429'd behind
  // their own dedicated limiters, locking a manager out of revoking a
  // leaked card. Home creation is exactly `POST /api/homes` (path '/' at
  // this mount); everything deeper carries its own limiter.
  skip: (req) => req.method !== 'POST' || (req.path !== '/' && req.path !== ''),
  message: { error: 'Too many home creation requests. Please try again later.' },
});

/**
 * Limiter for home-scoped endpoints that send email or spend a vendor
 * call: invites (an email to an address the sender types) and the
 * ATTOM/OpenAI-backed property suggestions.
 *
 * These used to be covered incidentally by homeCreationLimiter, which
 * was mounted on ALL of /api/homes. Narrowing that limiter to the one
 * request it actually names (POST /api/homes) was correct — it was
 * 429ing ordinary scheduling and safety actions — but it silently took
 * the only limit off these two, leaving a verified user able to fire
 * unbounded invite emails. Named explicitly here so the coverage is
 * visible at the route rather than inherited from a mount.
 *
 * 20 per hour per user: far above real use, far below a mail blast.
 */
const homeOutboundLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method !== 'POST',
  message: { error: 'Too many requests. Please try again later.' },
});

/**
 * Limiter for ownership claims and verification endpoints.
 * 10 requests per 15 minutes per user.
 */
const ownershipClaimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many ownership claim requests. Please try again later.' },
});

/**
 * Limiter for postcard and verification code endpoints.
 * 3 requests per hour per user — prevents code-request spamming.
 */
const postcardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many verification code requests. Please try again later.' },
});

/**
 * Limiter for verification code submission (verify-postcard).
 * 10 attempts per 15 minutes per user — defense-in-depth beyond the per-code lockout.
 */
const verificationAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many verification attempts. Please try again later.' },
});

/**
 * Stricter IP-based limiter for unauthenticated endpoints.
 * 20 requests per minute per IP.
 */
const authEndpointLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many requests from this IP. Please try again shortly.' },
});

/**
 * Limiter for address validation calls (Google + Smarty are billed per call).
 * 10 requests per hour per user.
 */
/**
 * Limiter for the geocoding proxy (/api/geo).
 *
 * CST-01: these endpoints are thin proxies in front of a per-request billed
 * geocoding API. They were mounted unauthenticated and unmetered, so anyone
 * with curl could run up the bill indefinitely (denial-of-wallet).
 *
 * The meter, not authentication, is the control: /geo/autocomplete and
 * /geo/resolve carry the signed-out acquisition funnel (the public /start page
 * and both native launch screens) and cannot require a session.
 *
 * The budget is per hour. A debounced typeahead spends roughly one call per
 * two keystrokes past the 3-character minimum, so entering one address costs
 * ~5-15 calls: a flat 60 locked a signed-in user out after four or five
 * addresses, which the Add Home wizard alone can reach. Signed-in callers are
 * individually accountable and get a realistic budget; anonymous callers share
 * an IP bucket and get a tighter one.
 */
const geocodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: (req) => (req.user?.id ? 300 : 60),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many location lookups. Please try again later.' },
});

const addressValidationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many address validation requests. Please try again later.' },
});

/**
 * Limiter for address claim creation.
 * 3 claims per day per user — prevents claim spamming.
 */
const addressClaimLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many address claims. Please try again tomorrow.' },
});

/**
 * Limiter for landlord lease invite / approval endpoints.
 * 20 requests per 15 minutes per user.
 */
const landlordLeaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many lease management requests. Please try again later.' },
});

/**
 * Limiter for AI chat agent (streaming).
 * 20 requests per hour per user — LLM calls are expensive.
 */
const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'AI_RATE_LIMITED', message: 'Too many AI requests. Please try again later.' },
});

/**
 * Limiter for AI single-turn drafts (listing, post, mail summary, place brief).
 * 30 requests per hour per user.
 */
const aiDraftLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'AI_RATE_LIMITED', message: 'Too many AI requests. Please try again later.' },
});

/**
 * Limiter for public preview endpoints (gig, listing, post previews).
 * 60 requests per minute per IP — generous for crawlers / social previews,
 * but low enough to deter scraping.
 */
const previewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many preview requests. Please try again shortly.' },
});

/**
 * Limiter for Support Train organizer/helper write actions.
 * 30 requests per 5 minutes per user.
 */
const supportTrainWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Too many support train requests. Please try again shortly.' },
});

/**
 * Limiter for Support Train AI draft-from-story endpoint.
 * 10 requests per 5 minutes per user — drafting is expensive.
 */
const supportTrainDraftLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'AI_RATE_LIMITED', message: 'Too many draft requests. Please try again shortly.' },
});

/**
 * Limiter for Beacon follow/unfollow writes.
 * 15 requests per 5 minutes per user — allows normal correction while
 * slowing audience graph probing and follow-spam.
 */
const personaFollowLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many Beacon follow requests. Please try again shortly.' },
});

/**
 * Limiter for persona broadcast publishing.
 * 20 messages per 15 minutes per user — generous for real posting, tight
 * enough to prevent accidental loops or broadcast spam.
 */
const broadcastPublishLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many broadcast messages. Please try again shortly.' },
});

/**
 * Limiter for residency-letter issuance.
 * 10 letters per day per user — letters are durable artifacts; normal use
 * is a handful per year, so this only stops runaway/scripted issuance.
 */
const residencyLetterIssueLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many letters issued today. Please try again tomorrow.' },
});

/**
 * Limiter for residency-claim issuance.
 * Claims are cheap rows (no PDF) and short-lived by design, so the normal
 * pattern is a few per errand; 30/day stops scripted issuance without
 * getting in the way of a busy move week.
 */
const residencyClaimIssueLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many claims issued today. Please try again tomorrow.' },
});

/**
 * Limiter for fridge-card issuance — its own bucket, so a busy claim
 * week can never eat the card budget (or show a claims-worded 429 on
 * the card endpoint). Cards are durable household artifacts; 10/day
 * only stops runaway issuance.
 */
const fridgeCardIssueLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many cards issued today. Please try again tomorrow.' },
});

/**
 * Limiter for public (unauthenticated) Calendarly booking writes — create / reschedule / cancel
 * via /api/public/book and /api/public/booking. Tighter than the read previewLimiter and keyed
 * per-user-or-IP, since these create rows, fire payment intents, and send email. Skips reads.
 */
const bookingWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
  message: { error: 'Too many booking requests. Please try again shortly.' },
});

module.exports = {
  geocodeLimiter,
  globalWriteLimiter,
  financialWriteLimiter,
  bookingWriteLimiter,
  contentCreationLimiter,
  homeCreationLimiter,
  homeOutboundLimiter,
  ownershipClaimLimiter,
  postcardLimiter,
  verificationAttemptLimiter,
  authEndpointLimiter,
  addressValidationLimiter,
  addressClaimLimiter,
  landlordLeaseLimiter,
  aiChatLimiter,
  aiDraftLimiter,
  previewLimiter,
  supportTrainWriteLimiter,
  supportTrainDraftLimiter,
  personaFollowLimiter,
  broadcastPublishLimiter,
  residencyLetterIssueLimiter,
  residencyClaimIssueLimiter,
  fridgeCardIssueLimiter,
};
