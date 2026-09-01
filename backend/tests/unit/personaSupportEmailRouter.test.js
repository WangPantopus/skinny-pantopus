/**
 * P2.9 — persona-specific support email routing.
 *
 * Asserts the §17 #8 contract: a fan replying to a Stripe receipt at
 * support+<handle>@<domain> is forwarded to platform support with a
 * subject prefix, and the creator's real email is never touched.
 *
 *   1. A real persona's address forwards to PLATFORM_SUPPORT_EMAIL with
 *      a `[@handle]` subject prefix.
 *   2. An unknown handle triggers a polite bounce reply to the sender;
 *      the platform support inbox is NOT spammed.
 *   3. A non-matching to-address (support@ direct, garbage, etc.)
 *      returns handled:false without sending anything.
 *   4. Per-persona route only fires for active personas (status ≠
 *      active triggers the polite-bounce path).
 *   5. The forwarded body is HTML-escaped so a hostile from/subject
 *      cannot inject markup into the support inbox.
 */

jest.mock('../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock' }),
}));

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { resetTables, seedTable } = supabaseAdmin;

const emailService = require('../../services/emailService');
const {
  routeInboundPersonaSupportEmail,
  parsePersonaSupportAddress,
} = require('../../jobs/personaSupportEmailRouter');

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
});

describe('parsePersonaSupportAddress', () => {
  test('matches support+<handle>@<domain>', () => {
    expect(parsePersonaSupportAddress('support+mayabuilds@pantopus.com')).toEqual({
      handle: 'mayabuilds', domain: 'pantopus.com',
    });
  });

  test('rejects platform-wide support@ (no `+` extension)', () => {
    expect(parsePersonaSupportAddress('support@pantopus.com')).toBeNull();
  });

  test('rejects bare email / null', () => {
    expect(parsePersonaSupportAddress('not-an-address')).toBeNull();
    expect(parsePersonaSupportAddress(null)).toBeNull();
  });
});

describe('routeInboundPersonaSupportEmail', () => {
  test('forwards a real persona address to platform support with [@handle] prefix', async () => {
    seedTable('PublicPersona', [{
      id: 'persona-1', user_id: 'creator-1',
      handle: 'mayabuilds', handle_normalized: 'mayabuilds',
      display_name: 'Maya Builds', status: 'active',
    }]);

    const result = await routeInboundPersonaSupportEmail({
      to: 'support+mayabuilds@pantopus.com',
      from: 'fan@example.test',
      subject: 'Question about my Member tier',
      text: 'Hi Maya, do you record office hours?',
    });

    expect(result).toEqual({ handled: true, action: 'forwarded', personaId: 'persona-1' });
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const [args] = emailService.sendEmail.mock.calls[0];
    expect(args.to).toBe('support@pantopus.com');
    expect(args.subject).toBe('[@mayabuilds] Question about my Member tier');
    // The forwarded body retains the fan's message + persona context.
    expect(args.html).toContain('@mayabuilds');
    expect(args.html).toContain('fan@example.test');
    expect(args.html).toContain('Maya, do you record office hours?');
    // The creator's REAL email (creator-1's user_id) is never threaded
    // through; the body never names the underlying user.
    expect(args.html).not.toContain('creator-1');
  });

  test('unknown handle triggers a polite bounce reply to the sender (not platform support)', async () => {
    const result = await routeInboundPersonaSupportEmail({
      to: 'support+nosuchhandle@pantopus.com',
      from: 'fan@example.test',
      subject: 'Hello',
      text: 'Are you there?',
    });

    expect(result).toEqual({ handled: true, action: 'bounce_polite', handle: 'nosuchhandle' });
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const [args] = emailService.sendEmail.mock.calls[0];
    expect(args.to).toBe('fan@example.test');
    expect(args.subject).toMatch(/^Re: /);
    expect(args.html).toMatch(/couldn't find/i);
  });

  test('non-matching to-address returns handled:false without sending mail', async () => {
    const result = await routeInboundPersonaSupportEmail({
      to: 'support@pantopus.com',
      from: 'fan@example.test',
      subject: 'General question',
      text: 'Hi platform.',
    });

    expect(result).toEqual({ handled: false, reason: 'unrecognized_to_address' });
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  test('archived/disabled persona triggers polite bounce, not a forward', async () => {
    seedTable('PublicPersona', [{
      id: 'persona-2', user_id: 'creator-2',
      handle: 'archived_handle', handle_normalized: 'archived_handle',
      display_name: 'Archived', status: 'archived',
    }]);

    const result = await routeInboundPersonaSupportEmail({
      to: 'support+archived_handle@pantopus.com',
      from: 'fan@example.test',
      subject: 'Hi',
    });

    expect(result.action).toBe('bounce_polite');
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const [args] = emailService.sendEmail.mock.calls[0];
    expect(args.to).toBe('fan@example.test');
  });

  test('hostile from/subject is HTML-escaped before forwarding', async () => {
    seedTable('PublicPersona', [{
      id: 'persona-3', user_id: 'creator-3',
      handle: 'mayabuilds', handle_normalized: 'mayabuilds',
      display_name: 'Maya Builds', status: 'active',
    }]);

    await routeInboundPersonaSupportEmail({
      to: 'support+mayabuilds@pantopus.com',
      from: '<script>alert(1)</script>@example.test',
      subject: '<img src=x onerror=alert(2)>',
      text: 'plain body',
    });

    const [args] = emailService.sendEmail.mock.calls[0];
    // Both the from-address and the (untrusted) subject reach the
    // support inbox via interpolation; both must be escaped so a
    // hostile mail can't inject markup into the support reader's view.
    expect(args.html).toContain('&lt;script&gt;');
    expect(args.html).not.toContain('<script>alert(1)</script>');
    // Subject lands in the email subject line raw (subject lines aren't
    // HTML), but it still must not be HTML-escaped twice.
    expect(args.subject).toBe('[@mayabuilds] <img src=x onerror=alert(2)>');
  });
});
