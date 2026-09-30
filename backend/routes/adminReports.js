/**
 * Admin Report Review Queue
 *
 * People who report someone, a post or a task are told "We will review it shortly". This is where a platform
 * admin sees those reports and marks each one resolved (acted on) or dismissed (no violation).
 * Mount at: app.use('/api/admin/reports', require('./routes/adminReports'));
 *
 * Endpoints:
 *   GET  /?status=pending            — Reports of people, posts, tasks and neighbor messages, newest first
 *   POST /:kind/:reportId/resolve    — { outcome: 'resolved' | 'dismissed' }
 *
 * Direct-message reports arrive as reports of the person (UserReport). A neighbor-message report is a flag on
 * the message itself (NeighborMessage.reported_at, free-text report_reason) with no review status, so it is
 * listed while pending but cannot be closed here yet.
 */

const express = require('express');
const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const { requireAdmin } = require('../middleware/verifyToken');
const logger = require('../utils/logger');

// All routes require auth + admin role
router.use(verifyToken, requireAdmin);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['pending', 'reviewed', 'resolved', 'dismissed']);
const OUTCOMES = new Set(['resolved', 'dismissed']);
const REPORT_COLUMNS = 'id, reported_by, reason, details, status, created_at, resolved_at';

// Listing reports stay out while Marketplace is not part of the launch.
const KINDS = {
  user: { table: 'UserReport', target: 'reported_user_id' },
  post: { table: 'PostReport', target: 'post_id' },
  gig: { table: 'GigReport', target: 'gig_id' },
};

const excerpt = (text) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean;
};

async function usersById(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await supabaseAdmin
    .from('User')
    .select('id, username, name, first_name')
    .in('id', unique);
  return Object.fromEntries((data || []).map((u) => [u.id, {
    id: u.id,
    username: u.username || null,
    name: u.name || u.first_name || null,
  }]));
}

async function targetsFor(kind, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  if (kind === 'post') {
    const { data } = await supabaseAdmin
      .from('Post')
      .select('id, user_id, title, content, post_type, archived_at, created_at')
      .in('id', unique);
    const authors = await usersById((data || []).map((p) => p.user_id));
    return Object.fromEntries((data || []).map((p) => [p.id, {
      id: p.id,
      title: p.title || null,
      excerpt: excerpt(p.content),
      post_type: p.post_type || null,
      archived: Boolean(p.archived_at),
      author: authors[p.user_id] || null,
    }]));
  }
  if (kind === 'gig') {
    const { data } = await supabaseAdmin
      .from('Gig')
      .select('id, user_id, title, status, created_at')
      .in('id', unique);
    const posters = await usersById((data || []).map((g) => g.user_id));
    return Object.fromEntries((data || []).map((g) => [g.id, {
      id: g.id,
      title: g.title || null,
      status: g.status || null,
      poster: posters[g.user_id] || null,
    }]));
  }
  return usersById(unique);
}


// Neighbor messages flagged by their recipient. The recipient is the reporter; the sender is reported.
async function reportedNeighborMessages(limit) {
  const { data, error, count } = await supabaseAdmin
    .from('NeighborMessage')
    .select('id, sender_user_id, recipient_user_id, category, body, report_reason, reported_at', { count: 'exact' })
    .not('reported_at', 'is', null)
    .order('reported_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`NeighborMessage: ${error.message}`);
  const rows = data || [];
  const people = await usersById(rows.flatMap((m) => [m.sender_user_id, m.recipient_user_id]));
  return {
    kind: 'message',
    count: count || 0,
    reports: rows.map((m) => ({
      kind: 'message',
      id: m.id,
      reason: 'other',
      details: m.report_reason || null,
      status: 'pending',
      created_at: m.reported_at,
      resolved_at: null,
      target_id: m.id,
      target: { id: m.id, title: m.category || null, excerpt: excerpt(m.body), author: people[m.sender_user_id] || null },
      reporter: people[m.recipient_user_id] || null,
      closable: false,
    })),
  };
}

// ============================================================
// GET / — Reports awaiting review (or in another status)
// ============================================================

router.get('/', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    if (!STATUSES.has(status)) {
      return res.status(400).json({ error: `status must be one of ${[...STATUSES].join(', ')}` });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const lists = await Promise.all(Object.entries(KINDS).map(async ([kind, { table, target }]) => {
      const { data, error, count } = await supabaseAdmin
        .from(table)
        .select(`${REPORT_COLUMNS}, ${target}`, { count: 'exact' })
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw Object.assign(new Error(`${table}: ${error.message}`), { kind });
      const rows = data || [];
      const [targets, reporters] = await Promise.all([
        targetsFor(kind, rows.map((r) => r[target])),
        usersById(rows.map((r) => r.reported_by)),
      ]);
      return {
        kind,
        count: count || 0,
        reports: rows.map((r) => ({
          kind,
          id: r.id,
          reason: r.reason,
          details: r.details || null,
          status: r.status,
          created_at: r.created_at,
          resolved_at: r.resolved_at || null,
          target_id: r[target],
          target: targets[r[target]] || null,
          reporter: reporters[r.reported_by] || null,
          closable: true,
        })),
      };
    }));

    if (status === 'pending') lists.push(await reportedNeighborMessages(limit));

    const reports = lists
      .flatMap((l) => l.reports)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit);
    const counts = Object.fromEntries(lists.map((l) => [l.kind, l.count]));

    res.json({ status, reports, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) });
  } catch (err) {
    logger.error('Admin reports list error', { error: err.message });
    res.status(500).json({ error: 'Failed to load reports' });
  }
});


// ============================================================
// POST /:kind/:reportId/resolve — Close a report
// ============================================================

router.post('/:kind/:reportId/resolve', async (req, res) => {
  try {
    const { kind, reportId } = req.params;
    if (kind === 'message') {
      return res.status(409).json({ error: 'Neighbor message reports cannot be closed here yet' });
    }
    const spec = KINDS[kind];
    if (!spec) return res.status(404).json({ error: 'Unknown report kind' });
    if (!UUID_REGEX.test(reportId)) return res.status(400).json({ error: 'Invalid report id' });
    const outcome = String((req.body && req.body.outcome) || '');
    if (!OUTCOMES.has(outcome)) {
      return res.status(400).json({ error: 'outcome must be resolved or dismissed' });
    }

    // Only an open report closes; a second click on a closed one changes nothing.
    const { data: closed, error } = await supabaseAdmin
      .from(spec.table)
      .update({ status: outcome, resolved_at: new Date().toISOString() })
      .eq('id', reportId)
      .in('status', ['pending', 'reviewed'])
      .select(REPORT_COLUMNS)
      .maybeSingle();
    if (error) {
      logger.error('Admin report resolve error', { kind, reportId, error: error.message });
      return res.status(500).json({ error: 'Failed to update the report' });
    }
    if (!closed) {
      const { data: current } = await supabaseAdmin
        .from(spec.table)
        .select('id, status, resolved_at')
        .eq('id', reportId)
        .maybeSingle();
      if (!current) return res.status(404).json({ error: 'Report not found' });
      return res.status(409).json({ error: `Report is already ${current.status}`, report: current });
    }

    logger.info('admin.report_closed', { kind, report_id: reportId, outcome, admin_id: req.user.id });
    res.json({ report: { kind, ...closed } });
  } catch (err) {
    logger.error('Admin report resolve error', { error: err.message });
    res.status(500).json({ error: 'Failed to update the report' });
  }
});

module.exports = router;
