/**
 * "Around the neighborhood" on a profile: the person's contributions, as the profile reads send them in
 * `contributions` (PRF CONTRACT.md SRV-1). Counts only, the same for every viewer:
 *   support_trains_helped  Support Trains (not drafts) the person signed up to help and didn't cancel, each once
 *   plans_hosted           plans the person hosted that took place (Plan.status 'ended', set by the Plans job)
 *   helpful_marks          Helpful marks (PostLike) other people gave the posts the person made as themselves (not
 *                          for a business or as a Beacon persona) that aren't archived or removed by moderation
 * Returns null when a count can't be read, so the apps leave the section out rather than show a wrong zero.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');

// A sign-up that wasn't canceled, as GET /api/activities/support-trains/:id counts a helper.
const HELPER_RESERVATION_STATUSES = ['reserved', 'delivered', 'confirmed'];

async function profileContributions(userId) {
  try {
    const [trains, plans, marks] = await Promise.all([
      supabaseAdmin
        .from('SupportTrainReservation')
        .select('support_train_id, train:support_train_id!inner ( status )')
        .eq('user_id', userId)
        .in('status', HELPER_RESERVATION_STATUSES)
        .neq('train.status', 'draft'),
      supabaseAdmin
        .from('Plan')
        .select('post_id', { count: 'exact', head: true })
        .eq('host_user_id', userId)
        .eq('status', 'ended'),
      supabaseAdmin
        .from('PostLike')
        .select('id, post:post_id!inner ( user_id )', { count: 'exact', head: true })
        .eq('post.user_id', userId)
        .is('post.archived_at', null)
        .neq('post.moderation_state', 'removed')
        // A post written for a business or as a persona doesn't name its writer, so a mark on it never moves the
        // writer's own count (it would link the two).
        .or('post_as.is.null,post_as.not.in.(business,persona)', { referencedTable: 'post' })
        .or('identity_context_type.is.null,identity_context_type.neq.persona', { referencedTable: 'post' })
        .neq('user_id', userId),
    ]);
    for (const result of [trains, plans, marks]) if (result.error) throw result.error;
    if (!Array.isArray(trains.data) || !Number.isInteger(plans.count) || !Number.isInteger(marks.count)) {
      throw new Error('Missing contribution counts');
    }
    return {
      support_trains_helped: new Set(trains.data.map((row) => row.support_train_id)).size,
      plans_hosted: plans.count,
      helpful_marks: marks.count,
    };
  } catch (err) {
    logger.warn('Profile contributions unavailable', { userId, error: err.message });
    return null;
  }
}

module.exports = { profileContributions };
