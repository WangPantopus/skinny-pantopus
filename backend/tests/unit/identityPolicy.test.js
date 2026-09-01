const { canPostWithIdentityToAudience } = require('../../utils/identityPolicy');

describe('identity audience policy', () => {
  test('allows Audience Profile posts only to audience-safe surfaces', () => {
    expect(canPostWithIdentityToAudience({ identityType: 'persona', audience: 'followers' })).toEqual({
      allowed: true,
    });
    expect(canPostWithIdentityToAudience({ identityType: 'persona', audience: 'public' })).toEqual({
      allowed: true,
    });

    for (const audience of ['nearby', 'neighborhood', 'household', 'connections', 'target_area']) {
      const result = canPostWithIdentityToAudience({ identityType: 'persona', audience });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Beacon/i);
    }
  });

  test('does not let local, home, or business identities target persona followers by accident', () => {
    for (const identityType of ['local', 'personal', 'home', 'business']) {
      const result = canPostWithIdentityToAudience({ identityType, audience: 'persona_followers' });
      expect(result.allowed).toBe(false);
    }
  });

  test('keeps home and business identity rules narrow', () => {
    expect(canPostWithIdentityToAudience({ identityType: 'home', audience: 'household' }).allowed).toBe(true);
    expect(canPostWithIdentityToAudience({ identityType: 'home', audience: 'neighborhood' }).allowed).toBe(true);
    expect(canPostWithIdentityToAudience({ identityType: 'home', audience: 'followers' }).allowed).toBe(false);

    expect(canPostWithIdentityToAudience({ identityType: 'business', audience: 'followers' }).allowed).toBe(false);
    expect(canPostWithIdentityToAudience({ identityType: 'business', audience: 'target_area' }).allowed).toBe(true);
    expect(canPostWithIdentityToAudience({ identityType: 'business', audience: 'public' }).allowed).toBe(true);
    expect(canPostWithIdentityToAudience({ identityType: 'business', audience: 'household' }).allowed).toBe(false);
  });
});
