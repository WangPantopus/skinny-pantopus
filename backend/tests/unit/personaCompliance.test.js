const {
  assertPersonaCategoryEnabled,
  getPersonaCategoryPolicies,
  getPersonaCategoryPolicy,
} = require('../../utils/personaCompliance');

describe('persona compliance policy', () => {
  test('keeps low-risk categories enabled by default', () => {
    expect(assertPersonaCategoryEnabled('creator', {})).toMatchObject({
      allowed: true,
      policy: {
        category: 'creator',
        sensitive: false,
        enabled: true,
      },
    });
  });

  test('gates sensitive professional categories until compliance controls are enabled', () => {
    expect(assertPersonaCategoryEnabled('doctor', {})).toMatchObject({
      allowed: false,
      code: 'SENSITIVE_PERSONA_CATEGORY_GATED',
      policy: {
        category: 'doctor',
        sensitive: true,
        enabled: false,
        requirements: expect.arrayContaining(['credential_verification', 'organization_review', 'consent_controls']),
      },
    });
  });

  test('reports the future safeguards needed for student-facing categories', () => {
    expect(getPersonaCategoryPolicy('teacher', {})).toMatchObject({
      sensitive: true,
      requirements: expect.arrayContaining(['credential_verification', 'organization_review', 'consent_controls', 'minor_safeguards']),
      defaultAudienceMode: 'approval_required',
    });
  });

  test('can enable sensitive categories explicitly through environment policy', () => {
    expect(assertPersonaCategoryEnabled('tutor', { PERSONA_SENSITIVE_CATEGORIES_ENABLED: 'true' })).toMatchObject({
      allowed: true,
      policy: {
        category: 'tutor',
        enabled: true,
      },
    });
  });

  test('returns a complete category policy catalog for clients and admin tools', () => {
    const categories = getPersonaCategoryPolicies({});
    expect(categories.map((category) => category.category)).toEqual(expect.arrayContaining([
      'creator',
      'coach',
      'doctor',
      'teacher',
      'tutor',
    ]));
  });
});
