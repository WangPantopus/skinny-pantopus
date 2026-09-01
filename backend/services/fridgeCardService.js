/**
 * Fridge Card Service (Wave 1, #2)
 *
 * A 911-ready household card behind an unguessable code: the exact
 * verified address (the first thing a dispatcher asks for) plus the
 * facts the household chose to put on it — members and allergies,
 * meds, pets, shutoff locations, emergency contacts.
 *
 * Trust model:
 *   issue   — route enforces verified occupancy + home-manage; the
 *             address block is SERVER-derived from the Home row, never
 *             client input. Section content IS client input by design
 *             (only the household knows Mia's allergy) — it is shape-
 *             validated, length-capped, and frozen at issue.
 *   view    — GET /api/public/fridge-cards/:code returns the frozen
 *             card while active. A revoked card returns its status and
 *             NO content — this is health-adjacent data, revocation
 *             must actually pull it. Unknown codes: uniform
 *             { valid: false }.
 *   honesty — nothing here reaches 911 dispatch. Serialized copy and
 *             clients must never imply it does.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { generateLetterCode, normalizeLetterCode, addressLine1FromHome, webBaseUrl } = require('./residencyLetterService');

// Section vocabulary — fixed so clients can render icons/order without
// trusting free-form keys.
const SECTION_KEYS = ['household', 'medical', 'pets', 'utilities', 'contacts', 'notes'];
const MAX_ITEMS_PER_SECTION = 12;
const MAX_LABEL_LEN = 80;
const MAX_NOTE_LEN = 160;
const MAX_CARD_LABEL_LEN = 40;

function cardUrl(code) {
  return `${webBaseUrl()}/fridge-card/${code}`;
}

class FridgeCardError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function cleanLine(value, maxLen) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/**
 * Validate + normalize the client-chosen sections into the frozen shape.
 * Throws BAD_CONTENT on anything outside the vocabulary — the card is a
 * public artifact, so its shape is a contract, not a suggestion.
 */
function normalizeSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new FridgeCardError('The card needs at least one section.', 'BAD_CONTENT');
  }
  if (sections.length > SECTION_KEYS.length) {
    throw new FridgeCardError('Too many sections.', 'BAD_CONTENT');
  }
  const seen = new Set();
  const out = [];
  for (const section of sections) {
    const key = section && section.key;
    if (!SECTION_KEYS.includes(key)) throw new FridgeCardError(`Unknown section "${key}".`, 'BAD_CONTENT');
    if (seen.has(key)) throw new FridgeCardError(`Duplicate section "${key}".`, 'BAD_CONTENT');
    seen.add(key);
    const rawItems = Array.isArray(section.items) ? section.items : [];
    if (rawItems.length > MAX_ITEMS_PER_SECTION) {
      throw new FridgeCardError(`Too many items in "${key}".`, 'BAD_CONTENT');
    }
    const items = rawItems
      .map((item) => ({
        label: cleanLine(item && item.label, MAX_LABEL_LEN),
        note: cleanLine(item && item.note, MAX_NOTE_LEN),
      }))
      .filter((item) => item.label || item.note);
    if (items.length) out.push({ key, items });
  }
  if (!out.length) throw new FridgeCardError('The card needs at least one filled-in item.', 'BAD_CONTENT');
  return out;
}

// Server-derived address block — the one part clients can never write.
// The street line comes from the letters service so every attested
// artifact prints the same address the same way.
function addressBlockFromHome(home) {
  const cityState = [home.city, home.state].filter(Boolean).join(', ');
  return {
    line1: addressLine1FromHome(home),
    city_state_zip: [cityState, home.zipcode].filter(Boolean).join(' '),
  };
}

function serializeCard(row, { includeContent = true } = {}) {
  const out = {
    id: row.id,
    home_id: row.home_id,
    label: row.label,
    status: row.status,
    card_code: row.card_code,
    card_url: cardUrl(row.card_code),
    issued_at: row.issued_at,
    revoked_at: row.revoked_at,
    view_count: row.view_count || 0,
    last_viewed_at: row.last_viewed_at,
  };
  if (includeContent) out.content = row.content;
  return out;
}

// ── Lifecycle ────────────────────────────────────────────────

/** Issue a card for the (already gated) home. */
async function issueCard({ homeId, userId, label, sections }) {
  const normalized = normalizeSections(sections);

  const { data: home, error: homeErr } = await supabaseAdmin
    .from('Home')
    .select('id, address, address2, city, state, zipcode')
    .eq('id', homeId)
    .maybeSingle();
  if (homeErr || !home) throw new Error('Home not found');

  const row = {
    id: crypto.randomUUID(),
    home_id: homeId,
    created_by: userId,
    card_code: generateLetterCode(),
    label: cleanLine(label, MAX_CARD_LABEL_LEN) || null,
    content: {
      address: addressBlockFromHome(home),
      sections: normalized,
    },
    status: 'active',
    issued_at: new Date().toISOString(),
  };

  const { data: saved, error } = await supabaseAdmin.from('FridgeCard').insert(row).select().single();
  if (error) {
    logger.error('fridgeCard: insert failed', { homeId, userId, error: error.message });
    throw new Error('Could not save the card');
  }
  logger.info('fridgeCard: issued', { cardId: saved.id, homeId, userId });
  return serializeCard(saved);
}

/** The home's cards, newest first — visible to any home member. */
async function listCards({ homeId }) {
  const { data, error } = await supabaseAdmin
    .from('FridgeCard')
    .select('id, home_id, created_by, label, content, status, card_code, issued_at, revoked_at, view_count, last_viewed_at')
    .eq('home_id', homeId)
    .order('issued_at', { ascending: false });
  if (error) {
    logger.error('fridgeCard: list failed', { homeId, error: error.message });
    throw new Error('Could not load cards');
  }
  return (data || []).map((row) => serializeCard(row));
}

/**
 * Revoke — home-manage gate lives in the route; the service only
 * requires the card to belong to the home. Returns null when not found.
 */
async function revokeCard({ homeId, cardId }) {
  const { data, error } = await supabaseAdmin
    .from('FridgeCard')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', cardId)
    .eq('home_id', homeId)
    .eq('status', 'active')
    .select()
    .maybeSingle();
  if (error) {
    logger.error('fridgeCard: revoke failed', { cardId, error: error.message });
    throw new Error('Could not revoke the card');
  }
  return data ? serializeCard(data) : null;
}

/**
 * Public card fetch by code.
 *   active  → full frozen card
 *   revoked → status only, NO content (health-adjacent data)
 *   unknown → uniform { valid: false }
 */
async function getCardByCode(code) {
  const normalized = normalizeLetterCode(code);
  if (!normalized) return { valid: false };

  const { data, error } = await supabaseAdmin
    .from('FridgeCard')
    .select('id, home_id, label, content, status, issued_at, revoked_at, view_count')
    .eq('card_code', normalized)
    .maybeSingle();
  if (error || !data) return { valid: false };

  if (data.status !== 'active') {
    return { valid: true, status: data.status, revoked_at: data.revoked_at };
  }

  // View telemetry for the household (best-effort).
  supabaseAdmin
    .from('FridgeCard')
    .update({ view_count: (data.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(({ error: updErr }) => {
      if (updErr) logger.warn('fridgeCard: view_count update failed', { error: updErr.message });
    });

  return {
    valid: true,
    status: 'active',
    label: data.label,
    content: data.content,
    issued_at: data.issued_at,
  };
}

module.exports = {
  issueCard,
  listCards,
  revokeCard,
  getCardByCode,
  FridgeCardError,
  SECTION_KEYS,
  // Exported for testing.
  normalizeSections,
  addressBlockFromHome,
};
