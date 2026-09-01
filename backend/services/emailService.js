/**
 * Email Service
 * 
 * Uses nodemailer for sending emails.
 * In development (no SMTP config), logs emails via logger.
 * In production, uses configured SMTP transport.
 * 
 * Required env vars for production:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional:
 *   SMTP_FROM (defaults to "Pantopus <hello@pantopus.com>")
 *   APP_URL (defaults to "http://localhost:3000")
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const SMTP_FROM = process.env.SMTP_FROM || 'Pantopus <hello@pantopus.com>';

let transporter = null;
let devMode = true;

// Initialize transport
const requiredSmtpVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missingSmtpVars = requiredSmtpVars.filter((key) => !process.env[key]);

if (missingSmtpVars.length === 0) {
  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    devMode = false;
    logger.info('Email service initialized with SMTP transport');
  } catch (err) {
    logger.warn('Failed to init SMTP transport, falling back to dev mode', { error: err.message });
  }
} else {
  logger.warn('Email service running without SMTP transport. Emails will be logged only.', {
    missing: missingSmtpVars,
  });
}

/**
 * Send an email. In dev mode, logs to console instead.
 * @param {Object} opts - { to, subject, html, text, attachments? }
 *   attachments: optional nodemailer attachment array (e.g. an .ics calendar invite).
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
async function sendEmail({ to, subject, html, text, attachments }) {
  const mailOptions = {
    from: SMTP_FROM,
    to,
    subject,
    html,
    text: text || stripHtml(html),
  };
  if (attachments && attachments.length) {
    mailOptions.attachments = attachments;
  }

  if (devMode) {
    logger.info('📧 [DEV EMAIL] Would send email:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
    });
    logger.debug('DEV EMAIL body', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      body: mailOptions.text || '(html only)',
    });
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent', {
      to,
      subject,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error('Failed to send email', { to, subject, error: err.message });
    return { success: false, error: err.message };
  }
}

// ============================================================
//  HOME INVITE EMAIL
// ============================================================

/**
 * Send a home invitation email.
 * @param {Object} opts
 * @param {string} opts.toEmail - recipient email
 * @param {string} opts.inviterName - name of person who invited
 * @param {string} opts.homeName - home name/address
 * @param {string} opts.homeCity - city, state
 * @param {string} opts.role - proposed role
 * @param {string} opts.token - invite token
 * @param {string} [opts.message] - optional personal message
 * @param {boolean} [opts.isExistingUser] - whether recipient has a Pantopus account
 */
async function sendHomeInviteEmail({
  toEmail,
  inviterName,
  homeName,
  homeCity,
  role,
  token,
  message,
  isExistingUser = false,
}) {
  const acceptUrl = `${APP_URL}/invite/${token}`;
  const roleLabel = role.replace('_', ' ');

  const subject = `${inviterName} invited you to join their home on Pantopus`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background:#111827; padding:32px 32px 24px; text-align:center;">
      <div style="font-size:32px; margin-bottom:8px;">🏠</div>
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">You're Invited!</h1>
    </div>
    
    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
        <strong>${escapeHtml(inviterName)}</strong> has invited you to join their home on Pantopus as a <strong>${escapeHtml(roleLabel)}</strong>.
      </p>
      
      <!-- Home card -->
      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:0 0 20px;">
        <div style="font-size:15px; font-weight:600; color:#111827;">🏡 ${escapeHtml(homeName)}</div>
        ${homeCity ? `<div style="font-size:13px; color:#6b7280; margin-top:4px;">${escapeHtml(homeCity)}</div>` : ''}
      </div>
      
      ${message ? `
      <!-- Personal message -->
      <div style="background:#eff6ff; border-left:3px solid #3b82f6; padding:12px 16px; border-radius:0 8px 8px 0; margin:0 0 20px;">
        <div style="font-size:11px; text-transform:uppercase; color:#6b7280; font-weight:600; margin-bottom:4px;">Message from ${escapeHtml(inviterName)}</div>
        <p style="color:#374151; font-size:14px; line-height:1.5; margin:0; font-style:italic;">"${escapeHtml(message)}"</p>
      </div>
      ` : ''}
      
      <!-- CTA -->
      <div style="text-align:center; margin:28px 0;">
        <a href="${acceptUrl}" style="display:inline-block; background:#111827; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none;">
          ${isExistingUser ? 'View Invitation' : 'Join Pantopus & Accept'}
        </a>
      </div>
      
      <p style="color:#9ca3af; font-size:12px; text-align:center; margin:20px 0 0;">
        This invitation expires in 7 days.${!isExistingUser ? ' You\'ll create a free account to get started.' : ''}
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">
        Pantopus — Your household, organized.
      </p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        If you didn't expect this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
${inviterName} invited you to join their home on Pantopus!

Home: ${homeName}${homeCity ? ` (${homeCity})` : ''}
Role: ${roleLabel}
${message ? `\nMessage: "${message}"\n` : ''}
Accept the invitation: ${acceptUrl}

This invitation expires in 7 days.
${!isExistingUser ? 'You\'ll create a free account to get started.' : ''}
`;

  return sendEmail({ to: toEmail, subject, html, text });
}

// ============================================================
//  PASSWORD RESET EMAIL
// ============================================================

/**
 * Send a password reset email with the reset link.
 * @param {Object} opts
 * @param {string} opts.toEmail - recipient email
 * @param {string} opts.resetLink - full URL to open to reset password (from Supabase generateLink)
 */
async function sendPasswordResetEmail({ toEmail, resetLink }) {
  const subject = 'Reset your Pantopus password';
  const safeLink = escapeHtml(resetLink);
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@pantopus.com';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Reset your Pantopus password</title>
</head>
<body style="margin:0; padding:0; background-color:#f6f7f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827; -webkit-font-smoothing:antialiased;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f6f7f9;">
    Use the link below to choose a new password for your Pantopus account. The link expires in 1 hour.
  </div>
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
              <h1 style="font-size:22px; font-weight:600; margin:0 0 16px; color:#111827;">Reset your password</h1>
              <p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 22px;">
                We received a request to reset the password for your Pantopus account. Tap the button below to choose a new one.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:10px; background-color:#0284c7;">
                    <a href="${safeLink}" style="display:inline-block; padding:13px 28px; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; border-radius:10px;">
                      Choose a new password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.6; color:#6b7280; margin:0 0 8px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="font-size:13px; line-height:1.5; word-break:break-all; margin:0 0 24px;">
                <a href="${safeLink}" style="color:#0284c7; text-decoration:underline;">${safeLink}</a>
              </p>
              <div style="border-top:1px solid #e5e7eb; padding-top:20px;">
                <p style="font-size:13px; line-height:1.6; color:#6b7280; margin:0;">
                  This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will stay the same.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px;">
              <p style="font-size:12px; line-height:1.6; color:#9ca3af; margin:0 0 8px;">
                You're receiving this email because a password reset was requested for the Pantopus account linked to this address.
              </p>
              <p style="font-size:12px; line-height:1.6; color:#9ca3af; margin:0;">
                Questions? Reply to this email or write to
                <a href="mailto:${escapeHtml(supportEmail)}" style="color:#6b7280; text-decoration:underline;">${escapeHtml(supportEmail)}</a>.<br>
                Pantopus — Your household, organized.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Reset your Pantopus password

We received a request to reset the password for your Pantopus account. Open the link below to choose a new one:

${resetLink}

This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will stay the same.

Questions? Reply to this email or write to ${supportEmail}.

Pantopus — Your household, organized.
`;

  return sendEmail({ to: toEmail, subject, html, text });
}

// ============================================================
//  EMAIL VERIFICATION
// ============================================================

/**
 * Send an email verification message with a confirm link.
 * @param {Object} opts
 * @param {string} opts.toEmail - recipient email
 * @param {string} opts.verifyLink - full URL the user taps to confirm their email
 * @param {boolean} [opts.isResend] - true if this is a resend (adjusts copy)
 * @param {string} [opts.linkExpiresIn] - human-readable link lifetime
 */
async function sendVerificationEmail({
  toEmail,
  verifyLink,
  isResend = false,
  linkExpiresIn = isResend ? '1 hour' : '24 hours',
}) {
  const subject = isResend
    ? 'Your Pantopus verification link'
    : 'Confirm your email for Pantopus';
  const safeLink = escapeHtml(verifyLink);
  const safeLinkExpiresIn = escapeHtml(linkExpiresIn);
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@pantopus.com';

  const heading = isResend ? 'Here\'s your verification link' : 'Confirm your email';
  const intro = isResend
    ? 'You asked for a new verification link for your Pantopus account. Tap the button below to confirm your email address.'
    : 'Welcome to Pantopus! Tap the button below to confirm your email address and finish setting up your account.';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f6f7f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827; -webkit-font-smoothing:antialiased;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f6f7f9;">
    ${isResend ? 'Tap the button to confirm your email and finish setting up your Pantopus account.' : 'Welcome to Pantopus — confirm your email to finish setting up your account.'}
  </div>
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
              <h1 style="font-size:22px; font-weight:600; margin:0 0 16px; color:#111827;">${escapeHtml(heading)}</h1>
              <p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 22px;">
                ${escapeHtml(intro)}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:10px; background-color:#0284c7;">
                    <a href="${safeLink}" style="display:inline-block; padding:13px 28px; color:#ffffff; text-decoration:none; font-weight:600; font-size:15px; border-radius:10px;">
                      Confirm email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.6; color:#6b7280; margin:0 0 8px;">
                Or copy and paste this link into your browser:
              </p>
              <p style="font-size:13px; line-height:1.5; word-break:break-all; margin:0 0 24px;">
                <a href="${safeLink}" style="color:#0284c7; text-decoration:underline;">${safeLink}</a>
              </p>
              <div style="border-top:1px solid #e5e7eb; padding-top:20px;">
                <p style="font-size:13px; line-height:1.6; color:#6b7280; margin:0;">
                  This link expires in <strong>${safeLinkExpiresIn}</strong>. If you didn't create a Pantopus account, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px;">
              <p style="font-size:12px; line-height:1.6; color:#9ca3af; margin:0 0 8px;">
                You're receiving this email because ${isResend ? 'a new verification link was requested' : 'a Pantopus account was created'} for this address.
              </p>
              <p style="font-size:12px; line-height:1.6; color:#9ca3af; margin:0;">
                Questions? Reply to this email or write to
                <a href="mailto:${escapeHtml(supportEmail)}" style="color:#6b7280; text-decoration:underline;">${escapeHtml(supportEmail)}</a>.<br>
                Pantopus — Your household, organized.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${heading}

${intro}

${verifyLink}

This link expires in ${linkExpiresIn}. If you didn't create a Pantopus account, you can safely ignore this email.

Questions? Reply to this email or write to ${supportEmail}.

Pantopus — Your household, organized.
`;

  return sendEmail({ to: toEmail, subject, html, text });
}

// ============================================================
//  MONTHLY RECEIPT EMAIL
// ============================================================

/**
 * Send a monthly receipt email.
 * @param {string} toEmail - recipient email
 * @param {Object} receipt - computed receipt from monthlyReceiptService
 */
async function sendMonthlyReceipt(toEmail, receipt) {
  const { period, earnings, spending, marketplace, community, reputation, highlight } = receipt;
  const earningsDollars = (earnings.total_cents / 100).toFixed(2);
  const spendingDollars = (spending.total_cents / 100).toFixed(2);
  const shareUrl = `${APP_URL}/profile?tab=receipt&year=${period.year}&month=${period.month}`;
  const unsubUrl = `${APP_URL}/settings/notifications`;

  const subject = `Your ${period.label} Pantopus Summary`;

  const section = (icon, title, lines) => {
    const lineHtml = lines
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([label, value]) => `
        <tr>
          <td style="color:#6b7280; font-size:14px; padding:4px 0;">${escapeHtml(label)}</td>
          <td style="color:#111827; font-size:14px; font-weight:600; padding:4px 0; text-align:right;">${escapeHtml(String(value))}</td>
        </tr>`)
      .join('');
    return `
      <div style="margin:0 0 20px;">
        <div style="font-size:14px; font-weight:600; color:#111827; margin-bottom:8px;">${icon} ${escapeHtml(title)}</div>
        <table style="width:100%; border-collapse:collapse;">${lineHtml}</table>
      </div>`;
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background:#111827; padding:32px 32px 24px; text-align:center;">
      <div style="font-size:32px; margin-bottom:8px;">📊</div>
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">Your ${escapeHtml(period.label)} Summary</h1>
    </div>

    <!-- Highlight -->
    <div style="background:#eff6ff; padding:20px 32px; text-align:center;">
      <p style="color:#1d4ed8; font-size:16px; font-weight:600; margin:0;">${escapeHtml(highlight)}</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      ${section('💰', 'Earnings', [
        ['Gigs completed', earnings.gig_count],
        ['Total earned', `$${earningsDollars}`],
        ['Top category', earnings.top_category || 'N/A'],
      ])}

      ${section('🛒', 'Spending', [
        ['Gigs posted (completed)', spending.gig_count],
        ['Total spent', `$${spendingDollars}`],
      ])}

      ${section('🏪', 'Marketplace', [
        ['Listings sold', marketplace.listings_sold],
        ['Listings bought', marketplace.listings_bought],
        ['Free items claimed', marketplace.free_items_claimed],
      ])}

      ${section('🤝', 'Community', [
        ['Posts created', community.posts_created],
        ['Connections made', community.connections_made],
        ['Neighbors helped', community.neighbors_helped],
      ])}

      ${section('⭐', 'Reputation', [
        ['Current rating', reputation.current_rating ? reputation.current_rating.toFixed(1) : 'N/A'],
        ['Reviews received', reputation.reviews_received],
        ['Rating change', reputation.rating_change !== null ? (reputation.rating_change >= 0 ? '+' : '') + reputation.rating_change.toFixed(2) : 'N/A'],
      ])}

      <!-- Share CTA -->
      <div style="text-align:center; margin:28px 0 0;">
        <a href="${shareUrl}" style="display:inline-block; background:#111827; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none;">
          Share your Pantopus month
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">
        Pantopus — Your neighborhood, connected.
      </p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        <a href="${unsubUrl}" style="color:#9ca3af; text-decoration:underline;">Unsubscribe from monthly receipts</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Your ${period.label} Pantopus Summary
${highlight}

EARNINGS
  Gigs completed: ${earnings.gig_count}
  Total earned: $${earningsDollars}
  Top category: ${earnings.top_category || 'N/A'}

SPENDING
  Gigs posted (completed): ${spending.gig_count}
  Total spent: $${spendingDollars}

MARKETPLACE
  Listings sold: ${marketplace.listings_sold}
  Listings bought: ${marketplace.listings_bought}
  Free items claimed: ${marketplace.free_items_claimed}

COMMUNITY
  Posts created: ${community.posts_created}
  Connections made: ${community.connections_made}
  Neighbors helped: ${community.neighbors_helped}

REPUTATION
  Current rating: ${reputation.current_rating ? reputation.current_rating.toFixed(1) : 'N/A'}
  Reviews received: ${reputation.reviews_received}
  Rating change: ${reputation.rating_change !== null ? (reputation.rating_change >= 0 ? '+' : '') + reputation.rating_change.toFixed(2) : 'N/A'}

Share your month: ${shareUrl}
Unsubscribe: ${unsubUrl}
`;

  return sendEmail({ to: toEmail, subject, html, text });
}

// ============================================================
//  GUEST RESERVATION CONFIRMATION EMAIL
// ============================================================

/**
 * Send a confirmation email to a guest who signed up for a support train slot.
 * @param {Object} opts
 * @param {string} opts.toEmail
 * @param {string} opts.guestName
 * @param {string} opts.trainTitle
 * @param {string} opts.slotLabel
 * @param {string} opts.slotDate
 * @param {string|null} opts.slotTime
 * @param {string} opts.contributionMode - cook | takeout | groceries
 * @param {string} opts.supportTrainId
 */
async function sendGuestReservationConfirmationEmail({
  toEmail,
  guestName,
  trainTitle,
  slotLabel,
  slotDate,
  slotTime,
  contributionMode,
  supportTrainId,
}) {
  const modeLabels = { cook: 'Home-cooked meal', takeout: 'Takeout', groceries: 'Groceries' };
  const modeLabel = modeLabels[contributionMode] || contributionMode;
  const appUrl = `${APP_URL}/support-trains/${supportTrainId}`;

  const subject = `You're signed up to help: ${trainTitle}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="background:#111827; padding:32px 32px 24px; text-align:center;">
      <div style="font-size:32px; margin-bottom:8px;">🚂</div>
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">You're Signed Up!</h1>
    </div>

    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
        Hi <strong>${escapeHtml(guestName)}</strong>, thank you for signing up to help with <strong>${escapeHtml(trainTitle)}</strong>.
      </p>

      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:0 0 20px;">
        <div style="font-size:15px; font-weight:600; color:#111827;">📅 ${escapeHtml(slotLabel)} · ${escapeHtml(slotDate)}</div>
        ${slotTime ? `<div style="font-size:13px; color:#6b7280; margin-top:4px;">⏰ ${escapeHtml(slotTime)}</div>` : ''}
        <div style="font-size:13px; color:#6b7280; margin-top:4px;">🍽 ${escapeHtml(modeLabel)}</div>
      </div>

      <p style="color:#374151; font-size:14px; line-height:1.6; margin:0 0 16px;">
        The organizer will share exact delivery details with you closer to the date. Keep an eye on your inbox for updates.
      </p>

      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:16px; margin:0 0 20px;">
        <div style="font-size:13px; font-weight:600; color:#1e40af; margin-bottom:6px;">Want a better experience?</div>
        <p style="color:#374151; font-size:13px; line-height:1.5; margin:0;">
          Download the Pantopus app for one-tap signups, real-time updates, delivery coordination, and direct chat with the organizer.
        </p>
      </div>

      <div style="text-align:center; margin:28px 0;">
        <a href="${appUrl}" style="display:inline-block; background:#111827; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none;">
          View Support Train
        </a>
      </div>
    </div>

    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">Pantopus — Your household, organized.</p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        If you didn't sign up for this, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
You're signed up to help: ${trainTitle}

Hi ${guestName}, thank you for signing up!

${slotLabel} · ${slotDate}${slotTime ? `\nTime: ${slotTime}` : ''}
Type: ${modeLabel}

The organizer will share exact delivery details with you closer to the date.

Want a better experience? Download the Pantopus app for one-tap signups, real-time updates, and direct chat with the organizer.

View Support Train: ${appUrl}
`;

  return sendEmail({ to: toEmail, subject, html, text });
}

// ============================================================
//  GUEST RESERVATION ADDRESS EMAIL
// ============================================================

/**
 * Send exact delivery details to an email-only support train guest.
 * @param {Object} opts
 * @param {string} opts.toEmail
 * @param {string} opts.guestName
 * @param {string} opts.trainTitle
 * @param {string} opts.slotLabel
 * @param {string} opts.slotDate
 * @param {string|null} opts.slotTime
 * @param {string} opts.addressLabel
 * @param {string|null} [opts.deliveryInstructions]
 * @param {string|null} [opts.specialInstructions]
 * @param {string} opts.supportTrainId
 */
async function sendGuestReservationAddressEmail({
  toEmail,
  guestName,
  trainTitle,
  slotLabel,
  slotDate,
  slotTime,
  addressLabel,
  deliveryInstructions,
  specialInstructions,
  supportTrainId,
}) {
  const appUrl = `${APP_URL}/support-trains/${supportTrainId}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLabel)}`;
  const subject = `Delivery location for ${trainTitle}`;
  const instructions = [
    deliveryInstructions ? `Delivery instructions: ${deliveryInstructions}` : null,
    specialInstructions ? `Special instructions: ${specialInstructions}` : null,
  ].filter(Boolean);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="background:#111827; padding:32px 32px 24px; text-align:center;">
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">Delivery Location</h1>
    </div>

    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
        Hi <strong>${escapeHtml(guestName)}</strong>, the organizer has shared the exact delivery location for <strong>${escapeHtml(trainTitle)}</strong>.
      </p>

      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:0 0 20px;">
        <div style="font-size:15px; font-weight:600; color:#111827;">${escapeHtml(slotLabel)} · ${escapeHtml(slotDate)}</div>
        ${slotTime ? `<div style="font-size:13px; color:#6b7280; margin-top:4px;">${escapeHtml(slotTime)}</div>` : ''}
      </div>

      <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:12px; padding:16px; margin:0 0 20px;">
        <div style="font-size:12px; text-transform:uppercase; color:#047857; font-weight:700; letter-spacing:0.08em; margin-bottom:8px;">Exact address</div>
        <p style="white-space:pre-line; color:#111827; font-size:15px; line-height:1.6; margin:0;">${escapeHtml(addressLabel)}</p>
      </div>

      ${
        instructions.length
          ? `<div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:16px; margin:0 0 20px;">
              ${instructions
                .map(
                  (line) =>
                    `<p style="color:#374151; font-size:14px; line-height:1.6; margin:0 0 8px;">${escapeHtml(line)}</p>`
                )
                .join('')}
            </div>`
          : ''
      }

      <div style="text-align:center; margin:28px 0 10px;">
        <a href="${mapsUrl}" style="display:inline-block; background:#111827; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none;">
          Open In Maps
        </a>
      </div>

      <p style="color:#6b7280; font-size:13px; line-height:1.5; margin:18px 0 0; text-align:center;">
        You can also view the Support Train at <a href="${appUrl}" style="color:#4f46e5;">Pantopus</a>.
      </p>
    </div>

    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">Pantopus — Your household, organized.</p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        If you did not sign up for this Support Train, contact the organizer before delivering anything.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
Delivery location for ${trainTitle}

Hi ${guestName}, the organizer has shared the exact delivery location.

${slotLabel} · ${slotDate}${slotTime ? `\nTime: ${slotTime}` : ''}

Exact address:
${addressLabel}

${instructions.join('\n')}

Open in maps: ${mapsUrl}
View Support Train: ${appUrl}
`;

  return sendEmail({ to: toEmail, subject, html, text });
}

// ============================================================
//  P0.2 — DISPLAY-NAME MIGRATION NOTICE
// ============================================================

/**
 * Build the {subject, html, text} payload for the P0.2 display-name migration
 * email. Exposed separately so tests can verify the rendered copy without
 * needing to intercept the SMTP transport.
 *
 * @param {Object} opts
 * @param {string} opts.username             the new public display name
 * @param {string} opts.previousDisplayName  the value being replaced
 */
function buildDisplayNameMigrationEmailContent({ username, previousDisplayName }) {
  const subject = "We've updated how your name is displayed on Pantopus";
  const settingsUrl = `${APP_URL}/settings/profile`;
  const safeUsername = escapeHtml(username);
  const safePrevious = escapeHtml(previousDisplayName);
  const safeSettingsUrl = escapeHtml(settingsUrl);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f6f7f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827;">
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
              <h1 style="font-size:22px; font-weight:600; margin:0 0 16px; color:#111827;">We've updated how your name is displayed on Pantopus</h1>
              <p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 16px;">
                Hi ${safeUsername},
              </p>
              <p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 16px;">
                To better protect your privacy, we've updated your public display name on Pantopus from
                "<strong>${safePrevious}</strong>" to "<strong>${safeUsername}</strong>". Other users now see
                "<strong>${safeUsername}</strong>" by default.
              </p>
              <p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 22px;">
                You can change your display name anytime in
                <a href="${safeSettingsUrl}" style="color:#0284c7; text-decoration:underline;">Settings → Profile</a>.
              </p>
              <p style="font-size:14px; line-height:1.6; color:#6b7280; margin:0;">
                — The Pantopus team
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `We've updated how your name is displayed on Pantopus

Hi ${username},

To better protect your privacy, we've updated your public display name on Pantopus from "${previousDisplayName}" to "${username}". Other users now see "${username}" by default.

You can change your display name anytime in Settings → Profile (${settingsUrl}).

— The Pantopus team
`;

  return { subject, html, text };
}

/**
 * Notify a user that their public display name was changed from their legal
 * name to their username as part of the Phase 0 / P0.2 privacy fix
 * (Audience Profile design v2 §16 item 1).
 *
 * Important: only the *username* and the *previous public display name* are
 * sent; the legal name is held only in the IdentityAuditLog metadata and is
 * deliberately never echoed back to the user via email.
 *
 * @param {Object} opts
 * @param {string} opts.toEmail              recipient email address
 * @param {string} opts.username             the new public display name
 * @param {string} opts.previousDisplayName  the value being replaced
 */
async function sendDisplayNameMigrationEmail({ toEmail, username, previousDisplayName }) {
  const { subject, html, text } = buildDisplayNameMigrationEmailContent({
    username,
    previousDisplayName,
  });
  return sendEmail({ to: toEmail, subject, html, text });
}

// ============================================================
//  AUDIENCE-ZONE EMAILS (P2.10 / audience-profile §6.3)
// ============================================================
// All three functions below are AUDIENCE-CONTEXT — recipient is the
// fan, identifiers in the body are persona display name + handle +
// fan handle, and the creator's User row (real name, email, address,
// any personal-side identifier) is intentionally NEVER referenced.
// See docs/email-firewall-audit-2026-05-08.md for the firewall rules
// these templates obey.

/**
 * Sent on `customer.subscription.created` (first time only) for a
 * paid persona tier. Recipient is the fan's User.email.
 *
 *   { toEmail, fanHandle, personaDisplayName, personaHandle,
 *     tierName, periodEndDate }
 */
async function sendPersonaSubscriptionWelcomeEmail({
  toEmail,
  fanHandle,
  personaDisplayName,
  personaHandle,
  tierName,
  periodEndDate,
}) {
  const subject = `Welcome to ${personaDisplayName}'s ${tierName} tier`;
  const handleSafe = escapeHtml(fanHandle || '');
  const personaSafe = escapeHtml(personaDisplayName || personaHandle || 'this creator');
  const tierSafe = escapeHtml(tierName || 'paid');
  const periodSafe = escapeHtml(periodEndDate || '');
  const personaUrl = personaHandle
    ? `${APP_URL}/@${encodeURIComponent(personaHandle)}`
    : `${APP_URL}/app/audience`;
  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;padding:24px;">
    <h1 style="font-size:18px;color:#0f766e;margin:0 0 12px;">You're in 🎉</h1>
    <p style="color:#111827;font-size:14px;line-height:1.6;margin:0 0 12px;">
      Hi @${handleSafe},
    </p>
    <p style="color:#111827;font-size:14px;line-height:1.6;margin:0 0 12px;">
      You're now a <strong>${tierSafe}</strong> of <strong>${personaSafe}</strong> on Pantopus.
    </p>
    ${periodSafe ? `<p style="color:#374151;font-size:13px;line-height:1.6;margin:0 0 12px;">Your access continues until ${periodSafe} and renews automatically.</p>` : ''}
    <p style="margin:18px 0 0;">
      <a href="${personaUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Open Beacon</a>
      &nbsp;
      <a href="${APP_URL}/app/audience" style="color:#0f766e;font-size:13px;text-decoration:underline;">Manage memberships</a>
    </p>
  </div>
</body></html>`;
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Sent on `customer.subscription.deleted` — both period-end cancels
 * and hard cancels. The body never names the underlying creator.
 *
 *   { toEmail, fanHandle, personaDisplayName, periodEndDate }
 */
async function sendPersonaSubscriptionCanceledEmail({
  toEmail,
  fanHandle,
  personaDisplayName,
  periodEndDate,
}) {
  const personaSafe = escapeHtml(personaDisplayName || 'a Pantopus creator');
  const handleSafe = escapeHtml(fanHandle || '');
  const periodSafe = escapeHtml(periodEndDate || '');
  const subject = `Your ${personaDisplayName || 'Beacon'} subscription was canceled`;
  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;padding:24px;">
    <h1 style="font-size:18px;color:#111827;margin:0 0 12px;">Subscription canceled</h1>
    <p style="color:#111827;font-size:14px;line-height:1.6;margin:0 0 12px;">
      Hi @${handleSafe},
    </p>
    <p style="color:#111827;font-size:14px;line-height:1.6;margin:0 0 12px;">
      Your <strong>${personaSafe}</strong> subscription was canceled.
      ${periodSafe ? `You'll keep your access until <strong>${periodSafe}</strong>; nothing changes until then.` : ''}
    </p>
    <p style="margin:18px 0 0;">
      <a href="${APP_URL}/app/audience" style="color:#0f766e;font-size:13px;text-decoration:underline;">Your memberships</a>
    </p>
  </div>
</body></html>`;
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Sent on `invoice.payment_failed`. The body notes the issue and links
 * to the membership-management surface where the fan can update their
 * payment method. The creator is NEVER notified about a fan's failed
 * payment — that would expose payment-method status across the firewall.
 *
 *   { toEmail, fanHandle, personaDisplayName }
 */
async function sendPersonaPaymentFailedEmail({
  toEmail,
  fanHandle,
  personaDisplayName,
}) {
  const personaSafe = escapeHtml(personaDisplayName || 'a Pantopus creator');
  const handleSafe = escapeHtml(fanHandle || '');
  const subject = `Payment issue with your ${personaDisplayName || 'Beacon'} subscription`;
  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:16px;padding:24px;">
    <h1 style="font-size:18px;color:#b91c1c;margin:0 0 12px;">Payment didn't go through</h1>
    <p style="color:#111827;font-size:14px;line-height:1.6;margin:0 0 12px;">
      Hi @${handleSafe},
    </p>
    <p style="color:#111827;font-size:14px;line-height:1.6;margin:0 0 12px;">
      We couldn't process the latest payment for your <strong>${personaSafe}</strong> subscription.
      Stripe will retry automatically over the next few days.
    </p>
    <p style="color:#374151;font-size:13px;line-height:1.6;margin:0 0 12px;">
      If you'd like to update your payment method now, open your memberships:
    </p>
    <p style="margin:18px 0 0;">
      <a href="${APP_URL}/app/audience" style="display:inline-block;background:#0d9488;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Update payment method</a>
    </p>
  </div>
</body></html>`;
  return sendEmail({ to: toEmail, subject, html });
}

// ============================================================
//  HELPERS
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = {
  sendEmail,
  sendHomeInviteEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendMonthlyReceipt,
  sendGuestReservationConfirmationEmail,
  sendGuestReservationAddressEmail,
  sendDisplayNameMigrationEmail,
  buildDisplayNameMigrationEmailContent,
  // P2.10 / audience-profile §6.3 — audience-zone subscription emails.
  sendPersonaSubscriptionWelcomeEmail,
  sendPersonaSubscriptionCanceledEmail,
  sendPersonaPaymentFailedEmail,
};
