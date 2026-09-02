// ============================================================
// Address calendar — the resident's pickup day (Wedge Phase 2, D6)
//
//   GET    /api/homes/:id/calendar             the next two weeks at this
//                                              address (same payload as the
//                                              Place `address_calendar` section)
//   PUT    /api/homes/:id/calendar/pickup-day  { weekday: 'TU', recycling_every_other_week?: true }
//   DELETE /api/homes/:id/calendar/pickup-day  back to the city default
//
// Any active member of the home may read; setting the pickup day needs
// home access too (it is household knowledge, not an owner privilege).
// ============================================================

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { checkHomePermission } = require('../utils/homePermissions');
const addressCalendarService = require('../services/addressCalendarService');

const pickupSchema = Joi.object({
  weekday: Joi.string().valid('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU').required(),
  recycling_every_other_week: Joi.boolean().optional(),
});

async function loadHomeForMember(homeId, userId) {
  const access = await checkHomePermission(homeId, userId);
  if (!access || !access.hasAccess) return { error: { status: 403, body: { error: 'Not authorized' } } };
  const { data: home } = await supabaseAdmin
    .from('Home')
    .select('id, city, state, county, timezone')
    .eq('id', homeId)
    .maybeSingle();
  if (!home) return { error: { status: 404, body: { error: 'Home not found' } } };
  return { home };
}

router.get('/:id/calendar', verifyToken, async (req, res) => {
  try {
    const { home, error } = await loadHomeForMember(req.params.id, req.user.id);
    if (error) return res.status(error.status).json(error.body);
    const calendar = await addressCalendarService.composeForHome(home);
    return res.json({ calendar });
  } catch (err) {
    logger.error('addressCalendar: read failed', { homeId: req.params.id, error: err.message });
    return res.status(500).json({ error: 'Could not load the calendar' });
  }
});

router.put('/:id/calendar/pickup-day', verifyToken, validate(pickupSchema), async (req, res) => {
  try {
    const { home, error } = await loadHomeForMember(req.params.id, req.user.id);
    if (error) return res.status(error.status).json(error.body);
    const result = await addressCalendarService.setPickupDay(home, {
      weekday: req.body.weekday,
      recyclingEveryOtherWeek: req.body.recycling_every_other_week !== false,
      userId: req.user.id,
    });
    const calendar = await addressCalendarService.composeForHome(home);
    return res.json({ pickup: result, calendar });
  } catch (err) {
    logger.error('addressCalendar: set pickup day failed', { homeId: req.params.id, error: err.message });
    return res.status(500).json({ error: 'Could not save your pickup day' });
  }
});

router.delete('/:id/calendar/pickup-day', verifyToken, async (req, res) => {
  try {
    const { home, error } = await loadHomeForMember(req.params.id, req.user.id);
    if (error) return res.status(error.status).json(error.body);
    await addressCalendarService.clearPickupDay(home);
    const calendar = await addressCalendarService.composeForHome(home);
    return res.json({ calendar });
  } catch (err) {
    logger.error('addressCalendar: clear pickup day failed', { homeId: req.params.id, error: err.message });
    return res.status(500).json({ error: 'Could not reset your pickup day' });
  }
});

module.exports = router;
