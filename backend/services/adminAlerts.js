// ============================================================
// ADMIN ALERTS — "usually within hours" is a promise a person has to
// be able to keep. When a residency (or ownership) claim lands, the
// founder/admin inbox gets one email with a link to the review queue.
//
// Delivery is best-effort and never affects the request: no address in
// the subject, no document contents in the body — the queue has those.
// Configure ADMIN_ALERT_EMAIL (comma-separated) to enable; unset = no-op.
// ============================================================

const emailService = require('./emailService');
const logger = require('../utils/logger');

function recipients() {
  return String(process.env.ADMIN_ALERT_EMAIL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function queueUrl() {
  const base = String(process.env.WEB_APP_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  return `${base}/app/admin/review-claims`;
}

/**
 * @param {object} params
 * @param {object} params.claim   The HomeOwnershipClaim row (id, claim_type, method, created_at).
 * @param {object} params.home    The Home row (city, state) — city only is printed.
 * @param {string} params.claimantUserId
 * @returns {Promise<boolean>} true when an email was handed to the mailer.
 */
async function notifyClaimToReview({ claim, home, claimantUserId }) {
  const to = recipients();
  if (!to.length || !claim) return false;

  const kind = claim.claim_type === 'resident' ? 'Residency' : 'Ownership';
  const where = [home && home.city, home && home.state].filter(Boolean).join(', ') || 'unknown area';
  const subject = `[Pantopus] ${kind} claim to review · ${where}`;
  const text = [
    `A ${kind.toLowerCase()} claim is waiting for review.`,
    '',
    `Claim: ${claim.id}`,
    `Method: ${claim.method || 'doc_upload'}`,
    `Area: ${where}`,
    `Claimant: ${claimantUserId}`,
    `Submitted: ${claim.created_at || new Date().toISOString()}`,
    '',
    `Review it: ${queueUrl()}`,
    '',
    'The promise on the door is "usually within hours".',
  ].join('\n');
  const html = `<p>A <strong>${kind.toLowerCase()}</strong> claim is waiting for review.</p>
<ul>
  <li>Claim: <code>${claim.id}</code></li>
  <li>Method: ${claim.method || 'doc_upload'}</li>
  <li>Area: ${where}</li>
  <li>Claimant: <code>${claimantUserId}</code></li>
  <li>Submitted: ${claim.created_at || new Date().toISOString()}</li>
</ul>
<p><a href="${queueUrl()}">Open the review queue</a></p>
<p>The promise on the door is “usually within hours”.</p>`;

  try {
    await emailService.sendEmail({ to: to.join(','), subject, text, html });
    return true;
  } catch (err) {
    logger.warn('adminAlerts: claim-to-review email failed (non-fatal)', { claimId: claim.id, error: err.message });
    return false;
  }
}

const REPORTED = { user: 'person', post: 'post', reply: 'reply', gig: 'task', message: 'neighbor message' };
const REASONS = new Set(['spam', 'harassment', 'inappropriate', 'misinformation', 'safety', 'other']);

function reportsQueueUrl() {
  const base = String(process.env.WEB_APP_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  return `${base}/app/admin/reports`;
}

/**
 * People who report someone, a post, a task or a neighbor message are told their report will be reviewed.
 * One email per new report with a link to the report queue. It carries only the kind, the reason category and
 * the report id: never the reporter, the reported person, the free-text details or the reported content.
 *
 * @param {object} params
 * @param {'user'|'post'|'gig'|'message'} params.kind
 * @param {string} [params.reason]   A report reason category; anything else (free text) is left out.
 * @param {string} [params.reportId] The report row id (for a neighbor message, the flagged message id).
 * @returns {Promise<boolean>} true when an email was handed to the mailer.
 */
async function notifyReportToReview({ kind, reason, reportId }) {
  const to = recipients();
  if (!to.length || !REPORTED[kind]) return false;

  const what = REPORTED[kind];
  const why = REASONS.has(reason) ? reason : null;
  const subject = `[Pantopus] Report to review · ${what}${why ? ` · ${why}` : ''}`;
  const text = [
    `A ${what} was reported${why ? ` for ${why}` : ''}.`,
    '',
    `Report: ${reportId || 'n/a'}`,
    `Review it: ${reportsQueueUrl()}`,
  ].join('\n');
  const html = `<p>A <strong>${what}</strong> was reported${why ? ` for <strong>${why}</strong>` : ''}.</p>
<ul><li>Report: <code>${reportId || 'n/a'}</code></li></ul>
<p><a href="${reportsQueueUrl()}">Open the report queue</a></p>`;

  try {
    await emailService.sendEmail({ to: to.join(','), subject, text, html });
    return true;
  } catch (err) {
    logger.warn('adminAlerts: report-to-review email failed (non-fatal)', { kind, reportId, error: err.message });
    return false;
  }
}

/**
 * A household removal vote passed, but the member it was about proved the address and contested it, so an
 * AddressReviewCase (trigger removal_vote) waits for Pantopus and the member keeps access until it's decided
 * (homeRemovalVoteService). One email per case with the case id and how to decide it; never names or the address.
 * No admin screen lists these cases yet, so the email says which API calls do.
 *
 * @param {object} params
 * @param {string} params.caseId
 * @param {object} [params.home] The Home row (city, state): city only is printed.
 * @returns {Promise<boolean>} true when an email was handed to the mailer.
 */
async function notifyRemovalVoteToReview({ caseId, home }) {
  const to = recipients();
  if (!to.length || !caseId) return false;

  const where = [home && home.city, home && home.state].filter(Boolean).join(', ') || 'unknown area';
  const subject = `[Pantopus] Contested household vote to review · ${where}`;
  const resolve = `POST /api/admin/address-review/${caseId}/resolve`;
  const text = [
    'A household voted to remove a member who proved the address and contested the vote. They keep access until it\'s decided.',
    '',
    `Case: ${caseId}`,
    `Area: ${where}`,
    '',
    `Decide it: ${resolve} with {"outcome": "approved"} to remove them, or "rejected" or "dismissed" to keep them.`,
    'Open cases: GET /api/admin/address-review/queue',
  ].join('\n');
  const html = `<p>A household voted to remove a member who <strong>proved the address and contested</strong> the vote. They keep access until it’s decided.</p>
<ul>
  <li>Case: <code>${caseId}</code></li>
  <li>Area: ${where}</li>
</ul>
<p>Decide it: <code>${resolve}</code> with <code>{"outcome": "approved"}</code> to remove them, or <code>"rejected"</code> or <code>"dismissed"</code> to keep them.</p>
<p>Open cases: <code>GET /api/admin/address-review/queue</code></p>`;

  try {
    await emailService.sendEmail({ to: to.join(','), subject, text, html });
    return true;
  } catch (err) {
    logger.warn('adminAlerts: removal-vote-to-review email failed (non-fatal)', { caseId, error: err.message });
    return false;
  }
}

module.exports = { notifyClaimToReview, notifyReportToReview, notifyRemovalVoteToReview, recipients };
