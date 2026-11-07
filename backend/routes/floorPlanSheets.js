const express = require('express');
const multer = require('multer');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const { homeOutboundLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const config = require('../config/floorPlanSheets');
const addressReview = require('../services/addressValidation/addressReviewService');
const originals = require('../services/propertyRecords/floorPlanOriginals');
const { readSheet } = require('../services/propertyRecords/floorPlanFormat');
const { countyOfZip } = require('../services/propertyRecords/zipCounty');
const { zip5 } = require('../services/propertyRecords/addressKey');

const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ORIGINAL_BYTES, files: 1, fields: 2, parts: 3, fieldSize: 2 * 1024 * 1024 },
});

/**
 * POST /api/floor-plan-sheets
 * A building manager, or a resident with the building's written permission, sends a floor-plan sheet: plan names with
 * bedrooms, baths and size, which units have which plan, and who gave permission for what. JSON, or multipart with the
 * JSON in `sheet` and the original in `original` (PDF, PNG or JPEG), kept only when permission says so.
 *
 * Nothing here reaches a screen. It goes to a person at Pantopus, and a release is built from what they accept
 * (scripts/property-index/build-floor-plans.cjs). So signing in is enough to send one, and the answer says nothing about
 * whether this building has a sheet already or whether anyone there asked. Off behind FLOOR_PLAN_SHEETS_ENABLED.
 */
router.post('/', verifyToken, (req, res, next) => (config.enabled() ? next() : res.status(404).json({ error: 'Not found' })), homeOutboundLimiter,
  (req, res, next) => upload.single('original')(req, res, (err) => (err ? res.status(400).json({ error: 'That file is too large, or not one we can take. Up to 10 MB, one file.' }) : next())),
  async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    let body = req.body;
    if (typeof body?.sheet === 'string') {
      try {
        body = JSON.parse(body.sheet);
      } catch {
        return res.status(400).json({ error: 'The sheet could not be read.' });
      }
    }
    const { sheet, problems, summary } = readSheet(body);
    if (!sheet) return res.status(400).json({ error: 'Check the sheet and send it again.', problems });
    const grantedBy = typeof body.permission?.granted_by === 'string' ? body.permission.granted_by.trim().slice(0, 200) : '';
    if (!grantedBy || body.permission?.written !== true) {
      return res.status(400).json({ error: 'Check the sheet and send it again.', problems: ['Say who gave written permission for this sheet'] });
    }
    try {
      const original = await originals.keep(req.file, { permitted: body.keep_original === true });
      if (original === originals.REFUSED) return res.status(400).json({ error: 'The original has to be a PDF, PNG or JPEG.' });
      const where = body.building.addresses[0];
      const caseId = await addressReview.flagFloorPlanSheet({
        userId: req.user.id,
        // As sent, so the file review saves is what the release step reads. Who gave permission is beside it, not in it.
        sheet: { building: body.building, as_of: body.as_of, plans: body.plans, permission: sheet.permission },
        permission: { ...sheet.permission, granted_by: grantedBy, written: true },
        summary,
        original,
        // A reviewer's starting point: a ZIP can cross a county line.
        fips_hint: countyOfZip(zip5(where.zip)),
        area: [where.city, where.state].filter(Boolean).join(', '),
      });
      if (!caseId) return res.status(503).json({ error: 'That could not be sent just now. Please try again.' });
      return res.status(202).json({
        received: true,
        review: 'pending',
        ...summary,
        original_kept: Boolean(original),
        message: summary.mapped_units
          ? 'Thanks. We will check it and its permission before anyone sees it.'
          : "Thanks. We will check it and its permission before anyone sees it. With no units named for its plans, it can only show as the building's.",
      });
    } catch (err) {
      logger.error('floor plan sheet intake failed', { error: err.name });
      return res.status(503).json({ error: 'That could not be sent just now. Please try again.' });
    }
  });

module.exports = router;
