const decisionEngine = require('../../services/addressValidation/addressDecisionEngine');
const { addressVerificationGroundTruthCorpus } = require('../fixtures/addressVerificationGroundTruthCorpus');

describe('addressVerificationGroundTruthCorpus', () => {
  test('covers the required address categories', () => {
    const categories = new Set(addressVerificationGroundTruthCorpus.map((fixture) => fixture.category));

    expect(categories).toEqual(new Set([
      'valid_single_family_home',
      'apartment_with_unit',
      'apartment_missing_unit',
      'condo',
      'mixed_use_address',
      'office',
      'school',
      'church',
      'hospital',
      'stadium_or_arena',
      'warehouse_or_factory',
      'mall_or_shopping_center',
      'government_building',
      'hotel_or_lodging',
    ]));
  });

  test.each(
    addressVerificationGroundTruthCorpus.filter((fixture) => !fixture.classificationOnly),
  )('matches expected verdict for $key', (fixture) => {
    const verdict = decisionEngine.classify(fixture.decisionInput);
    expect(verdict.status).toBe(fixture.expectedStatus);
  });

  test.each(
    addressVerificationGroundTruthCorpus.filter((fixture) => fixture.classificationOnly),
  )('keeps $key as a classification-only corpus fixture', (fixture) => {
    const verdict = decisionEngine.classify(fixture.decisionInput);
    expect(fixture.classificationOnly).toBe(true);
    expect(verdict.status).toBeDefined();
  });
});
