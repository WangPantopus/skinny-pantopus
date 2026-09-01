'use strict';
/**
 * Neighbor message serializers (W2.6).
 *
 * The whole point of this surface is that the recipient never learns who
 * sent the message. These serializers are the firewall: they take a raw
 * NeighborMessage row (which holds sender_user_id / sender_home_id) and
 * return ONLY the anonymized projection — "a verified neighbor nearby" —
 * with no identity fields. Routes must always pass rows through here before
 * responding; never `res.json(row)` directly.
 *
 * @module serializers/neighborMessageSerializer
 */

const ANON_SENDER_LABEL = 'A verified neighbor nearby';
const BLOCK_LABEL = 'On your block';

/**
 * Recipient-facing view of a received message. Strips every identity field.
 *
 * @param {object} row              NeighborMessage row
 * @param {object} [opts]
 * @param {boolean} [opts.canReply] whether a templated reply is still allowed
 */
function serializeReceived(row, { canReply = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    category: row.category,
    body: row.body,
    created_at: row.created_at,
    // Identity firewall — a label, never a name/address/id.
    sender: { label: ANON_SENDER_LABEL, block_label: BLOCK_LABEL, verified: true },
    reply: row.reply_template_id
      ? {
          template_id: row.reply_template_id,
          body: row.reply_body,
          replied_at: row.replied_at,
        }
      : null,
    can_reply: !!canReply,
    not_helpful: !!row.not_helpful,
    reported: !!row.reported_at,
    read_at: row.read_at || null,
  };
}

/**
 * Sender-facing confirmation after a successful send. Carries no recipient
 * identity — the sender only ever sees the anonymized framing too.
 */
function serializeSent(row) {
  if (!row) return null;
  return {
    id: row.id,
    template_id: row.template_id,
    category: row.category,
    body: row.body,
    created_at: row.created_at,
    status: 'sent',
    recipient: { label: ANON_SENDER_LABEL, block_label: BLOCK_LABEL },
  };
}

module.exports = {
  serializeReceived,
  serializeSent,
  ANON_SENDER_LABEL,
  BLOCK_LABEL,
};
