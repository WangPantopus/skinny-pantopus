'use strict';

// Pulse, reinvented, phase 5: filters on the list and the map (coord CONTRACT 10a, PHASE-5 piece B). Several kinds at
// once, when, from (everyone or connections), state (unanswered Asks, plans with room) and since (new since the last
// visit). All optional and additive: a request that sends none of them is answered exactly as before, and today's single
// `chip` keeps working. Heads-ups always come with any filter. Nothing here decides who may see what: it only narrows
// what today's reads already let the reader see.

const { DateTime } = require('luxon');
const { SYSTEM_ACCOUNT_ID } = require('../penName/owner');

const KINDS = ['live', 'learn', 'spots', 'ask', 'plans', 'sports'];
const WHENS = ['now', 'today', 'tonight', 'weekend'];
const FROMS = ['everyone', 'connections'];
const STATES = ['unanswered', 'room'];
const FIELDS = ['kinds', 'when', 'from', 'state', 'since'];
const FALLBACK_ZONE = 'America/Los_Angeles';

function fail(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

/** A comma list of names from `allowed`, each once, or throws `code`. */
function names(raw, allowed, what, code) {
  const list = String(raw).split(',').map((part) => part.trim()).filter(Boolean);
  if (!list.length || list.some((name) => !allowed.includes(name)) || new Set(list).size !== list.length) {
    throw fail(400, code, `${what} takes ${allowed.join(', ')}, each once.`);
  }
  return [...list].sort((a, b) => allowed.indexOf(a) - allowed.indexOf(b));
}

/**
 * The filters a request sent, normalised, or null when it sent none (CONTRACT 10a). `query` is the raw query; `forMap`:
 * the map takes no `when` (its `time` row is the When). `code` is the route's own 400 code.
 */
function parse(query, { forMap = false, code = 'LIST_INVALID' } = {}) {
  const q = query || {};
  if (!FIELDS.some((field) => q[field] != null && q[field] !== '')) return null;
  if (!forMap && q.kinds != null && q.chip != null && q.chip !== '') {
    throw fail(400, code, 'Choose kinds or a chip, not both.');
  }
  if (forMap && q.when != null && q.when !== '') throw fail(400, code, 'The map takes its time row as its when.');
  const out = { kinds: null, when: null, from: null, state: null, since: null };
  if (q.kinds != null && q.kinds !== '') out.kinds = names(q.kinds, KINDS, 'kinds', code);
  if (q.when != null && q.when !== '') {
    if (!WHENS.includes(String(q.when))) throw fail(400, code, `when takes ${WHENS.join(', ')}.`);
    out.when = String(q.when);
  }
  if (q.from != null && q.from !== '') {
    if (!FROMS.includes(String(q.from))) throw fail(400, code, `from takes ${FROMS.join(' or ')}.`);
    out.from = String(q.from);
  }
  if (q.state != null && q.state !== '') out.state = names(q.state, STATES, 'state', code);
  if (q.since != null && q.since !== '') {
    const at = Date.parse(String(q.since));
    if (!Number.isFinite(at) || String(q.since).length > 40) throw fail(400, code, 'since takes an ISO time.');
    out.since = new Date(at).toISOString();
  }
  return out;
}

/** A short, stable form of the filters for the list's cursor: a next page with other filters is refused. */
function signature(filters) {
  if (!filters) return null;
  return [filters.kinds?.join('+') || '', filters.when || '', filters.from || '', filters.state?.join('+') || '', filters.since || '']
    .join('|');
}

/** The windows `when` means at a place (ms): today from midnight, tonight from 5 pm, the weekend's Saturday and Sunday. */
function windowsAt(zone, now = Date.now()) {
  const here = DateTime.fromMillis(now, { zone: zone || FALLBACK_ZONE });
  const midnight = here.startOf('day');
  const endOfDay = here.endOf('day');
  // The weekend under way, or the coming one: Saturday 00:00 to Sunday's end.
  const saturday = here.weekday === 7 ? midnight.minus({ days: 1 }) : midnight.plus({ days: (6 - here.weekday + 7) % 7 });
  return {
    today: { from: midnight.toMillis(), to: endOfDay.toMillis() },
    tonight: { from: midnight.set({ hour: 17 }).toMillis(), to: endOfDay.toMillis() },
    weekend: { from: saturday.toMillis(), to: saturday.plus({ days: 1 }).endOf('day').toMillis() },
  };
}

/** An Event post's time: its date to its end (its date alone when it has none), in ms; null when it has none. */
function eventSpan(post) {
  const start = Date.parse(post?.event_date || '');
  if (!Number.isFinite(start)) return null;
  const end = Date.parse(post?.event_end_date || '');
  return { start, end: Number.isFinite(end) && end >= start ? end : start };
}

/**
 * The tests one request's filters make (CONTRACT 10a), given what the reader's reads know: `chips` (list.js's CHIPS),
 * `people` (a Set of the reader's own id and their connections' ids, needed only for `from=connections`) and `zone` (the
 * place's time zone, for `when`). Returns { moments, post(post), moment(row, shownAt) }:
 * - `moments`: whether any Moment can be in the answer;
 * - `post(post)`: whether a post is in (a Heads-up always is);
 * - `moment(row, shownAt)`: whether a Moment is in.
 */
function testsFor(filters, { chips, people = null, zone = null, now = Date.now(), forMap = false }) {
  const since = filters.since ? Date.parse(filters.since) : null;
  const windows = filters.when && filters.when !== 'now' ? windowsAt(zone, now) : null;
  const byPerson = (userId) => {
    if (filters.from !== 'connections') return true;
    const id = String(userId || '');
    return id !== SYSTEM_ACCOUNT_ID && Boolean(people?.has(id));
  };
  const inChip = (name, post) => {
    const shape = chips[name]?.posts;
    if (!shape) return false;
    if (shape.postTypes && !shape.postTypes.includes(post.post_type)) return false;
    return !shape.keep || shape.keep(post);
  };
  const kindsWantPosts = !filters.kinds || filters.kinds.some((name) => chips[name]?.posts);
  const momentsAllowed = (!filters.kinds || filters.kinds.includes('live')) && !filters.state
    && !(filters.when === 'tonight' || filters.when === 'weekend');

  const post = (p) => {
    if (!p) return false;
    if (p.post_type === 'alert') return true;
    if (!kindsWantPosts) return false;
    if (filters.kinds && !filters.kinds.some((name) => inChip(name, p))) return false;
    if (!byPerson(p.user_id)) return false;
    const created = Date.parse(p.created_at || '');
    if (since != null && !(created > since)) return false;
    if (windows && filters.when === 'today' && !(created >= windows.today.from)) return false;
    if (windows && (filters.when === 'tonight' || filters.when === 'weekend')) {
      const span = p.post_type === 'event' ? eventSpan(p) : null;
      const window = windows[filters.when];
      if (!span || span.end < window.from || span.start > window.to) return false;
    }
    if (filters.state) {
      const unanswered = filters.state.includes('unanswered') && p.post_type === 'ask_local' && p.resolution !== 'answered';
      const span = p.post_type === 'event' ? eventSpan(p) : null;
      const room = filters.state.includes('room') && p.post_type === 'event' && (!span || span.end >= now);
      if (!unanswered && !room) return false;
    }
    return true;
  };

  const moment = (row, shownAt) => {
    if (!momentsAllowed || !row) return false;
    if (!byPerson(row.user_id)) return false;
    const at = Date.parse(shownAt || row.created_at || '');
    if (since != null && !(at > since)) return false;
    if (!forMap && windows && filters.when === 'today' && !(at >= windows.today.from)) return false;
    return true;
  };

  return { moments: momentsAllowed, posts: true, post, moment, byPerson, since };
}

/** The answer's echo of what was applied (CONTRACT 10a), or nothing when no filter was sent. */
function echo(filters) {
  return filters ? { filters: { ...filters } } : {};
}

module.exports = { KINDS, WHENS, FROMS, STATES, FIELDS, parse, signature, testsFor, windowsAt, eventSpan, echo };
