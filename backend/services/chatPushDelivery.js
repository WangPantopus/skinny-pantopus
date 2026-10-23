/** Transactional chat push outbox. Content and device tokens are read only at delivery. */
const db = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { loadChatPeople } = require('./chatPeople');
const pushService = require('./pushService');
const notificationService = require('./notificationService');
let stopped = true;
let running = false;
let wakeTimer;
let recoveryTimer;
let unsubscribe;

async function rpc(name, args) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw Object.assign(new Error('Chat push storage unavailable'), { code: error.code });
  return data;
}

async function finish(job, status, accepted = []) {
  return rpc('finish_chat_push_delivery', {
    p_id: job.id, p_lease: job.lease_id, p_status: status, p_accepted: accepted,
  });
}

async function deliver(job) {
  let accepted = [];
  let renewing = false;
  let leaseLost = false;
  const heartbeat = setInterval(async () => {
    if (renewing) return;
    renewing = true;
    try { if (!await rpc('renew_chat_push_delivery', { p_id: job.id, p_lease: job.lease_id })) leaseLost = true; }
    catch { leaseLost = true; }
    finally { renewing = false; }
  }, 30_000);
  heartbeat.unref?.();
  try {
    let current = await rpc('read_chat_push_delivery', { p_id: job.id, p_lease: job.lease_id });
    if (!current) return await finish(job, 'suppressed');
    const message = current.message;
    const people = job.business_notice
      ? await loadChatPeople([message.user_id, job.identity_user_id]) : new Map();
    const senderName = people.get(String(message.user_id))?.displayName || 'Someone';
    const preview = message.type === 'text'
      ? String(message.message || '').slice(0, 100) + (String(message.message || '').length > 100 ? '…' : '')
      : message.type === 'file' ? '📎 Sent an attachment' : '💬 New message';
    let freshNotice = null;
    let payload = {
      // A delayed alert may display after account switch before native code runs.
      // Keep message content in authenticated chat/bell views, never the OS payload.
      title: 'New message', body: 'Open Pantopus to read it.',
      data: { type: 'chat_message', recipient_user_id: job.recipient_user_id,
        room_id: message.room_id, message_id: message.id,
        notificationId: job.id, link: `/chat/${message.room_id}` },
    };
    if (job.business_notice) {
      const title = `New message for ${people.get(String(job.identity_user_id))?.displayName || 'your business'}`;
      const result = await rpc('prepare_chat_push_notice', {
        p_id: job.id, p_lease: job.lease_id, p_title: title, p_body: `${senderName}: ${preview}`,
      });
      if (!result?.notice || result.notice.is_read) return await finish(job, 'suppressed');
      if (result.created) {
        await notificationService.publishStoredNotification(result.notice);
        freshNotice = result.notice;
      }
      payload = { title: 'New business message', body: 'Open Pantopus to read it.',
        data: { type: 'business_message', notificationId: result.notice.id, link: result.notice.link,
          ...result.notice.metadata, recipient_user_id: job.recipient_user_id } };
    }
    // Identity/notice work can take time: recheck authorization, read/mute and deletion
    // immediately before contacting a provider. A database failure retries, never allows.
    current = await rpc('read_chat_push_delivery', { p_id: job.id, p_lease: job.lease_id });
    if (!current?.pushAllowed) return await finish(job, 'suppressed');
    // Let foreground clients distinguish the visible topic from another topic
    // in the same room. Use the last authorized snapshot, never retained read scope.
    if (current.message.topic_id) payload.data.topic_id = current.message.topic_id;
    if (stopped || leaseLost) return await finish(job, 'pending');
    if (freshNotice) notificationService.emitDesktopAlert(freshNotice);
    const receipt = await pushService.sendToUserWithReceipt(job.recipient_user_id, payload, {
      settledRegistrationIds: job.accepted_registration_ids,
    });
    accepted = receipt.acceptedRegistrationIds || [];
    await finish(job, receipt.unresolvedCount > 0 ? 'pending' : 'done', accepted);
  } catch (error) {
    // No payload, device token, private staff identity or provider error body in logs.
    logger.warn('chat_push_attempt_deferred', { code: error.code || 'UNAVAILABLE' });
    await finish(job, 'pending', accepted).catch(() => {}); // expired leases are recovered by another worker
  } finally { clearInterval(heartbeat); }
}

async function drain() {
  if (stopped || running) return;
  running = true;
  try {
    for (let batch = 0; !stopped && batch < 10; batch++) {
      const jobs = await rpc('claim_chat_push_delivery', { p_limit: 4 });
      if (!jobs?.length) return;
      await Promise.all(jobs.map(deliver));
    }
    wake(250);
  } catch (error) {
    logger.warn('chat_push_claim_deferred', { code: error.code || 'UNAVAILABLE' });
  } finally { running = false; }
}

function wake(delay = 20) {
  if (stopped || wakeTimer) return;
  wakeTimer = setTimeout(() => { wakeTimer = null; void drain(); }, delay);
  wakeTimer.unref?.();
}
function start() {
  if (!stopped || process.env.NODE_ENV === 'test') return;
  stopped = false;
  unsubscribe = require('./syncChangedService').onChange((change) => {
    if (change.t === 'ChatPushDelivery') wake();
  });
  recoveryTimer = setInterval(() => wake(), 30_000);
  recoveryTimer.unref?.();
  wake();
}
function stop() {
  stopped = true;
  clearTimeout(wakeTimer); wakeTimer = null;
  clearInterval(recoveryTimer);
  unsubscribe?.(); unsubscribe = null;
}
module.exports = { start, stop, wake };
