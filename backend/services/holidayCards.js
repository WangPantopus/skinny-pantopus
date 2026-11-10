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
 * The pictures come in collections. The website serves every picture (/holiday-cards/<design id>.jpg); the phone apps
 * carry the first 17 and load the rest from the website. Each app prints the caption, the year and the postmark.
 */
const crypto = require('crypto');
const { DateTime } = require('luxon');
const supabaseAdmin = require('../config/supabaseAdmin');

const CARD_TAG = 'holiday_card';
const MESSAGE_LIMIT = 300;
const SUBJECT = 'A Christmas card';
const SEALED_NOTE = 'This Christmas card is sealed until Christmas morning.';

// The season: Christmas 2026. Sending closes when December 31 ends where the sender lives.
const SEASON = { holiday: 'christmas', year: 2026, tag: 'christmas_2026', closes_on: '2026-12-31' };
const MORNING_HOUR = 7;

/** A picture's design id by its number ("christmas-2026-07"). */
const designIdOf = (number) => `christmas-2026-${String(number).padStart(2, '0')}`;

// The collections "Pick a card" shows, in this order, each with its pictures (by number) in grid order (founder,
// 2026-10-31; Christmas with Santa 2026-11-07; the nativity pictures 2026-11-08, renamed Christmas with Jesus Christ
// and moved to the front the same day). A picture can move to another collection; its number stays. The collection's
// id stays first-christmas: nothing but this list reads it.
const COLLECTIONS = [
  ['first-christmas', 'Christmas with Jesus Christ', 'For the faithful, and anyone who loves the Christmas story.',
    [59, 60, 61, 62, 63, 64, 65, 66, 67]],
  ['as-a-kid', 'Christmas as a Kid', 'For families with kids, and anyone who misses being one.',
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]],
  ['with-friends', 'Christmas with Friends', 'For the friends who feel like family.', [18, 19, 20, 21, 22, 26, 31]],
  ['love-stories', 'Christmas Love Stories', 'For the one you love, near or far.', [23, 24, 25, 27, 28, 29, 30]],
  ['in-your-twenties', 'Christmas in Your Twenties', 'For first apartments, old roommates and long trips home.',
    [32, 33, 34, 35, 36, 37]],
  ['memories', 'Christmas Memories', 'For anyone who misses the little things.', [38, 39, 40, 41, 42, 43]],
  ['grandmas-house', 'Christmas at Grandma’s House', 'For grandparents, and the grandkids who still come home.',
    [44, 45, 46, 47, 48, 49]],
  ['with-santa', 'Christmas with Santa', 'For anyone who still believes, and anyone who used to.',
    [50, 51, 52, 53, 54, 55, 56, 57, 58]],
].map(([id, name, line, numbers]) => ({ id, name, line, designs: numbers.map(designIdOf) }));
const COLLECTION_OF_DESIGN = new Map(COLLECTIONS.flatMap((c) => c.designs.map((design) => [design, c.id])));

// The pictures by number, with the caption printed under each, the colour of its paper, its height in px at 960 px wide
// (an app keeps a picture's shape while it loads it), its name on the public card pages (/cards/<slug>) and the colour of
// the cloth it lies on (launch key card_table). 1–17 are the founder's own (2026-10-30); 18–49 came in five groups on
// 2026-10-31; 50–58 are the founder's Santa pictures (2026-11-07), which have no border, so their paper is one cream.
// 59–67 are the founder's nativity pictures (2026-11-08), each with its whole King James verse printed under the
// painting, so the caption is the verse's reference (its book and numbers joined by a no-break space).
// A number is never reused: every app picks the card's stamp from it.
const DESIGNS = [
  ['Home for Christmas.', '#f7eee0', 1054, 'home-for-christmas', '#2c4071'],
  ['One more run?', '#f7efe1', 1054, 'one-more-run', '#3b4c6e'],
  ['Don’t open until Christmas.', '#f4eee0', 1034, 'dont-open-until-christmas', '#6e4b30'],
  ['Remember making your wish list?', '#fcf5e7', 1054, 'remember-making-your-wish-list', '#6e4b30'],
  ['We saved you a window seat.', '#fbf2e2', 1035, 'we-saved-you-a-window-seat', '#3b4c6e'],
  ['Shake it once for me.', '#f4ede2', 1032, 'shake-it-once-for-me', '#6e4b30'],
  ['Remember Christmas at the mall?', '#f8f0e3', 1058, 'remember-christmas-at-the-mall', '#6e4b30'],
  ['Come finish our snowman.', '#f9f1e3', 1045, 'come-finish-our-snowman', '#3b4c6e'],
  ['Look outside. It’s snowing.', '#f6ede0', 1062, 'look-outside-its-snowing', '#3b4c6e'],
  ['One more Christmas movie.', '#f8f0e0', 1040, 'one-more-christmas-movie', '#6e4b30'],
  ['We found our tree.', '#f9f3e7', 1027, 'we-found-our-tree', '#3b4c6e'],
  ['Your cocoa’s getting cold.', '#f5eee0', 1052, 'your-cocoas-getting-cold', '#2c4071'],
  ['A little Christmas from home.', '#f8f1e0', 1065, 'a-little-christmas-from-home', '#6e4b30'],
  ['Wish you were here.', '#f9f6ed', 1046, 'wish-you-were-here', '#6e4b30'],
  ['Snowy wishes, just for you.', '#f8f0e3', 1052, 'snowy-wishes-just-for-you', '#3b4c6e'],
  ['Saved you the good cookies.', '#f4efe4', 1042, 'saved-you-the-good-cookies', '#6e4b30'],
  ['See you after Christmas.', '#fbf3e4', 1054, 'see-you-after-christmas', '#3b4c6e'],
  ['Same friends. New memories.', '#f2eee2', 1024, 'same-friends-new-memories', '#6e4b30'],
  ['No fancy plans. Just us.', '#f3efe5', 982, 'no-fancy-plans-just-us', '#6e4b30'],
  ['Come over. There’s always room.', '#f1ede2', 1014, 'come-over-theres-always-room', '#6e4b30'],
  ['Let’s take the long way home.', '#f7f3ea', 1019, 'lets-take-the-long-way-home', '#3b4c6e'],
  ['We saved your usual seat.', '#f5f0e6', 990, 'we-saved-your-usual-seat', '#704b51'],
  ['Our little place. Our Christmas.', '#f9f1e3', 994, 'our-little-place-our-christmas', '#6e4b30'],
  ['Another Christmas. Still you.', '#f9f1df', 968, 'another-christmas-still-you', '#6e4b30'],
  ['Until I can hold you again.', '#f8f0df', 987, 'until-i-can-hold-you-again', '#6e4b30'],
  ['One more movie, like always.', '#f7f0e3', 975, 'one-more-movie-like-always', '#6e4b30'],
  ['Christmas starts when you get here.', '#f7f2e8', 1019, 'christmas-starts-when-you-get-here', '#2c4071'],
  ['One more song, my love.', '#f7f0e5', 1019, 'one-more-song-my-love', '#6e4b30'],
  ['My favorite place is beside you.', '#faf1e1', 1066, 'my-favorite-place-is-beside-you', '#3b4c6e'],
  ['All I wanted was you.', '#f6eee0', 1004, 'all-i-wanted-was-you', '#6e4b30'],
  ['Good friends. Questionable wrapping skills.', '#f5efe2', 971, 'good-friends-questionable-wrapping-skills', '#6e4b30'],
  ['Save me a place at home.', '#f2eadf', 1034, 'save-me-a-place-at-home', '#704b51'],
  ['Our kind of Christmas Eve.', '#f1e7d8', 999, 'our-kind-of-christmas-eve', '#6e4b30'],
  ['Books closed. Christmas starts now.', '#f5ede1', 999, 'books-closed-christmas-starts-now', '#3b4c6e'],
  ['Small gifts. Good company.', '#f2ece1', 999, 'small-gifts-good-company', '#6e4b30'],
  ['We’ll make it fit.', '#f0e8d6', 1057, 'well-make-it-fit', '#2c4071'],
  ['Different cities. Same old us.', '#f4ecdc', 999, 'different-cities-same-old-us', '#6e4b30'],
  ['Saved you something sweet.', '#f7f0e3', 1014, 'saved-you-something-sweet', '#6e4b30'],
  ['A little Christmas, sent your way.', '#f6eddd', 1040, 'a-little-christmas-sent-your-way', '#6e4b30'],
  ['Follow the lights home.', '#f7eede', 1041, 'follow-the-lights-home', '#2c4071'],
  ['Press play. Stay awhile.', '#f8eee1', 1031, 'press-play-stay-awhile', '#6e4b30'],
  ['Wake up. It’s Christmas.', '#faf0e1', 996, 'wake-up-its-christmas', '#6e4b30'],
  ['Come in. The movie’s starting.', '#f4e7d3', 1046, 'come-in-the-movies-starting', '#6e4b30'],
  ['Your turn to stir.', '#faf3e5', 993, 'your-turn-to-stir', '#6e4b30'],
  ['You can have one now.', '#f5f1e7', 997, 'you-can-have-one-now', '#704b51'],
  ['Take this for tomorrow.', '#f9f2e6', 997, 'take-this-for-tomorrow', '#6e4b30'],
  ['You made this one.', '#f6f2e9', 986, 'you-made-this-one', '#6e4b30'],
  ['One more piece before bed.', '#f4f0e6', 1034, 'one-more-piece-before-bed', '#6e4b30'],
  ['Your bed’s already made.', '#f6eddd', 994, 'your-beds-already-made', '#6e4b30'],
  ['You made the nice list.', '#f7f0e2', 1022, 'you-made-the-nice-list', '#6e4b30'],
  ['I put in a good word for you.', '#f7f0e2', 1022, 'i-put-in-a-good-word-for-you', '#6e4b30'],
  ['Just making sure it works.', '#f7f0e2', 1022, 'just-making-sure-it-works', '#6e4b30'],
  ['He got your letter.', '#f7f0e2', 1022, 'he-got-your-letter', '#6e4b30'],
  ['Some things never get old.', '#f7f0e2', 1022, 'some-things-never-get-old', '#2c4071'],
  ['On his way to you.', '#f7f0e2', 1022, 'on-his-way-to-you', '#3b4c6e'],
  ['Saved the best house for last.', '#f7f0e2', 1022, 'saved-the-best-house-for-last', '#2c4071'],
  ['Shh. He’s here.', '#f7f0e2', 1022, 'shh-hes-here', '#6e4b30'],
  ['Put your feet up. It’s Christmas.', '#f7f0e2', 1022, 'put-your-feet-up-its-christmas', '#704b51'],
  ['Isaiah\u00a09:6 (KJV)', '#f7f0e2', 1022, 'isaiah-9-6', '#6e4b30'],
  ['Luke\u00a02:7 (KJV)', '#f7f0e2', 1022, 'luke-2-7', '#6e4b30'],
  ['John\u00a03:16 (KJV)', '#f7f0e2', 1022, 'john-3-16', '#704b51'],
  ['Luke\u00a02:10 (KJV)', '#f7f0e2', 1022, 'luke-2-10', '#2c4071'],
  ['Luke\u00a02:14 (KJV)', '#f7f0e2', 1022, 'luke-2-14', '#6e4b30'],
  ['Matthew\u00a02:2 (KJV)', '#f7f0e2', 1022, 'matthew-2-2', '#2c4071'],
  ['Matthew\u00a02:11 (KJV)', '#f7f0e2', 1022, 'matthew-2-11', '#704b51'],
  ['Matthew\u00a02:14 (KJV)', '#f7f0e2', 1022, 'matthew-2-14', '#2c4071'],
  ['John\u00a08:12 (KJV)', '#f7f0e2', 1022, 'john-8-12', '#6e4b30'],
].map(([caption, paper, height, slug, table], index) => {
  const id = designIdOf(index + 1);
  return { id, number: index + 1, caption, paper, collection: COLLECTION_OF_DESIGN.get(id) || null, height, slug, table };
});
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

/**
 * The row id of the card one send stores (POST /api/mailbox/cards with a `request_id`): the same sender and request ID
 * always give the same id, so the database refuses a second card for one send, however it's repeated. Formatted as the
 * gig-completion File ids are (services/s3Service).
 */
function requestRowId(senderId, requestId) {
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify(['holiday_card_v1', String(senderId), String(requestId).toLowerCase()])).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

/**
 * A card sent by link (launch key card_table): the token its link carries, made from its id and the server's secret (the
 * same one as services/mailEnclosures, under its own label), so its sender can ask for the link again while the Mail row
 * keeps only the token's hash. Empty when the server has no secret.
 */
function cardLinkToken(mailId) {
  const secret = process.env.MAIL_ENCLOSURE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(`pantopus:card-link:v1:${mailId}`).digest('base64url');
}

/** Whether this card went out as a link: it waits like a card by email, for whoever opens it first. */
function isByLink(mail) {
  return Boolean(mail?.mail_extracted?.card?.by_link);
}

/** What a send asked for, as one digest: the same request ID with other content asks for another card. */
function requestDigest({ design, message, arrival, toUserId, toEmail }) {
  return crypto.createHash('sha256')
    .update(JSON.stringify([design, message, arrival, toUserId || null, toEmail || null])).digest('hex');
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
    // The picture's height at 960 px wide, so an app keeps its shape while it loads it.
    height: design?.height ?? null,
    // The card's public page (/cards/<slug>) and the colour of the cloth it lies on (launch key card_table).
    slug: design?.slug || null,
    table: design?.table || null,
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
    // By link it also counts as by email (older apps read it that way); newer apps say it in link words.
    ...(card.by_link ? { by_link: true } : {}),
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

// ---- Sent: personal letters and cards (GET /api/mailbox/sent, /sent/:id, and the Mailbox flag in v2 drawers) ----

/**
 * The letters and cards this person sent as themselves (not as a business) that weren't taken back: a card that was taken
 * back is gone, one by email is withdrawn. A query to add filters and order to.
 */
function sentCards(userId, select, options) {
  return supabaseAdmin.from('Mail').select(select, options)
    .eq('sender_user_id', userId)
    .eq('type', 'letter')
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
 * nobody has claimed). `toHousehold`: a letter to a Home itself, whose `toName` ("their household") is said whole, never
 * as a first name. Never the recipient's ids, address or time zone, nor anything they did with it.
 */
function sentPiece(mail, { toName, toHousehold = false, senderName, zone, now = new Date() }) {
  const isHolidayCard = isCard(mail);
  const card = mail.mail_extracted?.card || {};
  const view = cardView(mail, now) || {};
  const byEmail = Boolean(mail.escrow_status);
  const status = sentStatus(mail, now);
  return {
    id: mail.id,
    kind: isHolidayCard ? 'card' : 'letter',
    subject: isHolidayCard ? SUBJECT : (mail.subject || mail.display_title || 'A letter'),
    sent_at: instant(mail.created_at),
    to_name: toName || null,
    to_household: Boolean(toHousehold),
    by_email: byEmail,
    ...(card.by_link ? { by_link: true } : {}),
    arrival: card.arrival || null,
    status,
    arrives_at: byEmail ? null : instant(mail.delivered_at),
    arrives_on: byEmail ? null : card.arrives_on || dayIn(mail.delivered_at, zone),
    opens_on: dayIn(card.sealed_until, zone),
    sealed: isSealed(mail, now),
    // The same rule as take-back: to a person until the pickup, by email until they open it.
    can_take_back: isHolidayCard && (status === 'waiting' || status === 'email_waiting'),
    take_back_until: byEmail || !isHolidayCard ? null : instant(pickupAt(mail)),
    // The envelope as it reaches them: postmarked once the carrier has it (by email, the day it was sent).
    envelope: { from: senderName, postmarked_on: status === 'waiting' ? null : dayIn(mail.created_at, zone) },
    card: { design: view.design || null, number: view.number ?? null, caption: view.caption || null, paper: view.paper || null,
      year: view.year || null, height: view.height ?? null, slug: view.slug || null, table: view.table || null },
  };
}

/**
 * A sent card's trail, in order: [{ step, at | on, done }], `at` an instant (shown by the sender's clock), `on` a day by
 * the recipient's (`zone`, as in sentPiece). A step not reached yet is not done. To a person: sealed → delivered, then
 * opens for a sealed card; a Christmas-morning card: sealed → picked_up → delivered. By email: sealed → emailed →
 * joined (at the claim) or returned (on the day its 90 days ended). By link, the same steps, each marked `by_link`.
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
    return card.by_link ? trail.map((step) => ({ ...step, by_link: true })) : trail;
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
 * The Mailbox's Sent line (GET /api/mailbox/v2/drawers `sent`): whether the person has sent a letter or card (not taken back),
 * and how many letters or cards to a person still wait for the 7 a.m. pickup (the mailbox's flag is up while any do), of
 * them `waiting_letters` letters, so the flag says what waits.
 */
async function sentLine(userId, now = new Date()) {
  const [any, coming] = await Promise.all([
    sentCards(userId, 'id').limit(1),
    sentCards(userId, 'id, delivered_at, escrow_status, mail_extracted').is('escrow_status', null)
      .gt('delivered_at', now.toISOString()),
  ]);
  if (any.error || coming.error) throw new Error((any.error || coming.error).message);
  const waiting = (coming.data || []).filter((mail) => sentStatus(mail, now) === 'waiting');
  return {
    any: Boolean(any.data?.length),
    waiting: waiting.length,
    waiting_letters: waiting.filter((mail) => !isCard(mail)).length,
  };
}

module.exports = {
  CARD_TAG, MESSAGE_LIMIT, SUBJECT, SEALED_NOTE, SEASON, COLLECTIONS, DESIGNS, PERSON_ARRIVALS, EMAIL_ARRIVALS,
  designById, isCard, isByLink, cardLinkToken, requestRowId, requestDigest, isSealed, sealedView, christmasMorning, seasonOpen, dayStart,
  daysBetween, arrivalsFor,
  personDelivery, cardView, pickupAt, sentSummary, sentCards, sentStatus, sentPiece, sentTrail, sentLine,
};
