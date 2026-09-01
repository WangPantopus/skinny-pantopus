/**
 * The mail channel, end to end, with nothing in the middle mocked.
 *
 * Every prior suite mocked either the vendor or the attach service — which is
 * how "a correct postcard code can never produce an occupancy" shipped twice:
 * first as a phantom column in the claim gate, then as the gate itself, which
 * demanded a pre-verified AddressClaim that nothing in the mail path creates.
 * The code that was physically mailed IS the proof; this suite drives the real
 * startVerification → real Lob provider (only fetch stubbed) → real
 * confirmCode → real occupancyAttachService, and asserts the whole chain:
 * the mailed postcard carries the code, and entering that code produces a
 * verified member occupancy with an expiry stamp.
 */

// Lob must be "available" before any module under test loads its config.
process.env.LOB_API_KEY = 'test_0000000000000000000000000000000000';
process.env.LOB_ENV = 'test';
delete process.env.LOB_POSTCARD_TEMPLATE_ID;

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mailVerificationService = require('../../services/addressValidation/mailVerificationService');

const USER_ID = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const ADDRESS_ID = '99999999-9999-4999-8999-999999999999';
const HOME_ID = '88888888-8888-4888-8888-888888888888';

/** Everything Lob was asked to print, keyed by request order. */
let lobRequests;

beforeEach(() => {
  resetTables();
  lobRequests = [];

  global.fetch = jest.fn(async (url, options) => {
    lobRequests.push({ url: String(url), body: JSON.parse(options.body) });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: `psc_${lobRequests.length}`, expected_delivery_date: '2026-09-08' }),
      text: async () => '',
    };
  });

  seedTable('HomeAddress', [{
    id: ADDRESS_ID,
    address_line1_norm: '742 Evergreen Ter',
    address_line2_norm: null,
    city_norm: 'Portland',
    state_norm: 'OR',
    zip_norm: '97201',
    validation_raw_response: { dpv_match_code: 'Y' },
    last_validated_at: new Date().toISOString(),
  }]);
  seedTable('Home', [{
    id: HOME_ID,
    address_id: ADDRESS_ID,
    owner_id: null,
    address: '742 Evergreen Ter',
    city: 'Portland',
    state: 'OR',
    zipcode: '97201',
  }]);
  seedTable('HomeOccupancy', []);
  seedTable('AddressVerificationAttempt', []);
  seedTable('AddressVerificationToken', []);
  seedTable('MailVerificationJob', []);
  seedTable('AddressClaim', []);
  seedTable('HomeAuditLog', []);
});

afterEach(() => {
  delete global.fetch;
});

/** Pull the 6-digit code off the postcard Lob was actually asked to print. */
function codeOnTheMailedPostcard() {
  expect(lobRequests.length).toBeGreaterThan(0);
  const back = lobRequests[0].body.back || '';
  const match = String(back).match(/\b(\d{6})\b/);
  expect(match).toBeTruthy();
  return match[1];
}

describe('mail verification, end to end', () => {
  test('the postcard Lob prints carries the exact code whose hash was stored', async () => {
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    expect(start.success).toBe(true);

    const mailedCode = codeOnTheMailedPostcard();
    expect(mailedCode).toMatch(/^\d{6}$/);

    // The plaintext must never be persisted anywhere.
    const job = getTable('MailVerificationJob')[0];
    expect(JSON.stringify(job.metadata || {})).not.toContain(mailedCode);
    const token = getTable('AddressVerificationToken')[0];
    expect(token.code_hash).not.toBe(mailedCode);
  });

  test('entering the mailed code produces a verified member occupancy', async () => {
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    expect(start.success).toBe(true);
    const mailedCode = codeOnTheMailedPostcard();

    const confirm = await mailVerificationService.confirmCode(
      start.attempt_id, mailedCode, USER_ID,
    );

    expect(confirm.verified).toBe(true);
    // SCN-06: verified with no occupancy is "contact support" — the exact
    // outcome the mail channel shipped with, twice.
    expect(confirm.occupancy_id).toBeTruthy();

    const occ = getTable('HomeOccupancy').find(
      (o) => o.home_id === HOME_ID && o.user_id === USER_ID,
    );
    expect(occ).toBeTruthy();
    expect(occ.is_active).toBe(true);
    expect(occ.verification_status).toBe('verified');
    // mail_code is capped at member, never admin.
    expect(occ.role_base).toBe('member');
    // §5.1: the verification is datable and expirable.
    expect(occ.verified_at).toBeTruthy();
    expect(occ.verification_expires_at).toBeTruthy();
  });

  test('a pending AddressClaim is stamped verified/mail_code by the confirm', async () => {
    seedTable('AddressClaim', [{
      id: 'claim-1',
      user_id: USER_ID,
      address_id: ADDRESS_ID,
      claim_status: 'pending',
      verification_method: 'manual_review',
    }]);

    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    const confirm = await mailVerificationService.confirmCode(
      start.attempt_id, codeOnTheMailedPostcard(), USER_ID,
    );
    expect(confirm.verified).toBe(true);

    const claim = getTable('AddressClaim').find((c) => c.id === 'claim-1');
    expect(claim.claim_status).toBe('verified');
    expect(claim.verification_method).toBe('mail_code');
  });

  test('a wrong code attaches nothing', async () => {
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    const mailedCode = codeOnTheMailedPostcard();
    const wrong = mailedCode === '111111' ? '222222' : '111111';

    const confirm = await mailVerificationService.confirmCode(start.attempt_id, wrong, USER_ID);

    expect(confirm.verified).toBe(false);
    expect(getTable('HomeOccupancy')).toHaveLength(0);
  });
});
