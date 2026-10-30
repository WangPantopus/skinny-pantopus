/**
 * "Pantopus read this for you" (Mail tab, SRV-2). A piece's note is made once and kept in its existing fields:
 * mail_extracted.summary (the text, with summary_source and summary_at) and key_facts ({ label, value } pairs). Senders
 * that write their own (Pantopus letters, bills from invoices) store it when they send and never call the AI. Other
 * pieces get one made the first time a reader opens them, through the summarize service (agentService.summarizeMail,
 * which reads the piece only if that reader may), at most PER_USER_PER_HOUR per reader as the summarize route allows.
 * The open waits a few seconds for it; a slower note is still kept for the next open. A failure leaves no note.
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { summaryOf, fromPantopus, kindOf, keyFacts } = require('./mailPiece');

const OPEN_WAIT_MS = 6000;
const PER_USER_PER_HOUR = 30; // the summarize route's limit (middleware/rateLimiter aiDraftLimiter)
const MIN_TEXT = 40;
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
const inFlight = new Map();
const madeBy = new Map(); // userId -> times this hour
const failedAt = new Map(); // mailId -> when the last try failed

function eligible(mail) {
  if (!mail?.id || summaryOf(mail) || fromPantopus(mail) || kindOf(mail) === 'bundle') return false;
  // A Christmas card is a few words from a person: no note about it.
  if (mail.mail_extracted?.card) return false;
  if (mail.mail_extracted?.summary_source === 'sender') return false;
  const failed = failedAt.get(mail.id);
  if (failed && Date.now() - failed < RETRY_AFTER_FAILURE_MS) return false;
  return `${mail.subject || ''} ${mail.content || mail.preview_text || ''}`.trim().length >= MIN_TEXT;
}

function withinLimit(userId) {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const times = (madeBy.get(userId) || []).filter((t) => t > hourAgo);
  if (times.length >= PER_USER_PER_HOUR) return false;
  times.push(Date.now());
  madeBy.set(userId, times);
  if (madeBy.size > 5000) madeBy.clear();
  return true;
}

/**
 * Keep a summarizer result on the piece, unless someone kept one meanwhile. `result` is summarizeMail's
 * { summary, key_facts, recommended_actions, urgency }. Answers the piece's note ({ text, key_facts }) or null.
 */
async function storeSummary(mailId, result) {
  if (!result || result.error || typeof result.summary !== 'string' || !result.summary.trim()) return null;
  const { data: current, error } = await supabaseAdmin.from('Mail').select('mail_extracted, key_facts').eq('id', mailId).maybeSingle();
  if (error || !current) return null;
  const kept = summaryOf(current);
  if (kept) return kept;
  const facts = keyFacts(result.key_facts);
  const extracted = {
    ...(current.mail_extracted || {}),
    summary: result.summary.trim(),
    summary_source: 'pantopus',
    summary_at: new Date().toISOString(),
    // The summarize route answers this whole result again, so a second ask makes no AI call.
    ai_summary: { summary: result.summary.trim(), key_facts: result.key_facts || [],
      recommended_actions: result.recommended_actions || [], urgency: result.urgency || 'none' },
  };
  const update = { mail_extracted: extracted };
  if (!keyFacts(current.key_facts).length && facts.length) update.key_facts = facts;
  const { error: writeError } = await supabaseAdmin.from('Mail').update(update).eq('id', mailId);
  if (writeError) {
    logger.warn('Mail summary not kept', { mailId, error: writeError.message });
    return null;
  }
  return summaryOf({ mail_extracted: extracted, key_facts: update.key_facts || current.key_facts });
}

async function makeSummary(mail, userId) {
  // eslint-disable-next-line global-require
  const agentService = require('./ai/agentService');
  const result = await agentService.summarizeMail({ mailItemId: mail.id, userId });
  if (!result || result.error) {
    failedAt.set(mail.id, Date.now());
    if (failedAt.size > 5000) failedAt.clear();
    return null;
  }
  return storeSummary(mail.id, result);
}

/**
 * The piece's note for a reader who is opening it: the kept one, or one made now (waiting up to waitMs), or null.
 * The caller has already checked this reader may read the piece. Never throws.
 */
async function ensureSummary(mail, userId, { waitMs = OPEN_WAIT_MS } = {}) {
  const kept = summaryOf(mail);
  if (kept) return kept;
  if (!eligible(mail)) return null;
  let job = inFlight.get(mail.id);
  if (!job) {
    if (!withinLimit(userId)) return null;
    job = makeSummary(mail, userId)
      .catch((error) => {
        logger.warn('Mail summary failed', { mailId: mail.id, error: error.message });
        return null;
      })
      .finally(() => inFlight.delete(mail.id));
    inFlight.set(mail.id, job);
  }
  let timer;
  const waited = new Promise((resolve) => { timer = setTimeout(() => resolve(null), waitMs); });
  const note = await Promise.race([job, waited]);
  clearTimeout(timer);
  return note;
}

module.exports = { ensureSummary, storeSummary, OPEN_WAIT_MS };
