const { compareParcelIntelligence } = require('../../services/addressValidation/parcelShadowComparison');

describe('compareParcelIntelligence', () => {
  test('flags commercial heuristic vs institutional parcel usage as a disagreement', () => {
    const result = compareParcelIntelligence(
      { parcel_type: 'commercial', building_type: 'commercial' },
      null,
      {
        usage_class: 'institutional',
        residential_unit_count: 0,
        non_residential_unit_count: 1,
      },
    );

    expect(result.disagrees).toBe(true);
    expect(result.disagreement_reasons).toContain('usage_class_mismatch');
  });

  test('flags heuristic mixed-use vs clear residential parcel usage as a disagreement', () => {
    const result = compareParcelIntelligence(
      { parcel_type: 'mixed', building_type: 'mixed_use' },
      null,
      {
        usage_class: 'residential',
        residential_unit_count: 12,
        non_residential_unit_count: 0,
      },
    );

    expect(result.disagrees).toBe(true);
    expect(result.disagreement_reasons).toEqual(expect.arrayContaining([
      'usage_class_mismatch',
      'mixed_use_mismatch',
      'building_use_mismatch',
    ]));
  });

  test('flags residential building shapes that conflict with parcel mixed-use counts', () => {
    const result = compareParcelIntelligence(
      { parcel_type: 'residential', building_type: 'single_family' },
      { primary_type: 'premise' },
      {
        usage_class: 'mixed',
        residential_unit_count: 4,
        non_residential_unit_count: 1,
      },
    );

    expect(result.disagrees).toBe(true);
    expect(result.disagreement_reasons).toEqual(expect.arrayContaining([
      'usage_class_mismatch',
      'mixed_use_mismatch',
      'residential_unit_count_mismatch',
      'building_use_mismatch',
    ]));
  });

  test('returns no disagreement when parcel signals align with heuristic residential classification', () => {
    const result = compareParcelIntelligence(
      { parcel_type: 'residential', building_type: 'multi_unit' },
      null,
      {
        usage_class: 'residential',
        residential_unit_count: 8,
        non_residential_unit_count: 0,
      },
    );

    expect(result.disagrees).toBe(false);
    expect(result.disagreement_reasons).toEqual([]);
  });
});
