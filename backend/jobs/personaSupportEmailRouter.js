/**
 * Routes incoming `support+<handle>@<domain>` emails to platform support
 * with a metadata header that identifies the persona. Triggered by AWS
 * SES (or equivalent) → Lambda → HMAC-signed POST to
 * /api/internal/email-inbound (see routes/internalEmailInbound.js).
 *
 * Per audience-profile design v2 §17 #8 + §6.3: the persona owner's
 * real email is never exposed on Stripe receipts. Customers who reply
 * to a receipt land here, and Pantopus support intermediates so the
 * creator's private inbox stays private.
 *
 * The router is a pure function over the parsed inbound email — it
 * has no HTTP concerns. The route layer owns parsing + auth.
 */

const supabaseAdmin = require('../config/supabaseAdmin');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// Match `support+<handle>@<domain>`. Handle is constrained to the same
// character set as PublicPersona.handle.
const PERSONA_SUPPORT_TO_RE = /^support\+([a-zA-Z0-9_.-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/i;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Parse a `to`-address into `{ handle, domain }` or null.
 */
function parsePersonaSupportAddress(toAddress) {
  const match = String(toAddress || '').match(PERSONA_SUPPORT_TO_RE);
  if (!match) return null;
  return { handle: match[1], domain: match[2] };
}

/**
 * Route an inbound email. Returns one of:
 *   { handled: false, reason }          — not a persona-support address
 *   { handled: true, action: 'forwarded', personaId }
 *   { handled: true, action: 'bounce_polite', handle }
 *
 * `from`/`subject`/`text`/`html` come from the Lambda's parsed payload.
 */
async function routeInboundPersonaSupportEmail({ to, from, subject, text, html }) {
  const parsed = parsePersonaSupportAddress(to);
  if (!parsed) {
    logger.warn('persona_support_email.unrecognized_to', { to });
    return { handled: false, reason: 'unrecognized_to_address' };
  }

  const { handle } = parsed;
  // Look up by case-insensitive handle. PublicPersona.handle_normalized
  // stores the lowercased canonical form; query that for safety.
  const lcHandle = handle.toLowerCase();
  const { data: persona, error } = await supabaseAdmin
    .from('PublicPersona')
    .select('id, handle, display_name, status')
    .eq('handle_normalized', lcHandle)
    .maybeSingle();

  if (error) {
    logger.error('persona_support_email.lookup_failed', { handle: lcHandle, error: error.message });
    return { handled: false, reason: 'lookup_failed' };
  }

  if (!persona || persona.status !== 'active') {
    // Polite bounce — never drop a customer mail silently. They get a
    // friendly "we couldn't find that profile" reply; the original
    // message is summarized in our logs for support to triage if it
    // looks legitimate.
    logger.info('persona_support_email.no_persona', { handle: lcHandle });
    await emailService.sendEmail({
      to: from,
      subject: `Re: ${subject || 'your message'}`,
      html: `
        <p>Hi,</p>
        <p>Thanks for writing to Pantopus support. We couldn't find a Beacon
        matching this address. If you meant to contact a different creator, please
        reach out via their Beacon on Pantopus.</p>
        <p>If you think this is a mistake, reply with the creator's name or @handle
        and our support team will help connect you.</p>
        <p>— The Pantopus team</p>
      `,
    });
    return { handled: true, action: 'bounce_polite', handle: lcHandle };
  }

  // Forward to platform support. The subject prefix lets support route
  // the conversation back to the right persona without us forwarding
  // the creator's real email anywhere.
  const platformSupport = process.env.PLATFORM_SUPPORT_EMAIL || 'support@pantopus.com';
  const safeFrom = escapeHtml(from);
  const safeHandle = escapeHtml(persona.handle);
  const safeDisplayName = escapeHtml(persona.display_name || persona.handle);
  const safeBody = html || `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(text || '')}</pre>`;

  await emailService.sendEmail({
    to: platformSupport,
    subject: `[@${persona.handle}] ${subject || '(no subject)'}`,
    html: `
      <p><strong>Inbound persona-support email</strong></p>
      <p><strong>From:</strong> ${safeFrom}</p>
      <p><strong>Persona:</strong> @${safeHandle} (${safeDisplayName})</p>
      <p><strong>Persona id (internal):</strong> ${escapeHtml(persona.id)}</p>
      <hr/>
      ${safeBody}
    `,
  });
  return { handled: true, action: 'forwarded', personaId: persona.id };
}

module.exports = {
  parsePersonaSupportAddress,
  routeInboundPersonaSupportEmail,
};
