const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('./logger');

function requestMetadata(req) {
  if (!req) return {};
  return {
    request_id: req.requestId || req.headers?.['x-request-id'] || null,
    ip: req.ip || null,
    user_agent: typeof req.get === 'function' ? req.get('user-agent') || null : null,
  };
}

async function writeIdentityAuditLog({
  actorUserId,
  action,
  targetType = null,
  targetId = null,
  targetUserId = null,
  personaId = null,
  metadata = {},
  req = null,
}) {
  try {
    const { error } = await supabaseAdmin
      .from('IdentityAuditLog')
      .insert({
        actor_user_id: actorUserId || null,
        target_user_id: targetUserId || null,
        persona_id: personaId || null,
        action,
        target_type: targetType,
        target_id: targetId == null ? null : String(targetId),
        metadata: {
          ...metadata,
          ...requestMetadata(req),
        },
      });

    if (error) {
      logger.warn('identity.audit.write_failed', {
        error: error.message,
        actorUserId,
        action,
        targetType,
        targetId,
      });
    }
  } catch (err) {
    logger.warn('identity.audit.exception', {
      error: err.message,
      actorUserId,
      action,
      targetType,
      targetId,
    });
  }
}

module.exports = {
  writeIdentityAuditLog,
};
