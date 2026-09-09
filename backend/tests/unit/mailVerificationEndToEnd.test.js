/**
 * Mail orchestration through the real provider and the in-memory RPC boundary.
 *
 * Every prior suite mocked either the vendor or the attach service — which is
 * how "a correct postcard code can never produce an occupancy" shipped twice:
 * first as a phantom column in the claim gate, then as the gate itself, which
 * demanded a pre-verified AddressClaim that nothing in the mail path creates.
 * The code that was physically mailed IS the proof; this suite drives the real
 * startVerification → real Lob provider (only fetch stubbed) → real
 * confirmCode → confirmation RPC boundary, and asserts the whole chain:
 * the mailed postcard carries the code, and entering that code produces a
 * verified member occupancy with an expiry stamp. PostgreSQL contracts separately
 * execute the real confirmation transaction, locks, grants and rollback.
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

describe('uncertain mail delivery', () => {
  test('a lost receipt replays the identical keyed request and keeps the printed code valid', async () => {
    let first = true;
    global.fetch = jest.fn(async (url, options) => {
      lobRequests.push({ url, body: JSON.parse(options.body), options });
      if (first) { first = false; throw new Error('Response lost after acceptance'); }
      return { ok: true, json: async () => ({ id: 'psc_one_card' }) };
    });
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    expect(start.success).toBe(true);
    expect(lobRequests).toHaveLength(2);
    expect(lobRequests[0].options.body).toBe(lobRequests[1].options.body);
    expect(lobRequests[0].options.headers['Idempotency-Key']).toBe(lobRequests[1].options.headers['Idempotency-Key']);
    expect(lobRequests[0].body.metadata.pantopus_verification_job_id).toBe(getTable('MailVerificationJob')[0].id);
    expect((await mailVerificationService.confirmCode(start.attempt_id, codeOnTheMailedPostcard(), USER_ID)).verified).toBe(true);
  });

  test('a permanently lost receipt preserves proof and repeated start/resend sends no more mail', async () => {
    global.fetch = jest.fn(async (url, options) => {
      lobRequests.push({ url, body: JSON.parse(options.body) });
      throw new Error('Response lost after acceptance');
    });
    const first = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    expect(first).toMatchObject({ success: false, delivery_unknown: true, statusCode: 503 });
    expect(getTable('AddressVerificationAttempt')).toHaveLength(1);
    expect(getTable('AddressVerificationToken')).toHaveLength(1);
    expect(getTable('MailVerificationJob')[0].vendor_status).toBe('delivery_unknown');
    expect(lobRequests).toHaveLength(3);
    const second = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    expect(second.verification_id).toBe(first.verification_id);
    const resend = await mailVerificationService.resendCode(first.verification_id, USER_ID);
    expect(resend.delivery_unknown).toBe(true);
    expect(lobRequests).toHaveLength(3);
    expect((await mailVerificationService.confirmCode(first.verification_id, codeOnTheMailedPostcard(), USER_ID)).verified).toBe(true);
  });

  test('a signed-provider correlation recovers the lost receipt without another postcard', async () => {
    global.fetch = jest.fn(async (url, options) => {
      lobRequests.push({ url, body: JSON.parse(options.body) });
      throw new Error('Receipt lost');
    });
    const first = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    const vendor = require('../../services/addressValidation/mailVendorService');
    const result = await vendor.processWebhookEvent('psc_recovered', 'postcard.created', {
      body: { id: 'psc_recovered', object: 'postcard', metadata: lobRequests[0].body.metadata },
    });
    expect(result.success).toBe(true);
    const resumed = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    expect(resumed.success).toBe(true);
    expect(resumed.verification_id).toBe(first.verification_id);
    expect(getTable('MailVerificationJob')[0].vendor_job_id).toBe('psc_recovered');
    expect(lobRequests).toHaveLength(3);
  });

  test('ordinary repeated start returns the same verification without printing again', async () => {
    const first = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    const again = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    expect(again.success).toBe(true);
    expect(again.verification_id).toBe(first.attempt_id);
    expect(lobRequests).toHaveLength(1);
    expect(getTable('AddressVerificationToken')).toHaveLength(1);
  });

  test('definitively rejected mail is not reported as uncertain and can be retried', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 422 }));
    const result = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    expect(result.success).toBe(false);
    expect(result.delivery_unknown).toBeUndefined();
    expect(getTable('MailVerificationJob')).toHaveLength(0);
    expect(getTable('AddressVerificationToken')).toHaveLength(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('an uncertain resend keeps the newly mailed code and original unit', async () => {
    getTable('Home')[0].address2 = 'Unit 4';
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID, 'Unit 4');
    const oldCode = codeOnTheMailedPostcard();
    getTable('AddressVerificationToken')[0].cooldown_until = new Date(0).toISOString();
    global.fetch = jest.fn(async (url, options) => {
      lobRequests.push({ url, body: JSON.parse(options.body) });
      throw new Error('Resend receipt lost');
    });
    const resent = await mailVerificationService.resendCode(start.attempt_id, USER_ID);
    expect(resent.delivery_unknown).toBe(true);
    const newCode = lobRequests[1].body.back.match(/\b(\d{6})\b/)[1];
    expect(lobRequests[1].body.to.address_line2).toBe('Unit 4');
    const again = await mailVerificationService.resendCode(start.attempt_id, USER_ID);
    expect(again.delivery_unknown).toBe(true);
    expect(lobRequests).toHaveLength(4);
    expect(getTable('AddressVerificationToken')[0].resend_count).toBe(1);
    expect((await mailVerificationService.confirmCode(start.attempt_id, oldCode, USER_ID)).verified).toBe(false);
    expect((await mailVerificationService.confirmCode(start.attempt_id, newCode, USER_ID)).verified).toBe(true);
  });
});

test('simultaneous new starts admit one attempt and print one postcard', async () => {
  const results = await Promise.all([
    mailVerificationService.startVerification(USER_ID, ADDRESS_ID),
    mailVerificationService.startVerification(USER_ID, ADDRESS_ID),
  ]);
  expect(getTable('AddressVerificationAttempt')).toHaveLength(1);
  expect(getTable('AddressVerificationToken')).toHaveLength(1);
  expect(getTable('MailVerificationJob')).toHaveLength(1);
  expect(lobRequests).toHaveLength(1);
  expect(new Set(results.map((r) => r.verification_id || r.attempt_id)).size).toBe(1);
});


describe('the printed unit scopes membership', () => {
  function unitHome(unit, id = HOME_ID) {
    return { ...getTable('Home')[0], id, address2: unit };
  }

  test('the mailed unit selects one Home from a shared building address', async () => {
    Object.assign(getTable('HomeAddress')[0], { building_type: 'multi_unit', missing_secondary_flag: true });
    seedTable('Home', [unitHome('Unit 4'), unitHome('Unit 5', '77777777-7777-4777-8777-777777777777')]);
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID, 'Unit 4');
    expect(start.success).toBe(true);
    expect(lobRequests[0].body.to.address_line2).toBe('Unit 4');
    const result = await mailVerificationService.confirmCode(start.attempt_id, codeOnTheMailedPostcard(), USER_ID);
    expect(result.verified).toBe(true);
    expect(getTable('HomeOccupancy')).toEqual([expect.objectContaining({ home_id: HOME_ID, role_base: 'member' })]);
  });

  test('a code mailed to another unit never attaches the only linked Home', async () => {
    getTable('Home')[0].address2 = 'Unit 5';
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID, 'Unit 4');
    const result = await mailVerificationService.confirmCode(start.attempt_id, codeOnTheMailedPostcard(), USER_ID);
    expect(result.verified).toBe(false);
    expect(getTable('HomeOccupancy')).toHaveLength(0);
  });

  test('a canonical unit cannot be replaced by a conflicting requested unit', async () => {
    getTable('HomeAddress')[0].address_line2_norm = 'Unit 4';
    getTable('Home')[0].address2 = 'Unit 4';
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID, 'Unit 5');
    expect(start.success).toBe(false);
    expect(lobRequests).toHaveLength(0);
  });

  test('changing a saved address after dispatch cannot move the proof', async () => {
    const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
    getTable('HomeAddress')[0].address_line1_norm = '900 Different St';
    getTable('Home')[0].address = '900 Different St';
    const result = await mailVerificationService.confirmCode(start.attempt_id, codeOnTheMailedPostcard(), USER_ID);
    expect(result.verified).toBe(false);
    expect(getTable('HomeOccupancy')).toHaveLength(0);
  });
});


test('only the claim for the printed apartment becomes verified', async () => {
  getTable('Home')[0].address2 = 'Apt 4';
  seedTable('AddressClaim', [
    { id: 'claim-four', user_id: USER_ID, address_id: ADDRESS_ID, unit_number: '4', claim_status: 'pending' },
    { id: 'claim-five', user_id: USER_ID, address_id: ADDRESS_ID, unit_number: '5', claim_status: 'pending' },
  ]);
  const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID, 'Unit 4');
  expect((await mailVerificationService.confirmCode(start.attempt_id, codeOnTheMailedPostcard(), USER_ID)).verified).toBe(true);
  expect(getTable('AddressClaim').find(c => c.id === 'claim-four').claim_status).toBe('verified');
  expect(getTable('AddressClaim').find(c => c.id === 'claim-five').claim_status).toBe('pending');
});

test('a resend cannot move an existing proof to a different street', async () => {
  const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
  const originalHash = getTable('AddressVerificationToken')[0].code_hash;
  getTable('AddressVerificationToken')[0].cooldown_until = new Date(0).toISOString();
  getTable('HomeAddress')[0].address_line1_norm = '900 Different St';
  const result = await mailVerificationService.resendCode(start.attempt_id, USER_ID);
  expect(result.success).toBe(false);
  expect(lobRequests).toHaveLength(1);
  expect(getTable('AddressVerificationToken')[0].code_hash).toBe(originalHash);
});

test.each(['frozen', 'frozen_silent'])('mail cannot attach to a %s Home', async security_state => {
  const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
  getTable('Home')[0].security_state = security_state;
  expect((await mailVerificationService.confirmCode(start.attempt_id, codeOnTheMailedPostcard(), USER_ID)).verified).toBe(false);
  expect(getTable('HomeOccupancy')).toHaveLength(0);
});

test('mail cannot reactivate a removed member', async () => {
  const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
  seedTable('HomeOccupancy', [{ id: 'removed-member', home_id: HOME_ID, user_id: USER_ID, role_base: 'member', is_active: false, verification_status: 'moved_out' }]);
  expect((await mailVerificationService.confirmCode(start.attempt_id, codeOnTheMailedPostcard(), USER_ID)).verified).toBe(false);
  expect(getTable('HomeOccupancy')[0].is_active).toBe(false);
});


test('a resident in another apartment does not block the requested apartment', async () => {
  const otherHome = '77777777-7777-4777-8777-777777777777';
  const base = { ...getTable('Home')[0] };
  seedTable('Home', [{ ...base, address2: '4' }, { ...base, id: otherHome, address2: '5' }]);
  seedTable('HomeOccupancy', [{ id: 'neighbor-member', home_id: otherHome, user_id: 'neighbor', is_active: true, role_base: 'member' }]);
  const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID, 'Unit 4');
  expect(start.success).toBe(true);
  expect((await mailVerificationService.confirmCode(start.attempt_id, codeOnTheMailedPostcard(), USER_ID)).verified).toBe(true);
  expect(getTable('HomeOccupancy').filter(o => o.user_id === USER_ID)).toEqual([expect.objectContaining({ home_id: HOME_ID })]);
});

test('a shared address with known apartments requires a unit before sending', async () => {
  getTable('Home')[0].address2 = '4';
  expect((await mailVerificationService.startVerification(USER_ID, ADDRESS_ID)).success).toBe(false);
  expect(lobRequests).toHaveLength(0);
});


test('status and correct-code retry observe the original active membership', async () => {
  const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
  const code = codeOnTheMailedPostcard();
  const first = await mailVerificationService.confirmCode(start.attempt_id, code, USER_ID);
  const original = { ...getTable('HomeOccupancy')[0] };
  expect((await mailVerificationService.getVerificationStatus(start.attempt_id, USER_ID)).status).toBe('confirmed');
  expect(await mailVerificationService.confirmCode(start.attempt_id, code, USER_ID)).toMatchObject({ verified: true, occupancy_id: first.occupancy_id, reused: true });
  expect(getTable('HomeOccupancy')[0]).toEqual(original);
  expect(getTable('AddressVerificationToken')[0].attempt_count).toBe(1);
  getTable('HomeOccupancy')[0].is_active = false;
  expect(await mailVerificationService.getVerificationStatus(start.attempt_id, USER_ID)).toMatchObject({ success: false, statusCode: 403 });
  expect(await mailVerificationService.confirmCode(start.attempt_id, code, USER_ID)).toMatchObject({ verified: false, statusCode: 403 });
  expect(getTable('HomeOccupancy')[0].is_active).toBe(false);
});

test('a legacy consumed code can complete its missing membership once', async () => {
  const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
  const code = codeOnTheMailedPostcard();
  getTable('AddressVerificationAttempt')[0].status = 'verified';
  Object.assign(getTable('AddressVerificationToken')[0], { used_at: new Date().toISOString(), attempt_count: 1 });
  expect(await mailVerificationService.getVerificationStatus(start.attempt_id, USER_ID)).toMatchObject({ success: false, statusCode: 409 });
  expect((await mailVerificationService.confirmCode(start.attempt_id, code, USER_ID)).verified).toBe(true);
  expect(getTable('HomeOccupancy')).toHaveLength(1);
  expect(getTable('AddressVerificationToken')[0].attempt_count).toBe(1);
});


test('missing Home recovery uses the same unconsumed code and sends no more mail', async () => {
  const home = { ...getTable('Home')[0] };
  const start = await mailVerificationService.startVerification(USER_ID, ADDRESS_ID);
  const code = codeOnTheMailedPostcard();
  seedTable('Home', []);
  expect(await mailVerificationService.confirmCode(start.attempt_id, code, USER_ID)).toMatchObject({ verified: false, statusCode: 409 });
  expect(getTable('AddressVerificationToken')[0].used_at).toBeFalsy();
  seedTable('Home', [home]);
  expect((await mailVerificationService.confirmCode(start.attempt_id, code, USER_ID)).verified).toBe(true);
  expect(getTable('AddressVerificationToken')[0].attempt_count).toBe(1);
  expect(lobRequests).toHaveLength(1);
});
