const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

function newPostFanoutLinkAndMeta(post) {
  if (post?.ref_task_id) {
    return {
      link: `/gigs/${post.ref_task_id}`,
      meta: {
        post_id: post.id,
        ref_task_id: post.ref_task_id,
        gig_id: post.ref_task_id,
      },
    };
  }
  if (post?.ref_listing_id) {
    return {
      link: `/listing/${post.ref_listing_id}`,
      meta: {
        post_id: post.id,
        ref_listing_id: post.ref_listing_id,
        listing_id: post.ref_listing_id,
      },
    };
  }
  return {
    link: `/posts/${post.id}`,
    meta: { post_id: post.id },
  };
}

async function getUserDisplayName(userId) {
  const { data } = await supabaseAdmin
    .from('User')
    .select('username, name, first_name')
    .eq('id', userId)
    .single();
  if (!data) return 'Someone';
  return data.name || data.first_name || data.username || 'Someone';
}

async function resolvePostFanoutRecipients({
  post,
  userId,
  personaContext,
  targets,
  recipientUserIds,
}) {
  const recipientIds = new Set(Array.isArray(recipientUserIds) ? recipientUserIds : []);
  const notifyPersonaFollowers = targets.includes('persona_followers');
  const notifyConnections = targets.includes('connections');

  if (!recipientUserIds && notifyPersonaFollowers && personaContext?.id) {
    const { data: personaFollowers } = await supabaseAdmin
      .from('PersonaMembership')
      .select('user_id')
      .eq('persona_id', personaContext.id)
      .in('status', ['active', 'past_due']);
    (personaFollowers || []).forEach(f => recipientIds.add(f.user_id));
  }

  if (!recipientUserIds && notifyConnections) {
    const { data: rels } = await supabaseAdmin
      .from('Relationship')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    (rels || []).forEach(r => {
      recipientIds.add(r.requester_id === userId ? r.addressee_id : r.requester_id);
    });
  }

  recipientIds.delete(userId);
  return [...recipientIds].filter(Boolean);
}

async function runPostCreatedHooksNow({
  post,
  userId,
  personaContext = null,
  targets = null,
  recipientUserIds = null,
  notificationMode = 'new_post',
  broadcast = {},
  rateLimit = true,
}) {
  if (!post?.id || !userId) return;

  const distributionTargets = Array.isArray(targets)
    ? targets
    : (Array.isArray(post.distribution_targets) ? post.distribution_targets : []);
  const shouldNotify = Array.isArray(recipientUserIds)
    || distributionTargets.includes('persona_followers')
    || distributionTargets.includes('connections');
  if (!shouldNotify) return;

  if (rateLimit) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from('Post')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo)
      .overlaps('distribution_targets', ['persona_followers', 'connections']);
    if (recentCount >= 3) {
      logger.info('[newPostNotify] Skipping - rate limit (3+ posts/hour)', { userId, postId: post.id });
      return;
    }
  }

  const recipients = await resolvePostFanoutRecipients({
    post,
    userId,
    personaContext,
    targets: distributionTargets,
    recipientUserIds,
  });
  if (!recipients.length) return;

  if (notificationMode === 'persona_broadcast') {
    await notificationService.notifyPersonaBroadcast({
      recipientUserIds: recipients,
      personaId: personaContext?.id || post.identity_context_id,
      personaHandle: personaContext?.handle,
      personaDisplayName: personaContext?.display_name || personaContext?.handle,
      messageId: broadcast.messageId || post.id,
      postId: post.id,
      visibility: broadcast.visibility || post.post_metadata?.broadcast_visibility || post.visibility,
      bodyPreview: broadcast.bodyPreview || post.content || '',
    });
    return;
  }

  const displayName = personaContext?.display_name || await getUserDisplayName(userId);
  const bodyText = post.title || (post.content || '').slice(0, 80);
  const capped = recipients.slice(0, 200);
  const { link: fanoutLink, meta: fanoutMeta } = newPostFanoutLinkAndMeta(post);

  const notifications = capped.map(recipientId => ({
    userId: recipientId,
    type: 'new_post',
    title: `${displayName} shared a new post`,
    body: bodyText,
    icon: '📝',
    link: fanoutLink,
    metadata: fanoutMeta,
    contextType: 'post',
    contextId: post.id,
  }));

  await notificationService.createBulkNotifications(notifications);
}

function runPostCreatedHooks(options = {}) {
  if (options.defer === false) {
    return runPostCreatedHooksNow(options);
  }
  setImmediate(() => {
    runPostCreatedHooksNow(options).catch((err) => {
      logger.warn('[newPostNotify] Notification failed (non-blocking)', {
        postId: options.post?.id,
        error: err.message,
      });
    });
  });
  return Promise.resolve();
}

module.exports = {
  runPostCreatedHooks,
  runPostCreatedHooksNow,
};
