// ============================================================
// Address calendar — the resident's pickup day (Wedge Phase 2, D6)
//
//   GET    /api/homes/:id/calendar             the next two weeks at this
//                                              address (same payload as the
//                                              Place `address_calendar` section)
//   PUT    /api/homes/:id/calendar/pickup-day  { weekday, recycling_frequency?, recycling_next_date? }
//   DELETE /api/homes/:id/calendar/pickup-day  back to the city default
//
// Any active member of the home may read; setting the pickup day needs
// home access too (it is household knowledge, not an owner privilege).
// ============================================================

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const addressCalendarService = require('../services/addressCalendarService');

const pickupSchema = Joi.object({
  weekday: Joi.string().valid('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU').required(),
  recycling_every_other_week: Joi.boolean().optional(),
  recycling_frequency: Joi.string().valid('not_set', 'weekly', 'biweekly').optional(),
  recycling_next_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.get('/:id/calendar', verifyToken, async (req, res) => {
  try {
    const { home, rules } = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    const calendar = await addressCalendarService.composeForHome(home, { rules });
    return res.json({ calendar });
  } catch (err) {
    logger.error('addressCalendar: read failed', { homeId: req.params.id, error: err.message });
    return res.status(err.statusCode || 500).json({ error: 'Could not load the calendar' });
  }
});

router.put('/:id/calendar/pickup-day', verifyToken, validate(pickupSchema), async (req, res) => {
  try {
    const { home } = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    const result = await addressCalendarService.setPickupDay(home, {
      weekday: req.body.weekday,
      // Older clients only send a weekday/boolean. Accept them, but do not
      // invent recycling dates without the new explicit schedule fields.
      recyclingFrequency: req.body.recycling_frequency || 'not_set',
      recyclingNextDate: req.body.recycling_next_date,
      userId: req.user.id,
    });
    const refreshed = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    const calendar = await addressCalendarService.composeForHome(refreshed.home, { rules: refreshed.rules });
    return res.json({ pickup: result, calendar });
  } catch (err) {
    if (err.code === 'INVALID_PICKUP') return res.status(400).json({ error: err.message });
    logger.error('addressCalendar: set pickup day failed', { homeId: req.params.id, error: err.message });
    return res.status(err.statusCode || 500).json({ error: 'Could not save your pickup day' });
  }
});

router.delete('/:id/calendar/pickup-day', verifyToken, async (req, res) => {
  try {
    const { home } = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    await addressCalendarService.clearPickupDay(home, req.user.id);
    const refreshed = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    const calendar = await addressCalendarService.composeForHome(refreshed.home, { rules: refreshed.rules });
    return res.json({ calendar });
  } catch (err) {
    logger.error('addressCalendar: clear pickup day failed', { homeId: req.params.id, error: err.message });
    return res.status(err.statusCode || 500).json({ error: 'Could not reset your pickup day' });
  }
});

module.exports = router;
