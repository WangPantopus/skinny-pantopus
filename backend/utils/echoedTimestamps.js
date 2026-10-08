// Android rewrites every UTC timestamp in API responses from "+00:00" to "Z" (its
// UtcTimestampInterceptor: java.time on Android 8-13 parses only Z), so frozen terms the app
// echoes back (a tip's ownerConfirmedAt, a stop's acceptedAt) arrive in that form. Those terms
// are compared as text with the ones PostgreSQL wrote, so a timestamp in Android's form is put
// back in the server's: exactly the inverse of the interceptor, a full timestamp ending in Z
// with its digits kept. Any other value passes through unchanged.
const ANDROID_UTC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?)Z$/;

function serverUtcForm(value) {
  if (typeof value !== 'string') return value;
  const match = ANDROID_UTC.exec(value);
  return match ? `${match[1]}+00:00` : value;
}

module.exports = { serverUtcForm };
