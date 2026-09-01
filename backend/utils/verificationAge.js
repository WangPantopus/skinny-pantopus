/**
 * How old is a residency verification, and does that matter yet?
 *
 * §5.1 / LIF-04 — verification was a single bit with no timestamp, so the
 * system could not express "this verification is 29 months old" and every
 * trust decision treated a three-year-old verification and this morning's as
 * identical. Roughly a tenth of the population moves each year, so a large
 * share of the verified base is, at any moment, asserting a residency that
 * ended (audit 2026-08-22).
 *
 * This is the measurement. Whether staleness costs anything is gated by the
 * `enforceVerificationExpiry` runtime flag, which ships disabled: expiring the
 * existing verified base is a product decision, and the mechanism should land
 * before the policy.
 */

const addressConfig = require('../config/addressVerification');
const { getRolloutFlag } = require('./addressRolloutFlags');

/** Days a verification stands before it should be re-attested. */
function validityDays() {
  return addressConfig.mailVerification.validityDays;
}

/** When a verification performed at `verifiedAt` should be re-attested. */
function expiryFor(verifiedAt) {
  if (!verifiedAt) return null;
  const base = new Date(verifiedAt).getTime();
  if (!Number.isFinite(base)) return null;
  return new Date(base + validityDays() * 24 * 60 * 60 * 1000).toISOString();
}

/** Age of a verification in whole days, or null if unknown. */
function ageInDays(verifiedAt, now = Date.now()) {
  if (!verifiedAt) return null;
  const then = new Date(verifiedAt).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now - then) / (24 * 60 * 60 * 1000)));
}

/**
 * Is this verification past its validity window?
 *
 * A verification with no timestamp is NOT reported stale: those are rows that
 * predate the column, and treating unknown as expired would revoke trust from
 * the entire historical base on deploy.
 */
function isStale(verifiedAt, now = Date.now()) {
  const age = ageInDays(verifiedAt, now);
  if (age === null) return false;
  return age > validityDays();
}

/**
 * Should staleness actually cost this residency anything right now?
 * Measurement is always available; enforcement is a flag.
 */
function staleAffectsTrust(verifiedAt, now = Date.now()) {
  if (!getRolloutFlag('enforceVerificationExpiry')) return false;
  return isStale(verifiedAt, now);
}

/**
 * Describe a verification's age for API responses and admin surfaces.
 * @returns {{verified_at: string|null, age_days: number|null, stale: boolean, enforced: boolean}}
 */
function describe(verifiedAt, now = Date.now()) {
  return {
    verified_at: verifiedAt || null,
    age_days: ageInDays(verifiedAt, now),
    stale: isStale(verifiedAt, now),
    enforced: staleAffectsTrust(verifiedAt, now),
  };
}

module.exports = {
  validityDays,
  expiryFor,
  ageInDays,
  isStale,
  staleAffectsTrust,
  describe,
};
