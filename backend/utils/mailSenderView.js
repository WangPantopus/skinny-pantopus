/**
 * Who a letter is from, as the people it reaches see it.
 *
 * A letter sent as a business (POST /api/mailbox/send, by an owner or a staff member with mail.send) keeps the
 * person who wrote it in sender_user_id, for the sender's own escrow limits, withdraw and claim notices, and names
 * the business in sender_entity_id and sender_business_name. Everyone else sees the business: its id, its name and
 * whether it is verified, never the owner or staff member behind the seat. Letters stored before sender_entity_id
 * was set name the business by sender_business_name alone; since 2026-09-23 that column holds only a business the
 * sender could send mail for (resolveSenderBusiness in routes/mailbox.js).
 */

function sentAsBusiness(mail) {
  if (!mail || typeof mail !== 'object') return false;
  if (mail.sender_entity_id) return true;
  return typeof mail.sender_business_name === 'string' && mail.sender_business_name.trim() !== '';
}

function businessSender(mail) {
  const name = [mail.sender_business_name, mail.sender_display]
    .find((value) => typeof value === 'string' && value.trim());
  return { id: mail.sender_entity_id || null, name: name ? name.trim() : null };
}

// The MailObject row without what identifies its uploader: who created it and the storage key and URL, which carry
// the uploader's id in their path.
function objectForRecipient(object, businessId) {
  if (!object || typeof object !== 'object') return object;
  const { object_key: _key, bucket_name: _bucket, object_meta: _meta, ...rest } = object;
  return 'created_by_user_id' in object ? { ...rest, created_by_user_id: businessId } : rest;
}

// The stored mail.json payload names its sender in sender.senderUserId.
function payloadForRecipient(payload, businessId) {
  if (!payload || typeof payload !== 'object' || !payload.sender || typeof payload.sender !== 'object') return payload;
  return { ...payload, sender: { ...payload.sender, senderUserId: businessId } };
}

/**
 * The letter as `viewerId` may see it. Only a letter sent as a business changes, and not for the person who sent it:
 * sender_user_id becomes the business's id (null for an older letter that stored only the business's name), a joined
 * `sender` becomes the business, and the object metadata and payload drop the sender's own id.
 */
function presentMailSender(mail, viewerId = null) {
  if (!sentAsBusiness(mail)) return mail;
  if (viewerId && mail.sender_user_id && String(mail.sender_user_id) === String(viewerId)) return mail;
  const business = businessSender(mail);
  const shown = { ...mail };
  if ('sender_user_id' in shown) shown.sender_user_id = business.id;
  if (shown.sender && typeof shown.sender === 'object') {
    shown.sender = { ...('id' in shown.sender ? { id: business.id } : {}), username: null, name: business.name };
  }
  if ('object' in shown) shown.object = objectForRecipient(shown.object, business.id);
  if ('object_payload' in shown) shown.object_payload = payloadForRecipient(shown.object_payload, business.id);
  return shown;
}

function presentMailSenders(rows, viewerId = null) {
  return Array.isArray(rows) ? rows.map((row) => presentMailSender(row, viewerId)) : rows;
}

/**
 * The public claim page's sender (a token link, no sign-in). A letter sent as a business shows the business's name
 * and whether the business is verified; `person` (the sender's own name and verified state) is used otherwise.
 */
function claimPageSender(mail, person) {
  if (sentAsBusiness(mail)) {
    return { senderName: businessSender(mail).name || 'A business', senderVerified: mail.sender_trust === 'verified_business' };
  }
  return person;
}

module.exports = {
  sentAsBusiness,
  presentMailSender,
  presentMailSenders,
  objectForRecipient,
  payloadForRecipient,
  claimPageSender,
};
