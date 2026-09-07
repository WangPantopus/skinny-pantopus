/** Keep hosted staging on production security defaults with sandbox vendors. */
function validateStagingRuntime(env = process.env) {
  if (env.APP_ENV !== 'staging') return;

  const required = [
    ['NODE_ENV', (value) => value === 'production', 'production'],
    ['LOB_ENV', (value) => value === 'test', 'test'],
    // Lob uses the API key, not LOB_ENV, to decide whether to mail a postcard.
    ['LOB_API_KEY', (value) => /^test_.+/.test(value || ''), 'a Lob test key'],
    ['STRIPE_SECRET_KEY', (value) => /^(sk|rk)_test_.+/.test(value || ''), 'a Stripe test key'],
  ];
  for (const [name, valid, expected] of required) {
    if (!valid(env[name])) {
      throw new Error(`Staging configuration requires ${name} to be ${expected}.`);
    }
  }
}

module.exports = { validateStagingRuntime };
