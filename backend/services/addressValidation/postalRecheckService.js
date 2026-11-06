/**
 * USPS answers that aren't in yet, and what waits for them.
 *
 * When Google can't be reached (with ADDRESS_OUTAGE_FINISH_UNVERIFIED on) or USPS gives no answer,
 * a person can still finish Add Home with the home unverified. The address row remembers that:
 * no postcard and no instant claim until a background re-check passes.
 *
 * `validation_raw_response.postal_state` on HomeAddress:
 *   pending     — no USPS answer yet; mail proof waits
 *   checked     — USPS answered
 *   unanswered  — still no answer after a week; a postcard is offered anyway, since a card that
 *                 arrives is the strongest proof there is
 *   failed      — the re-check refused the address: "Please check this address"
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const addressConfig = require('../../config/addressVerification');
const logger = require('../../utils/logger');
const { computeAddressHash } = require('../../utils/normalizeAddress');
const { AddressVerdictStatus } = require('./types');
const { usesGooglePostal } = require('./postalAdapter');
const canonicalAddressService = require('./canonicalAddressService');
const addressReviewService = require('./addressReviewService');

const PENDING_MESSAGE = 'We couldn’t check this address with USPS yet. We’ll try again shortly, and your postcard can go out after that.';
const FAILED_MESSAGE = 'Please check this address. USPS couldn’t confirm it, so we can’t mail a postcard there. You can verify another way, or add your home again with the right details.';

const UNANSWERED_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
// Minutes until the next try, by how many tries have run. A week's worth, then the last one repeats.
const RECHECK_DELAYS_MINUTES = [5, 15, 60, 360, 1440, 2880, 4320];
const PASSED_STATUSES = new Set([
  AddressVerdictStatus.OK,
  AddressVerdictStatus.MIXED_USE,
  AddressVerdictStatus.UNIT_NOT_CONFIRMED,
]);

function outageFinishEnabled() {
  return addressConfig.postal?.outageFinishUnverified === true && usesGooglePostal();
}

/** Mail proof holds only for an address still waiting on USPS, or one the re-check refused. */
function holdFor(address) {
  if (!usesGooglePostal()) return null;
  const state = address?.validation_raw_response?.postal_state;
  if (state === 'pending') return { code: 'POSTCARD_ADDRESS_PENDING', message: PENDING_MESSAGE };
  if (state === 'failed') return { code: 'POSTCARD_ADDRESS_NOT_CONFIRMED', message: FAILED_MESSAGE };
  return null;
}

async function holdForHome(homeId) {
  if (!usesGooglePostal()) return null;
  const { data: home, error } = await supabaseAdmin
    .from('Home')
    .select('address_id')
    .eq('id', homeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!home?.address_id) return null;

  const { data: address, error: addressError } = await supabaseAdmin
    .from('HomeAddress')
    .select('validation_raw_response')
    .eq('id', home.address_id)
    .maybeSingle();
  if (addressError) throw new Error(addressError.message);
  return holdFor(address);
}

async function holdForAddress(addressId) {
  if (!usesGooglePostal()) return null;
  const { data: address, error } = await supabaseAdmin
    .from('HomeAddress')
    .select('validation_raw_response')
    .eq('id', addressId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return holdFor(address);
}

/** The postcard status screens: a hold reads like any other reason a card can't be requested. */
function applyHoldToPostcardStatus(status, hold) {
  if (!hold || !status?.can_request) return status;
  return {
    ...status,
    can_request: false,
    restriction: hold.code,
    restriction_message: hold.message,
    mailing_address: null,
  };
}

/** What the engine's answer says when Google couldn't be asked: pending, never OK. */
function pendingVerdict(address, reasons = ['GOOGLE_UNAVAILABLE']) {
  return {
    status: AddressVerdictStatus.POSTAL_PENDING,
    reasons,
    confidence: 0,
    normalized: {
      line1: address.address_line1_norm,
      line2: address.address_line2_norm || undefined,
      city: address.city_norm,
      state: address.state,
      zip: address.postal_code,
      lat: address.geocode_lat ?? null,
      lng: address.geocode_lng ?? null,
    },
    candidates: [],
    next_actions: ['recheck_postal'],
  };
}

/**
 * The person's own address, kept as typed, for when Google can't be asked. An address already on
 * file is reused as it stands: the caller decides from what it holds.
 */
async function savePendingAddress(input) {
  const hash = computeAddressHash(input.line1, input.line2 || '', input.city, input.state, input.zip);
  const existing = await canonicalAddressService.findByHash(hash);
  if (existing.error) return null;
  if (existing.data) return existing.data;

  // The map pin comes from the address search provider, which doesn't depend on Google.
  let point = null;
  try {
    const geo = require('../geo');
    point = await geo.forwardGeocode(`${input.line1}, ${input.city}, ${input.state} ${input.zip}`, { mode: 'permanent' });
  } catch (error) {
    logger.warn('postalRecheckService.savePendingAddress: no map pin', { error: error.message });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('HomeAddress')
    .insert({
      address_hash: hash,
      address_line1_norm: input.line1,
      address_line2_norm: input.line2 || null,
      city_norm: input.city,
      state: input.state,
      postal_code: input.zip,
      country: 'US',
      geocode_lat: Number.isFinite(point?.latitude) ? point.latitude : null,
      geocode_lng: Number.isFinite(point?.longitude) ? point.longitude : null,
      deliverability_status: 'unverified',
      validation_raw_response: {
        postal_source: 'google',
        postal_state: 'pending',
        postal_pending_since: now,
        postal_attempts: 0,
      },
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (!error) return data;
  if (error.code === '23505') return (await canonicalAddressService.findByHash(hash)).data || null;
  logger.error('postalRecheckService.savePendingAddress: insert failed', { error: error.message });
  return null;
}

function nextCheckAt(attempts) {
  const minutes = RECHECK_DELAYS_MINUTES[Math.min(attempts, RECHECK_DELAYS_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function updateRaw(address, changes) {
  const { error } = await supabaseAdmin
    .from('HomeAddress')
    .update({
      validation_raw_response: { ...(address.validation_raw_response || {}), ...changes },
      updated_at: new Date().toISOString(),
    })
    .eq('id', address.id);
  if (error) throw new Error(error.message);
}

/** Tell whoever added the home what the re-check found, once per outcome. */
async function notifyHomes(homes, outcome, address) {
  const notificationService = require('../notificationService');
  const copy = {
    passed: {
      title: 'We checked your address',
      body: 'USPS has answered. You can request your verification postcard now.',
    },
    unanswered: {
      title: 'USPS still hasn’t answered',
      body: 'You can request a verification postcard anyway, or verify another way.',
    },
    failed: {
      title: 'Please check this address',
      body: 'USPS couldn’t confirm your address. You can verify another way, or add your home again with the right details.',
    },
  }[outcome];

  for (const home of homes) {
    const userId = home.created_by_user_id;
    if (!userId) continue;
    try {
      await notificationService.createNotification({
        userId,
        type: 'home_address_checked',
        title: copy.title,
        body: copy.body,
        icon: '📬',
        link: `/homes/${home.id}/dashboard`,
        metadata: { home_id: home.id, outcome },
        idempotencyKey: `home_address_checked:${home.id}:${address.id}:${outcome}`,
      });
    } catch (error) {
      logger.warn('postalRecheckService: notification failed', { homeId: home.id, error: error.message });
    }
  }
}

/**
 * Google normalized the address differently from what was typed during the outage. Move the home
 * to the checked address, unless a household already lives there: that goes to a person.
 *
 * @returns {Promise<boolean>} false when the address is someone else's
 */
async function moveHomesToCheckedAddress(homes, pendingAddress, checkedAddress) {
  const { data: others, error } = await supabaseAdmin
    .from('Home')
    .select('id')
    .eq('address_hash', checkedAddress.address_hash)
    .eq('home_status', 'active')
    .limit(2);
  if (error) throw new Error(error.message);
  if ((others || []).some((other) => !homes.some((home) => home.id === other.id))) return false;

  const merged = await canonicalAddressService.mergeAliases(checkedAddress.id, pendingAddress.id);
  if (!merged.success) throw new Error(merged.error?.message || 'merge failed');

  const { error: homeError } = await supabaseAdmin
    .from('Home')
    .update({
      address: checkedAddress.address_line1_norm,
      address2: checkedAddress.address_line2_norm,
      city: checkedAddress.city_norm,
      state: checkedAddress.state,
      zipcode: checkedAddress.postal_code,
      address_hash: checkedAddress.address_hash,
    })
    .in('id', homes.map((home) => home.id));
  if (homeError) throw new Error(homeError.message);
  return true;
}

/**
 * Re-check one address.
 *
 * @returns {Promise<'passed'|'pending'|'unanswered'|'failed'|'unavailable'>}
 */
async function recheckAddress(address, homes) {
  const pipelineService = require('./pipelineService');
  const raw = address.validation_raw_response || {};
  const result = await pipelineService.runValidationPipeline({
    line1: address.address_line1_norm,
    line2: address.address_line2_norm || undefined,
    city: address.city_norm,
    state: address.state,
    zip: address.postal_code,
    country: address.country || 'US',
  }, {
    includeHousehold: false,
    auditContext: { trigger: 'postal_recheck' },
  });

  const status = result.verdict.status;
  if (status === AddressVerdictStatus.SERVICE_ERROR) return 'unavailable';

  const moved = result.canonical_address && result.canonical_address.id !== address.id;
  const saved = !moved && result.canonical_address ? result.canonical_address : address;
  const pendingSince = Date.parse(raw.postal_pending_since || address.updated_at);

  if (status === AddressVerdictStatus.POSTAL_PENDING) {
    const attempts = (raw.postal_attempts || 0) + 1;
    if (Date.now() - pendingSince >= UNANSWERED_AFTER_MS) {
      await updateRaw(saved, { postal_state: 'unanswered', postal_attempts: attempts });
      await notifyHomes(homes, 'unanswered', address);
      return 'unanswered';
    }
    await updateRaw(saved, {
      postal_state: 'pending',
      postal_pending_since: raw.postal_pending_since || new Date(pendingSince).toISOString(),
      postal_attempts: attempts,
      postal_next_check_at: nextCheckAt(attempts),
    });
    return 'pending';
  }

  const passed = PASSED_STATUSES.has(status);

  if (moved && !(await moveHomesToCheckedAddress(homes, address, result.canonical_address))) {
    await updateRaw(address, { postal_state: 'failed', postal_failed_status: AddressVerdictStatus.CONFLICT });
    await addressReviewService.openCase({
      addressId: address.id,
      homeId: homes[0]?.id || null,
      userId: homes[0]?.created_by_user_id || null,
      verdict: { status: AddressVerdictStatus.CONFLICT, reasons: ['OUTAGE_ADDRESS_HAS_A_HOUSEHOLD'], next_actions: ['manual_review'] },
      trigger: 'postal_recheck',
    });
    await notifyHomes(homes, 'failed', address);
    return 'failed';
  }

  if (passed) {
    await notifyHomes(homes, 'passed', address);
    return 'passed';
  }

  await updateRaw(moved ? result.canonical_address : saved, { postal_state: 'failed', postal_failed_status: status });
  await notifyHomes(homes, 'failed', address);
  return 'failed';
}

/**
 * The background job: addresses a home is waiting on, due for another try.
 * Stops at the first sign Google is still down, so an outage spends no calls.
 */
async function recheckPendingAddresses({ limit = 25 } = {}) {
  const summary = { due: 0, passed: 0, pending: 0, unanswered: 0, failed: 0, unavailable: 0 };
  if (!usesGooglePostal() || !addressConfig.isProviderAvailable('google')) return summary;

  const { data: rows, error } = await supabaseAdmin
    .from('HomeAddress')
    .select('*')
    .eq('validation_raw_response->>postal_state', 'pending')
    .order('updated_at', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const now = Date.now();
  const due = (rows || []).filter((row) => {
    const next = row.validation_raw_response?.postal_next_check_at;
    return !next || Date.parse(next) <= now;
  });
  if (due.length === 0) return summary;

  const { data: homes, error: homeError } = await supabaseAdmin
    .from('Home')
    .select('id, address_id, created_by_user_id')
    .in('address_id', due.map((row) => row.id))
    .eq('home_status', 'active');
  if (homeError) throw new Error(homeError.message);

  const homesByAddress = new Map();
  for (const home of homes || []) {
    homesByAddress.set(home.address_id, [...(homesByAddress.get(home.address_id) || []), home]);
  }

  for (const address of due) {
    const waiting = homesByAddress.get(address.id);
    // Nobody finished adding a home here: no reason to spend a call.
    if (!waiting) continue;
    if (summary.due >= limit) break;
    summary.due += 1;
    const outcome = await recheckAddress(address, waiting);
    summary[outcome] += 1;
    if (outcome === 'unavailable') break;
  }

  return summary;
}

/** Google allows USPS data for 30 days. This keeps the address the person confirmed and Pantopus's own conclusions. */
const USPS_RAW_FIELDS = [
  'dpv_match_code', 'rdi_type', 'home_and_business', 'missing_secondary', 'unconfirmed_secondary',
  'commercial_mailbox', 'vacant_flag', 'no_stat', 'no_stat_reason', 'footnotes', 'record_type',
  'carrier_route_type', 'po_box_flag', 'po_box_only_zip', 'coming_soon', 'usps_suspended',
  'missing_component_types', 'street_number',
];

async function clearExpiredUspsData({ limit = 500, dryRun = false } = {}) {
  const days = addressConfig.postal?.uspsDataDays || 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from('HomeAddress')
    .select('id, validation_raw_response')
    .eq('validation_vendor', 'google')
    .lt('last_validated_at', cutoff)
    .is('validation_raw_response->>postal_cleared_at', null)
    .limit(limit);
  if (error) throw new Error(error.message);

  let cleared = 0;
  for (const row of rows || []) {
    if (dryRun) { cleared += 1; continue; }
    const raw = { ...(row.validation_raw_response || {}) };
    for (const field of USPS_RAW_FIELDS) delete raw[field];
    raw.postal_cleared_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('HomeAddress')
      .update({
        dpv_match_code: null,
        rdi_type: 'unknown',
        commercial_mailbox_flag: null,
        deliverability_status: 'unverified',
        postal_code_plus4: null,
        google_verdict: {},
        validation_raw_response: raw,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (updateError) {
      logger.warn('clearExpiredUspsData: update failed', { addressId: row.id, error: updateError.message });
      continue;
    }
    cleared += 1;
  }

  return { found: (rows || []).length, cleared };
}

module.exports = {
  outageFinishEnabled,
  holdFor,
  holdForHome,
  holdForAddress,
  applyHoldToPostcardStatus,
  pendingVerdict,
  savePendingAddress,
  recheckAddress,
  recheckPendingAddresses,
  clearExpiredUspsData,
};
