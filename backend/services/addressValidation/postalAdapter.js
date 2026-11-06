/**
 * Postal adapter: the USPS answer Google already returned, in the shape the decision engine takes.
 *
 * With ADDRESS_POSTAL_PROVIDER=google, Add Home needs one check and one key instead of Google
 * followed by Smarty. A field Google left out stays unknown (null), never "no".
 *
 * Google's fields: https://developers.google.com/maps/documentation/address-validation/reference/rest/v1/TopLevel/validateAddress
 */

const addressConfig = require('../../config/addressVerification');

/** @typedef {import('./types').GoogleValidationResult} GoogleValidationResult */
/** @typedef {import('./types').GooglePostalInput} GooglePostalInput */

const DPV_ANSWERS = new Set(['Y', 'N', 'D', 'S']);
const UNIT_REQUIRED_FOOTNOTES = ['N1', 'C1'];

function usesGooglePostal() {
  return addressConfig.postal?.provider === 'google';
}

function postalShadowEnabled() {
  return addressConfig.postal?.shadow === 'google';
}

/** "AABBR1" → ['AA', 'BB', 'R1'] */
function splitFootnotes(value) {
  return String(value || '').match(/.{1,2}/g) || [];
}

function rdiFromMetadata(metadata) {
  if (metadata?.residential === true) return 'residential';
  if (metadata?.business === true) return 'commercial';
  return 'unknown';
}

/**
 * @param {GoogleValidationResult} google
 * @returns {GooglePostalInput}
 */
function postalFromGoogle(google) {
  const usps = google?.usps_data || null;
  const metadata = google?.metadata || null;
  // Not CASS processed, or USPS checks suspended for the account: USPS gave no answer at all.
  const answered = !!usps && usps.cass_processed !== false && !usps.suspended;
  const dpv = answered && DPV_ANSWERS.has(usps.dpv_match_code) ? usps.dpv_match_code : '';
  const footnotes = answered ? splitFootnotes(usps.dpv_footnote) : [];
  const streetNumber = google?.components?.street_number;

  return {
    source: 'google',
    from_cache: false,
    inconclusive: false,
    dpv_match_code: dpv,
    rdi_type: rdiFromMetadata(metadata),
    home_and_business: metadata?.residential === true && metadata?.business === true,
    missing_secondary: dpv === 'D' || UNIT_REQUIRED_FOOTNOTES.some((code) => footnotes.includes(code)),
    unconfirmed_secondary: dpv === 'S' || footnotes.includes('CC'),
    commercial_mailbox: answered ? usps.dpv_cmra ?? null : null,
    vacant_flag: answered ? usps.dpv_vacant ?? null : null,
    no_stat: answered ? usps.dpv_no_stat ?? null : null,
    no_stat_reason: answered ? usps.dpv_no_stat_reason ?? null : null,
    footnotes,
    record_type: answered ? usps.address_record_type || null : null,
    carrier_route_type: answered ? usps.carrier_route_type || null : null,
    po_box_flag: metadata?.po_box ?? null,
    po_box_only_zip: answered ? usps.po_box_only_zip === true : false,
    coming_soon: answered && usps.ews_flag === true,
    // USPS has no such number, yet Google's map data confirms it: in real answers this is new
    // construction USPS hasn't listed yet. A mistyped number comes back unconfirmed by Google.
    not_listed: dpv === 'N'
      && footnotes.includes('M3')
      && streetNumber?.confirmed === true
      && !streetNumber.inferred
      && !google?.verdict?.hasUnconfirmedComponents,
    cass_processed: usps ? usps.cass_processed ?? null : null,
    usps_suspended: !!usps?.suspended,
    checked_at: new Date().toISOString(),
  };
}

const blank = (value) => !String(value || '').trim();

/**
 * What the person typed stays on the normalized address where Google dropped it: a "check your
 * unit" answer never loses the unit, and a Puerto Rico address with no street number keeps its line.
 */
function keepTypedAddress(google, input) {
  if (!google?.normalized || !input) return google;
  const normalized = { ...google.normalized };
  if (blank(normalized.line2) && !blank(input.line2)) normalized.line2 = String(input.line2).trim();
  for (const [field, typed] of [['city', input.city], ['state', input.state], ['zip', input.zip]]) {
    if (blank(normalized[field]) && !blank(typed)) normalized[field] = String(typed).trim();
  }
  const missingStreetNumber = (google.missing_component_types || []).includes('street_number');
  if (!blank(input.line1) && (blank(normalized.line1) || missingStreetNumber)) {
    normalized.line1 = String(input.line1).trim();
  }
  return { ...google, normalized };
}

/** The categories shadow mode counts: Google's own answer, with no address in it. */
function postalCategories(postal, verdict) {
  const yesNo = (value) => (value === true ? 'yes' : value === false ? 'no' : 'unknown');
  return {
    dpv: postal.dpv_match_code || 'blank',
    footnotes: postal.footnotes.filter((code) => !['AA', 'BB'].includes(code)).sort().join(',') || 'none',
    home_or_business: postal.home_and_business ? 'both' : postal.rdi_type,
    mail_drop: yesNo(postal.commercial_mailbox),
    vacant: yesNo(postal.vacant_flag),
    no_stat: yesNo(postal.no_stat),
    record_type: postal.record_type || 'none',
    route: postal.carrier_route_type || 'none',
    cass_processed: yesNo(postal.cass_processed),
    usps_suspended: postal.usps_suspended ? 'yes' : 'no',
    verdict: verdict?.status || 'unknown',
  };
}

module.exports = {
  usesGooglePostal,
  postalShadowEnabled,
  splitFootnotes,
  postalFromGoogle,
  keepTypedAddress,
  postalCategories,
};
