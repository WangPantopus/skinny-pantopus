#!/usr/bin/env node

/**
 * What mail cost and what it got, per printer and flow: cards, returns, redemptions,
 * cards per verified household and cost per verified household.
 *
 * Usage, with the same environment as the backend it reports on:
 *   node backend/scripts/mail-report.js [--since 2026-11-01] [--until 2026-12-01]
 *
 * Reads only, and prints counts only: no addresses, people or printer payloads. Cost
 * uses each printer's price per card: MAIL_CARD_PRICE_<PRINTER> overrides the
 * published price below. Printers' results are kept private: Lob's terms treat
 * information about its performance as confidential, so this output stays out of Git
 * and anywhere public.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const supabaseAdmin = require('../config/supabaseAdmin');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const SINCE = opt('--since') || '2000-01-01';
const UNTIL = opt('--until') || '2100-01-01';
// Published 4x6 First-Class prices on the plans with no monthly fee, November 2026.
const PRICES = { lob: 0.905, postgrid: 0.902, mock: 0 };
const priceOf = (printer) => Number(process.env[`MAIL_CARD_PRICE_${String(printer).toUpperCase()}`] ?? PRICES[printer] ?? 0);

async function all(table, columns, dateColumn) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from(table).select(columns)
      .gte(dateColumn, SINCE).lt(dateColumn, UNTIL).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function emptyRow() {
  return { requested: 0, accepted: 0, unresolved: 0, refused: 0, delivered: 0, returned: 0, rerouted: 0, failed: 0, canceled: 0,
    redeemed: 0, households: new Set(), days: [] };
}

(async () => {
  const [cards, jobs, attempts, invites, events] = await Promise.all([
    all('HomePostcardCode', 'id, home_id, status, dispatch_status, vendor_job_id, mail_provider, mail_outcome, requested_at', 'requested_at'),
    all('MailVerificationJob', 'id, attempt_id, vendor, vendor_status, vendor_job_id, created_at', 'created_at'),
    all('AddressVerificationAttempt', 'id, address_id, status', 'created_at'),
    all('BlockInvite', 'id, dispatch_status, lob_id, mail_provider, mail_outcome, created_at', 'created_at'),
    all('LobWebhookEvent', 'id, postcard_id, normalized_status, occurred_at, received_at', 'received_at'),
  ]);

  const deliveredAt = new Map();
  for (const event of events) {
    if (event.normalized_status === 'delivered') deliveredAt.set(event.postcard_id, event.occurred_at || event.received_at);
  }
  const report = new Map();
  const rowFor = (printer, flow) => {
    const key = `${printer || 'unknown'}|${flow}`;
    if (!report.has(key)) report.set(key, emptyRow());
    return report.get(key);
  };
  const addPiece = (row, { vendorJobId, unresolved, refused, outcome, requestedAt }) => {
    row.requested += 1;
    if (vendorJobId) row.accepted += 1;
    if (unresolved) row.unresolved += 1;
    if (refused) row.refused += 1;
    if (outcome) row[outcome] += 1;
    const delivered = vendorJobId && deliveredAt.get(vendorJobId);
    if (delivered) {
      row.delivered += 1;
      row.days.push((Date.parse(delivered) - Date.parse(requestedAt)) / 86400000);
    }
  };

  for (const card of cards) {
    const row = rowFor(card.mail_provider || (card.vendor_job_id ? 'lob' : null), 'home_postcard');
    addPiece(row, { vendorJobId: card.vendor_job_id, requestedAt: card.requested_at, outcome: card.mail_outcome,
      refused: card.dispatch_status === 'rejected', unresolved: ['dispatching', 'delivery_unknown'].includes(card.dispatch_status) && card.status === 'pending' });
    if (card.status === 'verified') { row.redeemed += 1; row.households.add(card.home_id); }
  }
  const attemptById = new Map(attempts.map((attempt) => [attempt.id, attempt]));
  const ended = { returned: 'returned', rerouted: 'rerouted', failed: 'failed', canceled: 'canceled' };
  for (const job of jobs) {
    const row = rowFor(job.vendor, 'address_verification');
    addPiece(row, { vendorJobId: job.vendor_job_id, requestedAt: job.created_at, outcome: ended[job.vendor_status],
      refused: job.vendor_status === 'rejected', unresolved: ['dispatching', 'delivery_unknown'].includes(job.vendor_status) });
    const attempt = attemptById.get(job.attempt_id);
    if (attempt?.status === 'verified' && !row.households.has(attempt.address_id)) { row.redeemed += 1; row.households.add(attempt.address_id); }
  }
  for (const invite of invites) {
    const row = rowFor(invite.mail_provider || (invite.lob_id ? 'lob' : null), 'block_founders');
    addPiece(row, { vendorJobId: invite.lob_id, requestedAt: invite.created_at, outcome: invite.mail_outcome,
      unresolved: !invite.lob_id && ['dispatching', 'delivery_unknown'].includes(invite.dispatch_status) });
  }

  console.log(`Mail report ${SINCE} to ${UNTIL}. Keep this output out of Git and anywhere public.\n`);
  const columns = ['printer', 'flow', 'requested', 'accepted', 'unresolved', 'refused', 'delivered', 'days to delivery', 'returned', 're-routed', 'failed',
    'canceled', 'redeemed', 'verified households', 'cards per verified household', 'cost', 'cost per verified household'];
  const lines = [columns];
  for (const [key, row] of [...report.entries()].sort()) {
    const [printer, flow] = key.split('|');
    const cost = row.accepted * priceOf(printer);
    const households = row.households.size;
    const days = median(row.days);
    lines.push([printer, flow, row.requested, row.accepted, row.unresolved, row.refused, row.delivered, days === null ? '-' : days.toFixed(1),
      row.returned, row.rerouted, row.failed, row.canceled, row.redeemed, flow === 'block_founders' ? '-' : households,
      flow !== 'block_founders' && households ? (row.accepted / households).toFixed(2) : '-', `$${cost.toFixed(2)}`,
      flow !== 'block_founders' && households ? `$${(cost / households).toFixed(2)}` : '-']);
  }
  for (const line of lines) console.log(`| ${line.join(' | ')} |`);
  if (lines.length === 1) console.log('No mail in this period.');
  process.exit(0);
})().catch((err) => { console.error(`mail-report: ${err.message}`); process.exit(1); });
