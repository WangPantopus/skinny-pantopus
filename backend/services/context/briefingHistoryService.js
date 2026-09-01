/**
 * Briefing History Service
 *
 * Reads recent daily briefing deliveries so the ranking layer can avoid
 * repeating the same fallback content day after day.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');

function parseTimestamp(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function compareBriefingRecency(a, b) {
  const dateCompare = String(b.briefing_date_local || '').localeCompare(String(a.briefing_date_local || ''));
  if (dateCompare !== 0) return dateCompare;

  const recencyDiff = (
    parseTimestamp(b.delivered_at)
    || parseTimestamp(b.created_at)
    || 0
  ) - (
    parseTimestamp(a.delivered_at)
    || parseTimestamp(a.created_at)
    || 0
  );
  if (recencyDiff !== 0) return recencyDiff;

  const kindRank = { evening: 2, morning: 1 };
  return (kindRank[b.briefing_kind] || 0) - (kindRank[a.briefing_kind] || 0);
}

async function getRecentBriefings(userId, options = {}) {
  const { limit = 7, sinceDays = 7, briefingKind = null } = options;
  const sinceLocal = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    let query = supabaseAdmin
      .from('DailyBriefingDelivery')
      .select('briefing_date_local, briefing_kind, summary_text, signals_snapshot, location_geohash, composition_mode, status, delivered_at, created_at')
      .eq('user_id', userId)
      .in('status', ['sent', 'skipped'])
      .not('summary_text', 'is', null)
      .gte('briefing_date_local', sinceLocal)
      .order('briefing_date_local', { ascending: false })
      .order('delivered_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (briefingKind) {
      query = query.eq('briefing_kind', briefingKind);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn('briefingHistoryService: query failed', { userId, error: error.message });
      return [];
    }

    return (data || [])
      .map((row) => ({
        briefing_date_local: row.briefing_date_local,
        briefing_kind: row.briefing_kind || 'morning',
        summary_text: row.summary_text || '',
        signals_snapshot: Array.isArray(row.signals_snapshot) ? row.signals_snapshot : [],
        location_geohash: row.location_geohash || null,
        composition_mode: row.composition_mode || null,
        status: row.status || null,
        delivered_at: row.delivered_at || null,
        created_at: row.created_at || null,
      }))
      .sort(compareBriefingRecency)
      .slice(0, limit);
  } catch (err) {
    logger.warn('briefingHistoryService: unexpected error', { userId, error: err.message });
    return [];
  }
}

module.exports = { getRecentBriefings };
