/**
 * Home Health Score Service
 *
 * Computes a 0–100 health score for a home by evaluating six dimensions:
 * maintenance, bills, seasonal tasks, emergency preparedness, household
 * completeness, and documents. All dimension queries run in parallel.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { getSeasonalContext } = require('./ai/seasonalEngine');

// ── Dimension weights ────────────────────────────────────────────────────────

const DIMENSIONS = {
  maintenance: 25,
  bills: 20,
  seasonal: 20,
  emergency: 15,
  household: 10,
  documents: 10,
};

// ── Dimension scorers ────────────────────────────────────────────────────────
// Each returns { score, issues } where issues is an array of human-readable strings.

function scoreMaintenance(issues) {
  const openStatuses = ['open', 'in_progress', 'scheduled'];
  const openIssues = (issues || []).filter(i => openStatuses.includes(i.status));
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const overdueIssues = openIssues.filter(i => new Date(i.created_at) < thirtyDaysAgo);

  if (openIssues.length >= 5) {
    return { score: 0, issues: [`${openIssues.length} open maintenance issues`] };
  }
  if (openIssues.length >= 3 || overdueIssues.length > 0) {
    const msgs = [];
    if (overdueIssues.length > 0) msgs.push(`${overdueIssues.length} issue${overdueIssues.length > 1 ? 's' : ''} open for 30+ days`);
    if (openIssues.length >= 3) msgs.push(`${openIssues.length} open issues`);
    return { score: 5, issues: msgs };
  }
  if (openIssues.length > 0) {
    return { score: 15, issues: [`${openIssues.length} open maintenance issue${openIssues.length > 1 ? 's' : ''}`] };
  }
  return { score: 25, issues: [] };
}

function scoreBills(bills) {
  const now = new Date();
  const overdueBills = (bills || []).filter(b => b.status === 'due' && b.due_date && new Date(b.due_date) < now);

  if (overdueBills.length >= 2) {
    return { score: 0, issues: [`${overdueBills.length} overdue bills`] };
  }
  if (overdueBills.length === 1) {
    const bill = overdueBills[0];
    const label = bill.provider_name || bill.bill_type || 'bill';
    return { score: 10, issues: [`${label} bill is overdue`] };
  }
  return { score: 20, issues: [] };
}

function scoreSeasonal(checklistItems) {
  const items = checklistItems || [];
  if (items.length === 0) {
    return { score: 0, issues: ['No seasonal checklist created yet'] };
  }

  const completed = items.filter(i => i.status === 'completed' || i.status === 'skipped' || i.status === 'hired');
  const ratio = completed.length / items.length;

  if (ratio === 1) {
    return { score: 20, issues: [] };
  }
  if (ratio > 0.5) {
    const remaining = items.length - completed.length;
    return { score: 15, issues: [`${remaining} seasonal task${remaining > 1 ? 's' : ''} remaining`] };
  }
  const remaining = items.length - completed.length;
  return { score: 5, issues: [`${remaining} of ${items.length} seasonal tasks incomplete`] };
}

function scoreEmergency(contacts) {
  const count = (contacts || []).length;
  if (count >= 2) return { score: 15, issues: [] };
  if (count === 1) return { score: 8, issues: ['Only 1 emergency contact — add a second'] };
  return { score: 0, issues: ['No emergency contacts set'] };
}

function scoreHousehold(members) {
  const memberList = members || [];
  if (memberList.length <= 1) {
    return { score: 5, issues: [] };
  }
  const withPicture = memberList.filter(m => m.user?.profile_picture_url);
  if (withPicture.length > 0) {
    return { score: 10, issues: [] };
  }
  return { score: 5, issues: ['No household members have profile pictures'] };
}

function scoreDocuments(count) {
  if (count >= 3) return { score: 10, issues: [] };
  if (count >= 1) return { score: 5, issues: ['Upload more home documents (lease, insurance, etc.)'] };
  return { score: 0, issues: ['No home documents uploaded'] };
}

// ── In-memory health score cache (5-minute TTL) ─────────────────────────────

const HEALTH_CACHE_TTL = 5 * 60 * 1000;
const healthScoreCache = new Map(); // homeId → { data, ts }

function getCachedHealthScore(homeId) {
  const entry = healthScoreCache.get(homeId);
  if (entry && Date.now() - entry.ts < HEALTH_CACHE_TTL) return entry.data;
  return null;
}

function setCachedHealthScore(homeId, data) {
  healthScoreCache.set(homeId, { data, ts: Date.now() });
}

function invalidateHealthScoreCache(homeId) {
  healthScoreCache.delete(homeId);
}

// ── Route mapping for topAction ──────────────────────────────────────────────

const DIMENSION_ROUTES = {
  maintenance: { type: 'navigate', label: 'View maintenance', route: '/homes/{id}/maintenance' },
  bills:       { type: 'navigate', label: 'View bills',       route: '/homes/{id}/bills' },
  seasonal:    { type: 'navigate', label: 'View checklist',   route: '/homes/{id}/dashboard' },
  emergency:   { type: 'navigate', label: 'Add contact',      route: '/homes/{id}/emergency' },
  household:   { type: 'navigate', label: 'Invite members',   route: '/homes/{id}/members' },
  documents:   { type: 'navigate', label: 'Upload document',  route: '/homes/{id}/documents' },
};

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Compute the Home Health Score for a given home.
 *
 * @param {string} homeId  UUID of the Home
 * @returns {Promise<{ score, breakdown, topIssue, topAction }>}
 */
async function computeHealthScore(homeId) {
  const start = Date.now();

  // Determine current season for checklist query
  const seasonalCtx = getSeasonalContext();
  const currentYear = new Date().getFullYear();
  const seasonKey = seasonalCtx.primary_season;

  // Fire all 6 queries in parallel
  const [
    issuesRes,
    billsRes,
    checklistRes,
    emergencyRes,
    membersRes,
    documentsRes,
  ] = await Promise.allSettled([
    // 1. Maintenance issues (open statuses)
    supabaseAdmin
      .from('HomeIssue')
      .select('id, status, title, created_at')
      .eq('home_id', homeId)
      .in('status', ['open', 'in_progress', 'scheduled']),

    // 2. Bills with status 'due'
    supabaseAdmin
      .from('HomeBill')
      .select('id, bill_type, provider_name, due_date, status')
      .eq('home_id', homeId)
      .eq('status', 'due'),

    // 3. Seasonal checklist items for current season/year
    supabaseAdmin
      .from('HomeSeasonalChecklistItem')
      .select('id, status, title')
      .eq('home_id', homeId)
      .eq('season_key', seasonKey)
      .eq('year', currentYear),

    // 4. Emergency contacts
    supabaseAdmin
      .from('HomeEmergency')
      .select('id')
      .eq('home_id', homeId),

    // 5. Active household members (with user profile pic)
    supabaseAdmin
      .from('HomeOccupancy')
      .select('user_id, user:user_id ( id, profile_picture_url )')
      .eq('home_id', homeId)
      .eq('is_active', true),

    // 6. Document count
    supabaseAdmin
      .from('HomeDocument')
      .select('id', { count: 'exact', head: true })
      .eq('home_id', homeId),
  ]);

  // Extract results (gracefully handle failures)
  const extract = (r) => (r.status === 'fulfilled' ? r.value : null);
  const extractData = (r) => extract(r)?.data || [];
  const extractCount = (r) => extract(r)?.count ?? 0;

  // Score each dimension
  const maintenance = scoreMaintenance(extractData(issuesRes));
  const bills = scoreBills(extractData(billsRes));
  const seasonal = scoreSeasonal(extractData(checklistRes));
  const emergency = scoreEmergency(extractData(emergencyRes));
  const household = scoreHousehold(extractData(membersRes));
  const documents = scoreDocuments(extractCount(documentsRes));

  const breakdown = {
    maintenance: { score: maintenance.score, max: DIMENSIONS.maintenance, issues: maintenance.issues },
    bills:       { score: bills.score,       max: DIMENSIONS.bills,       issues: bills.issues },
    seasonal:    { score: seasonal.score,    max: DIMENSIONS.seasonal,    issues: seasonal.issues },
    emergency:   { score: emergency.score,   max: DIMENSIONS.emergency,   issues: emergency.issues },
    household:   { score: household.score,   max: DIMENSIONS.household,   issues: household.issues },
    documents:   { score: documents.score,   max: DIMENSIONS.documents,   issues: documents.issues },
  };

  const score = Object.values(breakdown).reduce((sum, d) => sum + d.score, 0);

  // Find topIssue: first issue from the dimension with the worst score-to-max ratio
  let topIssue = null;
  let topAction = null;
  let worstRatio = 1;

  for (const [key, dim] of Object.entries(breakdown)) {
    if (dim.issues.length > 0) {
      const ratio = dim.score / dim.max;
      if (ratio < worstRatio) {
        worstRatio = ratio;
        topIssue = dim.issues[0];
        const routeTemplate = DIMENSION_ROUTES[key];
        topAction = {
          type: routeTemplate.type,
          label: routeTemplate.label,
          route: routeTemplate.route.replace('{id}', homeId),
        };
      }
    }
  }

  const durationMs = Date.now() - start;
  logger.info('Home health score computed', { homeId, score, durationMs });

  return { score, breakdown, topIssue, topAction };
}

/**
 * Get health score with caching. Use force=true to bypass cache.
 */
async function getHealthScore(homeId, { force = false } = {}) {
  if (!force) {
    const cached = getCachedHealthScore(homeId);
    if (cached) return cached;
  }
  const result = await computeHealthScore(homeId);
  setCachedHealthScore(homeId, result);
  return result;
}

module.exports = { computeHealthScore, getHealthScore, invalidateHealthScoreCache };
