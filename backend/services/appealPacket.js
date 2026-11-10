/**
 * The Home Money Check's appeal packet: a short PDF an owner files with themselves in charge. It puts the county's own
 * figures for their home in one place, beside similar homes on the street (propertyRecords/similarHomes.js), with how
 * their state says a value is reviewed (data/appealPrograms.js), the steps, and a worksheet for the homes they look up.
 *
 * Honesty rules:
 *   - facts from the county's record and the state's own page only: never "you should appeal", never a saving;
 *   - Pantopus does not file for anyone or act for them, and the packet says so on every page;
 *   - the PDF lists the similar homes by parcel number, living area, year built and county value, because a review
 *     board asks for specific homes and these are the county's public record (the founder's decision of November 10,
 *     2026). Never a street address or an owner's name, and never on a screen: the page and the card keep to the
 *     count, the typical figure and the range;
 *   - the owner's own home is named in full (address, parcel number): it is their document about their home.
 *
 * Who gets it: the Home's confirmed owner, in a county on the switch file's `appeal_packet` list (router.js), for a
 * home the county values above similar homes, in a state with an entry in the appeal table. Off everywhere until the
 * founder switches a county on. Every word a person reads is in this file, for one read by a lawyer.
 *
 * It costs PRICE_CENTS, once for a Home and a county value year, paid on the web through Stripe Checkout (the founder's
 * decision of November 10, 2026). A purchase is a row in "AppealPacketPurchase", written only after Stripe itself says
 * the session was paid (`confirm`), so the owner can download the packet again. A refund or dispute takes it away.
 * It is sold only where this server's Stripe key is a live one, or a test one on a server that says it is a sandbox
 * (APPEAL_PACKET_SANDBOX=true): a production server still on Stripe's test mode sells nothing.
 */

const PDFDocument = require('pdfkit');
const supabaseAdmin = require('../config/supabaseAdmin');
const { checkHomePermission } = require('../utils/homePermissions');
const homeRecords = require('./propertyRecords/homeRecord');
const similarHomes = require('./propertyRecords/similarHomes');
const router = require('./propertyRecords/router');
const { stateCode } = require('./propertyRecords/addressKey');
const { appealForState, CHECKED_AT } = require('../data/appealPrograms');

const HOME_COLUMNS = 'id, address, address2, city, state, zipcode, niche_data';
const STATE_NAMES = { FL: 'Florida', TX: 'Texas', WA: 'Washington' };
const PRICE_CENTS = 2900;
const CURRENCY = 'usd';
const PRICE_LABEL = `$${PRICE_CENTS / 100}`;

const stripe = () => require('../stripe/getStripeClient').getStripeClient();
const sandbox = () => process.env.APPEAL_PACKET_SANDBOX === 'true';
/** Whether this server can take the payment: a live key, or a test key on a server that says it is a sandbox. */
const canSell = () => new RegExp(sandbox() ? '^(sk|rk)_test_' : '^(sk|rk)_live_').test(process.env.STRIPE_SECRET_KEY || '');
const failure = (message, status = 503, code = 'APPEAL_PACKET_UNAVAILABLE') => Object.assign(new Error(message), { status, code });

const positive = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);
const money = (n) => (positive(n) ? `$${Math.round(n).toLocaleString('en-US')}` : null);
const count = (n) => (positive(n) ? Math.round(n).toLocaleString('en-US') : null);
const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const longDay = (iso) => homeRecords.dateLabel(String(iso || '').slice(0, 10));

/**
 * What a packet would hold for this Home, or why there is none.
 * @param {object} home  The Home's row (HOME_COLUMNS)
 * @returns {Promise<{ ok: true, home, copy, found, appeal, state } | { ok: false, reason: string }>}
 */
async function facts(home, { list = false } = {}) {
  const copy = home ? homeRecords.liveCopy(home) : null;
  if (!copy || !router.appealPacketFor(copy.jurisdiction)) return { ok: false, reason: 'off' };
  // The similar homes themselves are read only to print the PDF.
  const found = await similarHomes.forHome(home, copy, list ? { list: true } : undefined);
  if (!found) return { ok: false, reason: 'no_comparison' };
  if (found.stance !== 'above') return { ok: false, reason: 'not_above' };
  const state = stateCode(home.state);
  const appeal = appealForState(state);
  if (!appeal) return { ok: false, reason: 'no_state' };
  return { ok: true, home, copy, found, appeal, state };
}

/**
 * The packet for one person asking about one Home: only its confirmed owner gets past `not_owner`.
 * @returns {Promise<{ ok: true, ... } | { ok: false, reason: 'not_owner'|'off'|'no_comparison'|'not_above'|'no_state' }>}
 */
async function forOwner(homeId, userId, options) {
  const access = await checkHomePermission(homeId, userId, 'home.view');
  if (!access.hasAccess || !access.isOwner) return { ok: false, reason: 'not_owner' };
  const { data: home, error } = await supabaseAdmin.from('Home').select(HOME_COLUMNS).eq('id', homeId).maybeSingle();
  if (error) throw new Error(`Home read failed: ${error.message}`);
  return facts(home, options);
}

// ─── Buying it ─────────────────────────────────────────────────────────────

/** The county value year a packet is for: a new year's value is a new packet. */
const valueYearOf = (packet) => (Number.isInteger(packet.found.value_year) ? packet.found.value_year : 0);

/** Whether this person has bought this Home's packet for its current value year, and still holds it. */
async function purchased(packet, userId) {
  const { data, error } = await supabaseAdmin.from('AppealPacketPurchase').select('id')
    .eq('home_id', packet.home.id).eq('user_id', userId).eq('value_year', valueYearOf(packet)).eq('revoked', false).limit(1);
  if (error) throw failure('The purchase could not be checked. Please retry.');
  return Boolean(data && data.length);
}

/**
 * A Stripe Checkout page for the packet. `requestId` makes a double tap one session.
 * @returns {Promise<{ url: string }>}
 */
async function checkout(packet, userId, requestId) {
  if (!canSell()) throw failure('The packet is not on sale yet.', 503, 'APPEAL_PACKET_NOT_ON_SALE');
  if (await purchased(packet, userId)) throw failure('You already have this packet.', 409, 'APPEAL_PACKET_OWNED');
  const origin = String(process.env.FRONTEND_URL || 'https://pantopus.com').trim().replace(/\/+$/, '');
  const page = `${origin}/app/homes/${packet.home.id}/appeal-packet`;
  const metadata = { appeal_packet_user: userId, appeal_packet_home: packet.home.id, appeal_packet_year: String(valueYearOf(packet)) };
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    client_reference_id: userId,
    metadata,
    payment_intent_data: { metadata },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: CURRENCY,
        unit_amount: PRICE_CENTS,
        product_data: { name: TITLE, description: CHECKOUT_DESCRIPTION },
      },
    }],
    success_url: `${page}?packet_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${page}?packet_cancelled=1`,
  }, { idempotencyKey: `appeal-packet:${userId}:${requestId}` });
  if (session.livemode === sandbox()) throw failure('The packet is not on sale yet.', 503, 'APPEAL_PACKET_NOT_ON_SALE');
  return { url: session.url };
}

/**
 * Record a purchase once Stripe itself says the session was paid, for the person and Home it was made for. Safe to
 * call again: the same session is one row. A refunded or disputed payment marks the row revoked.
 * @param {string} reference  The Checkout Session id
 * @param {string|null} userId  Who is asking; null for Stripe's own events, which name the buyer themselves
 * @returns {Promise<{ home_id: string, user_id: string, revoked: boolean }>}
 */
async function confirm(reference, userId = null) {
  if (typeof reference !== 'string' || !/^cs_[A-Za-z0-9_]{10,200}$/.test(reference)) throw failure('That is not a purchase.', 400, 'APPEAL_PACKET_BAD_REFERENCE');
  const session = await stripe().checkout.sessions.retrieve(reference, { expand: ['payment_intent.latest_charge'] }).catch((err) => {
    // Stripe doesn't know the session: not a purchase, rather than a fault to retry.
    if (err && err.code === 'resource_missing') throw failure('That is not a purchase.', 400, 'APPEAL_PACKET_BAD_REFERENCE');
    throw err;
  });
  const meta = session.metadata || {};
  const buyer = meta.appeal_packet_user;
  if (!buyer || !meta.appeal_packet_home || (userId && buyer !== userId) || session.mode !== 'payment' || session.currency !== CURRENCY
    || session.amount_total !== PRICE_CENTS || session.livemode === sandbox()) {
    throw failure('This purchase does not belong to this account.', 403, 'APPEAL_PACKET_NOT_YOURS');
  }
  if (session.payment_status !== 'paid') throw failure('Payment is still pending.', 409, 'APPEAL_PACKET_PENDING');
  const charge = session.payment_intent && session.payment_intent.latest_charge;
  if (!charge || typeof charge === 'string') throw failure('The purchase could not be checked. Please retry.');
  const revoked = Boolean(charge.disputed) || charge.amount_refunded > 0;
  const row = {
    user_id: buyer, home_id: meta.appeal_packet_home, value_year: Number.parseInt(meta.appeal_packet_year, 10) || 0,
    provider: 'stripe', reference, amount_cents: PRICE_CENTS, currency: CURRENCY,
  };
  const { error: insertError } = await supabaseAdmin.from('AppealPacketPurchase').upsert(row, { onConflict: 'provider,reference', ignoreDuplicates: true });
  if (insertError) throw failure('The purchase could not be saved. Please retry.');
  // Only ever towards revoked: a refund is not undone by asking again.
  const change = revoked ? { revoked: true, checked_at: new Date().toISOString() } : { checked_at: new Date().toISOString() };
  const { error: updateError } = await supabaseAdmin.from('AppealPacketPurchase').update(change).eq('provider', 'stripe').eq('reference', reference);
  if (updateError) throw failure('The purchase could not be saved. Please retry.');
  return { home_id: row.home_id, user_id: buyer, revoked };
}

/**
 * Stripe says a charge was refunded or disputed (stripe/stripeWebhooks.js): when it paid for a packet, check that
 * purchase again. True when the charge was a packet's, so the other handlers leave it alone.
 */
async function stripeChargeChanged(object, connectedAccount) {
  if (connectedAccount) return false; // Packets are platform charges, never Connect charges.
  let paymentIntent = object.payment_intent;
  if (!paymentIntent && object.charge) {
    const charge = await stripe().charges.retrieve(typeof object.charge === 'string' ? object.charge : object.charge.id);
    paymentIntent = charge.payment_intent;
  }
  if (!paymentIntent) return false;
  const intent = await stripe().paymentIntents.retrieve(typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id);
  if (!intent.metadata || !intent.metadata.appeal_packet_home) return false;
  const sessions = await stripe().checkout.sessions.list({ payment_intent: intent.id, limit: 1 });
  if (!sessions.data[0]) throw failure('The purchase could not be checked.');
  await confirm(sessions.data[0].id);
  return true;
}

// ─── The words ─────────────────────────────────────────────────────────────

const TITLE = 'Property value review packet';
const CHECKOUT_DESCRIPTION = 'A PDF for one home and one county value year, to file yourself: the home in the county\'s records, similar homes on its street, and how the state reviews a value. Information, not tax or legal advice. Pantopus does not file for you.';
const NOT_ADVICE = 'Information, not tax or legal advice. You file any petition yourself; Pantopus does not file for you or represent you.';

const FOOTER = 'Pantopus · Information, not tax or legal advice. You file it yourself; Pantopus does not represent you.';

const whatThisIs = (stateName) => `This packet puts the county's own figures for your home in one place, beside similar homes on your street, with how ${stateName} says a value is reviewed. Whether to ask for a review is your decision. You file any petition yourself. Pantopus does not file for you or represent you, and this is information, not tax or legal advice.`;

const STEPS = [
  'Find the notice of value the county sent you. The deadline printed on your own notice is the one that counts.',
  'Get the form from the official page named in part 3, or from your county assessor.',
  'Check part 1 against your notice. If the county has your home\'s size, age or features wrong, say so on the form: a wrong record is its own reason for a review.',
  'Look up the homes in part 5 on your county assessor\'s public site by parcel number, and check each figure before you rely on it. Boards usually ask for specific homes. Add others like yours in the blank rows.',
  'File the form with the board named in part 3 before the deadline, with a copy of this packet if it helps. Keep a copy of everything you file.',
];

const HOMES_INTRO = (found, listed) => `The ${found.homes} similar homes on your street that part 2 was worked out from, as the county's record has them${listed < found.homes ? ` (${listed} of them have a parcel number on record)` : ''}. The blank rows are for homes you add yourself.`;
const HOMES_COLUMNS = ['Parcel number', 'Living area (sq ft)', 'Year built', 'County value', 'Value per sq ft'];
const BLANK_ROWS = 3;

/** The address as the owner writes it: their own home, in full. */
function addressOf(home) {
  const street = [text(home.address), text(home.address2)].filter(Boolean).join(' ');
  const place = [text(home.city), [text(home.state), text(home.zipcode)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, place].filter(Boolean).join(', ');
}

/** Part 1's rows: the county's record of this home. A fact the record lacks is left out, not guessed. */
function recordRows({ copy, found }) {
  const f = copy.facts || {};
  const year = f.value_year ? `${f.value_year} ` : '';
  const acres = positive(f.lot_acres) ? `${f.lot_acres} acres` : null;
  const lot = positive(f.lot_sqft) ? `${count(f.lot_sqft)} sq ft${acres ? ` (${acres})` : ''}` : acres;
  return [
    ['Parcel number', text(f.parcel_number)],
    ['Address on the county record', text(f.address_on_record)],
    ['County', text(f.county)],
    [`${year}market value`, money(f.market_value)],
    ['Land', money(f.market_land_value)],
    ['Buildings', money(f.market_building_value)],
    ['Taxable value', money(f.taxable_value)],
    ['Assessed value', money(f.assessed_value)],
    ['Living area', positive(f.living_sqft) ? `${count(f.living_sqft)} sq ft` : null],
    ['Lot', lot],
    ['Year built', Number.isInteger(f.year_built) ? String(f.year_built) : null],
    ['Value per square foot of living area', money(found.yours_per_sqft)],
  ].filter(([, value]) => value);
}

/** Part 2's rows: the card's own rows, and the difference. */
function comparisonRows(found) {
  return [
    ...similarHomes.rows(found).map((row) => [row.label, row.value]),
    ['Difference from the typical similar home', `${found.pct}% above`],
  ];
}

/** What the packet holds, in words for a screen: the same parts the PDF prints. */
function summary(packet) {
  const stateName = STATE_NAMES[packet.state] || packet.state;
  return {
    available: true,
    title: TITLE,
    lead: whatThisIs(stateName),
    contents: [
      'Your home in the county\'s records',
      'How its value compares with similar homes on your street',
      `How ${stateName} reviews a value, with the state's official page`,
      'The steps to file it yourself',
      'The similar homes, by parcel number, with room to add your own',
    ],
    rows: comparisonRows(packet.found).map(([label, value], index) => ({ id: `row_${index}`, label, value })),
    source: homeRecords.provenanceOf(packet.copy).label,
    note: NOT_ADVICE,
    file_name: 'pantopus-property-value-review-packet.pdf',
    price: { amount_cents: PRICE_CENTS, currency: CURRENCY, label: PRICE_LABEL },
    covers: `One payment covers this home's packet for the county's ${valueYearOf(packet) || 'current'} value. You can download it again from this page.`,
    // Whether this server takes the payment yet (a live Stripe key); the caller adds `purchased`.
    on_sale: canSell(),
  };
}

/** The money page's card for it (`money_cards`): what it is and the one way in, on the web. */
function card(packet, url) {
  const stateName = STATE_NAMES[packet.state] || packet.state;
  return {
    id: 'appeal_packet',
    title: 'Appeal packet',
    chip: null,
    lead: `A document to file yourself: your home in the county's records, how its value compares with similar homes on your street, and how ${stateName} reviews a value.`,
    rows: [],
    notes: [`It costs ${PRICE_LABEL}, paid on the web.`, 'Pantopus does not file for you or represent you. This is information, not tax or legal advice.'],
    source: null,
    action: { label: 'Get the packet on the web', url },
  };
}

// ─── The PDF ───────────────────────────────────────────────────────────────

const INK = '#111827';
const MUTED = '#4B5563';
const FAINT = '#6B7280';
const BRAND = '#0B5C8A';
const RULE = '#D1D5DB';
const PAGE = { size: 'LETTER', margin: 60 };

/**
 * @param {object} packet  What `facts` or `forOwner` returned with ok: true
 * @param {object} [options]
 * @param {Date} [options.now]
 * @returns {Promise<Buffer>}
 */
function pdf(packet, { now = new Date() } = {}) {
  const { home, copy, found, appeal, state } = packet;
  const stateName = STATE_NAMES[state] || state;
  const prepared = longDay(now.toISOString());
  const source = homeRecords.provenanceOf(copy).label;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...PAGE, bufferPages: true, info: { Title: TITLE, Author: 'Pantopus', Subject: 'County value beside similar homes' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    const heading = (words) => {
      if (doc.y > doc.page.height - 190) doc.addPage();
      doc.moveDown(1.1);
      doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(words, left, doc.y, { width });
      doc.moveDown(0.35);
    };
    const para = (words, { color = INK, size = 10.5 } = {}) => {
      doc.font('Helvetica').fontSize(size).fillColor(color).text(words, left, doc.y, { width, lineGap: 2.5 });
      doc.moveDown(0.5);
    };
    const table = (rows) => {
      for (const [label, value] of rows) {
        const top = doc.y;
        doc.font('Helvetica').fontSize(10.5).fillColor(MUTED).text(label, left, top, { width: width * 0.58 });
        const after = doc.y;
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(value, left + width * 0.6, top, { width: width * 0.4, align: 'right' });
        doc.y = Math.max(after, doc.y) + 4;
        doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(0.5).strokeColor(RULE).stroke();
        doc.y += 5;
      }
      doc.moveDown(0.3);
    };

    doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND).text('Pantopus', left, 56);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(TITLE, left, 84, { width });
    doc.font('Helvetica').fontSize(10.5).fillColor(MUTED).text(`Prepared ${prepared} for the owner of`, left, doc.y + 6, { width });
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(addressOf(home), left, doc.y + 2, { width });
    doc.moveDown(0.8);
    para(whatThisIs(stateName), { color: MUTED, size: 10 });

    heading('1. Your home in the county\'s records');
    table(recordRows(packet));
    para(source, { color: FAINT, size: 9 });

    heading('2. Beside similar homes on your street');
    table(comparisonRows(found));
    para(similarHomes.note(found), { color: MUTED, size: 10 });

    heading(`3. How ${stateName} reviews a value`);
    para(appeal.note);
    doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(`Official page: ${appeal.source.name}`, left, doc.y, { width });
    doc.font('Helvetica').fontSize(10.5).fillColor(BRAND).text(appeal.source.url, left, doc.y + 1, { width, link: appeal.source.url, underline: true });
    doc.moveDown(0.5);
    para(`Read from that page on ${longDay(CHECKED_AT)}. Rules and dates change: the deadline on your own notice from the county is the one that counts.`, { color: FAINT, size: 9 });

    heading('4. Filing it yourself');
    STEPS.forEach((step, index) => {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(`${index + 1}.`, left, doc.y, { width: 16, continued: false });
      doc.moveUp();
      doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(step, left + 18, doc.y, { width: width - 18, lineGap: 2.5 });
      doc.moveDown(0.35);
    });

    const listed = (found.list || []).filter((home) => home.parcel_number);
    const lines = [
      ...listed.map((home) => [home.parcel_number, count(home.size_sqft), String(home.year_built), money(home.value), money(home.per_sqft)]),
      ...Array.from({ length: BLANK_ROWS }, () => HOMES_COLUMNS.map(() => '')),
    ];
    const rowHeight = 22;
    // The heading, its line and the whole table stay together: on a new page when this one hasn't the room.
    if (doc.y > doc.page.height - 60 - (lines.length + 1) * rowHeight - 110) { doc.addPage(); doc.y = doc.page.margins.top - 14; }
    heading('5. Similar homes on your street');
    para(HOMES_INTRO(found, listed.length), { color: MUTED, size: 10 });
    const cell = width / HOMES_COLUMNS.length;
    const top = doc.y + 4;
    HOMES_COLUMNS.forEach((name, index) => {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED).text(name, left + index * cell + 4, top + 7, { width: cell - 8, lineBreak: false });
    });
    lines.forEach((line, row) => {
      line.forEach((value, index) => {
        doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(value, left + index * cell + 4, top + (row + 1) * rowHeight + 6, { width: cell - 8, lineBreak: false });
      });
    });
    for (let row = 0; row <= lines.length + 1; row += 1) {
      doc.moveTo(left, top + row * rowHeight).lineTo(left + width, top + row * rowHeight).lineWidth(0.6).strokeColor(RULE).stroke();
    }
    for (let column = 0; column <= HOMES_COLUMNS.length; column += 1) {
      doc.moveTo(left + column * cell, top).lineTo(left + column * cell, top + (lines.length + 1) * rowHeight).lineWidth(0.6).strokeColor(RULE).stroke();
    }

    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(pages.start + index);
      // Below the bottom margin, so the footer never starts a page of its own.
      const bottom = doc.page.height - 44;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor(FAINT)
        .text(FOOTER, left, bottom, { width: width - 60, lineBreak: false })
        .text(`Page ${index + 1} of ${pages.count}`, left, bottom, { width, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { forOwner, facts, summary, card, pdf, purchased, checkout, confirm, stripeChargeChanged, canSell, recordRows, comparisonRows, TITLE, PRICE_CENTS };
