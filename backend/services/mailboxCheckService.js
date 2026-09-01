/**
 * Mailbox Reality Check (Wave 1, #3)
 *
 * "Can USPS, lenders, and delivery apps actually find your address?"
 * — answered from data the claim pipeline ALREADY collected (the
 * Smarty/Google validation stored on HomeAddress: DPV match, RDI type,
 * vacancy, missing-unit flags), plus the postcard as the physical leg.
 * Zero new vendor calls: this productizes the verification step into a
 * diagnostic with results and fix-it guidance.
 *
 * Honesty rules:
 *   * every finding names its source ("USPS's deliverability database")
 *     and what Pantopus can and cannot do — we point at the fix, we
 *     cannot edit USPS records;
 *   * no data on file is said plainly ("no postal check is on file"),
 *     never dressed up as a pass;
 *   * the postcard is presented as what it is: the end-to-end physical
 *     proof that mail reaches the box.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// severity: ok < info < attention < problem
const SEVERITY_RANK = { ok: 0, info: 1, attention: 2, problem: 3 };

function finding(severity, title, detail) {
  return { severity, title, detail };
}

/**
 * Interpret the stored DPV match code.
 * Y = confirmed; S = confirmed, secondary ignored; D = confirmed,
 * secondary missing; N = not deliverable per USPS.
 */
function dpvFinding(dpv) {
  switch (dpv) {
    case 'Y':
      return finding('ok', 'USPS confirms this exact address', 'The full address, unit included, matches USPS’s deliverability database.');
    case 'S':
      return finding('attention', 'Your unit number isn’t matching', 'USPS confirms the address but ignored the unit/secondary you entered — carriers and shippers may drop it. Double-check the unit format against what your building uses.');
    case 'D':
      return finding('attention', 'A unit number is missing', 'USPS confirms the building but expects a unit/secondary number that isn’t on file here — without it, carriers may not find your door.');
    case 'N':
      return finding('problem', 'USPS doesn’t recognize this address', 'This address isn’t in USPS’s deliverability database — common for new construction and ADUs. Ask your local Post Office to register it with their Address Management office; Pantopus can’t change USPS records for you.');
    default:
      return finding('info', 'No postal check on file', 'This address hasn’t been run through a postal database check yet, so we can’t say how databases see it.');
  }
}

/**
 * Compose the diagnostic for a home from its stored HomeAddress
 * validation + the caller's occupancy (the physical leg).
 * @returns {Promise<object|null>} null when the home doesn't exist.
 */
async function getMailboxCheck({ homeId, occupancy }) {
  const { data: home, error: homeErr } = await supabaseAdmin
    .from('Home')
    .select('id, address, address2, city, state, zipcode, address_id, address_hash')
    .eq('id', homeId)
    .maybeSingle();
  if (homeErr || !home) return null;

  let addr = null;
  if (home.address_id) {
    const { data } = await supabaseAdmin
      .from('HomeAddress')
      .select('id, dpv_match_code, rdi_type, deliverability_status, missing_secondary_flag, commercial_mailbox_flag, secondary_required, building_type, last_validated_at, validation_raw_response')
      .eq('id', home.address_id)
      .maybeSingle();
    addr = data || null;
  }
  if (!addr && home.address_hash) {
    const { data } = await supabaseAdmin
      .from('HomeAddress')
      .select('id, dpv_match_code, rdi_type, deliverability_status, missing_secondary_flag, commercial_mailbox_flag, secondary_required, building_type, last_validated_at, validation_raw_response')
      .eq('address_hash', home.address_hash)
      .maybeSingle();
    addr = data || null;
  }

  const findings = [];

  const dpv = addr ? addr.dpv_match_code : null;
  findings.push(dpvFinding(dpv));

  // vacant_flag lives inside the Smarty blob the pipeline stores as
  // validation_raw_response (migration 066) — there is no raw_response column.
  const raw = (addr && addr.validation_raw_response) || {};
  if (raw.vacant_flag) {
    findings.push(finding('attention', 'USPS lists this address as vacant',
      'The vacancy flag is common right after a move-in, and some shippers hold or refuse deliveries while it’s set. Ask your mail carrier or local Post Office to clear it once you’re receiving mail.'));
  }
  if (addr && addr.commercial_mailbox_flag) {
    findings.push(finding('info', 'This is a commercial mail receiving agency',
      'USPS classifies this address as a CMRA (a mailbox service). Some banks and agencies refuse CMRA addresses as proof of residence.'));
  }
  if (addr && addr.rdi_type === 'commercial') {
    findings.push(finding('info', 'USPS classifies this address as commercial',
      'Residential-only delivery services may surcharge or refuse it, and some forms treat it differently from a home address.'));
  }
  if (addr && (addr.missing_secondary_flag || addr.secondary_required) && dpv !== 'D' && dpv !== 'S') {
    findings.push(finding('attention', 'This building expects unit numbers',
      'USPS expects a unit/secondary number at this address. If deliveries go missing, make sure every service has your exact unit.'));
  }

  // The physical leg — the postcard IS the end-to-end test.
  const verification = occupancy && occupancy.verification_status;
  let physical;
  if (verification === 'verified') {
    physical = {
      status: 'proven',
      title: 'Mail physically reaches this mailbox',
      detail: 'A Pantopus verification postcard was delivered here and its code entered — the end-to-end proof that real mail arrives.',
    };
  } else if (verification === 'pending') {
    physical = {
      status: 'in_progress',
      title: 'The physical test is in the mail',
      detail: 'Your verification postcard is the real-world leg of this check: when its code arrives, you’ll have proven the mailbox works.',
    };
  } else {
    physical = {
      status: 'not_run',
      title: 'The physical test hasn’t run',
      detail: 'Verifying your address mails a real postcard here — the definitive test that mail reaches this box, and it unlocks your verified badge.',
    };
  }

  const worst = findings.reduce((acc, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc] ? f.severity : acc), 'ok');
  const verdict = dpv == null
    ? 'unknown'
    : worst === 'problem'
      ? 'problem'
      : worst === 'attention'
        ? 'needs_attention'
        : 'looks_good';

  return {
    verdict,
    findings,
    physical,
    checked_at: (addr && addr.last_validated_at) || null,
  };
}

module.exports = {
  getMailboxCheck,
  // Exported for testing.
  dpvFinding,
};
