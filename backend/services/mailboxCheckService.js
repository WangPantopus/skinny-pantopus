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
const addressConfig = require('../config/addressVerification');
const { usesGooglePostal } = require('./addressValidation/postalAdapter');

// A failed re-check waits this long before an open screen tries again.
const RECHECK_RETRY_MS = 10 * 60 * 1000;
// Google usually answers in under 200 ms, so a screen can open on the new answer.
const RECHECK_WAIT_MS = 1500;
const recheckTriedAt = new Map();

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

function uspsDataIsOld(addr) {
  const checkedAt = Date.parse(addr.last_validated_at);
  const maxAgeMs = (addressConfig.postal?.uspsDataDays || 30) * 24 * 60 * 60 * 1000;
  return !Number.isFinite(checkedAt) || Date.now() - checkedAt > maxAgeMs;
}

function checkedOnSentence(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const date = when.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return ` USPS was last checked on ${date}.`;
}

/**
 * Asks USPS again. A slow answer doesn't hold the screen: the check finishes in the background, and
 * screens that listen for the Home row changing refresh themselves.
 *
 * @returns {Promise<boolean>} true when the stored answer changed in time for this response
 */
function recheckBriefly(addressId, homeId) {
  const triedAt = recheckTriedAt.get(addressId);
  if (triedAt && Date.now() - triedAt < RECHECK_RETRY_MS) return Promise.resolve(false);
  recheckTriedAt.set(addressId, Date.now());

  const recheck = (async () => {
    const { data: address, error } = await supabaseAdmin
      .from('HomeAddress')
      .select('*')
      .eq('id', addressId)
      .maybeSingle();
    if (error || !address) return false;
    const { recheckAddress } = require('./addressValidation/postalRecheckService');
    const outcome = await recheckAddress(address, [{ id: homeId, created_by_user_id: null }]);
    if (outcome === 'unavailable') return false;
    await supabaseAdmin.from('Home').update({ updated_at: new Date().toISOString() }).eq('id', homeId);
    return true;
  })().catch((err) => {
    logger.warn('mailboxCheck: background re-check failed', { addressId, error: err.message });
    return false;
  });

  const waited = new Promise((resolve) => {
    setTimeout(resolve, RECHECK_WAIT_MS, false).unref();
  });
  return Promise.race([recheck, waited]);
}

async function loadHomeAndAddress(homeId) {
  const { data: home, error: homeErr } = await supabaseAdmin
    .from('Home')
    .select('id, address, address2, city, state, zipcode, country, address_id, address_hash')
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

  return { home, addr };
}

/**
 * Compose the diagnostic for a home from its stored HomeAddress
 * validation + the caller's recorded postcard (the physical leg).
 * @returns {Promise<object|null>} null when the home doesn't exist.
 */
async function getMailboxCheck({ homeId, userId }) {
  let loaded = await loadHomeAndAddress(homeId);
  if (!loaded) return null;

  const googlePostal = usesGooglePostal();
  // An address still pending belongs to the re-check job, which tells the person what it found.
  const uspsAnswerIsOld = (row) => googlePostal && row && row.validation_raw_response?.postal_state !== 'pending'
    && (uspsDataIsOld(row) || !!row.validation_raw_response?.postal_cleared_at);

  if (uspsAnswerIsOld(loaded.addr) && await recheckBriefly(loaded.addr.id, homeId)) {
    loaded = (await loadHomeAndAddress(homeId)) || loaded;
  }
  const { home, addr } = loaded;

  const findings = [];

  const dpv = addr ? addr.dpv_match_code : null;
  const postalState = addr?.validation_raw_response?.postal_state;

  if (googlePostal && postalState === 'failed') {
    findings.push(finding('attention', 'Please check this address',
      'USPS couldn’t confirm it. You can verify another way, or add your home again with the right details.'));
  } else if (googlePostal && postalState === 'pending') {
    findings.push(finding('info', 'We couldn’t check this address with USPS yet',
      'We’ll try again shortly. Your postcard can go out after that.'));
  } else if (uspsAnswerIsOld(addr) && !dpv) {
    findings.push(finding('info', 'Checking this address with USPS again',
      'USPS answers are kept for 30 days, so a new check is running now. Check back soon.'));
  } else {
    findings.push(dpvFinding(dpv));
  }

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
  if (addr && (addr.rdi_type === 'commercial' || addr.rdi_type === 'business')) {
    findings.push(finding('info', 'USPS classifies this address as commercial',
      'Residential-only delivery services may surcharge or refuse it, and some forms treat it differently from a home address.'));
  }
  if (addr && (addr.missing_secondary_flag || addr.secondary_required) && dpv !== 'D' && dpv !== 'S') {
    findings.push(finding('attention', 'This building expects unit numbers',
      'USPS expects a unit/secondary number at this address. If deliveries go missing, make sure every service has your exact unit.'));
  }

  // Household approval and legacy/address verification can all grant access
  // without a postcard. Read the same latest per-caller record used by the
  // postal status flow; never infer delivery from HomeOccupancy.
  if (!userId) throw new Error('A caller is required for the mailbox check.');
  const { data: postcard, error: postcardError } = await supabaseAdmin
    .from('HomePostcardCode')
    .select('status, verified_at, expires_at, dispatch_status, vendor_job_id, destination, mail_outcome')
    .eq('home_id', homeId)
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (postcardError) throw new Error('Could not read postcard verification.');

  // Preserve the existing postal flow's exact destination binding. Historical
  // cards without a destination cannot prove the Home's current address.
  const matchesAddress = postcard?.destination && (home.country || 'US') === 'US'
    && ['address', 'address2', 'city', 'state', 'zipcode']
      .every(key => (postcard.destination[key] ?? null) === (home[key] ?? null));
  let physical = {
    status: 'not_run',
    title: 'No postcard verification on file',
    detail: 'No completed postcard verification is recorded for your account at this address.',
  };
  if (matchesAddress && postcard.status === 'verified' && Number.isFinite(Date.parse(postcard.verified_at))) {
    physical = {
      status: 'proven',
      title: 'Postcard verification recorded',
      detail: 'A verification postcard sent to this address had its code confirmed for your account.',
    };
  } else if (matchesAddress && postcard.status === 'pending'
    && Date.parse(postcard.expires_at) > Date.now() && postcard.dispatch_status !== 'rejected') {
    if (postcard.dispatch_status === 'accepted' && postcard.vendor_job_id) {
      physical = {
        status: 'in_progress',
        title: 'Verification postcard accepted for mailing',
        detail: 'The mail provider accepted your postcard. Delivery and code confirmation are still unverified.',
      };
    } else if (postcard.dispatch_status === 'pending') {
      physical = {
        status: 'in_progress',
        title: 'Your postcard request is saved',
        detail: 'Mailing has not been confirmed. Check your postcard status before requesting another card.',
      };
    } else {
      physical = {
        status: 'in_progress',
        title: 'Postcard delivery is unconfirmed',
        detail: 'Your postcard request is recorded, but delivery is not confirmed. You can enter its code if it arrives.',
      };
    }
  }

  if (matchesAddress && postcard.status === 'cancelled') {
    const title = {
      returned: 'Your last postcard came back undeliverable',
      rerouted: 'USPS re-routed your last postcard',
      failed: 'We couldn\'t print or mail your last postcard',
    }[postcard.mail_outcome || (postcard.dispatch_status === 'rejected' ? 'failed' : '')];
    if (title) {
      physical = { status: 'not_run', title, detail: 'Its code won\'t work. Check the address and send another, or verify another way.' };
    }
  }

  // Apps show a finding's own words, so the date reaches every build this way.
  if (googlePostal && dpv && addr?.last_validated_at) {
    const checkedOn = checkedOnSentence(addr.last_validated_at);
    for (const item of findings) item.detail += checkedOn;
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
