/**
 * Christmas cards (launch key `holiday_cards`, founder decisions 2026-10-30). A person picks one of the season's
 * pictures, writes a short note on its back and chooses when it arrives; it goes to one person, found by name or, for
 * someone not on Pantopus, by email (the escrow letter path). One card a day per sender.
 *
 * A card is a letter in an envelope (type `letter`) whose card lives in `mail_extracted.card` (only the server writes
 * it) and whose note lives only in the letter's private stored copy (MailObject), never in Mail.content, so lists,
 * search, notices and older app versions never show it. A card sealed until Christmas morning keeps its note on the
 * server until then (isSealed): the routes that read a letter's stored copy give a sealed card a short note instead.
 *
 * The apps carry the pictures themselves (one per design id) and print the caption, the year and the postmark.
 */
const { DateTime } = require('luxon');
const supabaseAdmin = require('../config/supabaseAdmin');

const CARD_TAG = 'holiday_card';
const MESSAGE_LIMIT = 300;
const SUBJECT = 'A Christmas card';
const SEALED_NOTE = 'This Christmas card is sealed until Christmas morning.';

// The season: Christmas 2026. Sending closes when December 31 ends where the sender lives.
const SEASON = { holiday: 'christmas', year: 2026, tag: 'christmas_2026', closes_on: '2026-12-31' };
const MORNING_HOUR = 7;

// The 17 pictures (the founder's own, 2026-10-30), with the caption printed under each and the colour of its paper.
const DESIGNS = [
  ['Home for Christmas.', '#f7eee0'],
  ['One more run?', '#f7efe1'],
  ['Don’t open until Christmas.', '#f4eee0'],
  ['Remember making your wish list?', '#fcf5e7'],
  ['We saved you a window seat.', '#fbf2e2'],
  ['Shake it once for me.', '#f4ede2'],
  ['Remember Christmas at the mall?', '#f8f0e3'],
  ['Come finish our snowman.', '#f9f1e3'],
  ['Look outside. It’s snowing.', '#f6ede0'],
  ['One more Christmas movie.', '#f8f0e0'],
  ['We found our tree.', '#f9f3e7'],
  ['Your cocoa’s getting cold.', '#f5eee0'],
  ['A little Christmas from home.', '#f8f1e0'],
  ['Wish you were here.', '#f9f6ed'],
  ['Snowy wishes, just for you.', '#f8f0e3'],
  ['Saved you the good cookies.', '#f4efe4'],
  ['See you after Christmas.', '#fbf3e4'],
].map(([caption, paper], index) => ({
  id: `christmas-2026-${String(index + 1).padStart(2, '0')}`,
  number: index + 1,
  caption,
  paper,
}));
const DESIGN_BY_ID = new Map(DESIGNS.map((design) => [design.id, design]));

// When a card comes: with the next morning's mail, the next morning sealed until Christmas, or on Christmas morning.
// A card to someone not on Pantopus comes when they open the email (`now`), sealed until Christmas or not.
const PERSON_ARRIVALS = ['next_morning', 'sealed_christmas', 'christmas_morning'];
const EMAIL_ARRIVALS = ['now', 'sealed_christmas'];

function designById(id) {
  return DESIGN_BY_ID.get(String(id || '')) || null;
}

function isCard(mail) {
  return Boolean(mail?.mail_extracted?.card?.design);
}

/** Whether this card is still sealed: its note stays on the server until `sealed_until`. */
function isSealed(mail, now = new Date()) {
  const until = mail?.mail_extracted?.card?.sealed_until;
  return Boolean(until) && Date.parse(until) > now.getTime();
}

/** A sealed card as the letter readers return it: the short note instead of its own, and no stored copy. */
function sealedView(mail) {
  const { object_payload: _payload, object: _object, ...rest } = mail;
  return { ...rest, content: SEALED_NOTE, content_format: 'plain_text', content_text: SEALED_NOTE, attachments: [] };
}

/** 7:00 a.m. on Christmas morning in this time zone. */
function christmasMorning(timeZone) {
  return DateTime.fromObject({ year: SEASON.year, month: 12, day: 25, hour: MORNING_HOUR }, { zone: timeZone }).toJSDate();
}

/** Whether cards can still be sent from this time zone: until December 31 ends there. */
function seasonOpen(timeZone, now = new Date()) {
  const end = DateTime.fromISO(SEASON.closes_on, { zone: timeZone }).plus({ days: 1 }).startOf('day');
  return DateTime.fromJSDate(now, { zone: timeZone }) < end;
}

/** The start of today in this time zone (the daily card resets at midnight where the sender lives). */
function dayStart(timeZone, now = new Date()) {
  return DateTime.fromJSDate(now, { zone: timeZone }).startOf('day').toJSDate();
}

/** Whole days from one day to a later one, as YYYY-MM-DD ("2026-12-11" to "2026-12-25" is 14). */
function daysBetween(fromDay, toDay) {
  return Math.round(DateTime.fromISO(toDay, { zone: 'utc' }).diff(DateTime.fromISO(fromDay, { zone: 'utc' }), 'days').days);
}

/**
 * The arrivals open now. A person's: the sealed and Christmas-morning choices only while the next morning round in
 * their time zone comes before Christmas morning. An email's: sealed only before Christmas morning where the sender is.
 */
function arrivalsFor({ byEmail, timeZone, now = new Date(), nextRound }) {
  const christmas = christmasMorning(timeZone).getTime();
  if (byEmail) return now.getTime() < christmas ? EMAIL_ARRIVALS : ['now'];
  return nextRound(timeZone, now).getTime() < christmas ? PERSON_ARRIVALS : ['next_morning'];
}

/**
 * When a card to a person comes and opens, and until when the sender can take it back (the carrier's next pickup,
 * the next 7 a.m. in their time zone). Answers ISO strings; `opens_at` is null unless it's sealed.
 */
function personDelivery({ arrival, timeZone, now = new Date(), nextRound }) {
  const pickup = nextRound(timeZone, now);
  const christmas = christmasMorning(timeZone);
  if (arrival === 'christmas_morning') {
    return { delivered_at: christmas.toISOString(), sealed_until: null, take_back_until: pickup.toISOString() };
  }
  return {
    delivered_at: pickup.toISOString(),
    sealed_until: arrival === 'sealed_christmas' ? christmas.toISOString() : null,
    take_back_until: pickup.toISOString(),
  };
}

/** The card as the apps read it on a piece (mailPiece.present), or null when the piece isn't a card. */
function cardView(mail, now = new Date()) {
  if (!isCard(mail)) return null;
  const card = mail.mail_extracted.card;
  const design = designById(card.design);
  return {
    design: card.design,
    number: design?.number ?? null,
    caption: card.caption || design?.caption || null,
    paper: design?.paper || '#f7f0e2',
    holiday: card.holiday || SEASON.holiday,
    year: card.year || SEASON.year,
    arrival: card.arrival || null,
    sealed_until: card.sealed_until || null,
    sealed: isSealed(mail, now),
  };
}

/**
 * When the carrier picks up a card to a person: their next 7 a.m. after it was sent, which is also the last moment to
 * take it back. A morning or sealed card is delivered at its pickup; a Christmas-morning card waits for Dec 25.
 */
function pickupAt(mail) {
  return mail?.mail_extracted?.card?.take_back_until || mail?.delivered_at || null;
}

/**
 * What the sender sees of a card they sent (today's card and the answer to sending it). `toName` is the person's
 * name as they show it, or the masked email address.
 */
function sentSummary(mail, now = new Date()) {
  const card = mail?.mail_extracted?.card || {};
  const byEmail = Boolean(mail.escrow_status);
  let status;
  if (byEmail) status = mail.escrow_status === 'pending' ? 'waiting' : mail.escrow_status;
  else status = Date.parse(mail.delivered_at) > now.getTime() ? 'waiting' : 'delivered';
  const takeBackUntil = byEmail ? null : pickupAt(mail);
  const canTakeBack = byEmail
    ? mail.escrow_status === 'pending'
    : Boolean(takeBackUntil) && Date.parse(takeBackUntil) > now.getTime() && Date.parse(mail.delivered_at) > now.getTime();
  return {
    id: mail.id,
    design: card.design || null,
    to_name: card.to_name || null,
    by_email: byEmail,
    arrival: card.arrival || null,
    arrives_at: byEmail ? null : mail.delivered_at,
    // The day it reaches them by their clock (cards sent before this was kept: null; the apps read arrives_at).
    arrives_on: byEmail ? null : card.arrives_on || null,
    opens_at: card.sealed_until || null,
    take_back_until: takeBackUntil,
    can_take_back: canTakeBack,
    status,
    sent_at: mail.created_at || null,
  };
}

// ---- Sent: the cards a person sent (GET /api/mailbox/sent, /sent/:id, and the Mailbox flag in v2 drawers) ----

/**
 * The cards this person sent as themselves (not as a business) that weren't taken back: one to a person that was taken
 * back is gone, one by email is withdrawn. A query to add filters and order to.
 */
function sentCards(userId, select, options) {
  return supabaseAdmin.from('Mail').select(select, options)
    .eq('sender_user_id', userId)
    .contains('tags', [CARD_TAG])
    .is('sender_entity_id', null)
    .or('escrow_status.is.null,escrow_status.neq.withdrawn');
}

/**
 * Where a card someone sent is now, as their Sent shows it. To a person: `waiting` for the carrier's 7 a.m. pickup,
 * `picked_up` (a Christmas-morning card on its way) or `delivered`. By email: `email_waiting` until they open it,
 * `claimed` once they joined and have it, `expired` after its 90 days. Never whether they opened, kept or shredded it.
 */
function sentStatus(mail, now = new Date()) {
  const t = now.getTime();
  if (mail.escrow_status) {
    if (mail.escrow_status === 'claimed') return 'claimed';
    if (mail.escrow_status === 'expired' || Date.parse(mail.escrow_expires_at) <= t) return 'expired';
    return 'email_waiting';
  }
  if (Date.parse(mail.delivered_at) <= t) return 'delivered';
  return Date.parse(pickupAt(mail)) <= t ? 'picked_up' : 'waiting';
}

/** This instant's day (YYYY-MM-DD) by this clock, or null. */
function dayIn(at, timeZone) {
  return at ? DateTime.fromJSDate(new Date(at), { zone: timeZone }).toISODate() : null;
}

/** An instant as one ISO form ("2026-12-25T15:00:00.000Z"), whichever way it was stored, or null. */
function instant(at) {
  return at ? new Date(at).toISOString() : null;
}

/**
 * A card in its sender's Sent. `toName`: the name stored when it was sent, or by email the masked address until it's
 * claimed, then the name neighbors see the person by. `senderName`: the name on the envelope (the sender's Local Profile,
 * as the recipient sees it). `zone`: the clock their days are told by (theirs; the sender's own for a card by email
 * nobody has claimed). Never the recipient's ids, address or time zone, nor anything they did with it.
 */
function sentPiece(mail, { toName, senderName, zone, now = new Date() }) {
  const card = mail.mail_extracted?.card || {};
  const view = cardView(mail, now) || {};
  const byEmail = Boolean(mail.escrow_status);
  const status = sentStatus(mail, now);
  return {
    id: mail.id,
    kind: 'card',
    sent_at: instant(mail.created_at),
    to_name: toName || null,
    by_email: byEmail,
    arrival: card.arrival || null,
    status,
    arrives_at: byEmail ? null : instant(mail.delivered_at),
    arrives_on: byEmail ? null : card.arrives_on || dayIn(mail.delivered_at, zone),
    opens_on: dayIn(card.sealed_until, zone),
    sealed: isSealed(mail, now),
    // The same rule as take-back: to a person until the pickup, by email until they open it.
    can_take_back: status === 'waiting' || status === 'email_waiting',
    take_back_until: byEmail ? null : instant(pickupAt(mail)),
    // The envelope as it reaches them: postmarked once the carrier has it (by email, the day it was sent).
    envelope: { from: senderName, postmarked_on: status === 'waiting' ? null : dayIn(mail.created_at, zone) },
    card: { design: view.design || null, number: view.number ?? null, caption: view.caption || null, paper: view.paper || null,
      year: view.year || null },
  };
}

/**
 * A sent card's trail, in order: [{ step, at | on, done }], `at` an instant (shown by the sender's clock), `on` a day by
 * the recipient's (`zone`, as in sentPiece). A step not reached yet is not done. To a person: sealed → delivered, then
 * opens for a sealed card; a Christmas-morning card: sealed → picked_up → delivered. By email: sealed → emailed →
 * joined (at the claim) or returned (on the day its 90 days ended).
 */
function sentTrail(mail, { zone, now = new Date() }) {
  const card = mail.mail_extracted?.card || {};
  const reached = (at) => Boolean(at) && Date.parse(at) <= now.getTime();
  const trail = [{ step: 'sealed', at: instant(mail.created_at), done: true }];
  if (mail.escrow_status) {
    trail.push({ step: 'emailed', at: instant(mail.created_at), done: true });
    const status = sentStatus(mail, now);
    if (status === 'claimed') trail.push({ step: 'joined', at: instant(mail.delivered_at), done: true });
    else if (status === 'expired') trail.push({ step: 'returned', on: dayIn(mail.escrow_expires_at, zone), done: true });
    else trail.push({ step: 'joined', at: null, done: false });
    return trail;
  }
  if (card.arrival === 'christmas_morning') {
    trail.push({ step: 'picked_up', on: dayIn(pickupAt(mail), zone), done: reached(pickupAt(mail)) });
  }
  trail.push({ step: 'delivered', on: card.arrives_on || dayIn(mail.delivered_at, zone), done: reached(mail.delivered_at) });
  if (card.arrival === 'sealed_christmas' && card.sealed_until) {
    trail.push({ step: 'opens', on: dayIn(card.sealed_until, zone), done: reached(card.sealed_until) });
  }
  return trail;
}

/**
 * The Mailbox's Sent line (GET /api/mailbox/v2/drawers `sent`): whether the person has sent a card (not taken back),
 * and how many cards to a person still wait for the 7 a.m. pickup (the mailbox's flag is up while any do).
 */
async function sentLine(userId, now = new Date()) {
  const [any, coming] = await Promise.all([
    sentCards(userId, 'id').limit(1),
    sentCards(userId, 'id, delivered_at, escrow_status, mail_extracted').is('escrow_status', null)
      .gt('delivered_at', now.toISOString()),
  ]);
  if (any.error || coming.error) throw new Error((any.error || coming.error).message);
  return {
    any: Boolean(any.data?.length),
    waiting: (coming.data || []).filter((mail) => sentStatus(mail, now) === 'waiting').length,
  };
}

module.exports = {
  CARD_TAG, MESSAGE_LIMIT, SUBJECT, SEALED_NOTE, SEASON, DESIGNS, PERSON_ARRIVALS, EMAIL_ARRIVALS,
  designById, isCard, isSealed, sealedView, christmasMorning, seasonOpen, dayStart, daysBetween, arrivalsFor,
  personDelivery, cardView, pickupAt, sentSummary, sentCards, sentStatus, sentPiece, sentTrail, sentLine,
};
