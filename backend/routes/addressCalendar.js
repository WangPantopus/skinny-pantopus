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
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');
const { checkHomePermission } = require('../utils/homePermissions');
const addressCalendarService = require('../services/addressCalendarService');

const pickupSchema = Joi.object({
  weekday: Joi.string().valid('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU').required(),
  recycling_every_other_week: Joi.boolean().optional(),
  recycling_frequency: Joi.string().valid('not_set', 'weekly', 'biweekly').optional(),
  recycling_next_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

async function loadHomeForMember(homeId, userId) {
  const access = await checkHomePermission(homeId, userId);
  if (access?.readFailed) return { error: { status: 503, body: { error: 'Could not check home access. Try again.' } } };
  if (!access || !access.hasAccess) return { error: { status: 403, body: { error: 'Not authorized' } } };
  const { data: home, error } = await supabaseAdmin
    .from('Home')
    .select('id, city, state, county, timezone')
    .eq('id', homeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
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
      // Older clients only send a weekday/boolean. Accept them, but do not
      // invent recycling dates without the new explicit schedule fields.
      recyclingFrequency: req.body.recycling_frequency || 'not_set',
      recyclingNextDate: req.body.recycling_next_date,
      userId: req.user.id,
    });
    const calendar = await addressCalendarService.composeForHome(home);
    return res.json({ pickup: result, calendar });
  } catch (err) {
    if (err.code === 'INVALID_PICKUP') return res.status(400).json({ error: err.message });
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
