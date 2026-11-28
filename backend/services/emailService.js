/**
 * Email Service
 * 
 * Uses nodemailer for sending emails.
 * Uses configured SMTP transport. Local preview requires EMAIL_DELIVERY_MODE=log;
 * staging and production never substitute preview output for delivery.
 * 
 * Required env vars for production:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional:
 *   SMTP_FROM (defaults to "Pantopus <hello@pantopus.com>")
 *   APP_URL (defaults to "http://localhost:3000")
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { isLaunchFeatureEnabled, areLaunchFeaturesEnabled } = require('../utils/featureFlags');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const SMTP_FROM = process.env.SMTP_FROM || 'Pantopus <hello@pantopus.com>';

let transporter = null;
const localEnvironment = ['development', 'test'].includes(process.env.NODE_ENV)
  && !['staging', 'production'].includes(process.env.APP_ENV);
const previewMode = localEnvironment && process.env.EMAIL_DELIVERY_MODE === 'log';

// Initialize transport
const requiredSmtpVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missingSmtpVars = requiredSmtpVars.filter((key) => !process.env[key]);

if (missingSmtpVars.length === 0) {
  try {
    transporter = nodemailer.createTransport({
      pool: true,
      maxConnections: 5,
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    logger.info('Email service initialized with SMTP transport');
  } catch (err) {
    logger.error('Failed to initialize SMTP transport', { errorCode: err.code });
  }
} else {
  logger.warn('Email delivery is unavailable without SMTP transport.', {
    missing: missingSmtpVars,
  });
}

// Run before account lookup so an unavailable mail server produces the same
// response for known and unknown addresses. Verification does not send email.
async function checkDeliveryAvailability() {
  if (previewMode) return { available: true, preview: true };
  if (!transporter) return { available: false, code: 'EMAIL_UNAVAILABLE' };
  try {
    await transporter.verify();
    return { available: true };
  } catch (err) {
    logger.error('SMTP readiness check failed', { errorCode: err.code });
    return { available: false, code: 'EMAIL_UNAVAILABLE' };
  }
}

/**
 * Send an email. Explicit local preview logs metadata only, never auth links.
 * @param {Object} opts - { to, subject, html, text, attachments?, headers? }
 *   attachments: optional nodemailer attachment array (e.g. an .ics calendar invite).
 *   headers: optional extra headers (e.g. List-Unsubscribe).
 * @returns {Promise<{ success: boolean, messageId?: string }>}
 */
async function sendEmail({ to, subject, html, text, attachments, headers }) {
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
  if (headers && Object.keys(headers).length) {
    mailOptions.headers = headers;
  }

  if (previewMode) {
    logger.info('Local email preview (not delivered)', {
      status: 'preview',
    });
    return { success: true, preview: true, messageId: `dev-${Date.now()}` };
  }

  if (!transporter) return { success: false, error: 'EMAIL_UNAVAILABLE' };

  try {
    const info = await transporter.sendMail(mailOptions);
    if (Array.isArray(info.accepted) && info.accepted.length === 0) {
      return { success: false, error: 'EMAIL_REJECTED' };
    }
    logger.info('Email sent', {
      status: 'accepted',
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error('Failed to send email', { errorCode: 'EMAIL_SEND_FAILED' });
    return { success: false, error: 'EMAIL_SEND_FAILED' };
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
//  LETTER WAITING EMAIL
// ============================================================

/**
 * Tell someone who isn't on Pantopus that a letter is waiting for them (POST /api/mailbox/send to an email address).
 * The email names only who the letter is from (a letter sent as a business names the business); the letter itself
 * stays on Pantopus behind the link, which opens the web app's /open page.
 * @param {Object} opts
 * @param {string} opts.toEmail - the address the sender typed
 * @param {string} opts.senderName - who the letter is from, as the recipient sees it
 * @param {string} opts.claimLink - the letter's link
 * @param {string} opts.expiresAt - when the letter stops waiting (ISO)
 */
async function sendLetterWaitingEmail({ toEmail, senderName, claimLink, expiresAt }) {
  const subject = `${senderName} sent you a letter on Pantopus`;
  const until = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const safeLink = escapeHtml(claimLink);

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
      <div style="font-size:32px; margin-bottom:8px;">✉️</div>
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">You have a letter</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
        <strong>${escapeHtml(senderName)}</strong> sent you a letter on Pantopus.
      </p>
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0;">
        Open it to read it and keep it in your own Pantopus mailbox. A Pantopus account is free.
      </p>

      <!-- CTA -->
      <div style="text-align:center; margin:28px 0;">
        <a href="${safeLink}" style="display:inline-block; background:#111827; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none;">
          Open your letter
        </a>
      </div>

      <p style="color:#9ca3af; font-size:12px; text-align:center; margin:20px 0 0;">
        The letter waits for you until ${escapeHtml(until)}. Sign in or create your account with this email address.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">
        Pantopus — Your household, organized.
      </p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        If you don't know the sender, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
${senderName} sent you a letter on Pantopus.

Open it to read it and keep it in your own Pantopus mailbox: ${claimLink}

The letter waits for you until ${until}. Sign in or create your free account with this email address.
If you don't know the sender, you can safely ignore this email.
`;

  return sendEmail({ to: toEmail, subject, html, text });
}

/**
 * The words of a Christmas card's email (sendCardWaitingEmail), its first email or its one reminder. The sender sees
 * the same words and picture before sending it (POST /api/mailbox/cards/preview), so the look and the email can't drift
 * apart. The first line starts with the sender's name.
 *
 * Its picture (launch key card_table) is the card's front, the stock picture the sender picked, lying on its open
 * envelope (founder, November 16): something to want before they join. A card sealed until Christmas shows only its
 * sealed envelope. Never the note, the signature, the sender's own photo or voice greeting.
 * @param {Object} opts
 * @param {string} opts.senderName - who the card is from, as the recipient sees it
 * @param {string} opts.expiresAt - when the card stops waiting (ISO)
 * @param {boolean} opts.sealed - sealed until Christmas morning (its picture stays the sealed envelope)
 * @param {boolean} [opts.stillSealed] - false once Christmas morning has passed where the sender lives: the words no
 *   longer say it's sealed, since it opens as soon as they join
 * @param {string} [opts.design] - the picture the sender picked (holidayCards DESIGNS id)
 * @param {boolean} [opts.reminder] - the one reminder, a few days after the first email (services/cardEmail); it says
 *   it is the only one
 * @param {string} [opts.timeZone] - the sender's clock: its day is the one the card's page shows a reader near them
 * @returns {{ picture?: string, pictureAlt?: string, subject: string, heading: string, lines: string[], button: string,
 *   footnote: string, footer: string[] }}
 */
function cardWaitingEmailContent({
  senderName, expiresAt, sealed, stillSealed = true, design = null, reminder = false, unsealedReminder: unsealedAsked = false, timeZone = 'UTC',
}) {
  const until = new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone });
  const web = (process.env.PUBLIC_WEB_URL || APP_URL).trim().replace(/\/+$/, '');
  const tableOn = areLaunchFeaturesEnabled(['mailbox', 'holiday_cards', 'card_table']);
  // The card round (featureFlags cardImprovementsOn): opening before signing up (guestOpen is false while it is off),
  // a sealed card's own front once its seal has lifted, and the Christmas-morning reminder's words. Off, every word
  // and the picture are as before it.
  const { cardImprovementsOn, cardGuestOpenEnabled } = require('../utils/featureFlags');
  const improved = cardImprovementsOn();
  const guestOpen = tableOn && cardGuestOpenEnabled();
  const unsealedReminder = improved && unsealedAsked;
  // Required here, not at the top: holidayCards reads the database client, which this service never needs otherwise.
  const shown = tableOn
    ? require('./holidayCards').emailPicture({ design, sealed: improved ? sealed && stillSealed : sealed }) : null;
  // The card's own front is in the picture: "this" card.
  const front = Boolean(shown?.caption);
  // What to call it: a thank-you card says so (its design is one of the thank-you pictures; services/holidayCards).
  const noun = /^thank-you-\d{2}$/.test(String(design || '')) ? 'thank-you card' : 'Christmas card';
  const card = front ? `this ${noun}` : `a ${noun}`;
  const first = unsealedReminder
    ? `${senderName}’s ${noun} is ready to open!`
    : reminder
      ? `${senderName}’s ${noun} is still waiting for you on Pantopus.`
      : `${senderName} sent you ${card} on Pantopus.`;
  const subject = unsealedReminder
    ? `${senderName}’s ${noun} is ready to open`
    : reminder
      ? `${senderName}’s ${noun} is still waiting for you`
      : `${senderName} sent you a ${noun} on Pantopus`;
  const heading = unsealedReminder
    ? `Your ${noun} is ready to open`
    : reminder
      ? `Your ${noun} is still waiting`
      : `You have a ${noun}`;
  const lines = sealed && stillSealed
    ? [`${first} It’s sealed until Christmas morning.`,
      guestOpen
        ? 'We’ll email you on Christmas morning when the seal lifts — or join Pantopus free now to keep it waiting in your mailbox.'
        : 'Join Pantopus with this email address to open it and keep it in your own Pantopus mailbox. A Pantopus account is free.']
    : guestOpen
      ? [unsealedReminder
          ? `${senderName}’s ${noun} is ready to open, with a note on the back just for you.`
          : `${first.slice(0, -1)}, with a note on the back just for you.`,
        `Open it right in your browser — no account or app needed. Join Pantopus free anytime to keep it in your mailbox or write back.`]
      : sealed
        ? [first, 'Join Pantopus with this email address to open it and keep it in your own Pantopus mailbox. A Pantopus account is free.']
        : [`${first.slice(0, -1)}, with a note on the back just for you.`,
          `Join Pantopus with this email address to ${front ? 'turn it over' : 'open it'}, read their note and keep the card in your own Pantopus mailbox. A Pantopus account is free.`];
  const footnote = guestOpen
    ? `The card waits for you until ${until}. Join with this email address anytime to save it to your mailbox.${
      reminder ? ' This is the only reminder we’ll send.' : ''}`
    : `The card waits for you until ${until}. Sign in or create your account with this email address.${
      reminder ? ' This is the only reminder we’ll send.' : ''}`;
  return {
    ...(shown ? { picture: `${web}${shown.path}`, pictureAlt: shown.alt } : {}),
    subject,
    heading,
    lines,
    button: sealed && stillSealed && guestOpen ? 'Peek at your card' : 'Open your card',
    footnote,
    footer: ['Pantopus — Your household, organized.', 'If you don’t know the sender, you can safely ignore this email.'],
  };
}

/**
 * A Christmas card for someone who isn't on Pantopus yet (POST /api/mailbox/cards), or its one reminder
 * (jobs/cardEmailSend): who it's from and, while it isn't sealed, the picture on its front (cardWaitingEmailContent).
 * Never its note, signature, photo or voice, which they see in their own mailbox once they join.
 * @param {Object} opts
 * @param {string} opts.toEmail - the address the sender typed
 * @param {string} opts.senderName - who the card is from, as the recipient sees it
 * @param {string} opts.claimLink - the card's link
 * @param {string} opts.expiresAt - when the card stops waiting (ISO)
 * @param {boolean} opts.sealed - sealed until Christmas morning
 * @param {boolean} [opts.stillSealed] - false once Christmas morning has passed (cardWaitingEmailContent)
 * @param {string} [opts.design] - the picture the sender picked
 * @param {boolean} [opts.reminder] - the one reminder
 * @param {boolean} [opts.unsealedReminder] - true for the Christmas-morning reminder when a sealed card's seal lifts
 * @param {string} [opts.timeZone] - the sender's clock (cardWaitingEmailContent)
 */
async function sendCardWaitingEmail({
  toEmail, senderName, claimLink, expiresAt, sealed, stillSealed, design, reminder, unsealedReminder, timeZone,
}) {
  const words = cardWaitingEmailContent({ senderName, expiresAt, sealed, stillSealed, design, reminder, unsealedReminder, timeZone });
  const safeLink = escapeHtml(claimLink);
  const nameFirst = `<strong>${escapeHtml(senderName)}</strong>${escapeHtml(words.lines[0].slice(senderName.length))}`;

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
    <div style="background:#8b1d1d; padding:${words.picture ? '0 0 24px' : '32px 32px 24px'}; text-align:center;">
      ${words.picture
    ? `<img src="${escapeHtml(words.picture)}" alt="${escapeHtml(words.pictureAlt)}" width="480" style="display:block; width:100%; height:auto; margin:0 0 20px;">`
    : '<div style="font-size:32px; margin-bottom:8px;">✉️</div>'}
      <h1 style="color:#fff7ed; font-size:20px; font-weight:600; margin:0;">${escapeHtml(words.heading)}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
        ${nameFirst}
      </p>
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0;">
        ${escapeHtml(words.lines[1])}
      </p>

      <!-- CTA -->
      <div style="text-align:center; margin:28px 0;">
        <a href="${safeLink}" style="display:inline-block; background:#8b1d1d; color:#fff7ed; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none;">
          ${escapeHtml(words.button)}
        </a>
      </div>

      <p style="color:#9ca3af; font-size:12px; text-align:center; margin:20px 0 0;">
        ${escapeHtml(words.footnote)}
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">
        ${escapeHtml(words.footer[0])}
      </p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        ${escapeHtml(words.footer[1])}
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
${words.lines[0]}

${words.lines[1]}
${words.button}: ${claimLink}

${words.footnote}
${words.footer[1]}
`;

  return sendEmail({ to: toEmail, subject: words.subject, html, text });
}

// ============================================================
//  PLANS INVITATION EMAIL
// ============================================================

/**
 * The words of a Plans invitation email (services/plans/planInvites.js). The plan's card only: what, when and the
 * area, never an address. A playdate keeps its title in the app and its time a part of the day, as everywhere else.
 * While the host picks a date (`picking`) it names none: "Sam invited you to a dinner. Tick the times that work for
 * you." as the subject and the lead, and `when` reads "Picking a date".
 * @param {Object} words - { hostFirst, noun, icon, title, when, where, playdate, picking, ask }
 * @param {string} toEmail - the invited address, so the person signs up with it
 */
function planInviteEmailContent(words, toEmail) {
  const invitedTo = words.noun === 'coffee' ? 'invited you for coffee' : `invited you to a ${words.noun}`;
  return {
    subject: words.picking ? `${words.hostFirst} ${invitedTo}. ${words.ask}`
      : `${words.hostFirst} ${invitedTo}${words.playdate || !words.when ? '' : ` on ${words.when}`}`,
    heading: 'You’re invited',
    lead: words.picking ? ` ${invitedTo}. ${words.ask}` : ` ${invitedTo}.`,
    facts: [
      words.title || (words.playdate ? 'A playdate' : null),
      words.when ? words.when[0].toUpperCase() + words.when.slice(1) : null,
      words.where,
    ].filter(Boolean),
    button: words.playdate ? 'See the playdate' : 'See the plan',
    footnote: words.playdate
      ? `Pantopus is free. Sign up or sign in with this address, ${toEmail}, and the playdate opens for you.`
      : `Pantopus is free. Sign up or sign in with this address, ${toEmail}, and the plan opens for you.`,
    footer: `You got this because ${words.hostFirst} invited you to a plan on Pantopus.`,
  };
}

/**
 * Send a Plans invitation. One per invitation, never a reminder; the unsubscribe link (and the mail app's one-click
 * unsubscribe header) stops every later invitation email to the address.
 * @param {Object} opts - { toEmail, words, link, unsubscribeLink, oneClickUnsubscribeLink }
 */
async function sendPlanInviteEmail({ toEmail, words, link, unsubscribeLink, oneClickUnsubscribeLink }) {
  const content = planInviteEmailContent(words, toEmail);
  const safeLink = escapeHtml(link);
  const [title, ...otherFacts] = content.facts;

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
      <div style="font-size:32px; margin-bottom:8px;">${escapeHtml(words.icon || '📅')}</div>
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">${escapeHtml(content.heading)}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 20px;">
        <strong>${escapeHtml(words.hostFirst)}</strong>${escapeHtml(content.lead)}
      </p>

      <!-- The plan's card -->
      <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px 18px;">
        <p style="color:#111827; font-size:16px; font-weight:600; line-height:1.4; margin:0 0 6px;">${escapeHtml(title || '')}</p>
        ${otherFacts.map((fact) => `<p style="color:#4b5563; font-size:14px; line-height:1.5; margin:0;">${escapeHtml(fact)}</p>`).join('\n        ')}
      </div>

      <!-- CTA -->
      <div style="text-align:center; margin:28px 0;">
        <a href="${safeLink}" style="display:inline-block; background:#111827; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none;">
          ${escapeHtml(content.button)}
        </a>
      </div>

      <p style="color:#9ca3af; font-size:12px; text-align:center; margin:20px 0 0;">
        ${escapeHtml(content.footnote)}
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">
        ${escapeHtml(content.footer)}
      </p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        <a href="${escapeHtml(unsubscribeLink)}" style="color:#9ca3af; text-decoration:underline;">Don’t send me invitations</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
${words.hostFirst}${content.lead}

${content.facts.join('\n')}

${content.button}: ${link}

${content.footnote}

${content.footer}
Don’t send me invitations: ${unsubscribeLink}
`;

  return sendEmail({
    to: toEmail,
    subject: content.subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubscribeLink}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

// ============================================================
//  PLANS: EMAILS TO A GUEST WITHOUT AN ACCOUNT
// ============================================================

/**
 * The words of the three emails a guest without an account gets for a plan (Plans for the holidays, H1;
 * docs/product/plans-holidays/06-screens.md, "The emails"): You're in, one reminder, and a change or cancellation;
 * and, to a guest a move to the host's home makes wait (contract 6.8), the move.
 * Never an address: the guest's own link opens the page that shows it.
 * @param {'in'|'reminder'|'changed'|'moved_home'|'cancelled'} kind
 * @param {Object} words - { hostFirst, title, icon, when, people, day, openCount, changed, newPlace, cancelNote }
 *   people: "2 adults and 1 kid"; day: 'Today' | 'Tomorrow'; changed: 'time' | 'place' | 'both'.
 */
function planGuestEmailContent(kind, words) {
  const title = words.title || 'your plan';
  const footer = `You got this because you answered ${words.hostFirst}’s invitation on Pantopus.`;
  if (kind === 'in') {
    return {
      subject: `You’re in: ${title}`,
      heading: 'You’re in',
      lines: [`${words.hostFirst} has you down for ${words.people}.`],
      facts: [title, words.when].filter(Boolean),
      button: 'Open your invitation',
      after: ['The address and the bring list are on that page. This link is yours; please don’t forward it.'],
      footer,
    };
  }
  // Find a date (Plans for the holidays, the extras): the host picked the time, or a guest's ticks are saved.
  if (kind === 'date_in') {
    return {
      subject: `${title} is ${words.when}. You’re in.`,
      heading: 'You’re in',
      lines: [`${words.hostFirst} has you down for ${words.people}.`],
      facts: [title, words.when].filter(Boolean),
      button: 'Open your invitation',
      after: ['The address and the bring list are on that page. This link is yours; please don’t forward it.'],
      footer,
    };
  }
  if (kind === 'date_ask') {
    return {
      subject: `${title} is ${words.when}. Can you make it?`,
      heading: 'Can you make it?',
      lines: [],
      facts: [title, words.when].filter(Boolean),
      button: 'Open your invitation',
      after: [],
      footer,
    };
  }
  // The gift exchange (the extras): never the name, only that it is on their invitation.
  if (kind === 'gift_drawn' || kind === 'gift_redrawn') {
    const again = kind === 'gift_redrawn';
    return {
      subject: again ? `Names were drawn again for ${title}` : `Names are drawn for ${title}`,
      heading: again ? 'Names were drawn again' : 'Names are drawn',
      lines: [`${again ? 'Names were drawn again' : 'Names are drawn'} for ${title}. Open your invitation to see who you’re giving to.`],
      facts: [title, words.when].filter(Boolean),
      button: 'Open your invitation',
      after: ['This link is yours; please don’t forward it.'],
      footer,
    };
  }
  if (kind === 'date_full') {
    return {
      subject: `${title} is ${words.when}`,
      heading: `${title} is full right now`,
      lines: [`It’s ${words.when}, a time you ticked, but it filled up with people who answered first. You’re down as Maybe, so ${words.hostFirst} sees you’d still like to come. You can change that from your invitation.`],
      facts: [title, words.when].filter(Boolean),
      button: 'Open your invitation',
      after: [],
      footer,
    };
  }
  if (kind === 'dates_saved') {
    return {
      subject: `Your times for ${title}`,
      heading: 'Your times are saved',
      lines: [`${words.hostFirst} is picking a date. You’ll hear when ${words.hostFirst} chooses one.`],
      facts: [title],
      button: 'Open your invitation',
      after: ['This link is yours; please don’t forward it.'],
      footer,
    };
  }
  if (kind === 'reminder') {
    const open = Number(words.openCount) || 0;
    return {
      subject: `${words.day === 'Today' ? 'Today' : 'Tomorrow'}: ${title}`,
      heading: words.day === 'Today' ? 'Today' : 'Tomorrow',
      lines: [],
      facts: [title, words.when].filter(Boolean),
      button: 'Open your invitation',
      after: open > 0 ? [`${open} ${open === 1 ? 'thing is' : 'things are'} still open on the bring list.`] : [],
      footer,
    };
  }
  if (kind === 'changed') {
    const what = words.changed === 'both' ? 'the time and place' : words.changed === 'place' ? 'the place' : 'the time';
    return {
      subject: `${words.hostFirst} changed ${what} of ${title}`,
      heading: `${words.hostFirst} changed ${what}`,
      lines: [],
      facts: [title, words.changed !== 'place' ? words.when : null, words.changed !== 'time' ? words.newPlace : null].filter(Boolean),
      button: 'Open your invitation',
      after: [],
      footer,
    };
  }
  if (kind === 'moved_home') {
    // The plan moved to the host's home and this guest now waits for the host's yes: no address, only that it comes.
    return {
      subject: `${words.hostFirst} changed the place of ${title}`,
      heading: `${words.hostFirst} changed the place`,
      lines: [`${title} is now at ${words.hostFirst}’s home. ${words.hostFirst} lets each guest in. When ${words.hostFirst} says yes, the address comes to this email.`],
      facts: [title, words.when].filter(Boolean),
      button: 'Open your invitation',
      after: [],
      footer,
    };
  }
  return {
    subject: `${words.hostFirst} cancelled ${title}`,
    heading: `${words.hostFirst} cancelled`,
    lines: words.cancelNote ? [words.cancelNote] : [],
    facts: [title, words.when].filter(Boolean),
    button: null,
    after: [],
    footer,
  };
}

/**
 * Send one email to a guest without an account, in the invitation email's frame with its unsubscribe link and the
 * mail app's one-click unsubscribe header. `link` is the guest's own link (null for a cancellation).
 * @param {Object} opts - { toEmail, kind, words, link, unsubscribeLink, oneClickUnsubscribeLink }
 */
async function sendPlanGuestEmail({ toEmail, kind, words, link, unsubscribeLink, oneClickUnsubscribeLink }) {
  const content = planGuestEmailContent(kind, words);
  const [title, ...otherFacts] = content.facts;
  const paragraph = (text) => `<p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 20px;">${escapeHtml(text)}</p>`;
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
      <div style="font-size:32px; margin-bottom:8px;">${escapeHtml(words.icon || '📅')}</div>
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">${escapeHtml(content.heading)}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      ${content.lines.map(paragraph).join('\n      ')}

      <!-- The plan's card -->
      <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px 18px;">
        <p style="color:#111827; font-size:16px; font-weight:600; line-height:1.4; margin:0 0 6px;">${escapeHtml(title || '')}</p>
        ${otherFacts.map((fact) => `<p style="color:#4b5563; font-size:14px; line-height:1.5; margin:0;">${escapeHtml(fact)}</p>`).join('\n        ')}
      </div>

      ${link && content.button ? `<!-- CTA -->
      <div style="text-align:center; margin:28px 0;">
        <a href="${escapeHtml(link)}" style="display:inline-block; background:#111827; color:#ffffff; font-size:15px; font-weight:600; padding:14px 32px; border-radius:10px; text-decoration:none;">
          ${escapeHtml(content.button)}
        </a>
      </div>` : '<div style="height:20px;"></div>'}

      ${content.after.map((text) => `<p style="color:#6b7280; font-size:13px; line-height:1.5; text-align:center; margin:0 0 8px;">${escapeHtml(text)}</p>`).join('\n      ')}
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">
        ${escapeHtml(content.footer)}
      </p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        <a href="${escapeHtml(unsubscribeLink)}" style="color:#9ca3af; text-decoration:underline;">Don’t send me invitations</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    ...content.lines,
    content.facts.join('\n'),
    link && content.button ? `${content.button}: ${link}` : null,
    ...content.after,
    `${content.footer}\nDon’t send me invitations: ${unsubscribeLink}`,
  ].filter(Boolean).join('\n\n');

  return sendEmail({
    to: toEmail,
    subject: content.subject,
    html,
    text: `\n${text}\n`,
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubscribeLink}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
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
  // Settings has the Email Notifications switch this email honors; /settings/notifications was a 404.
  const unsubUrl = `${APP_URL}/app/profile/settings`;

  const subject = `Your ${period.label} Pantopus Summary`;
  // Launch cut #3 (Marketplace): the Marketplace section is left out for the first launch.
  const showMarketplace = isLaunchFeatureEnabled('marketplace');

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

      ${showMarketplace ? section('🏪', 'Marketplace', [
        ['Listings sold', marketplace.listings_sold],
        ['Listings bought', marketplace.listings_bought],
        ['Free items claimed', marketplace.free_items_claimed],
      ]) : ''}

      ${section('🤝', 'Community', [
        ['Posts created', community.posts_created],
        ['Connections made', community.connections_made],
        ['People helped', community.neighbors_helped],
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
        Pantopus — Your home, connected.
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

${showMarketplace ? `MARKETPLACE
  Listings sold: ${marketplace.listings_sold}
  Listings bought: ${marketplace.listings_bought}
  Free items claimed: ${marketplace.free_items_claimed}

` : ''}COMMUNITY
  Posts created: ${community.posts_created}
  Connections made: ${community.connections_made}
  People helped: ${community.neighbors_helped}

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
 * @param {boolean} [opts.isReminder=false] - reuse this receipt for an upcoming-slot reminder
 */
// The address a signup gives is the helper's own only once they have opened the link in their signup email
// (`confirmed`). Until then these emails use fixed wording: nothing a person typed (a name, the train's title, a
// dish) is put in them, and the page behind the link has the details. `confirmUrl`: the signup email's link, which
// records that the address was opened and then shows the train.
async function sendGuestReservationConfirmationEmail({
  toEmail,
  guestName,
  trainTitle,
  slotLabel,
  slotDate,
  slotTime,
  contributionMode,
  supportTrainId,
  isReminder = false,
  reminderDay,
  dishTitle,
  restaurantName,
  guestAddressSharedAt,
  addressLabel,
  confirmed = false,
  confirmUrl = null,
  cancelUrl = null,
}) {
  const modeLabels = { cook: 'Home-cooked meal', takeout: 'Takeout', groceries: 'Groceries' };
  const modeLabel = modeLabels[contributionMode] || contributionMode;
  const appUrl = (!isReminder && confirmUrl) || `${APP_URL}/support-trains/${supportTrainId}`;
  // A reminder to a confirmed address reads as it always has; everything else is fixed wording.
  const typed = isReminder && confirmed === true;

  const daySuffix = ['tomorrow', 'today'].includes(reminderDay) ? ` ${reminderDay}` : '';
  const subject = typed ? `Reminder: ${trainTitle}${daySuffix}`
    : isReminder ? `Reminder: your Support Train sign-up${daySuffix}` : "You're signed up to help with a Support Train";
  const contributionDetail = typed ? (contributionMode === 'takeout' ? restaurantName : dishTitle) : null;
  const greetingHtml = typed
    ? `Hi <strong>${escapeHtml(guestName)}</strong>, this is a reminder about your upcoming help with <strong>${escapeHtml(trainTitle)}</strong>.`
    : `Hi, ${isReminder ? 'this is a reminder about your upcoming Support Train sign-up on Pantopus.' : 'thank you for signing up to help with a Support Train on Pantopus.'}`;
  const greetingText = typed ? `Hi ${guestName}, this is a reminder about your upcoming slot.`
    : `Hi, ${isReminder ? 'this is a reminder about your upcoming Support Train sign-up.' : 'thank you for signing up to help with a Support Train!'}`;
  const slotLine = typed ? `${slotLabel} · ${slotDate}` : slotDate;
  // A reminder can repeat an address only after this reservation's share receipt.
  const sharedAddress = isReminder && guestAddressSharedAt ? addressLabel : null;

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
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">${isReminder ? 'Your Slot Reminder' : "You're Signed Up!"}</h1>
    </div>

    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
        ${greetingHtml}
      </p>

      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:0 0 20px;">
        <div style="font-size:15px; font-weight:600; color:#111827;">📅 ${escapeHtml(slotLine)}</div>
        ${slotTime ? `<div style="font-size:13px; color:#6b7280; margin-top:4px;">⏰ ${escapeHtml(slotTime)}</div>` : ''}
        <div style="font-size:13px; color:#6b7280; margin-top:4px;">🍽 ${escapeHtml(modeLabel)}</div>${contributionDetail ? `\n        <div style="font-size:13px; color:#6b7280; margin-top:4px;">${escapeHtml(contributionDetail)}</div>` : ''}
      </div>

      <p style="color:#374151; font-size:14px; line-height:1.6; margin:0 0 16px;">
        ${sharedAddress ? `<strong>Drop-off address</strong><br>${escapeHtml(sharedAddress).replace(/\n/g, '<br>')}` : 'The organizer will share exact delivery details with you closer to the date. Keep an eye on your inbox for updates.'}
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
      </div>${cancelUrl ? `

      <p style="color:#374151; font-size:14px; line-height:1.6; margin:0; text-align:center;">
        Can't make it? <a href="${escapeHtml(cancelUrl)}" style="color:#1d4ed8;">Cancel your sign-up</a> so someone else can take the date.
      </p>` : ''}
    </div>

    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:16px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:11px; margin:0;">Pantopus — Your household, organized.</p>
      <p style="color:#d1d5db; font-size:10px; margin:8px 0 0;">
        ${cancelUrl ? `If you didn't sign up for this, <a href="${escapeHtml(cancelUrl)}" style="color:#9ca3af;">cancel the sign-up</a> to free the date.` : "If you didn't sign up for this, you can safely ignore this email."}
      </p>
    </div>
  </div>
</body>
</html>`;

  const text = `
${subject}

${greetingText}

${slotLine}${slotTime ? `\nTime: ${slotTime}` : ''}
Type: ${modeLabel}${contributionDetail ? `\nBring: ${contributionDetail}` : ''}

${sharedAddress ? `Drop-off address:\n${sharedAddress}` : 'The organizer will share exact delivery details with you closer to the date.'}

Want a better experience? Download the Pantopus app for one-tap signups, real-time updates, and direct chat with the organizer.

View Support Train: ${appUrl}
${cancelUrl ? `\nCan't make it? Cancel your sign-up so someone else can take the date: ${cancelUrl}\n` : ''}`;

  return sendEmail({ to: toEmail, subject, html, text });
}

// Reuse the accepted guest receipt renderer and transport; no separate delivery path.
async function sendGuestReservationReminderEmail(options) {
  return sendGuestReservationConfirmationEmail({ ...options, isReminder: true });
}

/**
 * Tell an email-only Support Train guest that the signups listed (label and display date, e.g.
 * "Fri, Oct 9") are no longer needed: the organizer closed the Train, or (`removed`) took this
 * signup off it, with their optional reason.
 */
// `confirmed`: the address opened the link in its signup email. Until then the email uses fixed wording, as the signup
// and reminder emails do: no name, title or reason anyone typed (C6).
async function sendGuestSignupReleasedEmail({ toEmail, guestName, trainTitle, slots, removed = false, reason = null, confirmed = false }) {
  const typed = confirmed === true;
  const subject = typed
    ? (removed ? `Signup removed: ${trainTitle}` : `No longer needed: ${trainTitle}`)
    : (removed ? 'Your Support Train sign-up was removed' : 'Your Support Train sign-up is no longer needed');
  const heading = removed ? 'Your signup was removed' : 'This Support Train has closed';
  const what = removed ? 'an organizer removed your signup for' : 'the organizer closed';
  const reasonText = typed && typeof reason === 'string' && reason.trim() ? reason.trim() : null;
  const slotRows = (slots || []).map((s) => `${s.slotLabel} · ${s.slotDate}`);
  const greetingHtml = typed
    ? `Hi <strong>${escapeHtml(guestName)}</strong>, ${what} <strong>${escapeHtml(trainTitle)}</strong>. You don't need to bring anything for:`
    : `Hi, ${removed ? 'an organizer removed your sign-up for a Support Train on Pantopus' : 'the organizer closed a Support Train you signed up for on Pantopus'}. You don't need to bring anything for:`;
  const greetingText = typed
    ? `Hi ${guestName}, ${what} ${trainTitle}. You don't need to bring anything for:`
    : `Hi, ${removed ? 'an organizer removed your sign-up for a Support Train on Pantopus' : 'the organizer closed a Support Train you signed up for on Pantopus'}. You don't need to bring anything for:`;

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
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">${heading}</h1>
    </div>

    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
        ${greetingHtml}
      </p>

      <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin:0 0 20px;">
        ${slotRows.map((row) => `<div style="font-size:15px; font-weight:600; color:#111827;">📅 ${escapeHtml(row)}</div>`).join('\n        ')}
      </div>
${reasonText ? `
      <p style="color:#374151; font-size:14px; line-height:1.6; margin:0 0 16px;">Reason: ${escapeHtml(reasonText)}</p>
` : ''}
      <p style="color:#374151; font-size:14px; line-height:1.6; margin:0;">
        Thank you for offering to help.
      </p>
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
${subject}

${greetingText}

${slotRows.join('\n')}
${reasonText ? `\nReason: ${reasonText}\n` : ''}
Thank you for offering to help.
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
  replacesEarlier = false,
}) {
  const appUrl = `${APP_URL}/support-trains/${supportTrainId}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLabel)}`;
  // replacesEarlier: the organizer changed where help goes after this guest had the address.
  const subject = replacesEarlier ? `New delivery location for ${trainTitle}` : `Delivery location for ${trainTitle}`;
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
      <h1 style="color:#ffffff; font-size:20px; font-weight:600; margin:0;">${replacesEarlier ? 'New Delivery Location' : 'Delivery Location'}</h1>
    </div>

    <div style="padding:32px;">
      <p style="color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px;">
        Hi <strong>${escapeHtml(guestName)}</strong>, ${replacesEarlier ? 'the delivery location changed' : 'the organizer has shared the exact delivery location'} for <strong>${escapeHtml(trainTitle)}</strong>.${replacesEarlier ? ' This replaces the address we sent you earlier.' : ''}
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
${subject}

Hi ${guestName}, ${replacesEarlier ? 'the delivery location changed. This replaces the address we sent you earlier.' : 'the organizer has shared the exact delivery location.'}

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
//  HOME CLAIM NOTICE EMAIL
// ============================================================

/**
 * A notice to a claimant about their own home claim: a reviewer asked for more, a document is still missing, or
 * the claim closed. Until 2026-11-27 these went only to the app's bell and push, so someone who never opened the
 * app didn't hear. Plain words and one button; the address is the one the claimant entered.
 *
 * @param {Object} opts
 * @param {string} opts.toEmail       the claimant's email address
 * @param {string} opts.heading       the subject and the headline
 * @param {string[]} opts.paragraphs  body text, in order
 * @param {string} [opts.quote]       a reviewer's note, shown as a quotation after the first paragraph
 * @param {string} opts.buttonLabel   e.g. "Open your claim"
 * @param {string} opts.path          the web path the button opens, e.g. /app/homes
 */
async function sendClaimNoticeEmail({ toEmail, heading, paragraphs, quote = null, buttonLabel, path }) {
  const url = `${String(APP_URL).replace(/\/+$/, '')}${path}`;
  const para = (text) => `<p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 16px;">${escapeHtml(text)}</p>`;
  const quoted = quote
    ? `<p style="font-size:15px; line-height:1.6; color:#111827; margin:0 0 16px; padding:12px 16px; background:#f6f7f9; border-radius:10px;">${escapeHtml(quote)}</p>`
    : '';
  const [first, ...rest] = paragraphs;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(heading)}</title>
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
            <td style="padding:8px 32px 28px;">
              <h1 style="font-size:22px; font-weight:600; margin:0 0 16px; color:#111827;">${escapeHtml(heading)}</h1>
              ${para(first)}
              ${quoted}
              ${rest.map(para).join('\n              ')}
              <p style="margin:8px 0 0;">
                <a href="${escapeHtml(url)}" style="display:inline-block; background:#0284c7; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none; padding:12px 20px; border-radius:10px;">${escapeHtml(buttonLabel)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = [heading, '', first, ...(quote ? ['', quote] : []), ...rest.flatMap((line) => ['', line]), '', `${buttonLabel}: ${url}`].join('\n');
  return sendEmail({ to: toEmail, subject: heading, html, text });
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
  checkDeliveryAvailability,
  sendEmail,
  sendHomeInviteEmail,
  sendLetterWaitingEmail,
  cardWaitingEmailContent,
  sendCardWaitingEmail,
  planInviteEmailContent,
  sendPlanInviteEmail,
  planGuestEmailContent,
  sendPlanGuestEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendMonthlyReceipt,
  sendGuestReservationConfirmationEmail,
  sendGuestReservationReminderEmail,
  sendGuestSignupReleasedEmail,
  sendGuestReservationAddressEmail,
  sendDisplayNameMigrationEmail,
  sendClaimNoticeEmail,
  buildDisplayNameMigrationEmailContent,
  // P2.10 / audience-profile §6.3 — audience-zone subscription emails.
  sendPersonaSubscriptionWelcomeEmail,
  sendPersonaSubscriptionCanceledEmail,
  sendPersonaPaymentFailedEmail,
};
