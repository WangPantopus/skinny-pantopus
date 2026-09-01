jest.mock('../../config/supabaseAdmin', () => jest.requireActual('../__mocks__/supabaseAdmin'));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const service = require('../../services/homeClaimCompatService');

describe('homeClaimCompatService', () => {
  describe('deriveInitialClaimExpiresAt', () => {
    test('returns an expiry deadline for initiated claims', () => {
      const now = new Date('2026-04-04T00:00:00.000Z');
      expect(service.deriveInitialClaimExpiresAt('draft', now)).toBe('2026-04-11T00:00:00.000Z');
    });

    test('does not add an expiry deadline for non-initiated claims', () => {
      const now = new Date('2026-04-04T00:00:00.000Z');
      expect(service.deriveInitialClaimExpiresAt('submitted', now)).toBeNull();
    });
  });

  describe('buildInitialClaimCompatibilityFields', () => {
    test('includes expires_at when a claim starts in the initiated phase', async () => {
      const fields = await service.buildInitialClaimCompatibilityFields({
        homeId: 'home-1',
        userId: 'user-1',
        claimType: 'owner',
        method: 'doc_upload',
        legacyState: 'draft',
        routingClassification: 'standalone_claim',
      });

      expect(fields.claim_phase_v2).toBe('initiated');
      expect(fields.expires_at).toBeTruthy();
    });

    test('keeps expires_at null for non-initiated claims', async () => {
      const fields = await service.buildInitialClaimCompatibilityFields({
        homeId: 'home-1',
        userId: 'user-1',
        claimType: 'owner',
        method: 'doc_upload',
        legacyState: 'submitted',
        routingClassification: 'standalone_claim',
      });

      expect(fields.claim_phase_v2).toBe('evidence_submitted');
      expect(fields.expires_at).toBeNull();
    });
  });
});
