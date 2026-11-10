/**
 * "Report this card" (memories contract section 9; the founder's choice of November 2): a report of the person who sent
 * a card that also shares that one card, and only that card, with Pantopus admins for review. The reporter's sheet says
 * so ("Pantopus will be able to see this card to review it.").
 *
 * The report is an ordinary UserReport row (reason and details), one per card and reporter, so each card waits in the
 * Reports queue on its own. UserReport has no column for a card, so the link lives in the card's server-written data:
 * `mail_extracted.reports` [{ report_id, at }], never presented to anyone (mailPiece.present strips it). An admin opens a
 * card only through a report it carries, and each opening is written to MailEvent (admin_opened_reported_card).
 */
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const holidayCards = require('./holidayCards');
const cardMedia = require('./holidayCardMedia');
const mailObjects = require('./mailObjectStorage');
const { loadChatPeople } = require('./chatPeople');
const { canAccessMail } = require('../utils/homeMailAccess');
const logger = require('../utils/logger');

const MAIL_SELECT = 'id, sender_user_id, recipient_user_id, recipient_home_id, deleted_at, delivered_at, created_at, object_id, mail_extracted';

/** What a report shares: a card, or (later) a reply to one. Null for other mail. */
function sharedKind(mail) {
  if (holidayCards.isCard(mail)) return 'card';
  if (mail?.mail_extracted?.card_reply?.card_id) return 'reply';
  return null;
}

/** The report row's id for this card and reporter, as a UUID: the same report again finds the same row. */
function cardReportId(reportedId, reporterId, mailId) {
  const hex = crypto.createHash('sha256')
    .update(`pantopus:user-report:card:v1:${String(reportedId).toLowerCase()}:${String(reporterId).toLowerCase()}:${String(mailId).toLowerCase()}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const notReportable = () => Object.assign(new Error('This card isn’t here any more.'), { status: 404, code: 'CARD_NOT_FOUND' });

/**
 * Files a report of `reportedId` that shares card `mailId` with admins. The card must be one the reporter received,
 * delivered and open, from that person. Answers { reportId, created } (created false when this card was already
 * reported by them). Throws { status, code } refusals, or an error when it can't be stored (nothing half-done is shown:
 * the card's link is written first, and a retry finds the same row).
 */
async function reportCard({ reporterId, reportedId, mailId, reason, details }) {
  const { data: mail, error } = await supabaseAdmin.from('Mail').select(MAIL_SELECT).eq('id', mailId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!mail || !sharedKind(mail) || String(mail.recipient_user_id) !== String(reporterId)
    || String(mail.sender_user_id) !== String(reportedId) || !(await canAccessMail(mail, reporterId))
    || holidayCards.isSealed(mail) || await cardMedia.blockedBeforeDelivery(mail)) {
    throw notReportable();
  }
  const reportId = cardReportId(reportedId, reporterId, mail.id);
  const reports = Array.isArray(mail.mail_extracted?.reports) ? mail.mail_extracted.reports : [];
  if (!reports.some((r) => r?.report_id === reportId)) {
    const { error: linkError } = await supabaseAdmin.from('Mail')
      .update({ mail_extracted: { ...mail.mail_extracted, reports: [...reports, { report_id: reportId, at: new Date().toISOString() }] } })
      .eq('id', mail.id);
    if (linkError) throw new Error(linkError.message);
  }
  const { data: inserted, error: insertError } = await supabaseAdmin.from('UserReport').upsert({
    id: reportId, reported_user_id: reportedId, reported_by: reporterId, reason, details: details || null,
  }, { onConflict: 'id', ignoreDuplicates: true }).select('id');
  if (insertError) throw new Error(insertError.message);
  return { reportId, created: Boolean(inserted?.length), kind: sharedKind(mail) };
}

/** For a page of user reports: which share a card, as Map(report id -> { kind }). Never fails the queue. */
async function sharedCards(reportRows) {
  const shared = new Map();
  const ids = new Set(reportRows.map((r) => r.id));
  const authors = [...new Set(reportRows.map((r) => r.reported_user_id).filter(Boolean))];
  if (!authors.length) return shared;
  try {
    const { data, error } = await supabaseAdmin.from('Mail').select('id, mail_extracted')
      .in('sender_user_id', authors).not('mail_extracted->reports', 'is', null);
    if (error) throw new Error(error.message);
    for (const mail of data || []) {
      for (const r of mail.mail_extracted?.reports || []) {
        if (ids.has(r?.report_id)) shared.set(r.report_id, { kind: sharedKind(mail) || 'card' });
      }
    }
  } catch (err) {
    logger.warn('Admin reports: shared cards not read', { error: err.message });
  }
  return shared;
}

/** The report and the one piece it shares ({ report, mail }), or null. */
async function reportedPiece(reportId) {
  const { data: report, error } = await supabaseAdmin.from('UserReport')
    .select('id, reported_user_id, reported_by, reason, details, status, created_at').eq('id', reportId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!report) return null;
  const { data: rows, error: mailError } = await supabaseAdmin.from('Mail').select(MAIL_SELECT)
    .eq('sender_user_id', report.reported_user_id)
    .contains('mail_extracted', { reports: [{ report_id: reportId }] })
    .limit(1);
  if (mailError) throw new Error(mailError.message);
  const mail = rows?.[0];
  if (!mail || !sharedKind(mail)) return null;
  return { report, mail };
}

/** Writes one admin opening of a reported card to MailEvent. Throws when it can't: an unlogged opening never happens. */
async function logOpening({ adminId, reportId, mailId }) {
  const { error } = await supabaseAdmin.from('MailEvent').insert({
    event_type: 'admin_opened_reported_card', mail_id: mailId, user_id: adminId,
    metadata: { admin_id: adminId, report_id: reportId },
  });
  if (error) throw new Error(error.message);
}

/**
 * The card as the reviewer sees it (contract section 5's Page): the picture, the note, the signature, the photo and
 * voice (never covered), both names and its dates. Its media open through the admin media route.
 */
async function reviewPage(mail) {
  const { payload } = mail.object_id ? await mailObjects.readPayload(mail.object_id) : { payload: null };
  const people = await loadChatPeople([mail.sender_user_id, mail.recipient_user_id].filter(Boolean));
  const name = (id) => people.get(String(id))?.displayName || null;
  const card = holidayCards.cardView({ ...mail, card_signature: holidayCards.signatureOf(payload),
    card_media: holidayCards.mediaOf(payload), card_photo_covered: false });
  return {
    id: mail.id,
    kind: sharedKind(mail),
    from_name: name(mail.sender_user_id),
    to_name: name(mail.recipient_user_id),
    sent_on: mail.created_at || null,
    delivered_on: mail.delivered_at || null,
    card,
    note: typeof payload?.body?.content === 'string' ? payload.body.content : '',
  };
}

module.exports = { sharedKind, cardReportId, reportCard, sharedCards, reportedPiece, logOpening, reviewPage };
