// ============================================================
// ALERTING SERVICE
// Sends operational alerts to Slack and/or PagerDuty.
// Used by payment jobs and ops endpoints for critical events.
//
// Configuration (env vars):
//   SLACK_ALERTS_WEBHOOK_URL   — Slack incoming webhook URL
//   PAGERDUTY_ROUTING_KEY      — PagerDuty Events API v2 routing key
//   ALERTS_ENABLED             — "true" to enable (default: enabled in production)
// ============================================================

const logger = require('../utils/logger');

const SLACK_WEBHOOK_URL = process.env.SLACK_ALERTS_WEBHOOK_URL;
const PAGERDUTY_ROUTING_KEY = process.env.PAGERDUTY_ROUTING_KEY;
const ALERTS_ENABLED = process.env.ALERTS_ENABLED !== 'false' &&
  (process.env.NODE_ENV === 'production' || process.env.ALERTS_ENABLED === 'true');

// Severity levels: critical (pages), warning (Slack only), info (Slack only)
const SEVERITY = {
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Send an alert to configured channels.
 * @param {object} opts
 * @param {string} opts.severity - 'critical' | 'warning' | 'info'
 * @param {string} opts.title - Short alert title
 * @param {string} opts.message - Detailed alert message
 * @param {object} [opts.metadata] - Additional context (paymentId, count, etc.)
 * @param {string} [opts.dedup_key] - Deduplication key for PagerDuty
 */
async function sendAlert({ severity, title, message, metadata = {}, dedup_key }) {
  if (!ALERTS_ENABLED) {
    logger.info('[alerting] Alert suppressed (ALERTS_ENABLED=false)', { severity, title });
    return;
  }

  logger.warn('[alerting] Sending alert', { severity, title, metadata });

  const promises = [];

  // Slack (all severities)
  if (SLACK_WEBHOOK_URL) {
    promises.push(sendSlackAlert({ severity, title, message, metadata }));
  }

  // PagerDuty (critical only)
  if (PAGERDUTY_ROUTING_KEY && severity === SEVERITY.CRITICAL) {
    promises.push(sendPagerDutyAlert({ title, message, metadata, dedup_key }));
  }

  // Fire and forget — don't let alerting failures break the caller
  await Promise.allSettled(promises);
}

async function sendSlackAlert({ severity, title, message, metadata }) {
  const emoji = severity === SEVERITY.CRITICAL ? ':rotating_light:'
    : severity === SEVERITY.WARNING ? ':warning:'
    : ':information_source:';

  const metaLines = Object.entries(metadata)
    .map(([k, v]) => `*${k}:* ${v}`)
    .join('\n');

  const payload = {
    text: `${emoji} *[${severity.toUpperCase()}] ${title}*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *[${severity.toUpperCase()}] ${title}*\n${message}`,
        },
      },
      ...(metaLines ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: metaLines },
      }] : []),
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `_${new Date().toISOString()} · pantopus-backend_`,
        }],
      },
    ],
  };

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.error('[alerting] Slack webhook failed', { status: res.status });
    }
  } catch (err) {
    logger.error('[alerting] Slack webhook error', { error: err.message });
  }
}

async function sendPagerDutyAlert({ title, message, metadata, dedup_key }) {
  const payload = {
    routing_key: PAGERDUTY_ROUTING_KEY,
    event_action: 'trigger',
    dedup_key: dedup_key || `pantopus-${title.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
    payload: {
      summary: `[Pantopus] ${title}: ${message}`,
      severity: 'critical',
      source: 'pantopus-backend',
      custom_details: metadata,
    },
  };

  try {
    const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.error('[alerting] PagerDuty trigger failed', { status: res.status });
    }
  } catch (err) {
    logger.error('[alerting] PagerDuty error', { error: err.message });
  }
}

module.exports = {
  sendAlert,
  SEVERITY,
};
