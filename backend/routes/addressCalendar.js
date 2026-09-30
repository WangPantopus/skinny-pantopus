// ============================================================
// Address calendar — the resident's pickup day (Wedge Phase 2, D6)
//
//   GET    /api/homes/:id/calendar             the next two weeks at this
//                                              address (same payload as the
//                                              Place `address_calendar` section)
//   PUT    /api/homes/:id/calendar/pickup-day  { weekday, recycling_frequency?, recycling_next_date?, expected_version? }
//   DELETE /api/homes/:id/calendar/pickup-day  back to the city default (?expected_version=)
//
// `expected_version` is the calendar's `pickup_version` when the form opened.
// If the schedule changed since then, nothing is saved: 409
// PICKUP_SCHEDULE_CHANGED with the current calendar. Older clients omit it
// and keep the last-write-wins save.
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

const PICKUP_VERSION = /^(none|[0-9a-f]{32})$/;

// A refused change says why (web, and Android's readable 403 message), so a
// restricted member doesn't keep retrying a "could not save".
const PICKUP_DENIED = "You don't have permission to change this household's pickup schedule.";

const pickupSchema = Joi.object({
  weekday: Joi.string().valid('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU').required(),
  recycling_every_other_week: Joi.boolean().optional(),
  recycling_frequency: Joi.string().valid('not_set', 'weekly', 'biweekly').optional(),
  recycling_next_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expected_version: Joi.string().pattern(PICKUP_VERSION).optional(),
});

// Nothing was saved. Send the current calendar so the person can review it.
async function sendScheduleChanged(req, res, err) {
  const body = { code: err.code, error: err.message, message: err.message };
  try {
    const { home, rules } = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    body.calendar = await addressCalendarService.composeForHome(home, { rules });
  } catch (readErr) {
    logger.warn('addressCalendar: calendar after a changed schedule unavailable', { homeId: req.params.id, error: readErr.message });
  }
  return res.status(409).json(body);
}

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
      expectedVersion: req.body.expected_version,
    });
    const refreshed = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    const calendar = await addressCalendarService.composeForHome(refreshed.home, { rules: refreshed.rules });
    return res.json({ pickup: result, calendar });
  } catch (err) {
    if (err.code === 'INVALID_PICKUP') return res.status(400).json({ error: err.message });
    if (err.code === 'PICKUP_SCHEDULE_CHANGED') return sendScheduleChanged(req, res, err);
    logger.error('addressCalendar: set pickup day failed', { homeId: req.params.id, error: err.message });
    if (err.statusCode === 403) return res.status(403).json({ code: 'HOME_ACCESS_DENIED', error: 'Could not save your pickup day', message: PICKUP_DENIED });
    return res.status(err.statusCode || 500).json({ error: 'Could not save your pickup day' });
  }
});

router.delete('/:id/calendar/pickup-day', verifyToken, async (req, res) => {
  const expectedVersion = req.query.expected_version;
  if (expectedVersion !== undefined && (typeof expectedVersion !== 'string' || !PICKUP_VERSION.test(expectedVersion))) {
    return res.status(400).json({ error: 'expected_version is not a pickup schedule version' });
  }
  try {
    const { home } = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    await addressCalendarService.clearPickupDay(home, req.user.id, expectedVersion);
    const refreshed = await addressCalendarService.getPickupContext(req.params.id, req.user.id);
    const calendar = await addressCalendarService.composeForHome(refreshed.home, { rules: refreshed.rules });
    return res.json({ calendar });
  } catch (err) {
    if (err.code === 'PICKUP_SCHEDULE_CHANGED') return sendScheduleChanged(req, res, err);
    logger.error('addressCalendar: clear pickup day failed', { homeId: req.params.id, error: err.message });
    if (err.statusCode === 403) return res.status(403).json({ code: 'HOME_ACCESS_DENIED', error: 'Could not reset your pickup day', message: PICKUP_DENIED });
    return res.status(err.statusCode || 500).json({ error: 'Could not reset your pickup day' });
  }
});

module.exports = router;
