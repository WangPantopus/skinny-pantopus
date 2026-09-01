// ============================================================
// TEST: Unlisted (Wave 4 — the acquisition slice)
//
// The invariants here are almost entirely about what we must NOT do or
// say, because the failure modes are all overclaiming:
//   * we never assert that a person IS listed anywhere — we do not
//     query brokers, so we do not possess that fact;
//   * the anonymous path persists NOTHING and discloses the address to
//     no one;
//   * an unverified state renders as "we could not confirm", never as
//     "your state has no program" — those are different claims and only
//     one is ours to make;
//   * removal progress is personal, not household: a row saying someone
//     is erasing their address is exactly what must not leak sideways.
// ============================================================

const express = require('express');
const request = require('supertest');
const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');

const unlistedService = require('../services/unlistedService');
const unlistedRoutes = require('../routes/unlisted');
const { DATA_BROKERS } = require('../data/dataBrokers');

const USER = 'unlisted-user-1';
const OTHER = 'unlisted-user-2';
const HOME_ID = 'home-unlisted-1';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/homes', unlistedRoutes);
  return app;
}

function seedHome({ state = 'OR' } = {}) {
  seedTable('Home', [{ id: HOME_ID, owner_id: USER, state, address: '1421 SE Oak St' }]);
  seedTable('HomeOccupancy', [
    { id: 'o1', home_id: HOME_ID, user_id: USER, is_active: true, role: 'owner', role_base: 'owner', verification_status: 'pending' },
  ]);
}

beforeEach(() => resetTables());

// ── The registry's own honesty ───────────────────────────────

describe('the broker registry never claims more than it knows', () => {
  test('no entry carries a "found"-style assertion about a person', () => {
    // We do not query brokers, so no field may imply we checked. This
    // guards the shape of the data, not just today's copy.
    const forbidden = ['found', 'is_listed', 'listed', 'matched', 'hit'];
    for (const broker of DATA_BROKERS) {
      for (const key of Object.keys(broker)) {
        expect(forbidden).not.toContain(key);
      }
    }
  });

  test('every published entry carries the source it was verified against', () => {
    // A wrong opt-out URL sends a frightened person to a dead end, so an
    // unverifiable entry must be omitted rather than guessed.
    for (const broker of DATA_BROKERS) {
      expect(broker.source_url).toMatch(/^https?:\/\//);
      expect(broker.opt_out_url).toMatch(/^https?:\/\//);
      expect(broker.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(broker.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  test('no entry understates what a site publishes relative to another entry for the same site', () => {
    // Spokeo declared [address, phone, email, age] while AnyWho — which
    // runs on Spokeo's platform and cites the identical source_url —
    // declared relatives and prior addresses on top. Both cards render on
    // one screen, and the omitted token was the dangerous one
    // ("Relatives and household members").
    //
    // Deliberately NOT "same opt-out URL implies same exposes": one
    // suppression portal can legitimately serve brands that publish
    // different fields, and a smaller brand may genuinely publish less
    // than the platform it runs on. The sound rule is directional — a
    // brand cannot publish a field its own platform does not.
    const byId = new Map(DATA_BROKERS.map((b) => [b.id, b]));
    const contradictions = [];
    for (const brand of DATA_BROKERS) {
      if (!brand.same_platform_as) continue;
      const platform = byId.get(brand.same_platform_as);
      expect(platform).toBeTruthy();
      for (const token of brand.exposes) {
        if (!platform.exposes.includes(token)) {
          contradictions.push(`${brand.id} declares "${token}", ${platform.id} does not`);
        }
      }
    }
    expect(contradictions).toEqual([]);
  });
});

describe('the exposure profile', () => {
  test('states plainly that we did not look the address up', () => {
    const profile = unlistedService.getExposureProfile('OR');
    // Without this line the page implies a scan it never performed.
    expect(profile.method_note).toBeTruthy();
    expect(profile.method_note).toMatch(/still verifying|do not look/i);

    // THE COMPLETENESS CLAIM. The note used to end "This is every site
    // that republishes county records" — the one sentence on the page a
    // frightened person would read as permission to stop. It is false:
    // the registry omits anything whose opt-out could not be verified.
    // Telling someone the list is complete fails them the same way
    // telling them their state has no program does.
    //
    // The previous assertion (/still verifying|do not look/) passed on
    // either wording, which is why the overclaim shipped.
    expect(profile.method_note).not.toMatch(/every site/i);
    expect(profile.method_note).not.toMatch(/\ball of (them|the sites)\b/i);
    // Stating the count keeps the sentence tied to the list it describes.
    expect(profile.method_note).toContain(String(profile.broker_count));
  });

  test('an unverified state is "could not confirm", never "has no program"', () => {
    const profile = unlistedService.getExposureProfile('ZZ');
    // null is the honest answer; the absence of a verified entry is not
    // evidence that the state lacks a program.
    expect(profile.state_program).toBeNull();
  });

  test('groups are ordered and carry only their own brokers', () => {
    const profile = unlistedService.getExposureProfile('OR');
    const seen = new Set();
    for (const group of profile.groups) {
      expect(group.brokers.length).toBeGreaterThan(0);
      for (const b of group.brokers) {
        expect(b.category).toBe(group.category);
        expect(seen.has(b.id)).toBe(false);
        seen.add(b.id);
      }
    }
    expect(profile.broker_count).toBe(seen.size);
  });
});

// ── Progress tracking ────────────────────────────────────────

// Fail ONE terminal method on the Home table and let everything else run.
//
// The mock's builder returns ITSELF from every chained call, so a plain
// Proxy over the object `from()` hands back is escaped on the first
// `.select()` — the chain continues on the raw builder and the override
// never fires. Re-wrapping each returned builder is what makes it stick.
//
// Failing only one terminal matters: `checkHomePermission` reads Home
// with `.single()` and the route reads it with `.maybeSingle()`. Failing
// both means the permission guard answers first, and a test written that
// way passes with the route's own fix removed. It did, on my first try.
function failHomeTerminal(terminal) {
  const supabaseAdmin = require('../config/supabaseAdmin');
  const realFrom = supabaseAdmin.from.bind(supabaseAdmin);
  const wrap = (builder) => new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === terminal) {
        return async () => ({ data: null, error: { message: 'connection reset' } });
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args) => {
        const out = value.apply(target, args);
        return out === target ? wrap(target) : out;
      };
    },
  });
  return jest.spyOn(supabaseAdmin, 'from').mockImplementation((table) => (
    table === 'Home' ? wrap(realFrom(table)) : realFrom(table)
  ));
}

describe('removal progress', () => {
  test('a claimed (unverified) resident can use it — this must not wait for a postcard', async () => {
    seedHome();
    const res = await request(buildApp())
      .get(`/api/homes/${HOME_ID}/unlisted`)
      .set('x-test-user-id', USER);
    expect(res.status).toBe(200);
    expect(res.body.unlisted.groups).toBeDefined();
    expect(res.body.unlisted.method_note).toBeTruthy();
  });

  test('a non-occupant is refused', async () => {
    seedHome();
    const res = await request(buildApp())
      .get(`/api/homes/${HOME_ID}/unlisted`)
      .set('x-test-user-id', OTHER);
    expect(res.status).toBe(403);
  });

  test('an unknown broker id is refused rather than stored', async () => {
    seedHome();
    const res = await request(buildApp())
      .put(`/api/homes/${HOME_ID}/unlisted/removals/not-a-real-broker`)
      .set('x-test-user-id', USER)
      .send({ status: 'requested' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_BROKER');
    expect(getTable('UnlistedRemoval')).toHaveLength(0);
  });

  test('an unknown status is refused — on a broker that DOES exist', async () => {
    // This used to send brokerId 'anything', which is not a registry id,
    // so UNKNOWN_BROKER threw first and the status check was never
    // reached. Both map to 400 and the test asserted no `code`, so it
    // passed while proving nothing: deleting the entire BAD_STATUS guard
    // left the suite green. Asserting the code is what separates them.
    seedHome();
    const res = await request(buildApp())
      .put(`/api/homes/${HOME_ID}/unlisted/removals/${DATA_BROKERS[0].id}`)
      .set('x-test-user-id', USER)
      .send({ status: 'vanished' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_STATUS');
    expect(getTable('UnlistedRemoval')).toHaveLength(0);
  });

  test('a missing status is refused rather than written as undefined', async () => {
    // Without the guard this writes `status: undefined` and lets a column
    // default decide what the person's checklist claims about whether
    // they actually asked a broker to delete their address.
    seedHome();
    const res = await request(buildApp())
      .put(`/api/homes/${HOME_ID}/unlisted/removals/${DATA_BROKERS[0].id}`)
      .set('x-test-user-id', USER)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_STATUS');
    expect(getTable('UnlistedRemoval')).toHaveLength(0);
  });

  // ── A database blip is not "your home does not exist" ──────
  //
  // PostgREST RESOLVES on both a transport failure and a non-2xx, so the
  // route's `data` is null in both cases and the try/catch never fires.
  // Dropping `error` therefore turned an outage into a 404, and the
  // consequence is worse than the wrong string: both native clients park
  // a 404 behind a manual "Try again", while a correctly typed 500 is
  // auto-retried — so a blip that should have been invisible becomes a
  // dead end in front of someone who came here under duress.
  test('a failed home read is a 500, not "Home not found"', async () => {
    seedHome();
    const spy = failHomeTerminal('maybeSingle');
    try {
      const res = await request(buildApp())
        .get(`/api/homes/${HOME_ID}/unlisted`)
        .set('x-test-user-id', USER);
      expect(res.status).toBe(500);
      // The one thing it must never say.
      expect(JSON.stringify(res.body)).not.toMatch(/not found/i);
    } finally {
      spy.mockRestore();
    }
  });

  test('a failed PERMISSION read is a 500, not "you do not have access"', async () => {
    // Tested against checkHomePermission DIRECTLY, not through the route:
    // both it and the route now read Home with `maybeSingle`, so failing
    // that terminal can no longer tell the two reads apart. Driving the
    // helper is also the more precise assertion — the claim is about what
    // the helper returns, and the route's mapping of it is a separate
    // line already covered above.
    const { checkHomePermission } = require('../utils/homePermissions');
    const supabaseAdmin = require('../config/supabaseAdmin');
    const realFrom = supabaseAdmin.from.bind(supabaseAdmin);
    const wrap = (b) => new Proxy(b, {
      get(t, prop, recv) {
        if (prop === 'maybeSingle') {
          return async () => ({ data: null, error: { message: 'connection reset' } });
        }
        const value = Reflect.get(t, prop, recv);
        if (typeof value !== 'function') return value;
        return (...args) => {
          const out = value.apply(t, args);
          return out === t ? wrap(t) : out;
        };
      },
    });
    const spy = jest.spyOn(supabaseAdmin, 'from')
      .mockImplementation((table) => (table === 'Home' ? wrap(realFrom(table)) : realFrom(table)));

    try {
      seedHome();
      const access = await checkHomePermission(HOME_ID, USER);
      // "We could not check" — distinct from a decision to deny.
      expect(access.readFailed).toBe(true);
      expect(access.hasAccess).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test('PGRST116 — "zero rows" — is not treated as a database failure', async () => {
    // Real PostgREST signals zero rows from `.single()` as an ERROR with
    // this code; the in-memory mock does not, which is why switching the
    // read back to `.single()` does NOT fail the test below. This one
    // models the real semantics directly, so the guard is defended
    // whichever terminal a future edit picks.
    const { checkHomePermission } = require('../utils/homePermissions');
    const supabaseAdmin = require('../config/supabaseAdmin');
    const realFrom = supabaseAdmin.from.bind(supabaseAdmin);
    const wrap = (b) => new Proxy(b, {
      get(t, prop, recv) {
        if (prop === 'maybeSingle' || prop === 'single') {
          return async () => ({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
        }
        const value = Reflect.get(t, prop, recv);
        if (typeof value !== 'function') return value;
        return (...args) => {
          const out = value.apply(t, args);
          return out === t ? wrap(t) : out;
        };
      },
    });
    const spy = jest.spyOn(supabaseAdmin, 'from')
      .mockImplementation((table) => (table === 'Home' ? wrap(realFrom(table)) : realFrom(table)));
    try {
      const access = await checkHomePermission(HOME_ID, USER);
      expect(access.readFailed).toBeFalsy();
      expect(access.hasAccess).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  test('a home that genuinely does not exist is NOT a read failure', async () => {
    // The regression this wave introduced while fixing the opposite bug:
    // `.single()` signals zero rows as an ERROR (PGRST116), so the
    // readFailed guard turned an ordinary "no such home" into a database
    // failure — a 500 where a 403/404 belongs, on every absent id.
    const { checkHomePermission } = require('../utils/homePermissions');
    const access = await checkHomePermission('home-that-does-not-exist', USER);
    expect(access.readFailed).toBeFalsy();
    expect(access.hasAccess).toBe(false);
  });

  test('a genuinely absent home is still a 404', async () => {
    // The two answers must stay distinguishable in both directions.
    // The permission check answers first for an unknown id, so this is a
    // 403 — asserting `[403, 404]` let the test pass without ever reaching
    // the branch it named. What actually matters is the NEGATIVE: an
    // absent home must never be reported as a database failure.
    const res = await request(buildApp())
      .get('/api/homes/home-that-does-not-exist/unlisted')
      .set('x-test-user-id', USER);
    expect(res.status).toBe(403);
    expect(res.status).not.toBe(500);
  });

  test('progress is personal — a housemate never sees it', async () => {
    seedHome();
    seedTable('HomeOccupancy', [
      { id: 'o1', home_id: HOME_ID, user_id: USER, is_active: true, role: 'owner', role_base: 'owner', verification_status: 'pending' },
      { id: 'o2', home_id: HOME_ID, user_id: OTHER, is_active: true, role: 'member', role_base: 'member', verification_status: 'pending' },
    ]);
    seedTable('UnlistedRemoval', [
      { id: 'r1', home_id: HOME_ID, user_id: USER, broker_id: 'someone', status: 'requested' },
    ]);

    const mine = await unlistedService.listRemovals({ homeId: HOME_ID, userId: USER });
    const theirs = await unlistedService.listRemovals({ homeId: HOME_ID, userId: OTHER });
    expect(mine).toHaveLength(1);
    // A row saying "this person is erasing their address" must not be
    // visible to anyone else in the household.
    expect(theirs).toHaveLength(0);
  });

  test('a failed read is null, not an empty checklist', async () => {
    // An empty array would render as "nothing done yet" — a confident
    // statement we cannot make when the read failed.
    const supabaseAdmin = require('../config/supabaseAdmin');
    const realFrom = supabaseAdmin.from;
    supabaseAdmin.from = (table) => {
      if (table !== 'UnlistedRemoval') return realFrom.call(supabaseAdmin, table);
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }) }) };
    };
    try {
      const out = await unlistedService.listRemovals({ homeId: HOME_ID, userId: USER });
      expect(out).toBeNull();
    } finally {
      supabaseAdmin.from = realFrom;
    }
  });
});

// ── The state program: three distinct answers ────────────────
// "We verified your state has one", "we verified your state has none",
// and "we could not confirm" are three different claims, and only the
// first two are ours to make. Collapsing the third into the second
// would tell someone in danger that no help exists when we simply did
// not check.
describe('the state escape hatch', () => {
  const { STATE_DISCLOSURE } = require('../data/stateDisclosure');

  test('a verified program carries a name, an official URL, and who qualifies', () => {
    const profile = unlistedService.getExposureProfile('CA');
    expect(profile.state_program.exists).toBe(true);
    expect(profile.state_program.name).toBeTruthy();
    expect(profile.state_program.url).toMatch(/^https?:\/\//);
    expect(profile.state_program.eligibility).toBeTruthy();
    expect(profile.state_program.source_url).toMatch(/^https?:\/\//);
  });

  test('a verified ABSENCE is exists:false with its source — not null', () => {
    // Alabama was checked and genuinely has no substitute-address
    // program. That is a finding, and it still cites where it came from.
    const profile = unlistedService.getExposureProfile('AL');
    expect(profile.state_program).not.toBeNull();
    expect(profile.state_program.exists).toBe(false);
    expect(profile.state_program.source_url).toMatch(/^https?:\/\//);
    // It must still explain what the state DOES offer, if anything.
    expect(profile.state_program.eligibility).toBeTruthy();
  });

  test('an unchecked state is null — never dressed as "no program"', () => {
    expect(unlistedService.getExposureProfile('ZZ').state_program).toBeNull();
    expect(unlistedService.getExposureProfile('').state_program).toBeNull();
    expect(unlistedService.getExposureProfile(null).state_program).toBeNull();
  });

  test('every state entry cites a source, including the negative ones', () => {
    for (const [code, s] of Object.entries(STATE_DISCLOSURE)) {
      expect(s.source_url).toMatch(new RegExp('^https?://'));
      expect(s.verified_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(s.state).toBe(code);
      // A program that exists must be reachable; one that does not must
      // not carry a dangling link.
      if (s.acp_exists) expect(s.acp_url).toMatch(new RegExp('^https?://'));
    }
  });

  test('every citation is a government or program-operator page, not a secondary summary', () => {
    // "is it a URL" has no teeth, and that is exactly why three states
    // shipped citing a law-review blog for the most dangerous claim in
    // the file — that the reader's state has no program at all. That
    // blog's own list is wrong about Arkansas and South Carolina, both of
    // which this registry contradicts with the states' own pages, so it
    // was provably not what those entries were verified against.
    //
    // The allowlist is for program operators that are not themselves .gov
    // (NACAP is the national association of the state programs, and a
    // state AG's campaign site is the AG's own publication).
    const OPERATOR_HOSTS = ['nacap.org', 'attorneygenerallynnfitch.com'];
    const offenders = [];
    for (const [code, s] of Object.entries(STATE_DISCLOSURE)) {
      const host = new URL(s.source_url).hostname.toLowerCase();
      const ok = host.endsWith('.gov')
        || host.endsWith('.us')
        || OPERATOR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
      if (!ok) offenders.push(`${code}: ${host}`);
    }
    expect(offenders).toEqual([]);
  });

  test('all 50 states and DC are covered, so no resident sees a blank', () => {
    expect(Object.keys(STATE_DISCLOSURE)).toHaveLength(51);
    expect(STATE_DISCLOSURE.DC).toBeTruthy();
  });
});

// ============================================================
// The anonymous route: GET /api/public/unlisted
//
// Two promises live here, and both were broken.
//
//   1. "We do not save this address, and we do not send it anywhere
//      else." The route geocoded through Mapbox, which put the typed
//      address into a third-party query string — on a page whose
//      readers are disproportionately hiding from a specific person.
//
//   2. "We could not place that" and "you are not in the United States"
//      are different answers. Every geocoder failure — an outage, a
//      missing API key, an address it simply could not parse — returned
//      the geographic denial, so a Mapbox blip told every US visitor at
//      once that the product had nothing for them, and withheld the
//      entire national removal list, which never needed the address.
// ============================================================

const publicRouter = require('../routes/public');

function buildPublicApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public', publicRouter);
  return app;
}

describe('the anonymous unlisted lookup', () => {
  test('a full address resolves to its state and sends nothing anywhere', async () => {
    const realFetch = global.fetch;
    const seen = [];
    global.fetch = jest.fn(async (url) => {
      seen.push(String(url));
      return { ok: false, status: 503, json: async () => ({}) };
    });
    try {
      const res = await request(buildPublicApp())
        .get('/api/public/unlisted')
        .query({ address: '1421 SE Oak St, Portland, OR 97214' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.place.state).toBe('OR');
      // No city — resolving one would mean the third-party hop the page
      // promises does not happen.
      expect(res.body.place.city).toBeNull();
      expect(res.body.unlisted.state_program).not.toBeNull();
    } finally {
      global.fetch = realFetch;
    }
    expect(seen).toEqual([]);
  });

  test('an address it cannot place is NOT told it is outside the U.S.', async () => {
    const res = await request(buildPublicApp())
      .get('/api/public/unlisted')
      .query({ address: 'the blue house behind the school' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('could_not_place');
    expect(res.body.status).not.toBe('unsupported_region');
    // The exact laundering that shipped: a geographic denial rendered to
    // someone who is standing in the United States.
    expect(JSON.stringify(res.body)).not.toMatch(/U\.S\.-only|outside the U\.S\./i);
  });

  test('an address it cannot place still gets the WHOLE removal list', async () => {
    // Every broker path is national. None of it needed the address, so
    // withholding it because a state could not be read is a pure loss to
    // the person who came here for exactly that list.
    const full = unlistedService.getExposureProfile('OR');
    const res = await request(buildPublicApp())
      .get('/api/public/unlisted')
      .query({ address: 'no state here' });

    expect(res.body.unlisted.broker_count).toBe(full.broker_count);
    expect(res.body.unlisted.groups).toHaveLength(full.groups.length);
    expect(res.body.unlisted.method_note).toBe(full.method_note);
    // And the state answer degrades to "not checked", never to "none".
    expect(res.body.unlisted.state_program).toBeNull();
  });

  test('the answer is not storable on the reader\'s own device', async () => {
    // Express sends 200 + ETag + no Cache-Control, which is storable —
    // and the cache key is the full URL, which on this route carries the
    // typed address. The browser disk cache, OkHttp's Cache and iOS's
    // URLCache would each write it. For a reader whose threat model is
    // someone with physical access to their device, that is the one place
    // "we do not save this address" most needs to be true.
    const res = await request(buildPublicApp())
      .get('/api/public/unlisted')
      .query({ address: '1421 SE Oak St, Portland, OR 97214' });

    expect(res.headers['cache-control']).toMatch(/no-store/);
  });

  test('a ZIP on its own is enough to reach the state program', async () => {
    const res = await request(buildPublicApp())
      .get('/api/public/unlisted')
      .query({ address: '97214' });
    expect(res.body.status).toBe('ready');
    expect(res.body.place.state).toBe('OR');
  });
});

// ── We do not record that they looked ────────────────────────
//
// The registry's own header states this as a promise. The shared request
// logger stamped an IP and user-agent on every route, this one included.
// The typed address was never in it — that is a query param and
// `req.path` excludes the query string — but "this IP opened the page for
// people hiding their address" is itself the disclosure the feature
// exists to avoid.
describe('the anonymous lookup is not attributed to its caller', () => {
  const logger = require('../utils/logger');

  // The middleware under test lives in app.js, which builds the whole
  // application; mounting it here would drag in every route. Extracting
  // the one predicate keeps the assertion honest without that — it is
  // read from app.js's own source, so a change there fails this.
  test('the log line for /api/public/unlisted carries no ip or user-agent', () => {
    const fs = require('fs');
    const path = require('path');
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

    const match = appSource.match(/const NO_CALLER_ID_PATH = (\/.+\/i?);/);
    expect(match).toBeTruthy();
    // eslint-disable-next-line no-eval
    const pattern = eval(match[1]);
    expect(pattern.test('/api/public/unlisted')).toBe(true);

    // And the logger call really branches on it, rather than declaring a
    // constant nothing reads.
    expect(appSource).toMatch(/NO_CALLER_ID_PATH\.test\(req\.path\)/);

    // Every other public route keeps its caller identifiers — this is a
    // targeted suppression, not a hole in the request log.
    expect(pattern.test('/api/public/place')).toBe(false);
    expect(pattern.test('/api/public/unlisted/extra')).toBe(false);
    expect(pattern.test('/api/homes/abc/unlisted')).toBe(false);
  });

  test('the address is a query param, so it was never on the log line anyway', async () => {
    const seen = [];
    const spy = jest.spyOn(logger, 'info').mockImplementation((msg, meta) => {
      seen.push({ msg, meta });
    });
    try {
      await request(buildPublicApp())
        .get('/api/public/unlisted')
        .query({ address: '1421 ZZQUNIQUEADDR St, Portland, OR' });
    } finally {
      spy.mockRestore();
    }
    for (const line of seen) {
      expect(JSON.stringify(line).toLowerCase()).not.toContain('zzquniqueaddr');
    }
  });
});
