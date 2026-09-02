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

module.exports = { notifyClaimToReview, recipients };
