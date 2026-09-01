/**
 * Block Founders (Wave 3, final slice) — the growth mechanic.
 *
 * Three moves, all riding live infrastructure:
 *   RANKS   "Verified home #2 on your block" — a permanent, scarce
 *           claim per geohash-6 cell, assigned first-come on a
 *           verified home's first read. The UNIQUE (geohash6, rank)
 *           constraint is the arbiter: racing instances retry into
 *           the next free rank, nobody mints a duplicate. Founding
 *           order is recorded from feature launch (documented — we do
 *           not fake historical order).
 *   METERS  per-section unlock progress ("bill benchmark: 4 of 10
 *           verified homes") from the density primitive's insider
 *           read. Shown ONLY to a T4 occupant of the cell — the route
 *           enforces it; previews and lower tiers keep the k-anon
 *           buckets.
 *   INVITES real Lob postcards to nearby addresses, wearing the
 *           neighbor-messaging safeguards wholesale: template-only
 *           content, sender anonymized to their street (never name or
 *           unit), 3/sender/week cap, 90-day per-recipient dedup
 *           across ALL senders (no pile-on), a permanent per-address
 *           opt-out registry checked before every send, and no
 *           invites to addresses already on Pantopus.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { encodeGeohash } = require('../utils/geohash');
const { computeAddressHash, expandAbbreviations } = require('../utils/normalizeAddress');
const { readRawCountForVerifiedInsider } = require('./place/densityReader');
const realRentService = require('./realRentService');
const { mailVendorService } = require('./addressValidation');
const { generateLetterCode } = require('./residencyLetterService');

const WEEKLY_INVITE_CAP = 3;
const RECIPIENT_DEDUP_DAYS = 90;
const RANK_RETRY_LIMIT = 5;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// The unlock meters.
//
// Two different readings, deliberately:
//   * `real_rent` counts RENT REPORTS in the cell, not verified homes.
//     It is the flagship unlock and the only meter whose progress the
//     resident can move by asking a neighbor — a block of 25 verified
//     owner-occupiers has no rents to pool, and a meter that claimed
//     otherwise would be a lie the section then fails to honor.
//   * the others count VERIFIED HOMES, which is what actually gates
//     them: bill_benchmark's floor is the audited k-anon minimum, and
//     the density bucket flips 'few' → 'growing' at 25.
const METERS = [
  { id: 'real_rent', label: 'Real rents on your block', needed: 10, source: 'rent_reports' },
  // Labelled for what it MEASURES, not for a section it does not
  // actually gate. bill_benchmark's real gate is BillBenchmark rows with
  // household_count >= 10, which needs neighbours to opt in and have
  // paid bills on file — a cell can hold 12 verified homes and still
  // have no benchmark. A meter reading "Bill benchmark 12 of 10 ·
  // unlocked" beside a section that says "not available" is the kind of
  // small lie that costs a product its credibility, so this one now
  // names the verified-home milestone it genuinely tracks.
  { id: 'verified_homes', label: 'Ten verified homes', needed: 10, source: 'verified_homes' },
  { id: 'block_growing', label: '“Growing block” status', needed: 25, source: 'verified_homes' },
];

class BlockFoundersError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function cellForHome(home) {
  // Number(null) is 0 — a finite value — so a missing coordinate must
  // be rejected BEFORE coercion or the home lands in the (0,0) cell.
  if (home.map_center_lat == null || home.map_center_lng == null) return null;
  const lat = Number(home.map_center_lat);
  const lng = Number(home.map_center_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return encodeGeohash(lat, lng, 6);
}

/**
 * The suppression key for one mailbox.
 *
 * Stricter than the platform-wide computeAddressHash, which lowercases
 * and expands abbreviations but keeps punctuation, keeps ZIP+4, and
 * leaves a unit inside line 1 — so one physical mailbox yields many
 * hashes ("1425 SE Oak St." vs "1425 SE Oak St" vs "…, Apt 2" vs
 * "97214-1234"). That is harmless for a lookup key and fatal for a
 * suppression list: the opt-out registry and the 90-day dedup exist to
 * protect someone who never asked to hear from us, and a promise a
 * trailing period defeats is not a promise.
 *
 * Deliberately NOT a change to computeAddressHash: that value is
 * persisted in Home.address_hash and HomeAddress.address_hash across
 * the platform, and re-defining it would invalidate every stored row.
 */
function suppressionHashFor(address) {
  // Order matters and the first version got it backwards: it stripped
  // punctuation to SPACES and then let computeAddressHash expand
  // abbreviations, so "S.E." became "s e" -> "south east" while "SE"
  // became "southeast". Two keys, one mailbox, opt-out defeated by a
  // period. Expansion must run on the raw token stream, then punctuation
  // goes away.
  const canon = (value) => expandAbbreviations(
    String(value || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim(),
  ).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  const raw = String(address.line1 || '');
  const unitMatch = UNIT_TOKEN_RE.exec(raw);
  const streetPart = raw.replace(UNIT_TOKEN_RE, '');
  // The unit designator is canonicalized away entirely: USPS delivers
  // "#2", "Unit 2", "Ste 2", "Apt 2" and "Apartment 2" to the same box,
  // so only the identifier itself may key the suppression.
  const unitId = unitMatch
    ? String(unitMatch[0]).toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(apartment|apt|unit|suite|ste|floor|fl|room|rm|no)/, '')
    : '';

  return crypto.createHash('sha256').update([
    canon(streetPart),
    unitId,
    // NOT abbreviation-expanded: "St Louis" must not become
    // "street louis", and a city is not a street.
    String(address.city || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(),
    String(address.state || '').toLowerCase().replace(/[^a-z]/g, ''),
    // ZIP+4 and ZIP5 are the same mailbox for suppression purposes.
    String(address.zip || '').replace(/\D/g, '').slice(0, 5),
  ].join('|')).digest('hex');
}

/** HTML-escape. Every interpolation into a postcard template goes through this. */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A unit token and everything after it is dropped: "123 Main St Apt 4B"
// must print as "Main St", never the sender's unit. '#' is handled
// separately because \b does not apply before a non-word character.
const UNIT_TOKEN_RE = /(\s(apt|apartment|unit|ste|suite|fl|floor|rm|room|no)\b.*$|\s*#.*$)/i;
const STREET_MAX_LEN = 40;

// A printable street must LOOK like a street, not merely end in one.
//
// Red-teaming the first version of this proved that a trailing street
// type is not a shape test: "Way", "Walk", "Run", "Row", "Path" and
// "Loop" are ordinary English words, so "Claim $500 at
// pantopus-refund.com Way" and "MIKE ROSSI AT 14B IS A MOLESTER - Way"
// both passed and were printed, in bold, on physical mail. The channel
// carries whatever language fits in the character whitelist.
//
// So the shape is now constrained the way a real street name is:
//   * at most 4 tokens before the street type (covers
//     "Martin Luther King Jr Blvd");
//   * no token longer than 15 characters;
//   * no run of 3+ digits anywhere (kills phone numbers);
//   * no token containing a dot followed by 2-4 letters (kills domains).
const STREET_TYPES = 'st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court'
  + '|pl|place|ter|terrace|pkwy|parkway|cir|circle|hwy|highway|way|trl|trail|loop|run|row|walk|path';
const STREET_SUFFIX_RE = new RegExp(`^[A-Za-z0-9 .'-]{1,40}\\b(${STREET_TYPES})\\.?$`, 'i');
const DIGIT_RUN_RE = /\d{3,}/;
const DOMAINISH_RE = /\.[A-Za-z]{2,4}\b/;
const STREET_TOKEN_MAX = 15;
const STREET_TOKENS_BEFORE_TYPE_MAX = 4;

/** Does this look like a street NAME, rather than a sentence ending in one? */
function looksLikeStreetName(value) {
  const v = String(value || '').trim();
  if (!v || !STREET_SUFFIX_RE.test(v)) return false;
  if (DIGIT_RUN_RE.test(v)) return false;
  if (DOMAINISH_RE.test(v)) return false;
  const tokens = v.split(/\s+/);
  if (tokens.length - 1 > STREET_TOKENS_BEFORE_TYPE_MAX) return false;
  return tokens.every((t) => t.length <= STREET_TOKEN_MAX);
}

/**
 * The ONLY sender-derived text that reaches a printed card: their street.
 *
 * SOURCE MATTERS MORE THAN SANITIZING. This used to read the free-text
 * `Home.address` (Joi accepts any 5-255 characters) and try to prove the
 * result was a street name. That cannot work: several real street types
 * are also ordinary English words, so "1 Call 555 0100 Now Free Money
 * Way" passes every shape check and prints verbatim on physical mail
 * sent under Pantopus's return address. An allowlist over attacker-
 * controlled prose is not a control.
 *
 * So the text now comes from `HomeAddress.address_line1_norm` — the
 * VENDOR-VALIDATED, normalized address. The sender's home is verified,
 * which means a postcard was physically delivered to it, so its
 * canonical address is a real deliverable street by construction; a
 * slogan cannot occupy that column. When it is missing for any reason
 * the card falls back to "your street" and reads perfectly well.
 *
 * The house-number strip, the unit strip, the character whitelist and
 * the HTML escape all remain, as defence in depth behind that source.
 *
 * @returns {Promise<string>}
 */
async function streetOnly(home) {
  let line1 = '';
  try {
    if (home && home.address_hash) {
      const { data } = await supabaseAdmin
        .from('HomeAddress')
        .select('address_line1_norm')
        .eq('address_hash', home.address_hash)
        .maybeSingle();
      line1 = String((data && data.address_line1_norm) || '');
    }
  } catch (err) {
    logger.warn('blockFounders: canonical street lookup failed', { homeId: home && home.id, error: err.message });
  }
  return sanitizeStreet(line1);
}

/** Pure: the printable street for an already-canonical line 1. */
function sanitizeStreet(line1) {
  const first = String(line1 || '').split(',')[0].trim();
  const withoutNumber = first.replace(/^[0-9][0-9A-Za-z-]*\s+/, '');
  const withoutUnit = withoutNumber.replace(UNIT_TOKEN_RE, '');
  const safe = withoutUnit
    .replace(/[^A-Za-z0-9 .'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, STREET_MAX_LEN)
    .trim();
  return looksLikeStreetName(safe) ? safe : 'your street';
}

/**
 * Assign (or return) the home's permanent founding rank in its cell.
 * First-come: rank = current row count + 1, retried on the unique
 * constraint when instances race — the loser takes the next number.
 * @returns {Promise<object|null>} the BlockFounder row, or null when
 *   the home has no usable coordinates.
 */
async function ensureFounderRank({ home, userId }) {
  const geohash6 = cellForHome(home);
  if (!geohash6) return null;

  const { data: existing } = await supabaseAdmin
    .from('BlockFounder')
    .select('*')
    .eq('home_id', home.id)
    .maybeSingle();
  if (existing) return existing;

  for (let attempt = 0; attempt < RANK_RETRY_LIMIT; attempt += 1) {
    const { count } = await supabaseAdmin
      .from('BlockFounder')
      .select('id', { count: 'exact', head: true })
      .eq('geohash6', geohash6);
    const rank = (count || 0) + 1 + attempt;

    const { data: inserted, error } = await supabaseAdmin
      .from('BlockFounder')
      .insert({
        id: crypto.randomUUID(),
        home_id: home.id,
        user_id: userId,
        geohash6,
        rank,
        established_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();
    if (inserted) return inserted;
    // Unique violation on (geohash6, rank) → someone else took it; on
    // (home_id) → someone else ranked THIS home concurrently: re-read.
    const { data: raced } = await supabaseAdmin
      .from('BlockFounder')
      .select('*')
      .eq('home_id', home.id)
      .maybeSingle();
    if (raced) return raced;
    if (error) logger.warn('blockFounders: rank insert retry', { homeId: home.id, rank, error: error.message });
  }
  logger.error('blockFounders: rank assignment exhausted retries', { homeId: home.id, geohash6 });
  return null;
}

/**
 * The founders panel for a VERIFIED occupant (route-gated T4):
 * their permanent rank, the cell's verified count, the unlock meters,
 * and this week's remaining invite budget.
 */
async function getBlockStatus({ home, userId }) {
  const geohash6 = cellForHome(home);
  if (!geohash6) return { available: false, reason: 'NO_COORDINATES' };

  const [founder, verifiedCount, rentReports, { count: weekCount }] = await Promise.all([
    ensureFounderRank({ home, userId }),
    readRawCountForVerifiedInsider(geohash6),
    realRentService.countCellReports(geohash6),
    supabaseAdmin
      .from('BlockInvite')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', userId)
      .gte('created_at', new Date(Date.now() - WEEK_MS).toISOString()),
  ]);

  const readingFor = (source) => (source === 'rent_reports' ? rentReports : verifiedCount);

  return {
    available: true,
    rank: founder ? founder.rank : null,
    established_at: founder ? founder.established_at : null,
    verified_count: verifiedCount,
    rent_reports: rentReports,
    meters: METERS.map((m) => {
      const reading = readingFor(m.source);
      return {
        id: m.id,
        label: m.label,
        current: Math.min(reading, m.needed),
        needed: m.needed,
        unlocked: reading >= m.needed,
      };
    }),
    invites_remaining: Math.max(0, WEEKLY_INVITE_CAP - (weekCount || 0)),
    invites_weekly_cap: WEEKLY_INVITE_CAP,
  };
}

// ── Invites ──────────────────────────────────────────────────

// The RECIPIENT address is the second sender-controlled text channel
// onto the same physical card: Lob prints line1 and city in the
// delivery block. The old version allowed 100 arbitrary characters in
// line1 and 60 in city, so a sender could mail a stranger a card whose
// address block read "MIKE ROSSI AT 14B IS A MOLESTER" — larger, and
// with no sanitizer at all, than the sender-street channel that was
// being so carefully guarded.
//
// A US delivery line has a shape: house number, street name, optional
// unit. Requiring it costs nothing (a malformed address would not have
// been delivered anyway) and closes the channel.
const HOUSE_NUMBER_RE = /^\d+[A-Za-z]?(-\d+[A-Za-z]?)?\s+/;
const CITY_RE = /^[A-Za-z][A-Za-z .'-]{1,29}$/;
const RECIPIENT_LINE1_MAX = 60;

function cleanAddressInput(recipient) {
  const line1 = String((recipient && recipient.line1) || '').replace(/\s+/g, ' ').trim().slice(0, RECIPIENT_LINE1_MAX);
  const city = String((recipient && recipient.city) || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  // Validate BEFORE truncating — 'Oregon'.slice(0, 2) would silently
  // pass as 'OR' when the sender typed the wrong thing.
  const stateRaw = String((recipient && recipient.state) || '').trim();
  const state = /^[A-Za-z]{2}$/.test(stateRaw) ? stateRaw.toUpperCase() : '';
  const zip = String((recipient && recipient.zip) || '').trim().slice(0, 10);
  if (!line1 || !city || !/^[A-Z]{2}$/.test(state) || !/^\d{5}(-\d{4})?$/.test(zip)) {
    throw new BlockFoundersError('Enter the neighbor\'s street address, city, state, and ZIP.', 'BAD_ADDRESS');
  }
  // Shape, not just presence: a house number, then something that reads
  // as a street name (with an optional unit after it).
  const rest = line1.replace(HOUSE_NUMBER_RE, '');
  const streetPart = rest.replace(UNIT_TOKEN_RE, '').trim();
  if (!HOUSE_NUMBER_RE.test(line1) || !looksLikeStreetName(streetPart) || !CITY_RE.test(city)) {
    throw new BlockFoundersError(
      'That does not look like a US street address. Enter it as it appears on the mailbox.',
      'BAD_ADDRESS',
    );
  }
  return { line1, city, state, zip };
}

function inviteFrontHtml() {
  return `<html><body style="width:6.25in;height:4.25in;margin:0;display:flex;align-items:center;justify-content:center;background:#0284c7;color:#fff;font-family:Helvetica,Arial,sans-serif;">
    <div style="text-align:center;padding:0.4in;">
      <div style="font-size:34px;font-weight:bold;">Your block is forming</div>
      <div style="font-size:16px;margin-top:12px;">Verified neighbors on your street are already comparing bills, flood costs, and more.</div>
    </div></body></html>`;
}

function inviteBackHtml({ street, verifiedCount, optOutCode }) {
  // A failed density read arrives as null, NOT 0 — printing "0 homes
  // near you are already verified" on a card because a query failed is
  // a confident statement we cannot support. Unknown falls back to the
  // sentence that is true either way.
  const countLine = Number.isFinite(verifiedCount) && verifiedCount >= 2
    ? `${escapeHtml(verifiedCount)} homes near you are already verified.`
    : 'Your neighbors are starting to verify their homes.';
  // Every interpolated value is escaped. `street` derives from
  // sender-controlled text (see streetOnly) and `optOutCode` is the
  // recipient's kill switch — markup reaching either would let a sender
  // author the card or hide the opt-out line.
  return `<html><body style="width:6.25in;height:4.25in;margin:0;font-family:Helvetica,Arial,sans-serif;color:#111827;">
    <div style="padding:0.45in 0.5in;">
      <div style="font-size:15px;line-height:1.5;">A verified neighbor on <b>${escapeHtml(street)}</b> invited this address to Pantopus. ${countLine}</div>
      <div style="font-size:15px;line-height:1.5;margin-top:10px;">See what your address already knows — flood risk, air quality, what neighbors pay for utilities — free, no account needed:</div>
      <div style="font-size:22px;font-weight:bold;margin-top:10px;">pantopus.com/start</div>
      <div style="font-size:10px;color:#6b7280;margin-top:26px;line-height:1.5;">This invitation was mailed through Pantopus; the sender chose the address but never wrote this text, and your address was not shared with anyone. To never receive another: pantopus.com/no-mail/${escapeHtml(optOutCode)}</div>
    </div></body></html>`;
}

/**
 * Send one template postcard invite. Every safeguard is checked
 * server-side, in order, before any money is spent:
 * opt-out registry → already-on-Pantopus → 90-day recipient dedup →
 * sender weekly cap.
 */
async function sendInvite({ home, userId, recipient }) {
  const geohash6 = cellForHome(home);
  if (!geohash6) throw new BlockFoundersError('This home has no usable location.', 'NO_COORDINATES');

  const address = cleanAddressInput(recipient);
  // TWO hashes, deliberately:
  //   * memberHash uses the platform-wide computeAddressHash, because it
  //     is compared against Home.address_hash which is written with it;
  //   * suppressionHash is the STRICTER form (punctuation stripped, ZIP+4
  //     truncated, unit split out) used for the opt-out registry and the
  //     dedup. Those two are promises to a person who never asked to
  //     hear from us, and the loose hash let trivial formatting variants
  //     of one mailbox ("1425 SE Oak St." vs "1425 SE Oak St") defeat
  //     both — a permanent opt-out that a period bypasses is not one.
  // Home.address_hash is written platform-wide with computeAddressHash,
  // so the already-member gate must use it — but the RAW input is
  // normalized first, or a trailing period defeats the gate and mails a
  // recruitment card to an existing member.
  const memberHash = computeAddressHash(
    address.line1.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim(),
    '',
    address.city.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim(),
    address.state,
    address.zip.replace(/\D/g, '').slice(0, 5),
  );
  const suppressionHash = suppressionHashFor(address);

  // Read the registry under BOTH hashes. A suppression must never
  // regress because the hashing scheme changed underneath it.
  const { data: optedOutRows } = await supabaseAdmin
    .from('BlockInviteOptOut')
    .select('address_hash')
    .in('address_hash', [suppressionHash, memberHash]);
  if (optedOutRows && optedOutRows.length > 0) {
    throw new BlockFoundersError('That address has asked not to receive invitations.', 'OPTED_OUT');
  }

  const { data: existingHome } = await supabaseAdmin
    .from('Home')
    .select('id')
    .eq('address_hash', memberHash)
    .maybeSingle();
  if (existingHome) {
    throw new BlockFoundersError('That address is already on Pantopus.', 'ALREADY_MEMBER');
  }

  const dedupSince = new Date(Date.now() - RECIPIENT_DEDUP_DAYS * DAY_MS).toISOString();
  const { count: recentToRecipient } = await supabaseAdmin
    .from('BlockInvite')
    .select('id', { count: 'exact', head: true })
    .in('recipient_address_hash', [suppressionHash, memberHash])
    .gte('created_at', dedupSince);
  if ((recentToRecipient || 0) > 0) {
    throw new BlockFoundersError('That address was invited recently — one invitation per season, from anyone.', 'RECENTLY_INVITED');
  }

  const { count: weekCount } = await supabaseAdmin
    .from('BlockInvite')
    .select('id', { count: 'exact', head: true })
    .eq('sender_user_id', userId)
    .gte('created_at', new Date(Date.now() - WEEK_MS).toISOString());
  if ((weekCount || 0) >= WEEKLY_INVITE_CAP) {
    throw new BlockFoundersError(`You've sent this week's ${WEEKLY_INVITE_CAP} invitations.`, 'WEEKLY_CAP');
  }

  // ── RESERVE, then verify, then spend ────────────────────────
  //
  // The checks above are read-then-write with nothing serializing them.
  // Fired concurrently they all pass, and every request then mails a
  // real postcard: the weekly cap and the 90-day dedup are both
  // bypassable by parallelism, and the money is already gone by the
  // time the rows land.
  //
  // So the row goes in FIRST, as a reservation, and the invariants are
  // re-counted with it present. A loser deletes its own reservation and
  // refuses. Two racers can both abort (the user retries) — that is the
  // right direction to fail for something that spends money and mails a
  // stranger.
  //
  // Reserving first also fixes the old ordering's other flaw: the card
  // used to be mailed BEFORE the record existed, so a failed insert
  // meant a postcard in the mail with no row — invisible to the dedup,
  // and with an opt-out code that redeemed to nothing.
  const optOutCode = generateLetterCode();
  const nowIso = new Date().toISOString();
  const reservationId = crypto.randomUUID();
  const { error: reserveErr } = await supabaseAdmin
    .from('BlockInvite')
    .insert({
      id: reservationId,
      sender_home_id: home.id,
      sender_user_id: userId,
      geohash6,
      // The SUPPRESSION hash: this column feeds the 90-day dedup and,
      // via redeemOptOut, the permanent registry — both must be immune
      // to formatting variants of the same mailbox.
      recipient_address_hash: suppressionHash,
      recipient_address: address,
      opt_out_code: optOutCode,
      status: 'reserved',
      created_at: nowIso,
    });
  if (reserveErr) {
    logger.error('blockFounders: invite reservation failed', { userId, error: reserveErr.message });
    throw new BlockFoundersError('The invitation could not be sent. Try again shortly.', 'SEND_FAILED');
  }

  const releaseReservation = async () => {
    await supabaseAdmin.from('BlockInvite').delete().eq('id', reservationId);
  };

  // Re-count WITH the reservation present. Anything above the allowance
  // means a concurrent request beat us to the budget.
  const [{ count: recipientNow }, { count: weekNow }] = await Promise.all([
    supabaseAdmin
      .from('BlockInvite')
      .select('id', { count: 'exact', head: true })
      .in('recipient_address_hash', [suppressionHash, memberHash])
      .gte('created_at', dedupSince),
    supabaseAdmin
      .from('BlockInvite')
      .select('id', { count: 'exact', head: true })
      .eq('sender_user_id', userId)
      .gte('created_at', new Date(Date.now() - WEEK_MS).toISOString()),
  ]);
  if ((recipientNow || 0) > 1) {
    await releaseReservation().catch(() => {});
    throw new BlockFoundersError('That address was invited recently — one invitation per season, from anyone.', 'RECENTLY_INVITED');
  }
  if ((weekNow || 0) > WEEKLY_INVITE_CAP) {
    await releaseReservation().catch(() => {});
    throw new BlockFoundersError(`You've sent this week's ${WEEKLY_INVITE_CAP} invitations.`, 'WEEKLY_CAP');
  }

  const verifiedCount = await readRawCountForVerifiedInsider(geohash6);
  const provider = mailVendorService.getProvider();
  let lob;
  try {
    lob = await provider.sendCustomPostcard(address, {
      description: 'Pantopus block invite',
      frontHtml: inviteFrontHtml(),
      backHtml: inviteBackHtml({ street: await streetOnly(home), verifiedCount, optOutCode }),
    });
  } catch (err) {
    // Nothing was mailed, so the reservation must not linger — it would
    // silently consume the sender's budget and suppress the recipient.
    await releaseReservation().catch(() => {});
    logger.error('blockFounders: invite send failed', { userId, error: err.message });
    throw new BlockFoundersError('The postcard could not be sent. Try again shortly.', 'SEND_FAILED');
  }

  const { error: confirmErr } = await supabaseAdmin
    .from('BlockInvite')
    .update({ status: 'created', lob_id: lob.vendorJobId })
    .eq('id', reservationId);
  if (confirmErr) {
    // The card IS in the mail and the reservation row already carries
    // the opt-out code and the recipient hash, so the safeguards hold;
    // only the vendor id is lost.
    logger.error('blockFounders: invite confirm failed', { inviteId: reservationId, error: confirmErr.message });
  }
  logger.info('blockFounders: invite sent', { inviteId: reservationId, geohash6 });
  return { sent: true, invites_remaining: Math.max(0, WEEKLY_INVITE_CAP - (weekNow || 0)) };
}

/**
 * Redeem an opt-out code from a mailed card: permanently silences
 * invites to that recipient address from all senders. Idempotent;
 * unknown codes are a uniform { done: false } (no oracle).
 */
async function redeemOptOut(code) {
  const normalized = String(code || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  if (normalized.length !== 16) return { done: false };
  const formatted = normalized.match(/.{4}/g).join('-');

  const { data: invite } = await supabaseAdmin
    .from('BlockInvite')
    .select('recipient_address_hash')
    .eq('opt_out_code', formatted)
    .maybeSingle();
  if (!invite) return { done: false };

  const { error } = await supabaseAdmin
    .from('BlockInviteOptOut')
    .upsert({ address_hash: invite.recipient_address_hash, created_at: new Date().toISOString() });
  if (error) {
    logger.error('blockFounders: opt-out upsert failed', { error: error.message });
    return { done: false };
  }
  return { done: true };
}

module.exports = {
  getBlockStatus,
  sendInvite,
  redeemOptOut,
  BlockFoundersError,
  WEEKLY_INVITE_CAP,
  // Exported for testing.
  ensureFounderRank,
  cellForHome,
  streetOnly,
  sanitizeStreet,
  cleanAddressInput,
  suppressionHashFor,
  inviteBackHtml,
  escapeHtml,
  METERS,
};
