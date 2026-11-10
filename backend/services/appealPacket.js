/**
 * The Home Money Check's appeal packet: a short PDF an owner files with themselves in charge. It puts the county's own
 * figures for their home in one place, beside similar homes on the street (propertyRecords/similarHomes.js), with how
 * their state says a value is reviewed (data/appealPrograms.js), the steps, and a worksheet for the homes they look up.
 *
 * Honesty rules:
 *   - facts from the county's record and the state's own page only: never "you should appeal", never a saving;
 *   - Pantopus does not file for anyone or act for them, and the packet says so on every page;
 *   - nothing names another home: the comparison is the count, the typical figure and the range, as on the card. The
 *     worksheet is blank for the owner to fill from the county's public site;
 *   - the owner's own home is named in full (address, parcel number): it is their document about their home.
 *
 * Who gets it: the Home's confirmed owner, in a county on the switch file's `appeal_packet` list (router.js), for a
 * home the county values above similar homes, in a state with an entry in the appeal table. Off everywhere until the
 * founder switches a county on. Every word a person reads is in this file, for one read by a lawyer.
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
async function facts(home) {
  const copy = home ? homeRecords.liveCopy(home) : null;
  if (!copy || !router.appealPacketFor(copy.jurisdiction)) return { ok: false, reason: 'off' };
  const found = await similarHomes.forHome(home, copy);
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
async function forOwner(homeId, userId) {
  const access = await checkHomePermission(homeId, userId, 'home.view');
  if (!access.hasAccess || !access.isOwner) return { ok: false, reason: 'not_owner' };
  const { data: home, error } = await supabaseAdmin.from('Home').select(HOME_COLUMNS).eq('id', homeId).maybeSingle();
  if (error) throw new Error(`Home read failed: ${error.message}`);
  return facts(home);
}

// ─── The words ─────────────────────────────────────────────────────────────

const TITLE = 'Property value review packet';
const NOT_ADVICE = 'Information, not tax or legal advice. You file any petition yourself; Pantopus does not file for you or represent you.';

const FOOTER = 'Pantopus · Information, not tax or legal advice. You file it yourself; Pantopus does not represent you.';

const whatThisIs = (stateName) => `This packet puts the county's own figures for your home in one place, beside similar homes on your street, with how ${stateName} says a value is reviewed. Whether to ask for a review is your decision. You file any petition yourself. Pantopus does not file for you or represent you, and this is information, not tax or legal advice.`;

const STEPS = [
  'Find the notice of value the county sent you. The deadline printed on your own notice is the one that counts.',
  'Get the form from the official page named in part 3, or from your county assessor.',
  'Check part 1 against your notice. If the county has your home\'s size, age or features wrong, say so on the form: a wrong record is its own reason for a review.',
  'Look up homes like yours on your county assessor\'s public site and write them in the worksheet in part 5. Boards usually ask for specific homes.',
  'File the form with the board named in part 3 before the deadline, with a copy of this packet if it helps. Keep a copy of everything you file.',
];

const WORKSHEET_INTRO = (found) => `The comparison in part 2 used ${found.homes} similar homes on your street and gives their typical figure and range. It does not list them. Write the homes you look up here, from the county's public record.`;
const WORKSHEET_COLUMNS = ['Parcel number', 'Living area (sq ft)', 'Year built', 'County value', 'Value per sq ft'];
const WORKSHEET_ROWS = 6;

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
      'A worksheet for the homes you look up',
    ],
    rows: comparisonRows(packet.found).map(([label, value], index) => ({ id: `row_${index}`, label, value })),
    source: homeRecords.provenanceOf(packet.copy).label,
    note: NOT_ADVICE,
    file_name: 'pantopus-property-value-review-packet.pdf',
    // Free while there is no price: the founder sets one before it is sold.
    price: null,
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
    notes: ['Pantopus does not file for you or represent you. This is information, not tax or legal advice.'],
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

    heading('5. Worksheet: homes like yours');
    para(WORKSHEET_INTRO(found), { color: MUTED, size: 10 });
    if (doc.y > doc.page.height - 60 - (WORKSHEET_ROWS + 1) * 24 - 30) doc.addPage();
    const cell = width / WORKSHEET_COLUMNS.length;
    const top = doc.y + 4;
    WORKSHEET_COLUMNS.forEach((name, index) => {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(MUTED).text(name, left + index * cell + 4, top + 7, { width: cell - 8 });
    });
    for (let row = 0; row <= WORKSHEET_ROWS + 1; row += 1) {
      doc.moveTo(left, top + row * 24).lineTo(left + width, top + row * 24).lineWidth(0.6).strokeColor(RULE).stroke();
    }
    for (let column = 0; column <= WORKSHEET_COLUMNS.length; column += 1) {
      doc.moveTo(left + column * cell, top).lineTo(left + column * cell, top + (WORKSHEET_ROWS + 1) * 24).lineWidth(0.6).strokeColor(RULE).stroke();
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

module.exports = { forOwner, facts, summary, card, pdf, recordRows, comparisonRows, TITLE };
