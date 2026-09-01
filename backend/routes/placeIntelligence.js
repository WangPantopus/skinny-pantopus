// ============================================================
// PLACE INTELLIGENCE ROUTES
//
// GET  /api/homes/:id/intelligence   — the Place dashboard contract
//      (the PlaceIntelligence section envelopes, W0.1) for a claimed home.
// PUT  /api/homes/:id/systems/:key   — record what the household knows
//      about a building system (the Systems Ledger correction path).
//
// Mounted at /api/homes BEFORE the generic home router so the
// two-segment `/:id/intelligence` path resolves here. Thin by design:
// auth + permission gate, then delegate composition to the service.
// ============================================================

const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/verifyToken');
const { checkHomePermission } = require('../utils/homePermissions');
const placeIntelligenceService = require('../services/placeIntelligenceService');
const { recordSystem, SYSTEM_KEYS } = require('../services/homeSystemsService');
const { PLACE_SECTION_IDS } = require('../serializers/placeIntelligenceSerializer');
const logger = require('../utils/logger');

const VALID_SECTION_IDS = new Set(PLACE_SECTION_IDS);

// `?sections=weather,flood` → validated id array (lazy section load),
// null when the param is absent/empty (⇒ compose the full launch set).
// Unknown ids are a 400 — a typo'd subset should fail loudly, not
// silently return the wrong payload.
function parseSectionsParam(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { sectionIds: null };
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
  if (!ids.length) return { sectionIds: null };
  const unknown = ids.filter((id) => !VALID_SECTION_IDS.has(id));
  if (unknown.length) return { error: `Unknown section id(s): ${unknown.join(', ')}` };
  return { sectionIds: ids };
}

// GET /api/homes/:id/intelligence[?sections=a,b,c]
router.get('/:id/intelligence', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const { sectionIds, error: sectionsError } = parseSectionsParam(req.query.sections);
    if (sectionsError) {
      return res.status(400).json({ error: sectionsError });
    }

    const access = await checkHomePermission(id, userId);
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }

    const intelligence = await placeIntelligenceService.composeHomeIntelligence({
      homeId: id,
      userId,
      access,
      sectionIds,
    });
    if (!intelligence) {
      return res.status(404).json({ error: 'Home not found' });
    }

    return res.json(intelligence);
  } catch (err) {
    logger.error('Place intelligence error', { error: err.message, homeId: id });
    return res.status(500).json({ error: 'Failed to load place intelligence' });
  }
});

// PUT /api/homes/:id/systems/:key — "it was replaced".
//
// The correction path for the Systems Ledger. Deliberately a plain write
// with no transaction attached: a household must be able to fix their own
// record without being routed through the marketplace first. A model that
// turns a tile red and then makes you hire someone to clear it is a
// scare-and-sell engine, not a record.
router.put('/:id/systems/:key', verifyToken, async (req, res) => {
  const { id, key } = req.params;
  const userId = req.user.id;

  try {
    if (!SYSTEM_KEYS.includes(key)) {
      return res.status(400).json({ error: `Unknown system: ${key}` });
    }

    // Band C is the household's own record. Reading needs membership;
    // WRITING needs edit rights — `checkHomePermission` with no permission
    // argument short-circuits to bare membership, which would let a guest
    // or restricted member rewrite the ledger. Every comparable per-home
    // write in routes/home.js passes an explicit permission.
    const access = await checkHomePermission(id, userId, 'home.edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this place.' });
    }

    const body = req.body || {};
    const hasYear = Object.prototype.hasOwnProperty.call(body, 'installed_year');
    if (!hasYear) {
      return res.status(400).json({ error: 'installed_year is required (null clears it).' });
    }

    const result = await recordSystem({
      homeId: id,
      systemKey: key,
      installedYear: body.installed_year,
      // Always 'resident' here: this endpoint is the household speaking.
      // Derived sources write through the service, never through the API.
      source: 'resident',
      userId,
    });

    if (!result.ok) {
      if (result.reason === 'invalid_year') {
        return res.status(400).json({ error: 'That year does not look right.' });
      }
      if (result.reason === 'invalid_system') {
        return res.status(400).json({ error: `Unknown system: ${key}` });
      }
      return res.status(500).json({ error: 'Failed to save.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    logger.error('Place systems write error', { error: err.message, homeId: id, key });
    return res.status(500).json({ error: 'Failed to save.' });
  }
});

module.exports = router;
