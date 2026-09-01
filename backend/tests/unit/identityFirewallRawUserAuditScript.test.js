const {
  DEFAULT_FORBIDDEN_KEYS,
  buildEndpoints,
  normalizeKey,
  scan,
} = require('../../scripts/identity-firewall-raw-user-audit');
const {
  resolvePresetEnv,
} = require('../../scripts/identity-firewall-live-audit-preset');

function scanPayload(payload, allowedKeys = []) {
  const findings = [];
  scan(payload, '$', {
    forbiddenKeys: DEFAULT_FORBIDDEN_KEYS,
    allowedKeys: new Set(allowedKeys.flatMap((key) => [key, normalizeKey(key)])),
    forbiddenValues: ['private@example.test', 'Legal Secret'],
  }, findings);
  return findings;
}

describe('Identity Firewall raw-user audit script', () => {
  test('normalizes camelCase private keys before scanning', () => {
    expect(normalizeKey('authorUserId')).toBe('author_user_id');
    expect(normalizeKey('phoneNumber')).toBe('phone_number');

    const findings = scanPayload({
      post: {
        id: 'post-1',
        authorUserId: 'private-user-id',
        author: {
          type: 'persona',
          id: 'persona-1',
          displayName: 'Maya Builds',
        },
      },
    });

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: '$.post.authorUserId',
        type: 'forbidden_key',
        normalizedKey: 'author_user_id',
      }),
    ]));
  });

  test('rejects configured private values anywhere in the payload', () => {
    const findings = scanPayload({
      persona: {
        displayName: 'Legal Secret',
        publicLinks: [{ label: 'Website', url: 'https://example.test' }],
      },
    });

    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: '$.persona.displayName',
        type: 'forbidden_value',
        value: 'Legal Secret',
      }),
    ]));
  });

  test('keeps typed public author objects valid while rejecting raw user ids', () => {
    const findings = scanPayload({
      post: {
        id: 'post-1',
        author: {
          type: 'local',
          id: 'local-profile-1',
          handle: 'riverhome',
          displayName: 'RiverHome',
        },
      },
    });

    expect(findings).toEqual([]);
  });

  test('builds the expected public endpoint contract from handles and ids', () => {
    expect(buildEndpoints({
      IDENTITY_FIREWALL_AUDIT_LOCAL_HANDLE: 'riverhome',
      IDENTITY_FIREWALL_AUDIT_PERSONA_HANDLE: '@mayabuilds',
      IDENTITY_FIREWALL_AUDIT_POST_ID: 'post-1',
      IDENTITY_FIREWALL_AUDIT_ENDPOINTS: '/api/comments/post-1',
    })).toEqual([
      '/api/local-profiles/riverhome',
      '/api/local-profiles/riverhome/activity',
      '/api/local-profiles/riverhome/gigs',
      '/api/local-profiles/riverhome/listings',
      '/api/personas/mayabuilds',
      '/api/personas/mayabuilds/posts',
      '/api/posts/post-1',
      '/api/comments/post-1',
    ]);
  });

  test('seed preset resolves standard handles and private seed values', () => {
    const env = resolvePresetEnv({
      IDENTITY_FIREWALL_AUDIT_PRESET_PREFIX: 'IFW Demo',
      IDENTITY_FIREWALL_FORBIDDEN_VALUES: 'existing-secret',
    });

    expect(env.IDENTITY_FIREWALL_AUDIT_LOCAL_HANDLE).toBe('ifw_demo_local');
    expect(env.IDENTITY_FIREWALL_AUDIT_PERSONA_HANDLE).toBe('ifw_demo_audience');
    expect(env.IDENTITY_FIREWALL_FORBIDDEN_VALUES).toContain('existing-secret');
    expect(env.IDENTITY_FIREWALL_FORBIDDEN_VALUES).toContain('ifw_demo_owner@example.test');
    expect(env.IDENTITY_FIREWALL_FORBIDDEN_VALUES).toContain('Identity Owner');
  });
});
