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

/**
 * Fetch SupportTrain + Activity and attach to req.supportTrain / req.activity.
 * 404s if the Support Train does not exist.
 */
function loadSupportTrain(req, res, next) {
  const supportTrainId = req.params.id;

  if (!supportTrainId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing support train ID.' });
  }

  supabaseAdmin
    .from('SupportTrain')
    .select(`
      *,
      Activity!inner ( * )
    `)
    .eq('id', supportTrainId)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Support Train not found.' });
      }
      req.supportTrain = data;
      req.activity = data.Activity;
      next();
    })
    .catch((err) => {
      logger.error('loadSupportTrain error', { supportTrainId, error: err.message });
      res.status(500).json({ error: 'INTERNAL' });
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
        .single();

      if (error || !data || !roles.includes(data.role)) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to perform this action on this Support Train.',
        });
      }

      req.supportTrainRole = data.role;
      next();
    } catch (err) {
      logger.error('requireSupportTrainRole error', { supportTrainId, userId, error: err.message });
      res.status(500).json({ error: 'INTERNAL' });
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
    const { data: orgRow } = await supabaseAdmin
      .from('SupportTrainOrganizer')
      .select('role')
      .eq('support_train_id', supportTrainId)
      .eq('user_id', userId)
      .single();

    if (orgRow) {
      req.supportTrainRole = orgRow.role;
      return next();
    }

    // Check active reservation
    const { count } = await supabaseAdmin
      .from('SupportTrainReservation')
      .select('id', { count: 'exact', head: true })
      .eq('support_train_id', supportTrainId)
      .eq('user_id', userId)
      .in('status', ['reserved', 'delivered', 'confirmed']);

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
    res.status(500).json({ error: 'INTERNAL' });
  }
}

module.exports = {
  loadSupportTrain,
  requireSupportTrainRole,
  requireSupportTrainViewer,
};
