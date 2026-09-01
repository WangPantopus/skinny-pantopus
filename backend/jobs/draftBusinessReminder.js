/**
 * draftBusinessReminder
 *
 * Runs daily. Finds draft businesses created within the last 7 days with
 * incomplete profiles. Sends in-app notification and email reminders.
 * Caps at 3 reminders per business.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { getPublishRequirements } = require('../utils/businessConstants');

const MAX_REMINDERS = 3;

async function draftBusinessReminder() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find draft businesses created within last 7 days
  const { data: draftProfiles, error } = await supabaseAdmin
    .from('BusinessProfile')
    .select('business_user_id, business_type, profile_completeness, reminder_count, description, categories')
    .eq('is_published', false)
    .gte('created_at', sevenDaysAgo)
    .or('reminder_count.is.null,reminder_count.lt.3');

  if (error) {
    logger.error('draftBusinessReminder: query error', { error: error.message });
    return;
  }

  if (!draftProfiles || draftProfiles.length === 0) {
    return;
  }

  logger.info(`draftBusinessReminder: found ${draftProfiles.length} draft business(es) to remind`);

  for (const profile of draftProfiles) {
    const businessId = profile.business_user_id;
    const currentCount = profile.reminder_count || 0;

    if (currentCount >= MAX_REMINDERS) continue;

    // Get business name and owner email
    const { data: bizUser } = await supabaseAdmin
      .from('User')
      .select('name, email')
      .eq('id', businessId)
      .single();

    if (!bizUser) continue;

    // Build missing requirements list
    const missing = [];
    if (!profile.description || profile.description.length < 50) {
      missing.push('Write a description (50+ characters)');
    }
    if (!Array.isArray(profile.categories) || profile.categories.length === 0) {
      missing.push('Add at least one category');
    }

    // Check for location
    const { count: locCount } = await supabaseAdmin
      .from('BusinessLocation')
      .select('id', { count: 'exact', head: true })
      .eq('business_user_id', businessId)
      .eq('is_active', true);

    if ((locCount || 0) === 0) {
      missing.push('Add a location');
    }

    const completeness = profile.profile_completeness || 0;
    const missingText = missing.length > 0
      ? `Complete these steps to go live: ${missing.join(', ')}.`
      : 'Your profile is ready — just hit Publish!';

    const notifBody = `Your ${bizUser.name} profile is almost ready! ${missingText} It only takes a few minutes.`;

    // Insert in-app notification
    try {
      await supabaseAdmin.from('Notification').insert({
        user_id: businessId,
        type: 'draft_business_reminder',
        title: `${bizUser.name} is ${completeness}% complete`,
        body: notifBody,
        data: { business_id: businessId, completeness, missing },
      });
    } catch (notifErr) {
      logger.warn('draftBusinessReminder: notification insert failed', { businessId, error: notifErr.message });
    }

    // Send email if available
    if (bizUser.email) {
      try {
        const { sendTransactionalEmail } = require('../services/emailService');
        await sendTransactionalEmail({
          to: bizUser.email,
          subject: `Your ${bizUser.name} profile is almost ready!`,
          text: notifBody,
          html: `<p>${notifBody}</p><p><a href="${process.env.APP_URL || 'https://app.pantopus.com'}/businesses/${businessId}">Complete your profile</a></p>`,
        });
      } catch (emailErr) {
        // Email service may not be configured — non-critical
        logger.warn('draftBusinessReminder: email send failed', { businessId, error: emailErr.message });
      }
    }

    // Increment reminder count
    await supabaseAdmin
      .from('BusinessProfile')
      .update({ reminder_count: currentCount + 1 })
      .eq('business_user_id', businessId);

    logger.info('draftBusinessReminder: sent reminder', { businessId, name: bizUser.name, count: currentCount + 1 });
  }
}

module.exports = draftBusinessReminder;
