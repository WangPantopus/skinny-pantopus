'use strict';
/**
 * Neighbor message templates — the single source of truth (W2.6).
 *
 * Neighbor messaging is template-only by design: there is no free-text
 * field anywhere in v1. The sender picks a pre-written, neutral note; the
 * recipient sees the exact same words. Keeping the catalog server-side
 * means the body the sender previews is byte-for-byte what is delivered,
 * and the API can reject anything that isn't a known template id.
 *
 * Both the outbound notes and the templated quick-replies live here. The
 * web/mobile compose screens fetch this catalog (GET /api/neighbor-messages
 * /templates) rather than hard-coding copy, so there is never any drift.
 *
 * @module services/neighborMessageTemplates
 */

// Outbound notes. `icon` names map to lucide-react on the clients.
const MESSAGE_TEMPLATES = Object.freeze([
  {
    id: 'noise',
    icon: 'volume-2',
    category: 'Late-night noise',
    body: 'A verified neighbor mentioned some noise after 10pm. Just a friendly heads-up — no need to reply.',
  },
  {
    id: 'package',
    icon: 'package',
    category: 'Misdelivered package',
    body: 'A package may have been left at the wrong door near you. You might want to check around.',
  },
  {
    id: 'vehicle',
    icon: 'car',
    category: 'Parked vehicle',
    body: 'A friendly heads-up that a vehicle has been parked nearby for a while. Nothing urgent.',
  },
  {
    id: 'pet',
    icon: 'dog',
    category: 'Pet in the yard',
    body: 'A neighbor noticed a pet out in the yard. Just making sure everything is okay.',
  },
  {
    id: 'gate',
    icon: 'door-open',
    category: 'Open gate or door',
    body: 'A gate or door nearby looks like it was left open. Thought you would want to know.',
  },
]);

// Templated quick-replies — anonymous both ways, also free of typed text.
const REPLY_TEMPLATES = Object.freeze([
  { id: 'thanks', body: 'Thanks for the heads-up' },
  { id: 'will_check', body: "Got it — I'll check" },
  { id: 'nothing', body: 'Nothing on my end, thanks' },
]);

const MESSAGE_BY_ID = new Map(MESSAGE_TEMPLATES.map((t) => [t.id, t]));
const REPLY_BY_ID = new Map(REPLY_TEMPLATES.map((t) => [t.id, t]));

/** Resolve an outbound template by id, or null when unknown. */
function getMessageTemplate(id) {
  return MESSAGE_BY_ID.get(id) || null;
}

/** Resolve a reply template by id, or null when unknown. */
function getReplyTemplate(id) {
  return REPLY_BY_ID.get(id) || null;
}

module.exports = {
  MESSAGE_TEMPLATES,
  REPLY_TEMPLATES,
  getMessageTemplate,
  getReplyTemplate,
};
