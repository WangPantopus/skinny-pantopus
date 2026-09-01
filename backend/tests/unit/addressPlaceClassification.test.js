const { derivePlaceClassification } = require('../../services/addressValidation/pipelineService');

function makeGoogle(overrides = {}) {
  return {
    normalized: {
      line1: '123 Main St',
      line2: undefined,
      city: 'Portland',
      state: 'OR',
      zip: '97201',
    },
    components: {
      route: { text: 'Main Street' },
    },
    ...overrides,
  };
}

function makeSmarty(overrides = {}) {
  return {
    rdi_type: 'unknown',
    dpv_match_code: 'Y',
    missing_secondary: false,
    commercial_mailbox: false,
    ...overrides,
  };
}

describe('derivePlaceClassification', () => {
  test('marks named institutions as commercial', () => {
    const result = derivePlaceClassification(
      {
        line1: 'Roosevelt High School',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
      },
      makeGoogle(),
      makeSmarty({ rdi_type: 'unknown' }),
    );

    expect(result.google_place_types).toContain('school');
    expect(result.parcel_type).toBe('commercial');
    expect(result.building_type).toBe('commercial');
  });

  test('marks venues as commercial when the input is a named place', () => {
    const result = derivePlaceClassification(
      {
        line1: 'Veterans Memorial Coliseum',
        city: 'Portland',
        state: 'OR',
        zip: '97227',
      },
      makeGoogle(),
      makeSmarty({ rdi_type: 'unknown' }),
    );

    expect(result.google_place_types).toContain('stadium');
    expect(result.google_place_types).toContain('establishment');
    expect(result.parcel_type).toBe('commercial');
  });

  test('does not treat street names like University Avenue as institutions', () => {
    const result = derivePlaceClassification(
      {
        line1: '123 University Ave',
        city: 'Berkeley',
        state: 'CA',
        zip: '94704',
      },
      makeGoogle({
        normalized: {
          line1: '123 University Avenue',
          city: 'Berkeley',
          state: 'CA',
          zip: '94704',
        },
        components: {
          route: { text: 'University Avenue' },
        },
      }),
      makeSmarty({ rdi_type: 'unknown' }),
    );

    expect(result.google_place_types).not.toContain('university');
    expect(result.parcel_type).toBe('unknown');
    expect(result.building_type).toBe('unknown');
  });

  test('does not treat bare street names without suffix as institutions', () => {
    const result = derivePlaceClassification(
      {
        line1: '1000 University',
        city: 'Berkeley',
        state: 'CA',
        zip: '94704',
      },
      makeGoogle({
        normalized: {
          line1: '1000 University Avenue',
          city: 'Berkeley',
          state: 'CA',
          zip: '94704',
        },
        components: {
          route: { text: 'University Avenue' },
        },
      }),
      makeSmarty({ rdi_type: 'unknown' }),
    );

    expect(result.google_place_types).not.toContain('university');
    expect(result.parcel_type).toBe('unknown');
    expect(result.building_type).toBe('unknown');
  });

  test('does not treat street names like Church Street as institutions', () => {
    const result = derivePlaceClassification(
      {
        line1: '50 Church St',
        city: 'Burlington',
        state: 'VT',
        zip: '05401',
      },
      makeGoogle({
        normalized: {
          line1: '50 Church Street',
          city: 'Burlington',
          state: 'VT',
          zip: '05401',
        },
        components: {
          route: { text: 'Church Street' },
        },
      }),
      makeSmarty({ rdi_type: 'unknown' }),
    );

    expect(result.google_place_types).not.toContain('church');
    expect(result.parcel_type).toBe('unknown');
  });
});
