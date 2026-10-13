'use strict';

/**
 * File a report on a post into the admin report queue (PostReport), the same
 * way POST /api/posts/:id/report does: one report per person per post, keyed
 * by a deterministic id so retries are no-ops, and the admin alert only for the
 * request that wrote the row. Nearby Plans uses it for "Something wasn't
 * right" and for reporting a plan, whose post the generic route can't see.
 */

const { createHash } = require('node:crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'safety', 'other'];

/**
 * @returns {Promise<{ created: boolean, reportId: string }>}
 */
async function filePostReport({ postId, userId, reason, details = null }) {
  if (!REPORT_REASONS.includes(reason)) throw new Error(`Unknown report reason: ${reason}`);
  const reportId = createHash('sha256')
    .update(`pantopus:post-report:v1:${String(postId).toLowerCase()}:${String(userId).toLowerCase()}`)
    .digest('hex').slice(0, 32);

  const { data: existing, error: readError } = await supabaseAdmin.from('PostReport')
    .select('id').eq('post_id', postId).eq('reported_by', userId).limit(1);
  if (readError) throw new Error(`Failed to read reports: ${readError.message}`);
  if (existing?.length) return { created: false, reportId: existing[0].id };

  const { data: inserted, error } = await supabaseAdmin.from('PostReport').upsert({
    id: reportId, post_id: postId, reported_by: userId, reason, details: details ? String(details).slice(0, 1000) : null,
  }, { onConflict: 'id', ignoreDuplicates: true }).select('id');
  if (error) throw new Error(`Failed to file the report: ${error.message}`);
  const created = Boolean(inserted?.length);
  if (created) {
    require('./adminAlerts').notifyReportToReview({ kind: 'post', reason, reportId })
      .catch((err) => logger.warn('postReport.alert_failed', { error: err?.message }));
  }
  return { created, reportId };
}

module.exports = { filePostReport, REPORT_REASONS };
