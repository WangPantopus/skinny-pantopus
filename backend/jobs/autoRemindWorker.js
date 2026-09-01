// ============================================================
// JOB: Auto-Remind Assigned Workers
// Sends automatic start-work reminders to workers who haven't
// started yet. Runs every 5 minutes.
//
// For scheduled gigs: reminds at 30min before and at start time.
// For ASAP gigs: reminds at 30min and 90min after acceptance.
// Caps at 2 auto-reminders per assignment.
// Respects 15-min cooldown and worker ack status.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { createNotification } = require('../services/notificationService');

const AUTO_REMINDER_CAP = 2;
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

async function autoRemindWorker() {
  const now = new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();

  // Fetch all assigned gigs that haven't started and haven't hit the cap
  const { data: gigs, error } = await supabaseAdmin
    .from('Gig')
    .select(
      'id, title, user_id, accepted_by, accepted_at, scheduled_start, ' +
      'starts_asap, last_worker_reminder_at, auto_reminder_count, ' +
      'worker_ack_status, worker_ack_eta_minutes, worker_ack_updated_at'
    )
    .eq('status', 'assigned')
    .is('started_at', null)
    .not('accepted_by', 'is', null)
    .lt('auto_reminder_count', AUTO_REMINDER_CAP);

  if (error) {
    logger.error('[autoRemindWorker] Failed to query gigs', { error: error.message });
    return;
  }

  if (!gigs || gigs.length === 0) return;

  let sentCount = 0;
  let skippedCount = 0;

  for (const gig of gigs) {
    try {
      // Skip if worker already confirmed starting
      if (gig.worker_ack_status === 'starting_now') {
        skippedCount++;
        continue;
      }

      // Respect 15-min cooldown from last reminder (manual or auto)
      if (gig.last_worker_reminder_at) {
        const lastMs = Date.parse(gig.last_worker_reminder_at);
        if (Number.isFinite(lastMs) && nowMs - lastMs < COOLDOWN_MS) {
          skippedCount++;
          continue;
        }
      }

      // If worker said running_late with ETA, delay reminder by their ETA
      if (gig.worker_ack_status === 'running_late' && gig.worker_ack_eta_minutes && gig.worker_ack_updated_at) {
        const ackMs = Date.parse(gig.worker_ack_updated_at);
        const etaEndMs = ackMs + gig.worker_ack_eta_minutes * 60 * 1000;
        if (Number.isFinite(etaEndMs) && nowMs < etaEndMs) {
          skippedCount++;
          continue;
        }
      }

      // Determine if it's time to send a reminder
      const reminderCount = gig.auto_reminder_count || 0;
      let shouldRemind = false;

      if (gig.scheduled_start) {
        // Scheduled gig: remind at T-30min (first) and T+0 (second)
        const startMs = Date.parse(gig.scheduled_start);
        if (!Number.isFinite(startMs)) continue;

        const minutesUntilStart = (startMs - nowMs) / 60000;

        if (reminderCount === 0 && minutesUntilStart <= 30) {
          shouldRemind = true;
        } else if (reminderCount === 1 && minutesUntilStart <= 0) {
          shouldRemind = true;
        }
      } else {
        // ASAP / unscheduled gig: remind at T+30min and T+90min after acceptance
        const acceptMs = gig.accepted_at ? Date.parse(gig.accepted_at) : NaN;
        if (!Number.isFinite(acceptMs)) continue;

        const minutesSinceAccept = (nowMs - acceptMs) / 60000;

        if (reminderCount === 0 && minutesSinceAccept >= 30) {
          shouldRemind = true;
        } else if (reminderCount === 1 && minutesSinceAccept >= 90) {
          shouldRemind = true;
        }
      }

      if (!shouldRemind) {
        skippedCount++;
        continue;
      }

      // Update the gig row first to prevent duplicate reminders on retry
      const { error: updateErr } = await supabaseAdmin
        .from('Gig')
        .update({
          last_worker_reminder_at: nowIso,
          auto_reminder_count: reminderCount + 1,
        })
        .eq('id', gig.id);

      if (updateErr) {
        logger.error('[autoRemindWorker] Failed to update gig, skipping notification', {
          gigId: gig.id,
          error: updateErr.message,
        });
        continue;
      }

      // Send the reminder notification
      const scheduledStartText = gig.scheduled_start
        ? ` The scheduled start is ${new Date(gig.scheduled_start).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'UTC',
          })} UTC.`
        : '';

      await createNotification({
        userId: gig.accepted_by,
        type: 'gig_start_reminder',
        title: `Please start "${gig.title || 'your task'}"`,
        body: `The task owner is waiting for you to begin work.${scheduledStartText}`,
        icon: '⏰',
        link: `/gigs/${gig.id}`,
        metadata: {
          gig_id: gig.id,
          reminder_kind: 'auto_start_work',
          auto_reminder_number: reminderCount + 1,
        },
      });

      sentCount++;
    } catch (err) {
      logger.error('[autoRemindWorker] Failed to process gig', {
        gigId: gig.id,
        error: err.message,
      });
    }
  }

  if (sentCount > 0 || skippedCount > 0) {
    logger.info('[autoRemindWorker] Completed', { sent: sentCount, skipped: skippedCount });
  }
}

module.exports = autoRemindWorker;
