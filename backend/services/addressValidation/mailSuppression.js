/**
 * Mail suppression: the checks that run before any card is printed, retries included.
 *
 * The opt-out registry (BlockInviteOptOut) holds address hashes only. Its 'invites'
 * rows are a recipient's permanent opt-out from invitations. Its 'all_mail' rows are a
 * protected person's no-mail flag, which stops every card, verification cards too.
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const supabaseAdmin = require('../../config/supabaseAdmin');
const { expandAbbreviations } = require('../../utils/normalizeAddress');

// A unit token and everything after it is dropped: "123 Main St Apt 4B"
// must print as "Main St", never the sender's unit. '#' is handled
// separately because \b does not apply before a non-word character.
const UNIT_TOKEN_RE = /(\s(apt|apartment|unit|ste|suite|fl|floor|rm|room|no)\b.*$|\s*#.*$)/i;

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

/** The same key for a destination that keeps its unit on a second line. */
function suppressionHashForDestination({ line1, line2, city, state, zip }) {
  const unit = String(line2 || '').trim();
  const designated = unit && !/^(apt|apartment|unit|ste|suite|fl|floor|rm|room|no)\b|^#/i.test(unit) ? `# ${unit}` : unit;
  return suppressionHashFor({ line1: [line1, designated].filter(Boolean).join(' '), city, state, zip });
}

/**
 * May a card go to this destination at all? A registry that can't be read refuses the
 * send: a card to a protected address can't be unsent. Nothing in the answer tells a
 * person why, because that would reveal that someone protected lives there.
 *
 * @param {{line1: string, line2?: string, city: string, state: string, zip: string}} destination
 * @returns {Promise<boolean>} true when the card must not go out
 */
async function noMailToDestination(destination) {
  const { data, error } = await supabaseAdmin
    .from('BlockInviteOptOut')
    .select('address_hash')
    .eq('address_hash', suppressionHashForDestination(destination))
    .eq('scope', 'all_mail')
    .limit(1);
  if (error) {
    logger.error('mailSuppression: registry read failed; refusing the send', { error: error.message });
    return true;
  }
  return (data || []).length > 0;
}

module.exports = { UNIT_TOKEN_RE, suppressionHashFor, suppressionHashForDestination, noMailToDestination };
