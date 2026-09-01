const ORIGINAL_ENV = {
  APP_ENV: process.env.APP_ENV,
  NODE_ENV: process.env.NODE_ENV,
  IDENTITY_FIREWALL_ENABLED: process.env.IDENTITY_FIREWALL_ENABLED,
  PERSONA_ENABLED: process.env.PERSONA_ENABLED,
  PERSONA_BROADCAST_ENABLED: process.env.PERSONA_BROADCAST_ENABLED,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}

function loadFeatureFlags(env = {}) {
  restoreEnv();
  delete process.env.IDENTITY_FIREWALL_ENABLED;
  delete process.env.PERSONA_ENABLED;
  delete process.env.PERSONA_BROADCAST_ENABLED;
  Object.assign(process.env, env);
  jest.resetModules();
  return require('../../utils/featureFlags');
}

afterEach(() => {
  restoreEnv();
  jest.resetModules();
});

describe('identity feature env gates', () => {
  test('defaults Beacon-related backend gates on in production without setup env', () => {
    const flags = loadFeatureFlags({ NODE_ENV: 'production' });

    expect(flags.isIdentityFirewallEnabled()).toBe(true);
    expect(flags.isPersonaEnabled()).toBe(true);
    expect(flags.isPersonaBroadcastEnabled()).toBe(true);
  });

  test.each(['0', 'false', 'off', 'disabled'])('honors %s as an identity kill switch', (disabledValue) => {
    const flags = loadFeatureFlags({
      NODE_ENV: 'production',
      IDENTITY_FIREWALL_ENABLED: disabledValue,
      PERSONA_ENABLED: 'true',
      PERSONA_BROADCAST_ENABLED: 'true',
    });

    expect(flags.isIdentityFirewallEnabled()).toBe(false);
    expect(flags.isPersonaEnabled()).toBe(false);
    expect(flags.isPersonaBroadcastEnabled()).toBe(false);
  });

  test('keeps child features off when their parent gate is explicitly disabled', () => {
    let flags = loadFeatureFlags({
      NODE_ENV: 'production',
      IDENTITY_FIREWALL_ENABLED: 'true',
      PERSONA_ENABLED: 'false',
      PERSONA_BROADCAST_ENABLED: 'true',
    });

    expect(flags.isIdentityFirewallEnabled()).toBe(true);
    expect(flags.isPersonaEnabled()).toBe(false);
    expect(flags.isPersonaBroadcastEnabled()).toBe(false);

    flags = loadFeatureFlags({
      NODE_ENV: 'production',
      IDENTITY_FIREWALL_ENABLED: 'true',
      PERSONA_ENABLED: 'true',
      PERSONA_BROADCAST_ENABLED: 'false',
    });

    expect(flags.isIdentityFirewallEnabled()).toBe(true);
    expect(flags.isPersonaEnabled()).toBe(true);
    expect(flags.isPersonaBroadcastEnabled()).toBe(false);
  });
});
