// ============================================================
// BEFORE-YOU-SIGN SCOUT (Wave 4)
//
//   GET /api/scout?address=…&asking_rent=…&year_built=…
//
// T1: an account, no address claim, no verification. That is deliberate
// and is the resolution of the roadmap's locked-teaser tension — the
// person using Scout is considering an address they do NOT live at, so
// they cannot be a verified resident of it, and gating this behind a
// postcard would make it unusable by the only audience it serves. See
// services/scoutService.js for the full reasoning.
//
// Rate-limited: every call geocodes and fans out to several external
// providers, and unlike the anonymous preview this one is authenticated,
// so an account is the unit to limit.
//
// NOT mounted under /api/homes — Scout has no home. Wiring it there
// would put it behind home-permission middleware for a home that by
// definition does not exist.
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { aiDraftLimiter } = require('../middleware/rateLimiter');
const scoutService = require('../services/scoutService');
// Held as a module reference rather than destructured: a destructured
// binding is captured at load and cannot be substituted, which made a
// route test pass against the real geocoder while believing it had
// stubbed one — it got `unplaceable` from a missing API key and read that
// as proof the branch worked.
const publicRoutes = require('./public');
const logger = require('../utils/logger');

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Bedrooms needs its own coercion: a STUDIO IS 0, and `positiveNumber`
// rejects 0 — which would silently fall back to the county's 2-bedroom
// band and hand the reader a verdict about a unit twice the size of the
// one they are standing in. Capped at 4 because that is the width of
// HUD's fmr_lo/fmr_hi arrays.
function bedroomCount(value) {
  // `Number('')` is 0, and 0 is a STUDIO — so an empty or missing param
  // silently became a stated studio, and `bedrooms_stated: true` told the
  // reader we had judged the unit size they gave us when they gave us
  // nothing. Absence has to stay absent.
  // A plain integer 0-4 and nothing else. `Number` accepts '2.6' (rounded
  // to a count nobody typed) and '0x3' (3), so the shape is checked
  // before the value: a bedroom count the reader did not enter must not
  // become one we then report back to them as stated.
  if (typeof value !== 'string' || !/^\d$/.test(value.trim())) return undefined;
  const n = Number(value.trim());
  return n >= 0 && n <= 4 ? n : undefined;
}

// GET /api/scout — the report for an address you are considering
router.get('/', verifyToken, aiDraftLimiter, async (req, res) => {
  try {
    // NOT CACHEABLE — this is about the reader's own device, not ours.
    //
    // Express sends a 200 JSON body with an ETag and no Cache-Control,
    // which is storable, so the browser (and OkHttp's Cache, and iOS's
    // URLCache) writes an entry KEYED ON THE FULL URL — which here
    // carries the address someone typed. /api/public/unlisted got this
    // header in the same wave for exactly this reason; Scout is the
    // surface whose whole promise is discretion about a place you have
    // not committed to, and it was left out.
    res.set('Cache-Control', 'no-store');

    const rawAddress = typeof req.query.address === 'string' ? req.query.address.trim() : '';
    if (!rawAddress) {
      return res.status(400).json({ error: 'An address query parameter is required.' });
    }
    if (rawAddress.length > 200) {
      return res.status(400).json({ error: 'That address is too long.' });
    }

    const place = await publicRoutes.geocodeUsAddress(rawAddress);
    if (!place.ok) {
      // "We could not place that" and "you are not in the United States" are
      // different answers. Collapsing them told anyone hitting a geocoder
      // outage — every US user at once — that the product was not for them.
      // Scout genuinely cannot proceed without coordinates, so both are a
      // dead end here; they must at least be the RIGHT dead end, since only
      // one of them is worth retrying with a fuller address.
      const unplaceable = place.reason !== 'outside_us';
      return res.json({
        status: unplaceable ? 'could_not_place' : 'unsupported_region',
        message: unplaceable
          ? 'We could not find that address — try adding the city and state'
          // NOT "U.S.-only": Puerto Rico, the U.S. Virgin Islands and Guam
          // ARE the United States and fail the mainland bounding box, so
          // that phrasing tells a resident of a U.S. territory they are
          // not in their own country. This says what is actually true —
          // we do not have coverage there — without asserting where the
          // reader is.
          : 'Scout does not cover that area yet',
      });
    }

    const report = await scoutService.getScoutReport(place, {
      askingRent: positiveNumber(req.query.asking_rent),
      yearBuilt: positiveNumber(req.query.year_built),
      bedrooms: bedroomCount(req.query.bedrooms),
    });

    // The typed address is NOT persisted, exactly as the anonymous
    // preview promises: someone checking out an address they might rent
    // has not agreed to a record of having looked.
    return res.json({ status: 'ready', scout: report });
  } catch (err) {
    logger.error('scout: report failed', { error: err.message });
    return res.status(500).json({ error: 'Could not build the report.' });
  }
});

module.exports = router;
