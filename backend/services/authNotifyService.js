// ============================================================
// authNotifyService — security notifications for persistent login
// (design §10 / §13). Email through the existing SMTP mailer
// (services/emailService.sendEmail) + best-effort push through pushService to
// the user's OTHER devices. Every message deep-links to
// https://pantopus.com/app/settings/security.
//
//   newDeviceLogin                — first login/resume on a key (honours
//                                   security_prefs.newDeviceEmail; deduped only
//                                   on proven lineage, never on model alone)
//   deviceRemoved                 — a device was revoked from the registry
//   passwordChangedOtherDevices   — password changed, other devices signed out
//   securitySignOut               — refresh-token reuse / device mismatch
//   lockdown                      — sign out everywhere
//
// All functions are best-effort: they never throw and never block the auth
// path on mail/push failures.
// ============================================================

const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const emailService = require('./emailService');
const pushService = require('./pushService');
const authPolicy = require('../config/authPolicy');
const authSessionService = require('./authSessionService');

const SECURITY_URL = authPolicy.SECURITY_DEEP_LINK;
const DEFAULT_PREFS = Object.freeze({ allowRestoreGrants: true, newDeviceEmail: true });

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Merge stored security_prefs with defaults. */
function normalizePrefs(raw) {
  const prefs = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    allowRestoreGrants: typeof prefs.allowRestoreGrants === 'boolean' ? prefs.allowRestoreGrants : DEFAULT_PREFS.allowRestoreGrants,
    newDeviceEmail: typeof prefs.newDeviceEmail === 'boolean' ? prefs.newDeviceEmail : DEFAULT_PREFS.newDeviceEmail,
  };
}

/** `{ email, firstName, prefs }` for a user, or null. */
async function loadRecipient(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('User')
      .select('id, email, first_name, name, username, security_prefs')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      email: data.email || null,
      firstName: data.first_name || data.name || data.username || null,
      prefs: normalizePrefs(data.security_prefs),
    };
  } catch (err) {
    logger.warn('auth.notify.recipient_lookup_failed', { userId, error: err.message });
    return null;
  }
}

function describeDevice(device) {
  if (!device) return 'a device';
  const name = device.name || device.model || null;
  const platform = device.platform === 'ios' ? 'iPhone/iPad' : device.platform === 'android' ? 'Android' : device.platform === 'web' ? 'web browser' : null;
  if (name && platform && !name.toLowerCase().includes(platform.toLowerCase())) return `${name} (${platform})`;
  return name || platform || 'a device';
}

function formatWhen(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(date) + ' UTC';
  } catch {
    return date.toISOString();
  }
}

/** Shared branded template (same look as the password-reset email). */
function buildEmail({ title, preheader, greetingName, paragraphs, ctaLabel, ctaUrl, footerNote }) {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@pantopus.com';
  const safeUrl = escapeHtml(ctaUrl);
  const hello = greetingName ? `Hi ${escapeHtml(greetingName)},` : 'Hi,';
  const bodyHtml = paragraphs
    .map((p) => `<p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 16px;">${escapeHtml(p)}</p>`)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f6f7f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827; -webkit-font-smoothing:antialiased;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f6f7f9;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f7f9; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px; background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;">
              <div style="font-size:18px; font-weight:700; color:#0284c7; letter-spacing:0.2px;">Pantopus</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px;">
              <h1 style="font-size:22px; font-weight:600; margin:0 0 16px; color:#111827;">${escapeHtml(title)}</h1>
              <p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 16px;">${hello}</p>
              ${bodyHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
                <tr>
                  <td style="border-radius:10px; background-color:#0284c7;">
                    <a href="${safeUrl}" style="display:inline-block; padding:13px 28px; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; border-radius:10px;">${escapeHtml(ctaLabel)}</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; word-break:break-all; margin:0 0 24px;">
                <a href="${safeUrl}" style="color:#0284c7; text-decoration:underline;">${safeUrl}</a>
              </p>
              <div style="border-top:1px solid #e5e7eb; padding-top:20px;">
                <p style="font-size:13px; line-height:1.6; color:#6b7280; margin:0;">${escapeHtml(footerNote)}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px;">
              <p style="font-size:12px; line-height:1.6; color:#9ca3af; margin:0 0 8px;">You're receiving this security notice because it concerns the Pantopus account linked to this address.</p>
              <p style="font-size:12px; line-height:1.6; color:#9ca3af; margin:0;">Questions? Reply to this email or write to <a href="mailto:${escapeHtml(supportEmail)}" style="color:#6b7280; text-decoration:underline;">${escapeHtml(supportEmail)}</a>.<br>Pantopus — Your household, organized.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${title}

${greetingName ? `Hi ${greetingName},` : 'Hi,'}

${paragraphs.join('\n\n')}

${ctaLabel}: ${ctaUrl}

${footerNote}

Questions? Reply to this email or write to ${supportEmail}.

Pantopus — Your household, organized.
`;
  return { subject: title, html, text };
}

async function sendSecurityEmail(userId, recipient, content, eventType, { req, deviceRowId } = {}) {
  if (!recipient?.email) return false;
  try {
    const result = await emailService.sendEmail({ to: recipient.email, ...content });
    if (result?.success) {
      await authSessionService.recordSecurityEvent({
        userId,
        deviceRowId: deviceRowId || null,
        type: eventType,
        req,
        meta: { subject: content.subject },
      });
      return true;
    }
    logger.warn('auth.notify.email_failed', { userId, subject: content.subject, error: result?.error });
  } catch (err) {
    logger.warn('auth.notify.email_error', { userId, subject: content.subject, error: err.message });
  }
  return false;
}

async function pushOthers(userId, exceptDeviceId, message) {
  try {
    await pushService.sendToUserExcludingDevice(userId, exceptDeviceId || null, message);
  } catch (err) {
    logger.debug('auth.notify.push_failed', { userId, error: err.message });
  }
}

const SECURITY_PUSH_DATA = { type: 'security', url: SECURITY_URL };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * "New sign-in on <device>". Skipped when security_prefs.newDeviceEmail=false
 * or when lineage is proven (`previousDevice` = the row this device resumed
 * from) AND the model matches — never deduped on model alone.
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {object} p.device           AuthDevice row (name, model, platform, device_id, id)
 * @param {object} [p.previousDevice] AuthDevice row the new one resumed from (proven lineage)
 * @param {string} [p.method]         'login' | 'oauth' | 'resume'
 * @param {object} [p.req]
 */
async function newDeviceLogin({ userId, device, previousDevice = null, method = 'login', req = null }) {
  if (!userId || !device) return { emailed: false, pushed: false, skipped: 'no_device' };
  if (previousDevice && previousDevice.model && device.model && previousDevice.model === device.model) {
    return { emailed: false, pushed: false, skipped: 'lineage' };
  }
  const recipient = await loadRecipient(userId);
  const label = describeDevice(device);
  const when = formatWhen();
  const ip = authSessionService.clientIp(req);
  const how = method === 'resume' ? 'restored a session' : 'signed in';

  let emailed = false;
  if (recipient?.prefs?.newDeviceEmail !== false) {
    const content = buildEmail({
      title: `New sign-in on ${label}`,
      preheader: `Your Pantopus account ${how} on ${label}. Not you? Review your devices.`,
      greetingName: recipient?.firstName,
      paragraphs: [
        `Your Pantopus account just ${how} on ${label} (${when}${ip ? `, from ${ip}` : ''}).`,
        'If this was you, no action is needed.',
        "If you don't recognise this device, remove it from your account and change your password right away.",
      ],
      ctaLabel: 'Review your devices',
      ctaUrl: SECURITY_URL,
      footerNote: 'You can turn new-device emails on or off under Settings › Security.',
    });
    emailed = await sendSecurityEmail(userId, recipient, content, 'new_device_email_sent', { req, deviceRowId: device.id });
  }

  await pushOthers(userId, device.device_id, {
    title: 'New sign-in',
    body: `Your account ${how} on ${label}. Not you? Review your devices.`,
    data: { ...SECURITY_PUSH_DATA, event: 'new_device' },
  });
  return { emailed, pushed: true, skipped: null };
}

/** "<device> was removed from your account". */
async function deviceRemoved({ userId, device, req = null, byUser = true }) {
  if (!userId) return { emailed: false };
  const recipient = await loadRecipient(userId);
  const label = describeDevice(device);
  const content = buildEmail({
    title: `${label} was signed out of Pantopus`,
    preheader: `${label} no longer has access to your Pantopus account.`,
    greetingName: recipient?.firstName,
    paragraphs: [
      byUser
        ? `${label} was removed from your account (${formatWhen()}). It has been signed out and will need a fresh sign-in to use Pantopus again.`
        : `${label} was signed out of your account for security (${formatWhen()}).`,
      "If you didn't do this, change your password and review the devices signed in to your account.",
    ],
    ctaLabel: 'Review your devices',
    ctaUrl: SECURITY_URL,
    footerNote: 'Removing a device signs it out immediately and deletes its notification registration.',
  });
  const emailed = await sendSecurityEmail(userId, recipient, content, 'device_removed_email_sent', { req, deviceRowId: device?.id });
  await pushOthers(userId, device?.device_id, {
    title: 'Device removed',
    body: `${label} was signed out of your account.`,
    data: { ...SECURITY_PUSH_DATA, event: 'device_removed' },
  });
  return { emailed };
}

/** "Your password was changed — other devices were signed out". */
async function passwordChangedOtherDevices({ userId, req = null, currentDevice = null }) {
  if (!userId) return { emailed: false };
  const recipient = await loadRecipient(userId);
  const content = buildEmail({
    title: 'Your Pantopus password was changed',
    preheader: 'Your password was changed and every other device was signed out.',
    greetingName: recipient?.firstName,
    paragraphs: [
      `Your Pantopus password was changed (${formatWhen()}). To keep your account safe, every other device was signed out — they will ask you to sign in again with the new password.`,
      "If you didn't change your password, reset it now from the sign-in screen and review your devices.",
    ],
    ctaLabel: 'Review your devices',
    ctaUrl: SECURITY_URL,
    footerNote: 'This device stays signed in.',
  });
  const emailed = await sendSecurityEmail(userId, recipient, content, 'password_changed_email_sent', { req });
  await pushOthers(userId, currentDevice?.device_id, {
    title: 'Password changed',
    body: 'Your password was changed. Other devices were signed out.',
    data: { ...SECURITY_PUSH_DATA, event: 'password_changed' },
  });
  return { emailed };
}

/**
 * "You were signed out for security" — refresh-token reuse or device-key
 * mismatch. `reason` = 'reuse' | 'mismatch'.
 */
async function securitySignOut({ userId, device = null, reason = 'reuse', req = null }) {
  if (!userId) return { emailed: false };
  const recipient = await loadRecipient(userId);
  const label = describeDevice(device);
  const why = reason === 'mismatch'
    ? `a sign-in token for ${label} was presented from a device that does not hold its key`
    : `a sign-in token for ${label} was used twice, which can mean it was copied`;
  const content = buildEmail({
    title: 'We signed out a device to protect your account',
    preheader: `Suspicious activity: ${label} was signed out of Pantopus.`,
    greetingName: recipient?.firstName,
    paragraphs: [
      `We noticed that ${why} (${formatWhen()}). As a precaution, that session was signed out.`,
      "If this was you (for example after restoring a backup), simply sign in again on that device.",
      "If you don't recognise this activity, change your password and review the devices signed in to your account.",
    ],
    ctaLabel: 'Review your devices',
    ctaUrl: SECURITY_URL,
    footerNote: 'Your other devices stay signed in unless you choose "Sign out of all other devices".',
  });
  const emailed = await sendSecurityEmail(userId, recipient, content, 'security_signout_email_sent', { req, deviceRowId: device?.id });
  await pushOthers(userId, device?.device_id, {
    title: 'Security sign-out',
    body: `${label} was signed out for security. Review your devices.`,
    data: { ...SECURITY_PUSH_DATA, event: 'security_signout', reason },
  });
  return { emailed };
}

/** "Everything was signed out" (Lockdown / password reset). */
async function lockdown({ userId, req = null, cause = 'lockdown' }) {
  if (!userId) return { emailed: false };
  const recipient = await loadRecipient(userId);
  const content = buildEmail({
    title: 'All devices were signed out of Pantopus',
    preheader: 'Every session on your account was signed out.',
    greetingName: recipient?.firstName,
    paragraphs: [
      cause === 'password_reset'
        ? `Your password was reset (${formatWhen()}) and every device was signed out. Sign in again with your new password on the devices you use.`
        : `Every device signed in to your Pantopus account was signed out (${formatWhen()}). Sign in again on the devices you use.`,
      "If you didn't do this, reset your password immediately and contact support.",
    ],
    ctaLabel: 'Review your devices',
    ctaUrl: SECURITY_URL,
    footerNote: 'Sessions restored from a device backup will need a full sign-in as well.',
  });
  const emailed = await sendSecurityEmail(userId, recipient, content, 'lockdown_email_sent', { req });
  // No push: every device is being signed out; the tokens are about to be dropped.
  return { emailed };
}

module.exports = {
  newDeviceLogin,
  deviceRemoved,
  passwordChangedOtherDevices,
  securitySignOut,
  lockdown,
  // helpers reused by authDeviceService
  normalizePrefs,
  DEFAULT_PREFS,
  describeDevice,
  SECURITY_URL,
};
