/**
 * Support Train Permissions Middleware
 *
 * Three middleware factories for route-layer authorization:
 *   - loadSupportTrain      — fetch and attach SupportTrain + Activity to req
 *   - requireSupportTrainRole — require organizer/co-org role
 *   - requireSupportTrainViewer — allow any authorized viewer
 */
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
// The canonical form only: Joi's uuid() also takes (…), […] and colon-separated ids, which the
// database rejects, so they would come back as a failed read (503) instead of a bad id (400).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unavailable(res) {
  return res.status(503).json({
    error: 'SUPPORT_TRAIN_UNAVAILABLE',
    message: 'Could not load this Support Train right now. Please try again.',
  });
}

/**
 * Fetch SupportTrain + Activity and attach to req.supportTrain / req.activity.
 * 404s if the Support Train does not exist.
 */
function loadSupportTrain(req, res, next) {
  const supportTrainId = req.params.id;

  if (typeof supportTrainId !== 'string' || !UUID.test(supportTrainId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'A valid Support Train ID is required.' });
  }

  supabaseAdmin
    .from('SupportTrain')
    .select(`
      *,
      Activity!inner ( * )
    `)
    .eq('id', supportTrainId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Support Train not found.' });
      }
      req.supportTrain = data;
      req.activity = data.Activity;
      next();
    })
    .catch((err) => {
      logger.error('loadSupportTrain error', { supportTrainId, error: err.message });
      unavailable(res);
    });
}

/**
 * Require the requesting user to hold one of the specified organizer roles.
 *
 * @param {string[]} roles — subset of ['primary', 'co_organizer', 'recipient_delegate']
 * @returns {Function} Express middleware
 */
function requireSupportTrainRole(roles) {
  return async (req, res, next) => {
    const supportTrainId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    try {
      // Primary organizer always has full access regardless of the roles array
      if (req.supportTrain?.organizer_user_id === userId) {
        req.supportTrainRole = 'primary';
        return next();
      }

      // Check SupportTrainOrganizer table
      const { data, error } = await supabaseAdmin
        .from('SupportTrainOrganizer')
        .select('role')
        .eq('support_train_id', supportTrainId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data || !roles.includes(data.role)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to perform this action on this Support Train.',
        });
      }

      req.supportTrainRole = data.role;
      next();
    } catch (err) {
      logger.error('requireSupportTrainRole error', { supportTrainId, userId, error: err.message });
      unavailable(res);
    }
  };
}

/**
 * Allow access to any authorized viewer of the Support Train:
 *   - primary organizer (SupportTrain.organizer_user_id)
 *   - co-organizer or recipient_delegate (SupportTrainOrganizer)
 *   - recipient (SupportTrain.recipient_user_id)
 *   - helper with an active reservation (reserved/delivered/confirmed)
 */
async function requireSupportTrainViewer(req, res, next) {
  const supportTrainId = req.params.id;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  try {
    const st = req.supportTrain;

    // Check primary organizer
    if (st?.organizer_user_id === userId) {
      req.supportTrainRole = 'primary';
      return next();
    }

    // Check recipient
    if (st?.recipient_user_id && st.recipient_user_id === userId) {
      req.supportTrainRole = 'recipient';
      return next();
    }

    // Check SupportTrainOrganizer (co-organizer or recipient_delegate)
    const { data: orgRow, error: orgError } = await supabaseAdmin
      .from('SupportTrainOrganizer')
      .select('role')
      .eq('support_train_id', supportTrainId)
      .eq('user_id', userId)
      .maybeSingle();

    if (orgError) throw orgError;

    if (orgRow) {
      req.supportTrainRole = orgRow.role;
      return next();
    }

    // Check active reservation
    const { count, error: reservationError } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select('id', { count: 'exact', head: true })
      .eq('support_train_id', supportTrainId)
      .eq('user_id', userId)
      .in('status', ['reserved', 'delivered', 'confirmed']);

    if (reservationError) throw reservationError;

    if ((count || 0) > 0) {
      req.supportTrainRole = 'helper';
      return next();
    }

    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You do not have permission to perform this action on this Support Train.',
    });
  } catch (err) {
    logger.error('requireSupportTrainViewer error', { supportTrainId, userId, error: err.message });
    unavailable(res);
  }
}

module.exports = {
  loadSupportTrain,
  requireSupportTrainRole,
  requireSupportTrainViewer,
  supportTrainUnavailable: unavailable,
};
