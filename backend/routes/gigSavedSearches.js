/**
 * Gig saved searches (P6) — save the filter set you're browsing with and
 * get alerted when a new task matches (`services/savedSearchAlertService`).
 *
 * Mounted at `/api/gigs` BEFORE `routes/gigs.js` (app.js) so the static
 * `/saved-searches` paths never collide with the `/:id` routes.
 */

const express = require('express');
const Joi = require('joi');

const router = express.Router();
const supabaseAdmin = require('../config/supabaseAdmin');
const verifyToken = require('../middleware/verifyToken');
const validate = require('../middleware/validate');
const logger = require('../utils/logger');

const MAX_SAVED_SEARCHES = 20;

const createSavedSearchSchema = Joi.object({
  name: Joi.string().max(120).allow('', null).optional(),
  category: Joi.string().max(100).allow('', null).optional(),
  search: Joi.string().max(200).allow('', null).optional(),
  min_price: Joi.number().min(0).max(100000).allow(null).optional(),
  max_price: Joi.number().min(0).max(100000).allow(null).optional(),
  schedule_type: Joi.string().valid('asap', 'today', 'scheduled', 'flexible').allow(null).optional(),
  pay_type: Joi.string().valid('fixed', 'hourly', 'offers').allow(null).optional(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius_miles: Joi.number().greater(0).max(100).default(5),
  notify: Joi.boolean().default(true),
});

const updateSavedSearchSchema = Joi.object({
  name: Joi.string().max(120).allow('', null),
  notify: Joi.boolean(),
  radius_miles: Joi.number().greater(0).max(100),
}).min(1);

/**
 * GET /api/gigs/saved-searches
 * The caller's saved searches, newest first.
 */
router.get('/saved-searches', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('GigSavedSearch')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ searches: data || [] });
  } catch (err) {
    logger.error('List saved searches failed', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to load saved searches' });
  }
});

/**
 * POST /api/gigs/saved-searches
 * Save the current filter set. Duplicate criteria upsert onto the
 * existing row (re-enabling notify) instead of erroring.
 */
router.post('/saved-searches', verifyToken, validate(createSavedSearchSchema), async (req, res) => {
  const userId = req.user.id;
  try {
    const { count } = await supabaseAdmin
      .from('GigSavedSearch')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if ((count || 0) >= MAX_SAVED_SEARCHES) {
      return res.status(400).json({ error: `You can keep up to ${MAX_SAVED_SEARCHES} saved searches` });
    }

    const body = req.body;
    const row = {
      user_id: userId,
      name: body.name || null,
      category: body.category || null,
      search: body.search || null,
      min_price: body.min_price ?? null,
      max_price: body.max_price ?? null,
      schedule_type: body.schedule_type || null,
      pay_type: body.pay_type || null,
      latitude: body.latitude,
      longitude: body.longitude,
      radius_miles: body.radius_miles,
      notify: body.notify,
    };

    const { data, error } = await supabaseAdmin
      .from('GigSavedSearch')
      .insert(row)
      .select()
      .single();

    if (error) {
      // Unique criteria index hit — refresh the existing row instead.
      if (String(error.code) === '23505') {
        const { data: dupe } = await supabaseAdmin
          .from('GigSavedSearch')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        const same = (dupe || []).find(
          (s) =>
            (s.category || '') === (row.category || '') &&
            (s.search || '') === (row.search || '') &&
            String(s.min_price ?? '') === String(row.min_price ?? '') &&
            String(s.max_price ?? '') === String(row.max_price ?? '') &&
            (s.schedule_type || '') === (row.schedule_type || '') &&
            (s.pay_type || '') === (row.pay_type || '')
        );
        if (!same) throw error;
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('GigSavedSearch')
          .update({
            notify: row.notify,
            name: row.name,
            latitude: row.latitude,
            longitude: row.longitude,
            radius_miles: row.radius_miles,
          })
          .eq('id', same.id)
          .select()
          .single();
        if (updateError) throw updateError;
        return res.json({ search: updated, deduped: true });
      }
      throw error;
    }
    res.status(201).json({ search: data });
  } catch (err) {
    logger.error('Create saved search failed', { error: err.message, userId });
    res.status(500).json({ error: 'Failed to save search' });
  }
});

/**
 * PATCH /api/gigs/saved-searches/:id
 * Rename / toggle notify / adjust radius.
 */
router.patch('/saved-searches/:id', verifyToken, validate(updateSavedSearchSchema), async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('GigSavedSearch')
      .update(req.body)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Saved search not found' });
    res.json({ search: data });
  } catch (err) {
    logger.error('Update saved search failed', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to update saved search' });
  }
});

/**
 * DELETE /api/gigs/saved-searches/:id
 */
router.delete('/saved-searches/:id', verifyToken, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('GigSavedSearch')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ message: 'Saved search deleted' });
  } catch (err) {
    logger.error('Delete saved search failed', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to delete saved search' });
  }
});

module.exports = router;
