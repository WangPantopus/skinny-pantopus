const { validateStagingRuntime } = require('../../config/stagingRuntime');

const staging = {
  APP_ENV: 'staging',
  NODE_ENV: 'production',
  LOB_ENV: 'test',
  LOB_API_KEY: 'test_synthetic',
  STRIPE_SECRET_KEY: 'sk_test_synthetic',
  GOOGLE_ADDRESS_VALIDATION_API_KEY: 'synthetic',
  SMARTY_AUTH_ID: 'synthetic',
  SMARTY_AUTH_TOKEN: 'synthetic',
  LOB_WEBHOOK_SECRET: 'synthetic',
};

describe('hosted staging runtime', () => {
  test('allows production runtime security with sandbox vendors', () => {
    expect(() => validateStagingRuntime(staging)).not.toThrow();
    expect(() => validateStagingRuntime({ ...staging, STRIPE_SECRET_KEY: 'rk_test_synthetic' })).not.toThrow();
  });

  test.each([
    ['NODE_ENV', 'development'],
    ['NODE_ENV', undefined],
    ['LOB_ENV', 'live'],
    ['LOB_ENV', undefined],
    ['LOB_API_KEY', 'live_sensitive_value'],
    ['LOB_API_KEY', undefined],
    ['STRIPE_SECRET_KEY', 'sk_live_sensitive_value'],
    ['STRIPE_SECRET_KEY', 'rk_live_sensitive_value'],
    ['STRIPE_SECRET_KEY', undefined],
  ])('rejects unsafe or missing %s without exposing its value', (name, value) => {
    const check = () => validateStagingRuntime({ ...staging, [name]: value });
    expect(check).toThrow(name);
    try { check(); } catch (error) {
      expect(error.message).not.toContain('sensitive_value');
    }
  });

  test('leaves existing non-staging startup requirements to their validators', () => {
    expect(() => validateStagingRuntime({ APP_ENV: 'production' })).not.toThrow();
    expect(() => validateStagingRuntime({ NODE_ENV: 'development' })).not.toThrow();
  });
});

describe('address verification startup', () => {
  const originalEnv = process.env;
  let exit;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...staging };
    exit = jest.spyOn(process, 'exit').mockImplementation(() => { throw new Error('startup refused'); });
  });

  afterEach(() => {
    process.env = originalEnv;
    exit.mockRestore();
  });

  test('boots staging with test mail while retaining NODE_ENV=production', () => {
    expect(() => require('../../config/addressVerification').validate()).not.toThrow();
    expect(process.env.NODE_ENV).toBe('production');
    expect(exit).not.toHaveBeenCalled();
  });

  test('still rejects test mail in production', () => {
    process.env.APP_ENV = 'production';
    expect(() => require('../../config/addressVerification').validate()).toThrow('startup refused');
    expect(exit).toHaveBeenCalledWith(1);
  });

  test.each(['LOB_WEBHOOK_SECRET', 'GOOGLE_ADDRESS_VALIDATION_API_KEY', 'SMARTY_AUTH_TOKEN'])(
    'still requires %s in hosted staging', (name) => {
      delete process.env[name];
      expect(() => require('../../config/addressVerification').validate()).toThrow('startup refused');
    },
  );
});

describe('provider-free local Stripe startup', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.unmock('stripe');
    process.env = { ...originalEnv, NODE_ENV: 'development', APP_ENV: 'local' };
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.unmock('stripe');
  });

  test('allows local route imports but still refuses an unconfigured SDK access', () => {
    const { getStripeClient } = require('../../stripe/getStripeClient');
    const client = getStripeClient();
    expect(() => client.paymentIntents).toThrow('Neither apiKey nor config.authenticator provided');
  });

  test.each([
    ['production', 'local'],
    ['production', 'staging'],
    ['development', 'development'],
  ])('retains missing-key startup refusal for %s / %s', (nodeEnv, appEnv) => {
    process.env.NODE_ENV = nodeEnv;
    process.env.APP_ENV = appEnv;
    const { getStripeClient } = require('../../stripe/getStripeClient');
    expect(() => getStripeClient()).toThrow('Neither apiKey nor config.authenticator provided');
  });

  test.each(['constructor', 'namespace'])('preserves the configured %s SDK import contract', (shape) => {
    const client = {};
    const constructor = jest.fn(() => client);
    jest.doMock('stripe', () => shape === 'constructor' ? constructor : { default: constructor });
    process.env.STRIPE_SECRET_KEY = staging.STRIPE_SECRET_KEY;
    const { getStripeClient } = require('../../stripe/getStripeClient');
    expect(getStripeClient()).toBe(client);
    expect(constructor).toHaveBeenCalledWith(staging.STRIPE_SECRET_KEY);
    expect(constructor).toHaveBeenCalledTimes(1);
  });

  test('preserves an existing instantiated test client', () => {
    const client = { webhooks: { constructEvent: jest.fn() } };
    jest.doMock('stripe', () => client);
    const { getStripeClient } = require('../../stripe/getStripeClient');
    expect(getStripeClient()).toBe(client);
    expect(client.webhooks.constructEvent).not.toHaveBeenCalled();
  });
});
