/**
 * Local Update Provider
 *
 * Pulls nearby curator-authored local updates from the last 24 hours and
 * summarizes the most useful items into a single fallback briefing fact.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const { getOpenAIClient } = require('../../config/openai');
const logger = require('../../utils/logger');

const DRAFT_MODEL = process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini';
const DEFAULT_RADIUS_METERS = 25_000;
const LOOKBACK_HOURS = 24;
const MAX_DB_ROWS = 16;
const MAX_ITEMS = 3;

function boundingBoxFromCenter(lat, lng, radiusMeters) {
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos(lat * Math.PI / 180));
  return {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lng - lngDelta,
    east: lng + lngDelta,
  };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*Source:\s*.+$/i, '')
    .trim();
}

function extractLead(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return '';
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  return sentence.length > 180 ? sentence.slice(0, 177).trimEnd() + '...' : sentence;
}

function hoursSince(iso) {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 999;
  return (Date.now() - ts) / (60 * 60 * 1000);
}

function scoreUpdate(post, briefingKind = 'morning') {
  const text = `${post.title || ''} ${post.content || ''}`.toLowerCase();
  let score = 0;

  if (/\b(closure|closed|advisory|warning|tax|city|county|school|transit|traffic|utility|power|water|road|bridge|budget|council|permit|construction|development|housing|rent|airport|fire|police|weather|storm|frost|flood)\b/.test(text)) {
    score += 3;
  }
  if (/\b(plan|proposal|report|approved|opening|delayed|shutdown|outage|detour|service|infrastructure)\b/.test(text)) {
    score += 2;
  }
  if (/\b(vs\.?|tv|streaming|coverage|box score|season opener|pregame|postgame|tickets)\b/.test(text)) {
    score -= 3;
  }
  if (/\b(moss|gutter|pressure washing|spring cleanup|roof moss|yard maintenance|smoke season|gutter season)\b/.test(text)) {
    score -= 3;
  }
  if (/\b(on this day|this day in history|anniversary)\b/.test(text)) {
    score -= 2;
  }
  if (briefingKind === 'evening') {
    if (/\b(tomorrow|tonight|overnight|morning commute|school tomorrow|opens tomorrow|closes tomorrow|service tomorrow)\b/.test(text)) {
      score += 2;
    }
    if (/\b(closure|closed|advisory|transit|traffic|school|road|bridge|utility|outage|weather|storm|frost|flood)\b/.test(text)) {
      score += 1;
    }
  }
  if (cleanText(post.content || post.title).length >= 90) {
    score += 1;
  }

  const ageHours = hoursSince(post.created_at);
  if (ageHours <= 6) score += 1.5;
  else if (ageHours <= 12) score += 1.0;
  else if (ageHours <= 24) score += 0.5;

  return score;
}

function deterministicSummary(items) {
  if (!items.length) return null;

  const leads = items
    .map((item) => extractLead(item.content || item.title))
    .filter(Boolean)
    .slice(0, 2);

  if (leads.length === 0) return null;
  if (leads.length === 1) return leads[0];

  const joined = `${leads[0]} Also nearby: ${leads[1].replace(/[.!?]+$/, '')}.`;
  return joined.length > 220 ? joined.slice(0, 217).trimEnd() + '...' : joined;
}

function validateSummary(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed || /^skip$/i.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 6 || words.length > 40) return false;
  return !/\bhttps?:\/\//i.test(trimmed);
}

async function summarizeUpdates(items, locationLabel, briefingKind = 'morning') {
  const deterministic = deterministicSummary(items);
  const openai = getOpenAIClient();
  if (!openai || items.length === 0) {
    return { summary: deterministic, tokens_used: 0 };
  }

  const bulletLines = items.map((item, index) => {
    const ageHours = Math.max(0, Math.round(hoursSince(item.created_at)));
    return `${index + 1}. ${cleanText(item.title || '')} ${cleanText(item.content || '')} (${ageHours}h ago)`;
  });

  try {
    const response = await openai.chat.completions.create({
      model: DRAFT_MODEL,
      messages: [
        {
          role: 'system',
          content: briefingKind === 'evening'
            ? 'You summarize nearby local-update posts for an evening briefing. Return one sentence under 28 words. Prefer updates that help with tomorrow morning or overnight planning. Use only concrete developments. Avoid sports schedules, evergreen home-maintenance tips, trivia, and hype. If nothing is useful, return SKIP.'
            : 'You summarize nearby local-update posts for a morning briefing. Return one sentence under 28 words. Use only concrete developments. Avoid sports schedules, evergreen home-maintenance tips, trivia, and hype. If nothing is useful, return SKIP.',
        },
        {
          role: 'user',
          content: `Area: ${locationLabel || 'nearby'}\nRecent curated updates:\n${bulletLines.join('\n')}`,
        },
      ],
      max_tokens: 80,
      temperature: 0.2,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    const tokensUsed = (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);

    if (/^skip$/i.test(text || '')) {
      return { summary: null, tokens_used: tokensUsed };
    }

    if (validateSummary(text)) {
      return { summary: text, tokens_used: tokensUsed };
    }
  } catch (err) {
    logger.warn('localUpdateProvider: AI summary failed', { error: err.message });
  }

  return { summary: deterministic, tokens_used: 0 };
}

async function getCuratorIds() {
  const { data, error } = await supabaseAdmin
    .from('User')
    .select('id')
    .eq('account_type', 'curator');

  if (error) {
    logger.warn('localUpdateProvider: curator lookup failed', { error: error.message });
    return [];
  }

  return (data || []).map((row) => row.id).filter(Boolean);
}

async function getLocalUpdateContext(options = {}) {
  const {
    latitude,
    longitude,
    locationLabel = 'nearby',
    radiusMeters = DEFAULT_RADIUS_METERS,
    lookbackHours = LOOKBACK_HOURS,
    briefingKind = 'morning',
  } = options;

  if (latitude == null || longitude == null) return null;

  const curatorIds = await getCuratorIds();
  if (!curatorIds.length) return null;

  const sinceIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
  const box = boundingBoxFromCenter(Number(latitude), Number(longitude), radiusMeters);

  try {
    const { data, error } = await supabaseAdmin
      .from('Post')
      .select('id, user_id, title, content, created_at, post_type, purpose, tags, utility_score, latitude, longitude, effective_latitude, effective_longitude, distribution_targets')
      .in('user_id', curatorIds)
      .eq('post_type', 'local_update')
      .eq('purpose', 'local_update')
      .contains('distribution_targets', ['place'])
      .is('archived_at', null)
      .gte('created_at', sinceIso)
      .or(
        `and(effective_latitude.gte.${box.south},effective_latitude.lte.${box.north},effective_longitude.gte.${box.west},effective_longitude.lte.${box.east}),` +
        `and(effective_latitude.is.null,latitude.gte.${box.south},latitude.lte.${box.north},longitude.gte.${box.west},longitude.lte.${box.east})`
      )
      .order('created_at', { ascending: false })
      .limit(MAX_DB_ROWS);

    if (error) {
      logger.warn('localUpdateProvider: post query failed', { error: error.message });
      return null;
    }

    const seenLeads = new Set();
    const candidates = (data || [])
      .map((row) => {
        const lat = row.effective_latitude ?? row.latitude;
        const lng = row.effective_longitude ?? row.longitude;
        if (lat == null || lng == null) return null;
        const distance = haversineMeters(Number(latitude), Number(longitude), Number(lat), Number(lng));
        if (!Number.isFinite(distance) || distance > radiusMeters) return null;
        const lead = extractLead(row.content || row.title);
        if (!lead) return null;
        const dedupeKey = lead.toLowerCase();
        if (seenLeads.has(dedupeKey)) return null;
        seenLeads.add(dedupeKey);
        return {
          ...row,
          distance_meters: Math.round(distance),
          lead,
          relevance_score: scoreUpdate(row, briefingKind),
        };
      })
      .filter(Boolean)
      .filter((row) => row.relevance_score >= 2)
      .sort((a, b) => {
        if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, MAX_ITEMS);

    if (!candidates.length) return null;

    const summaryResult = await summarizeUpdates(candidates, locationLabel, briefingKind);
    if (!summaryResult.summary) return null;

    return {
      summary: summaryResult.summary,
      tokens_used: summaryResult.tokens_used || 0,
      item_count: candidates.length,
      top_score: candidates[0].relevance_score,
      freshness_hours: hoursSince(candidates[0].created_at),
      post_ids: candidates.map((row) => row.id),
      titles: candidates.map((row) => cleanText(row.title || row.lead)).filter(Boolean),
      items: candidates.map((row) => ({
        id: row.id,
        title: cleanText(row.title || ''),
        lead: row.lead,
        created_at: row.created_at,
        distance_meters: row.distance_meters,
      })),
    };
  } catch (err) {
    logger.warn('localUpdateProvider: unexpected error', { error: err.message });
    return null;
  }
}

module.exports = { getLocalUpdateContext };
