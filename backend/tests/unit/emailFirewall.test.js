/**
 * P2.10 — outbound email firewall.
 *
 * Audience-profile design v2 §6.3 + docs/email-firewall-audit-2026-05-08.md.
 *
 * Captures every email sent through emailService and asserts:
 *   1. Audience-zone emails (welcome, canceled, payment-failed) carry
 *      ONLY persona display name + handle + fan handle. The creator's
 *      User.name / User.email NEVER appear in subject or body.
 *   2. The fan's email IS the recipient but does NOT appear inside the
 *      body (it would be redundant + a privacy smell).
 *   3. Persona emails do NOT set a Reply-To header pointing at any
 *      creator-side address.
 *   4. Personal-zone emails (home invite) never carry @-style audience
 *      handles in subject or body.
 *   5. The monthly receipt body never references any persona-zone
 *      field (subscriber count, persona earnings, broadcast metric).
 */

// Stub nodemailer at the module level so emailService picks the real
// SMTP transport path (devMode=false) and routes through sendMail —
// which we capture here. The factory closure can only reference
// variables prefixed with `mock` per Jest's hoisting rules.
const mockCapturedEmails = [];
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: (opts) => {
      mockCapturedEmails.push(opts);
      return Promise.resolve({ messageId: 'test', accepted: [opts.to] });
    },
  }),
}));
const capturedEmails = mockCapturedEmails;

// Force the env vars emailService inspects at import time so the
// SMTP transport is constructed (devMode = false). Set BEFORE require.
process.env.SMTP_HOST = 'smtp.test.local';
process.env.SMTP_USER = 'u';
process.env.SMTP_PASS = 'p';

const emailService = require('../../services/emailService');

beforeEach(() => { capturedEmails.length = 0; });

// Test fixtures — the underlying creator's REAL identity. None of
// these strings should appear in any audience-zone email body or
// subject. They're test sentinels for cross-context leak detection.
const CREATOR_LEGAL_NAME    = 'Maya Q. Builder';
const CREATOR_REAL_EMAIL    = 'maya.builder@private.test';
const PERSONA_DISPLAY_NAME  = 'Maya Builds';
const PERSONA_HANDLE        = 'mayabuilds';
const FAN_HANDLE            = 'fan_x9k2';
const FAN_REAL_EMAIL        = 'jordan.smith@gmail.com';

describe('P2.10 — audience-zone email firewall', () => {
  test('sendPersonaSubscriptionWelcomeEmail never includes creator legal name or email', async () => {
    await emailService.sendPersonaSubscriptionWelcomeEmail({
      toEmail: FAN_REAL_EMAIL,
      fanHandle: FAN_HANDLE,
      personaDisplayName: PERSONA_DISPLAY_NAME,
      personaHandle: PERSONA_HANDLE,
      tierName: 'Member',
      periodEndDate: 'June 15, 2026',
    });
    const email = capturedEmails[0];
    expect(email).toBeDefined();

    // The persona display name + handle + fan handle DO appear
    // (these are the only persona-side identifiers in the body).
    expect(email.subject).toContain(PERSONA_DISPLAY_NAME);
    expect(email.html).toContain(PERSONA_DISPLAY_NAME);
    expect(email.html).toContain(FAN_HANDLE);
    expect(email.html).toContain('Member');

    // Critical: the creator's underlying identity NEVER appears.
    const blob = `${email.subject}\n${email.html}\n${email.text || ''}`;
    expect(blob).not.toContain(CREATOR_LEGAL_NAME);
    expect(blob).not.toContain(CREATOR_REAL_EMAIL);
  });

  test('sendPersonaSubscriptionWelcomeEmail does not echo the fan email into the body', async () => {
    await emailService.sendPersonaSubscriptionWelcomeEmail({
      toEmail: FAN_REAL_EMAIL,
      fanHandle: FAN_HANDLE,
      personaDisplayName: PERSONA_DISPLAY_NAME,
      personaHandle: PERSONA_HANDLE,
      tierName: 'Member',
      periodEndDate: 'June 15, 2026',
    });
    const email = capturedEmails[0];
    // The fan's real email is the recipient — that's expected.
    expect(email.to).toBe(FAN_REAL_EMAIL);
    // It must NOT appear inside the body; only the audience-side handle
    // identifies the recipient.
    expect(email.html).not.toContain(FAN_REAL_EMAIL);
    expect(email.subject).not.toContain(FAN_REAL_EMAIL);
  });

  test('sendPersonaSubscriptionCanceledEmail follows the same firewall rules', async () => {
    await emailService.sendPersonaSubscriptionCanceledEmail({
      toEmail: FAN_REAL_EMAIL,
      fanHandle: FAN_HANDLE,
      personaDisplayName: PERSONA_DISPLAY_NAME,
      periodEndDate: 'July 1, 2026',
    });
    const email = capturedEmails[0];
    expect(email.html).toContain(PERSONA_DISPLAY_NAME);
    expect(email.html).toContain(FAN_HANDLE);
    const blob = `${email.subject}\n${email.html}`;
    expect(blob).not.toContain(CREATOR_LEGAL_NAME);
    expect(blob).not.toContain(CREATOR_REAL_EMAIL);
    expect(blob).not.toContain(FAN_REAL_EMAIL);
  });

  test('sendPersonaPaymentFailedEmail does not name the creator or surface their email', async () => {
    await emailService.sendPersonaPaymentFailedEmail({
      toEmail: FAN_REAL_EMAIL,
      fanHandle: FAN_HANDLE,
      personaDisplayName: PERSONA_DISPLAY_NAME,
    });
    const email = capturedEmails[0];
    expect(email.html).toContain(PERSONA_DISPLAY_NAME);
    expect(email.html).toContain(FAN_HANDLE);
    const blob = `${email.subject}\n${email.html}`;
    expect(blob).not.toContain(CREATOR_LEGAL_NAME);
    expect(blob).not.toContain(CREATOR_REAL_EMAIL);
    // Per §6.3 the fan's email is intentionally not referenced in the
    // body — only the recipient header.
    expect(blob).not.toContain(FAN_REAL_EMAIL);
  });

  test('persona emails do NOT set a Reply-To header pointing at a creator-side address', async () => {
    await emailService.sendPersonaSubscriptionWelcomeEmail({
      toEmail: FAN_REAL_EMAIL,
      fanHandle: FAN_HANDLE,
      personaDisplayName: PERSONA_DISPLAY_NAME,
      personaHandle: PERSONA_HANDLE,
      tierName: 'Member',
      periodEndDate: 'June 15, 2026',
    });
    const email = capturedEmails[0];
    // sendMail accepts a `replyTo` option (string or array). It must
    // NEVER point at the creator's real email.
    if (email.replyTo) {
      const rt = Array.isArray(email.replyTo) ? email.replyTo.join(' ') : String(email.replyTo);
      expect(rt).not.toContain(CREATOR_REAL_EMAIL);
      expect(rt).not.toContain(CREATOR_LEGAL_NAME);
    } else {
      expect(email.replyTo).toBeUndefined();
    }
  });
});

describe('P2.10 — personal-zone email firewall (no audience leak)', () => {
  test('sendHomeInviteEmail body does not contain any @<handle>-style audience identifier', async () => {
    await emailService.sendHomeInviteEmail({
      toEmail: 'guest@example.com',
      inviterName: 'Maya',
      homeName: 'Riverside Apt',
      homeCity: 'Camas, WA',
      role: 'household_member',
      token: 'invite-abc',
      message: '',
    });
    const email = capturedEmails[0];
    // No persona handle markers — neither in the subject nor in the body.
    // The regex catches `@anything` patterns that aren't part of an email
    // address (which always have a `.` in the domain part).
    const blob = `${email.subject}\n${email.html}`;
    // Allow real email addresses (foo@bar.com) but reject bare handle
    // patterns like "@mayabuilds" or "/@mayabuilds".
    const handleHits = blob.match(/(?:^|[\s">/])@[a-z0-9_-]+(?![a-z0-9_.-]*\.[a-z])/gi);
    expect(handleHits || []).toEqual([]);
  });
});

describe('P2.10 — sendMonthlyReceipt is personal-zone only', () => {
  test('monthly receipt body does not reference any persona-zone field', async () => {
    await emailService.sendMonthlyReceipt('creator@example.com', {
      period: { year: 2026, month: 5, label: 'May 2026' },
      earnings: { total_cents: 12000, gig_count: 3, top_category: 'cleaning' },
      spending: { total_cents: 4500, gig_count: 1 },
      marketplace: { listings_sold: 2, listings_bought: 1, free_items_claimed: 0 },
      community: { posts_created: 5, connections_made: 2, neighbors_helped: 4 },
      reputation: { current_rating: 4.9, reviews_received: 3, rating_change: 0.1 },
      highlight: 'Big month!',
    });
    const email = capturedEmails[0];
    const blob = `${email.subject}\n${email.html}`;
    // None of these audience-zone signals belong in the personal-zone
    // monthly receipt. If persona earnings ship later, they go in a
    // separate sendPersonaMonthlyReceipt (Option A — see audit doc §2).
    for (const forbidden of [
      'persona', 'Persona', 'follower', 'Follower', 'subscriber',
      'Subscriber', 'broadcast', 'Broadcast', 'tier', 'Tier', 'fan',
    ]) {
      expect(blob).not.toContain(forbidden);
    }
  });
});
