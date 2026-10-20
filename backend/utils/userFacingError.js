/**
 * Mark an error whose message is fixed copy written for people ("Could not
 * check Home access. Please retry.").
 *
 * In production app.js answers every other server error (5xx) with "Internal
 * server error": driver and provider errors (Postgres, Supabase, Stripe) carry
 * their own text, and SDK errors carry their own statusCode too (a Stripe 503
 * is still Stripe's text), so neither the message nor the status says an
 * error is safe to show. app.js keeps a marked error's message and code.
 *
 * The mark is a non-enumerable symbol: no library error carries it, and
 * copying an error's fields drops it. Mark only errors built in the app with
 * a literal message, never one that passes on another error's text. This
 * module has no dependencies so any helper can use it.
 */
const USER_FACING = Symbol.for('pantopus.userFacingError');

const userFacing = (err) => Object.defineProperty(err, USER_FACING, { value: true });

const isUserFacing = (err) => Boolean(err) && err[USER_FACING] === true;

module.exports = { userFacing, isUserFacing };
