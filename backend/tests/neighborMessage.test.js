/**
 * Tests for neighbor messaging (W2.6) — the pure, DB-free pieces:
 *
 *  - neighborMessageTemplates: template-only catalog lookups. Only known
 *    ids resolve; the frozen bodies are what get delivered.
 *  - neighborMessageSerializer: the identity firewall. The recipient-facing
 *    projection must NEVER carry the sender's id / home / name — only the
 *    anonymized "a verified neighbor nearby" label.
 */

const {
  MESSAGE_TEMPLATES,
  REPLY_TEMPLATES,
  getMessageTemplate,
  getReplyTemplate,
} = require('../services/neighborMessageTemplates');

const {
  serializeReceived,
  serializeSent,
  ANON_SENDER_LABEL,
} = require('../serializers/neighborMessageSerializer');

describe('neighborMessageTemplates — template-only catalog', () => {
  it('exposes a non-empty catalog of outbound notes and templated replies', () => {
    expect(MESSAGE_TEMPLATES.length).toBeGreaterThan(0);
    expect(REPLY_TEMPLATES.length).toBeGreaterThan(0);
    for (const t of MESSAGE_TEMPLATES) {
      expect(t).toEqual(expect.objectContaining({ id: expect.any(String), category: expect.any(String), body: expect.any(String) }));
    }
  });

  it('resolves only known template ids', () => {
    expect(getMessageTemplate('package')).toEqual(expect.objectContaining({ id: 'package' }));
    expect(getMessageTemplate('definitely-not-real')).toBeNull();
    expect(getReplyTemplate('thanks')).toEqual(expect.objectContaining({ id: 'thanks' }));
    expect(getReplyTemplate('freeform')).toBeNull();
  });
});

describe('neighborMessageSerializer — identity firewall', () => {
  const row = {
    id: 'msg-1',
    sender_user_id: 'sender-uuid',
    sender_home_id: 'sender-home',
    recipient_user_id: 'recipient-uuid',
    recipient_home_id: 'recipient-home',
    block_geohash: 'c20fbf',
    template_id: 'package',
    category: 'Misdelivered package',
    body: 'A package may have been left at the wrong door near you.',
    reply_template_id: null,
    reply_body: null,
    replied_at: null,
    not_helpful: false,
    reported_at: null,
    read_at: null,
    created_at: '2026-06-07T16:00:00Z',
  };

  it('never leaks the sender identity to the recipient view', () => {
    const out = serializeReceived(row, { canReply: true });
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('sender-uuid');
    expect(serialized).not.toContain('sender-home');
    expect(out.sender.label).toBe(ANON_SENDER_LABEL);
    expect(out.sender.verified).toBe(true);
    expect(out.can_reply).toBe(true);
    expect(out).not.toHaveProperty('sender_user_id');
    expect(out).not.toHaveProperty('recipient_user_id');
  });

  it('reflects a templated reply when present', () => {
    const replied = { ...row, reply_template_id: 'thanks', reply_body: 'Thanks for the heads-up', replied_at: '2026-06-07T17:00:00Z' };
    const out = serializeReceived(replied, { canReply: false });
    expect(out.reply).toEqual({ template_id: 'thanks', body: 'Thanks for the heads-up', replied_at: '2026-06-07T17:00:00Z' });
    expect(out.can_reply).toBe(false);
  });

  it('the sender confirmation carries no recipient identity', () => {
    const out = serializeSent(row);
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('recipient-uuid');
    expect(serialized).not.toContain('recipient-home');
    expect(out.status).toBe('sent');
    expect(out.recipient.label).toBe(ANON_SENDER_LABEL);
  });
});
