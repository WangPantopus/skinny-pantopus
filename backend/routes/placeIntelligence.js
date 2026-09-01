// ============================================================
// PLACE INTELLIGENCE ROUTES
//
// GET /api/homes/:id/intelligence — the Place dashboard contract
// (the PlaceIntelligence section envelopes, W0.1) for a claimed home.
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

module.exports = router;
