/**
 * P2.8 — Stripe Connect Express args verification.
 *
 * Audience-profile design v2 §6.3 + §17 #7. The live-Stripe receipt
 * verification lives in docs/stripe-receipt-verification-2026-05-08.md;
 * this suite is the source-side proof that what we *send* to Stripe
 * matches the design intent.
 *
 *   1. applyPersonaBusinessProfile sends the persona display name as
 *      business_profile.name and never the creator's legal name.
 *   2. The full set of fields Stripe needs for receipt rendering is
 *      present: name + url + support_url + product_description +
 *      statement_descriptor.
 *   3. The statement descriptor is `PANTOPUS *@HANDLE`, uppercased and
 *      truncated to Stripe's 22-char limit.
 *   4. Long handles truncate cleanly (no broken multibyte, no overflow).
 */

// Inline stripe mock — same pattern as personaPayments.test.js.
const mockStripe = {
  accounts: {
    create:   jest.fn(),
    update:   jest.fn().mockResolvedValue({ id: 'acct_mock' }),
    retrieve: jest.fn(),
  },
  accountLinks: { create: jest.fn() },
  products:    { create: jest.fn(), search: jest.fn().mockResolvedValue({ data: [] }) },
  prices:      { create: jest.fn() },
};
jest.mock('stripe', () => mockStripe);

const personaPaymentsService = require('../../services/personaPaymentsService');

const PERSONA = {
  id: 'persona-1',
  user_id: 'user-1',
  handle: 'mayabuilds',
  display_name: 'Maya Builds',
  // The serializer-side firewall is what keeps this out of Stripe args;
  // including these fields here proves the service ignores them.
  legal_name: 'Maya Real-Name',
  email: 'maya@private.test',
};

beforeEach(() => {
  mockStripe.accounts.update.mockClear();
  mockStripe.accounts.update.mockResolvedValue({ id: 'acct_mock' });
});

describe('P2.8 — applyPersonaBusinessProfile sends the right Stripe args', () => {
  test('business_profile.name is the persona display_name (NOT the legal name)', async () => {
    await personaPaymentsService.applyPersonaBusinessProfile('acct_test', PERSONA);

    expect(mockStripe.accounts.update).toHaveBeenCalledTimes(1);
    const [accountId, args] = mockStripe.accounts.update.mock.calls[0];
    expect(accountId).toBe('acct_test');
    expect(args.business_profile.name).toBe('Maya Builds');
    // Critical firewall assertion — the legal name and email fields on
    // PERSONA must NEVER be forwarded to Stripe by this code path.
    const argsJson = JSON.stringify(args);
    expect(argsJson).not.toContain('Maya Real-Name');
    expect(argsJson).not.toContain('maya@private.test');
  });

  test('business_profile carries url + support_url + product_description for receipt rendering', async () => {
    await personaPaymentsService.applyPersonaBusinessProfile('acct_test', PERSONA);

    const [, args] = mockStripe.accounts.update.mock.calls[0];
    expect(args.business_profile).toEqual(expect.objectContaining({
      name: 'Maya Builds',
      url: 'https://pantopus.com/@mayabuilds',
      // P2.8 fix — Stripe shows support_url on receipts; we point it at
      // the same persona profile page so support contact = the public
      // persona surface.
      support_url: 'https://pantopus.com/@mayabuilds',
      product_description: expect.stringContaining('@mayabuilds'),
    }));
  });

  test('settings.payments.statement_descriptor is PANTOPUS *@HANDLE and uppercased', async () => {
    await personaPaymentsService.applyPersonaBusinessProfile('acct_test', PERSONA);

    const [, args] = mockStripe.accounts.update.mock.calls[0];
    expect(args.settings.payments.statement_descriptor).toBe('PANTOPUS *@MAYABUILDS');
    expect(args.settings.payments.statement_descriptor.length).toBeLessThanOrEqual(22);
  });

  test('long handles truncate cleanly to fit the 22-char Stripe limit', () => {
    const out = personaPaymentsService.buildStatementDescriptor('a-very-long-handle-that-exceeds');
    expect(out.length).toBe(22);
    expect(out.startsWith('PANTOPUS *@')).toBe(true);
    expect(out).toBe('PANTOPUS *@A-VERY-LONG');
  });

  test('handle is uppercased on the descriptor', () => {
    expect(personaPaymentsService.buildStatementDescriptor('lowercase')).toBe('PANTOPUS *@LOWERCASE');
  });

  test('support_email is omitted when PERSONA_SUPPORT_EMAIL_DOMAIN is unset (default)', async () => {
    const prev = process.env.PERSONA_SUPPORT_EMAIL_DOMAIN;
    delete process.env.PERSONA_SUPPORT_EMAIL_DOMAIN;
    try {
      await personaPaymentsService.applyPersonaBusinessProfile('acct_test', PERSONA);
      const [, args] = mockStripe.accounts.update.mock.calls[0];
      // §17 #8 / docs/persona-support-email-feasibility.md — when ops
      // hasn't provisioned the SES inbound rule, the per-persona
      // address would be a black hole. Don't promise it on receipts.
      expect(args.business_profile).not.toHaveProperty('support_email');
    } finally {
      if (prev !== undefined) process.env.PERSONA_SUPPORT_EMAIL_DOMAIN = prev;
    }
  });

  test('support_email IS set to support+HANDLE@<domain> when PERSONA_SUPPORT_EMAIL_DOMAIN is configured', async () => {
    const prev = process.env.PERSONA_SUPPORT_EMAIL_DOMAIN;
    process.env.PERSONA_SUPPORT_EMAIL_DOMAIN = 'pantopus.com';
    try {
      await personaPaymentsService.applyPersonaBusinessProfile('acct_test', PERSONA);
      const [, args] = mockStripe.accounts.update.mock.calls[0];
      expect(args.business_profile.support_email).toBe('support+mayabuilds@pantopus.com');
    } finally {
      if (prev === undefined) delete process.env.PERSONA_SUPPORT_EMAIL_DOMAIN;
      else process.env.PERSONA_SUPPORT_EMAIL_DOMAIN = prev;
    }
  });

  test('buildPersonaSupportEmail returns null for invalid handle characters', () => {
    const prev = process.env.PERSONA_SUPPORT_EMAIL_DOMAIN;
    process.env.PERSONA_SUPPORT_EMAIL_DOMAIN = 'pantopus.com';
    try {
      // Defense-in-depth — handles are validated upstream, but a
      // malformed value must NEVER produce a malformed email address.
      expect(personaPaymentsService.buildPersonaSupportEmail('bad@chars')).toBeNull();
      expect(personaPaymentsService.buildPersonaSupportEmail('with spaces')).toBeNull();
      expect(personaPaymentsService.buildPersonaSupportEmail('valid_handle.1')).toBe('support+valid_handle.1@pantopus.com');
    } finally {
      if (prev === undefined) delete process.env.PERSONA_SUPPORT_EMAIL_DOMAIN;
      else process.env.PERSONA_SUPPORT_EMAIL_DOMAIN = prev;
    }
  });
});
