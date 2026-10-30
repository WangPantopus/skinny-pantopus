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
 * What the sender sees of a card they sent (today's card and the answer to sending it). `toName` is the person's
 * name as they show it, or the masked email address.
 */
function sentSummary(mail, now = new Date()) {
  const card = mail?.mail_extracted?.card || {};
  const byEmail = Boolean(mail.escrow_status);
  let status;
  if (byEmail) status = mail.escrow_status === 'pending' ? 'waiting' : mail.escrow_status;
  else status = Date.parse(mail.delivered_at) > now.getTime() ? 'waiting' : 'delivered';
  const takeBackUntil = byEmail ? null : (card.take_back_until || mail.delivered_at || null);
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
    opens_at: card.sealed_until || null,
    take_back_until: takeBackUntil,
    can_take_back: canTakeBack,
    status,
    sent_at: mail.created_at || null,
  };
}

module.exports = {
  CARD_TAG, MESSAGE_LIMIT, SUBJECT, SEALED_NOTE, SEASON, DESIGNS, PERSON_ARRIVALS, EMAIL_ARRIVALS,
  designById, isCard, isSealed, sealedView, christmasMorning, seasonOpen, dayStart, arrivalsFor, personDelivery,
  cardView, sentSummary,
};
