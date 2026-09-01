/**
 * Notification template registry + render harness.
 *
 * Audience Profile design v2 §6.2 + §13.7 and unified-IA §6: every
 * notification template carries an explicit context tag (personal | audience
 * | platform). The registry validates at registration time that the template
 * only interpolates from the field allowlist for its context, and a render-
 * time check guards against accidental cross-context vars at runtime.
 *
 * Why the harness matters: the in-app feed groups by (user_id,
 * related_entity_type, related_entity_id, context) — but the harder firewall
 * comes from preventing a personal-context template from EVER carrying an
 * audience-side identifier (`personaHandle`, `fan_handle`, …) or vice
 * versa. A personal-context push that mentions a persona handle is the same
 * privacy leak as a leaky API serializer; this module makes it
 * structurally impossible.
 *
 * The registry is intentionally additive: existing notifyX functions in
 * notificationService.js keep their imperative call style, but each one is
 * paired with a registered template entry that documents the placeholders
 * it MAY use. A unit test asserts every registration validates clean,
 * which is what catches violations in CI.
 */

const CONTEXTS = Object.freeze(['personal', 'audience', 'platform']);

// Field allowlists per context. Each entry is the LITERAL placeholder name
// (without braces) that may appear in `pushTitle` / `pushBody` / `title` /
// `body` / `link` template strings.
//
// Naming convention: dotted path (e.g., `actor.displayName`,
// `home.name`). Top-level platform-neutral fields live without a prefix.
const PERSONAL_FIELDS = Object.freeze([
  // Actor / counterparty (always served from a personal-side serializer).
  'actor.displayName',
  'actor.handle',
  'actor.id',
  'actor.localProfile.displayName',
  'actor.localProfile.handle',
  'actor.localProfile.avatarUrl',
  // Personal-side context entities.
  'home.id',
  'home.name',
  'home.address',
  'business.id',
  'business.displayName',
  'business.handle',
  'gig.id',
  'gig.title',
  'listing.id',
  'listing.title',
  'mailbox.id',
  'task.id',
  'task.title',
  // Generic platform-neutral fields personal-side templates may need
  // (payment receipts, dispute / claim status text). These are inherited
  // by audience and platform contexts as well — they carry no identity.
  'amount',
  'currency',
  'periodEnd',
  'billingDate',
  'status',
  'type',
  'role',
  'message',
  'reason',
]);

const AUDIENCE_FIELDS = Object.freeze([
  'persona.id',
  'persona.handle',
  'persona.displayName',
  'persona.avatarUrl',
  // Fan-side identity (PersonaMembership): handle and display name are the
  // ONLY fields that may appear in audience-context notifications. The fan
  // user_id, real name, email, etc. are forbidden by construction.
  'fan.handle',
  'fan.displayName',
  'fan.avatarUrl',
  'membership.id',
  'membership.tierName',
  'membership.tierRank',
  'broadcast.id',
  'broadcast.bodyPreview',
  'message',
]);

const PLATFORM_FIELDS = Object.freeze([
  // Subscription / billing primitives — no identity at all.
  'amount',
  'currency',
  'periodEnd',
  'billingDate',
  'status',
  'type',
  'message',
  'reason',
]);

const CONTEXT_ALLOWED_FIELDS = Object.freeze({
  personal: new Set(PERSONAL_FIELDS),
  audience: new Set(AUDIENCE_FIELDS),
  platform: new Set(PLATFORM_FIELDS),
});

// Forbidden cross-context tokens that callers might be tempted to write —
// flagged with an explicit error message that names the violation rather
// than a generic "unknown placeholder" lookup miss. These are purely
// informational; the registration check below would catch them as
// not-in-allowlist anyway.
const CROSS_CONTEXT_HINTS = Object.freeze({
  personal: [
    'personaHandle', 'persona.handle', 'fan.handle', 'fan.displayName',
    'membership.tierName',
  ],
  audience: [
    'actor.localProfile.displayName', 'actor.localProfile.handle',
    'home.name', 'gig.title', 'listing.title', 'mailbox.id',
  ],
  platform: [
    'actor.displayName', 'persona.handle', 'home.name', 'gig.title',
    'fan.handle', 'fan.displayName',
  ],
});

const PLACEHOLDER_RE = /\{([a-zA-Z_][a-zA-Z0-9_.]*)\}/g;

function extractPlaceholders(str) {
  if (!str || typeof str !== 'string') return [];
  const seen = new Set();
  let match;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(str)) !== null) {
    seen.add(match[1]);
  }
  return [...seen];
}

function rejectCrossContext(name, context, placeholder) {
  const isHint = (CROSS_CONTEXT_HINTS[context] || []).includes(placeholder);
  const detail = isHint
    ? `\`{${placeholder}}\` is an explicitly forbidden cross-context identifier`
    : `\`{${placeholder}}\` is not in the allowed field list for the \`${context}\` context`;
  const allowedSample = [...CONTEXT_ALLOWED_FIELDS[context]].slice(0, 6).join(', ');
  return new Error(
    `Cross-context interpolation in notification template "${name}": ${detail}. ` +
    `Allowed fields for \`${context}\` include: ${allowedSample}, … ` +
    `(see backend/services/notificationTemplateRegistry.js).`
  );
}

function validateTemplate(template) {
  if (!template || typeof template !== 'object') {
    throw new Error('Template must be an object.');
  }
  const { name, context } = template;
  if (!name || typeof name !== 'string') {
    throw new Error('Template "name" is required.');
  }
  if (!CONTEXTS.includes(context)) {
    throw new Error(
      `Template "${name}" has invalid context "${context}". ` +
      `Must be one of: ${CONTEXTS.join(', ')}.`
    );
  }
  const allowed = CONTEXT_ALLOWED_FIELDS[context];
  const surfaces = ['pushTitle', 'pushBody', 'title', 'body', 'link'];
  for (const surface of surfaces) {
    const value = template[surface];
    if (value == null) continue;
    if (typeof value !== 'string') {
      throw new Error(
        `Template "${name}" surface "${surface}" must be a string when present.`
      );
    }
    for (const placeholder of extractPlaceholders(value)) {
      if (!allowed.has(placeholder)) {
        throw rejectCrossContext(name, context, placeholder);
      }
    }
  }
  return true;
}

const _registry = new Map();

function registerTemplate(template) {
  validateTemplate(template);
  if (_registry.has(template.name)) {
    throw new Error(`Notification template "${template.name}" already registered.`);
  }
  _registry.set(template.name, Object.freeze({ ...template }));
  return template;
}

function getTemplate(name) {
  return _registry.get(name) || null;
}

function listTemplates() {
  return [..._registry.values()];
}

function clearRegistry() {
  _registry.clear();
}

function lookupValue(vars, dotted) {
  return dotted.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, vars);
}

/**
 * Render a registered template with the given vars. The rendering step
 * re-validates that every placeholder in the template is allowed for the
 * registered context — defense in depth in case a template object got
 * mutated after registration. Vars containing keys that aren't in the
 * allowlist are accepted (they're never interpolated), but cross-context
 * placeholders inside the template body still throw.
 */
function renderTemplate(name, vars = {}) {
  const template = _registry.get(name);
  if (!template) {
    throw new Error(`Notification template "${name}" is not registered.`);
  }
  const allowed = CONTEXT_ALLOWED_FIELDS[template.context];
  const surfaces = ['pushTitle', 'pushBody', 'title', 'body', 'link'];
  const out = { name: template.name, context: template.context, type: template.type || template.name };
  for (const surface of surfaces) {
    const raw = template[surface];
    if (raw == null) continue;
    out[surface] = raw.replace(PLACEHOLDER_RE, (whole, placeholder) => {
      if (!allowed.has(placeholder)) {
        throw rejectCrossContext(template.name, template.context, placeholder);
      }
      const value = lookupValue(vars, placeholder);
      return value == null ? '' : String(value);
    });
  }
  return out;
}

module.exports = {
  CONTEXTS,
  PERSONAL_FIELDS,
  AUDIENCE_FIELDS,
  PLATFORM_FIELDS,
  CONTEXT_ALLOWED_FIELDS,
  CROSS_CONTEXT_HINTS,
  extractPlaceholders,
  validateTemplate,
  registerTemplate,
  getTemplate,
  listTemplates,
  clearRegistry,
  renderTemplate,
};
