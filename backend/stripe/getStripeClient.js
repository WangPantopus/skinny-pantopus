/**
 * Normalize Stripe SDK import shape across Node/Jest environments.
 *
 * Depending on runtime + module interop, `require('stripe')` can resolve to:
 * - a constructor function (common CJS)
 * - an object namespace with `.default` constructor
 * - an already-instantiated mock client object in tests
 */
function getStripeClient() {
  const stripeModule = require('stripe');

  // Test environments may provide an already-instantiated mock client object.
  if (
    stripeModule &&
    typeof stripeModule === 'object' &&
    (
      typeof stripeModule.transfers?.create === 'function' ||
      typeof stripeModule.paymentIntents?.create === 'function' ||
      typeof stripeModule.accounts?.create === 'function' ||
      typeof stripeModule.webhooks?.constructEvent === 'function'
    )
  ) {
    return stripeModule;
  }

  const stripeCtor =
    typeof stripeModule === 'function'
      ? stripeModule
      : stripeModule?.default;

  if (typeof stripeCtor !== 'function') {
    throw new TypeError('Stripe SDK module did not export a constructor');
  }

  // A provider-free local server still imports routes that hold a Stripe
  // client. Delay construction there, without inventing credentials or a
  // provider response: SDK access still invokes the real constructor and
  // refuses the missing key. Configured and hosted startup is unchanged.
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.APP_ENV === 'local' &&
    !process.env.STRIPE_SECRET_KEY
  ) {
    let client;
    return new Proxy({}, {
      get(_target, property) {
        if (!client) client = stripeCtor(process.env.STRIPE_SECRET_KEY);
        const value = Reflect.get(client, property, client);
        return typeof value === 'function' ? value.bind(client) : value;
      },
    });
  }

  return stripeCtor(process.env.STRIPE_SECRET_KEY);
}

module.exports = { getStripeClient };

