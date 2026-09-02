/**
 * The instant verification door (Wedge Phase 2, D3): a residency claim
 * (claim_type 'resident', method 'doc_upload') is reviewed by a person.
 *
 *   • a renter at a RENTAL home can file one — the owner-only rental
 *     firewall and challenge routing are not consulted;
 *   • an unverified occupancy becomes 'pending_doc' so the Waiting Room
 *     reads "Document under review"; provisional access is never demoted;
 *   • the founder is alerted by email (ADMIN_ALERT_EMAIL) — the promise
 *     "usually within hours" needs a person to hear about it;
 *   • a second active residency claim is handed back (opaque, 200), not
 *     duplicated;
 *   • an OWNER claim still runs the rental firewall.
 */
const express = require('express');
const request = require('supertest');

jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../utils/homePermissions', () => ({
  checkHomePermission: jest.fn(async () => ({ hasAccess: true })),
  writeAuditLog: jest.fn(async () => {}),
  applyOccupancyTemplate: jest.fn(async () => ({ occupancy: { id: 'occ-1' } })),
  mapLegacyRole: jest.fn((role) => role),
}));
jest.mock('../../utils/homeSecurityPolicy', () => {
  const actual = jest.requireActual('../../utils/homeSecurityPolicy');
  return {
    canSubmitOwnerClaim: jest.fn(async () => ({ allowed: true, errors: [], blockCode: null })),
    canSubmitResidencyClaim: actual.canSubmitResidencyClaim, // the behaviour under test
    evaluateRentalFirewall: jest.fn(() => ({ blocked: true, reason: 'rental' })),
    getClaimRiskScore: jest.fn(async () => 0),
    isClaimWindowActive: jest.fn(() => false),
    recalculateTier: jest.fn(async () => 'weak'),
    shouldTriggerDispute: jest.fn(() => false),
    getClaimWindowEndsAt: jest.fn(() => new Date('2026-04-30T00:00:00.000Z')),
  };
});
jest.mock('../../services/propertyDataService', () => ({ isAvailable: jest.fn(() => false), verifyPropertyOwnership: jest.fn() }));
jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn(async () => ({ id: 'n-1' })),
  notifyHomeInvite: jest.fn(async () => ({})),
  notifyHomeInviteAccepted: jest.fn(async () => ({})),
  notifyOwnershipDispute: jest.fn(async () => ({})),
}));
jest.mock('../../middleware/rateLimiter', () => {
  const passthrough = (_req, _res, next) => next();
  return new Proxy({}, { get: (_t, prop) => (prop === '__esModule' ? false : passthrough) });
});
jest.mock('../../services/occupancyAttachService', () => ({ attach: jest.fn(async () => ({ success: true })) }));
jest.mock('../../services/emailService', () => ({ sendEmail: jest.fn(async () => ({ ok: true })) }));

const { resetTables, seedTable, getTable } = require('../__mocks__/supabaseAdmin');
const policy = require('../../utils/homeSecurityPolicy');
const emailService = require('../../services/emailService');
const router = require('../../routes/homeOwnership');

const HOME = 'bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb';
const RENTER = 'cccccccc-cccc-1ccc-8ccc-cccccccccccc';

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/homes', router);
  return a;
}

function seedRental({ occupancyStatus = 'unverified' } = {}) {
  seedTable('Home', [{
    id: HOME, address: '1214 NE Birch St', city: 'Camas', state: 'WA', zipcode: '98607',
    home_status: 'active', security_state: 'normal', tenure_mode: 'rental',
    owner_claim_policy: 'open', claim_window_ends_at: null,
  }]);
  seedTable('HomeOccupancy', [{ id: 'occ-r', home_id: HOME, user_id: RENTER, is_active: true, verification_status: occupancyStatus }]);
}

beforeEach(() => {
  resetTables();
  jest.clearAllMocks();
  process.env.ADMIN_ALERT_EMAIL = 'yp@example.com';
  delete process.env.WEB_APP_URL;
});
afterAll(() => { delete process.env.ADMIN_ALERT_EMAIL; });

describe('POST /api/homes/:id/ownership-claims with claim_type=resident (the instant door)', () => {
  it('lets a renter at a rental home file a residency claim — no rental firewall, no challenge routing', async () => {
    seedRental();
    const res = await request(app())
      .post(`/api/homes/${HOME}/ownership-claims`)
      .set('x-test-user-id', RENTER)
      .send({ claim_type: 'resident', method: 'doc_upload' });
    expect(res.status).toBe(201);
    expect(res.body.claim).toMatchObject({ status: 'under_review' });
    expect(res.body.claim.id).toBeTruthy();
    expect(res.body.next_step).toBe('upload_evidence');
    expect(res.body.message).toMatch(/residency/i);
    expect(policy.evaluateRentalFirewall).not.toHaveBeenCalled();
    expect(policy.canSubmitOwnerClaim).not.toHaveBeenCalled();
    const claims = getTable('HomeOwnershipClaim');
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ claim_type: 'resident', method: 'doc_upload', state: 'submitted', home_id: HOME, claimant_user_id: RENTER });
  });

  it('marks an unverified occupancy "document under review" (pending_doc)', async () => {
    seedRental({ occupancyStatus: 'unverified' });
    await request(app()).post(`/api/homes/${HOME}/ownership-claims`).set('x-test-user-id', RENTER).send({ claim_type: 'resident', method: 'doc_upload' });
    expect(getTable('HomeOccupancy')[0].verification_status).toBe('pending_doc');
  });

  it('never demotes provisional access', async () => {
    seedRental({ occupancyStatus: 'provisional' });
    await request(app()).post(`/api/homes/${HOME}/ownership-claims`).set('x-test-user-id', RENTER).send({ claim_type: 'resident', method: 'doc_upload' });
    expect(getTable('HomeOccupancy')[0].verification_status).toBe('provisional');
  });

  it('alerts the founder by email, without the address in the subject', async () => {
    seedRental();
    await request(app()).post(`/api/homes/${HOME}/ownership-claims`).set('x-test-user-id', RENTER).send({ claim_type: 'resident', method: 'doc_upload' });
    await new Promise((r) => setImmediate(r)); // fire-and-forget
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const arg = emailService.sendEmail.mock.calls[0][0];
    expect(arg.to).toBe('yp@example.com');
    expect(arg.subject).toMatch(/Residency claim to review/);
    expect(arg.subject).toMatch(/Camas/);
    expect(arg.subject).not.toMatch(/Birch/);
    expect(arg.text).toMatch(/review-claims/);
  });

  it('sends no email when ADMIN_ALERT_EMAIL is unset', async () => {
    delete process.env.ADMIN_ALERT_EMAIL;
    seedRental();
    await request(app()).post(`/api/homes/${HOME}/ownership-claims`).set('x-test-user-id', RENTER).send({ claim_type: 'resident', method: 'doc_upload' });
    await new Promise((r) => setImmediate(r));
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('hands back the active claim instead of creating a second one', async () => {
    seedRental();
    const first = await request(app()).post(`/api/homes/${HOME}/ownership-claims`).set('x-test-user-id', RENTER).send({ claim_type: 'resident', method: 'doc_upload' });
    const second = await request(app()).post(`/api/homes/${HOME}/ownership-claims`).set('x-test-user-id', RENTER).send({ claim_type: 'resident', method: 'doc_upload' });
    expect(second.status).toBe(200);
    expect(second.body.claim.id).toBe(first.body.claim.id);
    expect(getTable('HomeOwnershipClaim')).toHaveLength(1);
  });

  it('an OWNER claim still runs the rental firewall', async () => {
    seedRental();
    const res = await request(app()).post(`/api/homes/${HOME}/ownership-claims`).set('x-test-user-id', RENTER).send({ claim_type: 'owner', method: 'doc_upload' });
    expect(res.status).toBe(200); // opaque
    expect(policy.evaluateRentalFirewall).toHaveBeenCalled();
    expect(getTable('HomeOwnershipClaim')).toHaveLength(0);
  });
});
