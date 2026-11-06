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

// A chat push shows the conversation and the message, as other messaging apps do (founder, November 5): a direct or
// task chat under the sender's name, any other chat under the name the Messages list gives it with the sender before
// the message. People are named as the room names them (chatPeople), so a business goes by its name, never by the
// staff member who wrote for it. Hiding this on a locked phone is the phone's setting, as for other apps: iOS Show
// Previews (When Unlocked by default; the CHAT_MESSAGE category's placeholder stands in, apnsClient) and Android's
// sensitive-content setting (NotificationDispatcher posts a generic public version).
const PREVIEW_LIMIT = 300;
const ATTACHMENT_LABEL = /^(?:photo|video|document|media|\[[^\]]*attachment\])$/i;

function clip(text, limit = PREVIEW_LIMIT) {
  const chars = Array.from(String(text || '').trim());
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('').trimEnd()}…` : chars.join('');
}

function attachmentLabel(attachments, type) {
  const kinds = attachments.map((file) => String(file?.mime_type || file?.mimeType || '').toLowerCase().split('/')[0]);
  const count = attachments.length;
  const all = (kind) => (count ? kinds.every((k) => k === kind) : type === kind);
  if (all('image')) return ['📷', count > 1 ? `${count} photos` : 'Photo'];
  if (all('video')) return ['🎥', count > 1 ? `${count} videos` : 'Video'];
  if (all('audio')) return ['🎤', count > 1 ? `${count} audio files` : 'Audio'];
  if (count > 1) return ['📎', `${count} attachments`];
  return ['📄', String(attachments[0]?.original_filename || attachments[0]?.filename || 'File')];
}

/** The message as a notification line: its text, or what was sent (photos, a file, a place, a task, a listing). */
function messagePreview(message) {
  const text = String(message?.message || '').trim();
  const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
  const type = message?.type || 'text';
  if (attachments.length || ['image', 'video', 'audio', 'file'].includes(type)) {
    const [icon, label] = attachmentLabel(attachments, type);
    // Text sent with an attachment is its caption; a bare attachment's stored text is only its label.
    return clip(`${icon} ${text && !ATTACHMENT_LABEL.test(text) ? text : label}`);
  }
  const meta = message?.metadata || {};
  if (type === 'location') return clip(`📍 ${meta.address || text || 'Location'}`);
  if (type === 'gig_offer') return clip(`📋 ${meta.title || text || 'Task'}`);
  if (type === 'listing_offer') return clip(`🏷️ ${meta.title || text || 'Listing'}`);
  return clip(text) || 'New message';
}

/** A group, Home, plan or Support Train chat's name in the Messages list; null for a direct or task chat. */
async function conversationName(roomId) {
  const { data: room, error } = await db.from('ChatRoom')
    .select('type, name, support_train:support_train_id(Activity(title))').eq('id', roomId).maybeSingle();
  if (error) throw Object.assign(new Error('Chat room unavailable'), { code: error.code });
  if (!room || ['direct', 'gig'].includes(room.type)) return null;
  return room.support_train?.Activity?.title || room.name || 'Group';
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
    const [people, conversation] = await Promise.all([
      loadChatPeople(job.business_notice ? [message.user_id, job.identity_user_id] : [message.user_id]),
      job.business_notice ? null : conversationName(message.room_id),
    ]);
    const senderName = people.get(String(message.user_id))?.displayName || 'Someone';
    const preview = messagePreview(message);
    let freshNotice = null;
    let payload = {
      title: conversation || senderName,
      body: conversation ? `${senderName}: ${preview}` : preview,
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
      // The push says what the bell notice says: "New message for <business>", "<sender>: <message>".
      payload = { title: result.notice.title, body: result.notice.body || preview,
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
