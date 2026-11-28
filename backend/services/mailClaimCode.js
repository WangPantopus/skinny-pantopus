/**
 * A one-time code that opens a letter or Christmas card for someone who isn't on Pantopus yet, from the page its link
 * opens (the web's /open/:mailId). The person taps one button; a code goes to the address the letter was sent to (a
 * card by link: an address they type); they enter it and are signed in, with a new account when the address has none.
 *
 * The code is Supabase Auth's own email code, minted with admin.generateLink (as authSessionService.mintSessionForUser
 * does) and checked with verifyOtp, sent through our SMTP like the other auth emails. Entering it proves the address,
 * which is what POST /api/mailbox/claim/:mailId asks of an account. The claim token alone never signs anyone in: it
 * only says which letter and which address, and the code still has to come from that inbox.
 *
 * A code takes TRIES_PER_CODE tries through POST /api/users/mail-code, counted per address in AuthSecurityEvent, so
 * the count holds across restarts and processes and across every link to that address: each code sent records
 * 'mail_code_sent' (its meta.to a keyed hash of the address, never the address), each try records 'mail_code_try'
 * before it is checked. After the last try fails, the
 * code is replaced in Supabase Auth by one nobody is sent, so it stops working anywhere; the next code sent starts the
 * count again.
 *
 * Routes: POST /api/mailbox/claim/:mailId/code sends it; POST /api/users/mail-code checks it and signs in.
 */

const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const emailService = require('./emailService');
const holidayCards = require('./holidayCards');
const logger = require('../utils/logger');
const authSessionService = require('./authSessionService');
const { cardImprovementsOn } = require('../utils/featureFlags');

/** How long a code works. Supabase Auth keeps its own, longer expiry; this one is checked when the code is used. */
const CODE_MINUTES = 10;
/** Tries a code takes, right or wrong; the code stops working when the last of them is wrong. */
const TRIES_PER_CODE = 5;
// Their rows in AuthSecurityEvent (authSessionService leaves both out of the person's security activity).
const SENT_EVENT = 'mail_code_sent';
const TRY_EVENT = 'mail_code_try';

// ---- The claim token ----

/** Constant-time comparison for claim tokens, so a wrong one takes as long as a right one. */
function timingSafeTokenCompare(stored, provided) {
  if (typeof stored !== 'string' || typeof provided !== 'string') return false;
  const storedBuf = Buffer.from(stored, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (storedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(storedBuf, providedBuf);
}

// The claim token travels only in the link. The letter keeps its SHA-256 (escrow_claim_token_hash), so a Mail row
// read back by a route (most select '*') or a copy of the database never holds a working link.
function hashClaimToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

// Letters stored before the hash kept the token itself.
function claimTokenMatches(mail, provided) {
  if (typeof provided !== 'string' || !provided) return false;
  if (mail.escrow_claim_token_hash) return timingSafeTokenCompare(mail.escrow_claim_token_hash, hashClaimToken(provided));
  return timingSafeTokenCompare(mail.escrow_claim_token, provided);
}

// ---- Which address ----

const normalEmail = (value) => String(value || '').trim().toLowerCase();
const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * The address a letter's code goes to: the one it was sent to, or for a card by link (which went to no address) the one
 * the person typed. { address } or { refusal: { status, error, code } }. A letter sent by text has no email to send a
 * code to: its page keeps signing in and creating an account.
 */
function codeAddress(mail, typedEmail) {
  if (holidayCards.isByLink(mail)) {
    const typed = normalEmail(typedEmail);
    if (!typed || !looksLikeEmail(typed)) {
      return { refusal: { status: 400, error: 'Enter your email address.', code: 'CODE_EMAIL_NEEDED' } };
    }
    return { address: typed };
  }
  const sentTo = normalEmail(mail.escrow_recipient_contact);
  if (!sentTo.includes('@')) {
    return { refusal: { status: 400, error: 'This letter came by text. Sign in or create an account with that number to read it.', code: 'CODE_BY_TEXT' } };
  }
  return { address: sentTo };
}

const LINK_INVALID = { status: 404, error: 'This letter link doesn’t work. Check that you opened the whole link.', code: 'MAIL_LINK_INVALID' };

/**
 * The letter behind a link and the address its code goes to. { mail, address } or { refusal }. A read failure throws.
 * Whether the letter can still be claimed is the caller's question (the claim route answers it in its own words).
 */
async function letterAndAddress({ mailId, token, email }) {
  const { data: mail, error } = await supabaseAdmin
    .from('Mail')
    .select('id, sender_user_id, sender_entity_id, sender_business_name, sender_display, recipient_user_id, escrow_recipient_contact, escrow_status, escrow_claim_token, escrow_claim_token_hash, escrow_expires_at, mail_extracted')
    .eq('id', mailId)
    .maybeSingle();
  if (error) throw new Error(`mail read failed: ${error.message}`);
  if (!mail || !claimTokenMatches(mail, token)) return { refusal: LINK_INVALID };
  const found = codeAddress(mail, email);
  return found.refusal ? found : { mail, address: found.address };
}

// The address as the code's rows know it: a keyed hash (the server's secret, as card links use, under its own label),
// so the rows never hold the address and the newest code for it is found by an index, not by its Auth user's email.
function addressKey(address) {
  const secret = process.env.MAIL_ENCLOSURE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHmac('sha256', secret).update(`pantopus:mail-code-to:v1:${normalEmail(address)}`).digest('base64url');
}

// ---- Sending it ----

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function codeEmail({ code, senderName, card, returnLink = null }) {
  // `card`: true for a Christmas card, or what to call the card ("thank-you card"; holidayCards.cardWords).
  const thing = typeof card === 'string' && card ? card : card ? 'Christmas card' : 'letter';
  const opening = card ? 'open' : 'read';
  const subject = `${code} is your Pantopus code`;
  const intro = `Enter this code on the page your ${thing}’s link opened to ${opening} the ${thing} ${senderName} sent you.`;
  // The card round (featureFlags cardImprovementsOn): the return button below and these words. Off, the email is the
  // one from before it, to the letter.
  const improved = cardImprovementsOn();
  const footnote = improved
    ? `It works for ${CODE_MINUTES} minutes. If you didn’t ask for it, you can ignore this email: nobody can sign in or claim the ${thing} without it.`
    : `It works for ${CODE_MINUTES} minutes. If you didn’t ask for it, you can ignore this email: nobody can ${opening} the ${thing} without it.`;
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@pantopus.com';
  // A return button for mobile in-app browsers that lose their previous tab when switching to email; opening the link
  // pre-fills the code on the page and never auto-submits on GET, so link scanners cannot consume the code.
  const buttonHtml = improved && returnLink
    ? `\n              <p style="margin:0 0 22px;"><a href="${esc(returnLink)}" style="display:inline-block; background:${card ? '#8b1d1d' : '#111827'}; color:#ffffff; font-size:15px; font-weight:600; padding:12px 24px; border-radius:10px; text-decoration:none;">Return to your ${esc(thing)}</a></p>`
    : '';
  const buttonText = improved && returnLink ? `\nOr return to your ${thing}: ${returnLink}\n` : '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f6f7f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827; -webkit-font-smoothing:antialiased;">
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#f6f7f9;">
    Your code to ${opening} the ${esc(thing)} from ${esc(senderName)}.
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
              <h1 style="font-size:22px; font-weight:600; margin:0 0 16px; color:#111827;">Your code</h1>
              <p style="font-size:15px; line-height:1.6; color:#374151; margin:0 0 20px;">${esc(intro)}</p>
              <p style="font-size:34px; line-height:1.2; font-weight:700; letter-spacing:8px; color:#111827; margin:0 0 ${improved ? 20 : 24}px; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${esc(code)}</p>${buttonHtml}
              <div style="border-top:1px solid #e5e7eb; padding-top:20px;">
                <p style="font-size:13px; line-height:1.6; color:#6b7280; margin:0;">${esc(footnote)} Never share this code.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px;">
              <p style="font-size:12px; line-height:1.6; color:#9ca3af; margin:0;">
                Questions? Reply to this email or write to
                <a href="mailto:${esc(supportEmail)}" style="color:#6b7280; text-decoration:underline;">${esc(supportEmail)}</a>.<br>
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
  const text = `Your code: ${code}

${intro}
${buttonText}
${footnote} Never share this code.

Questions? Reply to this email or write to ${supportEmail}.

Pantopus — Your household, organized.
`;
  return { subject, html, text };
}

/**
 * Mint a code for `address` and email it. A new address gets an Auth user that isn't confirmed (Supabase Auth makes it
 * with the code); entering the code confirms it. Each code replaces the address's earlier one. Answers 'sent',
 * 'unavailable' (email can't be delivered now) or 'failed'. Never says whether the address had an account.
 */
async function sendCode({ address, senderName, card, mailId, req, returnLinkBase = null }) {
  if (!(await emailService.checkDeliveryAvailability()).available) return 'unavailable';
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: address });
  const code = data?.properties?.email_otp;
  if (error || !code || !data?.user?.id) {
    logger.error('Mail code: generateLink failed', { error: error?.message || 'no email_otp', status: error?.status || null });
    return 'failed';
  }
  // An address nobody has confirmed can hold two codes in Supabase Auth: its sign-up code (the first one sent) and a
  // sign-in code (each one after). This code replaced the sign-in one; replace the sign-up one too, so only this works.
  if (!data.user.email_confirmed_at && data.properties.verification_type !== 'signup' && !(await replaceSignupCode(address))) {
    return 'failed';
  }
  // The count of tries starts here; without this row the code can't be used, so it isn't sent.
  const sent = await authSessionService.recordSecurityEvent({ userId: data.user.id, type: SENT_EVENT, req, meta: { mail_id: mailId, to: addressKey(address) } });
  if (!sent) return 'failed';
  const returnLink = returnLinkBase ? `${returnLinkBase}&code=${encodeURIComponent(code)}` : null;
  const result = await emailService.sendEmail({ to: address, ...codeEmail({ code, senderName, card, returnLink }) });
  if (!result?.success) {
    logger.error('Mail code: email send failed', { error: result?.error || null });
    return 'failed';
  }
  return 'sent';
}

/**
 * Whether the code just accepted for `user` (the Auth user verifyOtp answered with) was sent less than CODE_MINUTES
 * ago: a new address's code is its confirmation, an account's code its sign-in link (recovery_sent_at).
 */
function codeIsFresh(user, now = Date.now()) {
  const sent = Math.max(Date.parse(user?.confirmation_sent_at || '') || 0, Date.parse(user?.recovery_sent_at || '') || 0);
  return sent > 0 && now - sent <= CODE_MINUTES * 60 * 1000;
}

/**
 * Takes one try at the address's newest code before it is checked, so tries made at the same moment can't all slip
 * under the count. The code is the newest 'mail_code_sent' row for the address's key. { tryId, tryNumber, userId }
 * (tryNumber 1 for the first try at that code); { noCode: true } when no code was ever sent to the address;
 * { expired: true } when the newest one is older than CODE_MINUTES; { stopped: true, userId } when its tries are used
 * up. A try that turns out not to have been checked (Auth was busy) gives its turn back with giveBackTry.
 */
async function takeTry({ address, mailId, req }) {
  const { data: sent, error: sentError } = await supabaseAdmin.from('AuthSecurityEvent').select('id, user_id, created_at')
    .eq('type', SENT_EVENT).eq('meta->>to', addressKey(address))
    .order('id', { ascending: false }).limit(1).maybeSingle();
  if (sentError) throw new Error(`code sent read failed: ${sentError.message}`);
  if (!sent) return { noCode: true };
  if (Date.now() - Date.parse(sent.created_at) > CODE_MINUTES * 60 * 1000) return { expired: true };
  const userId = sent.user_id;
  const taken = await authSessionService.recordSecurityEvent({ userId, type: TRY_EVENT, req, meta: { mail_id: mailId } });
  if (!taken) throw new Error('code try not recorded');
  const { count, error } = await supabaseAdmin.from('AuthSecurityEvent').select('id', { count: 'exact', head: true })
    // In the order the rows were written (their ids), whichever process wrote them.
    .eq('user_id', userId).eq('type', TRY_EVENT).gt('id', sent.id).lte('id', taken.id);
  if (error) throw new Error(`code tries read failed: ${error.message}`);
  if (count > TRIES_PER_CODE) {
    // Not a try: the code had stopped. Its row goes, so the rows stay at most TRIES_PER_CODE per code sent.
    await giveBackTry(taken.id);
    return { stopped: true, userId };
  }
  return { tryId: taken.id, tryNumber: count, userId };
}

async function giveBackTry(tryId) {
  if (!tryId) return;
  const { error } = await supabaseAdmin.from('AuthSecurityEvent').delete().eq('id', tryId).eq('type', TRY_EVENT);
  if (error) logger.warn('Mail code: try not given back', { error: error.message });
}

// A new sign-up code for an address nobody has confirmed, never sent: the one it had stops working. Supabase Auth asks
// for a password here and keeps the user's own (it sets one only when it makes the user).
async function replaceSignupCode(address) {
  const { error } = await supabaseAdmin.auth.admin.generateLink({ type: 'signup', email: address, password: crypto.randomBytes(24).toString('base64url') });
  if (error) logger.error('Mail code: replacing a sign-up code failed', { error: error.message, status: error.status || null });
  return !error;
}

/**
 * The address's code stops working: Supabase Auth replaces its codes with ones that are never sent (the sign-in code,
 * and the sign-up code of an address nobody has confirmed), so the old code fails there too, not only here. Nothing
 * else changes (no sign-out, no password), and the answer is the same whether or not the address has an account. It
 * also replaces a password-reset link sent to that address in the meantime, as any new code does.
 */
async function stopCode(address, userId) {
  const { error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: address });
  if (error) logger.error('Mail code: stopping a code failed', { error: error.message, status: error.status || null });
  const { data: owner } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (!owner?.user?.email_confirmed_at) await replaceSignupCode(address);
}

module.exports = {
  CODE_MINUTES,
  TRIES_PER_CODE,
  takeTry,
  giveBackTry,
  stopCode,
  hashClaimToken,
  claimTokenMatches,
  codeAddress,
  letterAndAddress,
  sendCode,
  codeIsFresh,
};
