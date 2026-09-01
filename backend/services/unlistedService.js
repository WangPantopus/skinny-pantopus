/**
 * Unlisted (Wave 4) — "type your address to get it off the internet."
 *
 * The acquisition slice, and the one aimed at the hardest audience:
 * people who will not hand an address to anything. The pitch inverts
 * the usual ask — you give us the address in order to make it LESS
 * visible, not more.
 *
 * WHAT IT ACTUALLY DOES, and the honesty that holds it together:
 *
 *   1. THE STATE'S ESCAPE HATCH, first. Most states run an Address
 *      Confidentiality Program: a legal substitute address for survivors
 *      of domestic violence, stalking, assault or trafficking, which
 *      fixes the problem at the SOURCE instead of chasing it across
 *      thirty sites forever. Someone on this page is disproportionately
 *      likely to be there because of a specific person, so this leads.
 *
 *   2. THE REMOVAL PATHS. Which sites republish county property records,
 *      what each publishes, and the exact verified opt-out for each.
 *
 * WHAT IT DOES NOT DO — and this is a deliberate product decision, not a
 * gap: it does not query people-search sites to check whether a given
 * address is listed. Doing so would DISCLOSE that address to the very
 * companies the person is trying to remove it from — a scan meant to
 * reduce exposure would create it. (It is also legally grey, brittle,
 * slow enough to kill the conversion it exists to drive, and needs the
 * standing scraper staffing that is the stated reason the erase tier
 * waits.)
 *
 * The consequence runs through every field name here: nothing in this
 * service asserts that a person IS listed anywhere. There is no `found`
 * flag and there must never be one. We describe what a site publishes
 * and how to leave it — both true without querying anyone.
 *
 * PRIVACY: the T0 path persists NOTHING. It takes an address, resolves a
 * state, and returns a profile that is identical for everyone in that
 * state. The address is never stored, never logged with the result, and
 * never sent anywhere. Progress tracking (which brokers you have
 * written to) exists only once you have claimed the home, is scoped to
 * you rather than the household, and lives behind RLS — a row saying
 * "this person is erasing their address" is exactly what must not leak.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const {
  DATA_BROKERS,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  EXPOSURE_LABELS,
} = require('../data/dataBrokers');
const stateDisclosure = require('../data/stateDisclosure');

const REMOVAL_STATUSES = ['todo', 'requested', 'confirmed', 'relisted'];

class UnlistedError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/** Brokers grouped in the order a person should work through them. */
function brokerGroups() {
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      brokers: DATA_BROKERS.filter((b) => b.category === category),
    }))
    .filter((g) => g.brokers.length > 0);
}

/**
 * The public exposure profile for an address's STATE.
 *
 * Identical for everyone in a state by construction — it is law and a
 * public registry, not anything about the person — which is exactly why
 * it can be served anonymously without storing the address.
 *
 * @param {string} stateCode two-letter state
 * @returns {object} the profile; `state_program` is null when we have
 *   not verified that state, which the UI must render as "we could not
 *   confirm", never as "your state has none".
 */
function getExposureProfile(stateCode) {
  const program = stateDisclosure.forState(stateCode);
  const groups = brokerGroups();
  const brokerCount = groups.reduce((n, g) => n + g.brokers.length, 0);

  return {
    state: String(stateCode || '').toUpperCase() || null,
    // The escape hatch leads. See the header.
    state_program: program
      ? {
        exists: program.acp_exists,
        name: program.acp_name,
        url: program.acp_url,
        eligibility: program.acp_eligibility,
        source_url: program.source_url,
        verified_at: program.verified_at,
      }
      : null,
    groups,
    broker_count: brokerCount,
    exposure_labels: EXPOSURE_LABELS,
    // The honesty line the UI must render verbatim somewhere visible.
    // It is not decoration: without it the page implies a scan it never
    // performed.
    // The second clause used to read "This is every site that republishes
    // county records." That is the one sentence on the page a frightened
    // person would use to decide they are DONE, and it was false: this
    // file's own header says entries that could not be verified are
    // omitted, and TruePeopleSearch, PeopleFinders, Nuwber, ClustrMaps and
    // NeighborWho are among the sites missing. Telling someone the list is
    // complete is the same failure as telling them their state has no
    // program — it stops them looking further. The count is stated so the
    // sentence cannot drift away from the list it describes.
    //
    // Deliberately NOT worded "we have not confirmed": that phrase
    // already carries a different meaning one card above, where it means
    // we could not establish whether the reader's STATE runs a program.
    // Two unrelated uncertainties in the same words on the same screen.
    method_note: brokerCount > 0
      ? 'We do not look your address up on these sites — searching them would hand them your address. '
        + `These are the ${brokerCount} sites we have verified a working removal path for — there are more we have not got to yet.`
      : 'We are still verifying removal paths. We publish a site only once we have confirmed its opt-out works.',
    registry_verified_at: latestVerifiedAt(),
  };
}

/** The oldest entry is the honest "last checked" date for the list. */
function latestVerifiedAt() {
  const dates = DATA_BROKERS.map((b) => b.verified_at).filter(Boolean).sort();
  return dates.length ? dates[0] : null;
}

// ── Progress tracking (claimed homes only) ───────────────────

/**
 * This resident's removal progress on this home. Scoped to the CALLER,
 * not the household: another occupant must not be able to see that
 * someone is erasing their address, for the same reason the table is
 * service-role only.
 */
async function listRemovals({ homeId, userId }) {
  const { data, error } = await supabaseAdmin
    .from('UnlistedRemoval')
    .select('broker_id, status, requested_at, confirmed_at, updated_at')
    .eq('home_id', homeId)
    .eq('user_id', userId);
  if (error) {
    logger.warn('unlisted: removals read failed', { homeId, userId, error: error.message });
    return null;
  }
  return data || [];
}

/**
 * Record where the resident has got to with one broker. The removal
 * itself happens on the broker's site — we never act as the person, so
 * this is bookkeeping they own, not a claim we make.
 */
async function setRemovalStatus({ homeId, userId, brokerId, status }) {
  const id = String(brokerId || '').trim();
  if (!id || !DATA_BROKERS.some((b) => b.id === id)) {
    throw new UnlistedError('Unknown site.', 'UNKNOWN_BROKER');
  }
  if (!REMOVAL_STATUSES.includes(status)) {
    throw new UnlistedError('Unknown status.', 'BAD_STATUS');
  }

  const nowIso = new Date().toISOString();
  const row = {
    home_id: homeId,
    user_id: userId,
    broker_id: id,
    status,
    updated_at: nowIso,
  };
  // Stamps are set on the transition that earns them and never cleared
  // by a later one: "I asked on the 3rd" stays true after a relisting.
  if (status === 'requested') row.requested_at = nowIso;
  if (status === 'confirmed') row.confirmed_at = nowIso;

  const { data, error } = await supabaseAdmin
    .from('UnlistedRemoval')
    .upsert(row, { onConflict: 'home_id,user_id,broker_id' })
    .select()
    .single();
  if (error) {
    logger.error('unlisted: removal upsert failed', { homeId, userId, brokerId: id, error: error.message });
    throw new Error('Could not save your progress');
  }
  return {
    broker_id: data.broker_id,
    status: data.status,
    requested_at: data.requested_at,
    confirmed_at: data.confirmed_at,
  };
}

module.exports = {
  getExposureProfile,
  listRemovals,
  setRemovalStatus,
  UnlistedError,
  REMOVAL_STATUSES,
  // Exported for testing.
  brokerGroups,
};
