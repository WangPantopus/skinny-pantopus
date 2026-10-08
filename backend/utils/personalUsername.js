/**
 * A person's username: the made-up one the server gives every new account, and the rules for one they choose.
 *
 * The username is the address of the person's profile (pantopus.com/<username>) and of their Local Profile handle.
 * Nobody picks one at sign-up, so the server makes one up that says nothing about the person. A made-up username
 * never stands in for a name: name helpers skip it and show the person's name or a neutral label instead.
 */
const { randomBytes } = require('crypto');
const { RESERVED_USERNAMES } = require('./businessConstants');

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;

// user_ plus 12 random hex characters, or 20 when the short form keeps colliding (see generateAvailableUsername).
const GENERATED_USERNAME_PATTERN = /^user_(?:[0-9a-f]{12}|[0-9a-f]{20})$/;

// The web app answers these paths itself, so a profile with one of them as its username could never be opened at
// pantopus.com/<username>. Plus words that would read as the app speaking.
const PERSONAL_RESERVED_USERNAMES = new Set([
  ...RESERVED_USERNAMES,
  'about', 'api', 'app', 'auth', 'b', 'book', 'booking', 'contact', 'dashboard', 'dev', 'gig', 'gigs', 'guest',
  'homes', 'invite', 'join', 'listing', 'listings', 'login', 'marketplace', 'persona', 'poll', 'post', 'posts',
  'privacy', 'profile', 'register', 'session', 'shared', 'start', 'status', 'terms', 'u', 'unlisted',
  'local', 'me', 'you', 'user', 'users', 'www', 'root', 'null', 'undefined', 'system', 'staff', 'official',
  'moderator', 'everyone', 'anonymous', 'neighbor', 'neighbors', 'household', 'place', 'today', 'nearby',
]);

function buildGeneratedUsername(bytes = 6) {
  return `user_${randomBytes(bytes).toString('hex')}`;
}

/** True for a username the server made up (user_ plus random hex), never for one a person chose. */
function isGeneratedUsername(value) {
  return GENERATED_USERNAME_PATTERN.test(String(value || '').trim());
}

/**
 * Until October 7, 2026 the made-up username was the first part of the email address plus six hex characters
 * (jane.doe@… became janedoe_ab12cd). Only the account's own email address tells those apart from a chosen one, so
 * this is for the owner's own profile, never for showing other people.
 */
function isEmailDerivedUsername(username, email) {
  const value = String(username || '');
  const emailPrefix = String(email || '').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user';
  return value.length === emailPrefix.length + 7
    && value.startsWith(`${emailPrefix}_`)
    && /^[0-9a-f]{6}$/.test(value.slice(emailPrefix.length + 1));
}

/** The owner's own check: a username the server made up, in either the current or the pre-October-7 form. */
function isMadeUpUsername(username, email) {
  return isGeneratedUsername(username) || (Boolean(email) && isEmailDerivedUsername(username, email));
}

/** A username as a person types it: no surrounding spaces, no leading @, lowercase. */
function normalizePersonalUsername(value) {
  return String(value ?? '').trim().replace(/^@+/, '').toLowerCase();
}

/**
 * Why a normalized username can't be chosen: 'invalid' (length or characters), 'reserved' (an app path, an app
 * word, or the made-up user_ form), or null when it is fine to check for availability.
 */
function personalUsernameProblem(normalized) {
  if (
    normalized.length < USERNAME_MIN_LENGTH
    || normalized.length > USERNAME_MAX_LENGTH
    || !/^[a-z0-9_]+$/.test(normalized)
  ) return 'invalid';
  if (PERSONAL_RESERVED_USERNAMES.has(normalized) || normalized.startsWith('user_')) return 'reserved';
  return null;
}

/** The name-slot fallback: a username only when the person chose it. */
function chosenUsernameOrNull(value) {
  const text = String(value || '').trim();
  return text && !isGeneratedUsername(text) ? text : null;
}

/**
 * A name some SQL already resolved with `coalesce(name, first_name, username, …)`: the made-up username it may have
 * landed on becomes `fallback` instead.
 */
function nameUnlessMadeUp(value, fallback) {
  return isGeneratedUsername(value) ? fallback : value;
}

module.exports = {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  GENERATED_USERNAME_PATTERN,
  buildGeneratedUsername,
  isGeneratedUsername,
  isEmailDerivedUsername,
  isMadeUpUsername,
  normalizePersonalUsername,
  personalUsernameProblem,
  chosenUsernameOrNull,
  nameUnlessMadeUp,
};
