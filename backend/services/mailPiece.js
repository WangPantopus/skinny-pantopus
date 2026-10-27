/**
 * What the apps read about a piece of mail (Mail tab, SRV-2): what object it is (`kind`), whether Pantopus sent it,
 * its postmark, whether it waits on the Counter, and the "Pantopus read this for you" note (`summary`). Every list,
 * search row and detail route answers pieces through present(), so the three apps draw the same piece the same way.
 */
const { localDate, FALLBACK_TIME_ZONE } = require('./mailDelivery');

const KINDS = ['letter', 'bill', 'notice', 'postcard', 'booklet', 'parcel', 'bundle'];

// mail_extracted keys only the server writes: the kept note, Pantopus's mark, the postmark town and the private
// enclosures. A sender's own extractedData never sets them (the send route strips them).
const SERVER_EXTRACTED_KEYS = ['summary', 'summary_source', 'summary_at', 'ai_summary', 'from_pantopus', 'postmark_town',
  'enclosures', 'pantopus_letter', 'invoice_bill', 'vacation_hold_id', 'natural_delivered_at', 'vacation_bundle_hold_id'];

/** A sender's extractedData without the keys only the server writes. */
function withoutServerKeys(extracted) {
  if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) return extracted;
  return Object.fromEntries(Object.entries(extracted).filter(([key]) => !SERVER_EXTRACTED_KEYS.includes(key)));
}

/**
 * The object a piece is drawn as, from the stored type fields: its physical object first (bundle, parcel, booklet,
 * postcard), then what it says (a bill, from an invoice or a statement; a notice), else a letter. Promotions and ads
 * are postcards. Certified mail is drawn as what it is (certified signing stays with mail_extras).
 */
function kindOf(mail) {
  const object = mail?.mail_object_type;
  const type = mail?.type;
  const mailType = mail?.mail_type;
  if (object === 'bundle') return 'bundle';
  if (object === 'package' || type === 'package') return 'parcel';
  if (object === 'booklet' || type === 'newsletter' || mailType === 'book') return 'booklet';
  if (object === 'postcard' || type === 'ad' || type === 'promotion' || mailType === 'promotion') return 'postcard';
  if (mail?.invoice_id || type === 'bill' || type === 'statement' || mailType === 'bill') return 'bill';
  if (type === 'notice' || mailType === 'notice') return 'notice';
  return 'letter';
}

/** Sent by Pantopus itself (services/pantopusLetters marks them); a person or business can never set this. */
function fromPantopus(mail) {
  return mail?.mail_extracted?.from_pantopus === true && !mail.sender_user_id && !mail.sender_entity_id;
}

// "PO Box 1201, Vancouver, WA 98668" → "Vancouver". A writer may name the town itself (mail_extracted.postmark_town).
function postmarkTown(mail) {
  const named = mail?.mail_extracted?.postmark_town;
  if (typeof named === 'string' && named.trim()) return named.trim().slice(0, 80);
  const match = /,\s*([^,]+?),\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/.exec(String(mail?.sender_address || ''));
  return match ? match[1].trim().slice(0, 80) : null;
}

/** On the Counter: waiting in the box (delivered or opened, not archived) and due, or put there by someone. */
function onCounter(mail) {
  if (!['delivered', 'opened'].includes(mail?.lifecycle || 'delivered')) return false;
  if (mail.archived || mail.deleted_at) return false;
  return mail.action_required === true || Boolean(mail.due_date);
}

/** Key facts as { label, value } pairs, whichever way they were stored ({ field, value } from the summarizer). */
function keyFacts(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((fact) => ({
    label: String(fact?.label ?? fact?.field ?? '').trim(),
    value: String(fact?.value ?? '').trim(),
  })).filter((fact) => fact.label && fact.value).slice(0, 8);
}

/** "Pantopus read this for you": the stored note, or null (the apps then draw no note). */
function summaryOf(mail) {
  const text = mail?.mail_extracted?.summary;
  if (typeof text !== 'string' || !text.trim()) return null;
  return { text: text.trim(), key_facts: keyFacts(mail.key_facts) };
}

/**
 * The piece with the fields the apps read added. `timeZone` is the viewer's mailbox zone (the postmark's date).
 * Existing fields are kept as they are, so older app builds read the same piece.
 */
function present(mail, { timeZone = FALLBACK_TIME_ZONE } = {}) {
  if (!mail) return mail;
  const posted = mail.created_at || mail.delivered_at;
  return {
    ...mail,
    kind: kindOf(mail),
    from_pantopus: fromPantopus(mail),
    postmark: { town: postmarkTown(mail), date: posted ? localDate(new Date(posted), timeZone) : null },
    on_counter: onCounter(mail),
    summary: summaryOf(mail),
  };
}

module.exports = { KINDS, SERVER_EXTRACTED_KEYS, withoutServerKeys, kindOf, fromPantopus, postmarkTown, onCounter, keyFacts,
  summaryOf, present };
